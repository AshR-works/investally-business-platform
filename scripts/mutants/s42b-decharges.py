from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
receipt = os.path.join(base, 'domain', 'receipt.ts')
uc = os.path.join(base, 'application', 'receipt-use-cases.ts')
owners = os.path.join(base, 'application', 'offer-document-owners.ts')
ctrl = os.path.join(base, 'presentation', 'receipts.controller.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261102000000_s4_2b_receipts', 'migration.sql')
M = [
 ('M1 date future acceptée', receipt, "if (receivedOn > input.now.toISOString().slice(0, 10)) throw", "if (false) throw", 'unit'),
 ('M2 date antérieure au dépôt acceptée', receipt, "if (input.offerSubmittedAt && receivedOn <", "if (false && input.offerSubmittedAt && receivedOn <", 'unit'),
 ('M3 offre en brouillon acceptée', uc, "if (offer.status !== OfferStatus.Submitted) {", "if (false) {", 'unit'),
 ('M4 offre non passée à « décharge reçue »', uc, "      offer.receiptReceived();\n", "", 'unit'),
 ('M5 seconde décharge non signalée comme conflit', uc, "if (offer.status === OfferStatus.ReceiptReceived) throw new DomainError('CONFLICT', 'Cette offre a déjà une décharge valide');", "", 'unit'),
 ('M6 offre non ramenée à « déposée » à l\u2019annulation', uc, "      offer.receiptCancelled();\n", "", 'unit'),
 ('M7 annulation sous le droit de lecture (route)', ctrl, "@Protected('bd.receipt.update')\n  cancel(", "@Protected('bd.receipt.read')\n  cancel(", 'db'),
 ('M8 portée des fichiers d\u2019une décharge ignorée', owners, "if (!receipt || !offer || !company || !decideFor(access, 'bd.receipt.read', company.ownerUserId).allowed) return null;", "if (!receipt || !offer || !company) return null;", 'db'),
 ('M9 unicité de la décharge valide non garantie par la base', mig, 'CREATE UNIQUE INDEX "receipts_one_valid_per_offer" ON "bd"."receipts"("offer_id") WHERE "status" = \'VALID\';', '', 'db'),
 ('M10 cohérence de l\u2019annulation non garantie par la base', mig, "ALTER TABLE \"bd\".\"receipts\" ADD CONSTRAINT \"receipts_cancellation_coherent\" CHECK (\n  COALESCE(\n    (\"status\" = 'CANCELLED') = (\"cancelled_reason\" IS NOT NULL) AND (\"status\" = 'CANCELLED') = (\"cancelled_at\" IS NOT NULL),\n    false\n  )\n);", '', 'db'),
 ('M11 verrou optimiste de la décharge absent (base)', os.path.join(base, 'infrastructure', 'prisma-receipt.repository.ts'), "where: { id: receipt.id, version: receipt.version },", "where: { id: receipt.id },", 'db'),
 ('M12 décharges annulées masquées de la liste', os.path.join(base, 'infrastructure', 'prisma-receipt.repository.ts'), "findMany({ where: { offerId }, orderBy", "findMany({ where: { offerId, status: 'VALID' }, orderBy", 'db'),
]
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=500, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=receipts-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]
res = []
for name, path, a, b, kind in M:
    s = open(path, encoding='utf8').read()
    assert s.count(a) == 1, name
    open(path, 'w', encoding='utf8', newline='\n').write(s.replace(a, b))
    try:
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'w', encoding='utf8', newline='\n').write(s)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print(sum(1 for _, k in res if k), '/', len(res))
