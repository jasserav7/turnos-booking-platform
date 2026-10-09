import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useAdminServicesQuery,
  useCreateServiceMutation,
  useDeactivateServiceMutation,
  useUpdateServiceMutation,
} from '../../api/services'
import type { Service } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { TextAreaField } from '../../components/TextAreaField'
import { TextField } from '../../components/TextField'
import { errorMessage } from '../../lib/errors'
import { formatPrice } from '../../lib/format'

const PAGE_SIZE = 20

const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa un nombre.').max(255, 'Máximo 255 caracteres.'),
  description: z.string().max(5000, 'Máximo 5000 caracteres.'),
  duration_minutes: z
    .number({ error: 'Ingresa la duración en minutos.' })
    .int('Usa minutos enteros.')
    .min(1, 'Debe durar al menos 1 minuto.')
    .max(1440, 'Máximo 1440 minutos.'),
  price: z.number({ error: 'Ingresa un precio.' }).min(0, 'El precio no puede ser negativo.'),
})
type ServiceForm = z.infer<typeof serviceSchema>

function ServiceFormModal({ service, open, onClose }: { service: Service | null; open: boolean; onClose: () => void }) {
  const create = useCreateServiceMutation()
  const update = useUpdateServiceMutation()
  const mutation = service ? update : create
  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    values: service
      ? { name: service.name, description: service.description, duration_minutes: service.duration_minutes, price: service.price_cents / 100 }
      : { name: '', description: '', duration_minutes: 30, price: 0 },
  })
  const { errors } = form.formState

  function close() {
    create.reset()
    update.reset()
    onClose()
  }

  function onSubmit({ price, ...data }: ServiceForm) {
    const payload = { ...data, name: data.name.trim(), price_cents: Math.round(price * 100) }
    if (service) update.mutate({ id: service.id, data: payload }, { onSuccess: close })
    else create.mutate(payload, { onSuccess: close })
  }

  return (
    <Modal open={open} title={service ? 'Editar servicio' : 'Nuevo servicio'} onClose={close}>
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <TextField label="Nombre" error={errors.name?.message} {...form.register('name')} />
        <TextAreaField label="Descripción" error={errors.description?.message} {...form.register('description')} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="number"
            min={1}
            label="Duración (min)"
            error={errors.duration_minutes?.message}
            {...form.register('duration_minutes', { valueAsNumber: true })}
          />
          <TextField
            type="number"
            min={0}
            step="0.01"
            label="Precio (COP)"
            error={errors.price?.message}
            {...form.register('price', { valueAsNumber: true })}
          />
        </div>
        {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" block={false} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" block={false} loading={mutation.isPending}>
            {service ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminServicesPage() {
  const [offset, setOffset] = useState(0)
  const query = useAdminServicesQuery({ limit: PAGE_SIZE, offset })
  const deactivate = useDeactivateServiceMutation()
  const update = useUpdateServiceMutation()
  const [editing, setEditing] = useState<Service | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const rows = query.data?.items ?? []
  const toggleError = deactivate.error ?? update.error

  function openForm(service: Service | null) {
    setEditing(service)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Servicios"
        description="Crea, edita y activa o desactiva los servicios del catálogo."
        actions={
          <Button block={false} onClick={() => openForm(null)}>
            Nuevo servicio
          </Button>
        }
      />
      {toggleError && (
        <div className="mb-4">
          <Alert variant="error">{errorMessage(toggleError)}</Alert>
        </div>
      )}
      {query.isPending && <LoadingState label="Cargando servicios…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && rows.length === 0 && <EmptyState title="Todavía no hay servicios">Crea el primero con “Nuevo servicio”.</EmptyState>}
      {query.isSuccess && rows.length > 0 && (
        <>
          <div aria-busy={query.isFetching} className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Nombre</th>
                  <th scope="col" className="px-4 py-3 font-medium">Duración</th>
                  <th scope="col" className="px-4 py-3 font-medium">Precio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((service) => (
                  <tr key={service.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{service.name}</p>
                      {service.description && <p className="max-w-xs truncate text-gray-500">{service.description}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{service.duration_minutes} min</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatPrice(service.price_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${service.is_active ? 'bg-green-50 text-green-800 ring-green-600/30' : 'bg-gray-100 text-gray-700 ring-gray-500/30'}`}>
                        {service.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" block={false} onClick={() => openForm(service)} aria-label={`Editar ${service.name}`}>
                          Editar
                        </Button>
                        {service.is_active ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            block={false}
                            loading={deactivate.isPending && deactivate.variables?.id === service.id}
                            onClick={() => deactivate.mutate(service)}
                            aria-label={`Desactivar ${service.name}`}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            block={false}
                            loading={update.isPending && update.variables?.id === service.id}
                            onClick={() => update.mutate({ id: service.id, data: { is_active: true } })}
                            aria-label={`Activar ${service.name}`}
                          >
                            Activar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={query.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
      <ServiceFormModal service={editing} open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
