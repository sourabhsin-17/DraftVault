import { ArrowLeft, ArrowRight, CheckCircle2, History, Info, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AutosaveStatusBar } from '../components/form/AutosaveStatusBar';
import { ConflictModal } from '../components/form/ConflictModal';
import { DynamicField } from '../components/form/DynamicField';
import { FileUploadZone } from '../components/form/FileUploadZone';
import { ReviewStep } from '../components/form/ReviewStep';
import { StepProgress } from '../components/form/StepProgress';
import { AppShell } from '../components/layout/AppShell';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SkeletonBlock } from '../components/ui/Skeleton';
import { ApiClientError, apiRequest } from '../lib/api';
import {
  AutosaveEngine,
  clearLocalRecoveryBuffer,
  readLocalRecoveryBuffer,
  type AutosaveStateSnapshot,
} from '../lib/autosaveEngine';
import type { ConflictPayload, DraftDetail, FormConfigResponse, UploadedFileRecord } from '../types';

export function FormWorkspace() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRevision = searchParams.get('revision') === '1';

  const [formConfig, setFormConfig] = useState<FormConfigResponse | null>(null);
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const [autosaveState, setAutosaveState] = useState<AutosaveStateSnapshot>({
    status: 'idle',
    version: 1,
    lastSavedAt: null,
    retryAttempt: 0,
    nextRetryInSeconds: null,
    errorMessage: null,
    isOffline: false,
    otherTabWarning: null,
    conflict: null,
  });

  const engineRef = useRef<AutosaveEngine | null>(null);
  const formDataRef = useRef(formData);
  const currentStepRef = useRef(currentStep);
  const completedStepsRef = useRef(completedSteps);

  formDataRef.current = formData;
  currentStepRef.current = currentStep;
  completedStepsRef.current = completedSteps;

  const hydrateDraft = useCallback((loadedDraft: DraftDetail) => {
    setDraft(loadedDraft);
    setFormData(loadedDraft.data || {});
    setCurrentStep(loadedDraft.currentStep || 1);
    setCompletedSteps(loadedDraft.completedSteps || []);
    setFiles(loadedDraft.files || []);
    setFieldErrors({});
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    setLoadError(null);
    setRecoveryNotice(null);
    try {
      const [configRes, draftRes] = await Promise.all([
        apiRequest<FormConfigResponse>('/api/forms/config'),
        apiRequest<{ draft: DraftDetail }>(`/api/drafts/${draftId}`),
      ]);
      const loadedDraft = draftRes.draft;
      setFormConfig(configRes);
      hydrateDraft(loadedDraft);

      if (engineRef.current) {
        engineRef.current.destroy();
      }

      const engine = new AutosaveEngine({
        draftId: loadedDraft.id,
        initialVersion: loadedDraft.version,
        initialUpdatedAt: loadedDraft.updatedAt,
        onStateChange: (snapshot) => {
          setAutosaveState(snapshot);
          if (snapshot.status === 'conflict') {
            setConflictModalOpen(true);
          }
        },
        onServerAck: ({ version, updatedAt }) => {
          setDraft((prev) => (prev ? { ...prev, version, updatedAt } : prev));
        },
      });
      engineRef.current = engine;

      // Check for unsaved local edits interrupted before debounce/network completion
      if (loadedDraft.status === 'Draft') {
        const localBuffer = readLocalRecoveryBuffer(loadedDraft.id);
        if (localBuffer) {
          if (localBuffer.baseVersion === loadedDraft.version) {
            setFormData(localBuffer.data);
            setCurrentStep(localBuffer.currentStep);
            setCompletedSteps(localBuffer.completedSteps);
            setRecoveryNotice(
              'Recovered unsaved local changes from before your browser refreshed. Syncing to server...'
            );
            engine.scheduleSave({
              currentStep: localBuffer.currentStep,
              data: localBuffer.data,
              completedSteps: localBuffer.completedSteps,
              changeSummary: 'Recovered unsaved local changes',
            });
          } else {
            // Server advanced while local edits were unsaved -> trigger safe conflict modal
            setFormData(localBuffer.data);
            setCurrentStep(localBuffer.currentStep);
            setCompletedSteps(localBuffer.completedSteps);
            engine.setConflict({
              serverVersion: loadedDraft.version,
              serverCurrentStep: loadedDraft.currentStep,
              serverUpdatedAt: loadedDraft.updatedAt,
              serverLastTabId: loadedDraft.lastClientTabId,
              serverData: loadedDraft.data,
              serverCompletedSteps: loadedDraft.completedSteps,
            });
            setConflictModalOpen(true);
          }
        }
      } else {
        clearLocalRecoveryBuffer(loadedDraft.id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load draft workspace.');
    } finally {
      setLoading(false);
    }
  }, [draftId, hydrateDraft]);

  useEffect(() => {
    void loadWorkspace();
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [loadWorkspace]);

  // Warn user before leaving if unsaved changes are pending debounce/network
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (engineRef.current?.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleFieldChange = (name: string, value: unknown) => {
    const nextData = { ...formDataRef.current, [name]: value };
    setFormData(nextData);
    setRecoveryNotice(null);

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }

    if (draft?.status === 'Draft') {
      engineRef.current?.scheduleSave({
        currentStep: currentStepRef.current,
        data: nextData,
        completedSteps: completedStepsRef.current,
      });
    }
  };

  const handleFieldBlur = () => {
    if (draft?.status !== 'Draft') return;
    engineRef.current?.saveOnBlur({
      currentStep: currentStepRef.current,
      data: formDataRef.current,
      completedSteps: completedStepsRef.current,
    });
  };

  const handleManualSave = () => {
    void engineRef.current?.flushNow();
  };

  const handleReloadFromServer = async () => {
    if (!draftId) return;
    const res = await apiRequest<{ draft: DraftDetail }>(`/api/drafts/${draftId}`);
    hydrateDraft(res.draft);
    engineRef.current?.syncExternalVersion(res.draft.version, res.draft.updatedAt);
    setRecoveryNotice(null);
    setConflictModalOpen(false);
  };

  const handleNextStep = async () => {
    if (!formConfig || !draft) return;
    setAdvancing(true);
    setFieldErrors({});

    try {
      const flushed = await engineRef.current?.flushNow();
      if (flushed === false && engineRef.current?.getStatus() === 'conflict') {
        setConflictModalOpen(true);
        return;
      }

      const baseVersion = engineRef.current?.getVersion() ?? draft.version;
      const nextStep = Math.min(formConfig.totalSteps, currentStep + 1);

      const res = await apiRequest<{
        draft: { version: number; currentStep: number; completedSteps: number[]; updatedAt: string };
      }>(`/api/forms/${draft.id}/save-step`, {
        method: 'POST',
        body: {
          stepNumber: currentStep,
          baseVersion,
          nextStep,
          data: formData,
          completedSteps,
          tabId: engineRef.current?.tabId,
        },
      });

      setCurrentStep(res.draft.currentStep);
      setCompletedSteps(res.draft.completedSteps);
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              version: res.draft.version,
              currentStep: res.draft.currentStep,
              completedSteps: res.draft.completedSteps,
              updatedAt: res.draft.updatedAt,
            }
          : prev
      );
      engineRef.current?.syncExternalVersion(res.draft.version, res.draft.updatedAt);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VERSION_CONFLICT') {
          if (err.details) {
            engineRef.current?.setConflict(err.details as unknown as ConflictPayload, err.message);
          }
          setConflictModalOpen(true);
          return;
        }
        const details = err.details as { fieldErrors?: Record<string, string> } | undefined;
        if (details?.fieldErrors) {
          setFieldErrors(details.fieldErrors);
        } else {
          setFieldErrors({ _form: err.message });
        }
      } else {
        setFieldErrors({ _form: 'Unable to validate this step right now.' });
      }
    } finally {
      setAdvancing(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep <= 1) return;
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setFieldErrors({});
    if (draft?.status === 'Draft') {
      engineRef.current?.scheduleSave({
        currentStep: prevStep,
        data: formData,
        completedSteps,
        changeSummary: `Navigated to step ${prevStep}`,
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
    setFieldErrors({});
    if (draft?.status === 'Draft') {
      engineRef.current?.scheduleSave({
        currentStep: stepNumber,
        data: formData,
        completedSteps,
        changeSummary: `Jumped to step ${stepNumber}`,
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestSubmit = async () => {
    setFieldErrors({});
    try {
      await apiRequest('/api/forms/validate-step', {
        method: 'POST',
        body: { stepNumber: 5, data: formData },
      });
      setConfirmSubmitOpen(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        const details = err.details as { fieldErrors?: Record<string, string> } | undefined;
        if (details?.fieldErrors) {
          setFieldErrors(details.fieldErrors);
        } else {
          setFieldErrors({ _form: err.message });
        }
      }
    }
  };

  const handleConfirmSubmit = async () => {
    if (!draft || submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      const flushed = await engineRef.current?.flushNow();
      if (flushed === false && engineRef.current?.getStatus() === 'conflict') {
        setConfirmSubmitOpen(false);
        setConflictModalOpen(true);
        return;
      }
      const baseVersion = engineRef.current?.getVersion() ?? draft.version;

      const res = await apiRequest<{
        submission: { id: string; referenceCode: string };
      }>('/api/forms/submit', {
        method: 'POST',
        body: {
          draftId: draft.id,
          baseVersion,
          data: formData,
        },
      });
      clearLocalRecoveryBuffer(draft.id);
      setConfirmSubmitOpen(false);
      navigate(`/submissions/${res.submission.id}`, { replace: true });
    } catch (err) {
      setConfirmSubmitOpen(false);
      if (err instanceof ApiClientError) {
        if (err.code === 'VERSION_CONFLICT') {
          const refreshed = await apiRequest<{ draft: DraftDetail }>(`/api/drafts/${draft.id}`);
          engineRef.current?.setConflict({
            serverVersion: refreshed.draft.version,
            serverCurrentStep: refreshed.draft.currentStep,
            serverUpdatedAt: refreshed.draft.updatedAt,
            serverLastTabId: refreshed.draft.lastClientTabId,
            serverData: refreshed.draft.data,
            serverCompletedSteps: refreshed.draft.completedSteps,
          });
          setConflictModalOpen(true);
          return;
        }
        const details = err.details as { fieldErrors?: Record<string, string> } | undefined;
        if (details?.fieldErrors) {
          setFieldErrors(details.fieldErrors);
        } else {
          setFieldErrors({ _form: err.message });
        }
      } else {
        setFieldErrors({ _form: 'Submission failed. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveConflict = async (resolution: 'use_server' | 'keep_local') => {
    if (!draft || !autosaveState.conflict) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const res = await apiRequest<{ draft: DraftDetail }>(
        `/api/drafts/${draft.id}/resolve-conflict`,
        {
          method: 'POST',
          body: {
            resolution,
            expectedServerVersion: autosaveState.conflict.serverVersion,
            currentStep,
            data: formData,
            completedSteps,
            tabId: engineRef.current?.tabId,
          },
        }
      );
      hydrateDraft(res.draft);
      engineRef.current?.syncExternalVersion(res.draft.version, res.draft.updatedAt);
      setRecoveryNotice(null);
      setConflictError(null);
      setConflictModalOpen(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'VERSION_CONFLICT' && err.details) {
        engineRef.current?.setConflict(err.details as unknown as ConflictPayload, err.message);
        setConflictError('Another update occurred on the server while resolving. Review the refreshed comparison below.');
      } else {
        setConflictError(err instanceof Error ? err.message : 'Unable to resolve conflict.');
      }
    } finally {
      setResolvingConflict(false);
    }
  };

  const activeStepConfig = formConfig?.steps.find((s) => s.stepNumber === currentStep);
  const isLocked = draft?.status === 'Submitted';
  const validationErrorCount = Object.keys(fieldErrors).filter((k) => k !== '_form').length;

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: draft?.title || 'Application Form' },
      ]}
      primaryAction={
        <Link
          to="/dashboard"
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          Back to Dashboard
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <SkeletonBlock className="h-14" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-96" />
        </div>
      ) : loadError || !draft || !formConfig ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {loadError || 'Unable to load application draft.'}
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {isLocked && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>
                  This application has been submitted and is locked against further edits.
                </span>
              </div>
              <Link to="/dashboard" className="font-medium underline whitespace-nowrap">
                View Submissions
              </Link>
            </div>
          )}

          {recoveryNotice && (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs font-medium text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
            >
              <Info className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>{recoveryNotice}</span>
            </div>
          )}

          {!isLocked && (
            <AutosaveStatusBar
              autosave={autosaveState}
              shareToken={draft.shareToken}
              onManualSave={handleManualSave}
              onOpenConflictModal={() => {
                setConflictError(null);
                setConflictModalOpen(true);
              }}
              onReloadFromServer={() => void handleReloadFromServer()}
            />
          )}

          <StepProgress
            steps={formConfig.steps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onSelectStep={handleJumpToStep}
          />

          {/* Active Step Card */}
          {activeStepConfig && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
                <h1 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  {activeStepConfig.stepNumber}. {activeStepConfig.title}
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {activeStepConfig.subtitle}
                </p>
              </div>

              {(fieldErrors._form || (activeStepConfig.isReviewStep && validationErrorCount > 0)) && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                >
                  {fieldErrors._form ||
                    `Please complete or fix ${validationErrorCount} required field${validationErrorCount === 1 ? '' : 's'} highlighted below before submitting.`}
                </div>
              )}

              <div className="mt-6">
                {activeStepConfig.isReviewStep ? (
                  <ReviewStep
                    steps={formConfig.steps}
                    formData={formData}
                    files={files}
                    fieldErrors={fieldErrors}
                    onJumpToStep={handleJumpToStep}
                    onChange={handleFieldChange}
                    onBlur={handleFieldBlur}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {activeStepConfig.fields.map((field) =>
                      field.type === 'file' ? (
                        <FileUploadZone
                          key={field.name}
                          draftId={draft.id}
                          files={files}
                          disabled={isLocked}
                          onFilesUpdated={setFiles}
                        />
                      ) : (
                        <DynamicField
                          key={field.name}
                          field={field}
                          value={formData[field.name]}
                          error={fieldErrors[field.name]}
                          disabled={isLocked}
                          onChange={handleFieldChange}
                          onBlur={handleFieldBlur}
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Step Footer Navigation */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStep === 1 || advancing || submitting}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </button>

                {currentStep < formConfig.totalSteps ? (
                  <button
                    type="button"
                    onClick={() => void handleNextStep()}
                    disabled={advancing || isLocked}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
                  >
                    <span>{advancing ? 'Validating...' : 'Save & Continue'}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleRequestSubmit()}
                    disabled={submitting || isLocked}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>{submitting ? (isRevision ? 'Saving revision...' : 'Submitting...') : (isRevision ? 'Save Revised Application' : 'Submit Application')}</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Version Audit History Toggle */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowVersionHistory((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4" aria-hidden="true" />
                <span>
                  Draft Version History (<span className="tabular-nums">{draft.versions.length}</span>{' '}
                  recent snapshots)
                </span>
              </span>
              <span>{showVersionHistory ? 'Hide' : 'Show'}</span>
            </button>

            {showVersionHistory && (
              <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <ul className="space-y-2 text-xs">
                  {draft.versions.map((ver) => (
                    <li
                      key={ver.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-400"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          v{ver.version}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Step {ver.currentStep}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ver.changeSummary || 'Autosaved'}</span>
                      </div>
                      <span className="font-mono tabular-nums">
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmitOpen}
        title={isRevision ? "Save revised application?" : "Submit final application?"}
        description={isRevision ? 'Your changes will update the existing submission while keeping its reference number and recording this revision in the history.' : 'Once submitted, this application is locked and routed for administrator review. You will receive a confirmation reference code.'}
        confirmLabel={isRevision ? "Save Revised Application" : "Confirm & Submit"}
        busy={submitting}
        onConfirm={() => void handleConfirmSubmit()}
        onCancel={() => setConfirmSubmitOpen(false)}
      />

      <ConflictModal
        open={conflictModalOpen}
        localVersion={autosaveState.version}
        localStep={currentStep}
        localData={formData}
        steps={formConfig?.steps}
        conflict={autosaveState.conflict}
        busy={resolvingConflict}
        error={conflictError}
        onUseServer={() => void handleResolveConflict('use_server')}
        onKeepLocal={() => void handleResolveConflict('keep_local')}
        onClose={() => {
          setConflictError(null);
          setConflictModalOpen(false);
        }}
      />
    </AppShell>
  );
}
