import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { normalizeEmail, normalizePhone } from '../../../shared-kernel/contact-format';

/** Un employé est actif ou archivé : l'archivage (sortie du personnel) est réversible, il ne supprime rien. */
export enum EmployeeStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
}

export interface EmployeeProps {
  id: string;
  /** Matricule de saisie libre (lettres, chiffres, `. - / _`), en majuscules ; unique s'il est renseigné. */
  matricule: string | null;
  lastName: string;
  firstName: string;
  jobTitle: string;
  department: string;
  /** Responsable hiérarchique (donnée RH). Ne modifie jamais la hiérarchie des comptes (`users.manager_id`, D58). */
  managerEmployeeId: string | null;
  /** Compte de la personne (0 ou 1) : référence inter-contextes, sans clé étrangère. */
  userId: string | null;
  workEmail: string | null;
  workPhone: string | null;
  /** Date d'entrée, « AAAA-MM-JJ ». */
  hiredOn: string;
  /** Date de sortie, « AAAA-MM-JJ », seulement pour un employé archivé. */
  leftOn: string | null;
  status: EmployeeStatus;
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  version: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MATRICULE = /^[A-Z0-9][A-Z0-9._/-]{0,29}$/;

function isoDate(raw: string | undefined, label: string): string {
  const text = (raw ?? '').trim();
  const m = DATE.exec(text);
  const valid = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
  if (!valid) throw new DomainError('VALIDATION', `${label} doit être une date valide (AAAA-MM-JJ)`);
  return text;
}

function text(raw: string | undefined, label: string, max: number): string {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return value;
}

/** Matricule facultatif : vide = aucun ; sinon lettres, chiffres et `. - / _`, 30 caractères au plus, mis en majuscules. */
function matriculeOf(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toUpperCase();
  if (value === '') return null;
  if (!MATRICULE.test(value)) throw new DomainError('VALIDATION', 'Le matricule comporte des lettres, des chiffres et . - / _ (30 caractères au plus)');
  return value;
}

const reasonOf = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (value.length > 500) throw new DomainError('VALIDATION', 'Le motif ne peut dépasser 500 caractères');
  return value === '' ? null : value;
};

/**
 * Employé d'Investally : identité **professionnelle** seulement (poste, service, responsable, contacts professionnels, dates d'entrée et de
 * sortie). Jamais de salaire, de pièce d'identité, d'adresse personnelle ni de date de naissance (D57). Distinct du compte d'accès (D58).
 */
export class Employee extends AggregateRoot {
  private constructor(private props: EmployeeProps) {
    super();
  }

  static register(input: {
    id: string; matricule?: string | null; lastName: string; firstName: string; jobTitle: string; department: string; managerEmployeeId?: string | null;
    userId?: string | null; workEmail?: string | null; workPhone?: string | null; hiredOn: string; now: Date;
  }): Employee {
    if (input.managerEmployeeId && input.managerEmployeeId === input.id) throw new DomainError('VALIDATION', 'Un employé ne peut pas être son propre responsable');
    return new Employee({
      id: input.id,
      matricule: matriculeOf(input.matricule),
      lastName: text(input.lastName, 'Le nom', 100),
      firstName: text(input.firstName, 'Le prénom', 100),
      jobTitle: text(input.jobTitle, 'Le poste', 150),
      department: text(input.department, 'Le service', 100),
      managerEmployeeId: input.managerEmployeeId || null,
      userId: input.userId || null,
      workEmail: normalizeEmail(input.workEmail),
      workPhone: normalizePhone(input.workPhone, { required: false }),
      hiredOn: isoDate(input.hiredOn, 'La date d\'entrée'),
      leftOn: null,
      status: EmployeeStatus.Active,
      archivedAt: null,
      archiveReason: null,
      createdAt: input.now,
      version: 1,
    });
  }

  /** Reconstitution depuis la persistance. */
  static rehydrate(props: EmployeeProps): Employee {
    return new Employee(props);
  }

