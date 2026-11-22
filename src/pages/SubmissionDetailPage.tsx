import { ArrowLeft, Download, Edit3, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatBytes } from '../components/form/FileUploadZone';
import { AppShell } from '../components/layout/AppShell';
import { SkeletonBlock } from '../components/ui/Skeleton';
import { StatusText } from '../components/ui/StatusText';
import { apiRequest } from '../lib/api';
import {
  buildFieldLabelMap,
  formatFieldValue,
  getFieldLabel,
  isWideFieldKey,
} from '../lib/formLabels';
import type { FormConfigResponse, FormStepConfig, SubmissionDetail } from '../types';

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [startingEdit, setStartingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [steps, setSteps] = useState<FormStepConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [subRes, configRes] = await Promise.all([
          apiRequest<{ submission: SubmissionDetail }>(`/api/forms/submissions/${id}`),
          apiRequest<FormConfigResponse>('/api/forms/config').catch(() => null),
        ]);
        if (active) {
          setSubmission(subRes.submission);
          if (configRes?.steps) {
            setSteps(configRes.steps);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load submission.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const labelMap = buildFieldLabelMap(steps);

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: submission?.referenceCode || 'Application Details' },
      ]}
      primaryAction={
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-72" />
        </div>
      ) : error || !submission ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error || 'Submission not found.'}
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                  {submission.referenceCode}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">
                  {submission.title}
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Submitted on{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(submission.submittedAt).toLocaleString()}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusText status={submission.status} />
                <button
                  type="button"
                  disabled={startingEdit}
                  onClick={async () => {
                    if (!submission) return;
                    setStartingEdit(true);
                    setEditError(null);
                    try {
                      const result = await apiRequest<{ draftId: string }>(`/api/forms/submissions/${submission.id}/revise`, { method: 'POST' });
                      navigate(`/drafts/${result.draftId}?revision=1`);
                    } catch (err) {
                      setEditError(err instanceof Error ? err.message : 'Unable to open this application for editing.');
                    } finally {
                      setStartingEdit(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {startingEdit ? 'Opening editor...' : 'Edit Application'}
                </button>
              </div>
            </div>
            {editError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{editError}</p>}

            {submission.adminNotes && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Reviewer Note
                </p>
                <p className="mt-1">{submission.adminNotes}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Submitted Responses
            </h2>
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {Object.entries(submission.formData)
                .filter(([key]) => key !== 'confirmAccuracy')
                .map(([key, val]) => (
                  <div key={key} className={isWideFieldKey(key) ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {getFieldLabel(key, labelMap)}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">
                      {formatFieldValue(val)}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Supporting Documents
            </h2>
            {submission.files.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No documents attached.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {submission.files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {file.originalName}
                        </p>
                        <p className="font-mono text-xs text-slate-500 tabular-nums">
                          {formatBytes(file.sizeBytes)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/uploads/file/${file.id}/download`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Status History
            </h2>
            <ul className="mt-4 space-y-3">
              {submission.statusHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusText status={entry.newStatus} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        by {entry.changedByName}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{entry.note}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
