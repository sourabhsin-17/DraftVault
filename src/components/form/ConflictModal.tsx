import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import { useEffect } from 'react';
import { buildFieldLabelMap, formatFieldValue, getFieldLabel } from '../../lib/formLabels';
import type { ConflictPayload, FormStepConfig } from '../../types';

interface ConflictModalProps {
  open: boolean;
  localVersion: number;
  localStep?: number;
  localData: Record<string, unknown>;
  steps?: FormStepConfig[];
  conflict: ConflictPayload | null;
  busy: boolean;
  error?: string | null;
  onUseServer: () => void;
  onKeepLocal: () => void;
  onClose: () => void;
}

export function ConflictModal({
  open,
  localVersion,
  localStep,
  localData,
  steps,
  conflict,
  busy,
  error = null,
  onUseServer,
  onKeepLocal,
  onClose,
}: ConflictModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, busy, onClose]);

  if (!open || !conflict) return null;

  const labelMap = buildFieldLabelMap(steps);
  const allKeys = Array.from(
    new Set([...Object.keys(localData), ...Object.keys(conflict.serverData || {})])
  );
  const differingKeys = allKeys.filter((key) => {
    const localVal = String(localData[key] ?? '');
    const serverVal = String(conflict.serverData?.[key] ?? '');
    return localVal !== serverVal;
  });

  const stepDiffers =
    typeof localStep === 'number' && localStep !== conflict.serverCurrentStep;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="conflict-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Editing Conflict Detected
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Your session was editing version{' '}
                <span className="font-mono font-semibold tabular-nums">v{localVersion}</span>, while
                the server already saved version{' '}
                <span className="font-mono font-semibold tabular-nums">
                  v{conflict.serverVersion}
                </span>{' '}
                at{' '}
                <span className="font-mono tabular-nums">
                  {new Date(conflict.serverUpdatedAt).toLocaleTimeString()}
                </span>
                . Choose which version to keep so no edits are overwritten unexpectedly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close conflict dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {stepDiffers && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Active step differs: Your session is on{' '}
              <span className="font-semibold tabular-nums">Step {localStep}</span>, while server
              version <span className="font-mono tabular-nums">v{conflict.serverVersion}</span> is
              on <span className="font-semibold tabular-nums">Step {conflict.serverCurrentStep}</span>.
            </div>
          )}

          {differingKeys.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The server version metadata changed (for example, active step or timestamp), but all
              entered field values are identical.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Comparing <span className="tabular-nums">{differingKeys.length}</span> conflicting
                field{differingKeys.length === 1 ? '' : 's'}:
              </p>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {differingKeys.map((key) => {
                  const fieldLabel = getFieldLabel(key, labelMap);
                  return (
                    <div key={key} className="space-y-2.5 p-4">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {fieldLabel}
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                            Your Current Session (v{localVersion})
                          </p>
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-amber-50/70 p-2.5 text-sm text-slate-900 dark:bg-amber-950/30 dark:text-slate-100">
                            {formatFieldValue(localData[key])}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                            Latest Server Version (v{conflict.serverVersion})
                          </p>
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-blue-50/70 p-2.5 text-sm text-slate-900 dark:bg-blue-950/30 dark:text-slate-100">
                            {formatFieldValue(conflict.serverData?.[key])}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Keeping your version advances the server revision to preserve an audit trail.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onUseServer}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Load Server v{conflict.serverVersion}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onKeepLocal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? 'Resolving...' : 'Keep My Current Edits'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
