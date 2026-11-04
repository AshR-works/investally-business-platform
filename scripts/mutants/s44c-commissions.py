from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
base = os.path.join(api, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'commission-payout.ts')
uc = os.path.join(base, 'application', 'commission-payout-use-cases.ts')
ap = os.path.join(base, 'application', 'approval-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'commission-payouts.controller.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261111000000_s4_4c_commission_payouts', 'migration.sql')
wlib = os.path.join(web, 'lib', 'commissions.ts')
M = [
 ('R1 pourcentage tronqué au lieu d’arrondi', dom, "return decimalOf((product + 5000n) / 10000n);", "return decimalOf(product / 10000n);", 'unit'),
 ('R2 montant fixe ignoré', dom, "const amount = fixed ? amountOf(input.commission.value) :", "const amount = false ? amountOf(input.commission.value) :", 'unit'),
 ('R3 déblocage sans montant permis', dom, "    if (this.props.amount === null) throw new DomainError('INVARIANT_VIOLATION', 'Le montant de la commission est à fixer avant le déblocage des fonds');\n", "", 'unit'),
 ('R4 déblocage répété permis', dom, "if (this.props.status !== PayoutStatus.Due && this.props.status !== PayoutStatus.OnHold) {\n      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} ne peut plus être débloquée`);", "if (false) {\n      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} ne peut plus être débloquée`);", 'unit'),
 ('R5 mise en attente sans motif', dom, "const holdReason = reasonOf(reason, 'Le motif de la mise en attente');", "const holdReason = reason ?? 'x';", 'unit'),
 ('R6 versement sans justificatif permis', dom, "if (!hasProof) throw new DomainError(", "if (false) throw new DomainError(", 'unit'),
 ('R7 versement avant déblocage permis', dom, "if (this.props.status !== PayoutStatus.Released) {", "if (false) {", 'unit'),
 ('R8 date de versement future permise', dom, "if (text > now.toISOString().slice(0, 10)) throw", "if (false) throw", 'unit'),
 ('R9 annulation après versement permise', dom, "if (this.props.status === PayoutStatus.Paid || this.props.status === PayoutStatus.Cancelled) {", "if (this.props.status === PayoutStatus.Cancelled) {", 'unit'),
 ('R10 montant refixé après coup', dom, "if (this.props.amount !== null) throw new DomainError('INVARIANT_VIOLATION', 'Le montant de la commission est figé", "if (false) throw new DomainError('INVARIANT_VIOLATION', 'Le montant de la commission est figé", 'unit'),
 ('R11 commission sans définition acceptée', uc, "if (!link?.commission) return null;", "if (!link) return null;", 'unit'),
 ('R12 doublon de versement par agrément permis', uc, "    if (await this.payouts.findByApproval(input.approval.id)) return null;\n", "", 'unit'),
 ('R13 déblocage sous le droit de lecture', uc, "  release: 'bd.commission.release',", "  release: 'bd.commission.read',", 'unit'),
 ('R14 versement sous le droit de lecture', uc, "  pay: 'bd.commission.pay',", "  pay: 'bd.commission.read',", 'unit'),
 ('R15 annulation sous le droit de déblocage', uc, "  cancel: 'bd.commission.manage',", "  cancel: 'bd.commission.release',", 'unit'),
 ('R16 justificatif non contrôlé', uc, "await this.documents.has(PAYOUT_OWNER_TYPE, payout.id, PROOF_CATEGORY)", "true", 'unit'),
 ('R17 mauvaise catégorie de justificatif acceptée', uc, "export const PROOF_CATEGORY = 'JUSTIFICATIF';", "export const PROOF_CATEGORY = 'AGREMENT';", 'db:commissions-http'),
 ('R18 entreprise archivée non figée', uc, "      assertWritable(company);\n      if (payout.version !== command.version)", "      if (payout.version !== command.version)", 'unit'),
 ('R19 verrou optimiste absent', uc, "if (payout.version !== command.version) throw new DomainError('CONFLICT', STALE);", "", 'unit'),
 ('R20 le paiement constaté ne rend plus la commission due', ap, "if (command.action === 'honor') await this.commissionDue.execute(", "if (false) await this.commissionDue.execute(", 'unit'),
 ('R21 portée de la liste ignorée', uc, "ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,", "ownerIds: undefined,", 'unit'),
 ('R22 route de déblocage sous le droit de lecture', ctrl, "  @Post(':id/release')\n  @HttpCode(200)\n  @Protected('bd.commission.release')", "  @Post(':id/release')\n  @HttpCode(200)\n  @Protected('bd.commission.read')", 'db:commissions-http'),
 ('R23 date de versement non contrôlée par la base', mig, "ALTER TABLE \"bd\".\"commission_payouts\" ADD CONSTRAINT \"commission_payouts_paid_coherent\" CHECK (COALESCE((\"status\" = 'PAID') = (\"paid_on\" IS NOT NULL), false));", "", 'db:commissions-http'),
 ('R24 un seul versement par agrément non garanti par la base', mig, "CREATE UNIQUE INDEX \"commission_payouts_approval_id_key\" ON \"bd\".\"commission_payouts\"(\"approval_id\");", "", 'db:commissions-http'),
 ('R25 montant obligatoire au déblocage non garanti par la base', mig, "ALTER TABLE \"bd\".\"commission_payouts\" ADD CONSTRAINT \"commission_payouts_amount_before_release\" CHECK (COALESCE(\"status\" NOT IN ('RELEASED', 'PAID') OR \"amount\" IS NOT NULL, false));", "", 'db:commissions-http'),
 ('R26 interface : déblocage proposé sans montant', wlib, "if (open && rights.release && payout.amount !== null) actions.push('release');", "if (open && rights.release) actions.push('release');", 'web'),
 ('R27 interface : versement proposé avant le déblocage', wlib, "if (payout.status === 'RELEASED' && rights.pay) actions.push('pay');", "if (payout.status !== 'PAID' && rights.pay) actions.push('pay');", 'web'),
 ('R28 interface : date de versement future acceptée', wlib, "if (value > today) return 'La date de versement ne peut pas être dans le futur.';", "", 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/s54-commissions.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
        lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
        assert lines, 'run inconclusive: ' + out[-300:]
        return ' failed' in lines[-1]
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
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
