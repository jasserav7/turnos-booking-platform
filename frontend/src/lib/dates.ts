import { addDays as addDaysFns, format, parseISO, startOfWeek } from 'date-fns'
import { APP_TIMEZONE } from './env'

/*
 * Instants (ISO strings from the API) are always shown in APP_TIMEZONE with Intl.
 * Calendar days are plain 'yyyy-MM-dd' strings handled with date-fns.
 */

const LOCALE = 'es-CO'

const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const longDayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const shortDayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short' })
const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

/** Calendar day of an instant in APP_TIMEZONE, as 'yyyy-MM-dd'. */
export function dayOf(iso: string | Date): string {
  return ymdFmt.format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function today(): string {
  return dayOf(new Date())
}

export function addDays(day: string, amount: number): string {
  return format(addDaysFns(parseISO(day), amount), 'yyyy-MM-dd')
}

export function weekStart(day: string): string {
  return format(startOfWeek(parseISO(day), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function dayAsUtcDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function formatDayLong(day: string): string {
  const text = longDayFmt.format(dayAsUtcDate(day))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatDayShort(day: string): string {
  return shortDayFmt.format(dayAsUtcDate(day))
}

function zoneOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

/** Convert a wall-clock 'yyyy-MM-ddTHH:mm' in APP_TIMEZONE to a UTC ISO string. */
export function zonedToUtcIso(local: string): string {
  const [day, time = '00:00'] = local.split('T')
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  let utc = wall - zoneOffsetMs(wall)
  utc = wall - zoneOffsetMs(utc)
  return new Date(utc).toISOString()
}

/** 'HH:mm:ss' from the API → 'HH:mm' for <input type="time">. */
export function trimSeconds(time: string): string {
  return time.slice(0, 5)
}
