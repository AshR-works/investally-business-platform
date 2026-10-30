import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext, Visibility } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Contact, ContactRole } from '../domain/contact';
import { CONTACT_REPOSITORY, ContactRepository } from '../domain/contact-repository';
import { ContactView, toContactView } from './contact-view';

const NOT_FOUND_COMPANY = 'Entreprise introuvable';
const NOT_FOUND_CONTACT = 'Contact introuvable';

/** Entreprise visible de l'appelant pour cette permission, sinon « introuvable » (même réponse qu'un identifiant inexistant). */
async function companyInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company> {
  const company = await companies.findById(id);
  if (!company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_COMPANY);
  return company;
}

/** Contact et entreprise visibles de l'appelant (la visibilité d'un contact suit celle de son entreprise). */
async function contactInScope(
  contacts: ContactRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ contact: Contact; company: Company }> {
  const contact = await contacts.findById(id);
  const company = contact ? await companies.findById(contact.companyId) : null;
  if (!contact || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_CONTACT);
  return { contact, company };
}

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses contacts ne sont plus modifiables");
}

/**
 * Un doublon probable (même entreprise, même nom ou même e-mail) est signalé par un conflit ; `allowDuplicate` permet de
 * créer quand même (l'utilisateur a vu l'avertissement) : on propose la fiche existante plutôt que d'interdire.
 */
async function assertNoDuplicate(contacts: ContactRepository, contact: Contact, allowDuplicate: boolean | undefined, excludeId?: string): Promise<void> {
  if (allowDuplicate) return;
  const duplicates = await contacts.findDuplicates({ companyId: contact.companyId, nameKey: contact.nameKey, emailKey: contact.emailKey, excludeId });
  if (duplicates.length > 0) {
    const d = duplicates[0];
    throw new DomainError('CONFLICT', `Un contact « ${d.firstName} ${d.lastName} » existe déjà dans cette entreprise (même nom ou même e-mail)`);
  }
}

export interface RegisterContactCommand {
  companyId: string;
  lastName: string;
  firstName: string;
  role?: string;
  email?: string | null;
  phone?: string | null;
  allowDuplicate?: boolean;
  access: AccessContext;
  actor: ActorContext;
}

/** Créer un contact : l'entreprise doit être dans la portée de l'appelant et non archivée ; doublon signalé ; audit. */
@Injectable()
export class RegisterContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterContactCommand): Promise<ContactView> {
    return this.unitOfWork.run(async () => {
      const company = await companyInScope(this.companies, command.companyId, command.access, 'bd.contact.create');
      assertWritable(company);
      const contact = Contact.register({ ...command, id: this.ids.next(), now: this.clock.now() });
      await assertNoDuplicate(this.contacts, contact, command.allowDuplicate);
      await this.contacts.save(contact);
      const view = toContactView(contact, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Contact', entityId: contact.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface UpdateContactCommand {
  id: string;
  version: number;
  lastName?: string;
  firstName?: string;
  role?: string;
  email?: string | null;
  phone?: string | null;
  allowDuplicate?: boolean;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier un contact : portée de son entreprise, version lue, doublon, entreprise non archivée ; audit avant/après. */
@Injectable()
export class UpdateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateContactCommand): Promise<ContactView> {
    return this.unitOfWork.run(async () => {
      const { contact, company } = await contactInScope(this.contacts, this.companies, command.id, command.access, 'bd.contact.update');
      assertWritable(company);
      if (contact.version !== command.version) {
        throw new DomainError('CONFLICT', 'Le contact a été modifié par un autre utilisateur : rechargez-le avant de le modifier');
      }
      const before = toContactView(contact, company.name.value);
      contact.update(command);
      await assertNoDuplicate(this.contacts, contact, command.allowDuplicate, contact.id);
      await this.contacts.save(contact);
      const after = toContactView((await this.contacts.findById(contact.id)) ?? contact, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Contact', entityId: contact.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Supprimer un contact (suppression logique) : droit de suppression et portée de son entreprise ; audit. */
@Injectable()
export class DeleteContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { id: string; access: AccessContext; actor: ActorContext }): Promise<void> {
    await this.unitOfWork.run(async () => {
      const { contact, company } = await contactInScope(this.contacts, this.companies, command.id, command.access, 'bd.contact.delete');
      assertWritable(company);
      await this.contacts.remove(contact.id);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Contact', entityId: contact.id, action: AuditAction.Delete, oldValue: { ...toContactView(contact, company.name.value) } });
    });
  }
}

const MAX_PAGE_SIZE = 100;

/** Lecture d'un contact : hors de la portée de son entreprise, il est « introuvable ». */
@Injectable()
export class GetContactHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<ContactView> {
    const { contact, company } = await contactInScope(this.contacts, this.companies, query.id, query.access, 'bd.contact.read');
    return toContactView(contact, company.name.value);
  }
}

/** Liste paginée des contacts visibles ; filtrer par entreprise exige que cette entreprise soit dans la portée (sinon « introuvable »). */
@Injectable()
export class ListContactsHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { page: number; pageSize: number; search?: string; companyId?: string; role?: string; visibility: Visibility; access: AccessContext }): Promise<Page<ContactView>> {
    if (query.companyId) await companyInScope(this.companies, query.companyId, query.access, 'bd.contact.read');
    const role = query.role && Object.values(ContactRole).includes(query.role as ContactRole) ? (query.role as ContactRole) : undefined;
    const result = await this.contacts.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      search: query.search?.trim() || undefined,
      companyId: query.companyId,
      role,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toContactView(i.contact, i.companyName)) };
  }
}
