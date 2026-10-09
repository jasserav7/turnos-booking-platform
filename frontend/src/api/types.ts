import type { components } from './schema'

type Schemas = components['schemas']

export type User = Schemas['UserOut']
export type UserRole = Schemas['UserRole']
export type TokenOut = Schemas['TokenOut']
export type LoginIn = Schemas['LoginIn']
export type RegisterIn = Schemas['RegisterIn']
export type ForgotPasswordIn = Schemas['ForgotPasswordIn']
export type ResetPasswordIn = Schemas['ResetPasswordIn']
export type Service = Schemas['ServiceOut']
