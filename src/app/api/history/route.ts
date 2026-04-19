export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError, toUpperAll } from '../../../lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const fromDate   = searchParams.get('from_date')
    const toDate     = searchParams.get('to_date')
    const actionType = searchParams.get('action_type')
    const userId     = searchParams.get('user_id')

    let query = `
      SELECT h.*, u.user_name AS action_user_name
      FROM tb_meeting_reservation_his h
      LEFT JOIN tb_user u ON h.action_user_id = u.user_id
      WHERE 1=1`
    const params: (string | null)[] = []
    if (fromDate)   { params.push(fromDate);   query += ` AND h.action_datetime::date >= $${params.length}` }
    if (toDate)     { params.push(toDate);     query += ` AND h.action_datetime::date <= $${params.length}` }
    if (actionType) { params.push(actionType); query += ` AND h.action_type = $${params.length}` }
    if (userId)     { params.push(`%${userId}%`); query += ` AND (h.action_user_id ILIKE $${params.length} OR u.user_name ILIKE $${params.length})` }
    query += ' ORDER BY h.action_datetime DESC LIMIT 500'

    const rows = await sql(query, params)
    return NextResponse.json(toUpperAll(rows as any))
  } catch (e) {
    return apiError(e)
  }
}
