/**
 * KB Prasac Meeting Room Reservation System
 * Main Application Page (Single Page App)
 *
 * ── 수정 이력 ──────────────────────────────────────────────────
 * v1.0  2025-04-19  최초 생성
 * v1.1  2025-04-19  Bug Fix - void 타입 truthiness 오류 수정
 * v1.2  2025-04-19  기능 개선
 *                   - 팝업 드래그 이동 기능 추가
 *                   - 공통코드 관리: BUILDING 기반 동적 Floor 그룹 관리
 *                   - 권한 관리: 소문자 API 응답 처리 수정
 *                   - 권한 관리: 미팅룸별 승인자 복수 지정 UI 개선
 * ───────────────────────────────────────────────────────────────
 */
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { t } from '@/lib/i18n'
import type { Lang, User, MeetingRoom, Reservation, RoomUserAuth, ReservationHistory, CommonCode, CommonCodeDtl } from '@/lib/types'
import { STATUS_BADGE } from '@/lib/types'

const TIME_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function today() { return fmtDate(new Date()) }

// DB 응답은 소문자 — 어느 쪽이든 읽을 수 있는 헬퍼
function g(obj: any, key: string) { return obj?.[key] ?? obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()] }

function badge(status: string) {
  const s = STATUS_BADGE[status as keyof typeof STATUS_BADGE]
  return s ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.en}</span> : <span>{status}</span>
}

