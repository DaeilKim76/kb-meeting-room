/**
 * KB Prasac Meeting Room Reservation System
 * Main Application Page (Single Page App)
 *
 * ── 수정 이력 ──────────────────────────────────────────────────
 * v1.0  2025-04-19  최초 생성
 *                   - 캘린더 예약 뷰
 *                   - 내 예약 조회
 *                   - 승인 대상 예약 (승인/반려)
 *                   - 미팅룸 관리
 *                   - 권한 관리 (승인자 멀티 지정)
 *                   - 사용자 관리 (신규)
 *                   - 공통코드 관리
 *                   - 예약 이력
 *                   - 다국어 지원 (한국어/English/ខ្មែរ)
 *
 * v1.1  2025-04-19  Bug Fix
 *                   - line 530: onClick에서 setModal() || setModalData() 패턴
 *                     void 타입 truthiness 체크 오류 수정
 *                     변경 전: onClick={() => setModal('room') || setModalData({...r})}
 *                     변경 후: onClick={() => { setModalData({...r}); setModal('room') }}
 * ───────────────────────────────────────────────────────────────
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { t } from '@/lib/i18n'
import type { Lang, User, MeetingRoom, Reservation, RoomUserAuth, ReservationHistory, CommonCode, CommonCodeDtl } from '@/lib/types'
import { STATUS_BADGE } from '@/lib/types'

// ── 시간 슬롯 ──────────────────────────────────────────────────
const TIME_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']

// ── 유틸 ──────────────────────────────────────────────────────
function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function today() { return fmtDate(new Date()) }
function badge(status: string) {
  const s = STATUS_BADGE[status as keyof typeof STATUS_BADGE]
  return s ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.en}</span> : <span>{status}</span>
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState<Lang>('ko')
  const [page, setPage] = useState('calendar')
  const [users, setUsers]   = useState<User[]>([])
  const [rooms, setRooms]   = useState<MeetingRoom[]>([])
  const [codes, setCodes]   = useState<CommonCode[]>([])
  const [codeDtls, setCodeDtls] = useState<CommonCodeDtl[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  // Calendar state
  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calRoomId, setCalRoomId]   = useState('')
  const [calBuilding, setCalBuilding] = useState('')
  const [calFloor, setCalFloor]     = useState('')
  const [calReservations, setCalReservations] = useState<Reservation[]>([])

  // My reservations
  const [myResFrom, setMyResFrom] = useState(() => { const d = new Date(); d.setDate(1); return fmtDate(d) })
  const [myResToDate, setMyResToDate]   = useState(() => { const d = new Date(); d.setMonth(d.getMonth()+1,0); return fmtDate(d) })
  const [myResStatus, setMyResStatus]   = useState('')
  const [myResTitle, setMyResTitle]     = useState('')
  const [myResList, setMyResList]       = useState<Reservation[]>([])

  // Approvals
  const [appFrom, setAppFrom]   = useState(today())
  const [appTo, setAppTo]       = useState(() => { const d = new Date(); d.setMonth(d.getMonth()+1); return fmtDate(d) })
  const [appList, setAppList]   = useState<Reservation[]>([])

  // Auth manage
  const [authList, setAuthList]         = useState<RoomUserAuth[]>([])
  const [authFilterRoom, setAuthFilterRoom] = useState('')
  const [authFilterType, setAuthFilterType] = useState('')

  // History
  const [hisList, setHisList]       = useState<ReservationHistory[]>([])
  const [hisFrom, setHisFrom]       = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return fmtDate(d) })
  const [hisTo, setHisTo]           = useState(today())
  const [hisActType, setHisActType] = useState('')
  const [hisUser, setHisUser]       = useState('')

  // Modal state
  const [modal, setModal]         = useState<string|null>(null)
  const [modalData, setModalData] = useState<any>({})

  const T = t(lang)

  // ── 초기 로딩 ──
  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r=>r.json()),
      fetch('/api/rooms').then(r=>r.json()),
      fetch('/api/codes').then(r=>r.json()),
      fetch('/api/codes/details').then(r=>r.json()),
    ]).then(([u, r, c, cd]) => {
      setUsers(u); setRooms(r); setCodes(c); setCodeDtls(cd)
      if (u.length) setCurrentUser(u.find((x:User)=>x.USE_YN==='Y') || u[0])
    })
  }, [])

  useEffect(() => { if (currentUser) loadCalendar() }, [calYear, calMonth, calRoomId])

  // ── 권한 헬퍼 ──
  const isSysAdmin  = currentUser?.IS_SYS_ADMIN === 'Y'
  const isApprover  = useCallback((roomId?: number) => {
    // 실제 환경에서는 DB auth 체크 — 여기선 IS_SYS_ADMIN 또는 별도 authList 기반
    return isSysAdmin
  }, [isSysAdmin])

  // ── Building / Floor 코드 헬퍼 ──
  function getBuildingCodes() {
    const grp = codes.find(c=>c.CODE_GROUP==='BUILDING')
    if (!grp) return []
    return codeDtls.filter(d=>d.CODE_GROUP_ID===grp.CODE_GROUP_ID && d.USE_YN==='Y')
  }
  function getFloorCodes(building: string) {
    const grpCode = `FLOOR_${building}`
    const grp = codes.find(c=>c.CODE_GROUP===grpCode)
    if (!grp) return []
    return codeDtls.filter(d=>d.CODE_GROUP_ID===grp.CODE_GROUP_ID && d.USE_YN==='Y')
  }
  function filteredRooms(building='', floor='') {
    return rooms.filter(r=>
      r.USE_YN==='Y' &&
      (!building || r.BUILDING_CODE===building) &&
      (!floor    || r.FLOOR_CODE===floor)
    )
  }

  // ── Calendar ──
  async function loadCalendar() {
    const from = fmtDate(new Date(calYear, calMonth, 1))
    const to   = fmtDate(new Date(calYear, calMonth+1, 0))
    const params = new URLSearchParams({ from_date: from, to_date: to })
    if (calRoomId) params.set('room_id', calRoomId)
    const data = await fetch(`/api/reservations?${params}`).then(r=>r.json())
    setCalReservations(Array.isArray(data) ? data : [])
  }

  function calendarDays() {
    const first = new Date(calYear, calMonth, 1)
    const last  = new Date(calYear, calMonth+1, 0)
    const days: { date: Date; current: boolean }[] = []
    for (let i = first.getDay()-1; i >= 0; i--) {
      const d = new Date(calYear, calMonth, -i); days.push({ date: d, current: false })
    }
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ date: new Date(calYear, calMonth, i), current: true })
    }
    while (days.length % 7 !== 0) {
      const d = new Date(calYear, calMonth+1, days.length - last.getDate() - first.getDay() + 2)
      days.push({ date: d, current: false })
    }
    return days
  }

  function resForDate(dateStr: string) {
    return calReservations.filter(r => r.RESERVATION_DATE === dateStr && r.CANCEL_YN !== 'Y')
  }

  // ── My Reservations ──
  async function loadMyRes() {
    if (!currentUser) return
    const params = new URLSearchParams({ user_id: currentUser.USER_ID, from_date: myResFrom, to_date: myResToDate })
    if (myResStatus) params.set('status', myResStatus)
    if (myResTitle)  params.set('title', myResTitle)
    const data = await fetch(`/api/reservations?${params}`).then(r=>r.json())
    setMyResList(Array.isArray(data) ? data : [])
  }

  // ── Approvals ──
  async function loadApprovals() {
    const params = new URLSearchParams({ from_date: appFrom, to_date: appTo, status: 'REQUESTED' })
    const data = await fetch(`/api/reservations?${params}`).then(r=>r.json())
    setAppList(Array.isArray(data) ? data : [])
  }

  // ── Auth Manage ──
  async function loadAuthList() {
    const params = new URLSearchParams()
    if (authFilterRoom) params.set('room_id', authFilterRoom)
    if (authFilterType) params.set('auth_type', authFilterType)
    const data = await fetch(`/api/auth-manage?${params}`).then(r=>r.json())
    setAuthList(Array.isArray(data) ? data : [])
  }

  // ── History ──
  async function loadHistory() {
    const params = new URLSearchParams({ from_date: hisFrom, to_date: hisTo })
    if (hisActType) params.set('action_type', hisActType)
    if (hisUser)    params.set('user_id', hisUser)
    const data = await fetch(`/api/history?${params}`).then(r=>r.json())
    setHisList(Array.isArray(data) ? data : [])
  }

  // ── 예약 저장 ──
  async function saveReservation() {
    const d = modalData
    if (!d.ROOM_ID || !d.RESERVATION_DATE || !d.START_TIME || !d.END_TIME || !d.TITLE) {
      alert(T.alertRequired); return
    }
    if (!d.ALL_DAY_YN && d.START_TIME >= d.END_TIME) { alert(T.alertTimeOrder); return }
    setLoading(true)
    try {
      const payload = { ...d, REQUEST_USER_ID: currentUser?.USER_ID }
      const method  = d.RESERVATION_ID ? 'PUT' : 'POST'
      const url     = d.RESERVATION_ID ? `/api/reservations/${d.RESERVATION_ID}` : '/api/reservations'
      const res     = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json    = await res.json()
      if (json.error === 'DUPLICATE') { alert(T.alertDuplicate); return }
      if (!res.ok) { alert(json.error || T.alertRequired); return }
      alert(T.alertSaved); setModal(null); loadCalendar()
    } finally { setLoading(false) }
  }

  // ── 예약 취소 ──
  async function cancelReservation(id: number) {
    if (!confirm(T.alertDeleted)) return
    await fetch(`/api/reservations/${id}`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUser?.USER_ID }) })
    loadMyRes(); loadCalendar()
  }

  // ── 승인/반려 ──
  async function processApproval(reservationId: number, action: 'APPROVED'|'REJECTED') {
    const comment = modalData.ACTION_COMMENT || ''
    const reason  = modalData.REJECT_REASON  || ''
    if (action === 'REJECTED' && !reason) { alert(T.alertRejectReasonRequired); return }
    setLoading(true)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ RESERVATION_ID: reservationId, APPROVER_USER_ID: currentUser?.USER_ID, ACTION: action, ACTION_COMMENT: comment, REJECT_REASON: reason })
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error); return }
      alert(action === 'APPROVED' ? T.btnApprove + ' ' + T.alertSaved : T.btnReject + ' ' + T.alertSaved)
      setModal(null); loadApprovals()
    } finally { setLoading(false) }
  }

  // ── 미팅룸 저장 ──
  async function saveRoom() {
    const d = modalData
    if (!d.BUILDING_CODE || !d.FLOOR_CODE || !d.ROOM_CODE || !d.ROOM_NAME) { alert(T.alertRequired); return }
    setLoading(true)
    try {
      const method = d.ROOM_ID ? 'PUT' : 'POST'
      const url    = d.ROOM_ID ? `/api/rooms/${d.ROOM_ID}` : '/api/rooms'
      const payload = { ...d, CREATED_BY: currentUser?.USER_ID, UPDATED_BY: currentUser?.USER_ID }
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      if (!res.ok) { alert((await res.json()).error); return }
      alert(T.alertSaved); setModal(null)
      const updated = await fetch('/api/rooms').then(r=>r.json())
      setRooms(updated)
    } finally { setLoading(false) }
  }

  // ── 사용자 저장 ──
  async function saveUser() {
    const d = modalData
    if (!d.USER_ID || !d.USER_NAME) { alert(T.alertRequired); return }
    setLoading(true)
    try {
      const method = d._isEdit ? 'PUT' : 'POST'
      const url    = d._isEdit ? `/api/users/${d.USER_ID}` : '/api/users'
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(d) })
      if (!res.ok) { alert((await res.json()).error); return }
      alert(T.alertSaved); setModal(null)
      const updated = await fetch('/api/users').then(r=>r.json())
      setUsers(updated)
    } finally { setLoading(false) }
  }

  // ── 권한 저장 ──
  async function saveAuth() {
    const d = modalData
    if (!d.ROOM_ID || !d.USER_ID || !d.AUTH_TYPE) { alert(T.alertRequired); return }
    setLoading(true)
    try {
      const method = d.ROOM_AUTH_ID ? 'PUT' : 'POST'
      const url    = d.ROOM_AUTH_ID ? `/api/auth-manage/${d.ROOM_AUTH_ID}` : '/api/auth-manage'
      const payload = { ...d, CREATED_BY: currentUser?.USER_ID, UPDATED_BY: currentUser?.USER_ID }
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error === 'DUPLICATE') { alert(T.alertDuplicateAuth); return }
      if (!res.ok) { alert(json.error); return }
      alert(T.alertSaved); setModal(null); loadAuthList()
    } finally { setLoading(false) }
  }

  // ── navigate ──
  function navigate(p: string) {
    setPage(p)
    if (p === 'myreservations') loadMyRes()
    if (p === 'approvals')      loadApprovals()
    if (p === 'authmanage')     loadAuthList()
    if (p === 'history')        loadHistory()
  }

  // ── pending approval count ──
  const pendingCount = appList.length

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 z-[9999] flex items-center justify-center">
          <div className="w-9 h-9 border-4 border-gray-200 border-t-[#F5A623] rounded-full animate-spin" />
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-[#1A1A2E] h-14 flex items-center justify-between px-6 sticky top-0 z-50 shadow-md gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F5A623] text-[#1A1A2E] font-bold text-sm px-2.5 py-1 rounded">KB Prasac</div>
          <span className="text-white text-sm font-medium hidden sm:block">{T.appTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Lang switcher */}
          <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded p-1">
            {(['ko','en','kh'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${lang===l ? 'bg-[#F5A623] text-[#1A1A2E] font-bold' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                {l === 'ko' ? '한국어' : l === 'en' ? 'English' : 'ខ្មែរ'}
              </button>
            ))}
          </div>
          {/* User */}
          <div className="text-right hidden sm:block">
            <div className="text-white text-xs font-medium">{currentUser?.USER_NAME}</div>
            <div className="text-[#F5A623] text-[10px] font-mono">
              {currentUser?.IS_SYS_ADMIN==='Y' ? T.roleAdmin : T.roleUser}
            </div>
          </div>
          <button onClick={() => setModal('userSwitch')}
            className="bg-white/10 border border-white/20 text-white text-xs px-3 py-1.5 rounded hover:bg-white/20 transition">
            {T.userChange}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── Sidebar ── */}
        <aside className="w-52 bg-[#16213E] shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto hidden md:block">
          <div className="py-5">
            <NavSection title={T.sideCommon}>
              <NavItem icon="📅" label={T.navCalendar}   active={page==='calendar'}       onClick={() => navigate('calendar')} />
              <NavItem icon="📋" label={T.navMyRes}       active={page==='myreservations'} onClick={() => navigate('myreservations')} />
            </NavSection>
            {(isSysAdmin || true) && (
              <NavSection title={T.sideApprover}>
                <NavItem icon="✅" label={T.navApprovals} active={page==='approvals'} onClick={() => navigate('approvals')}
                  badge={pendingCount > 0 ? pendingCount : undefined} />
              </NavSection>
            )}
            {isSysAdmin && (
              <NavSection title={T.sideAdmin}>
                <NavItem icon="🏢" label={T.navRoomManage}  active={page==='roommanage'}  onClick={() => navigate('roommanage')} />
                <NavItem icon="👥" label={T.navAuthManage}  active={page==='authmanage'}  onClick={() => navigate('authmanage')} />
                <NavItem icon="👤" label={T.navUserManage}  active={page==='usermanage'}  onClick={() => navigate('usermanage')} />
                <NavItem icon="⚙️" label={T.navCodeManage} active={page==='codemanage'}  onClick={() => navigate('codemanage')} />
                <NavItem icon="📜" label={T.navHistory}     active={page==='history'}     onClick={() => navigate('history')} />
              </NavSection>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* ── Calendar Page ── */}
          {page === 'calendar' && (
            <div>
              <PageHeader title={T.calPageTitle} sub={T.calPageSub}>
                <Btn onClick={() => setModal('reservation')} primary>{T.btnNewRes}</Btn>
              </PageHeader>
              {/* Filter */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">
                <FormGroup label={T.lblBuilding}>
                  <select className={inputCls} value={calBuilding} onChange={e => { setCalBuilding(e.target.value); setCalFloor(''); setCalRoomId('') }}>
                    <option value="">{T.statusAll}</option>
                    {getBuildingCodes().map(b => <option key={b.CODE} value={b.CODE}>{b.CODE_NAME}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblFloor}>
                  <select className={inputCls} value={calFloor} onChange={e => { setCalFloor(e.target.value); setCalRoomId('') }}>
                    <option value="">{T.statusAll}</option>
                    {getFloorCodes(calBuilding).map(f => <option key={f.CODE} value={f.CODE}>{f.CODE_NAME}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblRoom}>
                  <select className={inputCls} style={{width:180}} value={calRoomId} onChange={e => setCalRoomId(e.target.value)}>
                    <option value="">{T.statusAll}</option>
                    {filteredRooms(calBuilding, calFloor).map(r => <option key={r.ROOM_ID} value={r.ROOM_ID}>{r.ROOM_NAME}{r.APPROVAL_REQUIRED_YN==='Y'?' ⚠️':''}</option>)}
                  </select>
                </FormGroup>
                <Btn onClick={loadCalendar} primary>{T.btnSearch}</Btn>
              </div>
              {/* Calendar */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex items-center justify-center gap-4">
                  <button onClick={() => { const d = new Date(calYear, calMonth-1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-[#F5A623] hover:border-[#F5A623] hover:text-[#1A1A2E] text-lg transition">‹</button>
                  <span className="text-lg font-bold min-w-40 text-center">{T.monthLabel(calYear, calMonth)}</span>
                  <button onClick={() => { const d = new Date(calYear, calMonth+1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-[#F5A623] hover:border-[#F5A623] hover:text-[#1A1A2E] text-lg transition">›</button>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {T.dayHeaders.map((h,i) => (
                      <div key={i} className={`text-center text-[11px] font-semibold py-1.5 ${i===0?'text-red-500':i===6?'text-blue-500':'text-gray-400'}`}>{h}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays().map(({ date, current }, idx) => {
                      const ds = fmtDate(date)
                      const todayStr = today()
                      const res = resForDate(ds)
                      const dow = date.getDay()
                      return (
                        <div key={idx}
                          onClick={() => { setModalData({ date: ds, reservations: res }); setModal('dayDetail') }}
                          className={`border rounded p-1.5 min-h-[88px] cursor-pointer transition-all hover:border-[#F5A623] hover:shadow-sm
                            ${!current ? 'bg-gray-50 opacity-40' : 'bg-white'}
                            ${ds === todayStr ? 'border-[#F5A623]' : 'border-gray-200'}`}>
                          <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center mb-1
                            ${ds===todayStr ? 'bg-[#F5A623] text-[#1A1A2E] rounded-full' : dow===0?'text-red-500':dow===6?'text-blue-500':''}`}>
                            {date.getDate()}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {res.slice(0,2).map(r => (
                              <div key={r.RESERVATION_ID}
                                className={`text-[10px] px-1 py-0.5 rounded truncate
                                  ${r.STATUS_CODE==='RESERVED'?'bg-green-100 text-green-800':r.STATUS_CODE==='REQUESTED'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800'}`}>
                                {r.START_TIME} {r.TITLE}
                              </div>
                            ))}
                            {res.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{res.length-2}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── My Reservations ── */}
          {page === 'myreservations' && (
            <div>
              <PageHeader title={T.myResPageTitle} sub={T.myResPageSub} />
              <FilterBar>
                <FormGroup label={T.lblDateFrom}><input type="date" className={inputCls} value={myResFrom} onChange={e=>setMyResFrom(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label={T.lblDateTo}><input type="date" className={inputCls} value={myResToDate} onChange={e=>setMyResToDate(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label={T.lblStatus}>
                  <select className={inputCls} style={{width:130}} value={myResStatus} onChange={e=>setMyResStatus(e.target.value)}>
                    <option value="">{T.statusAll}</option>
                    <option value="REQUESTED">{T.statusRequested}</option>
                    <option value="RESERVED">{T.statusReserved}</option>
                    <option value="REJECTED">{T.statusRejected}</option>
                    <option value="CANCELED">{T.statusCanceled}</option>
                  </select>
                </FormGroup>
                <FormGroup label={T.lblTitleSearch}><input type="text" className={inputCls} value={myResTitle} onChange={e=>setMyResTitle(e.target.value)} style={{width:160}} /></FormGroup>
                <Btn onClick={loadMyRes} primary>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.myResThead} />
                <tbody>{myResList.length===0
                  ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : myResList.map(r => (
                    <tr key={r.RESERVATION_ID} className="hover:bg-gray-50">
                      <td>{r.RESERVATION_DATE}</td>
                      <td className="whitespace-nowrap">{r.ALL_DAY_YN==='Y'?T.allDayLabel:`${r.START_TIME}~${r.END_TIME}`}</td>
                      <td>{r.BUILDING_CODE} / {r.FLOOR_CODE}F</td>
                      <td>{r.ROOM_NAME}</td>
                      <td className="font-medium">{r.TITLE}</td>
                      <td>{r.PARTICIPANT_COUNT}</td>
                      <td>{badge(r.STATUS_CODE)}</td>
                      <td className="text-xs text-gray-400">{r.CREATED_AT?.slice(0,16)}</td>
                      <td>
                        {r.STATUS_CODE !== 'CANCELED' && r.STATUS_CODE !== 'REJECTED' && (
                          <Btn small onClick={() => cancelReservation(r.RESERVATION_ID)} danger>취소</Btn>
                        )}
                      </td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* ── Approvals ── */}
          {page === 'approvals' && (
            <div>
              <PageHeader title={T.appPageTitle} sub={T.appPageSub} />
              <FilterBar>
                <FormGroup label={T.lblDateFrom}><input type="date" className={inputCls} value={appFrom} onChange={e=>setAppFrom(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label={T.lblDateTo}><input type="date" className={inputCls} value={appTo} onChange={e=>setAppTo(e.target.value)} style={{width:140}} /></FormGroup>
                <Btn onClick={loadApprovals} primary>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.appThead} />
                <tbody>{appList.length===0
                  ? <tr><td colSpan={10} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : appList.map(r => (
                    <tr key={r.RESERVATION_ID} className="hover:bg-gray-50">
                      <td>{r.RESERVATION_DATE}</td>
                      <td className="whitespace-nowrap">{r.ALL_DAY_YN==='Y'?T.allDayLabel:`${r.START_TIME}~${r.END_TIME}`}</td>
                      <td>{r.BUILDING_CODE}/{r.FLOOR_CODE}F</td>
                      <td>{r.ROOM_NAME}</td>
                      <td className="font-medium">{r.TITLE}</td>
                      <td>{r.PARTICIPANT_COUNT}</td>
                      <td>{r.REQUEST_USER_NAME}</td>
                      <td className="text-xs text-gray-400">{r.REQUEST_DATETIME?.slice(0,16)}</td>
                      <td>{badge(r.STATUS_CODE)}</td>
                      <td>
                        <Btn small primary onClick={() => { setModalData({ res: r, ACTION_COMMENT:'', REJECT_REASON:'' }); setModal('approval') }}>처리</Btn>
                      </td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* ── Room Manage ── */}
          {page === 'roommanage' && (
            <div>
              <PageHeader title={T.rmPageTitle} sub={T.rmPageSub}>
                <Btn primary onClick={() => setModal('room')}>{T.newLabel}</Btn>
              </PageHeader>
              <TableCard>
                <TableHead cols={T.rmThead} />
                <tbody>{rooms.length===0
                  ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : rooms.map(r => (
                    <tr key={r.ROOM_ID} className="hover:bg-gray-50">
                      <td>{r.BUILDING_CODE}</td>
                      <td>{r.FLOOR_CODE}F</td>
                      <td><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{r.ROOM_CODE}</code></td>
                      <td className="font-medium">{r.ROOM_NAME}</td>
                      <td>{r.CAPACITY}</td>
                      <td>{r.APPROVAL_REQUIRED_YN==='Y'?<span className="badge bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">필요</span>:'—'}</td>
                      <td>{r.USE_YN==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({...r}); setModal('room') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* ── Auth Manage ── */}
          {page === 'authmanage' && (
            <div>
              <PageHeader title={T.authPageTitle} sub={T.authPageSub}>
                <Btn primary onClick={() => { setModalData({}); setModal('auth') }}>{T.addLabel}</Btn>
              </PageHeader>
              <FilterBar>
                <FormGroup label={T.lblAuthRoom}>
                  <select className={inputCls} style={{width:180}} value={authFilterRoom} onChange={e=>setAuthFilterRoom(e.target.value)}>
                    <option value="">{T.statusAll}</option>
                    {rooms.filter(r=>r.USE_YN==='Y').map(r=><option key={r.ROOM_ID} value={r.ROOM_ID}>{r.ROOM_NAME}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblAuthType}>
                  <select className={inputCls} style={{width:120}} value={authFilterType} onChange={e=>setAuthFilterType(e.target.value)}>
                    <option value="">{T.authAll}</option>
                    <option value="ADMIN">{T.authAdmin}</option>
                    <option value="APPROVER">{T.authApprover}</option>
                  </select>
                </FormGroup>
                <Btn primary onClick={loadAuthList}>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.authThead} />
                <tbody>{authList.length===0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : authList.map((a:any) => (
                    <tr key={a.room_auth_id} className="hover:bg-gray-50">
                      <td>{a.room_name}</td>
                      <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{a.user_id}</code></td>
                      <td>{a.user_name}</td>
                      <td>{a.dept_name}</td>
                      <td>{a.auth_type==='ADMIN'
                        ? <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">{T.authAdmin}</span>
                        : <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{T.authApprover}</span>}
                      </td>
                      <td>{a.use_yn==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({...a, ROOM_AUTH_ID:a.room_auth_id, ROOM_ID:a.room_id, USER_ID:a.user_id, AUTH_TYPE:a.auth_type, USE_YN:a.use_yn}); setModal('auth') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* ── User Manage ── */}
          {page === 'usermanage' && (
            <div>
              <PageHeader title={T.userPageTitle} sub={T.userPageSub}>
                <Btn primary onClick={() => { setModalData({ USE_YN:'Y', IS_SYS_ADMIN:'N' }); setModal('user') }}>{T.newLabel}</Btn>
              </PageHeader>
              <TableCard>
                <TableHead cols={T.userThead} />
                <tbody>{users.length===0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : users.map(u => (
                    <tr key={u.USER_ID} className="hover:bg-gray-50">
                      <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{u.USER_ID}</code></td>
                      <td className="font-medium">{u.USER_NAME}</td>
                      <td className="text-xs text-gray-500">{u.EMAIL}</td>
                      <td>{u.DEPT_NAME}</td>
                      <td>{u.IS_SYS_ADMIN==='Y'?<span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">Y</span>:'—'}</td>
                      <td>{u.USE_YN==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({...u, _isEdit:true}); setModal('user') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* ── Code Manage ── */}
          {page === 'codemanage' && (
            <CodeManagePage codes={codes} codeDtls={codeDtls} setCodes={setCodes} setCodeDtls={setCodeDtls} currentUser={currentUser} T={T} />
          )}

          {/* ── History ── */}
          {page === 'history' && (
            <div>
              <PageHeader title={T.hisPageTitle} sub={T.hisPageSub} />
              <FilterBar>
                <FormGroup label="From"><input type="date" className={inputCls} value={hisFrom} onChange={e=>setHisFrom(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label="To"><input type="date" className={inputCls} value={hisTo} onChange={e=>setHisTo(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label="Type">
                  <select className={inputCls} style={{width:120}} value={hisActType} onChange={e=>setHisActType(e.target.value)}>
                    <option value="">{T.actAll}</option>
                    <option value="CREATE">{T.actCreate}</option>
                    <option value="UPDATE">{T.actUpdate}</option>
                    <option value="DELETE">{T.actDelete}</option>
                  </select>
                </FormGroup>
                <FormGroup label="User"><input type="text" className={inputCls} value={hisUser} onChange={e=>setHisUser(e.target.value)} style={{width:140}} /></FormGroup>
                <Btn primary onClick={loadHistory}>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.hisThead} />
                <tbody>{hisList.length===0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : hisList.map((h:any) => (
                    <tr key={h.his_id} className="hover:bg-gray-50 text-sm">
                      <td className="text-xs text-gray-400">#{h.his_id}</td>
                      <td className="text-xs text-gray-400">#{h.reservation_id}</td>
                      <td><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${h.action_type==='CREATE'?'bg-green-100 text-green-700':h.action_type==='UPDATE'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{T.histActionMap[h.action_type]||h.action_type}</span></td>
                      <td>{h.action_user_name||h.action_user_id}</td>
                      <td className="text-xs text-gray-500">{h.action_datetime?.slice(0,16)}</td>
                      <td className="text-xs text-gray-400">{h.remark||'—'}</td>
                      <td><Btn small onClick={() => { setModalData(h); setModal('hisDetail') }}>▸</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

        </main>
      </div>

      {/* ══════════════ MODALS ══════════════ */}

      {/* User Switch */}
      {modal === 'userSwitch' && (
        <Modal title={T.userChange} onClose={() => setModal(null)} size="sm">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded">Windows AD 연동 전 시뮬레이션 모드입니다.</div>
          <FormGroup label={T.userChange}>
            <select className={inputCls} value={currentUser?.USER_ID||''}
              onChange={e => { const u = users.find(x=>x.USER_ID===e.target.value); if(u) setCurrentUser(u) }}>
              {users.filter(u=>u.USE_YN==='Y').map(u=><option key={u.USER_ID} value={u.USER_ID}>{u.USER_NAME} ({u.DEPT_NAME}) {u.IS_SYS_ADMIN==='Y'?'★':''}</option>)}
            </select>
          </FormGroup>
          <ModalFooter><Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn></ModalFooter>
        </Modal>
      )}

      {/* Day Detail */}
      {modal === 'dayDetail' && (
        <Modal title={`📅 ${modalData.date}`} onClose={() => setModal(null)}>
          <div className="mb-4 space-y-2">
            {modalData.reservations?.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">예약 없음</p>
              : modalData.reservations?.map((r:Reservation) => (
                <div key={r.RESERVATION_ID} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs text-gray-500 whitespace-nowrap">{r.START_TIME}~{r.END_TIME}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.TITLE}</div>
                    <div className="text-xs text-gray-400">{r.ROOM_NAME} · {r.PARTICIPANT_COUNT}명</div>
                  </div>
                  {badge(r.STATUS_CODE)}
                </div>
              ))}
          </div>
          <ModalFooter>
            <Btn primary onClick={() => { setModalData({ RESERVATION_DATE: modalData.date }); setModal('reservation') }}>＋ 예약</Btn>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* Reservation Modal */}
      {modal === 'reservation' && (
        <Modal title={modalData.RESERVATION_ID ? T.resModalTitleEdit : T.resModalTitleNew} onClose={() => setModal(null)}>
          {modalData.ROOM_ID && rooms.find(r=>r.ROOM_ID===modalData.ROOM_ID)?.APPROVAL_REQUIRED_YN==='Y' && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded">{T.approvalNoteMsg}</div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblBuilding} required>
                <select className={inputCls} value={modalData.BUILDING_CODE||''} onChange={e=>setModalData({...modalData,BUILDING_CODE:e.target.value,FLOOR_CODE:'',ROOM_ID:''})}>
                  <option value="">—</option>
                  {getBuildingCodes().map(b=><option key={b.CODE} value={b.CODE}>{b.CODE_NAME}</option>)}
                </select>
              </FormGroup>
              <FormGroup label={T.lblFloor} required>
                <select className={inputCls} value={modalData.FLOOR_CODE||''} onChange={e=>setModalData({...modalData,FLOOR_CODE:e.target.value,ROOM_ID:''})}>
                  <option value="">—</option>
                  {getFloorCodes(modalData.BUILDING_CODE||'').map(f=><option key={f.CODE} value={f.CODE}>{f.CODE_NAME}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label={T.lblRoom} required>
              <select className={inputCls} value={modalData.ROOM_ID||''} onChange={e=>setModalData({...modalData,ROOM_ID:parseInt(e.target.value)})}>
                <option value="">—</option>
                {filteredRooms(modalData.BUILDING_CODE, modalData.FLOOR_CODE).map(r=><option key={r.ROOM_ID} value={r.ROOM_ID}>{r.ROOM_NAME}{r.APPROVAL_REQUIRED_YN==='Y'?' ⚠️':''}</option>)}
              </select>
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblResDate} required>
                <input type="date" className={inputCls} value={modalData.RESERVATION_DATE||today()} onChange={e=>setModalData({...modalData,RESERVATION_DATE:e.target.value})} />
              </FormGroup>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={modalData.ALL_DAY_YN==='Y'} onChange={e=>setModalData({...modalData,ALL_DAY_YN:e.target.checked?'Y':'N',START_TIME:'07:30',END_TIME:'18:00'})} />
                  {T.lblResAllDay}
                </label>
              </div>
            </div>
            {modalData.ALL_DAY_YN !== 'Y' && (
              <div className="grid grid-cols-2 gap-3">
                <FormGroup label={T.lblResStart} required>
                  <select className={inputCls} value={modalData.START_TIME||''} onChange={e=>setModalData({...modalData,START_TIME:e.target.value})}>
                    <option value="">—</option>
                    {TIME_SLOTS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblResEnd} required>
                  <select className={inputCls} value={modalData.END_TIME||''} onChange={e=>setModalData({...modalData,END_TIME:e.target.value})}>
                    <option value="">—</option>
                    {TIME_SLOTS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </FormGroup>
              </div>
            )}
            <FormGroup label={T.lblResTitle} required>
              <input type="text" className={inputCls} value={modalData.TITLE||''} onChange={e=>setModalData({...modalData,TITLE:e.target.value})} />
            </FormGroup>
            <FormGroup label={T.lblResParticipants}>
              <select className={inputCls} value={modalData.PARTICIPANT_COUNT||''} onChange={e=>setModalData({...modalData,PARTICIPANT_COUNT:parseInt(e.target.value)})}>
                {Array.from({length:50},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}명</option>)}
              </select>
            </FormGroup>
          </div>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn primary onClick={saveReservation}>{T.saveLabel}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* Approval Modal */}
      {modal === 'approval' && modalData.res && (
        <Modal title="✅ 승인/거절 처리" onClose={() => setModal(null)}>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <div><span className="text-gray-500">미팅룸:</span> <strong>{modalData.res.ROOM_NAME}</strong></div>
            <div><span className="text-gray-500">일시:</span> {modalData.res.RESERVATION_DATE} {modalData.res.START_TIME}~{modalData.res.END_TIME}</div>
            <div><span className="text-gray-500">제목:</span> {modalData.res.TITLE}</div>
            <div><span className="text-gray-500">신청자:</span> {modalData.res.REQUEST_USER_NAME}</div>
          </div>
          <FormGroup label={T.lblAppComment}>
            <textarea className={inputCls} rows={2} value={modalData.ACTION_COMMENT||''} onChange={e=>setModalData({...modalData,ACTION_COMMENT:e.target.value})} />
          </FormGroup>
          <FormGroup label={T.lblRejectReason}>
            <textarea className={inputCls} rows={2} value={modalData.REJECT_REASON||''} onChange={e=>setModalData({...modalData,REJECT_REASON:e.target.value})} />
          </FormGroup>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn danger onClick={() => processApproval(modalData.res.RESERVATION_ID,'REJECTED')}>{T.btnReject}</Btn>
            <Btn primary onClick={() => processApproval(modalData.res.RESERVATION_ID,'APPROVED')}>{T.btnApprove}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* Room Modal */}
      {modal === 'room' && (
        <Modal title={modalData.ROOM_ID ? T.modifyLabel : T.newLabel} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblBuilding} required>
                <select className={inputCls} value={modalData.BUILDING_CODE||''} onChange={e=>setModalData({...modalData,BUILDING_CODE:e.target.value,FLOOR_CODE:''})}>
                  <option value="">—</option>
                  {getBuildingCodes().map(b=><option key={b.CODE} value={b.CODE}>{b.CODE_NAME}</option>)}
                </select>
              </FormGroup>
              <FormGroup label={T.lblFloor} required>
                <select className={inputCls} value={modalData.FLOOR_CODE||''} onChange={e=>setModalData({...modalData,FLOOR_CODE:e.target.value})}>
                  <option value="">—</option>
                  {getFloorCodes(modalData.BUILDING_CODE||'').map(f=><option key={f.CODE} value={f.CODE}>{f.CODE_NAME}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label={T.lblRmCode} required>
              <input type="text" className={inputCls} value={modalData.ROOM_CODE||''} onChange={e=>setModalData({...modalData,ROOM_CODE:e.target.value})} placeholder="MR_HQ_3F_A" />
            </FormGroup>
            <FormGroup label={T.lblRmName} required>
              <input type="text" className={inputCls} value={modalData.ROOM_NAME||''} onChange={e=>setModalData({...modalData,ROOM_NAME:e.target.value})} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblRmCapacity}>
                <input type="number" className={inputCls} value={modalData.CAPACITY||''} onChange={e=>setModalData({...modalData,CAPACITY:parseInt(e.target.value)})} />
              </FormGroup>
              <FormGroup label={T.lblRmApproval}>
                <select className={inputCls} value={modalData.APPROVAL_REQUIRED_YN||'N'} onChange={e=>setModalData({...modalData,APPROVAL_REQUIRED_YN:e.target.value})}>
                  <option value="N">{T.approvalN}</option>
                  <option value="Y">{T.approvalY}</option>
                </select>
              </FormGroup>
            </div>
            <FormGroup label={T.lblRmUseYn}>
              <select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}>
                <option value="Y">{T.useY}</option>
                <option value="N">{T.useN}</option>
              </select>
            </FormGroup>
            <FormGroup label={T.lblRmRemark}>
              <textarea className={inputCls} rows={2} value={modalData.REMARK||''} onChange={e=>setModalData({...modalData,REMARK:e.target.value})} />
            </FormGroup>
          </div>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn primary onClick={saveRoom}>{T.saveLabel}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* Auth Modal */}
      {modal === 'auth' && (
        <Modal title={modalData.ROOM_AUTH_ID ? T.modifyLabel + ' 권한' : '＋ 권한 추가'} onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label={T.lblAuthRoom} required>
              <select className={inputCls} value={modalData.ROOM_ID||''} onChange={e=>setModalData({...modalData,ROOM_ID:parseInt(e.target.value)})}>
                <option value="">—</option>
                {rooms.filter(r=>r.USE_YN==='Y').map(r=><option key={r.ROOM_ID} value={r.ROOM_ID}>{r.ROOM_NAME}</option>)}
              </select>
            </FormGroup>
            <FormGroup label={T.lblAuthUser} required>
              <select className={inputCls} value={modalData.USER_ID||''} onChange={e=>setModalData({...modalData,USER_ID:e.target.value})}>
                <option value="">—</option>
                {users.filter(u=>u.USE_YN==='Y').map(u=><option key={u.USER_ID} value={u.USER_ID}>{u.USER_NAME} ({u.DEPT_NAME})</option>)}
              </select>
            </FormGroup>
            <FormGroup label={T.lblAuthType} required>
              <select className={inputCls} value={modalData.AUTH_TYPE||'APPROVER'} onChange={e=>setModalData({...modalData,AUTH_TYPE:e.target.value})}>
                <option value="APPROVER">{T.authApprover}</option>
                <option value="ADMIN">{T.authAdmin}</option>
              </select>
            </FormGroup>
            <FormGroup label={T.lblAuthUseYn}>
              <select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}>
                <option value="Y">{T.useY}</option>
                <option value="N">{T.useN}</option>
              </select>
            </FormGroup>
          </div>
          <ModalFooter>
            {modalData.ROOM_AUTH_ID && (
              <Btn danger onClick={async()=>{
                if(!confirm('삭제하시겠습니까?'))return
                await fetch(`/api/auth-manage/${modalData.ROOM_AUTH_ID}`,{method:'DELETE'})
                setModal(null); loadAuthList()
              }}>삭제</Btn>
            )}
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn primary onClick={saveAuth}>{T.saveLabel}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* User Modal */}
      {modal === 'user' && (
        <Modal title={modalData._isEdit ? T.modifyLabel + ' 사용자' : T.newLabel} onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label={T.lblUserId} required>
              <input type="text" className={inputCls} value={modalData.USER_ID||''} disabled={!!modalData._isEdit}
                onChange={e=>setModalData({...modalData,USER_ID:e.target.value})} placeholder="user01" />
            </FormGroup>
            <FormGroup label={T.lblUserName} required>
              <input type="text" className={inputCls} value={modalData.USER_NAME||''} onChange={e=>setModalData({...modalData,USER_NAME:e.target.value})} />
            </FormGroup>
            <FormGroup label={T.lblEmail}>
              <input type="email" className={inputCls} value={modalData.EMAIL||''} onChange={e=>setModalData({...modalData,EMAIL:e.target.value})} />
            </FormGroup>
            <FormGroup label={T.lblDept}>
              <input type="text" className={inputCls} value={modalData.DEPT_NAME||''} onChange={e=>setModalData({...modalData,DEPT_NAME:e.target.value})} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblIsSysAdmin}>
                <select className={inputCls} value={modalData.IS_SYS_ADMIN||'N'} onChange={e=>setModalData({...modalData,IS_SYS_ADMIN:e.target.value})}>
                  <option value="N">N</option>
                  <option value="Y">Y (관리자)</option>
                </select>
              </FormGroup>
              <FormGroup label={T.lblUseYn}>
                <select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}>
                  <option value="Y">{T.useY}</option>
                  <option value="N">{T.useN}</option>
                </select>
              </FormGroup>
            </div>
          </div>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn primary onClick={saveUser}>{T.saveLabel}</Btn>
          </ModalFooter>
        </Modal>
      )}

      {/* History Detail */}
      {modal === 'hisDetail' && (
        <Modal title="이력 상세" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div><span className="text-gray-400 text-xs">HIS ID</span><div>#{modalData.his_id}</div></div>
            <div><span className="text-gray-400 text-xs">Reservation ID</span><div>#{modalData.reservation_id}</div></div>
            <div><span className="text-gray-400 text-xs">Action</span><div>{modalData.action_type}</div></div>
            <div><span className="text-gray-400 text-xs">User</span><div>{modalData.action_user_name||modalData.action_user_id}</div></div>
            <div className="col-span-2"><span className="text-gray-400 text-xs">Timestamp</span><div>{modalData.action_datetime}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">{T.hisBeforeLabel}</div>
              <pre className="bg-red-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">{modalData.before_value ? JSON.stringify(JSON.parse(modalData.before_value),null,2) : '—'}</pre>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">{T.hisAfterLabel}</div>
              <pre className="bg-green-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">{modalData.after_value ? JSON.stringify(JSON.parse(modalData.after_value),null,2) : '—'}</pre>
            </div>
          </div>
          <ModalFooter><Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn></ModalFooter>
        </Modal>
      )}

    </div>
  )
}

// ── Code Manage Sub-page ───────────────────────────────────────
function CodeManagePage({ codes, codeDtls, setCodes, setCodeDtls, currentUser, T }: any) {
  const [selGroupId, setSelGroupId] = useState<number|null>(null)
  const [modal, setModal] = useState<string|null>(null)
  const [modalData, setModalData] = useState<any>({})

  const selGroup = codes.find((c:any) => c.CODE_GROUP_ID === selGroupId || c.code_group_id === selGroupId)
  const details  = codeDtls.filter((d:any) => (d.CODE_GROUP_ID||d.code_group_id) === selGroupId)
    .sort((a:any,b:any) => (a.SORT_ORDER||a.sort_order||0)-(b.SORT_ORDER||b.sort_order||0))

  async function saveGroup() {
    const method = modalData.CODE_GROUP_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_GROUP_ID ? `/api/codes/${modalData.CODE_GROUP_ID}` : '/api/codes'
    const payload = { CODE_GROUP: modalData.CODE_GROUP, CODE_GROUP_NAME: modalData.CODE_GROUP_NAME, USE_YN: modalData.USE_YN||'Y', CREATED_BY: currentUser?.USER_ID||'system', UPDATED_BY: currentUser?.USER_ID||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if (!res.ok) { alert('Error'); return }
    const updated = await fetch('/api/codes').then(r=>r.json())
    setCodes(updated); setModal(null)
  }

  async function saveDetail() {
    const method = modalData.CODE_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_ID ? `/api/codes/details/${modalData.CODE_ID}` : '/api/codes/details'
    const payload = { ...modalData, CODE_GROUP_ID: selGroupId, CREATED_BY: currentUser?.USER_ID||'system', UPDATED_BY: currentUser?.USER_ID||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if (!res.ok) { alert('Error'); return }
    const updated = await fetch('/api/codes/details').then(r=>r.json())
    setCodeDtls(updated); setModal(null)
  }

  async function deleteDetail(id: number) {
    if (!confirm(T.alertDeleted)) return
    await fetch(`/api/codes/details/${id}`, { method: 'DELETE' })
    const updated = await fetch('/api/codes/details').then(r=>r.json())
    setCodeDtls(updated)
  }

  return (
    <div>
      <PageHeader title={T.codePageTitle} sub={T.codePageSub} />
      <div className="grid grid-cols-[280px_1fr] gap-4">
        {/* Code Groups */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
            <span className="text-sm font-semibold">{T.codeGrpTitle}</span>
            <Btn small primary onClick={() => { setModalData({USE_YN:'Y'}); setModal('group') }}>＋</Btn>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {codes.map((g:any) => (
              <div key={g.CODE_GROUP_ID||g.code_group_id}
                onClick={() => setSelGroupId(g.CODE_GROUP_ID||g.code_group_id)}
                className={`flex items-center px-4 py-3 cursor-pointer border-b border-gray-50 transition-all
                  ${selGroupId===(g.CODE_GROUP_ID||g.code_group_id)?'bg-yellow-50 border-l-2 border-l-[#F5A623]':'hover:bg-gray-50'}`}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{g.CODE_GROUP||g.code_group}</div>
                  <div className="text-xs text-gray-400">{g.CODE_GROUP_NAME||g.code_group_name}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();setModalData({CODE_GROUP_ID:g.CODE_GROUP_ID||g.code_group_id,CODE_GROUP:g.CODE_GROUP||g.code_group,CODE_GROUP_NAME:g.CODE_GROUP_NAME||g.code_group_name,USE_YN:g.USE_YN||g.use_yn});setModal('group')}}
                  className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200">✎</button>
              </div>
            ))}
          </div>
        </div>
        {/* Code Details */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
            <span className="text-sm font-semibold">{selGroup ? `${T.codeGrpTitle} — ${selGroup.CODE_GROUP||selGroup.code_group}` : T.codeGrpTitle}</span>
            <Btn small primary disabled={!selGroupId} onClick={() => { setModalData({USE_YN:'Y'}); setModal('detail') }}>＋ 코드 추가</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full"><thead><tr>{T.codeDtlThead.map((h:string)=><th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase bg-gray-50 border-b">{h}</th>)}</tr></thead>
              <tbody>{details.length===0
                ? <tr><td colSpan={5} className="text-center py-8 text-gray-300 text-sm">{selGroupId ? T.tableNoData : '← 코드 그룹을 선택하세요'}</td></tr>
                : details.map((d:any) => (
                  <tr key={d.CODE_ID||d.code_id} className="hover:bg-gray-50 border-b border-gray-50">
                    <td className="px-3 py-2"><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{d.CODE||d.code}</code></td>
                    <td className="px-3 py-2 font-medium text-sm">{d.CODE_NAME||d.code_name}</td>
                    <td className="px-3 py-2 text-sm">{d.SORT_ORDER||d.sort_order||'—'}</td>
                    <td className="px-3 py-2">{(d.USE_YN||d.use_yn)==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-300 text-xs">○</span>}</td>
                    <td className="px-3 py-2">
                      <Btn small onClick={()=>{setModalData({CODE_ID:d.CODE_ID||d.code_id,CODE:d.CODE||d.code,CODE_NAME:d.CODE_NAME||d.code_name,SORT_ORDER:d.SORT_ORDER||d.sort_order,USE_YN:d.USE_YN||d.use_yn});setModal('detail')}}>수정</Btn>
                    </td>
                  </tr>
                ))
              }</tbody>
            </table>
          </div>
        </div>
      </div>

      {modal === 'group' && (
        <Modal title="코드 그룹" onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label={T.lblCgCode} required><input className={inputCls} value={modalData.CODE_GROUP||''} onChange={e=>setModalData({...modalData,CODE_GROUP:e.target.value})} /></FormGroup>
            <FormGroup label={T.lblCgName} required><input className={inputCls} value={modalData.CODE_GROUP_NAME||''} onChange={e=>setModalData({...modalData,CODE_GROUP_NAME:e.target.value})} /></FormGroup>
            <FormGroup label="사용여부"><select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}><option value="Y">Y</option><option value="N">N</option></select></FormGroup>
          </div>
          <ModalFooter><Btn onClick={()=>setModal(null)}>닫기</Btn><Btn primary onClick={saveGroup}>저장</Btn></ModalFooter>
        </Modal>
      )}
      {modal === 'detail' && (
        <Modal title="코드 상세" onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label={T.lblCdCode} required><input className={inputCls} value={modalData.CODE||''} onChange={e=>setModalData({...modalData,CODE:e.target.value})} /></FormGroup>
            <FormGroup label={T.lblCdName} required><input className={inputCls} value={modalData.CODE_NAME||''} onChange={e=>setModalData({...modalData,CODE_NAME:e.target.value})} /></FormGroup>
            <FormGroup label={T.lblCdSort}><input type="number" className={inputCls} value={modalData.SORT_ORDER||''} onChange={e=>setModalData({...modalData,SORT_ORDER:parseInt(e.target.value)})} /></FormGroup>
            <FormGroup label="사용여부"><select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}><option value="Y">Y</option><option value="N">N</option></select></FormGroup>
          </div>
          <ModalFooter>
            {modalData.CODE_ID && <Btn danger onClick={()=>deleteDetail(modalData.CODE_ID)}>삭제</Btn>}
            <Btn onClick={()=>setModal(null)}>닫기</Btn>
            <Btn primary onClick={saveDetail}>저장</Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

// ── Shared UI Components ───────────────────────────────────────
const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623]/20 bg-white'

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-1"><div className="px-5 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{title}</div>{children}</div>
}
function NavItem({ icon, label, active, onClick, badge }: { icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2.5 px-5 py-2.5 cursor-pointer text-sm transition-all border-l-[3px]
      ${active ? 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623] font-medium' : 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'}`}>
      <span className="w-4 text-center text-sm">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && <span className="bg-[#E94560] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </div>
  )
}
function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div><h1 className="text-xl font-bold tracking-tight">{title}</h1>{sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">{children}</div>
}
function FormGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}
function TableCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto"><table className="w-full border-collapse">{children}</table></div>
}
function TableHead({ cols }: { cols: string[] }) {
  return <thead><tr>{cols.map(c => <th key={c} className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-200 whitespace-nowrap">{c}</th>)}</tr></thead>
}
function Modal({ title, onClose, children, size='md' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'sm'|'md' }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-5 animate-[fadeIn_0.15s_ease]">
      <div className={`bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${size==='sm'?'max-w-md':'max-w-lg'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <span className="text-base font-bold">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">{children}</div>
}
function Btn({ children, onClick, primary, danger, small, disabled }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; small?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 font-medium rounded-md transition-all disabled:opacity-50 cursor-pointer
        ${small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'}
        ${primary ? 'bg-[#F5A623] text-[#1A1A2E] hover:bg-[#C8930A]' :
          danger  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' :
                    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
      {children}
    </button>
  )
}
