import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  Replace,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { apiRequest, uploadWithProgress } from '../../lib/api';
import type { UploadedFileRecord } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface UploadQueueItem {
  localId: string;
  file: File;
  progress: number;
  status: 'uploading' | 'failed';
  error?: string;
  replaceFileId?: string;
}

interface FileUploadZoneProps {
  draftId: string;
  files: UploadedFileRecord[];
  disabled?: boolean;
  onFilesUpdated: (files: UploadedFileRecord[]) => void;
}

const ACCEPTED_EXT_STRING = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileUploadZone({
  draftId,
  files,
  disabled = false,
  onFilesUpdated,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadedFileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const runUpload = async (file: File, replaceFileId?: string, existingLocalId?: string) => {
    const localId = existingLocalId || `${file.name}-${Date.now()}-${Math.random()}`;
    setGlobalError(null);

    setQueue((prev) => {
      const filtered = prev.filter((item) => item.localId !== localId);
      return [
        ...filtered,
        { localId, file, progress: 0, status: 'uploading', replaceFileId },
      ];
    });

    const formData = new FormData();
    formData.append('files', file);
    formData.append('stepKey', 'step_4');
    if (replaceFileId) {
      formData.append('replaceFileId', replaceFileId);
    }

    try {
      await uploadWithProgress<{ files: UploadedFileRecord[] }>(
        `/api/uploads/${draftId}`,
        formData,
        (percent) => {
          setQueue((prev) =>
            prev.map((item) => (item.localId === localId ? { ...item, progress: percent } : item))
          );
        }
      );

      setQueue((prev) => prev.filter((item) => item.localId !== localId));

      const refreshed = await apiRequest<{ files: UploadedFileRecord[] }>(`/api/uploads/${draftId}`);
      onFilesUpdated(refreshed.files);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setQueue((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, status: 'failed', error: message } : item
        )
      );
    }
  };

  const handleSelectedFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    Array.from(fileList).forEach((file) => {
      void runUpload(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleSelectedFiles(e.dataTransfer.files);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setGlobalError(null);
    try {
      await apiRequest(`/api/uploads/file/${deleteTarget.id}`, { method: 'DELETE' });
      onFilesUpdated(files.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to remove file.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
          Supporting Documents
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          PDF, JPG, JPEG, PNG, DOC, DOCX · Max 10 MB
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
            : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <UploadCloud className="h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          Drag and drop supporting files here, or{' '}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-sm text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            browse your device
          </button>
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Files are verified by server signature inspection and stored securely outside public directories.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT_STRING}
          className="hidden"
          onChange={(e) => {
            handleSelectedFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept={ACCEPTED_EXT_STRING}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replaceTargetId) {
              void runUpload(file, replaceTargetId);
            }
            setReplaceTargetId(null);
            e.target.value = '';
          }}
        />
      </div>

      {globalError && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {globalError}
        </p>
      )}

      {/* Active & Failed Uploads Queue */}
      {queue.length > 0 && (
        <ul className="space-y-2" aria-label="Upload queue">
          {queue.map((item) => (
            <li
              key={item.localId}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.file.name}
                  </p>
                  <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                {item.status === 'uploading' ? (
                  <span className="font-mono text-xs font-medium text-blue-700 tabular-nums dark:text-blue-400">
                    {item.progress}%
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void runUpload(item.file, item.replaceFileId, item.localId)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setQueue((prev) => prev.filter((q) => q.localId !== item.localId))
                      }
                      aria-label="Dismiss failed upload"
                      className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {item.status === 'uploading' ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-blue-600 transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.error}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {file.originalName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono uppercase">{file.extension.replace('.', '')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatBytes(file.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Uploaded</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/uploads/file/${file.id}/download`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download</span>
                </a>
                {!disabled && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceTargetId(file.id);
                        replaceInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Replace className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(file);
                      }}
                      aria-label={`Remove ${file.originalName}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove uploaded file?"
        description={`This will permanently delete "${deleteTarget?.originalName || ''}" from your draft.`}
        confirmLabel="Remove File"
        variant="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
