import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { IDOR_ROUTES } from './support/idor-registry';
import { Api, ApiResponse, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-7000-8000-000000000000';
const pdf = () => Buffer.from('%PDF-1.7\ncontrat idor\n%%EOF');

interface As { token: string; ip: string }
/** Identifiants visés par une sonde : les vrais (objet de Marie) ou inexistants (tous `NIL`). */
interface Ids { company: string; doc: string; session: string; facilitator: string; contact: string; offer: string; offerSent: string; offerPending: string; offerReceipt: string; receipt: string; followup: string; appointment: string; appointmentDue: string; opportunity: string; opportunityAgreed: string; teammate: string; opportunityReady: string; approval: string; approvalRequested: string; commission: string; commissionCompany: string; ambassador: string; employee: string; employeeLeave: string; leaveRequest: string; leaveType: string; holiday: string; contract: string; contractEnd: string; contractType: string; journey: string; journeyCancel: string; journeyTask: string; journeyReopen: string; journeyReopenTask: string; learnerCompany: string; learner: string; learner2: string; enrollment: string; trainingSession: string; trainingSession2: string }

/**
 * Une sonde par route « objet » : elle appelle la route avec les identifiants donnés, en tant que `as`.
 * Ajouter une route « objet » au registre sans écrire sa sonde fait échouer le premier test (qui ne dépend pas de la base).
 */
/** Routes de lecture des opportunités : le Responsable commercial (même sans lien d'équipe) les lit légitimement. */
const READ_ALL_FOR_HEAD_OF_SALES = ['GET /opportunities', 'GET /opportunities/:id', 'GET /ambassadors/:id'];

const PROBES: Record<string, (api: Api, as: As, ids: Ids) => Promise<ApiResponse>> = {
  'GET /companies/:id': (api, as, ids) => api.call('GET', `/api/v1/companies/${ids.company}`, as),
  'GET /companies/:id/export': (api, as, ids) => api.call('GET', `/api/v1/companies/${ids.company}/export`, as),
  'POST /companies/:id/status': (api, as, ids) => api.call('POST', `/api/v1/companies/${ids.company}/status`, { ...as, body: { version: 1, status: 'CONTACTED' } }),
  'POST /companies/:id/owner': (api, as, ids) => api.call('POST', `/api/v1/companies/${ids.company}/owner`, { ...as, body: { version: 1, ownerUserId: ids.teammate } }),
  'PUT /companies/:id': (api, as, ids) => api.call('PUT', `/api/v1/companies/${ids.company}`, { ...as, body: { version: 1, sector: 'Piège' } }),
  'GET /contacts': (api, as, ids) => api.call('GET', `/api/v1/contacts?companyId=${ids.company}`, as),
  'POST /contacts': (api, as, ids) => api.call('POST', '/api/v1/contacts', { ...as, body: { companyId: ids.company, lastName: 'Piege', firstName: 'Contact', email: 'piege@exemple.cm' } }),
  'GET /contacts/:id': (api, as, ids) => api.call('GET', `/api/v1/contacts/${ids.contact}`, as),
  'PUT /contacts/:id': (api, as, ids) => api.call('PUT', `/api/v1/contacts/${ids.contact}`, { ...as, body: { version: 1, phone: '+237 600 00 00 00' } }),
  'DELETE /contacts/:id': (api, as, ids) => api.call('DELETE', `/api/v1/contacts/${ids.contact}`, as),
  'GET /offers': (api, as, ids) => api.call('GET', `/api/v1/offers?companyId=${ids.company}`, as),
  'POST /offers': (api, as, ids) => api.call('POST', '/api/v1/offers', { ...as, body: { companyId: ids.company, subject: 'Offre piège', amount: '1000' } }),
  'GET /offers/:id': (api, as, ids) => api.call('GET', `/api/v1/offers/${ids.offer}`, as),
  'GET /offers/:id/export': (api, as, ids) => api.call('GET', `/api/v1/offers/${ids.offer}/export`, as),
  'PUT /offers/:id': (api, as, ids) => api.call('PUT', `/api/v1/offers/${ids.offer}`, { ...as, body: { version: 1, subject: 'Offre piratée' } }),
  'POST /offers/:id/clone': (api, as, ids) => api.call('POST', `/api/v1/offers/${ids.offer}/clone`, { ...as }),
  'POST /offers/:id/submit': (api, as, ids) => api.call('POST', `/api/v1/offers/${ids.offer}/submit`, { ...as, body: { version: 1 } }),
  'POST /offers/:id/accept': (api, as, ids) => api.call('POST', `/api/v1/offers/${ids.offerSent}/accept`, { ...as, body: { version: 2 } }),
  'POST /offers/:id/refuse': (api, as, ids) => api.call('POST', `/api/v1/offers/${ids.offerSent}/refuse`, { ...as, body: { version: 2 } }),
  'GET /receipts': (api, as, ids) => api.call('GET', `/api/v1/receipts?offerId=${ids.offer}`, as),
  'POST /receipts': (api, as, ids) => api.call('POST', '/api/v1/receipts', { ...as, body: { offerId: ids.offerPending, receivedOn: new Date().toISOString().slice(0, 10), receivedBy: 'Piege Recepisse' } }),
  'GET /receipts/:id': (api, as, ids) => api.call('GET', `/api/v1/receipts/${ids.receipt}`, as),
  'POST /receipts/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/receipts/${ids.receipt}/cancel`, { ...as, body: { version: 1, reason: 'Annulation piratée' } }),
  'GET /followups': (api, as, ids) => api.call('GET', `/api/v1/followups?offerId=${ids.offerReceipt}`, as),
  'POST /followups': (api, as, ids) => api.call('POST', '/api/v1/followups', { ...as, body: { offerId: ids.offerReceipt, dueOn: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10), channel: 'CALL', note: 'Relance piégée' } }),
  'GET /followups/:id': (api, as, ids) => api.call('GET', `/api/v1/followups/${ids.followup}`, as),
  'PUT /followups/:id': (api, as, ids) => api.call('PUT', `/api/v1/followups/${ids.followup}`, { ...as, body: { version: 1, note: 'Relance piratée' } }),
  'POST /followups/:id/complete': (api, as, ids) => api.call('POST', `/api/v1/followups/${ids.followup}/complete`, { ...as, body: { version: 1, text: 'Terminée par un pirate' } }),
  'POST /followups/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/followups/${ids.followup}/cancel`, { ...as, body: { version: 1, text: 'Annulée par un pirate' } }),
  'GET /appointments': (api, as, ids) => api.call('GET', `/api/v1/appointments?companyId=${ids.company}&from=${encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 30 * 86400000).toISOString())}`, as),
  'POST /appointments': (api, as, ids) => api.call('POST', '/api/v1/appointments', { ...as, body: { type: 'FINANCE_DIRECTOR', companyId: ids.company, startsAt: new Date(Date.now() + 6 * 86400000).toISOString(), note: 'Rendez-vous piégé' } }),
  'GET /appointments/:id': (api, as, ids) => api.call('GET', `/api/v1/appointments/${ids.appointment}`, as),
  'PUT /appointments/:id': (api, as, ids) => api.call('PUT', `/api/v1/appointments/${ids.appointment}`, { ...as, body: { version: 1, note: 'Rendez-vous piraté' } }),
  'POST /appointments/:id/postpone': (api, as, ids) => api.call('POST', `/api/v1/appointments/${ids.appointment}/postpone`, { ...as, body: { version: 1, startsAt: new Date(Date.now() + 8 * 86400000).toISOString(), text: 'Reporté par un pirate' } }),
  'POST /appointments/:id/hold': (api, as, ids) => api.call('POST', `/api/v1/appointments/${ids.appointmentDue}/hold`, { ...as, body: { version: 1, text: 'Tenu par un pirate' } }),
  'POST /appointments/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/appointments/${ids.appointment}/cancel`, { ...as, body: { version: 1, text: 'Annulé par un pirate' } }),
  'GET /opportunities': (api, as, ids) => api.call('GET', `/api/v1/opportunities?companyId=${ids.company}`, as),
  'POST /opportunities': (api, as, ids) => api.call('POST', '/api/v1/opportunities', { ...as, body: { companyId: ids.company, title: 'Opportunité piégée', amount: '1000', source: 'OTHER' } }),
  'GET /opportunities/:id': (api, as, ids) => api.call('GET', `/api/v1/opportunities/${ids.opportunity}`, as),
  'PUT /opportunities/:id': (api, as, ids) => api.call('PUT', `/api/v1/opportunities/${ids.opportunity}`, { ...as, body: { version: 1, title: 'Opportunité piratée' } }),
  'POST /opportunities/:id/advance': (api, as, ids) => api.call('POST', `/api/v1/opportunities/${ids.opportunity}/advance`, { ...as, body: { version: 1 } }),
  'POST /opportunities/:id/waiver': (api, as, ids) => api.call('POST', `/api/v1/opportunities/${ids.opportunity}/waiver`, { ...as, body: { version: 1, reason: 'Dérogation piratée' } }),
  'POST /opportunities/:id/close-lost': (api, as, ids) => api.call('POST', `/api/v1/opportunities/${ids.opportunity}/close-lost`, { ...as, body: { version: 1, reason: 'PRICE', note: 'Perdue par un pirate' } }),
  'POST /opportunities/:id/close-won': (api, as, ids) => api.call('POST', `/api/v1/opportunities/${ids.opportunityAgreed}/close-won`, { ...as, body: { version: 1 } }),
  'GET /approvals': (api, as, ids) => api.call('GET', `/api/v1/approvals?companyId=${ids.company}`, as),
  'POST /approvals': (api, as, ids) => api.call('POST', '/api/v1/approvals', { ...as, body: { opportunityId: ids.opportunityReady, amount: '1000', receivedOn: new Date().toISOString().slice(0, 10) } }),
  'GET /approvals/:id': (api, as, ids) => api.call('GET', `/api/v1/approvals/${ids.approval}`, as),
  'GET /commissions': (api, as, ids) => api.call('GET', `/api/v1/commissions?companyId=${ids.commissionCompany}`, as),
  'GET /commissions/:id': (api, as, ids) => api.call('GET', `/api/v1/commissions/${ids.commission}`, as),
  'POST /commissions/:id/release': (api, as, ids) => api.call('POST', `/api/v1/commissions/${ids.commission}/release`, { ...as, body: { version: 1 } }),
  'POST /commissions/:id/hold': (api, as, ids) => api.call('POST', `/api/v1/commissions/${ids.commission}/hold`, { ...as, body: { version: 1, reason: 'Mise en attente piratée' } }),
  'POST /commissions/:id/pay': (api, as, ids) => api.call('POST', `/api/v1/commissions/${ids.commission}/pay`, { ...as, body: { version: 1, paidOn: new Date().toISOString().slice(0, 10) } }),
  'POST /commissions/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/commissions/${ids.commission}/cancel`, { ...as, body: { version: 1, reason: 'Annulée par un pirate' } }),
  'POST /commissions/:id/amount': (api, as, ids) => api.call('POST', `/api/v1/commissions/${ids.commission}/amount`, { ...as, body: { version: 1, amount: '1000' } }),
  'POST /approvals/:id/receive': (api, as, ids) => api.call('POST', `/api/v1/approvals/${ids.approvalRequested}/receive`, { ...as, body: { version: 1, receivedOn: new Date().toISOString().slice(0, 10) } }),
  'POST /approvals/:id/honor': (api, as, ids) => api.call('POST', `/api/v1/approvals/${ids.approval}/honor`, { ...as, body: { version: 1 } }),
  'POST /approvals/:id/expire': (api, as, ids) => api.call('POST', `/api/v1/approvals/${ids.approval}/expire`, { ...as, body: { version: 1, reason: 'Expiré par un pirate' } }),
  'POST /approvals/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/approvals/${ids.approval}/cancel`, { ...as, body: { version: 1, reason: 'Annulé par un pirate' } }),
  'GET /ambassadors/:id': (api, as, ids) => api.call('GET', `/api/v1/ambassadors/${ids.ambassador}`, as),
  'PUT /ambassadors/:id': (api, as, ids) => api.call('PUT', `/api/v1/ambassadors/${ids.ambassador}`, { ...as, body: { version: 1, lastName: 'Piraté' } }),
  'POST /hr/employees': (api, as, ids) => api.call('POST', '/api/v1/hr/employees', { ...as, body: { lastName: 'Piège', firstName: 'Paul', jobTitle: 'Piège', department: 'Piège', hiredOn: '2026-01-01', managerEmployeeId: ids.employee } }),
  'GET /hr/employees/:id': (api, as, ids) => api.call('GET', `/api/v1/hr/employees/${ids.employee}`, as),
  'PUT /hr/employees/:id': (api, as, ids) => api.call('PUT', `/api/v1/hr/employees/${ids.employee}`, { ...as, body: { version: 1, jobTitle: 'Piraté' } }),
  'POST /hr/employees/:id/status': (api, as, ids) => api.call('POST', `/api/v1/hr/employees/${ids.employee}/status`, { ...as, body: { version: 1, status: 'ARCHIVED', reason: 'Piraté' } }),
  'POST /hr/leave/requests': (api, as, ids) => api.call('POST', '/api/v1/hr/leave/requests', { ...as, body: { employeeId: ids.employeeLeave, leaveTypeId: ids.leaveType, start: futureMonday(5), end: futureMonday(5), note: 'Absence piège' } }),
  'GET /hr/leave/requests/:id': (api, as, ids) => api.call('GET', `/api/v1/hr/leave/requests/${ids.leaveRequest}`, as),
  'POST /hr/leave/requests/:id/decision': (api, as, ids) => api.call('POST', `/api/v1/hr/leave/requests/${ids.leaveRequest}/decision`, { ...as, body: { decision: 'APPROVE', version: 1 } }),
  'POST /hr/leave/requests/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/hr/leave/requests/${ids.leaveRequest}/cancel`, { ...as, body: { version: 1, reason: 'Annulée par un pirate' } }),
  'GET /hr/leave/balance': (api, as, ids) => api.call('GET', `/api/v1/hr/leave/balance?employeeId=${ids.employeeLeave}&year=2026`, as),
  'PUT /hr/leave/types/:id': (api, as, ids) => api.call('PUT', `/api/v1/hr/leave/types/${ids.leaveType}`, { ...as, body: { version: 1, label: 'Type piraté' } }),
  'DELETE /hr/leave/holidays/:id': (api, as, ids) => api.call('DELETE', `/api/v1/hr/leave/holidays/${ids.holiday}`, as),
  'POST /hr/leave/adjustments': (api, as, ids) => api.call('POST', '/api/v1/hr/leave/adjustments', { ...as, body: { employeeId: ids.employeeLeave, year: 2026, days: 5, reason: 'Ajustement piraté' } }),
  'GET /hr/leave/adjustments': (api, as, ids) => api.call('GET', `/api/v1/hr/leave/adjustments?employeeId=${ids.employeeLeave}&year=2026`, as),
  'GET /hr/contracts/:id': (api, as, ids) => api.call('GET', `/api/v1/hr/contracts/${ids.contract}`, as),
  'PUT /hr/contracts/:id': (api, as, ids) => api.call('PUT', `/api/v1/hr/contracts/${ids.contract}`, { ...as, body: { version: 1, probationEnd: '2026-03-01' } }),
  'POST /hr/contracts/:id/end': (api, as, ids) => api.call('POST', `/api/v1/hr/contracts/${ids.contractEnd}/end`, { ...as, body: { version: 1, endedOn: '2026-06-01', reason: 'OTHER' } }),
  'PUT /hr/contracts/types/:id': (api, as, ids) => api.call('PUT', `/api/v1/hr/contracts/types/${ids.contractType}`, { ...as, body: { version: 1, label: 'Type piraté' } }),
  'GET /hr/journeys/:id': (api, as, ids) => api.call('GET', `/api/v1/hr/journeys/${ids.journey}`, as),
  'POST /hr/journeys/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/hr/journeys/${ids.journeyCancel}/cancel`, { ...as, body: { version: 1 } }),
  'POST /hr/journeys/:id/tasks/:taskId/complete': (api, as, ids) => api.call('POST', `/api/v1/hr/journeys/${ids.journey}/tasks/${ids.journeyTask}/complete`, { ...as, body: { version: 1 } }),
  'POST /hr/journeys/:id/tasks/:taskId/reopen': (api, as, ids) => api.call('POST', `/api/v1/hr/journeys/${ids.journeyReopen}/tasks/${ids.journeyReopenTask}/reopen`, { ...as, body: { version: 2 } }),
  'PUT /hr/journeys/templates/:kind': (api, as) => api.call('PUT', '/api/v1/hr/journeys/templates/OFFBOARDING', { ...as, body: { version: 1, tasks: [{ title: 'Tâche piratée', owner: 'HR', dueOffsetDays: 0 }] } }),
  'POST /ambassadors/:id/status': (api, as, ids) => api.call('POST', `/api/v1/ambassadors/${ids.ambassador}/status`, { ...as, body: { version: 1, status: 'ARCHIVED', reason: 'Piraté' } }),
  'POST /offers/:id/withdraw': (api, as, ids) => api.call('POST', `/api/v1/offers/${ids.offerSent}/withdraw`, { ...as, body: { version: 2, reason: 'Retrait piraté' } }),
  'GET /facilitators/:id': (api, as, ids) => api.call('GET', `/api/v1/facilitators/${ids.facilitator}`, as),
  'GET /documents': (api, as, ids) => api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${ids.company}`, as),
  'POST /documents': (api, as, ids) =>
    api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${ids.company}&title=Test&category=DECHARGE&fileName=a.pdf`, { ...as, raw: { type: 'application/octet-stream', data: pdf() } }),
  'GET /documents/:id': (api, as, ids) => api.call('GET', `/api/v1/documents/${ids.doc}`, as),
  'GET /documents/:id/download': (api, as, ids) => api.call('GET', `/api/v1/documents/${ids.doc}/download`, as),
  'POST /documents/:id/versions': (api, as, ids) =>
    api.call('POST', `/api/v1/documents/${ids.doc}/versions?fileName=b.pdf`, { ...as, raw: { type: 'application/octet-stream', data: pdf() } }),
  'POST /documents/:id/archive': (api, as, ids) => api.call('POST', `/api/v1/documents/${ids.doc}/archive`, as),
  'GET /learners': (api, as, ids) => api.call('GET', `/api/v1/learners?companyId=${ids.learnerCompany}`, as),
  'POST /learners': (api, as, ids) => api.call('POST', '/api/v1/learners', { ...as, body: { companyId: ids.learnerCompany, lastName: 'Piège', firstName: 'Pierre' } }),
  'GET /learners/:id': (api, as, ids) => api.call('GET', `/api/v1/learners/${ids.learner}`, as),
  'PUT /learners/:id': (api, as, ids) => api.call('PUT', `/api/v1/learners/${ids.learner}`, { ...as, body: { version: 1, firstName: 'Piraté' } }),
  'DELETE /learners/:id': (api, as, ids) => api.call('DELETE', `/api/v1/learners/${ids.learner}`, { ...as, body: { version: 1 } }),
  'GET /enrollments': (api, as, ids) => api.call('GET', `/api/v1/enrollments?companyId=${ids.learnerCompany}`, as),
  'POST /enrollments': (api, as, ids) => api.call('POST', '/api/v1/enrollments', { ...as, body: { sessionId: ids.trainingSession, learnerId: ids.learner2, approvalId: ids.approval } }),
  'GET /enrollments/approval-options': (api, as, ids) => api.call('GET', `/api/v1/enrollments/approval-options?learnerId=${ids.learner}&sessionId=${ids.trainingSession}`, as),
  'GET /enrollments/:id': (api, as, ids) => api.call('GET', `/api/v1/enrollments/${ids.enrollment}`, as),
  'POST /enrollments/:id/confirm': (api, as, ids) => api.call('POST', `/api/v1/enrollments/${ids.enrollment}/confirm`, { ...as, body: { version: 1 } }),
  'POST /enrollments/:id/cancel': (api, as, ids) => api.call('POST', `/api/v1/enrollments/${ids.enrollment}/cancel`, { ...as, body: { version: 1, reason: 'Annulée par un pirate' } }),
  'POST /enrollments/:id/replace': (api, as, ids) => api.call('POST', `/api/v1/enrollments/${ids.enrollment}/replace`, { ...as, body: { version: 1, sessionId: ids.trainingSession2 } }),
  'DELETE /auth/sessions/:id': (api, as, ids) => api.call('DELETE', `/api/v1/auth/sessions/${ids.session}`, as),
};

