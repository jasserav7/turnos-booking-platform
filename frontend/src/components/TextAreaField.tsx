import { useId, type Ref, type TextareaHTMLAttributes } from 'react'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function TextAreaField({ label, error, id, rows = 3, ...props }: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        {...props}
        id={fieldId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`block min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] duration-150 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      />
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </div>
  )
}
