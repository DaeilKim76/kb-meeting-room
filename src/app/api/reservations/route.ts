export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError, toUpperAll } from '../../../lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const roomId   = searchParams.get('room_id')
    const date     = searchParams.get('date')
    const fromDate = searchParams.get('from_date')
    const toDate   = searchParams.get('to_date')
    const status   = searchParams.get('status')
    const userId   = searchParams.get('user_id')
    const title    = searchParams.get('title')

    let query = `
      SELECT r.*, rm.room_name, rm.building_code, rm.floor_code, rm.approval_required_yn,
             u.user_name AS request_user_name
      FROM tb_meeting_reservation r
      JOIN tb_meeting_room rm ON r.room_id = rm.room_id
      JOIN tb_user u ON r.request_user_id = u.user_id
      WHERE 1=1`
    const params: (string | null)[] = []
    if (roomId)   { params.push(roomId);          query += ` AND r.room_id=$${params.length}` }
    if (date)     { params.push(date);             query += ` AND r.reservation_date=$${params.length}` }
    if (fromDate) { params.push(fromDate);         query += ` AND r.reservation_date>=$${params.length}` }
    if (toDate)   { params.push(toDate);           query += ` AND r.reservation_date<=$${params.length}` }
    if (status)   { params.push(status);           query += ` AND r.status_code=$${params.length}` }
    if (userId)   { params.push(userId);           query += ` AND r.request_user_id=$${params.length}` }
    if (title)    { params.push(`%${title}%`);     query += ` AND r.title ILIKE $${params.length}` }
    query += ' ORDER BY r.reservation_date DESC, r.start_time ASC'

    const rows = await sql(query, params)
    return NextResponse.json(toUpperAll(rows as any))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const sql = getDb()

    if (!b.ROOM_ID || !b.RESERVATION_DATE || !b.START_TIME || !b.END_TIME || !b.TITLE || !b.REQUEST_USER_ID) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }
    if (b.START_TIME >= b.END_TIME && b.ALL_DAY_YN !== 'Y') {
      return NextResponse.json({ error: 'TIME_ORDER' }, { status: 400 })
    }

    // 시간 충돌 체크
    const conflicts = await sql`
      SELECT reservation_id FROM tb_meeting_reservation
      WHERE room_id = ${b.ROOM_ID}
        AND reservation_date = ${b.RESERVATION_DATE}
        AND cancel_yn = 'N'
        AND status_code NOT IN ('REJECTED','CANCELED')
        AND start_time < ${b.END_TIME}
        AND end_time > ${b.START_TIME}`
    if (conflicts.length) return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })

    // 승인 필요 여부 확인
    const room = await sql`SELECT approval_required_yn FROM tb_meeting_room WHERE room_id=${b.ROOM_ID}`
    const statusCode = room[0]?.approval_required_yn === 'Y' ? 'REQUESTED' : 'RESERVED'

    const rows = await sql`
      INSERT INTO tb_meeting_reservation
        (room_id, reservation_date, start_time, end_time, all_day_yn, title,
         participant_count, status_code, request_user_id, request_datetime,
         period_reservation_yn, period_group_id, cancel_yn, created_by, created_at)
      VALUES
        (${b.ROOM_ID}, ${b.RESERVATION_DATE}, ${b.START_TIME}, ${b.END_TIME},
         ${b.ALL_DAY_YN||'N'}, ${b.TITLE}, ${b.PARTICIPANT_COUNT||null}, ${statusCode},
         ${b.REQUEST_USER_ID}, NOW(),
         ${b.PERIOD_RESERVATION_YN||'N'}, ${b.PERIOD_GROUP_ID||null}, 'N',
         ${b.REQUEST_USER_ID}, NOW())
      RETURNING *`

    // 이력 저장
    await sql`
      INSERT INTO tb_meeting_reservation_his
        (reservation_id, action_type, action_user_id, action_datetime, after_value)
      VALUES (${rows[0].reservation_id}, 'CREATE', ${b.REQUEST_USER_ID}, NOW(), ${JSON.stringify(rows[0])})`

    return NextResponse.json(rows[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
