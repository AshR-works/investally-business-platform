from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, re
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
domain = os.path.join(base, 'domain', 'offer.ts')
uc = os.path.join(base, 'application', 'offer-use-cases.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-offer.repository.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261031000000_s4_2a_offers', 'migration.sql')

# (nom, fichier, avant, après, type de test)
M = [
    ('M1 modification permise hors brouillon', domain, "if (this.props.status !== OfferStatus.Draft) {\n      throw new DomainError('INVARIANT_VIOLATION', `Une offre ${LABEL[this.props.status]} ne peut plus être modifiée`);\n    }", "", 'unit'),
    ('M2 acceptation d\u2019un brouillon', domain, "this.move([OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Accepted, 'acceptée');", "this.move([OfferStatus.Draft, OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Accepted, 'acceptée');", 'unit'),
    ('M3 retrait d\u2019une offre acceptée', domain, "this.move([OfferStatus.Draft, OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Withdrawn, 'retirée');", "this.move([OfferStatus.Draft, OfferStatus.Submitted, OfferStatus.ReceiptReceived, OfferStatus.Accepted], OfferStatus.Withdrawn, 'retirée');", 'unit'),
    ('M4 motif de retrait trop court accepté', domain, "if (text.length < 3) throw", "if (text.length < 1) throw", 'unit'),
    ('M5 retrait sous le droit de lecture', uc, "withdraw: 'bd.offer.withdraw',", "withdraw: 'bd.offer.read',", 'unit'),
    ('M6 version ignorée pour les changements d\u2019état', uc, "      if (offer.version !== command.version) throw new DomainError('CONFLICT', STALE);\n      const before = toOfferView(offer, company.name.value);\n      const now = this.clock.now();", "      const before = toOfferView(offer, company.name.value);\n      const now = this.clock.now();", 'unit'),
    ('M7 entreprise archivée modifiable (modification)', uc, "      assertWritable(company);\n      if (offer.version !== command.version) throw new DomainError('CONFLICT', STALE);\n      const before = toOfferView(offer, company.name.value);\n      offer.edit(command);", "      if (offer.version !== command.version) throw new DomainError('CONFLICT', STALE);\n      const before = toOfferView(offer, company.name.value);\n      offer.edit(command);", 'unit'),
    ('M8 numéro consommé avant la validation', uc, "      const draft = Offer.create({ ...command, id: this.ids.next(), reference: 'PROVISOIRE', now });\n      const offer = Offer.create({ ...command, id: draft.id, reference: await this.offers.nextReference(now.getUTCFullYear()), now });", "      const ref = await this.offers.nextReference(now.getUTCFullYear());\n      const offer = Offer.create({ ...command, id: this.ids.next(), reference: ref, now });", 'unit'),
    ('M9 portée de la liste ignorée (base)', repo, "company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },", "company: { deletedAt: null },", 'db'),
    ('M10 compteur non incrémenté', repo, "update: { last: { increment: 1 } },", "update: { last: 1 },", 'db'),
    ('M11 verrou optimiste de la base absent', repo, "where: { id: offer.id, version: offer.version },", "where: { id: offer.id },", 'db'),
    ('M12 montant positif non garanti par la base', mig, 'ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_amount_positive" CHECK ("amount" > 0);', '', 'db'),
    ('M13 retrait sans motif non empêché par la base', mig, "ALTER TABLE \"bd\".\"offers\" ADD CONSTRAINT \"offers_withdrawn_reason_required\" CHECK (\n  COALESCE((\"status\" = 'WITHDRAWN') = (\"withdrawn_reason\" IS NOT NULL), false)\n);", '', 'db'),
    ('M14 date de dépôt non garantie par la base', mig, "ALTER TABLE \"bd\".\"offers\" ADD CONSTRAINT \"offers_submitted_at_coherent\" CHECK (\n  COALESCE((\"status\" = 'DRAFT') = (\"submitted_at\" IS NULL), false) OR \"status\" = 'WITHDRAWN'\n);", '', 'db'),
]

def run(kind):
    if kind == 'unit':
        out = subprocess.run(['pnpm', 'exec', 'jest', 'src/modules/business-development', '--silent'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=400, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=offers-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=500).stdout
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
