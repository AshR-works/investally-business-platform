from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
iam = os.path.join(api, 'src', 'modules', 'iam')
csv = os.path.join(iam, 'application', 'admin', 'csv.ts')
exp = os.path.join(iam, 'application', 'admin', 'admin-exports.ts')
ctl = os.path.join(iam, 'presentation', 'admin-exports.controller.ts')
rdr = os.path.join(iam, 'infrastructure', 'prisma-admin-export.reader.ts')
DB = 'db:admin-exports-http'
M = [
 # --- CSV : tableur français et injection de formule
 ('C1 la marque d’ordre des octets disparaît (accents illisibles dans Excel)', csv, "const BOM = '\\uFEFF';", "const BOM = '';", 'unit'),
 ('C2 le séparateur devient une virgule', csv, "const SEPARATOR = ';';", "const SEPARATOR = ',';", 'unit'),
 ('C3 « = » n’est plus neutralisé', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[+\\-@\\t\\r]/;", 'unit'),
 ('C4 « + » n’est plus neutralisé', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[=\\-@\\t\\r]/;", 'unit'),
 ('C5 « - » n’est plus neutralisé', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[=+@\\t\\r]/;", 'unit'),
 ('C6 « @ » n’est plus neutralisé', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[=+\\-\\t\\r]/;", 'unit'),
 ('C7 la tabulation n’est plus neutralisée', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[=+\\-@\\r]/;", 'unit'),
 ('C8 le retour chariot n’est plus neutralisé', csv, "const FORMULA_START = /^[=+\\-@\\t\\r]/;", "const FORMULA_START = /^[=+\\-@\\t]/;", 'unit'),
 ('C9 la neutralisation n’ajoute plus rien', csv, "return FORMULA_START.test(text) ? `'${text}` : text;", "return FORMULA_START.test(text) ? `${text}` : text;", 'unit'),
 ('C10 un texte avec « ; » n’est plus entre guillemets', csv, "return /[;\"\\r\\n]/.test(text)", "return /[\"\\r\\n]/.test(text)", 'unit'),
 ('C11 un texte avec un guillemet n’est plus entre guillemets', csv, "return /[;\"\\r\\n]/.test(text)", "return /[;\\r\\n]/.test(text)", 'unit'),
 ('C12 un texte avec un saut de ligne n’est plus entre guillemets', csv, "return /[;\"\\r\\n]/.test(text)", "return /[;\"]/.test(text)", 'unit'),
 ('C13 les guillemets ne sont plus doublés', csv, ".replace(/\"/g, '\"\"')", ".replace(/\"/g, '\"')", 'unit'),
 ('C14 « oui » et « non » sont inversés', csv, "return value ? 'oui' : 'non';", "return value ? 'non' : 'oui';", 'unit'),
 ('C15 l’absence s’écrit « null »', csv, "if (value === null || value === undefined) return '';", "if (value === null || value === undefined) return 'null';", 'unit'),
 ('C16 un nombre non fini est écrit tel quel', csv, "return Number.isFinite(value) ? String(value) : '';", "return String(value);", 'unit'),
 ('C17 une ligne trop courte est acceptée', csv, "if (row.length !== header.length) throw", "if (false) throw", 'unit'),
 ('C18 les lignes se terminent par un simple saut de ligne', csv, ".join('\\r\\n')}\\r\\n`;", ".join('\\n')}\\r\\n`;", 'unit'),
 ('C19 le fichier ne se termine plus par une fin de ligne', csv, ".join('\\r\\n')}\\r\\n`;", ".join('\\r\\n')}`;", 'unit'),
 # --- Export : droit, période, trace, contenu
 ('E1 la portée Tous n’est plus exigée', exp, "if (!decision.allowed || decision.scope !== Scope.All) throw", "if (!decision.allowed) throw", 'unit'),
 ('E2 le droit n’est plus vérifié par le cas d’usage', exp, "if (!decision.allowed || decision.scope !== Scope.All) throw", "if (false) throw", 'unit'),
 ('E3 la période zéro est acceptée', exp, "days < 1 || days > MAX_SESSION_DAYS", "days < 0 || days > MAX_SESSION_DAYS", 'unit'),
 ('E4 une période décimale est acceptée', exp, "(!Number.isInteger(days) || days < 1", "(days < 1", 'unit'),
 ('E5 la période de 366 jours est acceptée', exp, "days < 1 || days > MAX_SESSION_DAYS", "days < 1 || days > MAX_SESSION_DAYS + 1", 'unit'),
 ('E6 la période de 365 jours est refusée', exp, "days < 1 || days > MAX_SESSION_DAYS", "days < 1 || days >= MAX_SESSION_DAYS", 'unit'),
 ('E7 la période n’est plus contrôlée pour les sessions', exp, "if (command.kind === 'sessions' && (", "if (false && (", 'unit'),
 ('E8 la période par défaut n’est plus de 90 jours', exp, "const days = command.days ?? DEFAULT_SESSION_DAYS;", "const days = command.days ?? 30;", 'unit'),
 ('E9 la trace d’export est enregistrée comme une création', exp, "action: AuditAction.Export,", "action: AuditAction.Create,", 'unit'),
 ('E10 la trace recopie le contenu du fichier', exp, "newValue: { export: command.kind, format: 'csv', rows: built.rows, fileName,", "newValue: { export: command.kind, format: 'csv', rows: built.rows, fileName, csv: built.csv,", 'unit'),
 ('E11 la trace oublie la période des sessions', exp, "...(command.kind === 'sessions' ? { days } : {}) }", "}", 'unit'),
 ('E12 la déconnexion ne prime plus', exp, "if (row.loggedOutAt) return { endedAt: row.loggedOutAt, reason: 'Déconnexion' };", "", 'unit'),
 ('E13 la révocation perd son motif', exp, "reason: row.revokedReason ? `Révoquée : ${row.revokedReason}` : 'Révoquée' }", "reason: 'Révoquée' }", 'unit'),
 ('E14 une session expirée à l’instant est dite active', exp, "if (expiry <= now) return", "if (expiry < now) return", 'unit'),
 ('E15 l’expiration absolue n’est plus prise en compte', exp, "const expiry = row.expiresAt < row.absoluteExpiresAt ? row.expiresAt : row.absoluteExpiresAt;", "const expiry = row.expiresAt;", 'unit'),
 ('E16 les statuts ne sont plus traduits', exp, "STATUS_LABEL[u.status] ?? u.status", "u.status", 'unit'),
 ('E17 les rôles ne sont plus triés', exp, "[...u.roles].sort().join(' | ')", "u.roles.join(' | ')", 'unit'),
 ('E18 la limite des utilisateurs est atteinte trop tôt', exp, "if (rows.length > MAX_USER_ROWS) throw", "if (rows.length >= MAX_USER_ROWS) throw", 'unit'),
 ('E19 la limite des sessions est atteinte trop tôt', exp, "if (rows.length > MAX_SESSION_ROWS) throw", "if (rows.length >= MAX_SESSION_ROWS) throw", 'unit'),
 ('E20 la période est comptée en secondes', exp, "days * 24 * 3_600_000", "days * 24 * 3_600", 'unit'),
 ('E21 le nom du fichier garde les deux-points', exp, ".replace(':', 'h')", ".replace(':', ':')", 'unit'),
 ('E22 les droits ne sont plus triés', exp, ".sort((a, b) => a.code.localeCompare(b.code))", "", 'unit'),
 ('E23 la portée n’est plus dite en français', exp, "SCOPE_LABEL[permission.scope] ?? permission.scope", "permission.scope", 'unit'),
 ('E24 le libellé de la ressource disparaît', exp, "RESOURCES.find((r) => r.module === module && r.resource === resource)?.label ?? ''", "''", 'unit'),
 ('E25 les rôles n’ont plus leur libellé', exp, "labels.get(code) ?? code", "code", 'unit'),
 ('E26 le responsable n’est plus exporté', exp, "u.managerEmail, u.mfaEnabled,", "null, u.mfaEnabled,", 'unit'),
 # --- Route et lecture en base
 ('R1 le second facteur récent n’est plus exigé', ctl, "@Protected('iam.export.read', { stepUp: true, minScope: 'ALL' })", "@Protected('iam.export.read', { minScope: 'ALL' })", 'unit'),
 ('R2 la route n’exige plus la permission d’export', ctl, "@Protected('iam.export.read', { stepUp: true, minScope: 'ALL' })", "@Protected('iam.role.read', { stepUp: true, minScope: 'ALL' })", 'unit'),
 ('R3 le type d’export n’est plus contrôlé', ctl, "@Param('kind', new ParseEnumPipe(ADMIN_EXPORT_KINDS)) kind: AdminExportKind", "@Param('kind') kind: AdminExportKind", DB),
 ('R4 la mise en cache n’est plus interdite', ctl, "res.setHeader('Cache-Control', 'no-store');", "", DB),
 ('R5 le fichier s’affiche au lieu d’être téléchargé', ctl, "`attachment; filename=\"${result.fileName}\"`", "`inline; filename=\"${result.fileName}\"`", DB),
 ('R6 le type de contenu n’est plus du CSV', ctl, "'text/csv; charset=utf-8'", "'text/plain; charset=utf-8'", DB),
# R7 (retiré) : l'en-tête nosniff de la route double celui de Helmet, posé pour toutes les réponses : sa suppression est sans effet observable.
 ('R8 la politique de contenu disparaît', ctl, "res.setHeader('Content-Security-Policy', \"default-src 'none'\");", "", DB),
 ('R9 les comptes supprimés sont exportés', rdr, "where: { deletedAt: null },", "", DB),
 ('R10 la période des sessions n’est plus appliquée', rdr, "where: { loggedInAt: { gte: since } },", "", DB),
 ('R11 la limite des sessions n’est plus passée à la base', rdr, "      orderBy: [{ loggedInAt: 'desc' }, { id: 'asc' }],\n      take: limit + 1,", "      orderBy: [{ loggedInAt: 'desc' }, { id: 'asc' }],", DB),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54481')


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        text = read(path)[1].replace('\r\n', '\n')
        n = text.count(a)
        if n != 1 or a == b:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/iam --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée.
    return ' failed' in lines[-1] or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


res = []
for name, path, a, b, kind in M:
    raw, s = read(path)
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
