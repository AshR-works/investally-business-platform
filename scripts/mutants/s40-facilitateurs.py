from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, sys, shutil

API = str(REPO / 'apps' / 'crm-api')
B = API + r'\src\modules\business-development'

# (id, fichier, ancien, nouveau)
UNIT = [
    ('M1 commission sans droit', B + r'\application\register-company.use-case.ts',
     "if (input.commission && !decideFor(access, 'bd.commission.manage', command.ownerUserId).allowed) {", "if (false) {"),
    ('M2 facilitateur étranger accepté', B + r'\application\register-company.use-case.ts',
     "if (!existing || !decideFor(access, 'bd.facilitator.read', existing.ownerUserId).allowed) {", "if (!existing) {"),
    ('M3 pourcentage > 100 accepté', B + r'\domain\commission.ts',
     "if (Number(value) > 100) throw", "if (false) throw"),
    ('M4 méthode inconnue acceptée', B + r'\domain\facilitation.ts',
     "if (!METHODS.includes(method)) throw", "if (false) throw"),
    ('M5 devise non exigée', B + r'\domain\commission.ts',
     "if (!/^[A-Z]{3}$/.test(currency)) {", "if (false) {"),
    ('M6 création de facilitateur sans droit', B + r'\application\register-company.use-case.ts',
     "if (!decideFor(access, 'bd.facilitator.create', command.ownerUserId).allowed) {", "if (false) {"),
    ('M7 e-mail non contrôlé', B + r'\domain\contact-info.ts',
     "if (value.length > 200 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {", "if (false) {"),
    ('M8 commission toujours rendue', B + r'\application\company-view.ts',
     "...(facilitation.canReadCommission", "...(true"),
]

DB = [
    ('D1 fiche : commission rendue à tous', B + r'\application\get-company.query.ts',
     "canReadCommission: decideFor(query.access, 'bd.commission.read', company.ownerUserId).allowed,", "canReadCommission: true,"),
    ('D2 facilitateur : portée ignorée en lecture', B + r'\application\facilitator-queries.ts',
     "if (!facilitator || !decideFor(query.access, 'bd.facilitator.read', facilitator.ownerUserId).allowed) {", "if (!facilitator) {"),
    ('D3 fiche : facilitateur visible à tous', B + r'\application\get-company.query.ts',
     "const canSeeFacilitator = facilitator !== null && decideFor(query.access, 'bd.facilitator.read', facilitator.ownerUserId).allowed;", "const canSeeFacilitator = facilitator !== null;"),
    ('D4 liste facilitateurs non filtrée', B + r'\application\facilitator-queries.ts',
     "ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,", "ownerIds: undefined,"),
]
if len(sys.argv) > 1 and sys.argv[1] == 'db':
    UNIT = DB

def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=API, capture_output=True, text=True, encoding='utf8', errors='replace')
    return r.returncode, r.stdout + r.stderr

mode = sys.argv[1]
killed, survived = [], []
for ident, path, old, new in UNIT:
    src = open(path, encoding='utf8').read()
    if src.count(old) != 1:
        print('ANCRE INTROUVABLE', ident); sys.exit(2)
    shutil.copyfile(path, path + '.orig')
    try:
        open(path, 'w', encoding='utf8', newline='\n').write(src.replace(old, new, 1))
        if mode == 'unit':
            code, out = run('npx jest src/modules/business-development --runInBand --silent')
        else:
            code, out = run('node scripts/test-db.mjs')
        (killed if code != 0 else survived).append(ident)
        print(('TUÉ      ' if code != 0 else 'SURVIVANT '), ident, flush=True)
    finally:
        shutil.move(path + '.orig', path)
print('tués', len(killed), '/', len(UNIT), '; survivants:', survived)
