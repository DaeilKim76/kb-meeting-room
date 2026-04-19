export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const sql = getDb()
    const rows = await sql`
      UPDATE tb_user SET
        user_name=${b.USER_NAME}, email=${b.EMAIL||null}, dept_name=${b.DEPT_NAME||null},
        use_yn=${b.USE_YN}, is_sys_admin=${b.IS_SYS_ADMIN}, updated_at=NOW()
      WHERE user_id=${params.id} RETURNING *`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    await sql`UPDATE tb_user SET use_yn='N', updated_at=NOW() WHERE user_id=${params.id}`
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
