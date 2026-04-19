import { NextResponse } from 'next/server'

export function apiError(e: unknown, status = 500) {
  const err = e instanceof Error ? e : new Error(String(e))
  console.error('[API Error]', err)
  return NextResponse.json({
    error:   err.message,
    name:    err.name,
    stack:   err.stack,
    cause:   err.cause ? String(err.cause) : undefined,
  }, { status })
}