export default function App() {
  const [lang, setLang] = useState<Lang>('ko')
  const [page, setPage] = useState('calendar')
  const [users, setUsers]   = useState<any[]>([])
  const [rooms, setRooms]   = useState<any[]>([])
  const [codes, setCodes]   = useState<any[]>([])
  const [codeDtls, setCodeDtls] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calRoomId, setCalRoomId]     = useState('')
  const [calBuilding, setCalBuilding] = useState('')
  const [calFloor, setCalFloor]       = useState('')
  const [calReservations, setCalReservations] = useState<any[]>([])

  const [myResFrom, setMyResFrom]       = useState(() => { const d = new Date(); d.setDate(1); return fmtDate(d) })
  const [myResToDate, setMyResToDate]   = useState(() => { const d = new Date(); d.setMonth(d.getMonth()+1,0); return fmtDate(d) })
  const [myResStatus, setMyResStatus]   = useState('')
  const [myResTitle, setMyResTitle]     = useState('')
  const [myResList, setMyResList]       = useState<any[]>([])

  const [appFrom, setAppFrom] = useState(today())
  const [appTo, setAppTo]     = useState(() => { const d = new Date(); d.setMonth(d.getMonth()+1); return fmtDate(d) })
  const [appList, setAppList] = useState<any[]>([])

  const [authList, setAuthList]             = useState<any[]>([])
  const [authFilterRoom, setAuthFilterRoom] = useState('')
  const [authFilterType, setAuthFilterType] = useState('')

  const [hisList, setHisList]       = useState<any[]>([])
  const [hisFrom, setHisFrom]       = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return fmtDate(d) })
  const [hisTo, setHisTo]           = useState(today())
  const [hisActType, setHisActType] = useState('')
  const [hisUser, setHisUser]       = useState('')

  const [modal, setModal]         = useState<string|null>(null)
  const [modalData, setModalData] = useState<any>({})

  const T = t(lang)

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r=>r.json()),
      fetch('/api/rooms').then(r=>r.json()),
      fetch('/api/codes').then(r=>r.json()),
      fetch('/api/codes/details').then(r=>r.json()),
    ]).then(([u, r, c, cd]) => {
      setUsers(Array.isArray(u)?u:[])
      setRooms(Array.isArray(r)?r:[])
      setCodes(Array.isArray(c)?c:[])
      setCodeDtls(Array.isArray(cd)?cd:[])
      if (Array.isArray(u) && u.length) setCurrentUser(u.find((x:any)=>g(x,'use_yn')==='Y') || u[0])
    })
  }, [])

  useEffect(() => { if (currentUser) loadCalendar() }, [calYear, calMonth, calRoomId])

  const isSysAdmin = g(currentUser,'is_sys_admin') === 'Y'

  function getBuildingCodes() {
    const grp = codes.find(c => g(c,'code_group') === 'BUILDING')
    if (!grp) return []
    const gid = g(grp,'code_group_id')
    return codeDtls.filter(d => g(d,'code_group_id') == gid && g(d,'use_yn') === 'Y')
  }
  function getFloorCodes(building: string) {
    if (!building) return []
    const grpCode = `FLOOR_${building}`
    const grp = codes.find(c => g(c,'code_group') === grpCode)
    if (!grp) return []
    const gid = g(grp,'code_group_id')
    return codeDtls.filter(d => g(d,'code_group_id') == gid && g(d,'use_yn') === 'Y')
  }
  function filteredRooms(building='', floor='') {
    return rooms.filter(r =>
      g(r,'use_yn') === 'Y' &&
      (!building || g(r,'building_code') === building) &&
      (!floor    || g(r,'floor_code')    === floor)
    )
  }

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
    for (let i = first.getDay()-1; i >= 0; i--) { const d = new Date(calYear, calMonth, -i); days.push({ date: d, current: false }) }
    for (let i = 1; i <= last.getDate(); i++) { days.push({ date: new Date(calYear, calMonth, i), current: true }) }
    while (days.length % 7 !== 0) { const d = new Date(calYear, calMonth+1, days.length - last.getDate() - first.getDay() + 2); days.push({ date: d, current: false }) }
    return days
  }

  function resForDate(dateStr: string) {
    return calReservations.filter(r => g(r,'reservation_date')?.slice(0,10) === dateStr && g(r,'cancel_yn') !== 'Y')
  }

  async function loadMyRes() {
    if (!currentUser) return
    const params = new URLSearchParams({ user_id: g(currentUser,'user_id'), from_date: myResFrom, to_date: myResToDate })
    if (myResStatus) params.set('status', myResStatus)
    if (myResTitle)  params.set('title', myResTitle)
    const data = await fetch(`/api/reservations?${params}`).then(r=>r.json())
    setMyResList(Array.isArray(data) ? data : [])
  }

  async function loadApprovals() {
    const params = new URLSearchParams({ from_date: appFrom, to_date: appTo, status: 'REQUESTED' })
    const data = await fetch(`/api/reservations?${params}`).then(r=>r.json())
    setAppList(Array.isArray(data) ? data : [])
  }

  async function loadAuthList() {
    const params = new URLSearchParams()
    if (authFilterRoom) params.set('room_id', authFilterRoom)
    if (authFilterType) params.set('auth_type', authFilterType)
    const data = await fetch(`/api/auth-manage?${params}`).then(r=>r.json())
    setAuthList(Array.isArray(data) ? data : [])
  }

  async function loadHistory() {
    const params = new URLSearchParams({ from_date: hisFrom, to_date: hisTo })
    if (hisActType) params.set('action_type', hisActType)
    if (hisUser)    params.set('user_id', hisUser)
    const data = await fetch(`/api/history?${params}`).then(r=>r.json())
    setHisList(Array.isArray(data) ? data : [])
  }

  async function saveReservation() {
    const d = modalData
    if (!d.ROOM_ID || !d.RESERVATION_DATE || !d.START_TIME || !d.END_TIME || !d.TITLE) { alert(T.alertRequired); return }
    if (d.ALL_DAY_YN !== 'Y' && d.START_TIME >= d.END_TIME) { alert(T.alertTimeOrder); return }
    setLoading(true)
    try {
      const payload = { ...d, REQUEST_USER_ID: g(currentUser,'user_id') }
      const method  = d.RESERVATION_ID ? 'PUT' : 'POST'
      const url     = d.RESERVATION_ID ? `/api/reservations/${d.RESERVATION_ID}` : '/api/reservations'
      const res     = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json    = await res.json()
      if (json.error === 'DUPLICATE') { alert(T.alertDuplicate); return }
      if (!res.ok) { alert(json.error || T.alertRequired); return }
      alert(T.alertSaved); setModal(null); loadCalendar()
    } finally { setLoading(false) }
  }

  async function cancelReservation(id: number) {
    if (!confirm(T.confirmCancelRes)) return
    await fetch(`/api/reservations/${id}`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: g(currentUser,'user_id') }) })
    loadMyRes(); loadCalendar()
  }

  async function processApproval(reservationId: number, action: 'APPROVED'|'REJECTED') {
    const reason = modalData.REJECT_REASON || ''
    if (action === 'REJECTED' && !reason) { alert(T.alertRejectReasonRequired); return }
    setLoading(true)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ RESERVATION_ID: reservationId, APPROVER_USER_ID: g(currentUser,'user_id'), ACTION: action, ACTION_COMMENT: modalData.ACTION_COMMENT||'', REJECT_REASON: reason })
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error); return }
      alert(T.alertSaved); setModal(null); loadApprovals()
    } finally { setLoading(false) }
  }

  async function saveRoom() {
    const d = modalData
    if (!d.BUILDING_CODE || !d.FLOOR_CODE || !d.ROOM_CODE || !d.ROOM_NAME) { alert(T.alertRequired); return }
    setLoading(true)
    try {
      const method = d.ROOM_ID ? 'PUT' : 'POST'
      const url    = d.ROOM_ID ? `/api/rooms/${d.ROOM_ID}` : '/api/rooms'
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...d, CREATED_BY: g(currentUser,'user_id'), UPDATED_BY: g(currentUser,'user_id') }) })
      if (!res.ok) { alert((await res.json()).error); return }
      alert(T.alertSaved); setModal(null)
      setRooms(await fetch('/api/rooms').then(r=>r.json()))
    } finally { setLoading(false) }
  }

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
      setUsers(await fetch('/api/users').then(r=>r.json()))
    } finally { setLoading(false) }
  }

  async function saveAuth() {
    const d = modalData
    if (!d.ROOM_ID || !d.USER_ID || !d.AUTH_TYPE) { alert(T.alertRequired); return }
    setLoading(true)
    try {
      const method = d.ROOM_AUTH_ID ? 'PUT' : 'POST'
      const url    = d.ROOM_AUTH_ID ? `/api/auth-manage/${d.ROOM_AUTH_ID}` : '/api/auth-manage'
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...d, CREATED_BY: g(currentUser,'user_id'), UPDATED_BY: g(currentUser,'user_id') }) })
      const json = await res.json()
      if (json.error === 'DUPLICATE') { alert(T.alertDuplicateAuth); return }
      if (!res.ok) { alert(json.error); return }
      alert(T.alertSaved); setModal(null); loadAuthList()
    } finally { setLoading(false) }
  }

  function navigate(p: string) {
    setPage(p)
    if (p === 'myreservations') loadMyRes()
    if (p === 'approvals')      loadApprovals()
    if (p === 'authmanage')     loadAuthList()
    if (p === 'history')        loadHistory()
  }

  const pendingCount = appList.length

  return (
    <div className="min-h-screen flex flex-col">
      {loading && (
        <div className="fixed inset-0 bg-white/80 z-[9999] flex items-center justify-center">
          <div className="w-9 h-9 border-4 border-gray-200 border-t-[#F5A623] rounded-full animate-spin" />
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1A1A2E] h-14 flex items-center justify-between px-6 sticky top-0 z-50 shadow-md gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F5A623] text-[#1A1A2E] font-bold text-sm px-2.5 py-1 rounded">KB Prasac</div>
          <span className="text-white text-sm font-medium hidden sm:block">{T.appTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded p-1">
            {(['ko','en','kh'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${lang===l ? 'bg-[#F5A623] text-[#1A1A2E] font-bold' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                {l === 'ko' ? '한국어' : l === 'en' ? 'English' : 'ខ្មែរ'}
              </button>
            ))}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-white text-xs font-medium">{g(currentUser,'user_name')}</div>
            <div className="text-[#F5A623] text-[10px] font-mono">{isSysAdmin ? T.roleAdmin : T.roleUser}</div>
          </div>
          <button onClick={() => setModal('userSwitch')}
            className="bg-white/10 border border-white/20 text-white text-xs px-3 py-1.5 rounded hover:bg-white/20 transition">
            {T.userChange}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 bg-[#16213E] shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto hidden md:block">
          <div className="py-5">
            <NavSection title={T.sideCommon}>
              <NavItem icon="📅" label={T.navCalendar}   active={page==='calendar'}       onClick={() => navigate('calendar')} />
              <NavItem icon="📋" label={T.navMyRes}       active={page==='myreservations'} onClick={() => navigate('myreservations')} />
            </NavSection>
            <NavSection title={T.sideApprover}>
              <NavItem icon="✅" label={T.navApprovals} active={page==='approvals'} onClick={() => navigate('approvals')}
                badge={pendingCount > 0 ? pendingCount : undefined} />
            </NavSection>
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

        {/* Main */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* Calendar */}
          {page === 'calendar' && (
            <div>
              <PageHeader title={T.calPageTitle} sub={T.calPageSub}>
                <Btn primary onClick={() => { setModalData({}); setModal('reservation') }}>{T.btnNewRes}</Btn>
              </PageHeader>
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-end">
                <FormGroup label={T.lblBuilding}>
                  <select className={inputCls} value={calBuilding} onChange={e => { setCalBuilding(e.target.value); setCalFloor(''); setCalRoomId('') }}>
                    <option value="">{T.statusAll}</option>
                    {getBuildingCodes().map(b => <option key={g(b,'code')} value={g(b,'code')}>{g(b,'code_name')}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblFloor}>
                  <select className={inputCls} value={calFloor} onChange={e => { setCalFloor(e.target.value); setCalRoomId('') }}>
                    <option value="">{T.statusAll}</option>
                    {getFloorCodes(calBuilding).map(f => <option key={g(f,'code')} value={g(f,'code')}>{g(f,'code_name')}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblRoom}>
                  <select className={inputCls} style={{width:180}} value={calRoomId} onChange={e => setCalRoomId(e.target.value)}>
                    <option value="">{T.statusAll}</option>
                    {filteredRooms(calBuilding, calFloor).map(r => <option key={g(r,'room_id')} value={g(r,'room_id')}>{g(r,'room_name')}{g(r,'approval_required_yn')==='Y'?' ⚠️':''}</option>)}
                  </select>
                </FormGroup>
                <Btn primary onClick={loadCalendar}>{T.btnSearch}</Btn>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex items-center justify-center gap-4">
                  <button onClick={() => { const d = new Date(calYear, calMonth-1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-[#F5A623] hover:border-[#F5A623] text-lg transition">‹</button>
                  <span className="text-lg font-bold min-w-40 text-center">{T.monthLabel(calYear, calMonth)}</span>
                  <button onClick={() => { const d = new Date(calYear, calMonth+1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-[#F5A623] hover:border-[#F5A623] text-lg transition">›</button>
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
                      const res = resForDate(ds)
                      const dow = date.getDay()
                      return (
                        <div key={idx}
                          onClick={() => { setModalData({ date: ds, reservations: res }); setModal('dayDetail') }}
                          className={`border rounded p-1.5 min-h-[88px] cursor-pointer transition-all hover:border-[#F5A623] hover:shadow-sm
                            ${!current ? 'bg-gray-50 opacity-40' : 'bg-white'}
                            ${ds === today() ? 'border-[#F5A623]' : 'border-gray-200'}`}>
                          <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center mb-1
                            ${ds===today() ? 'bg-[#F5A623] text-[#1A1A2E] rounded-full' : dow===0?'text-red-500':dow===6?'text-blue-500':''}`}>
                            {date.getDate()}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {res.slice(0,2).map((r:any) => (
                              <div key={g(r,'reservation_id')}
                                className={`text-[10px] px-1 py-0.5 rounded truncate
                                  ${g(r,'status_code')==='RESERVED'?'bg-green-100 text-green-800':g(r,'status_code')==='REQUESTED'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800'}`}>
                                {g(r,'start_time')} {g(r,'title')}
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

          {/* My Reservations */}
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
                <Btn primary onClick={loadMyRes}>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.myResThead} />
                <tbody>{myResList.length===0
                  ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : myResList.map((r:any) => (
                    <tr key={g(r,'reservation_id')} className="hover:bg-gray-50">
                      <td>{g(r,'reservation_date')?.slice(0,10)}</td>
                      <td className="whitespace-nowrap">{g(r,'all_day_yn')==='Y'?T.allDayLabel:`${g(r,'start_time')}~${g(r,'end_time')}`}</td>
                      <td>{g(r,'building_code')} / {g(r,'floor_code')}F</td>
                      <td>{g(r,'room_name')}</td>
                      <td className="font-medium">{g(r,'title')}</td>
                      <td>{g(r,'participant_count')}</td>
                      <td>{badge(g(r,'status_code'))}</td>
                      <td className="text-xs text-gray-400">{g(r,'created_at')?.slice(0,16)}</td>
                      <td>{g(r,'status_code') !== 'CANCELED' && g(r,'status_code') !== 'REJECTED' && (
                        <Btn small danger onClick={() => cancelReservation(g(r,'reservation_id'))}>{T.cancelResLabel}</Btn>
                      )}</td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* Approvals */}
          {page === 'approvals' && (
            <div>
              <PageHeader title={T.appPageTitle} sub={T.appPageSub} />
              <FilterBar>
                <FormGroup label={T.lblDateFrom}><input type="date" className={inputCls} value={appFrom} onChange={e=>setAppFrom(e.target.value)} style={{width:140}} /></FormGroup>
                <FormGroup label={T.lblDateTo}><input type="date" className={inputCls} value={appTo} onChange={e=>setAppTo(e.target.value)} style={{width:140}} /></FormGroup>
                <Btn primary onClick={loadApprovals}>{T.btnSearch}</Btn>
              </FilterBar>
              <TableCard>
                <TableHead cols={T.appThead} />
                <tbody>{appList.length===0
                  ? <tr><td colSpan={10} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : appList.map((r:any) => (
                    <tr key={g(r,'reservation_id')} className="hover:bg-gray-50">
                      <td>{g(r,'reservation_date')?.slice(0,10)}</td>
                      <td className="whitespace-nowrap">{g(r,'all_day_yn')==='Y'?T.allDayLabel:`${g(r,'start_time')}~${g(r,'end_time')}`}</td>
                      <td>{g(r,'building_code')}/{g(r,'floor_code')}F</td>
                      <td>{g(r,'room_name')}</td>
                      <td className="font-medium">{g(r,'title')}</td>
                      <td>{g(r,'participant_count')}</td>
                      <td>{g(r,'request_user_name')}</td>
                      <td className="text-xs text-gray-400">{g(r,'request_datetime')?.slice(0,16)}</td>
                      <td>{badge(g(r,'status_code'))}</td>
                      <td><Btn small primary onClick={() => { setModalData({ res: r, ACTION_COMMENT:'', REJECT_REASON:'' }); setModal('approval') }}>처리</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* Room Manage */}
          {page === 'roommanage' && (
            <div>
              <PageHeader title={T.rmPageTitle} sub={T.rmPageSub}>
                <Btn primary onClick={() => { setModalData({ APPROVAL_REQUIRED_YN:'N', USE_YN:'Y' }); setModal('room') }}>{T.newLabel}</Btn>
              </PageHeader>
              <TableCard>
                <TableHead cols={T.rmThead} />
                <tbody>{rooms.length===0
                  ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : rooms.map((r:any) => (
                    <tr key={g(r,'room_id')} className="hover:bg-gray-50">
                      <td>{g(r,'building_code')}</td>
                      <td>{g(r,'floor_code')}F</td>
                      <td><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{g(r,'room_code')}</code></td>
                      <td className="font-medium">{g(r,'room_name')}</td>
                      <td>{g(r,'capacity')}</td>
                      <td>{g(r,'approval_required_yn')==='Y'?<span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{T.approvalRequired}</span>:'—'}</td>
                      <td>{g(r,'use_yn')==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({ ROOM_ID:g(r,'room_id'), BUILDING_CODE:g(r,'building_code'), FLOOR_CODE:g(r,'floor_code'), ROOM_CODE:g(r,'room_code'), ROOM_NAME:g(r,'room_name'), CAPACITY:g(r,'capacity'), APPROVAL_REQUIRED_YN:g(r,'approval_required_yn'), USE_YN:g(r,'use_yn'), REMARK:g(r,'remark') }); setModal('room') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* Auth Manage — 미팅룸별 승인자 복수 지정 */}
          {page === 'authmanage' && (
            <div>
              <PageHeader title={T.authPageTitle} sub={T.authPageSub}>
                <Btn primary onClick={() => { setModalData({ AUTH_TYPE:'APPROVER', USE_YN:'Y' }); setModal('auth') }}>{T.addLabel}</Btn>
              </PageHeader>
              <FilterBar>
                <FormGroup label={T.lblAuthRoom}>
                  <select className={inputCls} style={{width:200}} value={authFilterRoom} onChange={e=>setAuthFilterRoom(e.target.value)}>
                    <option value="">{T.statusAll}</option>
                    {rooms.filter((r:any)=>g(r,'use_yn')==='Y').map((r:any)=><option key={g(r,'room_id')} value={g(r,'room_id')}>{g(r,'room_name')}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label={T.lblAuthType}>
                  <select className={inputCls} style={{width:130}} value={authFilterType} onChange={e=>setAuthFilterType(e.target.value)}>
                    <option value="">{T.authAll}</option>
                    <option value="ADMIN">{T.authAdmin}</option>
                    <option value="APPROVER">{T.authApprover}</option>
                  </select>
                </FormGroup>
                <Btn primary onClick={loadAuthList}>{T.btnSearch}</Btn>
              </FilterBar>
              {/* 미팅룸별 승인자 그룹 표시 */}
              {authList.length > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
                  {T.authMultiNote}
                </div>
              )}
              <TableCard>
                <TableHead cols={T.authThead} />
                <tbody>{authList.length===0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : authList.map((a:any) => (
                    <tr key={g(a,'room_auth_id')} className="hover:bg-gray-50">
                      <td className="font-medium">{g(a,'room_name')}</td>
                      <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{g(a,'user_id')}</code></td>
                      <td>{g(a,'user_name')}</td>
                      <td className="text-gray-500">{g(a,'dept_name')}</td>
                      <td>{g(a,'auth_type')==='ADMIN'
                        ? <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">{T.authAdmin}</span>
                        : <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{T.authApprover}</span>}
                      </td>
                      <td>{g(a,'use_yn')==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({ ROOM_AUTH_ID:g(a,'room_auth_id'), ROOM_ID:g(a,'room_id'), USER_ID:g(a,'user_id'), AUTH_TYPE:g(a,'auth_type'), USE_YN:g(a,'use_yn') }); setModal('auth') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* User Manage */}
          {page === 'usermanage' && (
            <div>
              <PageHeader title={T.userPageTitle} sub={T.userPageSub}>
                <Btn primary onClick={() => { setModalData({ USE_YN:'Y', IS_SYS_ADMIN:'N' }); setModal('user') }}>{T.newLabel}</Btn>
              </PageHeader>
              <TableCard>
                <TableHead cols={T.userThead} />
                <tbody>{users.length===0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{T.tableNoData}</td></tr>
                  : users.map((u:any) => (
                    <tr key={g(u,'user_id')} className="hover:bg-gray-50">
                      <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{g(u,'user_id')}</code></td>
                      <td className="font-medium">{g(u,'user_name')}</td>
                      <td className="text-xs text-gray-500">{g(u,'email')}</td>
                      <td>{g(u,'dept_name')}</td>
                      <td>{g(u,'is_sys_admin')==='Y'?<span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">Y</span>:'—'}</td>
                      <td>{g(u,'use_yn')==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-400 text-xs">○</span>}</td>
                      <td><Btn small onClick={() => { setModalData({ USER_ID:g(u,'user_id'), USER_NAME:g(u,'user_name'), EMAIL:g(u,'email'), DEPT_NAME:g(u,'dept_name'), IS_SYS_ADMIN:g(u,'is_sys_admin'), USE_YN:g(u,'use_yn'), _isEdit:true }); setModal('user') }}>{T.modifyLabel}</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

          {/* Code Manage */}
          {page === 'codemanage' && (
            <CodeManagePage codes={codes} codeDtls={codeDtls} setCodes={setCodes} setCodeDtls={setCodeDtls} currentUser={currentUser} T={T} />
          )}

          {/* History */}
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
                    <tr key={g(h,'his_id')} className="hover:bg-gray-50 text-sm">
                      <td className="text-xs text-gray-400">#{g(h,'his_id')}</td>
                      <td className="text-xs text-gray-400">#{g(h,'reservation_id')}</td>
                      <td><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g(h,'action_type')==='CREATE'?'bg-green-100 text-green-700':g(h,'action_type')==='UPDATE'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{T.histActionMap[g(h,'action_type')]||g(h,'action_type')}</span></td>
                      <td>{g(h,'action_user_name')||g(h,'action_user_id')}</td>
                      <td className="text-xs text-gray-500">{g(h,'action_datetime')?.slice(0,16)}</td>
                      <td className="text-xs text-gray-400">{g(h,'remark')||'—'}</td>
                      <td><Btn small onClick={() => { setModalData(h); setModal('hisDetail') }}>▸</Btn></td>
                    </tr>
                  ))
                }</tbody>
              </TableCard>
            </div>
          )}

        </main>
      </div>

      {/* ══ MODALS ══ */}

      {modal === 'userSwitch' && (
        <DraggableModal title={T.userChange} onClose={() => setModal(null)} size="sm">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded">Windows AD 연동 전 시뮬레이션 모드입니다.</div>
          <FormGroup label={T.userChange}>
            <select className={inputCls} value={g(currentUser,'user_id')||''}
              onChange={e => { const u = users.find((x:any)=>g(x,'user_id')===e.target.value); if(u) setCurrentUser(u) }}>
              {users.filter((u:any)=>g(u,'use_yn')==='Y').map((u:any)=><option key={g(u,'user_id')} value={g(u,'user_id')}>{g(u,'user_name')} ({g(u,'dept_name')}) {g(u,'is_sys_admin')==='Y'?'★':''}</option>)}
            </select>
          </FormGroup>
          <ModalFooter><Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn></ModalFooter>
        </DraggableModal>
      )}

      {modal === 'dayDetail' && (
        <DraggableModal title={`📅 ${modalData.date}`} onClose={() => setModal(null)}>
          <div className="mb-4 space-y-2">
            {modalData.reservations?.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">예약 없음</p>
              : modalData.reservations?.map((r:any) => (
                <div key={g(r,'reservation_id')} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs text-gray-500 whitespace-nowrap">{g(r,'start_time')}~{g(r,'end_time')}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{g(r,'title')}</div>
                    <div className="text-xs text-gray-400">{g(r,'room_name')} · {g(r,'participant_count')}명</div>
                  </div>
                  {badge(g(r,'status_code'))}
                </div>
              ))}
          </div>
          <ModalFooter>
            <Btn primary onClick={() => { setModalData({ RESERVATION_DATE: modalData.date }); setModal('reservation') }}>＋ 예약</Btn>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
          </ModalFooter>
        </DraggableModal>
      )}

      {modal === 'reservation' && (
        <DraggableModal title={modalData.RESERVATION_ID ? T.resModalTitleEdit : T.resModalTitleNew} onClose={() => setModal(null)}>
          {modalData.ROOM_ID && rooms.find((r:any)=>g(r,'room_id')==modalData.ROOM_ID && g(r,'approval_required_yn')==='Y') && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded">{T.approvalNoteMsg}</div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblBuilding} required>
                <select className={inputCls} value={modalData.BUILDING_CODE||''} onChange={e=>setModalData({...modalData,BUILDING_CODE:e.target.value,FLOOR_CODE:'',ROOM_ID:''})}>
                  <option value="">—</option>
                  {getBuildingCodes().map(b=><option key={g(b,'code')} value={g(b,'code')}>{g(b,'code_name')}</option>)}
                </select>
              </FormGroup>
              <FormGroup label={T.lblFloor} required>
                <select className={inputCls} value={modalData.FLOOR_CODE||''} onChange={e=>setModalData({...modalData,FLOOR_CODE:e.target.value,ROOM_ID:''})}>
                  <option value="">—</option>
                  {getFloorCodes(modalData.BUILDING_CODE||'').map(f=><option key={g(f,'code')} value={g(f,'code')}>{g(f,'code_name')}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label={T.lblRoom} required>
              <select className={inputCls} value={modalData.ROOM_ID||''} onChange={e=>setModalData({...modalData,ROOM_ID:parseInt(e.target.value)})}>
                <option value="">—</option>
                {filteredRooms(modalData.BUILDING_CODE, modalData.FLOOR_CODE).map((r:any)=><option key={g(r,'room_id')} value={g(r,'room_id')}>{g(r,'room_name')}{g(r,'approval_required_yn')==='Y'?' ⚠️':''}</option>)}
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
              <select className={inputCls} value={modalData.PARTICIPANT_COUNT||1} onChange={e=>setModalData({...modalData,PARTICIPANT_COUNT:parseInt(e.target.value)})}>
                {Array.from({length:50},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}명</option>)}
              </select>
            </FormGroup>
          </div>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn primary onClick={saveReservation}>{T.saveLabel}</Btn>
          </ModalFooter>
        </DraggableModal>
      )}

      {modal === 'approval' && modalData.res && (
        <DraggableModal title="✅ 승인/거절 처리" onClose={() => setModal(null)}>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <div><span className="text-gray-500">미팅룸:</span> <strong>{g(modalData.res,'room_name')}</strong></div>
            <div><span className="text-gray-500">일시:</span> {g(modalData.res,'reservation_date')?.slice(0,10)} {g(modalData.res,'start_time')}~{g(modalData.res,'end_time')}</div>
            <div><span className="text-gray-500">제목:</span> {g(modalData.res,'title')}</div>
            <div><span className="text-gray-500">신청자:</span> {g(modalData.res,'request_user_name')}</div>
          </div>
          <FormGroup label={T.lblAppComment}>
            <textarea className={inputCls} rows={2} value={modalData.ACTION_COMMENT||''} onChange={e=>setModalData({...modalData,ACTION_COMMENT:e.target.value})} />
          </FormGroup>
          <FormGroup label={T.lblRejectReason}>
            <textarea className={inputCls} rows={2} value={modalData.REJECT_REASON||''} onChange={e=>setModalData({...modalData,REJECT_REASON:e.target.value})} />
          </FormGroup>
          <ModalFooter>
            <Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn>
            <Btn danger onClick={() => processApproval(g(modalData.res,'reservation_id'),'REJECTED')}>{T.btnReject}</Btn>
            <Btn primary onClick={() => processApproval(g(modalData.res,'reservation_id'),'APPROVED')}>{T.btnApprove}</Btn>
          </ModalFooter>
        </DraggableModal>
      )}

      {modal === 'room' && (
        <DraggableModal title={modalData.ROOM_ID ? T.modifyLabel : T.newLabel} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label={T.lblBuilding} required>
                <select className={inputCls} value={modalData.BUILDING_CODE||''} onChange={e=>setModalData({...modalData,BUILDING_CODE:e.target.value,FLOOR_CODE:''})}>
                  <option value="">—</option>
                  {getBuildingCodes().map(b=><option key={g(b,'code')} value={g(b,'code')}>{g(b,'code_name')}</option>)}
                </select>
              </FormGroup>
              <FormGroup label={T.lblFloor} required>
                <select className={inputCls} value={modalData.FLOOR_CODE||''} onChange={e=>setModalData({...modalData,FLOOR_CODE:e.target.value})}>
                  <option value="">—</option>
                  {getFloorCodes(modalData.BUILDING_CODE||'').map(f=><option key={g(f,'code')} value={g(f,'code')}>{g(f,'code_name')}</option>)}
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
        </DraggableModal>
      )}

      {modal === 'auth' && (
        <DraggableModal title={modalData.ROOM_AUTH_ID ? '권한 수정' : '＋ 권한 추가'} onClose={() => setModal(null)} size="sm">
          {!modalData.ROOM_AUTH_ID && (
            <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs p-3 rounded">
              {T.authAddNote}
            </div>
          )}
          <div className="space-y-3">
            <FormGroup label={T.lblAuthRoom} required>
              <select className={inputCls} value={modalData.ROOM_ID||''} onChange={e=>setModalData({...modalData,ROOM_ID:parseInt(e.target.value)})}>
                <option value="">—</option>
                {rooms.filter((r:any)=>g(r,'use_yn')==='Y').map((r:any)=><option key={g(r,'room_id')} value={g(r,'room_id')}>{g(r,'room_name')}{g(r,'approval_required_yn')==='Y'?' ⚠️':''}</option>)}
              </select>
            </FormGroup>
            <FormGroup label={T.lblAuthUser} required>
              <select className={inputCls} value={modalData.USER_ID||''} onChange={e=>setModalData({...modalData,USER_ID:e.target.value})}>
                <option value="">—</option>
                {users.filter((u:any)=>g(u,'use_yn')==='Y').map((u:any)=><option key={g(u,'user_id')} value={g(u,'user_id')}>{g(u,'user_name')} ({g(u,'dept_name')})</option>)}
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
        </DraggableModal>
      )}

      {modal === 'user' && (
        <DraggableModal title={modalData._isEdit ? '사용자 수정' : T.newLabel} onClose={() => setModal(null)} size="sm">
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
        </DraggableModal>
      )}

      {modal === 'hisDetail' && (
        <DraggableModal title="이력 상세" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div><span className="text-gray-400 text-xs">HIS ID</span><div>#{g(modalData,'his_id')}</div></div>
            <div><span className="text-gray-400 text-xs">Reservation ID</span><div>#{g(modalData,'reservation_id')}</div></div>
            <div><span className="text-gray-400 text-xs">Action</span><div>{g(modalData,'action_type')}</div></div>
            <div><span className="text-gray-400 text-xs">User</span><div>{g(modalData,'action_user_name')||g(modalData,'action_user_id')}</div></div>
            <div className="col-span-2"><span className="text-gray-400 text-xs">Timestamp</span><div>{g(modalData,'action_datetime')}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">{T.hisBeforeLabel}</div>
              <pre className="bg-red-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {g(modalData,'before_value') ? JSON.stringify(JSON.parse(g(modalData,'before_value')),null,2) : '—'}
              </pre>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">{T.hisAfterLabel}</div>
              <pre className="bg-green-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {g(modalData,'after_value') ? JSON.stringify(JSON.parse(g(modalData,'after_value')),null,2) : '—'}
              </pre>
            </div>
          </div>
          <ModalFooter><Btn onClick={() => setModal(null)}>{T.closeLabel}</Btn></ModalFooter>
        </DraggableModal>
      )}

    </div>
  )
}

// ── Code Manage Sub-page ───────────────────────────────────────
function CodeManagePage({ codes, codeDtls, setCodes, setCodeDtls, currentUser, T }: any) {
  const [tab, setTab] = useState<'floor'|'code'>('floor')
  const [selBuilding, setSelBuilding] = useState<string>('')
  const [selGroupId, setSelGroupId] = useState<number|null>(null)
  const [modal, setModal] = useState<string|null>(null)
  const [modalData, setModalData] = useState<any>({})

  // BUILDING 코드 목록
  const buildingGroup = codes.find((c:any) => g(c,'code_group') === 'BUILDING')
  const buildingCodes = buildingGroup
    ? codeDtls.filter((d:any) => g(d,'code_group_id') == g(buildingGroup,'code_group_id') && g(d,'use_yn') === 'Y')
    : []

  // 선택된 건물의 FLOOR 그룹 찾기 (없으면 null)
  const floorGroup = selBuilding
    ? codes.find((c:any) => g(c,'code_group') === `FLOOR_${selBuilding}`)
    : null
  const floorGroupId = floorGroup ? g(floorGroup,'code_group_id') : null

  // 해당 건물 층 코드 목록
  const floorDetails = floorGroupId
    ? codeDtls.filter((d:any) => g(d,'code_group_id') == floorGroupId)
        .sort((a:any,b:any) => (parseInt(g(a,'code'))||0)-(parseInt(g(b,'code'))||0))
    : []

  // 기타 공통코드 (BUILDING, FLOOR_* 제외)
  const otherCodes = codes.filter((c:any) =>
    g(c,'code_group') !== 'BUILDING' && !g(c,'code_group')?.startsWith('FLOOR_')
  )
  const selGroup = otherCodes.find((c:any) => g(c,'code_group_id') == selGroupId)
  const otherDetails = selGroupId
    ? codeDtls.filter((d:any) => g(d,'code_group_id') == selGroupId)
        .sort((a:any,b:any) => (g(a,'sort_order')||0)-(g(b,'sort_order')||0))
    : []

  // 건물 저장/수정
  async function saveBuilding() {
    if (!modalData.CODE || !modalData.CODE_NAME) { alert(T.alertRequired); return }
    const bgid = g(buildingGroup,'code_group_id')
    if (!bgid) { alert('BUILDING 코드 그룹이 없습니다.'); return }
    const method = modalData.CODE_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_ID ? `/api/codes/details/${modalData.CODE_ID}` : '/api/codes/details'
    const payload = { ...modalData, CODE_GROUP_ID: bgid, USE_YN: modalData.USE_YN||'Y', CREATED_BY: g(currentUser,'user_id')||'system', UPDATED_BY: g(currentUser,'user_id')||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) { alert(json.error||'Error'); return }
    setCodeDtls(await fetch('/api/codes/details').then(r=>r.json()))
    // 새 건물이면 FLOOR 그룹 자동 생성
    if (!modalData.CODE_ID) {
      const grpCode = `FLOOR_${modalData.CODE}`
      const exists = codes.find((c:any) => g(c,'code_group') === grpCode)
      if (!exists) {
        await fetch('/api/codes', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ CODE_GROUP: grpCode, CODE_GROUP_NAME: `${modalData.CODE_NAME} Floors`, USE_YN:'Y', CREATED_BY: g(currentUser,'user_id')||'system' }) })
        setCodes(await fetch('/api/codes').then(r=>r.json()))
      }
    }
    setModal(null)
  }

  // 층 저장/수정
  async function saveFloor() {
    if (!modalData.CODE || !modalData.CODE_NAME || !floorGroupId) { alert(T.alertRequired); return }
    const method = modalData.CODE_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_ID ? `/api/codes/details/${modalData.CODE_ID}` : '/api/codes/details'
    const payload = { ...modalData, CODE_GROUP_ID: floorGroupId, USE_YN: modalData.USE_YN||'Y', CREATED_BY: g(currentUser,'user_id')||'system', UPDATED_BY: g(currentUser,'user_id')||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) { alert(json.error||'Error'); return }
    setCodeDtls(await fetch('/api/codes/details').then(r=>r.json()))
    setModal(null)
  }

  async function deleteFloorOrBuilding(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/codes/details/${id}`, { method: 'DELETE' })
    setCodeDtls(await fetch('/api/codes/details').then(r=>r.json()))
    setModal(null)
  }

  // 기타 코드 그룹 저장
  async function saveGroup() {
    if (!modalData.CODE_GROUP || !modalData.CODE_GROUP_NAME) { alert(T.alertRequired); return }
    const method = modalData.CODE_GROUP_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_GROUP_ID ? `/api/codes/${modalData.CODE_GROUP_ID}` : '/api/codes'
    const payload = { CODE_GROUP: modalData.CODE_GROUP, CODE_GROUP_NAME: modalData.CODE_GROUP_NAME, USE_YN: modalData.USE_YN||'Y', CREATED_BY: g(currentUser,'user_id')||'system', UPDATED_BY: g(currentUser,'user_id')||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) { alert(json.error||'Error'); return }
    setCodes(await fetch('/api/codes').then(r=>r.json())); setModal(null)
  }

  // 기타 코드 상세 저장
  async function saveDetail() {
    if (!modalData.CODE || !modalData.CODE_NAME || !selGroupId) { alert(T.alertRequired); return }
    const method = modalData.CODE_ID ? 'PUT' : 'POST'
    const url    = modalData.CODE_ID ? `/api/codes/details/${modalData.CODE_ID}` : '/api/codes/details'
    const payload = { ...modalData, CODE_GROUP_ID: selGroupId, CREATED_BY: g(currentUser,'user_id')||'system', UPDATED_BY: g(currentUser,'user_id')||'system' }
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) { alert(json.error||'Error'); return }
    setCodeDtls(await fetch('/api/codes/details').then(r=>r.json())); setModal(null)
  }

  async function deleteDetail(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/codes/details/${id}`, { method: 'DELETE' })
    setCodeDtls(await fetch('/api/codes/details').then(r=>r.json()))
  }

  return (
    <div>
      <PageHeader title={T.codePageTitle} sub={T.codePageSub} />

      {/* Tab 전환 */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
        <button onClick={() => setTab('floor')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab==='floor' ? 'bg-[#F5A623] text-[#1A1A2E]' : 'text-gray-500 hover:text-gray-700'}`}>
          {T.codeTabFloor}
        </button>
        <button onClick={() => setTab('code')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab==='code' ? 'bg-[#F5A623] text-[#1A1A2E]' : 'text-gray-500 hover:text-gray-700'}`}>
          {T.codeTabOther}
        </button>
      </div>

      {/* ── 탭 1: 건물 / 층 관리 ── */}
      {tab === 'floor' && (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          {/* 건물 목록 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <span className="text-sm font-semibold">{T.codeBuildingList}</span>
              <Btn small primary onClick={() => { setModalData({ USE_YN:'Y', SORT_ORDER: buildingCodes.length + 1 }); setModal('building') }}>{T.codeBuildingAdd}</Btn>
            </div>
            <div className="divide-y divide-gray-50">
              {buildingCodes.length === 0
                ? <div className="text-center py-8 text-gray-300 text-sm">건물이 없습니다</div>
                : buildingCodes.map((b:any) => (
                  <div key={g(b,'code_id')}
                    onClick={() => setSelBuilding(g(b,'code'))}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-all
                      ${selBuilding===g(b,'code') ? 'bg-yellow-50 border-l-2 border-l-[#F5A623]' : 'hover:bg-gray-50'}`}>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{g(b,'code_name')}</div>
                      <div className="text-xs text-gray-400">{g(b,'code')}</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();setModalData({CODE_ID:g(b,'code_id'),CODE:g(b,'code'),CODE_NAME:g(b,'code_name'),SORT_ORDER:g(b,'sort_order'),USE_YN:g(b,'use_yn')});setModal('building')}}
                      className="text-xs px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200">✎</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* 층 목록 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <div>
                <span className="text-sm font-semibold">
                  {selBuilding
                    ? `${buildingCodes.find((b:any)=>g(b,'code')===selBuilding) ? g(buildingCodes.find((b:any)=>g(b,'code')===selBuilding),'code_name') : selBuilding} — 층 목록`
                    : '층 목록'}
                </span>
                {selBuilding && !floorGroup && (
                  <span className="ml-2 text-xs text-orange-500">{T.codeFloorNoGroup}</span>
                )}
              </div>
              <Btn small primary disabled={!selBuilding} onClick={() => { setModalData({ USE_YN:'Y', SORT_ORDER: floorDetails.length + 1 }); setModal('floor') }}>{T.codeFloorAdd}</Btn>
            </div>
            {!selBuilding
              ? <div className="text-center py-12 text-gray-300 text-sm">{T.codeSelectBuilding}</div>
              : (
                <table className="w-full">
                  <thead><tr>
                    {['층 코드',T.codeFloorName,T.codeSortOrder,'사용여부','관리'].map(h=><th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase bg-gray-50 border-b">{h}</th>)}
                  </tr></thead>
                  <tbody>{floorDetails.length===0
                    ? <tr><td colSpan={5} className="text-center py-8 text-gray-300 text-sm">{T.codeNoFloor}</td></tr>
                    : floorDetails.map((d:any) => (
                      <tr key={g(d,'code_id')} className="hover:bg-gray-50 border-b border-gray-50">
                        <td className="px-3 py-2"><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{g(d,'code')}</code></td>
                        <td className="px-3 py-2 font-medium text-sm">{g(d,'code_name')}</td>
                        <td className="px-3 py-2 text-sm">{g(d,'sort_order')||'—'}</td>
                        <td className="px-3 py-2">{g(d,'use_yn')==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-300 text-xs">○</span>}</td>
                        <td className="px-3 py-2">
                          <Btn small onClick={()=>{setModalData({CODE_ID:g(d,'code_id'),CODE:g(d,'code'),CODE_NAME:g(d,'code_name'),SORT_ORDER:g(d,'sort_order'),USE_YN:g(d,'use_yn')});setModal('floor')}}>수정</Btn>
                        </td>
                      </tr>
                    ))
                  }</tbody>
                </table>
              )
            }
          </div>
        </div>
      )}

      {/* ── 탭 2: 기타 공통코드 ── */}
      {tab === 'code' && (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <span className="text-sm font-semibold">코드 그룹</span>
              <Btn small primary onClick={() => { setModalData({USE_YN:'Y'}); setModal('group') }}>＋</Btn>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50">
              {otherCodes.map((grp:any) => (
                <div key={g(grp,'code_group_id')}
                  onClick={() => setSelGroupId(g(grp,'code_group_id'))}
                  className={`flex items-center px-4 py-2.5 cursor-pointer transition-all
                    ${selGroupId==g(grp,'code_group_id') ? 'bg-yellow-50 border-l-2 border-l-[#F5A623]' : 'hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{g(grp,'code_group')}</div>
                    <div className="text-xs text-gray-400">{g(grp,'code_group_name')}</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();setModalData({CODE_GROUP_ID:g(grp,'code_group_id'),CODE_GROUP:g(grp,'code_group'),CODE_GROUP_NAME:g(grp,'code_group_name'),USE_YN:g(grp,'use_yn')});setModal('group')}}
                    className="text-xs px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 shrink-0">✎</button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <span className="text-sm font-semibold">{selGroup ? g(selGroup,'code_group') : '코드 상세'}</span>
              <Btn small primary disabled={!selGroupId} onClick={() => { setModalData({USE_YN:'Y'}); setModal('detail') }}>{T.addLabel} 코드</Btn>
            </div>
            <table className="w-full">
              <thead><tr>{T.codeDtlThead.map((h:string)=><th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase bg-gray-50 border-b">{h}</th>)}</tr></thead>
              <tbody>{otherDetails.length===0
                ? <tr><td colSpan={5} className="text-center py-8 text-gray-300 text-sm">{selGroupId ? T.tableNoData : T.codeSelectGroup}</td></tr>
                : otherDetails.map((d:any) => (
                  <tr key={g(d,'code_id')} className="hover:bg-gray-50 border-b border-gray-50">
                    <td className="px-3 py-2"><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{g(d,'code')}</code></td>
                    <td className="px-3 py-2 font-medium text-sm">{g(d,'code_name')}</td>
                    <td className="px-3 py-2 text-sm">{g(d,'sort_order')||'—'}</td>
                    <td className="px-3 py-2">{g(d,'use_yn')==='Y'?<span className="text-green-600 text-xs font-semibold">●</span>:<span className="text-gray-300 text-xs">○</span>}</td>
                    <td className="px-3 py-2"><Btn small onClick={()=>{setModalData({CODE_ID:g(d,'code_id'),CODE:g(d,'code'),CODE_NAME:g(d,'code_name'),SORT_ORDER:g(d,'sort_order'),USE_YN:g(d,'use_yn')});setModal('detail')}}>수정</Btn></td>
                  </tr>
                ))
              }</tbody>
            </table>
          </div>
        </div>
      )}

      {/* 건물 모달 */}
      {modal === 'building' && (
        <DraggableModal title={modalData.CODE_ID ? `${T.modifyLabel} ${T.codeBuildingModal}` : `＋ ${T.codeBuildingModal}`} onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label="건물 코드 (영문대문자)" required><input className={inputCls} value={modalData.CODE||''} disabled={!!modalData.CODE_ID} placeholder="HEAD_QUARTER" onChange={e=>setModalData({...modalData,CODE:e.target.value.toUpperCase()})} /></FormGroup>
            <FormGroup label="건물명" required><input className={inputCls} value={modalData.CODE_NAME||''} placeholder="Head Quarter" onChange={e=>setModalData({...modalData,CODE_NAME:e.target.value})} /></FormGroup>
            <FormGroup label="정렬순서"><input type="number" className={inputCls} value={modalData.SORT_ORDER||''} onChange={e=>setModalData({...modalData,SORT_ORDER:parseInt(e.target.value)})} /></FormGroup>
            <FormGroup label="사용여부"><select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}><option value="Y">Y</option><option value="N">N</option></select></FormGroup>
            {!modalData.CODE_ID && <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">💡 건물 추가 시 층 그룹(FLOOR_코드)이 자동으로 생성됩니다.</div>}
          </div>
          <ModalFooter>
            {modalData.CODE_ID && <Btn danger onClick={()=>deleteFloorOrBuilding(modalData.CODE_ID)}>삭제</Btn>}
            <Btn onClick={()=>setModal(null)}>닫기</Btn>
            <Btn primary onClick={saveBuilding}>저장</Btn>
          </ModalFooter>
        </DraggableModal>
      )}

      {/* 층 모달 */}
      {modal === 'floor' && (
        <DraggableModal title={modalData.CODE_ID ? `${T.modifyLabel} ${T.codeFloorModal}` : `＋ ${T.codeFloorModal}`} onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label="층 코드 (숫자)" required><input className={inputCls} value={modalData.CODE||''} placeholder="3" onChange={e=>setModalData({...modalData,CODE:e.target.value})} /></FormGroup>
            <FormGroup label="층명" required><input className={inputCls} value={modalData.CODE_NAME||''} placeholder="Floor 3" onChange={e=>setModalData({...modalData,CODE_NAME:e.target.value})} /></FormGroup>
            <FormGroup label="정렬순서"><input type="number" className={inputCls} value={modalData.SORT_ORDER||''} onChange={e=>setModalData({...modalData,SORT_ORDER:parseInt(e.target.value)})} /></FormGroup>
            <FormGroup label="사용여부"><select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}><option value="Y">Y</option><option value="N">N</option></select></FormGroup>
          </div>
          <ModalFooter>
            {modalData.CODE_ID && <Btn danger onClick={()=>deleteFloorOrBuilding(modalData.CODE_ID)}>삭제</Btn>}
            <Btn onClick={()=>setModal(null)}>닫기</Btn>
            <Btn primary onClick={saveFloor}>저장</Btn>
          </ModalFooter>
        </DraggableModal>
      )}

      {/* 기타 코드 그룹 모달 */}
      {modal === 'group' && (
        <DraggableModal title={T.codeGroupModal} onClose={() => setModal(null)} size="sm">
          <div className="space-y-3">
            <FormGroup label={T.lblCgCode} required><input className={inputCls} value={modalData.CODE_GROUP||''} onChange={e=>setModalData({...modalData,CODE_GROUP:e.target.value})} /></FormGroup>
            <FormGroup label={T.lblCgName} required><input className={inputCls} value={modalData.CODE_GROUP_NAME||''} onChange={e=>setModalData({...modalData,CODE_GROUP_NAME:e.target.value})} /></FormGroup>
            <FormGroup label="사용여부"><select className={inputCls} value={modalData.USE_YN||'Y'} onChange={e=>setModalData({...modalData,USE_YN:e.target.value})}><option value="Y">Y</option><option value="N">N</option></select></FormGroup>
          </div>
          <ModalFooter><Btn onClick={()=>setModal(null)}>닫기</Btn><Btn primary onClick={saveGroup}>저장</Btn></ModalFooter>
        </DraggableModal>
      )}

      {/* 기타 코드 상세 모달 */}
      {modal === 'detail' && (
        <DraggableModal title={T.codeDetailModal} onClose={() => setModal(null)} size="sm">
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
        </DraggableModal>
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

// ── Draggable Modal ────────────────────────────────────────────
function DraggableModal({ title, onClose, children, size='md' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'sm'|'md' }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const startPos = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    startPos.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    e.preventDefault()
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({ x: startPos.current.px + e.clientX - startPos.current.mx, y: startPos.current.py + e.clientY - startPos.current.my })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-5">
      <div
        className={`bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto select-none ${size==='sm'?'max-w-md':'max-w-lg'}`}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, position: 'relative' }}>
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl cursor-grab active:cursor-grabbing">
          <span className="text-base font-bold">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4">×</button>
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
