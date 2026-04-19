export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../../lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const sql = getDb()
    const rows = await sql`
      UPDATE tb_common_code_dtl SET
        code=${b.CODE}, code_name=${b.CODE_NAME}, ref_value1=${b.REF_VALUE1||null},
        sort_order=${b.SORT_ORDER||null}, use_yn=${b.USE_YN},
        updated_by=${b.UPDATED_BY||'system'}, updated_at=NOW()
      WHERE code_id=${params.id} RETURNING *`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getDb()
    await sql`DELETE FROM tb_common_code_dtl WHERE code_id=${params.id}`
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
