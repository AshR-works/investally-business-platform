import { Attendance, AttendanceStatus } from '../domain/attendance';

// Pas de verrou optimiste sur la présence (comme `hr.presence_declarations`, ADR-0015) : la dernière saisie gagne, l'audit garde l'historique ;
// `version` existe en base (travail interne de la persistance) mais n'est délibérément pas exposée ici, pour ne pas laisser croire à un verrou.
export interface AttendanceView {
  id: string;
  enrollmentId: string;
  day: string;
  status: AttendanceStatus;
  recordedByUserId: string;
}

export const toAttendanceView = (attendance: Attendance): AttendanceView => ({
  id: attendance.id, enrollmentId: attendance.enrollmentId, day: attendance.day, status: attendance.status, recordedByUserId: attendance.recordedByUserId,
});

/** Une ligne par inscrit confirmé : son nom, et ses présences déjà saisies (les jours sans entrée n'ont pas encore été saisis). */
export interface AttendanceSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  entries: { day: string; status: AttendanceStatus }[];
}

export interface AttendanceSheetView {
  sessionId: string;
  sessionStatus: string;
  /** Un jour de cours par séance, du début à la fin de la session (lundi–vendredi). */
  days: string[];
  rows: AttendanceSheetRow[];
  /** La session n'est pas clôturée : la saisie reste possible (sinon figée, S7). */
  canRecord: boolean;
}
