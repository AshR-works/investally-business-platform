from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'approval.ts')
uc = os.path.join(base, 'application', 'approval-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'approvals.controller.ts')
companies_ctrl = os.path.join(base, 'presentation', 'companies.controller.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-approval.repository.ts')
roles = os.path.join(root, 'src', 'modules', 'iam', 'domain', 'roles.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261109000100_s4_4a_bis_payer_and_request', 'migration.sql')
M = [
 ('R1 payeur à moitié renseigné accepté', dom, "if (text === '' || typed === '') throw", "if (Math.random() > 2) throw", 'unit'),
 ('R2 type de payeur non vérifié', dom, "if (!(Object.values(PayerType) as string[]).includes(typed))", "if (Math.random() > 2)", 'unit'),
 ('R3 nom de payeur sans limite', dom, "if (text.length > 200)", "if (Math.random() > 2)", 'unit'),
 ('R4 réception d’un agrément déjà reçu permise', dom, "if (this.props.status !== ApprovalStatus.Requested) {", "if (Math.random() > 2) {", 'unit'),
 ('R5 réception dans le futur permise', dom, "if (receivedOn > now.toISOString().slice(0, 10))", "if (Math.random() > 2)", 'unit'),
 ('R6 réception après la fin de validité permise', dom, "if (this.props.validUntil !== null && this.props.validUntil < date)", "if (Math.random() > 2)", 'unit'),
 ('R7 une demande ne peut pas être annulée', dom, "if (this.props.status !== ApprovalStatus.Requested) this.assertReceived('annulé');", "this.assertReceived('annulé');", 'unit'),
 ('R8 la réception n’émet pas « accordé »', dom, "    this.record(new ApprovalReceived(this.props.id, now, this.props.companyId, this.props.opportunityId));\n  }", "  }", 'unit'),
 ('R9 la demande n’occupe pas l’opportunité', dom, "[ApprovalStatus.Requested, ApprovalStatus.Received, ApprovalStatus.Honored]", "[ApprovalStatus.Received, ApprovalStatus.Honored]", 'unit'),
 ('R10 la demande rend l’entreprise « Cliente »', uc, "if (approval.status === ApprovalStatus.Received) await promoteToClient", "if (true) await promoteToClient", 'unit'),
 ('R11 la réception ne rend pas l’entreprise « Cliente »', uc, "      await promoteToClient(this.companies, this.audit, company, command.actor);\n      return after;", "      return after;", 'unit'),
 ('R12 réception sous le droit de lecture', uc, "command.id, command.access, 'bd.approval.create',", "command.id, command.access, 'bd.approval.read',", 'unit'),
 ('R13 demande avec date de réception acceptée', uc, "if (command.requested && command.receivedOn) throw", "if (Math.random() > 2) throw", 'unit'),
 ('R14 demande ignorée (enregistrée reçue)', uc, "command.requested ? Approval.request(common) :", "false ? Approval.request(common) :", 'unit'),
 ('R15 le Responsable commercial constate le paiement', roles, "g('bd.approval.create', Team), g('bd.approval.cancel', Team),", "g('bd.approval.create', Team), g('bd.approval.cancel', Team), g('bd.approval.honor', Team),", 'unit'),
 ('R16 la Finance ne constate plus le paiement', roles, "g('bd.approval.read', All), g('bd.approval.honor', All), g('bd.facilitator.read', All)", "g('bd.approval.read', All), g('bd.facilitator.read', All)", 'unit'),
 ('R17 réattribution sans second facteur récent', companies_ctrl, "@Protected('bd.company.reassign', { stepUp: true })", "@Protected('bd.company.reassign')", 'db:company-lifecycle-http'),
 ('R18 route de réception sous le droit d’honorer', ctrl, "@Post(':id/receive')\n  @HttpCode(200)\n  @Protected('bd.approval.create')", "@Post(':id/receive')\n  @HttpCode(200)\n  @Protected('bd.approval.honor')", 'db:approvals-http'),
 ('R19 date de réception non enregistrée (base)', repo, "      receivedOn: approval.receivedOn ? new Date(`${approval.receivedOn}T00:00:00Z`) : null,\n", "", 'db:approvals-http'),
 ('R20 payeur non enregistré (base)', repo, "          payerName: approval.payerName, payerType: approval.payerType,\n", "", 'db:approvals-http'),
 ('R21 payeur à moitié renseigné permis par la base', mig, "ALTER TABLE \"bd\".\"approvals\" ADD CONSTRAINT \"approvals_payer_complete\" CHECK (COALESCE((\"payer_name\" IS NULL) = (\"payer_type\" IS NULL), false));", "", 'db:approvals-http'),
 ('R22 une demande peut doubler un agrément (base)', mig, "WHERE \"status\" IN ('REQUESTED', 'RECEIVED', 'HONORED');", "WHERE \"status\" IN ('RECEIVED', 'HONORED');", 'db:approvals-http'),
 ('R23 date de réception facultative pour tous (base)', mig, "ALTER TABLE \"bd\".\"approvals\" ADD CONSTRAINT \"approvals_received_on_required\" CHECK (COALESCE(\"received_on\" IS NOT NULL OR \"status\" IN ('REQUESTED', 'CANCELLED'), false));", "", 'db:approvals-http'),
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
