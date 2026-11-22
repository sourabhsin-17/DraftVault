import { Check } from 'lucide-react';
import type { FormStepConfig } from '../../types';

interface StepProgressProps {
  steps: FormStepConfig[];
  currentStep: number;
  completedSteps: number[];
  onSelectStep: (stepNumber: number) => void;
}

export function StepProgress({
  steps,
  currentStep,
  completedSteps,
  onSelectStep,
}: StepProgressProps) {
  const completedSet = new Set(completedSteps);
  const progressPercent = Math.round(((currentStep - 1) / Math.max(1, steps.length - 1)) * 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Step <span className="tabular-nums">{currentStep}</span> of{' '}
            <span className="tabular-nums">{steps.length}</span>
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {steps.find((s) => s.stepNumber === currentStep)?.title}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-blue-700 tabular-nums dark:text-blue-400">
            {progressPercent}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Progress</p>
        </div>
      </div>

      {/* Progress Track */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-700 transition-all duration-200 dark:bg-blue-500"
          style={{ width: `${Math.max(8, progressPercent)}%` }}
        />
      </div>

      {/* Step Navigation Buttons */}
      <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Application steps">
        {steps.map((step) => {
          const isCurrent = step.stepNumber === currentStep;
          const isCompleted = completedSet.has(step.stepNumber);
          const canJump = isCompleted || step.stepNumber <= currentStep;

          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => canJump && onSelectStep(step.stepNumber)}
                disabled={!canJump}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100'
                    : isCompleted
                      ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      : 'cursor-not-allowed border-slate-200/70 bg-slate-50/60 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-600'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                    isCurrent
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    step.stepNumber
                  )}
                </span>
                <span className="truncate text-xs font-medium">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
