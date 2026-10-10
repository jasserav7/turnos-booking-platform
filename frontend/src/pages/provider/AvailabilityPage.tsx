import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useAvailabilityQuery,
  useCreateTimeOffMutation,
  useDeleteTimeOffMutation,
  useSaveAvailabilityMutation,
  useTimeOffQuery,
} from '../../api/availability'
import type { AvailabilityRule } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { TextField } from '../../components/TextField'
import { formatDateTime, trimSeconds, WEEKDAYS, zonedToUtcIso } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida.')

const availabilitySchema = z.object({
  rules: z
    .array(
      z
        .object({ weekday: z.number().int().min(0).max(6), start_time: time, end_time: time })
        .refine((r) => r.end_time > r.start_time, { path: ['end_time'], error: 'El fin debe ser posterior al inicio.' }),
    )
    .superRefine((rules, ctx) => {
      rules.forEach((rule, i) => {
        const overlaps = rules.some(
          (other, j) => j !== i && other.weekday === rule.weekday && rule.start_time < other.end_time && other.start_time < rule.end_time,
        )
        if (overlaps) ctx.addIssue({ code: 'custom', path: [i, 'start_time'], message: 'Se solapa con otro rango del mismo día.' })
      })
    }),
})
type AvailabilityForm = z.infer<typeof availabilitySchema>

const toForm = (rules: AvailabilityRule[]): AvailabilityForm => ({
  rules: rules.map((r) => ({ weekday: r.weekday, start_time: trimSeconds(r.start_time), end_time: trimSeconds(r.end_time) })),
})

function WeeklyEditor({ initial }: { initial: AvailabilityRule[] }) {
  const save = useSaveAvailabilityMutation()
  const form = useForm<AvailabilityForm>({ resolver: zodResolver(availabilitySchema), defaultValues: toForm(initial) })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rules' })
  const { errors, isDirty } = form.formState

  useEffect(() => {
    form.reset(toForm(initial))
  }, [initial, form])

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((data) => save.mutate(data.rules, { onSuccess: (rules) => form.reset(toForm(rules)) }))}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {WEEKDAYS.map((dayName, weekday) => {
          const dayFields = fields.map((field, index) => ({ field, index })).filter(({ field }) => field.weekday === weekday)
          return (
            <fieldset key={dayName} className="rounded-xl bg-surface p-4 ring-1 ring-line">
              <legend className="sr-only">{dayName}</legend>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-ink" aria-hidden="true">
                  {dayName}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  block={false}
                  onClick={() => append({ weekday, start_time: '09:00', end_time: '17:00' }, { shouldFocus: true })}
                  aria-label={`Agregar rango el ${dayName.toLowerCase()}`}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
              {dayFields.length === 0 && <p className="text-sm text-ink-subtle">Sin atención este día.</p>}
              <ul className="space-y-3">
                {dayFields.map(({ field, index }, position) => (
                  <li key={field.id} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <TextField
                        type="time"
                        label={`Inicio ${position + 1}`}
                        error={errors.rules?.[index]?.start_time?.message}
                        {...form.register(`rules.${index}.start_time`)}
                      />
                      <TextField
                        type="time"
                        label={`Fin ${position + 1}`}
                        error={errors.rules?.[index]?.end_time?.message}
                        {...form.register(`rules.${index}.end_time`)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Quitar rango ${position + 1} del ${dayName.toLowerCase()}`}
                      className="mt-7 rounded-md p-2 text-ink-subtle hover:bg-danger-soft hover:text-danger-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <Icon name="x" />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )
        })}
      </div>
      {save.isError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
      {save.isSuccess && !isDirty && <Alert variant="success">Disponibilidad guardada.</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" block={false} loading={save.isPending} disabled={!isDirty}>
          Guardar disponibilidad
        </Button>
        {isDirty && (
          <Button variant="secondary" block={false} onClick={() => form.reset(toForm(initial))}>
            Descartar cambios
          </Button>
        )}
      </div>
    </form>
  )
}

const timeOffSchema = z
  .object({
    starts_at: z.string().min(1, 'Indica el inicio.'),
    ends_at: z.string().min(1, 'Indica el fin.'),
    reason: z.string().max(255, 'Máximo 255 caracteres.'),
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at, { path: ['ends_at'], error: 'El fin debe ser posterior al inicio.' })
type TimeOffForm = z.infer<typeof timeOffSchema>

function TimeOffSection() {
  const query = useTimeOffQuery()
  const create = useCreateTimeOffMutation()
  const remove = useDeleteTimeOffMutation()
  const form = useForm<TimeOffForm>({ resolver: zodResolver(timeOffSchema), defaultValues: { starts_at: '', ends_at: '', reason: '' } })
  const { errors } = form.formState

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form
        noValidate
        className="space-y-4 rounded-xl bg-surface p-4 ring-1 ring-line"
        onSubmit={form.handleSubmit((data) =>
          create.mutate(
            { starts_at: zonedToUtcIso(data.starts_at), ends_at: zonedToUtcIso(data.ends_at), reason: data.reason.trim() || null },
            { onSuccess: () => form.reset() },
          ),
        )}
      >
        <h3 className="font-semibold text-ink">Nuevo bloqueo</h3>
        <TextField type="datetime-local" label="Desde" error={errors.starts_at?.message} {...form.register('starts_at')} />
        <TextField type="datetime-local" label="Hasta" error={errors.ends_at?.message} {...form.register('ends_at')} />
        <TextField label="Motivo (opcional)" maxLength={255} error={errors.reason?.message} {...form.register('reason')} />
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
        <Button type="submit" loading={create.isPending}>
          Agregar bloqueo
        </Button>
      </form>

      <div>
        {remove.isError && (
          <div className="mb-3">
            <Alert variant="error">{errorMessage(remove.error)}</Alert>
          </div>
        )}
        {query.isPending && <LoadingState label="Cargando bloqueos…" />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {query.isSuccess && query.data.length === 0 && (
          <EmptyState title="No tienes bloqueos">Agrega uno para vacaciones, citas médicas u otras ausencias.</EmptyState>
        )}
        {query.isSuccess && query.data.length > 0 && (
          <ul className="space-y-3">
            {query.data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}
                  </p>
                  {item.reason && <p className="text-sm text-ink-muted">{item.reason}</p>}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  block={false}
                  loading={remove.isPending && remove.variables === item.id}
                  onClick={() => remove.mutate(item.id)}
                  aria-label={`Eliminar bloqueo del ${formatDateTime(item.starts_at)}`}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function AvailabilityPage() {
  const query = useAvailabilityQuery()
  return (
    <div className="space-y-10">
      <section>
        <PageHeader title="Disponibilidad" description="Define tus horarios de atención para cada día de la semana." />
        {query.isPending && <LoadingState label="Cargando disponibilidad…" />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {query.isSuccess && <WeeklyEditor initial={query.data} />}
      </section>
      <section>
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-ink">Bloqueos de tiempo</h2>
        <p className="mb-4 text-ink-muted">Durante un bloqueo no se ofrecen horarios a los clientes.</p>
        <TimeOffSection />
      </section>
    </div>
  )
}
