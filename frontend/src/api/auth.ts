import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, TokenOut, User } from './types'

type DetailOut = Record<string, string>

export function loginRequest(data: LoginIn): Promise<TokenOut> {
  return apiRequest<TokenOut>('/auth/login', {
    method: 'POST',
    body: data,
    retryOnUnauthorized: false,
  })
}

export function registerRequest(data: RegisterIn): Promise<User> {
  return apiRequest<User>('/auth/register', { method: 'POST', body: data })
}

export function logoutRequest(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false })
}

export function useVerifyEmailQuery(token: string | null) {
  return useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => apiRequest<DetailOut>('/auth/verify-email', { query: { token } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (data: ForgotPasswordIn) =>
      apiRequest<DetailOut>('/auth/forgot-password', { method: 'POST', body: data }),
  })
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (data: ResetPasswordIn) =>
      apiRequest<void>('/auth/reset-password', { method: 'POST', body: data }),
  })
}
