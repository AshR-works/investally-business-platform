from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'appointment.ts')
uc = os.path.join(base, 'application', 'appointment-use-cases.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-appointment.repository.ts')
ctrl = os.path.join(base, 'presentation', 'appointments.controller.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261104000000_s4_2d_appointments', 'migration.sql')
M = [
 ('M1 heure passée acceptée', dom, "if (startsAt.getTime() <= now.getTime()) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M2 rendez-vous bout à bout en conflit', dom, "other.startsAt.getTime() < this.endsAt.getTime();", "other.startsAt.getTime() <= this.endsAt.getTime();", 'unit'),
 ('M3 report sans motif', dom, "const lastPostponeReason = required(reason, 'Le motif du report', 500);", "const lastPostponeReason = (reason ?? '').trim();", 'unit'),
 ('M4 tenu avant l’heure de début', dom, "if (this.props.startsAt.getTime() > now.getTime()) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M5 report vers la même heure', dom, "if (next.getTime() === this.props.startsAt.getTime()) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M6 report non compté', dom, "postponements: this.props.postponements + 1", "postponements: this.props.postponements", 'unit'),
 ('M7 compte rendu attendu avant l’heure pile', dom, "this.props.status === AppointmentStatus.Planned && this.props.startsAt.getTime() <= now.getTime();", "this.props.status === AppointmentStatus.Planned && this.props.startsAt.getTime() < now.getTime();", 'unit'),
 ('M8 durée hors limites acceptée', dom, "value < MIN_APPOINTMENT_MINUTES || value > MAX_APPOINTMENT_MINUTES", "value < 1 || value > 99999", 'unit'),
 ('M9 contact d’une autre entreprise accepté', uc, "if (!contact || contact.companyId !== companyId) throw", "if (!contact) throw", 'unit'),
 ('M10 offre d’une autre entreprise acceptée', uc, "(!offer || offer.companyId !== company.id)", "(!offer)", 'unit'),
 ('M11 visites visibles sans le droit', uc, "const types = wanted.filter((t) => canSeeVisits || t !== AppointmentType.Visit);", "const types = wanted;", 'unit'),
 ('M12 fenêtre de plus de 63 jours acceptée', uc, "> MAX_AGENDA_DAYS)", "> 9999)", 'unit'),
 ('M13 annulation d’une visite sous un droit inexistant', uc, "resource === 'visit' && action === 'cancel' ? 'update' : action", "action", 'unit'),
 ('M14 visite planifiée sous le droit des rendez-vous', uc, "type === AppointmentType.Visit ? 'visit' : 'appointment'", "'appointment'", 'unit'),
 ('M15 entreprise archivée modifiable', uc, "if (company.status === CompanyStatus.Archived) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M16 conflit compte les rendez-vous clos (base)', repo, "AND \"status\" = 'PLANNED'\n", "AND TRUE\n", 'db'),
 ('M17 conflit compte les autres organisateurs (base)', repo, "WHERE \"organizer_user_id\" = ${query.organizerUserId}::uuid\n        AND", "WHERE TRUE\n        AND", 'db'),
 ('M18 portée de l’agenda ignorée (base)', repo, "company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },", "company: { deletedAt: null },", 'db'),
 ('M19 fin de fenêtre incluse (base)', repo, "startsAt: { gte: query.from, lt: query.to },", "startsAt: { gte: query.from, lte: query.to },", 'db'),
 ('M20 annuler sous le droit de lecture (route)', ctrl, "@Protected('bd.appointment.cancel')", "@Protected('bd.appointment.read')", 'db'),
 ('M21 cohérence de la clôture non garantie par la base', mig, "ALTER TABLE \"bd\".\"appointments\" ADD CONSTRAINT \"appointments_closure_coherent\" CHECK (\n  COALESCE(\n    (\"status\" = 'PLANNED') = (\"closed_at\" IS NULL) AND (\"status\" = 'PLANNED') = (\"outcome_note\" IS NULL),\n    false\n  )\n);", '', 'db'),
 ('M22 verrou optimiste absent (base)', repo, "where: { id: appointment.id, version: appointment.version },", "where: { id: appointment.id },", 'db'),
 ('M23 tri de l’agenda inversé (base)', repo, "orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],", "orderBy: [{ startsAt: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],", 'db'),
 ('M24 durée non bornée par la base', mig, "ALTER TABLE \"bd\".\"appointments\" ADD CONSTRAINT \"appointments_duration_range\" CHECK (COALESCE(\"duration_minutes\" BETWEEN 15 AND 480, false));", '', 'db'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=appointments-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=700, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]
res = []
for name, path, a, b, kind in M:
    s = open(path, encoding='utf8').read()
    assert s.count(a) == 1, name + ' : motif introuvable ou multiple'
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
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
