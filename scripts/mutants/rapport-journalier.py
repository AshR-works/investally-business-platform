from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import shutil, subprocess
P = str(REPO / 'scripts' / 'daily-report.mjs')
MUT = [
    ('M3 lien javascript accepté', " && !/^javascript:/i.test(href)", ""),
    ('M4 compléments manuels ignorés', ", 'g'))].flatMap((m) => m[1]", "))].flatMap((m) => m[1]"),
    ('M5 e-mail non détecté', "if (/@[\\w-]+\\.\\w/.test(", "if (false && /@[\\w-]+\\.\\w/.test("),
    ('M6 fusion comptée dans le changelog', "if (isMerge(commit)) return null;", ""),
    ('M7 blocs manuels écrasés au rafraîchissement', "if (keep !== null) md = setBlock(md, 'manual', name, keep);", ""),
    ('M8 créé-puis-supprimé non ignoré', "if (first === 'A' && last === 'D') continue;", ""),
    ('M9 semaine ISO décalée', "d.setUTCDate(d.getUTCDate() + 4 - day);", "d.setUTCDate(d.getUTCDate() + 3 - day);"),
]
src0 = open(P, encoding='utf8').read()
for name, old, new in MUT:
    if old not in src0:
        print('?? motif introuvable :', name); continue
    shutil.copy(P, P + '.bak')
    open(P, 'w', encoding='utf8', newline='\n').write(src0.replace(old, new, 1))
    try:
        r = subprocess.run(['node', '--test', 'scripts/daily-report.test.mjs'], cwd=str(REPO), capture_output=True, text=True, timeout=120)
        killed = r.returncode != 0
    finally:
        shutil.move(P + '.bak', P)
    print(('TUÉ      ' if killed else 'SURVÉCU  ') + name, flush=True)
