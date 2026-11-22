import { Download, Edit3, FileText } from 'lucide-react';
import type { FormStepConfig, UploadedFileRecord } from '../../types';
import { DynamicField } from './DynamicField';
import { formatBytes } from './FileUploadZone';

interface ReviewStepProps {
  steps: FormStepConfig[];
  formData: Record<string, unknown>;
  files: UploadedFileRecord[];
  fieldErrors: Record<string, string>;
  onJumpToStep: (stepNumber: number) => void;
  onChange: (name: string, value: unknown) => void;
  onBlur: () => void;
}

export function ReviewStep({
  steps,
  formData,
  files,
  fieldErrors,
  onJumpToStep,
  onChange,
  onBlur,
}: ReviewStepProps) {
  const dataSteps = steps.filter((s) => !s.isReviewStep);
  const reviewStep = steps.find((s) => s.isReviewStep);

  return (
    <div className="space-y-8">
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/40 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
        {dataSteps.map((step) => (
          <div key={step.key} className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {step.stepNumber}. {step.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{step.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep(step.stepNumber)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Edit Section</span>
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {step.fields
                .filter((f) => f.type !== 'file')
                .map((field) => {
                  const raw = formData[field.name];
                  const display =
                    typeof raw === 'string' && raw.trim().length > 0 ? raw : 'Not provided';
                  const hasError = Boolean(fieldErrors[field.name]);
                  return (
                    <div
                      key={field.name}
                      className={field.colSpan === 2 ? 'sm:col-span-2' : ''}
                    >
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {field.label}
                      </dt>
                      <dd
                        className={`mt-1 whitespace-pre-wrap text-sm ${
                          hasError
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : display === 'Not provided'
                              ? 'italic text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {display}
                      </dd>
                      {hasError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {fieldErrors[field.name]}
                        </p>
                      )}
                    </div>
                  );
                })}
            </dl>
          </div>
        ))}

        {/* Supporting Documents Summary */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Supporting Documents
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">{files.length}</span> attached file
                {files.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(4)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Manage Files</span>
            </button>
          </div>

          {files.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No supporting documents attached.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {file.originalName}
                    </span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      ({formatBytes(file.sizeBytes)})
                    </span>
                  </div>
                  <a
                    href={`/api/uploads/file/${file.id}/download`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Confirmation Checkbox */}
      {reviewStep && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reviewStep.fields.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={formData[field.name]}
              error={fieldErrors[field.name]}
              onChange={onChange}
              onBlur={onBlur}
            />
          ))}
        </div>
      )}
    </div>
  );
}
