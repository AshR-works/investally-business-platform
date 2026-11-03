from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
info = os.path.join(api, 'src', 'modules', 'business-development', 'domain', 'contact-info.ts')
mig = os.path.join(api, 'prisma', 'migrations', '20261110000000_phone_format', 'migration.sql')
wphone = os.path.join(web, 'lib', 'phone.ts')
wtable = os.path.join(web, 'components', 'data', 'data-table.tsx')
wcss = os.path.join(web, 'app', 'globals.css')
wmodal = os.path.join(web, 'components', 'modal.tsx')
wlayout = os.path.join(web, 'lib', 'table-layout.ts')
M = [
 ('R1 « + » accepté ailleurs qu’en tête', info, "if (compact.indexOf('+', 1) !== -1) return", "if (Math.random() > 2) return", 'unit'),
 ('R2 premier chiffre 0 accepté', info, "if (digits.startsWith('0')) return", "if (Math.random() > 2) return", 'unit'),
 ('R3 plus de 15 chiffres accepté', info, "if (digits.length > PHONE_MAX_DIGITS) return", "if (Math.random() > 2) return", 'unit'),
 ('R4 numéro trop court accepté', info, "if (digits.length < PHONE_MIN_DIGITS) return", "if (Math.random() > 2) return", 'unit'),
 ('R5 séparateurs (- . ( )) acceptés', info, "if (/[^0-9+ ]/.test(value)) return", "if (Math.random() > 2) return", 'unit'),
 ('R6 espaces conservés à l’enregistrement', info, "return value.replace(EXOTIC_SPACES, '').replace(/ /g, '');", "return value;", 'unit'),
 ('R7 espaces insécables non traités comme des espaces', info, "const value = raw.replace(EXOTIC_SPACES, ' ').trim();", "const value = raw.trim();", 'unit'),
 ('R8 règle absente de la base (contacts)', mig, "ALTER TABLE \"bd\".\"contacts\" ADD CONSTRAINT \"contacts_phone_format\" CHECK (COALESCE(\"phone\" IS NULL OR \"phone\" ~ '^\\+?[1-9][0-9]{7,14}$', false)) NOT VALID;", "", 'db:contacts-http'),
 ('R9 règle absente de la base (entreprises)', mig, "ALTER TABLE \"bd\".\"companies\" ADD CONSTRAINT \"companies_phone_format\" CHECK (COALESCE(\"phone\" IS NULL OR \"phone\" ~ '^\\+?[1-9][0-9]{7,14}$', false)) NOT VALID;", "", 'db:contacts-http'),
 ('R10 interface : premier chiffre 0 accepté', wphone, "if (digits.startsWith('0')) return", "if (Math.random() > 2) return", 'web:phone'),
 ('R11 interface : plus de 15 chiffres accepté', wphone, "if (digits.length > PHONE_MAX_DIGITS) return", "if (Math.random() > 2) return", 'web:phone'),
 ('R12 interface : « + » accepté ailleurs qu’en tête', wphone, "if (compact.indexOf('+', 1) !== -1) return", "if (Math.random() > 2) return", 'web:phone'),
 ('R13 interface : nettoyage différent du serveur', wphone, "export const cleanPhone = (raw: string): string => raw.replace(EXOTIC_SPACES, '').replace(/ /g, '');", "export const cleanPhone = (raw: string): string => raw.trim();", 'web:phone'),
 ('R14 tableau : retour aux symboles de texte', wtable, "name={sorted === 'asc' ? 'sort-asc' : sorted === 'desc' ? 'sort-desc' : 'sort'}", "name={sorted === 'asc' ? 'sort-asc' : sorted === 'desc' ? 'sort-desc' : 'sort'} data-glyph=\"↕\"", 'web:corrections'),
 ('R15 tableau : retour à la mise en page automatique (les colonnes bougent au tri)', wtable, "w-full min-w-[48rem] table-fixed border-collapse", "w-full min-w-[48rem] border-collapse", 'web:corrections'),
 ('R23 tableau : parts de colonnes ignorées', wlayout, "const parts = weights.map((w) => (w !== undefined && w > 0 ? w : 1));", "const parts = weights.map(() => 1);", 'web:corrections'),
 ('R24 tableau : marge de la case de sélection oubliée', wlayout, "export const SELECTION_SHARE = 93;", "export const SELECTION_SHARE = 100;", 'web:corrections'),
 ('R16 tableau : emplacement d’icône de taille variable', wtable, "className={`size-4 ${sorted", "className={`${sorted", 'web:corrections'),
 ('R17 fenêtre : le cadre défile à nouveau', wcss, "display: flex; flex-direction: column; overflow: hidden; }", "display: block; overflow: auto; }", 'web:corrections'),
 ('R18 fenêtre : place de la barre non réservée', wcss, "scrollbar-gutter: stable; ", "", 'web:corrections'),
 ('R19 fenêtre : boutons d’action qui défilent', wcss, "position: sticky; bottom: 0; z-index: 1;", "", 'web:corrections'),
 ('R21 barres de défilement : retour aux barres épaisses', wcss, "* { scrollbar-width: thin; scrollbar-color:", "* { scrollbar-width: auto; scrollbar-color:", 'web:corrections'),
 ('R22 barres de défilement : pas de renfort au survol', wcss, "*:hover { scrollbar-color:", "*:not(*) { scrollbar-color:", 'web:corrections'),
 ('R20 fenêtre : contenu hors du corps défilant', wmodal, "<div className=\"dialog-body\">{children}</div>", "{children}", 'web:corrections'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    elif kind.startswith('web:'):
        out = subprocess.run('pnpm exec vitest run test/' + {'phone': 'phone', 'corrections': 'corrections-recette'}[kind.split(':')[1]] + '.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
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
