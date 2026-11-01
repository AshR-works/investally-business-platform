import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { InMemoryAppointments } from '../../../../test/support/in-memory-appointments';
import { InMemoryContacts } from '../../../../test/support/in-memory-contacts';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Contact } from '../domain/contact';
import { Offer } from '../domain/offer';
import { GetAppointmentHandler, ListAppointmentsHandler, PlanAppointmentUseCase, TransitionAppointmentUseCase, UpdateAppointmentUseCase } from './appointment-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'am1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-04T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const contacts = new InMemoryContacts(companies);
  const offers = new InMemoryOffers(companies);
  const appointments = new InMemoryAppointments(companies, contacts, offers);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `ap-${++seq}` };
  const company = (id: string, owner: string, archived = false) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    if (archived) c.archive();
    companies.items.push(c);
    return c;
  };
  const contact = (id: string, companyId: string) => {
    const k = Contact.register({ id, companyId, lastName: 'Fotso', firstName: 'Marie', now });
    contacts.items.push(k);
    return k;
  };
  const offer = (id: string, companyId: string) => {
    const o = Offer.create({ id, reference: `OFF-2026-000${offers.items.length + 1}`, companyId, subject: 'Formation', amount: '100000', now });
    offers.items.push(o);
    return o;
  };
  return {
    companies, appointments, audit, company, contact, offer,
    plan: new PlanAppointmentUseCase(appointments, companies, contacts, offers, recorder, unitOfWork, clock, ids),
    update: new UpdateAppointmentUseCase(appointments, companies, contacts, offers, recorder, unitOfWork, clock),
    transition: new TransitionAppointmentUseCase(appointments, companies, contacts, offers, recorder, unitOfWork, clock),
    get: new GetAppointmentHandler(appointments, companies, contacts, offers, clock),
    list: new ListAppointmentsHandler(appointments, companies, offers, clock),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const base = { type: 'FINANCE_DIRECTOR', startsAt: '2026-11-10T09:00:00Z', location: 'Siège', note: 'Présenter l’offre' };
const window = { from: '2026-11-01T00:00:00Z', to: '2026-12-01T00:00:00Z', page: 1, pageSize: 100 };

describe('Rendez-vous — planification', () => {
  it('planifie avec contact et offre de l’entreprise : champs conservés, organisateur = appelant, audit', async () => {
    const w = build(); w.company('c1', 'am1'); w.contact('k1', 'c1'); w.offer('o1', 'c1');
    const view = await w.plan.execute({ ...base, companyId: 'c1', contactId: 'k1', offerId: 'o1', access: am1, actor });
    expect(view).toMatchObject({
      companyName: 'Société c1', contactName: 'Marie Fotso', offerReference: 'OFF-2026-0001', organizerUserId: 'am1', status: 'PLANNED',
      durationMinutes: 60, endsAt: '2026-11-10T10:00:00.000Z', reportDue: false, version: 1,
    });
    expect(view.conflicts).toBeUndefined();
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Appointment', entityId: view.id });
  });
  it('un contact d’une autre entreprise est refusé, une offre d’une autre entreprise aussi, sans rien écrire', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am1'); w.contact('k2', 'c2'); w.offer('o2', 'c2');
    await expect(w.plan.execute({ ...base, companyId: 'c1', contactId: 'k2', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('contact') });
    await expect(w.plan.execute({ ...base, companyId: 'c1', offerId: 'o2', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('offre') });
    await expect(w.plan.execute({ ...base, companyId: 'c1', contactId: 'inconnu', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.appointments.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
  it('entreprise hors portée ou inexistante : introuvable ; entreprise archivée : refus', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c9', 'am1', true);
    await expect(w.plan.execute({ ...base, companyId: 'c1', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.plan.execute({ ...base, companyId: 'zzz', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.plan.execute({ ...base, companyId: 'c9', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.appointments.items).toHaveLength(0);
  });
  it('le Responsable commercial planifie pour son équipe ; la Direction (lecture seule) ne peut pas', async () => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.plan.execute({ ...base, companyId: 'c1', access: chef, actor })).resolves.toMatchObject({ organizerUserId: 'chef' });
    await expect(w.plan.execute({ ...base, companyId: 'c1', access: as(RoleCode.Direction, 'dir'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('type inconnu et heure passée sont refusés', async () => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.plan.execute({ ...base, type: 'GOUTER', companyId: 'c1', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.plan.execute({ ...base, startsAt: '2026-11-03T09:00:00Z', companyId: 'c1', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('un conflit d’horaire AVERTIT sans bloquer ; bout à bout, pas de conflit ; un autre organisateur non plus', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    const first = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    const overlap = await w.plan.execute({ ...base, startsAt: '2026-11-10T09:30:00Z', companyId: 'c1', access: am1, actor });
    expect(overlap.conflicts).toEqual([expect.objectContaining({ id: first.id, companyName: 'Société c1', startsAt: '2026-11-10T09:00:00.000Z' })]);
    expect(w.appointments.items).toHaveLength(2);
    const adjacent = await w.plan.execute({ ...base, startsAt: '2026-11-10T10:30:00Z', companyId: 'c1', access: am1, actor });
    expect(adjacent.conflicts).toBeUndefined();
    const inside = await w.plan.execute({ ...base, startsAt: '2026-11-10T10:15:00Z', durationMinutes: 30, companyId: 'c1', access: am1, actor });
    expect(inside.conflicts?.map((c) => c.id)).toEqual([overlap.id, adjacent.id]);
    const otherOrganizer = await w.plan.execute({ ...base, companyId: 'c2', access: am2, actor });
    expect(otherOrganizer.conflicts).toBeUndefined();
    const endToEnd = await w.plan.execute({ ...base, startsAt: '2026-11-10T12:30:00Z', companyId: 'c1', access: am1, actor });
    expect(endToEnd.conflicts).toBeUndefined();
  });
  it('un rendez-vous annulé ne crée pas de conflit', async () => {
    const w = build(); w.company('c1', 'am1');
    const first = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await w.transition.execute({ id: first.id, version: 1, transition: 'cancel', text: 'Annulé par le client', access: am1, actor });
    const second = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    expect(second.conflicts).toBeUndefined();
  });
});

describe('Rendez-vous — visites et droits', () => {
  it('une visite exige le droit « visite » (le chargé de compte l’a), l’annule avec le droit de modifier', async () => {
    const w = build(); w.company('c1', 'am1');
    const visit = await w.plan.execute({ ...base, type: 'VISIT', companyId: 'c1', access: am1, actor });
    const cancelled = await w.transition.execute({ id: visit.id, version: 1, transition: 'cancel', text: 'Visite reportée sine die', access: am1, actor });
    expect(cancelled.status).toBe('CANCELLED');
  });
  it('un rôle sans droit de visite ne peut ni planifier ni voir les visites', async () => {
    const w = build(); w.company('c1', 'am1');
    const access = { ...am1, grants: am1.grants.filter((g) => !g.permission.startsWith('bd.visit')) } as AccessContext;
    await expect(w.plan.execute({ ...base, type: 'VISIT', companyId: 'c1', access, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const visit = await w.plan.execute({ ...base, type: 'VISIT', companyId: 'c1', access: am1, actor });
    await w.plan.execute({ ...base, startsAt: '2026-11-11T09:00:00Z', companyId: 'c1', access: am1, actor });
    const list = await w.list.execute({ ...window, access });
    expect(list.items.map((i) => i.type)).toEqual(['FINANCE_DIRECTOR']);
    await expect(w.get.execute({ id: visit.id, access })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.transition.execute({ id: visit.id, version: 1, transition: 'cancel', text: 'Sans droit', access, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Rendez-vous — modification', () => {
  it('modifie lieu, durée, contact ; retire le contact avec null ; audit avant/après ; version suivante', async () => {
    const w = build(); w.company('c1', 'am1'); w.contact('k1', 'c1');
    const view = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    const updated = await w.update.execute({ id: view.id, version: 1, location: 'Visioconférence', durationMinutes: 30, contactId: 'k1', access: am1, actor });
    expect(updated).toMatchObject({ location: 'Visioconférence', durationMinutes: 30, contactName: 'Marie Fotso' });
    const last = w.audit[w.audit.length - 1]!;
    expect(last).toMatchObject({ action: AuditAction.Update, entityId: view.id });
    expect((last.oldValue as { location: string }).location).toBe('Siège');
    expect((last.newValue as { location: string }).location).toBe('Visioconférence');
    const removed = await w.update.execute({ id: view.id, version: 1, contactId: null, access: am1, actor });
    expect(removed).toMatchObject({ contactId: null, contactName: null });
  });
  it('contact d’une autre entreprise refusé ; durée hors limites refusée ; version périmée : conflit ; hors portée : introuvable', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am1'); w.contact('k2', 'c2');
    const view = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await expect(w.update.execute({ id: view.id, version: 1, contactId: 'k2', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.update.execute({ id: view.id, version: 1, durationMinutes: 5, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.update.execute({ id: view.id, version: 7, note: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: view.id, version: 1, note: 'Piraté', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.appointments.items[0]!.note).toBe('Présenter l’offre');
  });
  it('un allongement qui chevauche un autre rendez-vous avertit', async () => {
    const w = build(); w.company('c1', 'am1');
    const first = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await w.plan.execute({ ...base, startsAt: '2026-11-10T10:30:00Z', companyId: 'c1', access: am1, actor });
    const longer = await w.update.execute({ id: first.id, version: 1, durationMinutes: 120, access: am1, actor });
    expect(longer.conflicts).toHaveLength(1);
  });
  it('entreprise archivée : plus de modification', async () => {
    const w = build(); const c = w.company('c1', 'am1');
    const view = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    c.archive();
    await expect(w.update.execute({ id: view.id, version: 1, note: 'Tard', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Rendez-vous — report, tenue, annulation', () => {
  it('reporte avec motif : nouvelle heure, compteur, conflit signalé, audit', async () => {
    const w = build(); w.company('c1', 'am1');
    const a = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await w.plan.execute({ ...base, startsAt: '2026-11-12T09:00:00Z', companyId: 'c1', access: am1, actor });
    const moved = await w.transition.execute({ id: a.id, version: 1, transition: 'postpone', startsAt: '2026-11-12T09:30:00Z', text: 'Le DAF est en déplacement', access: am1, actor });
    expect(moved).toMatchObject({ status: 'PLANNED', startsAt: '2026-11-12T09:30:00.000Z', postponements: 1, lastPostponeReason: 'Le DAF est en déplacement' });
    expect(moved.conflicts).toHaveLength(1);
  });
  it('report sans motif ou vers le passé : refusé, rien ne bouge', async () => {
    const w = build(); w.company('c1', 'am1');
    const a = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'postpone', startsAt: '2026-11-12T09:00:00Z', text: '', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'postpone', startsAt: '2026-11-01T09:00:00Z', text: 'Motif valable', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.appointments.items[0]!.startsAt.toISOString()).toBe('2026-11-10T09:00:00.000Z');
  });
  it('tenu avant son heure : refusé ; la tenue exige le droit de modifier', async () => {
    const w = build(); w.company('c1', 'am1');
    const a = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'hold', text: 'Compte rendu', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'hold', text: 'Compte rendu', access: as(RoleCode.Direction, 'dir'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('annule avec motif, définitif ; le Responsable commercial annule pour son équipe', async () => {
    const w = build(); w.company('c1', 'am1');
    const a = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'cancel', text: '', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const cancelled = await w.transition.execute({ id: a.id, version: 1, transition: 'cancel', text: 'Client indisponible', access: chef, actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', outcomeNote: 'Client indisponible' });
    await expect(w.transition.execute({ id: a.id, version: 1, transition: 'cancel', text: 'Encore', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('version périmée : conflit', async () => {
    const w = build(); w.company('c1', 'am1');
    const a = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    await expect(w.transition.execute({ id: a.id, version: 3, transition: 'cancel', text: 'Motif valable', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('Agenda — lecture et portée', () => {
  async function seed() {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    const mine = await w.plan.execute({ ...base, companyId: 'c1', access: am1, actor });
    const theirs = await w.plan.execute({ ...base, startsAt: '2026-11-11T09:00:00Z', companyId: 'c2', access: am2, actor });
    const visit = await w.plan.execute({ ...base, type: 'VISIT', startsAt: '2026-11-05T09:00:00Z', companyId: 'c1', access: am1, actor });
    return { w, mine, theirs, visit };
  }
  it('chacun voit les siens, triés par heure ; le Responsable commercial voit son équipe ; lecture hors portée : introuvable', async () => {
    const { w, mine, theirs, visit } = await seed();
    expect((await w.list.execute({ ...window, access: am1 })).items.map((i) => i.id)).toEqual([visit.id, mine.id]);
    expect((await w.list.execute({ ...window, access: am2 })).items.map((i) => i.id)).toEqual([theirs.id]);
    expect((await w.list.execute({ ...window, access: chef })).items.map((i) => i.id)).toEqual([visit.id, mine.id]);
    await expect(w.get.execute({ id: theirs.id, access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: 'inconnu', access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: mine.id, access: am1 })).resolves.toMatchObject({ id: mine.id });
  });
  it('filtre par fenêtre (fin exclue), type, état, entreprise ; l’entreprise hors portée est introuvable', async () => {
    const { w, mine, visit } = await seed();
    const ids = async (q: object) => (await w.list.execute({ ...window, access: am1, ...q })).items.map((i) => i.id);
    expect(await ids({ from: '2026-11-10T00:00:00Z', to: '2026-11-11T00:00:00Z' })).toEqual([mine.id]);
    expect(await ids({ from: '2026-11-10T09:00:00Z', to: '2026-11-10T09:00:00Z'.replace('09', '10') })).toEqual([mine.id]);
    expect(await ids({ from: '2026-11-10T00:00:00Z', to: '2026-11-10T09:00:00Z' })).toEqual([]);
    expect(await ids({ type: 'VISIT' })).toEqual([visit.id]);
    expect(await ids({ status: 'CANCELLED' })).toEqual([]);
    expect(await ids({ companyId: 'c1' })).toEqual([visit.id, mine.id]);
    await expect(w.list.execute({ ...window, access: am1, companyId: 'c2' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('refuse une fenêtre invalide, inversée ou de plus de 63 jours ; borne la taille de page', async () => {
    const { w } = await seed();
    await expect(w.list.execute({ ...window, from: 'hier', access: am1 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.list.execute({ ...window, from: window.to, to: window.from, access: am1 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.list.execute({ ...window, from: '2026-01-01T00:00:00Z', to: '2026-03-06T00:00:00Z', access: am1 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.list.execute({ ...window, from: '2026-01-01T00:00:00Z', to: '2026-03-05T00:00:00Z', access: am1 })).resolves.toBeDefined();
    expect((await w.list.execute({ ...window, pageSize: 5000, access: am1 })).pageSize).toBe(200);
  });
});
