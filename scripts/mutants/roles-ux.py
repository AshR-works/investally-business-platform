from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import shutil, subprocess
W = str(REPO / 'apps' / 'crm-web')
LIB = W + r'\lib\roles.ts'
PICK = W + r'\components\admin\role-picker.tsx'
PAGE = W + r'\app\(app)\admin\users\page.tsx'
MUT = [
    ('M1 portée la plus ÉTROITE retenue', LIB, "if (current === undefined || SCOPE_RANK[scope] > SCOPE_RANK[current]) merged.set(grant.code, scope);", "if (current === undefined || SCOPE_RANK[scope] < SCOPE_RANK[current]) merged.set(grant.code, scope);"),
    ('M2 rôles non choisis comptés', LIB, "if (!chosen.has(role.code)) continue;", ""),
    ('M3 rôle inconnu perdu', LIB, "if (rest.length > 0) result.push({ group: OTHERS, roles: [...rest] });", ""),
    ('M4 retraits non calculés', LIB, "removed: original.filter((c) => !selected.includes(c))", "removed: []"),
    ('M5 « inchangé » toujours vrai', LIB, "return d.added.length === 0 && d.removed.length === 0;", "return true;"),
    ('M6 ordre des modules ignoré', LIB, "sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))", "sort(([a], [b]) => a.localeCompare(b))"),
    ('M7 pluriel du compteur', LIB, "`${roleCount} rôle${roleCount > 1 ? 's' : ''} sélectionné${roleCount > 1 ? 's' : ''}`", "`${roleCount} rôle sélectionné`"),
    ('M8 libellé de module manquant', LIB, "  audit: 'Audit',\n", ""),
    ('M9 sélection non bloquée pour soi-même', PICK, "disabled={Boolean(locked)}\n                    onChange", "disabled={false}\n                    onChange"),
    ('M10 enregistrement possible pour soi-même', PAGE, "disabled={busy || isSelf || selected.length === 0", "disabled={busy || selected.length === 0"),
    ('M11 enregistrement sans changement', PAGE, " || sameRoles(user.roles, selected)", ""),
]
for name, path, old, new in MUT:
    src = open(path, encoding='utf8').read()
    if old not in src:
        print('?? motif introuvable :', name); continue
    shutil.copy(path, path + '.bak')
    open(path, 'w', encoding='utf8', newline='\n').write(src.replace(old, new, 1))
    try:
        r = subprocess.run('pnpm exec vitest run test/s38.test.ts', cwd=W, capture_output=True, text=True, shell=True, timeout=240)
        print(('TUÉ      ' if r.returncode else 'SURVÉCU  ') + name, flush=True)
    finally:
        shutil.move(path + '.bak', path)
