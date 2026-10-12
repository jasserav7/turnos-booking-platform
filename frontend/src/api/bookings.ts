import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiDownload, apiRequest } from './client'
import type { Booking, BookingIn, BookingList, BookingStatus } from './types'

export interface BookingFilters {
  status?: BookingStatus
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export function useBookingsQuery(filters: BookingFilters) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () =>
      apiRequest<BookingList>('/bookings', {
        query: {
          status: filters.status,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          limit: filters.limit,
          offset: filters.offset,
        },
      }),
    placeholderData: keepPreviousData,
  })
}

function invalidateBookings(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['bookings'] }),
    client.invalidateQueries({ queryKey: ['slots'] }),
    client.invalidateQueries({ queryKey: ['stats'] }),
  ]).then(() => undefined)
}

export function useCreateBookingMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: BookingIn) => apiRequest<Booking>('/bookings', { method: 'POST', body: data }),
    // Also on error: a slot_unavailable conflict means the slots must be reloaded.
    onSettled: () => invalidateBookings(client),
  })
}

export type BookingAction = 'confirm' | 'cancel' | 'complete'

export function useBookingActionMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: BookingAction; reason?: string }) =>
      apiRequest<Booking>(`/bookings/${id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? { reason: reason || null } : undefined,
      }),
    onSettled: () => invalidateBookings(client),
  })
}

export function useRescheduleBookingMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, startsAt }: { id: string; startsAt: string }) =>
      apiRequest<Booking>(`/bookings/${id}/reschedule`, { method: 'POST', body: { starts_at: startsAt } }),
    // Also on error: a slot_unavailable conflict means the slots must be reloaded.
    onSettled: () => invalidateBookings(client),
  })
}

/** Downloads the booking as an .ics file to add it to a calendar app. */
export function useDownloadCalendarMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { blob, filename } = await apiDownload(`/bookings/${id}/calendar.ics`, {}, 'reserva.ics')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
  })
}
