from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'crm-api')
base = os.path.join(root, 'src', 'modules', 'business-development')
auc = os.path.join(base, 'application', 'appointment-use-cases.ts')
orepo = os.path.join(base, 'infrastructure', 'prisma-opportunity.repository.ts')
arepo = os.path.join(base, 'infrastructure', 'prisma-appointment.repository.ts')
totals = os.path.join(base, 'infrastructure', 'prisma-opportunity-totals.ts')
lst = os.path.join(base, 'application', 'list-companies.query.ts')
ctrl = os.path.join(base, 'presentation', 'companies.controller.ts')
dto = os.path.join(base, 'presentation', 'dto', 'appointment.dto.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261106000000_s4_3c_appointment_opportunity', 'migration.sql')
M = [
 ('P1 rendez-vous non lié ignoré par la règle (base)', orepo, "OR: [{ opportunityId }, { opportunityId: null }] };", "opportunityId };", 'db:opportunities-http'),
 ('P2 rendez-vous lié à une autre opportunité compté (base)', orepo, "status: 'HELD', OR: [{ opportunityId }, { opportunityId: null }] };", "status: 'HELD' };", 'db:opportunities-http'),
 ('P3 opportunité d’une autre entreprise acceptée', auc, "(!opportunity || opportunity.companyId !== company.id)", "(!opportunity)", 'unit'),
 ('P4 opportunité clôturée acceptée', auc, "if (opportunity && opportunity.status !== OpportunityStatus.Open)", "if (Math.random() > 2)", 'unit'),
 ('P5 opportunité inconnue acceptée', auc, "(!opportunity || opportunity.companyId !== company.id)", "(opportunity && opportunity.companyId !== company.id)", 'unit'),
 ('P6 lien non transmis au rendez-vous', auc, "opportunityId: opportunity?.id ?? null, organizerUserId", "opportunityId: null, organizerUserId", 'unit'),
 ('P7 intitulé absent de l’agenda', auc, "opportunityTitle: i.opportunityTitle }, now)", "opportunityTitle: null }, now)", 'unit'),
 ('P8 intitulé absent de la fiche du rendez-vous', auc, "opportunityTitle: opportunity?.title ?? null };\n}", "opportunityTitle: null };\n}", 'unit'),
 ('P9 lien non enregistré (base)', arepo, "offerId: appointment.offerId, opportunityId: appointment.opportunityId,\n", "offerId: appointment.offerId,\n", 'db:appointments-http'),
 ('P10 opportunités clôturées comptées dans la valeur (base)', totals, "where: { status: 'OPEN', companyId: { in: [...companyIds] } },", "where: { companyId: { in: [...companyIds] } },", 'db:company-lifecycle-http'),
 ('P11 valeur affichée hors du droit de lecture', lst, "const sees = (ownerId: string | null) => query.opportunityVisibility.unrestricted || (ownerId !== null && query.opportunityVisibility.ownerIds.includes(ownerId));", "const sees = (_ownerId: string | null) => true;", 'unit'),
 ('P12 portée de la valeur calculée sur le droit des entreprises (route)', ctrl, "opportunityVisibility: visibilityFor(access, 'bd.opportunity.read')", "opportunityVisibility: visibilityFor(access, 'bd.company.read')", 'db:company-lifecycle-http'),
 ('P13 lien sans clé étrangère (base)', mig, "ALTER TABLE \"bd\".\"appointments\" ADD CONSTRAINT \"appointments_opportunity_id_fkey\" FOREIGN KEY (\"opportunity_id\") REFERENCES \"bd\".\"opportunities\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;", "", 'db:appointments-http'),
 ('P14 identifiant d’opportunité non validé (route)', dto, "@IsOptional() @IsUUID()\n  opportunityId?: string;", "@IsOptional()\n  opportunityId?: string;", 'db:appointments-http'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development test/company-scope --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]
res = []
for name, path, a, b, kind in M:
    raw = open(path, 'rb').read()
    s = raw.decode('utf8')
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    if text.count(a) != 1:
        print(name, 'MOTIF', text.count(a), flush=True)
        res.append((name, None))
        continue
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
