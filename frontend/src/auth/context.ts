import { createContext } from 'react'
import type { LoginIn, RegisterIn, User } from '../api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  accessToken: string | null
  login: (data: LoginIn) => Promise<User>
  register: (data: RegisterIn) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
