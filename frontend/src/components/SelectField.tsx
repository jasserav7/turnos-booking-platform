import { useId, type Ref, type SelectHTMLAttributes } from 'react'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: { value: string; label: string }[]
  ref?: Ref<HTMLSelectElement>
}

export function SelectField({ label, error, options, id, ...props }: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        {...props}
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`block min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] duration-150 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </div>
  )
}