  /**
   * Modifie la fiche (absent = inchangé, chaîne vide = champ facultatif effacé ; `managerEmployeeId` ou `userId` à `null` = retiré). Tout ou rien en cas
   * d'erreur. Un employé archivé est gelé : il se réactive d'abord.
   */
  update(changes: {
    matricule?: string | null; lastName?: string; firstName?: string; jobTitle?: string; department?: string; managerEmployeeId?: string | null;
    userId?: string | null; workEmail?: string | null; workPhone?: string | null; hiredOn?: string;
  }): void {
    if (this.isArchived) throw new DomainError('CONFLICT', "L'employé est archivé : réactivez-le avant de le modifier");
    const next = { ...this.props };
    if (changes.matricule !== undefined) next.matricule = matriculeOf(changes.matricule);
    if (changes.lastName !== undefined) next.lastName = text(changes.lastName, 'Le nom', 100);
    if (changes.firstName !== undefined) next.firstName = text(changes.firstName, 'Le prénom', 100);
    if (changes.jobTitle !== undefined) next.jobTitle = text(changes.jobTitle, 'Le poste', 150);
    if (changes.department !== undefined) next.department = text(changes.department, 'Le service', 100);
    if (changes.managerEmployeeId !== undefined) {
      next.managerEmployeeId = changes.managerEmployeeId || null;
      if (next.managerEmployeeId === this.props.id) throw new DomainError('VALIDATION', 'Un employé ne peut pas être son propre responsable');
    }
    if (changes.userId !== undefined) next.userId = changes.userId || null;
    if (changes.workEmail !== undefined) next.workEmail = normalizeEmail(changes.workEmail);
    if (changes.workPhone !== undefined) next.workPhone = normalizePhone(changes.workPhone, { required: false });
    if (changes.hiredOn !== undefined) next.hiredOn = isoDate(changes.hiredOn, 'La date d\'entrée');
    this.props = next;
  }

  /** Archive l'employé (sortie du personnel, réversible). La date de sortie (défaut : aujourd'hui) ne précède pas la date d'entrée ; le motif est facultatif. */
  archive(input: { leftOn?: string | null; reason?: string | null; now: Date }): void {
    if (this.isArchived) throw new DomainError('CONFLICT', "L'employé est déjà archivé");
    const leftOn = input.leftOn ? isoDate(input.leftOn, 'La date de sortie') : input.now.toISOString().slice(0, 10);
    if (leftOn < this.props.hiredOn) throw new DomainError('VALIDATION', "La date de sortie ne peut pas précéder la date d'entrée");
    this.props = { ...this.props, status: EmployeeStatus.Archived, archivedAt: input.now, archiveReason: reasonOf(input.reason), leftOn };
  }

  /** Réactive un employé archivé : il redevient modifiable, sans date de sortie ni motif. */
  reactivate(): void {
    if (!this.isArchived) throw new DomainError('CONFLICT', "L'employé n'est pas archivé");
    this.props = { ...this.props, status: EmployeeStatus.Active, archivedAt: null, archiveReason: null, leftOn: null };
  }

  get id(): string { return this.props.id; }
  get matricule(): string | null { return this.props.matricule; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get fullName(): string { return `${this.props.firstName} ${this.props.lastName}`; }
  get jobTitle(): string { return this.props.jobTitle; }
  get department(): string { return this.props.department; }
  get managerEmployeeId(): string | null { return this.props.managerEmployeeId; }
  get userId(): string | null { return this.props.userId; }
  get workEmail(): string | null { return this.props.workEmail; }
  get workPhone(): string | null { return this.props.workPhone; }
  get hiredOn(): string { return this.props.hiredOn; }
  get leftOn(): string | null { return this.props.leftOn; }
  get status(): EmployeeStatus { return this.props.status; }
  get isArchived(): boolean { return this.props.status === EmployeeStatus.Archived; }
  get archivedAt(): Date | null { return this.props.archivedAt; }
  get archiveReason(): string | null { return this.props.archiveReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
