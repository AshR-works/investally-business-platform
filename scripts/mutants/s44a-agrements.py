from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'approval.ts')
uc = os.path.join(base, 'application', 'approval-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'approvals.controller.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-approval.repository.ts')
own = os.path.join(base, 'application', 'approval-document-owners.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261107000000_s4_4a_approvals', 'migration.sql')
M = [
 ('Q1 accord de principe non exigé', uc, "if (STAGE_ORDER.indexOf(opportunity.stage) < STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {", "if (Math.random() > 2) {", 'unit'),
 ('Q2 opportunité perdue acceptée', uc, "if (opportunity.status === OpportunityStatus.Lost) throw", "if (Math.random() > 2) throw", 'unit'),
 ('Q3 plusieurs agréments actifs permis par la base', mig, "CREATE UNIQUE INDEX \"approvals_one_active_per_opportunity\" ON \"bd\".\"approvals\"(\"opportunity_id\") WHERE \"status\" IN ('RECEIVED', 'HONORED');", "", 'db:approvals-http'),
 ('Q4 entreprise non passée « Cliente »', uc, "        company.becomeClient();\n", "", 'unit'),
 ('Q5 honorer sous le droit d’annuler', uc, "const permission = command.action === 'honor' ? 'bd.approval.honor' : 'bd.approval.cancel';", "const permission = 'bd.approval.cancel';", 'unit'),
 ('Q6 verrou optimiste absent', uc, "if (approval.version !== command.version) throw new DomainError('CONFLICT', STALE);", "", 'unit'),
 ('Q7 validité avant la réception permise', dom, "if (validUntil !== null && validUntil < receivedOn)", "if (Math.random() > 2)", 'unit'),
 ('Q8 ni montant ni places permis', dom, "if (amount === null && places === null)", "if (Math.random() > 2)", 'unit'),
 ('Q9 motif sans longueur minimale', dom, "if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);", "", 'unit'),
 ('Q10 agrément clos modifiable', dom, "if (this.props.status !== ApprovalStatus.Received) {\n      throw new DomainError('INVARIANT_VIOLATION', `Un agrément", "if (Math.random() > 2) {\n      throw new DomainError('INVARIANT_VIOLATION', `Un agrément", 'unit'),
 ('Q11 portée de la liste ignorée', uc, "ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,", "ownerIds: undefined,", 'unit'),
 ('Q12 honorer sous le droit de lecture (route)', ctrl, "@Protected('bd.approval.honor')", "@Protected('bd.approval.read')", 'db:approvals-http'),
 ('Q13 somme ou places non exigée par la base', mig, "ALTER TABLE \"bd\".\"approvals\" ADD CONSTRAINT \"approvals_amount_or_places\" CHECK (COALESCE(\"amount\" IS NOT NULL OR \"places\" IS NOT NULL, false));", "", 'db:approvals-http'),
 ('Q14 opportunité sans clé étrangère (base)', mig, "ALTER TABLE \"bd\".\"approvals\" ADD CONSTRAINT \"approvals_opportunity_id_fkey\" FOREIGN KEY (\"opportunity_id\") REFERENCES \"bd\".\"opportunities\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;", "", 'db:approvals-http'),
 ('Q15 document visible hors portée', own, "if (!approval || !company || !decideFor(access, 'bd.approval.read', company.ownerUserId).allowed) return null;", "if (!approval || !company) return null;", 'db:approvals-http'),
 ('Q16 validité dépassée dès le jour même', dom, "this.props.validUntil < today;", "this.props.validUntil <= today;", 'unit'),
 ('Q17 nombre de places non enregistré (base)', repo, "amount: approval.amount, currency: approval.currency, places: approval.places,", "amount: approval.amount, currency: approval.currency,", 'db:approvals-http'),
 ('Q18 clôture incohérente permise par la base', mig, "AND ((\"status\" IN ('EXPIRED', 'CANCELLED')) = (\"closed_reason\" IS NOT NULL))", "", 'db:approvals-http'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
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
