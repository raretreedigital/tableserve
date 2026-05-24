/** UAE timezone – all display dates use this */
export const TZ = 'Asia/Dubai'

const LOCALE = 'en-AE'

/** "12:34 PM" */
export function fmtTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

/** "14 May 2026" */
export function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

/** "14 May 2026, 12:34 PM" */
export function fmtDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}
