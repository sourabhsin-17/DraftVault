import { Download, FileText, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { formatBytes } from '../components/form/FileUploadZone';
import { AppShell } from '../components/layout/AppShell';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { StatusText } from '../components/ui/StatusText';
import { apiRequest } from '../lib/api';
import {
  buildFieldLabelMap,
  formatFieldValue,
  getFieldLabel,
  isWideFieldKey,
} from '../lib/formLabels';
import type {
  AdminStats,
  AdminUserRecord,
  FormConfigResponse,
  FormStepConfig,
  SubmissionDetail,
  SubmissionStatus,
  SubmissionSummary,
} from '../types';

const STATUS_FILTERS: ('All' | SubmissionStatus)[] = [
  'All',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'submissions' | 'users'>('submissions');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState<'All' | SubmissionStatus>('All');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null);
  const [steps, setSteps] = useState<FormStepConfig[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [nextStatus, setNextStatus] = useState<SubmissionStatus>('Under Review');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<FormConfigResponse>('/api/forms/config')
      .then((res) => setSteps(res.steps))
      .catch(() => {
        // Fallback labels remain available
      });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, subsRes, usersRes] = await Promise.all([
        apiRequest<{ stats: AdminStats }>('/api/admin/stats'),
        apiRequest<{ submissions: SubmissionSummary[] }>(
          `/api/admin/submissions?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(submissionSearch)}`
        ),
        apiRequest<{ users: AdminUserRecord[] }>(
          `/api/admin/users?search=${encodeURIComponent(userSearch)}`
        ),
      ]);
      setStats(statsRes.stats);
      setSubmissions(subsRes.submissions);
      setUsers(usersRes.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load administrator console.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, submissionSearch, userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    if (!selectedSubmission) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updatingStatus) {
        setSelectedSubmission(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedSubmission, updatingStatus]);

  const openSubmissionDetail = async (submissionId: string) => {
    setLoadingDetail(true);
    setModalError(null);
    try {
      const res = await apiRequest<{ submission: SubmissionDetail }>(
        `/api/admin/submissions/${submissionId}`
      );
      setSelectedSubmission(res.submission);
      setNextStatus(res.submission.status);
      setStatusNote(res.submission.adminNotes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission detail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    setUpdatingStatus(true);
    setModalError(null);
    try {
      const res = await apiRequest<{ submission: SubmissionDetail }>(
        `/api/admin/submissions/${selectedSubmission.id}/status`,
        {
          method: 'PATCH',
          body: { status: nextStatus, note: statusNote },
        }
      );
      setSelectedSubmission(res.submission);
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const labelMap = buildFieldLabelMap(steps);

  return (
    <AppShell breadcrumbs={[{ label: 'Admin Console' }]}>
      {loading && !stats ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Administrator Operations Console
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Review submitted applications, verify uploaded files, manage workflow statuses, and
                inspect registered accounts.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'submissions'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Submitted Applications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'users'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Registered Users
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {/* Analytics Summary */}
          {stats && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Registered Applicants
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    In-Progress Drafts
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                    {stats.activeDrafts}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Submissions
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
                    {stats.totalSubmissions}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Stored Documents
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums dark:text-white">
                    {stats.totalFiles}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatBytes(stats.totalStorageBytes)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Submitted</span>
                  <p className="mt-1 font-mono text-lg font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                    {stats.statusBreakdown.Submitted ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Under Review</span>
                  <p className="mt-1 font-mono text-lg font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                    {stats.statusBreakdown['Under Review'] ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Approved</span>
                  <p className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                    {stats.statusBreakdown.Approved ?? 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Rejected</span>
                  <p className="mt-1 font-mono text-lg font-semibold text-red-700 tabular-nums dark:text-red-400">
                    {stats.statusBreakdown.Rejected ?? 0}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Submissions View */}
          {activeTab === 'submissions' ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
                  {STATUS_FILTERS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        statusFilter === status
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {loading && stats && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Refreshing...
                    </span>
                  )}
                  <div className="relative w-full sm:w-72">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={submissionSearch}
                      onChange={(e) => setSubmissionSearch(e.target.value)}
                      placeholder="Search name, email, or ref..."
                      aria-label="Search applications"
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <p>No submitted applications match the current filter.</p>
                  {(statusFilter !== 'All' || submissionSearch.trim().length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('All');
                        setSubmissionSearch('');
                      }}
                      className="mt-3 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Applicant</th>
                        <th className="px-4 py-3">Application Title</th>
                        <th className="px-4 py-3">Files</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3 text-right">Review</th>
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
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {sub.applicantName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {sub.applicantEmail}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {sub.title}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            {sub.fileCount ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <StatusText status={sub.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void openSubmissionDetail(sub.id)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            /* Users Directory */
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-mono font-semibold tabular-nums">{users.length}</span>{' '}
                  accounts found
                </p>
                <div className="relative w-full sm:w-72">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    aria-label="Search registered users"
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Drafts</th>
                      <th className="px-4 py-3 text-right">Submissions</th>
                      <th className="px-4 py-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {u.fullName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                        <td className="px-4 py-3 font-mono text-xs uppercase text-slate-600 dark:text-slate-300">
                          {u.role}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                          {u.draftCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                          {u.submissionCount}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Submission Review Modal / Drawer */}
      {(selectedSubmission || loadingDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-review-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updatingStatus) {
              setSelectedSubmission(null);
              setModalError(null);
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <p className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {selectedSubmission?.referenceCode || 'Loading...'}
                </p>
                <h2
                  id="admin-review-title"
                  className="text-base font-semibold text-slate-950 dark:text-white"
                >
                  {selectedSubmission?.title || 'Application Review'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubmission(null);
                  setModalError(null);
                }}
                disabled={updatingStatus}
                aria-label="Close review modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {loadingDetail || !selectedSubmission ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading application details...
              </div>
            ) : (
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {/* Status Update Bar */}
                <form
                  onSubmit={(e) => void handleStatusUpdate(e)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Update Review Status
                    </span>
                    <StatusText status={selectedSubmission.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="admin-status-select" className="sr-only">
                        New Status
                      </label>
                      <select
                        id="admin-status-select"
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value as SubmissionStatus)}
                        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2 sm:flex-nowrap">
                      <input
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="Add review note (visible to applicant)..."
                        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={updatingStatus}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-blue-600 whitespace-nowrap shrink-0"
                      >
                        {updatingStatus ? 'Saving...' : 'Save Status'}
                      </button>
                    </div>
                  </div>
                  {modalError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                    >
                      {modalError}
                    </p>
                  )}
                </form>

                {/* Form Responses */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Applicant Responses
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800">
                    {Object.entries(selectedSubmission.formData)
                      .filter(([k]) => k !== 'confirmAccuracy')
                      .map(([k, v]) => (
                        <div key={k} className={isWideFieldKey(k) ? 'sm:col-span-2' : ''}>
                          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {getFieldLabel(k, labelMap)}
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">
                            {formatFieldValue(v)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>

                {/* Documents */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Uploaded Documents ({selectedSubmission.files.length})
                  </h3>
                  {selectedSubmission.files.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No files attached.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                      {selectedSubmission.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                              {file.originalName}
                            </span>
                            <span className="font-mono text-xs text-slate-500 tabular-nums">
                              {formatBytes(file.sizeBytes)}
                            </span>
                          </div>
                          <a
                            href={`/api/uploads/file/${file.id}/download`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Download</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* History */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Audit Timeline
                  </h3>
                  <ul className="mt-2 space-y-2 text-xs">
                    {selectedSubmission.statusHistory.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <StatusText status={h.newStatus} />
                          <span className="text-slate-500 dark:text-slate-400">
                            · {h.changedByName} · {h.note}
                          </span>
                        </div>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
