import { useState } from 'react';
import { PenLine, NotebookPen, Feather } from 'lucide-react';
import RecoveryApp from '../recovery/App';
import UnaidedApp from '../unaided/App';

type Workspace = 'recovery' | 'unaided';

const WS_KEY = 'ewr_active_workspace_v1';

function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(WS_KEY);
    return raw === 'unaided' ? 'unaided' : 'recovery';
  } catch {
    return 'recovery';
  }
}

export default function WorkspaceShell() {
  const [workspace, setWorkspaceState] = useState<Workspace>(loadWorkspace);

  const setWorkspace = (ws: Workspace) => {
    setWorkspaceState(ws);
    try {
      localStorage.setItem(WS_KEY, ws);
    } catch {
      /* storage unavailable */
    }
  };

  // The switcher bar adapts to whichever workspace is active:
  // Recovery Studio is theme-driven (CSS vars); Unaided Studio is light stone.
  const barTheme =
    workspace === 'recovery'
      ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-subtle)]'
      : 'bg-white text-stone-900 border-stone-200';

  const segTheme =
    workspace === 'recovery'
      ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
      : 'bg-stone-100 border-stone-200';

  const activeBtn =
    workspace === 'recovery'
      ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
      : 'bg-stone-900 text-white shadow-sm';

  const inactiveBtn =
    workspace === 'recovery'
      ? 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      : 'text-stone-500 hover:text-stone-900';

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Global workspace switcher bar */}
      <header
        className={`shrink-0 border-b transition-colors pt-[env(safe-area-inset-top)] ${barTheme}`}
      >
        <div className="h-12 px-3 sm:px-4 flex items-center justify-between gap-2 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
                workspace === 'recovery'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'bg-stone-900 text-white'
              }`}
            >
              <PenLine className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-semibold text-sm tracking-tight truncate hidden min-[420px]:inline">
              English Writing Recovery
            </span>
          </div>

          <nav
            aria-label="Workspace switcher"
            className={`flex items-center rounded-full border p-0.5 ${segTheme}`}
          >
            <button
              type="button"
              aria-pressed={workspace === 'recovery'}
              onClick={() => setWorkspace('recovery')}
              className={`flex items-center gap-1.5 rounded-full px-3 sm:px-4 h-11 sm:h-8 text-xs sm:text-sm font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                workspace === 'recovery' ? activeBtn : inactiveBtn
              }`}
            >
              <NotebookPen className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Recovery</span>
              <span className="hidden sm:inline">Recovery Studio</span>
            </button>
            <button
              type="button"
              aria-pressed={workspace === 'unaided'}
              onClick={() => setWorkspace('unaided')}
              className={`flex items-center gap-1.5 rounded-full px-3 sm:px-4 h-11 sm:h-8 text-xs sm:text-sm font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                workspace === 'unaided' ? activeBtn : inactiveBtn
              }`}
            >
              <Feather className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Unaided</span>
              <span className="hidden sm:inline">Unaided Studio</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Both workspaces stay mounted so in-progress writing survives switching */}
      <div className={workspace === 'recovery' ? 'contents' : 'hidden'} aria-hidden={workspace !== 'recovery'}>
        <RecoveryApp />
      </div>
      <div
        className={workspace === 'unaided' ? 'unaided-scope contents' : 'hidden'}
        aria-hidden={workspace !== 'unaided'}
      >
        <UnaidedApp />
      </div>
    </div>
  );
}
