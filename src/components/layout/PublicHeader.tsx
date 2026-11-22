import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          DraftVault
        </Link>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300" aria-label="Primary navigation">
          <Link
            to="/#autosave"
            className="rounded-sm hover:text-slate-950 hover:underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 whitespace-nowrap shrink-0 dark:hover:text-white"
          >
            Autosave Engine
          </Link>
          <Link
            to="/#workflow"
            className="rounded-sm hover:text-slate-950 hover:underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 whitespace-nowrap shrink-0 dark:hover:text-white"
          >
            Form Workflow
          </Link>
          <Link
            to="/#security"
            className="rounded-sm hover:text-slate-950 hover:underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 whitespace-nowrap shrink-0 dark:hover:text-white"
          >
            Security
          </Link>
          <Link
            to="/admin/login"
            className="rounded-sm hover:text-slate-950 hover:underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 whitespace-nowrap shrink-0 dark:hover:text-white"
          >
            Admin Portal
          </Link>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center shrink-0">
          <Link
            to={user ? '/dashboard' : '/login'}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
          >
            {user ? 'Open Dashboard' : 'Sign In'}
          </Link>
        </div>
      </div>
    </header>
  );
}
