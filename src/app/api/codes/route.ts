export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError, toUpperAll } from '../../../lib/api-error'

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`SELECT * FROM tb_common_code ORDER BY code_group_id`
    return NextResponse.json(toUpperAll(rows as any))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.CODE_GROUP || !b.CODE_GROUP_NAME) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }
    const sql = getDb()
    const rows = await sql`
      INSERT INTO tb_common_code (code_group, code_group_name, use_yn, created_by, created_at)
      VALUES (${b.CODE_GROUP}, ${b.CODE_GROUP_NAME}, ${b.USE_YN||'Y'}, ${b.CREATED_BY||'system'}, NOW())
      RETURNING *`
    return NextResponse.json(toUpperAll([rows[0] as any])[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
