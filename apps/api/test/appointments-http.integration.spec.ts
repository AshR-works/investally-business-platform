import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaAppointmentRepository } from '../src/modules/business-development/infrastructure/prisma-appointment.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
/** Un instant dans `n` jours à `hour` h UTC (heure pleine). */
const at = (n: number, hour = 9) => {
  const d = new Date(Date.now() + n * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const wide = () => `from=${encodeURIComponent(at(-30, 0))}&to=${encodeURIComponent(at(30, 0))}`;

/** S4.2d : agenda de bout en bout (HTTP + PostgreSQL) : droits, portée, conflits, report, tenue, annulation, règles de la base, audit. */
describeDb('Agenda — rendez-vous et visites (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.98.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
  });

  const login = async (user: { email: string }) => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string };

  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const [chef, am, other, dir] = [await login(chefUser), await login(amUser), await login(otherUser), await login(dirUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, dir, amUser, companyId: company.body.id as string };
  }
  const plan = (as: As, companyId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/appointments', { ...as, body: { type: 'FINANCE_DIRECTOR', companyId, startsAt: at(3), location: 'Siège', note: 'Présenter l’offre', ...extra } });
  const act = (as: As, id: string, action: 'postpone' | 'hold' | 'cancel', body: Record<string, unknown>) => api.call('POST', `/api/v1/appointments/${id}/${action}`, { ...as, body });

  it('cycle : planifier, modifier, reporter, annuler ; versions, états et compteur de reports suivent', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId, { durationMinutes: 45 });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: 'PLANNED', type: 'FINANCE_DIRECTOR', durationMinutes: 45, reportDue: false, postponements: 0, version: 1 });
    expect(a.body.conflicts).toBeUndefined();
    const updated = await api.call('PUT', `/api/v1/appointments/${a.body.id}`, { ...am, body: { version: 1, location: 'Visioconférence', durationMinutes: 90 } });
    expect(updated.body).toMatchObject({ location: 'Visioconférence', durationMinutes: 90, version: 2 });
    expect((await act(am, a.body.id, 'postpone', { version: 2, startsAt: at(5) })).status).toBe(400);
    const moved = await act(am, a.body.id, 'postpone', { version: 2, startsAt: at(5), text: 'Le DAF est en déplacement' });
    expect(moved.body).toMatchObject({ status: 'PLANNED', startsAt: at(5), postponements: 1, lastPostponeReason: 'Le DAF est en déplacement', version: 3 });
    const cancelled = await act(am, a.body.id, 'cancel', { version: 3, text: 'Client indisponible' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', outcomeNote: 'Client indisponible', version: 4 });
    expect(cancelled.body.closedAt).not.toBeNull();
    expect((await api.call('PUT', `/api/v1/appointments/${a.body.id}`, { ...am, body: { version: 4, note: 'Encore' } })).status).toBe(422);
    expect((await act(am, a.body.id, 'postpone', { version: 4, startsAt: at(6), text: 'Trop tard' })).status).toBe(422);
  }, 120_000);

  it('contact et offre : rattachés à l’entreprise (noms rendus), refusés sinon', async () => {
    const { am, companyId } = await team();
    const contact = await api.call('POST', '/api/v1/contacts', { ...am, body: { companyId, lastName: 'Fotso', firstName: 'Marie', role: 'FINANCE_DIRECTOR' } });
    expect(contact.status).toBe(201);
    const offer = await api.call('POST', '/api/v1/offers', { ...am, body: { companyId, subject: 'Formation', amount: '100000' } });
    const withLinks = await plan(am, companyId, { contactId: contact.body.id, offerId: offer.body.id });
    expect(withLinks.body).toMatchObject({ contactName: 'Marie Fotso', offerReference: offer.body.reference, contactId: contact.body.id, offerId: offer.body.id });
    const second = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Autre ${unique()}` } });
    const foreignContact = await api.call('POST', '/api/v1/contacts', { ...am, body: { companyId: second.body.id, lastName: 'Ngono', firstName: 'Paul' } });
    const foreignOffer = await api.call('POST', '/api/v1/offers', { ...am, body: { companyId: second.body.id, subject: 'Autre', amount: '5' } });
    expect((await plan(am, companyId, { contactId: foreignContact.body.id })).status).toBe(400);
    expect((await plan(am, companyId, { offerId: foreignOffer.body.id })).status).toBe(400);
    const unlinked = await api.call('PUT', `/api/v1/appointments/${withLinks.body.id}`, { ...am, body: { version: 1, contactId: null } });
    expect(unlinked.body).toMatchObject({ contactId: null, contactName: null });
  }, 120_000);

  it('opportunité (D93) : liée si elle est ouverte et de la même entreprise (intitulé rendu), refusée sinon ; le lien ne change plus', async () => {
    const { am, companyId } = await team();
    const other = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Autre société ${unique()}` } });
    const mine = await api.call('POST', '/api/v1/opportunities', { ...am, body: { companyId, title: 'Formation liée', amount: '2500000', source: 'REFERRAL' } });
    const foreign = await api.call('POST', '/api/v1/opportunities', { ...am, body: { companyId: other.body.id, title: 'Formation étrangère', amount: '1000000', source: 'REFERRAL' } });
    const closed = await api.call('POST', '/api/v1/opportunities', { ...am, body: { companyId, title: 'Formation perdue', amount: '1000000', source: 'REFERRAL' } });
    expect((await api.call('POST', `/api/v1/opportunities/${closed.body.id}/close-lost`, { ...am, body: { version: 1, reason: 'PRICE' } })).status).toBe(200);
    const linked = await plan(am, companyId, { type: 'DECISION_MAKER', opportunityId: mine.body.id });
    expect(linked.status).toBe(201);
    expect(linked.body).toMatchObject({ opportunityId: mine.body.id, opportunityTitle: 'Formation liée' });
    expect((await api.call('GET', `/api/v1/appointments/${linked.body.id}`, am)).body).toMatchObject({ opportunityTitle: 'Formation liée' });
    const listed = await api.call('GET', `/api/v1/appointments?${wide()}&companyId=${companyId}`, am);
    expect(listed.body.items.find((x: { id: string }) => x.id === linked.body.id)).toMatchObject({ opportunityTitle: 'Formation liée' });
    expect((await plan(am, companyId, { opportunityId: foreign.body.id })).status).toBe(400);
    expect((await plan(am, companyId, { opportunityId: closed.body.id })).status).toBe(400);
    expect((await plan(am, companyId, { opportunityId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
    expect((await plan(am, companyId, { opportunityId: 'pas-un-identifiant' })).status).toBe(400);
    const edited = await api.call('PUT', `/api/v1/appointments/${linked.body.id}`, { ...am, body: { version: 1, location: 'Siège' } });
    expect(edited.body).toMatchObject({ opportunityId: mine.body.id, version: 2 });
    expect((await api.call('PUT', `/api/v1/appointments/${linked.body.id}`, { ...am, body: { version: 2, opportunityId: foreign.body.id } })).status).toBe(400);
  }, 120_000);

  it('refus : heure passée ou mal écrite, type inconnu, durée hors limites (400/422), champ inconnu (400), version périmée (409)', async () => {
    const { am, companyId } = await team();
    expect([400, 422]).toContain((await plan(am, companyId, { startsAt: at(-2) })).status);
    expect((await plan(am, companyId, { startsAt: 'demain' })).status).toBe(400);
    expect((await plan(am, companyId, { type: 'GOUTER' })).status).toBe(400);
    expect((await plan(am, companyId, { durationMinutes: 5 })).status).toBe(400);
    expect((await plan(am, companyId, { durationMinutes: 600 })).status).toBe(400);
    expect((await plan(am, companyId, { statut: 'HELD' })).status).toBe(400);
    const a = await plan(am, companyId);
    expect((await api.call('PUT', `/api/v1/appointments/${a.body.id}`, { ...am, body: { version: 9, note: 'Autre' } })).status).toBe(409);
  }, 120_000);

  it('conflit d’horaire : avertissement (jamais blocage) pour le même organisateur, pas pour un autre ni bout à bout', async () => {
    const { am, other, companyId } = await team();
    const first = await plan(am, companyId, { startsAt: at(4, 9) });
    const overlap = await plan(am, companyId, { startsAt: at(4, 9).replace('T09:00', 'T09:30'), type: 'DECISION_MAKER' });
    expect(overlap.status).toBe(201);
    expect(overlap.body.conflicts).toEqual([expect.objectContaining({ id: first.body.id, type: 'FINANCE_DIRECTOR' })]);
    const adjacent = await plan(am, companyId, { startsAt: at(4, 11) });
    expect(adjacent.body.conflicts).toBeUndefined();
    const otherCompany = await api.call('POST', '/api/v1/companies', { ...other, body: { name: `Autre ${unique()}` } });
    const alone = await plan(other, otherCompany.body.id, { startsAt: at(4, 9) });
    expect(alone.body.conflicts).toBeUndefined();
    await act(am, first.body.id, 'cancel', { version: 1, text: 'Annulé par le client' });
    const free = await plan(am, companyId, { startsAt: at(4, 9) });
    expect(free.body.conflicts).toEqual([expect.objectContaining({ id: overlap.body.id })]);
    const moved = await act(am, adjacent.body.id, 'postpone', { version: 1, startsAt: at(4, 9).replace('T09:00', 'T09:15'), text: 'Décalé pour le déjeuner' });
    expect(moved.body.conflicts?.length).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it('tenu : refusé avant l’heure ; une fois l’heure venue, le compte rendu est obligatoire et définitif ; compte rendu attendu signalé', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId);
    expect((await act(am, a.body.id, 'hold', { version: 1, text: 'Trop tôt' })).status).toBe(422);
    await t.prisma.db.appointment.update({ where: { id: a.body.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
    const due = await api.call('GET', `/api/v1/appointments/${a.body.id}`, am);
    expect(due.body.reportDue).toBe(true);
    expect((await act(am, a.body.id, 'hold', { version: 1 })).status).toBe(400);
    const held = await act(am, a.body.id, 'hold', { version: 1, text: 'Le DAF veut une remise' });
    expect(held.body).toMatchObject({ status: 'HELD', outcomeNote: 'Le DAF veut une remise', reportDue: false, version: 2 });
    expect((await act(am, a.body.id, 'cancel', { version: 2, text: 'Trop tard' })).status).toBe(422);
    expect((await act(am, a.body.id, 'hold', { version: 2, text: 'Encore' })).status).toBe(422);
  }, 120_000);

  it('l’agenda est borné à la fenêtre (fin exclue), trié, filtrable ; la fenêtre est limitée à 63 jours', async () => {
    const { am, companyId } = await team();
    const later = await plan(am, companyId, { startsAt: at(9, 14) });
    const sooner = await plan(am, companyId, { startsAt: at(8, 9), type: 'VISIT' });
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);
    const q = (extra = '') => api.call('GET', `/api/v1/appointments?${wide()}&companyId=${companyId}${extra}`, am);
    expect(ids(await q())).toEqual([sooner.body.id, later.body.id]);
    expect(ids(await q('&type=VISIT'))).toEqual([sooner.body.id]);
    expect(ids(await q('&status=HELD'))).toEqual([]);
    const exact = await api.call('GET', `/api/v1/appointments?from=${encodeURIComponent(at(8, 9))}&to=${encodeURIComponent(at(8, 10))}&companyId=${companyId}`, am);
    expect(ids(exact)).toEqual([sooner.body.id]);
    const excluded = await api.call('GET', `/api/v1/appointments?from=${encodeURIComponent(at(8, 8))}&to=${encodeURIComponent(at(8, 9))}&companyId=${companyId}`, am);
    expect(ids(excluded)).toEqual([]);
    expect((await api.call('GET', `/api/v1/appointments?from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(at(70))}`, am)).status).toBe(400);
    expect((await api.call('GET', `/api/v1/appointments?from=${encodeURIComponent(at(3))}&to=${encodeURIComponent(at(1))}`, am)).status).toBe(400);
    expect((await api.call('GET', '/api/v1/appointments', am)).status).toBe(400);
  }, 120_000);

  it('portée et droits : le chef voit son équipe, la Direction lit sans écrire, le collègue reçoit « introuvable »', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const a = await plan(am, companyId);
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);
    expect(ids(await api.call('GET', `/api/v1/appointments?${wide()}`, am))).toContain(a.body.id);
    expect(ids(await api.call('GET', `/api/v1/appointments?${wide()}`, chef))).toContain(a.body.id);
    expect(ids(await api.call('GET', `/api/v1/appointments?${wide()}`, dir))).toContain(a.body.id);
    expect(ids(await api.call('GET', `/api/v1/appointments?${wide()}`, other))).not.toContain(a.body.id);
    expect((await api.call('GET', `/api/v1/appointments/${a.body.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/appointments/${a.body.id}`, dir)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/appointments?${wide()}&companyId=${companyId}`, other)).status).toBe(404);
    expect((await plan(dir, companyId)).status).toBe(403);
    expect((await act(dir, a.body.id, 'cancel', { version: 1, text: 'Direction' })).status).toBe(403);
    expect((await act(other, a.body.id, 'cancel', { version: 1, text: 'Collègue' })).status).toBe(404);
    expect((await plan(other, companyId)).status).toBe(404);
    expect((await act(chef, a.body.id, 'postpone', { version: 1, startsAt: at(6), text: 'Le chef a décalé' })).status).toBe(200);
  }, 120_000);

  it('règles garanties par la base : durée, clôture cohérente (compte rendu et date ensemble), version et reports positifs, liens existants', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId);
    const db = t.prisma.db;
    const id = a.body.id;
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET duration_minutes = 10 WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET duration_minutes = 500 WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET status = 'HELD' WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET outcome_note = 'x' WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET closed_at = now() WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET version = 0 WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET postponements = -1 WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET contact_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET opportunity_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await act(am, id, 'cancel', { version: 1, text: 'Annulé' });
    await expect(db.$executeRawUnsafe(`UPDATE bd.appointments SET status = 'PLANNED' WHERE id = '${id}'::uuid`)).rejects.toThrow();
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux annulations sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId);
    const repository = new PrismaAppointmentRepository(t.prisma);
    const first = (await repository.findById(a.body.id))!;
    const second = (await repository.findById(a.body.id))!;
    first.cancel('Première', new Date());
    second.cancel('Seconde', new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(a.body.id))!.outcomeNote).toBe('Première');
  }, 120_000);

  it('entreprise archivée : plus de rendez-vous ni de modification (422) ; l’agenda reste lisible', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await plan(am, companyId)).status).toBe(422);
    expect((await act(am, a.body.id, 'cancel', { version: 1, text: 'Archivée' })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/appointments/${a.body.id}`, am)).status).toBe(200);
  }, 120_000);

  it('audit : planification, modification, report et annulation tracées, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, companyId } = await team();
    const a = await plan(am, companyId);
    await api.call('PUT', `/api/v1/appointments/${a.body.id}`, { ...am, body: { version: 1, note: 'Changée' } });
    await act(am, a.body.id, 'postpone', { version: 2, startsAt: at(7), text: 'Décalé' });
    await act(am, a.body.id, 'cancel', { version: 3, text: 'Annulé' });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: a.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE']);
    expect(logs.every((l) => l.sessionId === am.sessionId)).toBe(true);
    expect((logs[2]!.oldValue as { startsAt: string }).startsAt).toBe(at(3));
    expect((logs[2]!.newValue as { startsAt: string }).startsAt).toBe(at(7));
    expect((logs[3]!.newValue as { status: string }).status).toBe('CANCELLED');
  }, 120_000);
});
