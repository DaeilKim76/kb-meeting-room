export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const roomId   = searchParams.get('room_id')
    const authType = searchParams.get('auth_type')

    let query = `
      SELECT a.*, u.user_name, u.dept_name, u.email, r.room_name
      FROM tb_room_user_auth a
      JOIN tb_user u ON a.user_id = u.user_id
      JOIN tb_meeting_room r ON a.room_id = r.room_id
      WHERE 1=1`
    const params: (string | null)[] = []
    if (roomId)   { params.push(roomId);   query += ` AND a.room_id=$${params.length}` }
    if (authType) { params.push(authType); query += ` AND a.auth_type=$${params.length}` }
    query += ' ORDER BY r.room_name, a.auth_type, u.user_name'

    const rows = await sql(query, params)
    return NextResponse.json(rows)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const sql = getDb()

    const dup = await sql`
      SELECT 1 FROM tb_room_user_auth
      WHERE room_id=${b.ROOM_ID} AND user_id=${b.USER_ID} AND auth_type=${b.AUTH_TYPE}`
    if (dup.length) return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })

    const rows = await sql`
      INSERT INTO tb_room_user_auth (room_id, user_id, auth_type, use_yn, created_by, created_at)
      VALUES (${b.ROOM_ID}, ${b.USER_ID}, ${b.AUTH_TYPE}, ${b.USE_YN||'Y'},
              ${b.CREATED_BY||'system'}, NOW())
      RETURNING *`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
