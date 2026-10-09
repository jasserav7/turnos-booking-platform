import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { AdminUserUpdateIn, User, UserList, UserRole } from './types'

export interface UserFilters {
  role?: UserRole
  limit?: number
  offset?: number
}

export function useAdminUsersQuery(filters: UserFilters, enabled = true) {
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () =>
      apiRequest<UserList>('/admin/users', {
        query: { role: filters.role, limit: filters.limit, offset: filters.offset },
      }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useUpdateUserMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserUpdateIn }) =>
      apiRequest<User>(`/admin/users/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['admin-users'] }),
        client.invalidateQueries({ queryKey: ['providers'] }),
      ]),
  })
}
