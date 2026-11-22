import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicHeader } from '../components/layout/PublicHeader';
import { apiRequest } from '../lib/api';
import type { DraftDetail } from '../types';

export function DraftRecoveryPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function recover() {
      if (!shareToken) {
        setError('Invalid draft recovery link.');
        return;
      }
      try {
        const res = await apiRequest<{ draft: DraftDetail }>(
          `/api/drafts/recover/${encodeURIComponent(shareToken)}`
        );
        if (active) {
          navigate(`/drafts/${res.draft.id}`, { replace: true });
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to recover this draft. Make sure you are signed in to the owning account.'
          );
        }
      }
    }
    void recover();
    return () => {
      active = false;
    };
  }, [shareToken, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20 text-center">
        {error ? (
          <div className="w-full rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" aria-hidden="true" />
            <h1 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Draft Recovery Failed
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <Link
              to="/dashboard"
              className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-blue-700 dark:text-blue-400" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Recovering your saved application draft...
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
