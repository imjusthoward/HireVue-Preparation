type LogLevel = 'info' | 'warn' | 'error'

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'responseText',
  'prompt',
  'content',
])

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (REDACTED_KEYS.has(key.toLowerCase())) {
          return [key, '[REDACTED]']
        }

        return [key, sanitize(entryValue)]
      }),
    )
  }

  return value
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: sanitize(context) } : {}),
  }

  const line = JSON.stringify(payload)

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.info(line)
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  sanitize,
}
