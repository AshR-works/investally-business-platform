from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
base = os.path.join(api, 'src', 'modules', 'training')
fields = os.path.join(base, 'domain', 'catalogue-fields.ts')
trn = os.path.join(base, 'domain', 'training.ts')
room = os.path.join(base, 'domain', 'room.ts')
mod = os.path.join(base, 'domain', 'course-module.ts')
rhy = os.path.join(base, 'domain', 'rhythms.ts')
uc = os.path.join(base, 'application', 'catalogue-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'catalogue.controllers.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-catalogue.repositories.ts')
fmt = os.path.join(api, 'src', 'shared-kernel', 'contact-format.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261112000000_s5_1_catalogue', 'migration.sql')
wlib = os.path.join(web, 'lib', 'catalogue.ts')
wmod = os.path.join(web, 'lib', 'modules.ts')
seedrun = os.path.join(api, 'src', 'cli', 'seed', 'run-seed.ts')
seedplan = os.path.join(api, 'src', 'cli', 'seed', 'seed-plan.ts')
dtable = os.path.join(web, 'components', 'data', 'data-table.tsx')
M = [
 ('R1 nom obligatoire non contrôlé', fields, "if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);", "if (false) throw new DomainError('VALIDATION', `${label} est obligatoire`);", 'unit'),
 ('R2 longueur d’un nom non bornée', fields, "if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);\n  return value;\n}\n\n/** Texte facultatif", "return value;\n}\n\n/** Texte facultatif", 'unit'),
 ('R3 longueur d’un texte facultatif non bornée', fields, "  if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);\n  return value;\n}\n\n/** Clé", "  return value;\n}\n\n/** Clé", 'unit'),
 ('R4 élément archivé modifiable', fields, "if (status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION'", "if (false) throw new DomainError('INVARIANT_VIOLATION'", 'unit'),
 ('R5 plus de 20 modules acceptés', trn, "if (ids.length > MAX_MODULES_PER_TRAINING) throw", "if (false) throw", 'unit'),
 ('R6 module en double dans un certificat accepté', trn, "if (new Set(ids).size !== ids.length) throw", "if (false) throw", 'unit'),
 ('R7 prix nul accepté', trn, "|| Number(text) <= 0) {", "|| Number(text) < 0) {", 'unit'),
 ('R8 prix à trois décimales accepté', trn, "(\\.\\d{1,2})?$/.test(text)", "(\\.\\d{1,3})?$/.test(text)", 'unit'),
 ('R9 devise par défaut changée', trn, "const code = (currency ?? DEFAULT_CURRENCY)", "const code = (currency ?? 'EUR')", 'unit'),
 ('R10 devise sans montant acceptée', trn, "    if (currency) throw new DomainError('VALIDATION', 'Une devise sans montant", "    if (false) throw new DomainError('VALIDATION', 'Une devise sans montant", 'unit'),
 ('R11 postes hors service au-delà des postes apprenants acceptés', room, "if (value > learnerSeats) throw", "if (false) throw", 'unit'),
 ('R12 programme en double accepté', uc, "if (await this.programs.existsByName(program.nameKey)) throw", "if (false) throw", 'unit'),
 ('R13 verrou optimiste absent', uc, "  if (current !== expected) throw new DomainError('CONFLICT'", "  if (false) throw new DomainError('CONFLICT'", 'unit'),
 ('R14 certificat accepté dans un programme archivé', uc, "if (program.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le programme est archivé : on ne peut pas y ajouter de certificat');", "", 'unit'),
 ('R15 certificat réactivé sous un programme archivé', uc, "if (command.action === 'reactivate' && program?.status === 'ARCHIVED') {", "if (false) {", 'unit'),
 ('R16 titre en double dans un programme accepté', uc, "if (await this.trainings.existsByTitle(program.id, training.titleKey)) {", "if (false) {", 'unit'),
 ('R17 salle en double acceptée', uc, "if (await this.rooms.existsByName(room.nameKey)) throw", "if (false) throw", 'unit'),
 ('R18 e-mail de formateur en double accepté', uc, "if (trainer.email && (await trainers.existsByEmail(trainer.email, trainer.id))) {", "if (false) {", 'unit'),
 ('R19 compte déjà lié à un autre formateur accepté', uc, "if (other && other.id !== trainer.id) throw", "if (false) throw", 'unit'),
 ('R20 e-mail non mis en minuscules', fmt, "const value = (raw ?? '').trim().toLocaleLowerCase('fr');", "const value = (raw ?? '').trim();", 'unit'),
 ('R21 module inconnu accepté dans un certificat', uc, "const module = found.get(id);\n    if (!module) throw new DomainError('NOT_FOUND', 'Module introuvable');", "const module = found.get(id)!;", 'unit'),
 ('R22 module archivé ajouté à un certificat', uc, "if (module.status === 'ARCHIVED' && !already.includes(id)) throw", "if (false) throw", 'unit'),
 ('R23 module en double accepté', uc, "if (await this.modules.existsByTitle(module.titleKey)) throw", "if (false) throw", 'unit'),
 ('R24 capacité utile mal calculée', room, "return this.props.learnerSeats - this.props.unavailableSeats;", "return this.props.learnerSeats + this.props.unavailableSeats;", 'unit'),
 ('R25 rythme du soir ouvert', rhy, "hoursPerDay: 3, open: false }", "hoursPerDay: 3, open: true }", 'unit'),
 ('R26 volume horaire d’un rythme mal calculé', rhy, "rhythm.weeks * rhythm.daysPerWeek * rhythm.hoursPerDay", "rhythm.weeks * rhythm.hoursPerDay", 'unit'),
 ('R27 création de programme sous le droit de lecture', ctrl, "@Post() @HttpCode(201) @Protected('training.program.create')", "@Post() @HttpCode(201) @Protected('training.program.read')", 'db:catalogue-http'),
 ('R28 archivage de programme sous le droit de lecture', ctrl, "@Protected('training.program.archive')", "@Protected('training.program.read')", 'db:catalogue-http'),
 ('R29 création de module sous le droit de lecture des programmes', ctrl, "@Protected('training.training.create')\n  register(@Body() dto: CreateModuleDto", "@Protected('training.program.read')\n  register(@Body() dto: CreateModuleDto", 'db:catalogue-http'),
 ('R30 verrou optimiste absent au niveau de la base', repo, "db.updateMany({ where: { id: room.id, version: room.version }", "db.updateMany({ where: { id: room.id }", 'db:catalogue-http'),
 ('R31 prix par module non contrôlé par la base', mig, "AND (\"module_price_amount\" IS NULL OR \"module_price_amount\" > 0)", "AND true", 'db:catalogue-http'),
 ('R32 cohérence prix et devise non contrôlée par la base', mig, "ALTER TABLE \"training\".\"trainings\" ADD CONSTRAINT \"trainings_price_coherent\"", "-- ALTER TABLE \"training\".\"trainings\" ADD CONSTRAINT \"trainings_price_coherent\"", 'db:catalogue-http'),
 ('R33 postes hors service non bornés par la base', mig, "\"unavailable_seats\" BETWEEN 0 AND \"learner_seats\"", "\"unavailable_seats\" >= 0", 'db:catalogue-http'),
 ('R34 ordre des modules non unique par certificat dans la base', mig, "CREATE UNIQUE INDEX \"training_modules_training_id_position_key\" ON \"training\".\"training_modules\"(\"training_id\", \"position\");", "", 'db:catalogue-http'),
 ('R35 unicité du nom de programme non garantie par la base', mig, "CREATE UNIQUE INDEX \"programs_name_key_key\" ON \"training\".\"programs\"(\"name_key\");", "", 'db:catalogue-http'),
 ('R36 interface : postes hors service au-delà des postes apprenants acceptés', wlib, "Number(form.unavailableSeats) > Number(form.learnerSeats)", "false", 'web'),
 ('R37 interface : prix vidés non retirés à la modification', wlib, "    : version ? { priceAmount: null, modulePriceAmount: null } : {};", "    : {};", 'web'),
 ('R38 interface : téléphone envoyé avec ses espaces', wlib, "phone: text(form.phone) ? cleanPhone(form.phone) : '',", "phone: text(form.phone),", 'web'),
 ('R39 interface : module Formation ouvert sans le droit de lecture', wmod, "href: '/training', permission: 'training.program.read'", "href: '/training'", 'web'),
 ('R40 interface : un module sort de la liste en la déplaçant', wlib, "  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];\n", "", 'web'),
 ('R41 module pratique sur poste par défaut', mod, "requiresWorkstations: input.requiresWorkstations ?? false,", "requiresWorkstations: input.requiresWorkstations ?? true,", 'unit'),
 ('R42 type de salle par défaut changé', room, "kind: input.kind ?? 'WORKSTATIONS',", "kind: input.kind ?? 'CLASSROOM',", 'unit'),
 ('R43 type de salle non enregistré en base', repo, "name: room.name, nameKey: room.nameKey, kind: room.kind, learnerSeats", "name: room.name, nameKey: room.nameKey, learnerSeats", 'db:catalogue-http'),
 ('R44 interface : « places » et « postes » inversés', wlib, "(kind === 'CLASSROOM' ? 'places' : 'postes')", "(kind === 'CLASSROOM' ? 'postes' : 'places')", 'web'),
 ('R45 interface : « pratique sur poste » non envoyé', wlib, "description: text(form.description), requiresWorkstations: form.requiresWorkstations });", "description: text(form.description) });", 'web'),
 ('R46 chargement par blocs : le catalogue est toujours rechargé', seedrun, "catalogue: (await prisma.db.program.count({ where: { name: CATALOGUE_MARKER } })) > 0,", "catalogue: false,", 'db:seed-demo'),
 ('R47 chargement par blocs : tous les blocs sont rechargés', seedrun, "events = events.filter((event) => toLoad.includes(blockOf(event.op)));", "", 'db:seed-demo'),
 ('R48 chargement par blocs : un formateur est classé dans le bloc commercial', seedplan, "if (op.k === 'trainer') return 'formateurs';", "if (op.k === 'trainer') return 'crm';", 'db:seed-demo'),
 ('R49 interface : le cadre du tableau n’est plus le repère des textes réservés aux lecteurs d’écran', dtable, '<div className="relative overflow-x-auto" aria-busy={busy}>', '<div className="overflow-x-auto" aria-busy={busy}>', 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/training --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/s55-catalogue.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
        lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
        assert lines, 'run inconclusive: ' + out[-300:]
        return ' failed' in lines[-1]
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée.
    return ' failed' in lines[-1] or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())
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
