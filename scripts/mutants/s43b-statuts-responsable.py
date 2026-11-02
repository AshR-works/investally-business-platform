from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'crm-api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'company.ts')
sts = os.path.join(base, 'domain', 'company-status.ts')
uc = os.path.join(base, 'application', 'company-lifecycle-use-cases.ts')
lst = os.path.join(base, 'application', 'list-companies.query.ts')
ctrl = os.path.join(base, 'presentation', 'companies.controller.ts')
dto = os.path.join(base, 'presentation', 'dto', 'company-lifecycle.dto.ts')
odir = os.path.join(base, 'infrastructure', 'prisma-owner-directory.ts')
crepo = os.path.join(base, 'infrastructure', 'prisma-contact.repository.ts')
M = [
 ('N1 qualifiée sans contact', dom, "if (next === CompanyStatus.Qualified && context.contactCount < 1) {", "if (Math.random() > 2) {", 'unit'),
 ('N2 étape sautée permise', dom, "if (!MANUAL_STATUS_TRANSITIONS[this.props.status].includes(next)) {", "if (Math.random() > 2) {", 'unit'),
 ('N3 même statut permis', dom, "if (next === this.props.status) {", "if (Math.random() > 2) {", 'unit'),
 ('N4 « Cliente » posable à la main', sts, "[CompanyStatus.Qualified]: [CompanyStatus.Contacted],", "[CompanyStatus.Qualified]: [CompanyStatus.Contacted, CompanyStatus.Client],", 'unit'),
 ('N5 retour d’un cran impossible', sts, "[CompanyStatus.Contacted]: [CompanyStatus.Target, CompanyStatus.Qualified],", "[CompanyStatus.Contacted]: [CompanyStatus.Qualified],", 'unit'),
 ('N6 même propriétaire permis', dom, "if (newOwnerUserId === this.props.ownerUserId) {", "if (Math.random() > 2) {", 'unit'),
 ('N7 propriétaire vide permis', dom, "if (!newOwnerUserId) throw new DomainError('VALIDATION', 'Le nouveau propriétaire est obligatoire');", "", 'unit'),
 ('N8 réattribution sous le droit de modification', uc, "command.access, 'bd.company.reassign');", "command.access, 'bd.company.update');", 'unit'),
 ('N9 destinataires hors portée proposés', uc, "return owners.candidates(visibility.unrestricted ? undefined : visibility.ownerIds);", "return owners.candidates();", 'unit'),
 ('N10 verrou optimiste absent', uc, "if (company.version !== version) {", "if (Math.random() > 2) {", 'unit'),
 ('N11 contacts non comptés', uc, "contactCount: await this.contacts.countByCompany(company.id)", "contactCount: 1", 'unit'),
 ('N12 destinataire non contrôlé', uc, "if (!eligible.some((o) => o.id === command.ownerUserId)) {", "if (Math.random() > 2) {", 'unit'),
 ('N13 nom du responsable absent de la réponse', uc, "return toCompanyView(company, undefined, name);", "return toCompanyView(company);", 'unit'),
 ('N14 ancien statut non tracé', uc, "oldValue: { status: before },", "oldValue: {},", 'unit'),
 ('N15 réattribution sous le droit de modification (route)', ctrl, "@Protected('bd.company.reassign')\n  owner(", "@Protected('bd.company.update')\n  owner(", 'db'),
 ('N16 liste des destinataires sous le droit de lecture (route)', ctrl, "@Protected('bd.company.reassign')\n  owners(", "@Protected('bd.company.read')\n  owners(", 'db'),
 ('N17 « Cliente » et « Archivée » acceptées par la route', dto, "['TARGET', 'CONTACTED', 'QUALIFIED'] as const", "['TARGET', 'CONTACTED', 'QUALIFIED', 'CLIENT', 'ARCHIVED'] as const", 'db'),
 ('N18 comptes désactivés proposés (base)', odir, "status: 'ACTIVE',", "", 'db'),
 ('N19 rôle sans portefeuille proposé (base)', odir, "        roles: { some: { role: { code: { in: OWNER_ROLE_CODES } } } },\n", "", 'db'),
 ('N20 liste sans nom du responsable', lst, "(names.get(company.ownerUserId) ?? null)", "null", 'db'),
 ('N21 contacts supprimés comptés (base)', crepo, "where: { companyId, deletedAt: null } });\n  }\n\n  async findDuplicates", "where: { companyId } });\n  }\n\n  async findDuplicates", 'db'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=company-lifecycle-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=700, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]
res = []
for name, path, a, b, kind in M:
    raw = open(path, 'rb').read()
    s = raw.decode('utf8')
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    assert text.count(a) == 1, name + ' : motif introuvable ou multiple (' + str(text.count(a)) + ')'
    mutated = text.replace(a, b)
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
