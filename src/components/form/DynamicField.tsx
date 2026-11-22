import type { FormFieldConfig } from '../../types';

interface DynamicFieldProps {
  field: FormFieldConfig;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (name: string, value: unknown) => void;
  onBlur: () => void;
}

export function DynamicField({
  field,
  value,
  error,
  disabled = false,
  onChange,
  onBlur,
}: DynamicFieldProps) {
  const fieldId = `field-${field.name}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  const inputBaseClass = `mt-1.5 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800 ${
    error
      ? 'border-red-500 focus:border-red-600 dark:border-red-500'
      : 'border-slate-300 focus:border-blue-600 dark:border-slate-700 dark:focus:border-blue-500'
  }`;

  if (field.type === 'checkbox') {
    const checked = Boolean(value);
    return (
      <div className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
        <label
          htmlFor={fieldId}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            error
              ? 'border-red-400 bg-red-50/40 dark:border-red-700 dark:bg-red-950/20'
              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
          }`}
        >
          <input
            id={fieldId}
            name={field.name}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(field.name, e.target.checked)}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 dark:border-slate-600 dark:bg-slate-900"
          />
          <span className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {field.label}
            {field.required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
          </span>
        </label>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  const strValue = typeof value === 'string' ? value : '';

  return (
    <div className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-slate-800 dark:text-slate-200"
      >
        {field.label}
        {field.required && (
          <span className="ml-1 text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          name={field.name}
          rows={4}
          value={strValue}
          disabled={disabled}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : field.helperText ? helperId : undefined}
          className={inputBaseClass}
        />
      ) : field.type === 'select' ? (
        <select
          id={fieldId}
          name={field.name}
          value={strValue}
          disabled={disabled}
          onChange={(e) => onChange(field.name, e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : field.helperText ? helperId : undefined}
          className={inputBaseClass}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          name={field.name}
          type={field.type}
          value={strValue}
          disabled={disabled}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : field.helperText ? helperId : undefined}
          className={inputBaseClass}
        />
      )}

      {field.helperText && !error && (
        <p id={helperId} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {field.helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
