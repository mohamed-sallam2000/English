import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '2mb' }));

// Shared server-side Gemini client (Recovery Studio endpoints)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/* ------------------------------------------------------------------ */
/* Recovery Studio endpoints (formerly app "1")                        */
/* ------------------------------------------------------------------ */

// Endpoint: Automated Diagnosis for English Writing Recovery
app.post('/api/review', async (req: Request, res: Response) => {
  try {
    const { text, knownErrorTypes, top3, phase, kind } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required for review.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Fallback response if API key is not yet configured in Secrets
      return res.status(200).json({
        marks: [],
        generalFeedback: 'Gemini API key is not configured. Please use Guided Self-Check mode or attach your API key in Settings > Secrets.',
        fluencyScore: 85,
        isFallback: true,
      });
    }

    const systemInstruction = `
You are the master editor and linguistic coach for the English Writing Recovery Plan.
Your job is to identify legitimate grammatical errors, structural breakdowns, punctuation errors, tense shifts, article errors, preposition slips, and awkward collocations in the writer's text.

CRITICAL RECOVERY RULE:
1. NEVER supply the corrected sentence or tell the writer the exact replacement word! The plan's pedagogical rule demands that the writer finds and executes the repair themselves.
2. The "quote" field MUST be an EXACT, VERBATIM substring match from the user's text.
3. The "type" should be a standard linguistic error category (e.g., "Subject-Verb Agreement", "Missing / Misused Article", "Tense Shift", "Comma Splice / Run-on", "Sentence Fragment", "Preposition Choice", "Parallel Structure", "Pronoun Reference", "Dangling / Misplaced Modifier", "Word Choice / Collocation").
4. If the user has known target errors (${top3?.join(', ') || 'none specified'}), pay special attention to occurrences of those categories.
5. The "hint" should be a prompt or targeted question (e.g. "Look at the subject of this clause: is it singular or plural?", "Check which preposition idiomatically accompanies this adjective.").
6. The "note" should be a brief one-sentence explanation of the linguistic rule.
7. Return at most 5-8 of the most instructive errors per review to prevent overwhelming the writer. If the text is error-free, return an empty marks array and positive feedback.
`;

    const prompt = `Review this writing passage (Phase: ${phase || 1}, Kind: ${kind || 'writing'}):\n\n"""\n${text}\n"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  quote: { type: Type.STRING, description: 'Exact verbatim substring from user text' },
                  type: { type: Type.STRING, description: 'Standard error category name' },
                  hint: { type: Type.STRING, description: 'Guiding hint or prompt without revealing direct fix' },
                  note: { type: Type.STRING, description: 'Grammar rule explanation' },
                },
                required: ['quote', 'type', 'hint', 'note'],
              },
            },
            generalFeedback: {
              type: Type.STRING,
              description: 'Constructive 2-3 sentence overview of writing rhythm, clarity, and strengths',
            },
            fluencyScore: {
              type: Type.NUMBER,
              description: 'Estimated readability/fluency score out of 100',
            },
          },
          required: ['marks', 'generalFeedback'],
        },
      },
    });

    const outputText = response.text || '{}';
    const parsed = JSON.parse(outputText);

    // Filter marks to ensure quote actually exists in text
    if (Array.isArray(parsed.marks)) {
      parsed.marks = parsed.marks.filter((m: { quote: string }) => m.quote && text.includes(m.quote));
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error during writing review:', error);
    return res.status(500).json({
      error: 'Failed to process AI review.',
      message: error?.message || 'Unknown error occurred.',
    });
  }
});

// Endpoint: Check user's attempted repair without spoiling answers
app.post('/api/check-repair', async (req: Request, res: Response) => {
  try {
    const { originalQuote, userFix, errorType, hint, contextSentence } = req.body;

    if (!userFix || typeof userFix !== 'string') {
      return res.status(400).json({ error: 'Repair text is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        passed: true,
        feedback: 'Marked as repaired (offline/self-evaluation mode).',
      });
    }

    const systemInstruction = `
You are the evaluator verifying a writer's attempted repair of an English grammar/style mark.
The writer had an error of type "${errorType}" on the original text: "${originalQuote}".
Sentence context: "${contextSentence || ''}"
Hint previously provided: "${hint || ''}"
The writer's proposed repair: "${userFix}"

Verify whether the repair solves the specific error cleanly without introducing new syntax or grammatical errors.
If passed is false, do NOT reveal the exact words. Instead, explain what still needs attention.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Evaluate repair: "${userFix}" for original error "${originalQuote}".`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: 'Evaluation note without giving away the exact answer' },
          },
          required: ['passed', 'feedback'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"passed": false, "feedback": "Could not verify"}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error during repair check:', error);
    return res.status(500).json({ error: 'Failed to verify repair.' });
  }
});

/* ------------------------------------------------------------------ */
/* Unaided Studio endpoints (formerly app "2")                         */
/* ------------------------------------------------------------------ */

// API route to get the raw recovery plan markdown
app.get('/api/plan', (_req: Request, res: Response) => {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'public/assets/aistudio/English_Writing_Recovery_Plan_f683dcef.md'),
      path.resolve(process.cwd(), 'dist/assets/aistudio/English_Writing_Recovery_Plan_f683dcef.md'),
    ];
    for (const planPath of candidates) {
      if (fs.existsSync(planPath)) {
        const content = fs.readFileSync(planPath, 'utf-8');
        return res.json({ content });
      }
    }
    return res.status(404).json({ error: 'Plan document not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Strict Post-Draft Diagnostic Coach API
// Strictly enforces the King plan rule:
// "AI marks errors after the draft, without fixing them: You still do the repair, which is the learning."
// "AI drafts or rewrites any sentence: NEVER."
app.post('/api/analyze-errors', async (req: Request, res: Response) => {
  const { text, phase = 1, drillType = '' } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Draft text is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured in environment. Deterministic analysis will be used.',
      fallback: true
    });
  }

  try {
    const aiClient = new GoogleGenAI({});
    const prompt = `You are the mentor and diagnostic writing coach for a student working through the "English Writing Recovery Plan" by @King.
The student is rebuilding their unaided English writing ability after developing cognitive debt from AI autocomplete and drafting tools.

CRITICAL MENTOR CONSTITUTION (VIOLATION IS STRICTLY FORBIDDEN):
1. NEVER rewrite, fix, or provide the corrected version of any sentence or phrase.
2. NEVER draft content for the student.
3. ONLY identify errors, categorize them, explain the rule, and ask a guiding question that leads the student to self-repair.
4. Be strict but encouraging. The goal is unaided fluency, not dependency.
5. Focus on the highest-signal errors: articles, prepositions, subject-verb agreement, tense consistency, run-ons, sentence length (>20 words), delayed subjects, spelling, and word precision.
6. Categorize each error into one of the tracker categories:
   - "Missing article"
   - "Article with plural"
   - "Missing 'to' before a verb"
   - "Noun used as an adjective"
   - "Spelling"
   - "Sentence too long (>20 words)"
   - "Delayed subject/verb (>5 words)"
   - "Run-on sentence"
   - "Word choice / precision"
   - "Punctuation / comma splice"
7. Explain the grammatical rule clearly in 1-2 sentences, and pose a self-repair guiding question so the user can fix it on their own.

Context: Phase ${phase} practice. Drill: ${drillType || 'General Unaided Draft'}.

Student's unaided draft:
"""
${text}
"""

Respond ONLY with valid JSON conforming to this schema:
{
  "summary": "1-2 short sentences evaluating sentence cadence, flow, and unaided progress (no rewrite hints).",
  "wordCount": number,
  "errors": [
    {
      "type": "Missing article | Article with plural | Missing 'to' before a verb | Noun used as an adjective | Spelling | Sentence too long (>20 words) | Delayed subject/verb | Run-on sentence | Word choice / precision | Punctuation / comma splice",
      "snippet": "exact faulty phrase or snippet from student text",
      "sentence": "the full sentence containing the issue",
      "ruleExplanation": "Clear, direct explanation of the grammar rule without providing the solution",
      "hintQuestion": "A guiding question prompting the student to correct it themselves"
    }
  ]
}`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      }
    });

    const responseText = response.text?.trim() || '{}';
    const parsed = JSON.parse(responseText);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Gemini error analysis failed:', err);
    return res.status(500).json({ error: err.message || 'Diagnostic analysis failed' });
  }
});

/* ------------------------------------------------------------------ */
/* Static hosting / dev middleware                                     */
/* ------------------------------------------------------------------ */

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`English Writing Recovery server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
