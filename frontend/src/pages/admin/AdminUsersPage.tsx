import { useState } from 'react'
import type { UserRole } from '../../api/types'
import { useAdminUsersQuery, useUpdateUserMutation } from '../../api/users'
import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { SelectField } from '../../components/SelectField'
import { formatDateTime } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { ROLE_LABELS } from '../../lib/navigation'

const PAGE_SIZE = 20
const ROLES: UserRole[] = ['customer', 'provider', 'admin']
const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))

export default function AdminUsersPage() {
  const { user: me } = useAuth()
  const [role, setRole] = useState<UserRole | ''>('')
  const [offset, setOffset] = useState(0)
  const query = useAdminUsersQuery({ role: role || undefined, limit: PAGE_SIZE, offset })
  const update = useUpdateUserMutation()

  return (
    <div>
      <PageHeader title="Usuarios" description="Cambia el rol o desactiva cuentas." />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Filtrar por rol"
          value={role}
          options={[{ value: '', label: 'Todos' }, ...roleOptions]}
          onChange={(event) => {
            setRole(event.target.value as UserRole | '')
            setOffset(0)
          }}
        />
      </div>
      {update.isError && (
        <div className="mb-4">
          <Alert variant="error">{errorMessage(update.error)}</Alert>
        </div>
      )}
      {query.isPending && <LoadingState label="Cargando usuarios…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.items.length === 0 && <EmptyState title="No hay usuarios con ese rol" />}
      {query.isSuccess && query.data.items.length > 0 && (
        <>
          <div className="relative overflow-x-auto rounded-xl bg-surface ring-1 ring-line" aria-busy={query.isFetching}>
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-sunken text-left text-xs font-medium text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
                  <th scope="col" className="px-4 py-3 font-medium">Rol</th>
                  <th scope="col" className="px-4 py-3 font-medium">Activo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.items.map((user) => {
                  const isMe = user.id === me?.id
                  const busy = update.isPending && update.variables?.id === user.id
                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">
                          {user.full_name} {isMe && <span className="text-xs font-normal text-ink-subtle">(tú)</span>}
                        </p>
                        <p className="text-ink-subtle">{user.email}</p>
                        <p className="text-xs text-ink-subtle">{user.email_verified_at ? 'Correo verificado' : 'Correo sin verificar'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <label className="sr-only" htmlFor={`role-${user.id}`}>
                          Rol de {user.full_name}
                        </label>
                        <select
                          id={`role-${user.id}`}
                          value={user.role}
                          disabled={isMe || busy}
                          onChange={(event) => update.mutate({ id: user.id, data: { role: event.target.value as UserRole } })}
                          className="rounded-md border border-line-strong bg-surface px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.is_active}
                            disabled={isMe || busy}
                            onChange={(event) => update.mutate({ id: user.id, data: { is_active: event.target.checked } })}
                            className="h-4 w-4 rounded border-line-strong text-accent-ink focus:ring-2 focus:ring-focus"
                          />
                          <span className="text-ink-muted">{user.is_active ? 'Activo' : 'Inactivo'}</span>
                          <span className="sr-only">: {user.full_name}</span>
                        </label>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-muted">{formatDateTime(user.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={query.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
