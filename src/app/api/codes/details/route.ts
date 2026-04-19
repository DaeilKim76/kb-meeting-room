export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError, toUpperAll } from '../../../../lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('group_id')

    let query = 'SELECT * FROM tb_common_code_dtl WHERE 1=1'
    const params: (string | null)[] = []
    if (groupId) { params.push(groupId); query += ` AND code_group_id=$${params.length}` }
    query += ' ORDER BY code_group_id, sort_order, code_id'

    const rows = await sql(query, params)
    return NextResponse.json(toUpperAll(rows as any))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.CODE_GROUP_ID || !b.CODE || !b.CODE_NAME) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }
    const sql = getDb()
    const rows = await sql`
      INSERT INTO tb_common_code_dtl
        (code_group_id, code, code_name, ref_value1, sort_order, use_yn, created_by, created_at)
      VALUES (${b.CODE_GROUP_ID}, ${b.CODE}, ${b.CODE_NAME}, ${b.REF_VALUE1||null},
              ${b.SORT_ORDER||null}, ${b.USE_YN||'Y'}, ${b.CREATED_BY||'system'}, NOW())
      RETURNING *`
    return NextResponse.json(toUpperAll([rows[0] as any])[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
