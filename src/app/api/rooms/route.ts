export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const building = searchParams.get('building')
    const floor    = searchParams.get('floor')
    const useYn    = searchParams.get('use_yn')

    // Neon 서버리스: 조건부 쿼리는 동적 문자열로 처리
    let query = 'SELECT * FROM tb_meeting_room WHERE 1=1'
    const params: (string | null)[] = []
    if (building) { params.push(building); query += ` AND building_code=$${params.length}` }
    if (floor)    { params.push(floor);    query += ` AND floor_code=$${params.length}` }
    if (useYn)    { params.push(useYn);    query += ` AND use_yn=$${params.length}` }
    query += ' ORDER BY building_code, floor_code, room_code'

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
    const rows = await sql`
      INSERT INTO tb_meeting_room
        (building_code, floor_code, room_code, room_name, capacity,
         approval_required_yn, use_yn, remark, created_by, created_at)
      VALUES (${b.BUILDING_CODE}, ${b.FLOOR_CODE}, ${b.ROOM_CODE}, ${b.ROOM_NAME},
              ${b.CAPACITY||null}, ${b.APPROVAL_REQUIRED_YN||'N'}, ${b.USE_YN||'Y'},
              ${b.REMARK||null}, ${b.CREATED_BY||'system'}, NOW())
      RETURNING *`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
