from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
training = os.path.join(api, 'src', 'modules', 'training')
cert = os.path.join(training, 'domain', 'certification.ts')
cuc = os.path.join(training, 'application', 'certification-use-cases.ts')
cctl = os.path.join(training, 'presentation', 'certification.controller.ts')
actl = os.path.join(training, 'presentation', 'ambassador-suggestions.controller.ts')
prep = os.path.join(training, 'infrastructure', 'prisma-certification.repository.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261124000000_s5_3c_certifications_ambassadeurs', 'migration.sql')
roles = os.path.join(api, 'src', 'modules', 'iam', 'domain', 'roles.ts')
DB = 'db:sessions-http'
M = [
 # --- Domaine : délivrance et révocation
 ('D1 un type délivré invalide est accepté', cert, "static issue(input: { id: string; enrollmentId: string; kind: string; referenceNumber: string; issuedByUserId: string; now: Date }): Certification {\n    return new Certification({\n      id: input.id, enrollmentId: input.enrollmentId, kind: parseCertificationKind(input.kind), referenceNumber: input.referenceNumber, status: 'ISSUED',", "static issue(input: { id: string; enrollmentId: string; kind: string; referenceNumber: string; issuedByUserId: string; now: Date }): Certification {\n    return new Certification({\n      id: input.id, enrollmentId: input.enrollmentId, kind: input.kind as CertificationKind, referenceNumber: input.referenceNumber, status: 'ISSUED',", 'unit'),
 ('D2 la délivrance commence à la version 2', cert, "revokedByUserId: null, revokedAt: null, revokeReason: null, version: 1,", "revokedByUserId: null, revokedAt: null, revokeReason: null, version: 2,", 'unit'),
 ('D3 révoquer un certificat déjà révoqué réussit', cert, "if (this.props.status === 'REVOKED') throw new DomainError('INVARIANT_VIOLATION', 'Cette délivrance est déjà révoquée');", "", 'unit'),
 ('D4 révoquer sans motif est accepté', cert, "if (!reason) throw new DomainError('VALIDATION', 'La justification de la révocation est obligatoire');", "", 'unit'),
 ('D5 un motif de révocation trop long est accepté', cert, "if (reason.length > 500) throw new DomainError('VALIDATION', 'La justification ne peut dépasser 500 caractères');", "", 'unit'),
 ('D6 révoquer ne retient plus l’auteur', cert, "this.props = { ...this.props, status: 'REVOKED', revokedByUserId: input.by, revokedAt: input.now, revokeReason: reason };", "this.props = { ...this.props, status: 'REVOKED', revokedByUserId: null, revokedAt: input.now, revokeReason: reason };", 'unit'),
 ('D7 révoquer ne retient plus la date', cert, "this.props = { ...this.props, status: 'REVOKED', revokedByUserId: input.by, revokedAt: input.now, revokeReason: reason };", "this.props = { ...this.props, status: 'REVOKED', revokedByUserId: input.by, revokedAt: null, revokeReason: reason };", 'unit'),
 # --- Cas d'usage : délivrance
 ('U1 délivrer accepté sans que la session soit clôturée', cuc, "if (session.status !== 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session doit être clôturée avant de délivrer un certificat ou une attestation');", "", DB),
 ('U2 délivrer accepté pour une inscription non confirmée', cuc, "if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', 'Seuls les inscrits confirmés peuvent recevoir un certificat ou une attestation');", "", 'unit'),
 ('U3 délivrer accepté pour une inscription d’une autre session', cuc, "if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", "if (!enrollment) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);", 'unit'),
 ('U4 une seconde délivrance pour la même inscription est acceptée', cuc, "if (await this.certifications.find(enrollment.id)) throw new DomainError('INVARIANT_VIOLATION', 'Une délivrance existe déjà pour cette inscription (la révoquer avant d’en délivrer une autre)');", "", 'unit'),
 ('U5 un certificat se délivre sans que la note atteigne le seuil', cuc, "if (eligibility === 'NONE' || (command.kind === 'CERTIFICATE' && eligibility !== 'CERTIFICATE')) {", "if (false) {", 'unit'),
 ('U6 une délivrance est acceptée même si aucun seuil n’est atteint', cuc, "if (eligibility === 'NONE' || (command.kind === 'CERTIFICATE' && eligibility !== 'CERTIFICATE')) {", "if (command.kind === 'CERTIFICATE' && eligibility !== 'CERTIFICATE') {", 'unit'),
 ('U7 une suggestion d’ambassadeur se crée pour un apprenant sans entreprise', cuc, "if (enrollment.companyId) {\n        const company = await this.directory.company(enrollment.companyId);\n        if (company?.ownerUserId) {", "if (true) {\n        const company = await this.directory.company(enrollment.companyId!);\n        if (company?.ownerUserId) {", DB),
 # --- Cas d'usage : feuille de délivrances et suggestions
 ('U8 la feuille n’est plus filtrée par entreprise pour la portée restreinte', cuc, "confirmed = confirmed.filter((e) => e.companyId && ownedCompanyIds.has(e.companyId));", "", 'unit'),
 ('U9 le formateur voit une session qui n’est pas la sienne', cuc, "const trainerLinked = Boolean(trainer?.userId) && visibility.ownerIds.includes(trainer!.userId!);", "const trainerLinked = true;", 'unit'),
 ('U10 les lignes de la feuille sont triées à l’envers', cuc, "rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));", "rows.sort((a, b) => b.learnerName.localeCompare(a.learnerName, 'fr'));", 'unit'),
 ('U11 les suggestions d’ambassadeur sont lisibles sans aucun droit', cuc, "if (!visibility.unrestricted && visibility.ownerIds.length === 0) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de voir les suggestions d'ambassadeur\");", "", 'unit'),
 # --- Routes
 ('R1 délivrer répond 200 au lieu de 201', cctl, "@Post(':enrollmentId') @HttpCode(201) @Protected('training.certification.issue')", "@Post(':enrollmentId') @HttpCode(200) @Protected('training.certification.issue')", DB),
 ('R2 lire et délivrer exigent la même permission', cctl, "@Post(':enrollmentId') @HttpCode(201) @Protected('training.certification.issue')", "@Post(':enrollmentId') @HttpCode(201) @Protected('training.certification.read')", DB),
 ('R3 lire et révoquer exigent la même permission', cctl, "@Post(':enrollmentId/revoke') @HttpCode(200) @Protected('training.certification.revoke')", "@Post(':enrollmentId/revoke') @HttpCode(200) @Protected('training.certification.read')", DB),
 ('R4 les suggestions d’ambassadeur se lisent avec le droit de délivrer un certificat', actl, "@Get() @Protected('bd.ambassador.read')", "@Get() @Protected('training.certification.issue')", DB),
 # --- Persistance
 ('P1 un conflit d’unicité n’est plus un conflit', prep, "if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une délivrance est déjà enregistrée pour cette inscription : rechargez la page');", "", DB),
 ('P2 le numéro de référence ne s’incrémente plus', prep, "SELECT nextval('training.certification_reference_seq') AS n", "SELECT 1 AS n", DB),
 # --- Garanties de la base
 ('G1 plusieurs délivrances pour la même inscription sont permises', mig, 'CREATE UNIQUE INDEX "certifications_enrollment_id_key" ON "training"."certifications"("enrollment_id");', '', DB),
 ('G2 deux délivrances peuvent partager le même numéro de référence', mig, 'CREATE UNIQUE INDEX "certifications_reference_number_key" ON "training"."certifications"("reference_number");', '', DB),
 ('G3 l’inscription d’une délivrance n’est plus contrôlée', mig, 'ALTER TABLE "training"."certifications" ADD CONSTRAINT "certifications_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;', '', DB),
 ('G4 une révocation incohérente (sans auteur, date ou motif) s’enregistre', mig, 'ALTER TABLE "training"."certifications" ADD CONSTRAINT "certifications_revoke_coherent" CHECK (\n  ("status" = \'ISSUED\' AND "revoked_by_user_id" IS NULL AND "revoked_at" IS NULL AND "revoke_reason" IS NULL) OR\n  ("status" = \'REVOKED\' AND "revoked_by_user_id" IS NOT NULL AND "revoked_at" IS NOT NULL AND COALESCE(length(btrim("revoke_reason")) > 0, false))\n);', '', DB),
 ('G5 l’inscription d’une suggestion n’est plus contrôlée', mig, 'ALTER TABLE "training"."ambassador_suggestions" ADD CONSTRAINT "ambassador_suggestions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;', '', DB),
 # --- Droits
 ('L1 le Responsable commercial perd le filtrage par entreprise (portée Tous)', roles, "g('training.learner.read', Team), g('training.certification.read', Team),", "g('training.learner.read', Team), g('training.certification.read', All),", 'unit'),
 ('L2 le formateur perd tout droit de lecture des délivrances', roles, "g('training.certification.read', Own),\n    g('docs.document.read', Own), g('docs.document.download', Own),\n    g('reporting.dashboard.training', Own),", "g('docs.document.read', Own), g('docs.document.download', Own),\n    g('reporting.dashboard.training', Own),", 'unit'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54486')
SPECS = {
    cert: 'src/modules/training/domain/certification.spec.ts',
    cuc: 'src/modules/training/application/certification-use-cases.spec.ts',
    roles: 'src/modules/iam/domain/roles.spec.ts',
}


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        text = read(path)[1].replace('\r\n', '\n')
        n = text.count(a)
        if n != 1 or a == b:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind, path):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest --runInBand --silent ' + SPECS[path], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1] or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


res = []
for name, path, a, b, kind in M:
    raw, s = read(path)
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    if text.count(a) != 1:
        print(name, 'MOTIF', text.count(a), flush=True)
        res.append((name, None))
        continue
    mutated = text.replace(a, b)
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run(kind, path)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
