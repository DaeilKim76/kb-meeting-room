export type Lang = 'ko' | 'en' | 'kh'
export type YN = 'Y' | 'N'
export type AuthType = 'ADMIN' | 'APPROVER'
export type ReservationStatus = 'REQUESTED' | 'RESERVED' | 'REJECTED' | 'CANCELED'
export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE'

export interface User {
  USER_ID: string
  USER_NAME: string
  EMAIL?: string
  DEPT_NAME?: string
  USE_YN: YN
  IS_SYS_ADMIN: YN
  LAST_LOGIN_AT?: string
  CREATED_AT: string
  UPDATED_AT?: string
}

export interface CommonCode {
  CODE_GROUP_ID: number
  CODE_GROUP: string
  CODE_GROUP_NAME: string
  USE_YN: YN
  CREATED_BY: string
  CREATED_AT: string
}

export interface CommonCodeDtl {
  CODE_ID: number
  CODE_GROUP_ID: number
  CODE: string
  CODE_NAME: string
  REF_VALUE1?: string
  SORT_ORDER?: number
  USE_YN: YN
  CREATED_BY: string
  CREATED_AT: string
}

export interface MeetingRoom {
  ROOM_ID: number
  BUILDING_CODE: string
  FLOOR_CODE: string
  ROOM_CODE: string
  ROOM_NAME: string
  CAPACITY?: number
  APPROVAL_REQUIRED_YN: YN
  USE_YN: YN
  REMARK?: string
  CREATED_BY: string
  CREATED_AT: string
  UPDATED_BY?: string
  UPDATED_AT?: string
}

export interface RoomUserAuth {
  ROOM_AUTH_ID: number
  ROOM_ID: number
  USER_ID: string
  AUTH_TYPE: AuthType
  USE_YN: YN
  CREATED_BY: string
  CREATED_AT: string
  // joined
  USER_NAME?: string
  DEPT_NAME?: string
  EMAIL?: string
  ROOM_NAME?: string
}

export interface Reservation {
  RESERVATION_ID: number
  ROOM_ID: number
  RESERVATION_DATE: string
  START_TIME: string
  END_TIME: string
  ALL_DAY_YN: YN
  TITLE: string
  PARTICIPANT_COUNT?: number
  STATUS_CODE: ReservationStatus
  REQUEST_USER_ID: string
  REQUEST_DATETIME: string
  APPROVED_DATETIME?: string
  REJECT_REASON?: string
  PERIOD_RESERVATION_YN: YN
  PERIOD_GROUP_ID?: number
  CANCEL_YN: YN
  CREATED_BY: string
  CREATED_AT: string
  UPDATED_BY?: string
  UPDATED_AT?: string
  // joined
  ROOM_NAME?: string
  BUILDING_CODE?: string
  FLOOR_CODE?: string
  APPROVAL_REQUIRED_YN?: YN
  REQUEST_USER_NAME?: string
}

export interface MeetingApproval {
  APPROVAL_ID: number
  RESERVATION_ID: number
  APPROVER_USER_ID: string
  ACTION: 'APPROVED' | 'REJECTED' | 'CANCELED'
  ACTION_DATETIME: string
  ACTION_COMMENT?: string
  APPROVER_NAME?: string
}

export interface ReservationHistory {
  HIS_ID: number
  RESERVATION_ID: number
  ACTION_TYPE: ActionType
  ACTION_USER_ID: string
  ACTION_DATETIME: string
  BEFORE_VALUE?: string
  AFTER_VALUE?: string
  REMARK?: string
  ACTION_USER_NAME?: string
}

// UI helpers
export const STATUS_BADGE: Record<ReservationStatus, { ko: string; en: string; kh: string; cls: string }> = {
  REQUESTED: { ko: '예약신청', en: 'Requested', kh: 'កំពុងរង់ចាំ', cls: 'bg-yellow-100 text-yellow-800' },
  RESERVED:  { ko: '예약 중',  en: 'Reserved',  kh: 'បានអនុម័ត',  cls: 'bg-green-100 text-green-800'  },
  REJECTED:  { ko: '거절',     en: 'Rejected',  kh: 'បានបដិសេធ',  cls: 'bg-red-100 text-red-800'      },
  CANCELED:  { ko: '취소',     en: 'Canceled',  kh: 'បានលុបចោល',  cls: 'bg-gray-100 text-gray-500'    },
}
