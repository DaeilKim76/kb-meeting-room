export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const sql = getDb()
    const rows = await sql`
      UPDATE tb_room_user_auth SET
        room_id=${b.ROOM_ID}, user_id=${b.USER_ID},
        auth_type=${b.AUTH_TYPE}, use_yn=${b.USE_YN},
        updated_by=${b.UPDATED_BY||'system'}, updated_at=NOW()
      WHERE room_auth_id=${params.id} RETURNING *`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    await sql`DELETE FROM tb_room_user_auth WHERE room_auth_id=${params.id}`
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
