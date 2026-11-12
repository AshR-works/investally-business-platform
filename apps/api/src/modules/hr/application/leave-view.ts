import { LeaveAdjustment, LeaveSettings, LeaveType, PublicHoliday } from '../domain/leave-config';
import { LeaveBalance } from '../domain/leave-calendar';
import { LeaveRequest } from '../domain/leave-request';

/** Demande d'absence telle que l'API l'expose. Aucune donnée de santé : le motif est libre et facultatif. */
export interface LeaveRequestView {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeLabel: string;
  start: string;
  end: string;
  /** La première journée commence l'après-midi. */
  startHalf: boolean;
  /** La dernière journée s'arrête à midi. */
  endHalf: boolean;
  days: number;
  /** `PENDING`, `APPROVED`, `REJECTED` ou `CANCELLED`. */
  status: string;
  note: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour décider ou annuler. */
  version: number;
}

export function toLeaveRequestView(request: LeaveRequest, names: { employee: string; type: string }): LeaveRequestView {
  return {
    id: request.id,
    employeeId: request.employeeId,
    employeeName: names.employee,
    leaveTypeId: request.leaveTypeId,
    leaveTypeLabel: names.type,
    start: request.start,
    end: request.end,
    startHalf: request.startHalf,
    endHalf: request.endHalf,
    days: request.days,
    status: request.status,
    note: request.note,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    decisionNote: request.decisionNote,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    cancelReason: request.cancelReason,
    createdAt: request.createdAt.toISOString(),
    version: request.version,
  };
}

export interface LeaveTypeView {
  id: string;
  code: string;
  label: string;
  deductsBalance: boolean;
  requiresApproval: boolean;
  maxDaysPerRequest: number | null;
  active: boolean;
  sortOrder: number;
  version: number;
}

export const toLeaveTypeView = (t: LeaveType): LeaveTypeView => ({
  id: t.id, code: t.code, label: t.label, deductsBalance: t.deductsBalance, requiresApproval: t.requiresApproval,
  maxDaysPerRequest: t.maxDaysPerRequest, active: t.active, sortOrder: t.sortOrder, version: t.version,
});

export interface LeaveSettingsView {
  accrualDaysPerMonth: number;
  countsSaturday: boolean;
  allowHalfDays: boolean;
  allowNegativeBalance: boolean;
  version: number;
}

export const toLeaveSettingsView = (s: LeaveSettings): LeaveSettingsView => ({ ...s });

export interface HolidayView {
  id: string;
  day: string;
  label: string;
}

export const toHolidayView = (h: PublicHoliday): HolidayView => ({ id: h.id, day: h.day, label: h.label });

export interface LeaveBalanceView extends LeaveBalance {
  employeeId: string;
  employeeName: string;
}

export interface AdjustmentView {
  id: string;
  employeeId: string;
  year: number;
  days: number;
  reason: string;
  createdAt: string;
}

export const toAdjustmentView = (a: LeaveAdjustment): AdjustmentView => ({
  id: a.id, employeeId: a.employeeId, year: a.year, days: a.days, reason: a.reason, createdAt: a.createdAt.toISOString(),
});

/** Une absence validée dans le calendrier d'équipe. Le type n'y figure que pour ceux qui ont le droit de le voir : un collègue voit seulement « absent ». */
export interface CalendarEntry {
  requestId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  start: string;
  end: string;
  startHalf: boolean;
  endHalf: boolean;
  /** Libellé du type d'absence ; `null` pour un collègue (ni type, ni motif). */
  leaveTypeLabel: string | null;
}

export interface TeamCalendarView {
  from: string;
  to: string;
  department: string | null;
  entries: CalendarEntry[];
  holidays: HolidayView[];
}
