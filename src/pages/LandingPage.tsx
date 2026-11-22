import { ArrowRight, CheckCircle2, FileCheck2, Lock, RefreshCw, Shield } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PublicHeader } from '../components/layout/PublicHeader';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace('#', '');
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
        {/* Hero */}
        <section className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              Autosave Form Management System
            </p>
            <h1 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Never lose progress on lengthy multi-step applications.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              DraftVault persists every form change 800ms after you pause typing, retries network
              interruptions with exponential backoff, detects concurrent tab edits with
              version-controlled conflict resolution, and secures uploaded documents end to end.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={user ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
              >
                <span>{user ? 'Go to Dashboard' : 'Create Free Account'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Live Autosave Guarantees
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Active Engine</span>
                </span>
              </div>

              <dl className="mt-5 space-y-4">
                <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800/80">
                  <dt className="text-sm text-slate-600 dark:text-slate-400">Typing debounce</dt>
                  <dd className="font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    800 ms
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800/80">
                  <dt className="text-sm text-slate-600 dark:text-slate-400">
                    Retry backoff window
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    2 s → 30 s
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800/80">
                  <dt className="text-sm text-slate-600 dark:text-slate-400">
                    Concurrency protection
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Optimistic vN Lock
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-slate-600 dark:text-slate-400">
                    Supported documents
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                    PDF · JPG · PNG · DOCX
                  </dd>
                </div>
              </dl>
            </div>

            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
              Every draft version is stored transactionally in SQLite with instant step restoration
              after browser refreshes.
            </p>
          </div>
        </section>

        {/* Feature Architecture */}
        <section
          id="autosave"
          className="mt-20 grid grid-cols-1 gap-8 border-t border-slate-200 pt-14 md:grid-cols-3 dark:border-slate-800"
        >
          <div>
            <RefreshCw className="h-5 w-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              01. Conflict-Safe Autosave
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Changes save automatically 800ms after typing stops and whenever you leave a field.
              Out-of-order responses never overwrite newer edits, and simultaneous browser tabs are
              detected before data is lost.
            </p>
          </div>

          <div id="workflow">
            <FileCheck2 className="h-5 w-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              02. Five-Step Guided Workflow
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Navigate seamlessly across Personal, Address, Education, Additional Information, and
              Review steps with server-validated rules, last-step restoration, and drag-and-drop
              document verification.
            </p>
          </div>

          <div id="security">
            <Shield className="h-5 w-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              03. Role-Based Security & Storage
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              HTTP-only session cookies, CSRF verification, scrypt password hashing, magic-byte file
              signature checks, and private non-public upload storage protect every applicant record.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:px-8 dark:text-slate-400">
          <span>Autosave Form Management System</span>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-900 dark:hover:text-slate-200">
              Applicant Sign In
            </Link>
            <Link to="/register" className="hover:text-slate-900 dark:hover:text-slate-200">
              Register
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Administrator Console</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
