import {
  AddDocumentVersionUseCase, ArchiveDocumentUseCase, DocumentOwnerGate, DownloadDocumentUseCase, GetDocumentHandler, ListDocumentsHandler,
  UploadDocumentUseCase, sha256Of,
} from '../src/modules/documents/application/document-use-cases';
import { DocumentOwnerResolver, InMemoryDocumentOwnerRegistry } from '../src/modules/documents/application/owner-registry';
import { Document, DocumentVersion } from '../src/modules/documents/domain/document';
import { DocumentRepository, ObjectStorage } from '../src/modules/documents/domain/ports';
import { AuditRecord } from '../src/modules/audit';
import { decideFor, resolveGrants } from '../src/modules/iam';
import type { AccessContext } from '../src/modules/iam';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { actor } from './support/iam-fakes';

const pdf = (extra = '') => Buffer.from(`%PDF-1.7\n${extra}%%EOF`);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);

class InMemoryDocuments implements DocumentRepository {
  readonly documents = new Map<string, Document>();
  readonly versions: DocumentVersion[] = [];
  failNextCreate = false;
  async createWithVersion(document: Document, version: DocumentVersion) {
    if (this.failNextCreate) { this.failNextCreate = false; throw new Error('panne de base'); }
    this.documents.set(document.id, document);
    this.versions.push(version);
  }
  async addVersion(document: Document, version: DocumentVersion) { this.documents.set(document.id, document); this.versions.push(version); }
  async save(document: Document) { this.documents.set(document.id, document); }
  async findById(id: string) { return this.documents.get(id) ?? null; }
  async findVersion(documentId: string, n: number) { return this.versions.find((v) => v.documentId === documentId && v.versionNumber === n) ?? null; }
  async listVersions(documentId: string) { return this.versions.filter((v) => v.documentId === documentId); }
  async listByOwner(ownerType: string, ownerId: string, includeArchived: boolean) {
    return [...this.documents.values()].filter((d) => d.ownerType === ownerType && d.ownerId === ownerId && (includeArchived || !d.isArchived));
  }
  async currentVersions(ids: readonly string[]) {
    return ids.flatMap((id) => { const d = this.documents.get(id)!; return this.versions.filter((v) => v.documentId === id && v.versionNumber === d.currentVersionNumber); });
  }
}

class InMemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Buffer>();
  async put(key: string, data: Buffer) { this.objects.set(key, data); }
  async get(key: string) { const found = this.objects.get(key); if (!found) throw new Error('absent'); return found; }
  async removeOrphan(key: string) { this.objects.delete(key); }
}

const access = (actorId: string, role: RoleCode, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });

function build() {
  const repo = new InMemoryDocuments();
  const storage = new InMemoryStorage();
  const audit: AuditRecord[] = [];
  const companies = new Map<string, string | null>([['co-marie', 'marie'], ['co-paul', 'paul']]);
  const registry = new InMemoryDocumentOwnerRegistry();
  const resolver: DocumentOwnerResolver = {
    async resolve(ownerId, ctx) {
      if (!companies.has(ownerId)) return null;
      const ownerUserId = companies.get(ownerId)!;
      return decideFor(ctx, 'bd.company.read', ownerUserId).allowed ? { ownerUserId } : null;
    },
  };
  registry.register('company', resolver);
  let n = 0;
  const ids = { next: () => `id-${++n}` };
  const clock = { now: () => new Date('2026-10-22T09:00:00.000Z') };
  const uow = { run: <T>(work: () => Promise<T>) => work() };
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const gate = new DocumentOwnerGate(registry);
  return {
    repo, storage, audit, registry,
    upload: new UploadDocumentUseCase(repo, storage, gate, recorder, uow, clock, ids),
    addVersion: new AddDocumentVersionUseCase(repo, storage, gate, recorder, uow, clock, ids),
    list: new ListDocumentsHandler(repo, gate),
    get: new GetDocumentHandler(repo, gate),
    download: new DownloadDocumentUseCase(repo, storage, gate, recorder),
    archive: new ArchiveDocumentUseCase(repo, gate, recorder, uow),
  };
}

const marie = access('marie', RoleCode.AccountManager);
const paul = access('paul', RoleCode.AccountManager);
const chef = access('chef', RoleCode.HeadOfSales, ['marie']);
const direction = access('dir', RoleCode.Direction);
const sendBy = (a: AccessContext) => actor({ userId: a.actorId });
const base = { ownerType: 'company', ownerId: 'co-marie', title: 'Décharge signée', category: 'DECHARGE', fileName: 'decharge.pdf' };

