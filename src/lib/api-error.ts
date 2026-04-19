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

// DB 응답 row를 대문자 키로 변환
export function toUpper(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toUpperCase(), v])
  )
}

export function toUpperAll(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(toUpper)
}
