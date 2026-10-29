import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { InMemoryFacilitators } from '../../../../test/support/in-memory-facilitators';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { esc, renderCompanySheet } from './company-sheet';
import { CompanyView } from './company-view';
import { ExportCompanySheetHandler } from './export-company-sheet.query';
import { FacilitationResolver } from './facilitation-resolver';
import { RegisterCompanyUseCase } from './register-company.use-case';
import { RegisterFacilitatorUseCase } from './register-facilitator.use-case';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's-42', ipAddress: '10.0.0.9', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });

function build() {
  const companies = new InMemoryCompanies();
  const facilitators = new InMemoryFacilitators();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const clock = { now: () => new Date('2026-10-30T10:00:00Z') };
  const ids = { next: () => `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}` };
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const resolver = new FacilitationResolver(facilitators, new RegisterFacilitatorUseCase(facilitators, recorder, unitOfWork, clock, ids));
  const register = new RegisterCompanyUseCase(companies, resolver, recorder, unitOfWork, clock, ids);
  const exporter = new ExportCompanySheetHandler(companies, facilitators, recorder, clock);
  return { audit, register, exporter };
}

const view = (patch: Partial<CompanyView> = {}): CompanyView => ({
  id: '00000000-0000-7000-8000-00000000abcd', name: 'Acme', status: 'TARGET', ownerUserId: 'u1', sector: 'Banque', country: 'Cameroun',
  email: 'a@acme.cm', phone: '+237 222 33 44 55', createdAt: '2026-10-28T09:00:00.000Z', version: 1, ...patch,
});

