import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudOff,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import type { AutosaveStateSnapshot } from '../../lib/autosaveEngine';
import { copyTextToClipboard } from '../../lib/clipboard';

interface AutosaveStatusBarProps {
  autosave: AutosaveStateSnapshot;
  shareToken: string;
  onManualSave: () => void;
  onOpenConflictModal: () => void;
  onReloadFromServer: () => void;
}

export function AutosaveStatusBar({
  autosave,
  shareToken,
  onManualSave,
  onOpenConflictModal,
  onReloadFromServer,
}: AutosaveStatusBarProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopyRecoveryLink = async () => {
    const recoveryUrl = `${window.location.origin}/recover/${shareToken}`;
    setCopyError(null);
    const ok = await copyTextToClipboard(recoveryUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopyError(`Copy unavailable in this context. Recovery link: ${recoveryUrl}`);
    }
  };

  const renderStatus = () => {
    if (autosave.isOffline) {
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Offline — changes preserved locally until connection resumes</span>
        </span>
      );
    }

    switch (autosave.status) {
      case 'unsaved':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Unsaved changes — autosaving shortly</span>
          </span>
        );
      case 'saving':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>Saving changes...</span>
          </span>
        );
      case 'saved':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>All changes saved</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Save failed{autosave.nextRetryInSeconds !== null ? ` · Retrying in ${autosave.nextRetryInSeconds}s` : ''}
            </span>
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>
              Retrying{autosave.nextRetryInSeconds ? ` in ${autosave.nextRetryInSeconds}s` : '...'} (Attempt{' '}
              <span className="tabular-nums">{autosave.retryAttempt}</span>)
            </span>
          </span>
        );
      case 'conflict':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Editing conflict detected — action required</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Autosave ready (800ms)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div role="status" aria-live="polite">
            {renderStatus()}
          </div>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            Version v{autosave.version}
          </span>
          {autosave.lastSavedAt && (
            <>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                Last saved {new Date(autosave.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {autosave.status === 'conflict' && (
            <button
              type="button"
              onClick={onOpenConflictModal}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 whitespace-nowrap shrink-0"
            >
              Resolve Conflict
            </button>
          )}

          {(autosave.status === 'unsaved' || autosave.status === 'failed' || autosave.status === 'retrying') && (
            <button
              type="button"
              onClick={onManualSave}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              Save Now
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleCopyRecoveryLink()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                <span>Recovery Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Recovery Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {copyError && (
        <p className="break-all rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {copyError}
        </p>
      )}

      {autosave.otherTabWarning && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>{autosave.otherTabWarning}</span>
          </div>
          <button
            type="button"
            onClick={onReloadFromServer}
            className="rounded-sm font-medium underline underline-offset-2 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:text-amber-100 whitespace-nowrap shrink-0"
          >
            Sync latest version
          </button>
        </div>
      )}

      {autosave.errorMessage && autosave.status !== 'conflict' && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {autosave.errorMessage}
        </p>
      )}
    </div>
  );
}
