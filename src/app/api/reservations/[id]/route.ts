export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../lib/api-error'

async function saveHistory(sql: any, reservationId: string|number, actionType: string, userId: string, before: any, after: any, remark?: string) {
  try {
    await sql`
      INSERT INTO tb_meeting_reservation_his
        (reservation_id, action_type, action_user_id, action_datetime, before_value, after_value, remark)
      VALUES (
        ${reservationId}, ${actionType}, ${userId||'system'}, NOW(),
        ${before ? JSON.stringify(before) : null},
        ${after  ? JSON.stringify(after)  : null},
        ${remark||null}
      )`
  } catch (e) {
    // 이력 저장 실패는 무시 (메인 트랜잭션에 영향 없게)
    console.error('History save failed:', e)
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT r.*, rm.room_name, rm.building_code, rm.floor_code, rm.approval_required_yn,
             u.user_name AS request_user_name
      FROM tb_meeting_reservation r
      JOIN tb_meeting_room rm ON r.room_id = rm.room_id
      JOIN tb_user u ON r.request_user_id = u.user_id
      WHERE r.reservation_id = ${params.id}`
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

    const before = await sql`SELECT * FROM tb_meeting_reservation WHERE reservation_id=${params.id}`
    if (!before.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (b.START_TIME && b.END_TIME) {
      const conflicts = await sql`
        SELECT reservation_id FROM tb_meeting_reservation
        WHERE room_id = ${b.ROOM_ID||before[0].room_id}
          AND reservation_date = ${b.RESERVATION_DATE||before[0].reservation_date}
          AND reservation_id != ${params.id}
          AND cancel_yn = 'N'
          AND status_code NOT IN ('REJECTED','CANCELED')
          AND start_time < ${b.END_TIME}
          AND end_time > ${b.START_TIME}`
      if (conflicts.length) return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
    }

    const rows = await sql`
      UPDATE tb_meeting_reservation SET
        room_id=${b.ROOM_ID||before[0].room_id},
        reservation_date=${b.RESERVATION_DATE||before[0].reservation_date},
        start_time=${b.START_TIME||before[0].start_time},
        end_time=${b.END_TIME||before[0].end_time},
        all_day_yn=${b.ALL_DAY_YN||before[0].all_day_yn},
        title=${b.TITLE||before[0].title},
        participant_count=${b.PARTICIPANT_COUNT??before[0].participant_count},
        updated_by=${b.UPDATED_BY||'system'}, updated_at=NOW()
      WHERE reservation_id=${params.id} RETURNING *`

    await saveHistory(sql, params.id, 'UPDATE', b.UPDATED_BY||'system', before[0], rows[0])
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId = body.userId || 'system'
    const sql = getDb()

    const before = await sql`SELECT * FROM tb_meeting_reservation WHERE reservation_id=${params.id}`
    if (!before.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rows = await sql`
      UPDATE tb_meeting_reservation SET
        cancel_yn='Y', status_code='CANCELED',
        updated_by=${userId}, updated_at=NOW()
      WHERE reservation_id=${params.id} RETURNING *`

    await saveHistory(sql, params.id, 'DELETE', userId, before[0], rows[0], 'Canceled by user')
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
