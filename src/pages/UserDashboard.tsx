import {
  ArrowRight,
  Copy,
  Edit2,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileModal } from '../components/dashboard/ProfileModal';
import { RenameDraftModal } from '../components/dashboard/RenameDraftModal';
import { AppShell } from '../components/layout/AppShell';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { StatusText } from '../components/ui/StatusText';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { copyTextToClipboard } from '../lib/clipboard';
import type { DraftSummary, SubmissionSummary } from '../types';

export function UserDashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<DraftSummary | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DraftSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftRes, subRes] = await Promise.all([
        apiRequest<{ drafts: DraftSummary[] }>('/api/drafts'),
        apiRequest<{ submissions: SubmissionSummary[] }>('/api/forms/submissions'),
      ]);
      setDrafts(draftRes.drafts);
      setSubmissions(subRes.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStartNew = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiRequest<{ draft: DraftSummary }>('/api/drafts', {
        method: 'POST',
        body: {},
      });
      navigate(`/drafts/${res.draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create new draft.');
      setCreating(false);
    }
  }, [creating, navigate]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setSearchParams({}, { replace: true });
      void handleStartNew();
    }
  }, [searchParams, setSearchParams, handleStartNew]);

  const activeDrafts = drafts.filter((d) => d.status === 'Draft');
  const totalAttachments = drafts.reduce((sum, d) => sum + d.fileCount, 0);
  const totalApplications = activeDrafts.length + submissions.length;
  const mostRecentDraft = activeDrafts[0];

  const handleRename = async (newTitle: string) => {
    if (!renameTarget) return;
    setRenaming(true);
    try {
      await apiRequest(`/api/drafts/${renameTarget.id}/rename`, {
        method: 'PATCH',
        body: { title: newTitle },
      });
      setRenameTarget(null);
      await loadData();
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/drafts/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete draft.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyShareLink = async (draft: DraftSummary) => {
    const url = `${window.location.origin}/recover/${draft.shareToken}`;
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedId(draft.id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setError(`Copy unavailable in this context. Draft recovery link: ${url}`);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Dashboard' }]}
      onOpenProfile={() => setProfileOpen(true)}
      primaryAction={
        <button
          type="button"
          onClick={() => void handleStartNew()}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{creating ? 'Creating...' : 'Start New Application'}</span>
        </button>
      }
    >
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          {/* Welcome & Profile Summary */}
          <section className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Welcome back, {user?.fullName}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Manage your in-progress drafts, recover saved steps, and track submitted
                applications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {mostRecentDraft && (
                <Link
                  to={`/drafts/${mostRecentDraft.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <span>Continue Latest Draft</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Edit Profile</span>
              </button>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {/* 4-Column KPI Strip */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Application overview">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Applications
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                {totalApplications}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Drafts
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-400">
                {activeDrafts.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Submitted Applications
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                {submissions.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Uploaded Documents
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                {totalAttachments}
              </p>
            </div>
          </section>

          {/* Recently Updated Drafts */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                In-Progress Drafts
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {activeDrafts.length} active
              </span>
            </div>

            {activeDrafts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <FolderOpen className="mx-auto h-9 w-9 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No active drafts
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
                  Start a new multi-step application. Your progress will save automatically as you
                  type.
                </p>
                <button
                  type="button"
                  onClick={() => void handleStartNew()}
                  disabled={creating}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Start New Application</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {activeDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/drafts/${draft.id}`}
                          className="truncate text-sm font-semibold text-slate-950 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
                        >
                          {draft.title}
                        </Link>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="tabular-nums">Step {draft.currentStep} of 5</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">v{draft.version}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {draft.fileCount} file{draft.fileCount === 1 ? '' : 's'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Updated {new Date(draft.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Link
                        to={`/drafts/${draft.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleCopyShareLink(draft)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{copiedId === draft.id ? 'Copied' : 'Recovery Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenameTarget(draft)}
                        aria-label={`Rename ${draft.title}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(draft);
                        }}
                        aria-label={`Delete ${draft.title}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Submitted Applications */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                Submitted Applications
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {submissions.length} total
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
                <FileText className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Submitted applications will appear here with reference codes and live status
                  tracking.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Application Title</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100 whitespace-nowrap">
                          {sub.referenceCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {sub.title}
                        </td>
                        <td className="px-4 py-3">
                          <StatusText status={sub.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/submissions/${sub.id}`}
                            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <RenameDraftModal
        open={Boolean(renameTarget)}
        initialTitle={renameTarget?.title || ''}
        busy={renaming}
        onSave={handleRename}
        onClose={() => setRenameTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete application draft?"
        description={`This will permanently delete "${deleteTarget?.title || ''}" and any attached uploaded documents.`}
        confirmLabel="Delete Draft"
        variant="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />

      {user && (
        <ProfileModal
          open={profileOpen}
          user={user}
          onUpdated={() => void refreshUser()}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </AppShell>
  );
}
