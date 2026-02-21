// ---------------------------------------------------------------------------
// Structured JSON logger for observability
// Outputs one JSON line per event to stdout — compatible with Vercel, Railway,
// Datadog, Sentry, and any log aggregator that parses structured JSON.
// ---------------------------------------------------------------------------

interface LogEvent {
  event: string
  level: 'info' | 'warn' | 'error'
  timestamp: string
  restaurant_id?: string
  user_id?: string
  customer_id?: string
  card_number?: string
  duration_ms?: number
  error?: string
  [key: string]: unknown
}

function emit(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const entry: LogEvent = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...data,
  }

  const line = JSON.stringify(entry)

  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
}
