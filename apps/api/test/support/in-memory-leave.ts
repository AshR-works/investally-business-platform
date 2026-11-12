import { Page } from '../../src/shared-kernel';
import { DEFAULT_LEAVE_SETTINGS, LeaveAdjustment, LeaveSettings, LeaveType, PublicHoliday } from '../../src/modules/hr/domain/leave-config';
import { LeaveAdjustmentRepository, LeaveConfigRepository, LeaveRequestListQuery, LeaveRequestRepository } from '../../src/modules/hr/domain/leave-repositories';
import { LeaveRequest } from '../../src/modules/hr/domain/leave-request';

/** Dépôt de demandes en mémoire : mêmes recherches que la base (chevauchement par jours inclus, somme par année). Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryLeaveRequests implements LeaveRequestRepository {
  readonly items: LeaveRequest[] = [];
  /** Employés dont la fiche a été verrouillée (dans l'ordre des appels). */
  readonly locks: string[] = [];

  async save(request: LeaveRequest) {
    if (!this.items.includes(request)) this.items.push(request);
  }
  async findById(id: string) { return this.items.find((r) => r.id === id) ?? null; }
  async findActiveOverlapping(employeeId: string, from: string, to: string, excludeId?: string) {
    return this.items.filter((r) => r.employeeId === employeeId && r.isActive && r.start <= to && r.end >= from && r.id !== excludeId);
  }
  async sumDays(employeeId: string, year: number, leaveTypeIds: readonly string[], excludeId?: string) {
    const rows = this.items.filter((r) => r.employeeId === employeeId && r.year === year && leaveTypeIds.includes(r.leaveTypeId) && r.isActive && r.id !== excludeId);
    return { approved: rows.filter((r) => r.status === 'APPROVED').reduce((n, r) => n + r.days, 0), pending: rows.filter((r) => r.status === 'PENDING').reduce((n, r) => n + r.days, 0) };
  }
  async list(q: LeaveRequestListQuery): Promise<Page<LeaveRequest>> {
    const rows = this.items
      .filter((r) => !q.employeeIds || q.employeeIds.includes(r.employeeId))
      .filter((r) => !q.status || r.status === q.status)
      .filter((r) => !q.year || r.year === q.year)
      .sort((a, b) => b.start.localeCompare(a.start) || a.id.localeCompare(b.id));
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
  }
  async approvedBetween(from: string, to: string, employeeIds?: readonly string[]) {
    return this.items.filter((r) => r.status === 'APPROVED' && r.start <= to && r.end >= from && (!employeeIds || employeeIds.includes(r.employeeId)));
  }
  async lockEmployee(employeeId: string) { this.locks.push(employeeId); }
}

/** Règles, types d'absence et jours fériés en mémoire (aucun jour férié au départ, comme la base). */
export class InMemoryLeaveConfig implements LeaveConfigRepository {
  current: LeaveSettings = { ...DEFAULT_LEAVE_SETTINGS };
  readonly typeList: LeaveType[] = [];
  readonly holidayList: PublicHoliday[] = [];

  async settings() { return { ...this.current }; }
  async saveSettings(settings: LeaveSettings) { this.current = { ...settings, version: settings.version + 1 }; }
  async types(includeInactive: boolean) { return this.typeList.filter((t) => includeInactive || t.active); }
  async findType(id: string) { return this.typeList.find((t) => t.id === id) ?? null; }
  async findTypeByCode(code: string) { return this.typeList.find((t) => t.code === code) ?? null; }
  async saveType(type: LeaveType) { if (!this.typeList.includes(type)) this.typeList.push(type); }
  async holidays(from: string, to: string) { return this.holidayList.filter((h) => h.day >= from && h.day <= to).sort((a, b) => a.day.localeCompare(b.day)); }
  async findHoliday(id: string) { return this.holidayList.find((h) => h.id === id) ?? null; }
  async findHolidayByDay(day: string) { return this.holidayList.find((h) => h.day === day) ?? null; }
  async addHoliday(holiday: PublicHoliday) { this.holidayList.push(holiday); }
  async removeHoliday(id: string) { const index = this.holidayList.findIndex((h) => h.id === id); if (index >= 0) this.holidayList.splice(index, 1); }
}

export class InMemoryLeaveAdjustments implements LeaveAdjustmentRepository {
  readonly items: LeaveAdjustment[] = [];
  async add(adjustment: LeaveAdjustment) { this.items.push(adjustment); }
  async forYear(employeeId: string, year: number) { return this.items.filter((a) => a.employeeId === employeeId && a.year === year); }
  async total(employeeId: string, year: number) { return this.items.filter((a) => a.employeeId === employeeId && a.year === year).reduce((n, a) => n + a.days, 0); }
}
