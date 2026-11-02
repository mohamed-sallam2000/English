# English Writing Recovery

One installable application that merges the two original AI Studio apps:

- **Recovery Studio** (originally folder `1/`) — Today dashboard, Focus Mode timed sprints with AI review, Pieces library, Error Ledger, model Library, Progress stats, Settings, onboarding presets (Egypt / Standard / Custom), and three color themes.
- **Unaided Studio** (originally folder `2/`) — Daily 25-minute unaided sprint (copywork → write → self-check), Phase 2 deliberate drills, Essay Studio, Error Tracker with 3-strike drills, Roadmap with phase gates, Reading Habit tracker, and the original plan document.

A slim switcher bar at the top moves between the two studios. Your choice is remembered, and each studio keeps its own separate saved data (nothing is lost or merged destructively).

## Desktop & Mobile (PWA)

The app is an installable Progressive Web App:

- **Desktop (Chrome/Edge)**: click the install icon in the address bar.
- **Android**: browser menu → "Add to Home screen" / "Install app".
- **iPhone/iPad (Safari)**: Share → "Add to Home Screen".

It works offline for previously visited pages and is fully responsive from phones to wide desktops.

> The PWA icons are generated automatically by `scripts/gen-icons.mjs` (hooked into `npm run dev` / `npm run build`) so the repository stays text-only — no setup needed.

## Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
# optional: echo "GEMINI_API_KEY=your_key" > .env.local
npm run dev
```

Open http://localhost:3000

Without a `GEMINI_API_KEY`, the AI review features automatically fall back to guided self-check / deterministic analysis — everything else works fully offline, with all data stored privately in your browser.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Or with Docker:

```bash
docker build -t writing-recovery .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key writing-recovery
```

## Project Structure

```
server.ts                 # Express server: all 4 Gemini API endpoints + static hosting
src/shell/                # Workspace switcher + PWA registration
src/recovery/             # Recovery Studio (original app 1)
src/unaided/              # Unaided Studio (original app 2)
public/manifest.webmanifest, public/sw.js, public/icons/   # PWA support
```

### API endpoints

| Endpoint | Used by | Purpose |
|---|---|---|
| `POST /api/review` | Recovery Studio | Post-draft error diagnosis (hints only, never fixes) |
| `POST /api/check-repair` | Recovery Studio | Verifies your self-repair without spoiling the answer |
| `POST /api/analyze-errors` | Unaided Studio | Strict diagnostic coach for unaided drafts |
| `GET /api/plan` | Unaided Studio | Serves the original Recovery Plan document |
