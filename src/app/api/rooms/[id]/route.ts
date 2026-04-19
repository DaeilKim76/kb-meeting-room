export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    const rows = await sql`SELECT * FROM tb_meeting_room WHERE room_id=${params.id}`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const sql = getDb()
    const rows = await sql`
      UPDATE tb_meeting_room SET
        building_code=${b.BUILDING_CODE}, floor_code=${b.FLOOR_CODE},
        room_code=${b.ROOM_CODE}, room_name=${b.ROOM_NAME},
        capacity=${b.CAPACITY||null}, approval_required_yn=${b.APPROVAL_REQUIRED_YN},
        use_yn=${b.USE_YN}, remark=${b.REMARK||null},
        updated_by=${b.UPDATED_BY||'system'}, updated_at=NOW()
      WHERE room_id=${params.id} RETURNING *`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    await sql`UPDATE tb_meeting_room SET use_yn='N', updated_at=NOW() WHERE room_id=${params.id}`
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
