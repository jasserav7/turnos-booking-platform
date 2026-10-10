import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, error, id, ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`block min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] duration-150 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