describe('Envoi d\'un document', () => {
  it('stocke le contenu sous une clé ALÉATOIRE, calcule le SHA-256, crée la version 1 et trace l\'envoi', async () => {
    const w = build();
    const bytes = pdf('contenu');
    const view = await w.upload.execute({ ...base, bytes, access: marie, actor: sendBy(marie) });
    expect(view.current).toMatchObject({ number: 1, fileName: 'decharge.pdf', mimeType: 'application/pdf', sizeBytes: bytes.length, sha256: sha256Of(bytes), scanStatus: 'PENDING' });
    const [key] = [...w.storage.objects.keys()];
    expect(key).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{48}$/);
    expect(key).not.toContain('decharge');
    expect(w.audit.at(-1)).toMatchObject({ module: 'docs', action: 'CREATE', entityId: view.id, newValue: { sha256: sha256Of(bytes), version: 1, ownerType: 'company', ownerId: 'co-marie' } });
  });
  it('la réponse n\'expose ni la clé de stockage ni l\'identifiant de l\'auteur', async () => {
    const w = build();
    const view = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/storageKey|uploadedBy|createdBy/);
    expect(json).not.toContain([...w.storage.objects.keys()][0]);
  });
  it('refus sur l\'entreprise d\'un autre (hors portée) : « introuvable », rien n\'est stocké', async () => {
    const w = build();
    await expect(w.upload.execute({ ...base, ownerId: 'co-paul', bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.storage.objects.size).toBe(0);
    expect(w.audit).toHaveLength(0);
  });
  it('le chef d\'équipe peut envoyer sur l\'entreprise de son équipe, pas sur celle d\'un étranger à l\'équipe', async () => {
    const w = build();
    await expect(w.upload.execute({ ...base, bytes: pdf(), access: chef, actor: sendBy(chef) })).resolves.toBeDefined();
    await expect(w.upload.execute({ ...base, ownerId: 'co-paul', bytes: pdf(), access: chef, actor: sendBy(chef) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('un rôle sans droit d\'envoi (Direction : lecture seule) est refusé', async () => {
    const w = build();
    await expect(w.upload.execute({ ...base, bytes: pdf(), access: direction, actor: sendBy(direction) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('type d\'objet inconnu ou objet inexistant : refus net, rien n\'est stocké', async () => {
    const w = build();
    await expect(w.upload.execute({ ...base, ownerType: 'offre', bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.upload.execute({ ...base, ownerId: 'inconnu', bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.storage.objects.size).toBe(0);
  });
  it('fichier invalide (contenu qui ne correspond pas, catégorie inconnue, titre vide) : refusé avant tout stockage', async () => {
    const w = build();
    await expect(w.upload.execute({ ...base, bytes: png(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.upload.execute({ ...base, category: 'PIRATE', bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.upload.execute({ ...base, title: '   ', bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.storage.objects.size).toBe(0);
  });
  it('si la base échoue après l\'écriture du fichier, l\'objet orphelin est retiré et aucune trace d\'audit ne reste', async () => {
    const w = build();
    w.repo.failNextCreate = true;
    await expect(w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) })).rejects.toThrow('panne de base');
    expect(w.storage.objects.size).toBe(0);
    expect(w.audit).toHaveLength(0);
  });
});

describe('Versions', () => {
  it('ajoute la version 2 sans toucher à la 1 : les deux restent téléchargeables', async () => {
    const w = build();
    const v1 = pdf('première');
    const v2 = pdf('seconde');
    const doc = await w.upload.execute({ ...base, bytes: v1, access: marie, actor: sendBy(marie) });
    const updated = await w.addVersion.execute({ documentId: doc.id, fileName: 'decharge-v2.pdf', bytes: v2, access: marie, actor: sendBy(marie) });
    expect(updated.current.number).toBe(2);
    expect(w.storage.objects.size).toBe(2);
    const first = await w.download.execute({ id: doc.id, versionNumber: 1, access: marie, actor: sendBy(marie) });
    const current = await w.download.execute({ id: doc.id, access: marie, actor: sendBy(marie) });
    expect([first.bytes.equals(v1), current.bytes.equals(v2), current.versionNumber]).toEqual([true, true, 2]);
    const detail = await w.get.execute({ id: doc.id, access: marie });
    expect(detail.versions.map((v) => v.number)).toEqual([2, 1]);
  });
  it('une version sur le document d\'un autre est « introuvable » ; sur un document archivé, refusée sans rien stocker', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await expect(w.addVersion.execute({ documentId: doc.id, fileName: 'x.pdf', bytes: pdf('x'), access: paul, actor: sendBy(paul) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await w.archive.execute({ id: doc.id, access: chef, actor: sendBy(chef) });
    const before = w.storage.objects.size;
    await expect(w.addVersion.execute({ documentId: doc.id, fileName: 'x.pdf', bytes: pdf('x'), access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.storage.objects.size).toBe(before);
  });
});

describe('Lecture et téléchargement', () => {
  it('un document n\'est jamais plus accessible que son entreprise : liste, détail et téléchargement hors portée sont « introuvables »', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await expect(w.list.execute({ ownerType: 'company', ownerId: 'co-marie', includeArchived: false, access: paul })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: doc.id, access: paul })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.download.execute({ id: doc.id, access: paul, actor: sendBy(paul) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: 'inexistant', access: marie })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('la Direction (portée Tous, lecture) lit et télécharge ; le chef d\'équipe aussi pour son équipe', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await expect(w.download.execute({ id: doc.id, access: direction, actor: sendBy(direction) })).resolves.toBeDefined();
    await expect(w.download.execute({ id: doc.id, access: chef, actor: sendBy(chef) })).resolves.toBeDefined();
    expect((await w.list.execute({ ownerType: 'company', ownerId: 'co-marie', includeArchived: false, access: direction })).map((d) => d.id)).toEqual([doc.id]);
  });
  it('chaque téléchargement est audité (qui, quelle version, quelle empreinte)', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf('a'), access: marie, actor: sendBy(marie) });
    await w.download.execute({ id: doc.id, access: marie, actor: sendBy(marie) });
    expect(w.audit.at(-1)).toMatchObject({ action: 'DOWNLOAD', entityId: doc.id, newValue: { version: 1, sha256: sha256Of(pdf('a')) } });
  });
  it('contenu altéré ou perdu : empreinte différente → refus, incident audité, rien n\'est servi', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf('intact'), access: marie, actor: sendBy(marie) });
    const key = [...w.storage.objects.keys()][0];
    w.storage.objects.set(key, pdf('ALTÉRÉ'));
    await expect(w.download.execute({ id: doc.id, access: marie, actor: sendBy(marie) })).rejects.toThrow(/Empreinte SHA-256/);
    expect(w.audit.at(-1)).toMatchObject({ action: 'DOWNLOAD', newValue: { event: 'integrity_failed', version: 1 } });
    w.storage.objects.delete(key);
    await expect(w.download.execute({ id: doc.id, access: marie, actor: sendBy(marie) })).rejects.toThrow();
  });
  it('version inexistante : « introuvable »', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await expect(w.download.execute({ id: doc.id, versionNumber: 9, access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Archivage (suppression logique)', () => {
  it('archive sans rien effacer : le document disparaît de la liste par défaut, reste lisible et ses fichiers sont conservés', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await w.archive.execute({ id: doc.id, access: chef, actor: sendBy(chef) });
    expect(await w.list.execute({ ownerType: 'company', ownerId: 'co-marie', includeArchived: false, access: marie })).toHaveLength(0);
    expect(await w.list.execute({ ownerType: 'company', ownerId: 'co-marie', includeArchived: true, access: marie })).toHaveLength(1);
    expect(w.storage.objects.size).toBe(1);
    await expect(w.download.execute({ id: doc.id, access: marie, actor: sendBy(marie) })).resolves.toBeDefined();
    expect(w.audit.find((r) => r.action === 'DELETE')).toMatchObject({ newValue: { event: 'archived' } });
  });
  it('répéter l\'archivage est sans effet (une seule trace)', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await w.archive.execute({ id: doc.id, access: chef, actor: sendBy(chef) });
    await w.archive.execute({ id: doc.id, access: chef, actor: sendBy(chef) });
    expect(w.audit.filter((r) => r.action === 'DELETE')).toHaveLength(1);
  });
  it('l\'archivage exige le droit de suppression (le chargé de compte n\'en a pas) et l\'accès à l\'entreprise', async () => {
    const w = build();
    const doc = await w.upload.execute({ ...base, bytes: pdf(), access: marie, actor: sendBy(marie) });
    await expect(w.archive.execute({ id: doc.id, access: marie, actor: sendBy(marie) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const other = access('autre-chef', RoleCode.HeadOfSales);
    await expect(w.archive.execute({ id: doc.id, access: other, actor: sendBy(other) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Registre des objets propriétaires', () => {
  it('un type ne peut être déclaré qu\'une fois (erreur de composition, pas un écrasement silencieux)', () => {
    const w = build();
    expect(() => w.registry.register('company', { resolve: async () => null })).toThrow(/déjà déclaré/);
    expect(w.registry.types()).toEqual(['company']);
    expect(w.registry.resolver('offre')).toBeNull();
  });
});
