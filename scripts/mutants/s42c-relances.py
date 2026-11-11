from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
fu = os.path.join(base, 'domain', 'followup.ts')
uc = os.path.join(base, 'application', 'followup-use-cases.ts')
off = os.path.join(base, 'application', 'offer-use-cases.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-followup.repository.ts')
orepo = os.path.join(base, 'infrastructure', 'prisma-offer.repository.ts')
ctrl = os.path.join(base, 'presentation', 'followups.controller.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261103000000_s4_2c_followups', 'migration.sql')
M = [
 ('M1 échéance passée acceptée', fu, "if (dueOn < today(input.now)) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M2 limite de trois non appliquée', uc, ">= MAX_FOLLOWUPS_PER_OFFER) {", ">= 99) {", 'unit'),
 ('M3 relance sur une offre sans réponse attendue', uc, "if (!offer.isOpen) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M4 relances annulées comptées dans la limite', repo, "where: { offerId, status: { in: ['PLANNED', 'DONE'] } }", "where: { offerId }", 'db'),
 ('M5 relances non annulées à l\u2019acceptation', off, "  accept: \"Offre acceptée par l'entreprise\",\n", "", 'unit'),
 ('M6 relances terminées aussi annulées', repo, "where: { offerId, status: 'PLANNED' }, orderBy: { dueOn: 'asc' } }", "where: { offerId }, orderBy: { dueOn: 'asc' } }", 'db'),
 ('M7 relance du jour comptée en retard', fu, "this.props.dueOn < today(now);", "this.props.dueOn <= today(now);", 'unit'),
 ('M8 échéance passée inchangée refusée', fu, "if (changes.dueOn !== undefined && changes.dueOn !== this.props.dueOn) {", "if (changes.dueOn !== undefined) {", 'unit'),
 ('M9 résultat vide accepté', fu, "if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);", "", 'unit'),
 ('M10 terminer sous le droit de lecture (route)', ctrl, "@Protected('bd.followup.complete')", "@Protected('bd.followup.read')", 'db'),
 ('M11 portée de la liste ignorée (base)', repo, "offer: { company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) } },", "offer: { company: { deletedAt: null } },", 'db'),
 ('M12 cohérence de la clôture non garantie par la base', mig, "ALTER TABLE \"bd\".\"followups\" ADD CONSTRAINT \"followups_closure_coherent\" CHECK (\n  COALESCE(\n    (\"status\" = 'PLANNED') = (\"closed_at\" IS NULL) AND (\"status\" = 'PLANNED') = (\"result_note\" IS NULL),\n    false\n  )\n);", '', 'db'),
 ('M13 tri par échéance inversé', repo, "orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],", "orderBy: [{ dueOn: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],", 'db'),
 ('M14 prochaine relance = la plus lointaine', orepo, "followups: { where: { status: 'PLANNED' }, orderBy: { dueOn: 'asc' }, take: 1,", "followups: { where: { status: 'PLANNED' }, orderBy: { dueOn: 'desc' }, take: 1,", 'db'),
 ('M15 verrou optimiste de la relance absent (base)', repo, "where: { id: followup.id, version: followup.version },", "where: { id: followup.id },", 'db'),
]
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=followups-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=700).stdout
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