describe('fiche imprimable — contenu et sécurité', () => {
  it('échappe tout texte saisi : aucun HTML ni script ne passe', () => {
    expect(esc(`<script>alert(1)</script> & "x" 'y'`)).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; &#39;y&#39;');
    const html = renderCompanySheet(view({ name: '<img src=x onerror=alert(1)>', sector: '"><script>x()</script>' }), new Date('2026-10-30T10:00:00Z'));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>x()');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('un commentaire de facilitateur piégé est neutralisé aussi', () => {
    const html = renderCompanySheet(view({
      facilitation: { facilitatorId: 'f', contactMethod: 'EMAIL', isCompanyEmployee: false, facilitator: { id: 'f', lastName: 'X', firstName: 'Y', phone: '+237 600 00 00 01', comment: '</dd><script>alert(2)</script>', ownerUserId: 'u1', createdAt: '2026-10-28T09:00:00.000Z' } },
    }), new Date());
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;/dd&gt;&lt;script&gt;');
  });
  it('le document ne contient aucun script, aucune ressource externe ni lien sortant', () => {
    const html = renderCompanySheet(view(), new Date());
    expect(html).not.toMatch(/<script|<link|<iframe|src=|href=|@import|url\(/i);
  });
  it('affiche les coordonnées, la date et la référence ; « — » pour un champ vide', () => {
    const html = renderCompanySheet(view({ phone: null }), new Date('2026-10-30T10:00:00Z'));
    expect(html).toContain('Acme');
    expect(html).toContain('a@acme.cm');
    expect(html).toContain('28 octobre 2026');
    expect(html).toContain('30 octobre 2026');
    expect(html).toContain('FIC-0000ABCD');
    expect(html).toContain('<span class="muted">—</span>');
  });
  it('commission : montant FCFA, pourcentage, ou « Aucune » ; absente de la vue = absente du document', () => {
    const base = { facilitatorId: 'f', contactMethod: 'PHONE_CALL', isCompanyEmployee: true, facilitator: null };
    expect(renderCompanySheet(view({ facilitation: { ...base, commission: { type: 'FIXED', value: '250000.00', currency: 'XAF' } } }), new Date()).replace(/\s/g, ' ')).toContain('250 000,00 FCFA');
    expect(renderCompanySheet(view({ facilitation: { ...base, commission: { type: 'PERCENT', value: '7.50', currency: null } } }), new Date()).replace(/\s/g, ' ')).toContain('7,50 %');
    expect(renderCompanySheet(view({ facilitation: { ...base, commission: null } }), new Date())).toContain('Aucune');
    const hidden = renderCompanySheet(view({ facilitation: { ...base } }), new Date());
    expect(hidden).not.toContain('Commission');
    expect(hidden).toContain('Non visible avec vos droits');
  });
});

describe('ExportCompanySheetHandler — qui voit exporte, et chaque export est tracé', () => {
  async function setup() {
    const w = build();
    const am1 = as(RoleCode.AccountManager, 'am1');
    const created = await w.register.execute({
      name: 'Acme', ownerUserId: 'am1', access: am1, actor,
      facilitation: { newFacilitator: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 600 00 00 01' }, contactMethod: 'EMAIL' },
    });
    // La commission est définie par le Responsable commercial (équipe de am1).
    return { ...w, id: created.id, am1 };
  }

  it('le propriétaire exporte sa fiche ; l\'export est tracé (qui, session, d\'où) sans recopier les données', async () => {
    const { exporter, id, am1, audit } = await setup();
    audit.length = 0;
    const out = await exporter.execute({ id, access: am1, actor });
    expect(out.html).toContain('Acme');
    expect(out.fileName).toMatch(/^FIC-[0-9A-F]{8}\.html$/);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: AuditAction.Export, entityType: 'Company', entityId: id, actor: { sessionId: 's-42', ipAddress: '10.0.0.9' } });
    expect(JSON.stringify(audit[0].newValue)).not.toContain('Mbarga');
    expect(audit[0].newValue).toMatchObject({ document: 'fiche-entreprise', includesFacilitator: true });
  });

  it('IDOR : la fiche d\'un collègue est « introuvable » (même réponse qu\'un identifiant inexistant) et ne laisse aucune trace d\'export', async () => {
    const { exporter, id, audit } = await setup();
    audit.length = 0;
    const am2 = as(RoleCode.AccountManager, 'am2');
    const real = await exporter.execute({ id, access: am2, actor }).catch((e) => e);
    const missing = await exporter.execute({ id: 'inconnue', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(audit).toHaveLength(0);
  });

  it('chaque rôle exporte dans sa portée : Direction et Support voient tout, le Responsable commercial son équipe', async () => {
    const { exporter, id } = await setup();
    await expect(exporter.execute({ id, access: as(RoleCode.Direction, 'dir'), actor })).resolves.toBeDefined();
    await expect(exporter.execute({ id, access: as(RoleCode.Support, 'sup'), actor })).resolves.toBeDefined();
    await expect(exporter.execute({ id, access: as(RoleCode.HeadOfSales, 'chef', ['am1']), actor })).resolves.toBeDefined();
    await expect(exporter.execute({ id, access: as(RoleCode.HeadOfSales, 'autre', ['am2']), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(exporter.execute({ id, access: as(RoleCode.Hr, 'rh'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('le document ne contient que ce que l\'appelant voit : le Support n\'a ni facilitateur ni commission', async () => {
    const { exporter, id } = await setup();
    const support = await exporter.execute({ id, access: as(RoleCode.Support, 'sup'), actor });
    expect(support.html).not.toContain('Mbarga');
    expect(support.html).not.toContain('Commission');
    expect(support.html).toContain('Non visible avec vos droits');
    const owner = await exporter.execute({ id, access: as(RoleCode.AccountManager, 'am1'), actor });
    expect(owner.html).toContain('Paul Mbarga');
  });

  it('si l\'audit échoue, rien n\'est remis', async () => {
    const w = await setup();
    const failing = new ExportCompanySheetHandler(
      (w.exporter as unknown as { companies: CompanyRepository }).companies,
      (w.exporter as unknown as { facilitators: InMemoryFacilitators }).facilitators,
      { record: async () => { throw new Error('audit indisponible'); } },
      { now: () => new Date() },
    );
    await expect(failing.execute({ id: w.id, access: w.am1, actor })).rejects.toThrow('audit indisponible');
  });
});
