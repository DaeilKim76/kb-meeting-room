export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { apiError } from '../../../../lib/api-error'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const sql = getDb()
    const rows = await sql`
      UPDATE tb_common_code SET
        code_group=${b.CODE_GROUP}, code_group_name=${b.CODE_GROUP_NAME},
        use_yn=${b.USE_YN}, updated_by=${b.UPDATED_BY||'system'}, updated_at=NOW()
      WHERE code_group_id=${params.id} RETURNING *`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (e) {
    return apiError(e)
  }
}
