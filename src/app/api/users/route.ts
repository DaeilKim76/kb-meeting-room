export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../lib/api-error'

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`SELECT * FROM tb_user ORDER BY created_at DESC`
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
      INSERT INTO tb_user (user_id, user_name, email, dept_name, use_yn, is_sys_admin, created_at)
      VALUES (${b.USER_ID}, ${b.USER_NAME}, ${b.EMAIL||null}, ${b.DEPT_NAME||null},
              ${b.USE_YN||'Y'}, ${b.IS_SYS_ADMIN||'N'}, NOW())
      RETURNING *`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
