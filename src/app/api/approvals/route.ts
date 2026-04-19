export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../lib/api-error'

// POST /api/approvals — 승인 또는 거절
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const { RESERVATION_ID, APPROVER_USER_ID, ACTION, ACTION_COMMENT, REJECT_REASON } = b
    const sql = getDb()

    if (!RESERVATION_ID || !APPROVER_USER_ID || !ACTION) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }
    if (ACTION === 'REJECTED' && !REJECT_REASON) {
      return NextResponse.json({ error: 'REJECT_REASON_REQUIRED' }, { status: 400 })
    }

    // 승인자 권한 확인 — 해당 미팅룸의 APPROVER 이어야 함
    const res = await sql`SELECT room_id FROM tb_meeting_reservation WHERE reservation_id=${RESERVATION_ID}`
    if (!res.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const auth = await sql`
      SELECT 1 FROM tb_room_user_auth
      WHERE room_id=${res[0].room_id} AND user_id=${APPROVER_USER_ID}
        AND auth_type='APPROVER' AND use_yn='Y'`
    if (!auth.length) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: 403 })

    const newStatus = ACTION === 'APPROVED' ? 'RESERVED' : 'REJECTED'

    await sql`
      UPDATE tb_meeting_reservation SET
        status_code=${newStatus},
        approved_datetime=${ACTION === 'APPROVED' ? sql`NOW()` : sql`NULL`},
        reject_reason=${REJECT_REASON||null},
        updated_by=${APPROVER_USER_ID}, updated_at=NOW()
      WHERE reservation_id=${RESERVATION_ID}`

    await sql`
      INSERT INTO tb_meeting_approval
        (reservation_id, approver_user_id, action, action_datetime, action_comment)
      VALUES (${RESERVATION_ID}, ${APPROVER_USER_ID}, ${ACTION}, NOW(), ${ACTION_COMMENT||null})`

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    return apiError(e)
  }
}