/** Un lundi dans `weeks` semaines (une demande ne se pose pas dans le passé). */
const futureMonday = (weeks: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
};
let holidaySeq = Math.floor(Math.random() * 20_000);

const objectRoutes = Object.entries(IDOR_ROUTES).filter(([, kind]) => kind === 'objet').map(([key]) => key).sort();

describe('Contrat anti-IDOR : chaque route « objet » a sa sonde', () => {
  it('les sondes couvrent exactement les routes « objet » du registre', () => {
    expect(Object.keys(PROBES).sort()).toEqual(objectRoutes);
  });
});

describeDb('Contrat anti-IDOR : un acteur sans portée reçoit la réponse d\'un objet inexistant (PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-idor-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.90.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    process.env.DOCUMENTS_DIR = storageDir;
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  const login = async (user: { email: string }): Promise<As & { sessionId: string }> => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId };
  };

  /** Marie possède une entreprise, un document et une seconde session ; deux attaquants ont des droits mais pas la portée. */
  async function world() {
    const chef = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const marie = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chef.id });
    const anne = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chef.id }); // coéquipière de Marie : destinataire d'une réattribution
    const paul = await createUserWithRoles(t, [RoleCode.AccountManager]); // autre équipe, portée « propres objets »
    const autreChef = await createUserWithRoles(t, [RoleCode.HeadOfSales]); // autre équipe, portée « équipe »
    const m = await login(marie);
    const chefSession = await login(chef);
    const company = await api.call('POST', '/api/v1/companies', { ...m, body: { name: `Société IDOR ${Math.random().toString(36).slice(2, 8)}` } });
    expect(company.status).toBe(201);
    const facilitator = await api.call('POST', '/api/v1/facilitators', { ...m, body: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22', comment: 'Secret-IDOR' } });
    expect(facilitator.status).toBe(201);
    const contact = await api.call('POST', '/api/v1/contacts', { ...m, body: { companyId: company.body.id, lastName: 'ContactIdor', firstName: 'Alain', email: 'alain.idor@exemple.cm' } });
    expect(contact.status).toBe(201);
    const offer = await api.call('POST', '/api/v1/offers', { ...m, body: { companyId: company.body.id, subject: 'Secret-OFFRE-IDOR', amount: '4500000' } });
    expect(offer.status).toBe(201);
    const offerSent = await api.call('POST', '/api/v1/offers', { ...m, body: { companyId: company.body.id, subject: 'Offre déposée IDOR', amount: '2000000' } });
    expect(offerSent.status).toBe(201);
    expect((await api.call('POST', `/api/v1/offers/${offerSent.body.id}/submit`, { ...m, body: { version: 1 } })).status).toBe(200);
    const offerPending = await api.call('POST', '/api/v1/offers', { ...m, body: { companyId: company.body.id, subject: 'Offre en attente de décharge', amount: '3000000' } });
    expect(offerPending.status).toBe(201);
    expect((await api.call('POST', `/api/v1/offers/${offerPending.body.id}/submit`, { ...m, body: { version: 1 } })).status).toBe(200);
    const offerReceipt = await api.call('POST', '/api/v1/offers', { ...m, body: { companyId: company.body.id, subject: 'Offre avec décharge', amount: '1000000' } });
    expect(offerReceipt.status).toBe(201);
    expect((await api.call('POST', `/api/v1/offers/${offerReceipt.body.id}/submit`, { ...m, body: { version: 1 } })).status).toBe(200);
    const receipt = await api.call('POST', '/api/v1/receipts', { ...m, body: { offerId: offerReceipt.body.id, receivedOn: new Date().toISOString().slice(0, 10), receivedBy: 'Secret-RECEPISSE-IDOR' } });
    expect(receipt.status).toBe(201);
    const followup = await api.call('POST', '/api/v1/followups', { ...m, body: { offerId: offerReceipt.body.id, dueOn: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), channel: 'EMAIL', note: 'Secret-RELANCE-IDOR' } });
    expect(followup.status).toBe(201);
    const appointment = await api.call('POST', '/api/v1/appointments', { ...m, body: { type: 'DECISION_MAKER', companyId: company.body.id, startsAt: new Date(Date.now() + 4 * 86400000).toISOString(), note: 'Secret-RDV-IDOR' } });
    expect(appointment.status).toBe(201);
    const appointmentDue = await api.call('POST', '/api/v1/appointments', { ...m, body: { type: 'VISIT', companyId: company.body.id, startsAt: new Date(Date.now() + 2 * 86400000).toISOString(), note: 'Secret-RDV-IDOR' } });
    expect(appointmentDue.status).toBe(201);
    await t.prisma.db.appointment.update({ where: { id: appointmentDue.body.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
    const doc = await api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${company.body.id}&title=Pi%C3%A8ce&category=DECHARGE&fileName=piece.pdf`, {
      ...m, raw: { type: 'application/octet-stream', data: pdf() },
    });
    expect(doc.status).toBe(201);
    const opportunity = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company.body.id, title: 'Secret-OPPORTUNITE-IDOR', amount: '9000000', source: 'REFERRAL' } });
    expect(opportunity.status).toBe(201);
    const opportunityAgreed = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company.body.id, title: 'Secret-OPPORTUNITE-IDOR gagnable', amount: '3000000', source: 'EVENT' } });
    expect(opportunityAgreed.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: opportunityAgreed.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    // Les agréments vivent sur une seconde entreprise de Marie : l'agrément reçu fait de l'entreprise une cliente (sa version change), ce qui fausserait les sondes de la première.
    const company2 = await api.call('POST', '/api/v1/companies', { ...m, body: { name: `Société IDOR agréments ${Math.random().toString(36).slice(2, 8)}` } });
    expect(company2.status).toBe(201);
    const opportunityReady = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company2.body.id, title: 'Secret-OPPORTUNITE-IDOR agréable', amount: '2000000', source: 'EVENT' } });
    expect(opportunityReady.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: opportunityReady.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    const opportunityApproved = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company2.body.id, title: 'Secret-OPPORTUNITE-IDOR agréée', amount: '2500000', source: 'EVENT' } });
    expect(opportunityApproved.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: opportunityApproved.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    const approval = await api.call('POST', '/api/v1/approvals', { ...m, body: { opportunityId: opportunityApproved.body.id, amount: '2500000', receivedOn: new Date().toISOString().slice(0, 10) } });
    expect(approval.status).toBe(201);
    // Un agrément seulement demandé (D41) : la sonde de réception le déclare reçu.
    const opportunityAsked = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company2.body.id, title: 'Secret-OPPORTUNITE-IDOR demandée', amount: '2600000', source: 'EVENT' } });
    expect(opportunityAsked.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: opportunityAsked.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    const approvalRequested = await api.call('POST', '/api/v1/approvals', { ...m, body: { opportunityId: opportunityAsked.body.id, amount: '2600000', requested: true } });
    expect(approvalRequested.status).toBe(201);
    expect(approvalRequested.body.status).toBe('REQUESTED');
    // Une commission due : entreprise de Marie avec un facilitateur, la commission définie par son chef, l'agrément reçu puis honoré par la Finance.
    const financeSession = await login(await createUserWithRoles(t, [RoleCode.Finance]));
    const company3 = await api.call('POST', '/api/v1/companies', { ...m, body: { name: `Société IDOR commission ${Math.random().toString(36).slice(2, 8)}`, facilitation: { newFacilitator: { lastName: 'Secret-FACILITATEUR-IDOR', firstName: 'Paul', phone: '+237699001122' }, contactMethod: 'PHONE_CALL' } } });
    expect(company3.status).toBe(201);
    const withCommission = await api.call('PUT', `/api/v1/companies/${company3.body.id}`, { ...chefSession, body: { version: company3.body.version, facilitation: { commission: { type: 'FIXED', value: '150000', currency: 'XAF' } } } });
    expect(withCommission.status).toBe(200);
    const opportunityPaid = await api.call('POST', '/api/v1/opportunities', { ...m, body: { companyId: company3.body.id, title: 'Secret-OPPORTUNITE-IDOR commission', amount: '4000000', source: 'EVENT' } });
    expect(opportunityPaid.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: opportunityPaid.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    const approvalPaid = await api.call('POST', '/api/v1/approvals', { ...m, body: { opportunityId: opportunityPaid.body.id, amount: '4000000', receivedOn: new Date().toISOString().slice(0, 10) } });
    expect(approvalPaid.status).toBe(201);
    expect((await api.call('POST', `/api/v1/approvals/${approvalPaid.body.id}/honor`, { ...financeSession, body: { version: 1 } })).status).toBe(200);
    const commissions = await api.call('GET', `/api/v1/commissions?companyId=${company3.body.id}`, financeSession);
    expect(commissions.status).toBe(200);
    expect(commissions.body.items).toHaveLength(1);
    const commission = commissions.body.items[0];
    // Personnel : un employé créé par la RH, lié à aucun compte des attaquants (la fiche n'est ni la leur ni celle de leur équipe).
    const hrSession = await login(await createUserWithRoles(t, [RoleCode.Hr]));
    const employee = await api.call('POST', '/api/v1/hr/employees', { ...hrSession, body: { lastName: 'Secret-EMPLOYE-IDOR', firstName: 'Alain', jobTitle: 'Analyste', department: 'Finance', hiredOn: '2026-01-05' } });
    expect(employee.status).toBe(201);
    const ambassador = await api.call('POST', '/api/v1/ambassadors', { ...m, body: { lastName: 'Secret-AMBASSADEUR-IDOR', firstName: 'Alain', origin: 'LEARNER', appointedOn: new Date().toISOString().slice(0, 10) } });
    expect(ambassador.status).toBe(201);
    // Formation : une session ouverte (Responsable Investudy), deux apprenants de Marie sur sa seconde entreprise et une inscription sous son agrément reçu.
    const manager = await login(await createUserWithRoles(t, [RoleCode.TrainingManager]));
    const tag = Math.random().toString(36).slice(2, 8);
    const mondayIn = (weeks: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + weeks * 7); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); };
    const programIdor = await api.call('POST', '/api/v1/programs', { ...manager, body: { name: `Programme IDOR ${tag}` } });
    expect(programIdor.status).toBe(201);
    const trainingIdor = await api.call('POST', '/api/v1/trainings', { ...manager, body: { programId: programIdor.body.id, title: `Certificat IDOR ${tag}`, priceAmount: '100000' } });
    expect(trainingIdor.status).toBe(201);
    const roomIdor = await api.call('POST', '/api/v1/rooms', { ...manager, body: { name: `Salle IDOR ${tag}`, kind: 'CLASSROOM', learnerSeats: 10, trainerSeats: 0 } });
    expect(roomIdor.status).toBe(201);
    const trainerIdor = await api.call('POST', '/api/v1/trainers', { ...manager, body: { lastName: `Formateur${tag}`, firstName: 'Eli' } });
    expect(trainerIdor.status).toBe(201);
    const openSession = async (weeks: number) => {
      const planned = await api.call('POST', '/api/v1/sessions', { ...manager, body: { trainingId: trainingIdor.body.id, rhythm: 'DAY', startDate: mondayIn(weeks), roomId: roomIdor.body.id, trainerId: trainerIdor.body.id, capacity: 5 } });
      expect(planned.status).toBe(201);
      const opened = await api.call('POST', `/api/v1/sessions/${planned.body.id}/open`, { ...manager, body: { version: 1 } });
      expect(opened.status).toBe(200);
      return planned.body.id as string;
    };
    const trainingSession = await openSession(40);
    const trainingSession2 = await openSession(41);
    const learner = await api.call('POST', '/api/v1/learners', { ...m, body: { companyId: company2.body.id, lastName: 'Secret-APPRENANT-IDOR', firstName: 'Alain' } });
    expect(learner.status).toBe(201);
    const learner2 = await api.call('POST', '/api/v1/learners', { ...m, body: { companyId: company2.body.id, lastName: 'Secret-APPRENANT-IDOR', firstName: 'Brice' } });
    expect(learner2.status).toBe(201);
    const enrollment = await api.call('POST', '/api/v1/enrollments', { ...m, body: { sessionId: trainingSession, learnerId: learner.body.id, approvalId: approval.body.id } });
    expect(enrollment.status).toBe(201);
    const second = await login(marie);
    // Absences : un employé lié à un compte (Support), sa demande en attente, un type d'absence et un jour férié créés par la RH. Les attaquants n'en sont ni l'employé ni le responsable.
    const leaveUser = await createUserWithRoles(t, [RoleCode.Support]);
    const employeeLeave = await api.call('POST', '/api/v1/hr/employees', { ...hrSession, body: { lastName: 'Secret-CONGES-IDOR', firstName: 'Léa', jobTitle: 'Analyste', department: 'Finance', hiredOn: '2026-01-05', userId: leaveUser.id } });
    expect(employeeLeave.status).toBe(201);
    const leaveTypes = await api.call('GET', '/api/v1/hr/leave/types', hrSession);
    const annual = (leaveTypes.body as { id: string; code: string }[]).find((x) => x.code === 'ANNUAL')!;
    const leaveSession = await login(leaveUser);
    const leaveRequest = await api.call('POST', '/api/v1/hr/leave/requests', { ...leaveSession, body: { leaveTypeId: annual.id, start: futureMonday(2), end: futureMonday(2), note: 'Secret-ABSENCE-IDOR' } });
    expect(leaveRequest.status).toBe(201);
    const leaveType = await api.call('POST', '/api/v1/hr/leave/types', { ...hrSession, body: { code: `IDOR_${tag.toUpperCase()}`, label: 'Type IDOR' } });
    expect(leaveType.status).toBe(201);
    const holiday = await api.call('POST', '/api/v1/hr/leave/holidays', { ...hrSession, body: { day: new Date(Date.UTC(2040, 0, 1) + (holidaySeq++) * 86_400_000).toISOString().slice(0, 10), label: 'Secret-FERIE-IDOR' } });
    expect(holiday.status).toBe(201);
    // Contrats : un contrat en cours pour l'employé des absences, un autre (sans compte) pour la sonde de fin, un type créé par la RH. Aucun texte libre n'y figure.
    const contractTypes = await api.call('GET', '/api/v1/hr/contracts/types', hrSession);
    const cdi = (contractTypes.body as { id: string; code: string }[]).find((x) => x.code === 'CDI')!;
    const contract = await api.call('POST', '/api/v1/hr/contracts', { ...hrSession, body: { employeeId: employeeLeave.body.id, contractTypeId: cdi.id, start: '2026-02-01' } });
    expect(contract.status).toBe(201);
    const employeeEnd = await api.call('POST', '/api/v1/hr/employees', { ...hrSession, body: { lastName: 'Secret-CONTRAT-IDOR', firstName: 'Eve', jobTitle: 'Analyste', department: 'Finance', hiredOn: '2026-01-05' } });
    expect(employeeEnd.status).toBe(201);
    const contractEnd = await api.call('POST', '/api/v1/hr/contracts', { ...hrSession, body: { employeeId: employeeEnd.body.id, contractTypeId: cdi.id, start: '2026-02-01' } });
    expect(contractEnd.status).toBe(201);
    const contractType = await api.call('POST', '/api/v1/hr/contracts/types', { ...hrSession, body: { code: `IDOR_${tag.toUpperCase()}`, label: 'Type contrat IDOR', fixedTerm: false } });
    expect(contractType.status).toBe(201);
    // Parcours : un parcours d'intégration pour l'employé des absences (tâche à cocher), un autre pour l'employé sans compte (à annuler). Aucun texte libre n'y figure.
    const journey = await api.call('POST', '/api/v1/hr/journeys', { ...hrSession, body: { employeeId: employeeLeave.body.id, kind: 'ONBOARDING' } });
    expect(journey.status).toBe(201);
    const journeyCancel = await api.call('POST', '/api/v1/hr/journeys', { ...hrSession, body: { employeeId: employeeEnd.body.id, kind: 'ONBOARDING' } });
    expect(journeyCancel.status).toBe(201);
    const employeeReopen = await api.call('POST', '/api/v1/hr/employees', { ...hrSession, body: { lastName: 'Secret-PARCOURS-IDOR', firstName: 'Ona', jobTitle: 'Analyste', department: 'Finance', hiredOn: '2026-01-05' } });
    expect(employeeReopen.status).toBe(201);
    const journeyReopen = await api.call('POST', '/api/v1/hr/journeys', { ...hrSession, body: { employeeId: employeeReopen.body.id, kind: 'ONBOARDING' } });
    expect(journeyReopen.status).toBe(201);
    const checked = await api.call('POST', `/api/v1/hr/journeys/${journeyReopen.body.id}/tasks/${journeyReopen.body.tasks[0].id}/complete`, { ...hrSession, body: { version: 1 } });
    expect(checked.status).toBe(200);
    return {
      manager,
      marie: m,
      chef: chefSession,
      finance: financeSession,
      hr: hrSession,
      attackers: { paul: await login(paul), autreChef: await login(autreChef) },
      real: { company: company.body.id as string, doc: doc.body.id as string, session: second.sessionId, facilitator: facilitator.body.id as string, contact: contact.body.id as string, offer: offer.body.id as string, offerSent: offerSent.body.id as string, offerPending: offerPending.body.id as string, offerReceipt: offerReceipt.body.id as string, receipt: receipt.body.id as string, followup: followup.body.id as string, appointment: appointment.body.id as string, appointmentDue: appointmentDue.body.id as string, opportunity: opportunity.body.id as string, opportunityAgreed: opportunityAgreed.body.id as string, teammate: anne.id, opportunityReady: opportunityReady.body.id as string, approval: approval.body.id as string, approvalRequested: approvalRequested.body.id as string, commission: commission.id as string, commissionCompany: company3.body.id as string, ambassador: ambassador.body.id as string, employee: employee.body.id as string, employeeLeave: employeeLeave.body.id as string, leaveRequest: leaveRequest.body.id as string, leaveType: leaveType.body.id as string, holiday: holiday.body.id as string, contract: contract.body.id as string, contractEnd: contractEnd.body.id as string, contractType: contractType.body.id as string, journey: journey.body.id as string, journeyCancel: journeyCancel.body.id as string, journeyTask: journey.body.tasks[0].id as string, journeyReopen: journeyReopen.body.id as string, journeyReopenTask: journeyReopen.body.tasks[0].id as string, learnerCompany: company2.body.id as string, learner: learner.body.id as string, learner2: learner2.body.id as string, enrollment: enrollment.body.id as string, trainingSession, trainingSession2 } satisfies Ids,
      nil: { company: NIL, doc: NIL, session: NIL, facilitator: NIL, contact: NIL, offer: NIL, offerSent: NIL, offerPending: NIL, offerReceipt: NIL, receipt: NIL, followup: NIL, appointment: NIL, appointmentDue: NIL, opportunity: NIL, opportunityAgreed: NIL, teammate: NIL, opportunityReady: NIL, approval: NIL, approvalRequested: NIL, commission: NIL, commissionCompany: NIL, ambassador: NIL, employee: NIL, employeeLeave: NIL, leaveRequest: NIL, leaveType: NIL, holiday: NIL, contract: NIL, contractEnd: NIL, contractType: NIL, journey: NIL, journeyCancel: NIL, journeyTask: NIL, journeyReopen: NIL, journeyReopenTask: NIL, learnerCompany: NIL, learner: NIL, learner2: NIL, enrollment: NIL, trainingSession: NIL, trainingSession2: NIL } satisfies Ids,
      secondSession: second,
    };
  }

  it.each(objectRoutes)('%s : réponse identique pour un objet étranger et pour un objet inexistant, et l\'objet reste intact', async (key) => {
    const w = await world();
    const probe = PROBES[key];
    for (const [name, attacker] of Object.entries(w.attackers)) {
      // Exception documentée (matrice RBAC) : le Responsable commercial a la lecture « Tous » sur les opportunités ; seule l'écriture suit la portée.
      if (name === 'autreChef' && READ_ALL_FOR_HEAD_OF_SALES.includes(key)) continue;
      const onForeign = await probe(api, attacker, w.real);
      const onMissing = await probe(api, attacker, w.nil);
      // Même statut ET même corps : aucun indice sur l'existence de l'objet.
      expect([name, onForeign.status, onForeign.body]).toEqual([name, onMissing.status, onMissing.body]);
      expect([name, onForeign.status < 400]).toEqual([name, false]);
      // Aucune donnée de l'objet ne fuit.
      expect(onForeign.bytes.toString('utf8')).not.toContain('piece.pdf');
      expect(onForeign.bytes.toString('utf8')).not.toContain(w.real.company);
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('ContactIdor');
      expect(onForeign.bytes.toString('utf8')).not.toContain('alain.idor');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-OFFRE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Offre déposée IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-RECEPISSE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-RELANCE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-RDV-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-OPPORTUNITE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('2500000');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-AMBASSADEUR-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-EMPLOYE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-CONGES-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-ABSENCE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-FERIE-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-CONTRAT-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-PARCOURS-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Type contrat IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-APPRENANT-IDOR');
      expect(onForeign.bytes.toString('utf8')).not.toContain('Offre en attente de décharge');
    }
    // Contrôle positif : le propriétaire, lui, réussit (le test n'est pas vide), puis les dégâts éventuels sont vérifiés.
    // L'archivage exige le droit de suppression, que Marie n'a pas : c'est son chef (même équipe) qui l'exerce.
    // La dérogation et la clôture « gagnée » (D28) relèvent du Responsable commercial.
    // Constater le paiement relève de la Finance (D41, FD-4), pas du Responsable commercial.
    // Débloquer et mettre en attente relèvent de la Finance ; verser, du chargé de compte ; annuler et fixer le montant, du Responsable commercial.
    const financeKeys = ['POST /approvals/:id/honor', 'POST /commissions/:id/release', 'POST /commissions/:id/hold'];
    const hrKeys = ['POST /hr/employees', 'GET /hr/employees/:id', 'PUT /hr/employees/:id', 'POST /hr/employees/:id/status', 'POST /hr/leave/requests', 'GET /hr/leave/requests/:id', 'POST /hr/leave/requests/:id/decision', 'POST /hr/leave/requests/:id/cancel', 'GET /hr/leave/balance', 'PUT /hr/leave/types/:id', 'DELETE /hr/leave/holidays/:id', 'POST /hr/leave/adjustments', 'GET /hr/leave/adjustments', 'GET /hr/contracts/:id', 'PUT /hr/contracts/:id', 'POST /hr/contracts/:id/end', 'PUT /hr/contracts/types/:id', 'GET /hr/journeys/:id', 'POST /hr/journeys/:id/cancel', 'POST /hr/journeys/:id/tasks/:taskId/complete', 'POST /hr/journeys/:id/tasks/:taskId/reopen', 'PUT /hr/journeys/templates/:kind'];
    const trainingManagerKeys = ['DELETE /learners/:id', 'POST /enrollments/:id/confirm', 'POST /enrollments/:id/cancel', 'POST /enrollments/:id/replace'];
    const owner = hrKeys.includes(key) ? w.hr : trainingManagerKeys.includes(key) ? w.manager : financeKeys.includes(key) ? w.finance : ['POST /commissions/:id/cancel', 'POST /commissions/:id/amount'].includes(key) ? w.chef : ['POST /documents/:id/archive', 'DELETE /contacts/:id', 'POST /opportunities/:id/waiver', 'POST /opportunities/:id/close-won', 'POST /companies/:id/owner', 'PUT /ambassadors/:id', 'POST /ambassadors/:id/status', 'POST /approvals/:id/expire', 'POST /approvals/:id/cancel'].includes(key) ? w.chef : w.marie;
    const ok = await probe(api, owner, w.real);
    // Payer une commission non débloquée, ou fixer le montant d'une commission déjà chiffrée, est refusé (422) : le refus d'une règle métier prouve que la portée est franchie.
    const businessRefusal = ['POST /commissions/:id/pay', 'POST /commissions/:id/amount'].includes(key);
    expect([key, businessRefusal ? ok.status === 422 : ok.status < 300]).toEqual([key, true]);
  }, 60_000);

  it('aucune écriture n\'a lieu quand l\'attaquant échoue : ni version, ni archivage, ni révocation', async () => {
    const w = await world();
    for (const attacker of Object.values(w.attackers)) {
      await PROBES['POST /documents/:id/versions'](api, attacker, w.real);
      await PROBES['POST /documents/:id/archive'](api, attacker, w.real);
      await PROBES['DELETE /auth/sessions/:id'](api, attacker, w.real);
      await PROBES['POST /documents'](api, attacker, w.real);
    }
    // La fiche de Marie n'a pas été modifiée non plus par les tentatives de modification.
    expect((await api.call('GET', `/api/v1/companies/${w.real.company}`, w.marie)).body.sector).toBeNull();
    // Le contact de Marie n'a été ni modifié, ni supprimé, et aucun contact piège n'a été créé.
    const contacts = await api.call('GET', `/api/v1/contacts?companyId=${w.real.company}`, w.marie);
    expect(contacts.body.items.map((c: { lastName: string; phone: string | null }) => [c.lastName, c.phone])).toEqual([['ContactIdor', null]]);
    // Les offres de Marie n'ont pas bougé : même sujet, même état, version inchangée, et aucune offre piège n'a été créée.
    const offers = await api.call('GET', `/api/v1/offers?companyId=${w.real.company}`, w.marie);
    for (const attacker of Object.values(w.attackers)) {
      for (const key of ['PUT /offers/:id', 'POST /offers/:id/submit', 'POST /offers/:id/accept', 'POST /offers/:id/refuse', 'POST /offers/:id/withdraw', 'POST /offers']) await PROBES[key](api, attacker, w.real);
    }
    const offersAfter = await api.call('GET', `/api/v1/offers?companyId=${w.real.company}`, w.marie);
    expect(offersAfter.body.items.map((o: { subject: string; status: string; version: number }) => [o.subject, o.status, o.version]).sort())
      .toEqual(offers.body.items.map((o: { subject: string; status: string; version: number }) => [o.subject, o.status, o.version]).sort());
    expect(offersAfter.body.total).toBe(4);
    // La décharge de Marie est intacte (valide, version 1) et l'offre en attente n'a reçu aucune décharge piège.
    for (const attacker of Object.values(w.attackers)) {
      for (const key of ['POST /receipts', 'POST /receipts/:id/cancel']) await PROBES[key](api, attacker, w.real);
    }
    const receipts = await api.call('GET', `/api/v1/receipts?offerId=${w.real.offerPending}`, w.marie);
    expect(receipts.body).toEqual([]);
    const kept = await api.call('GET', `/api/v1/receipts/${w.real.receipt}`, w.marie);
    expect(kept.body).toMatchObject({ status: 'VALID', version: 1 });
    expect((await api.call('GET', `/api/v1/offers/${w.real.offerPending}`, w.marie)).body.status).toBe('SUBMITTED');
    // La relance de Marie est intacte (à faire, version 1, même note) et aucune relance piège n'a été planifiée.
    for (const attacker of Object.values(w.attackers)) {
      for (const key of ['POST /followups', 'PUT /followups/:id', 'POST /followups/:id/complete', 'POST /followups/:id/cancel']) await PROBES[key](api, attacker, w.real);
    }
    const followups = await api.call('GET', `/api/v1/followups?offerId=${w.real.offerReceipt}`, w.marie);
    expect(followups.body.items).toHaveLength(1);
    expect(followups.body.items[0]).toMatchObject({ status: 'PLANNED', version: 1, note: 'Secret-RELANCE-IDOR' });
    // Les rendez-vous de Marie sont intacts (à venir, version 1, même note) et aucun rendez-vous piège n'a été planifié.
    for (const attacker of Object.values(w.attackers)) {
      for (const key of ['POST /appointments', 'PUT /appointments/:id', 'POST /appointments/:id/postpone', 'POST /appointments/:id/hold', 'POST /appointments/:id/cancel']) await PROBES[key](api, attacker, w.real);
    }
    const agenda = await PROBES['GET /appointments'](api, w.marie, w.real);
    expect(agenda.body.items).toHaveLength(2);
    for (const item of agenda.body.items) expect(item).toMatchObject({ status: 'PLANNED', version: 1, note: 'Secret-RDV-IDOR' });
    // Les opportunités de Marie sont intactes (ouvertes, version 1, même étape) et aucune opportunité piège n'a été créée.
    for (const attacker of Object.values(w.attackers)) {
      for (const key of ['POST /opportunities', 'PUT /opportunities/:id', 'POST /opportunities/:id/advance', 'POST /opportunities/:id/waiver', 'POST /opportunities/:id/close-lost', 'POST /opportunities/:id/close-won']) await PROBES[key](api, attacker, w.real);
    }
    const pipeline = await PROBES['GET /opportunities'](api, w.marie, w.real);
    expect(pipeline.body.items).toHaveLength(2);
    for (const item of pipeline.body.items) expect(item).toMatchObject({ status: 'OPEN', version: 1, waiverReason: null });
    expect(pipeline.body.items.map((i: { stage: string }) => i.stage).sort()).toEqual(['AGREEMENT_IN_PRINCIPLE', 'QUALIFICATION']);
    const detail = await api.call('GET', `/api/v1/documents/${w.real.doc}`, w.marie);
    expect(detail.status).toBe(200);
    expect(detail.body.versions).toHaveLength(1);
    expect(detail.body.status).not.toBe('ARCHIVED');
    const list = await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${w.real.company}`, w.marie);
    expect(list.body).toHaveLength(1);
    const revoked = await t.prisma.db.userSession.findUnique({ where: { id: w.real.session } });
    expect(revoked?.revokedAt).toBeNull();
  }, 60_000);

  it("lier une entreprise au facilitateur d'un collègue : même réponse que pour un facilitateur inexistant, et rien n'est créé", async () => {
    const w = await world();
    const attempt = (facilitatorId: string, name: string) =>
      api.call('POST', '/api/v1/companies', { ...w.attackers.paul, body: { name, facilitation: { facilitatorId, contactMethod: 'EMAIL' } } });
    const foreign = await attempt(w.real.facilitator, 'Piège A');
    const missing = await attempt(NIL, 'Piège B');
    expect(foreign.status).toBe(404);
    expect([foreign.status, foreign.body.message]).toEqual([missing.status, missing.body.message]);
    expect(foreign.bytes.toString('utf8')).not.toContain('Secret-IDOR');
    const list = await api.call('GET', '/api/v1/companies?pageSize=100&search=Pi%C3%A8ge', w.attackers.paul);
    expect(list.body.total).toBe(0);
  }, 60_000);

  it('la liste des facilitateurs ne montre à chacun que les siens', async () => {
    const w = await world();
    const list = await api.call('GET', '/api/v1/facilitators?pageSize=100', w.attackers.paul);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(w.real.facilitator);
  }, 60_000);

  it('la liste des entreprises ne montre à chaque chargé de compte que les siennes', async () => {
    const w = await world();
    const list = await api.call('GET', '/api/v1/companies?pageSize=100', w.attackers.paul);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(w.real.company);
  }, 60_000);
});
