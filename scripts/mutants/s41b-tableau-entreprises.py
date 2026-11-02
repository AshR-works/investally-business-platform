from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os
root = str(REPO / 'apps' / 'crm-api')
base = os.path.join(root, 'src', 'modules', 'business-development')
repo = os.path.join(base, 'infrastructure', 'prisma-company.repository.ts')
reader = os.path.join(base, 'infrastructure', 'prisma-company-overview.reader.ts')
handler = os.path.join(base, 'application', 'get-company-overview.query.ts')
mutants = [
    ('M1 synthèse sans portée (valeurs de filtre)', reader, "companyWhere({ ownerIds: query.ownerIds })", "companyWhere({})"),
    ('M2 synthèse sans portée (handler)', handler, "ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,", "ownerIds: undefined,"),
    ('M3 pays sensible à la casse', repo, "country: { equals: query.country, mode: 'insensitive' }", "country: { equals: query.country }"),
    ('M4 absents en premier', repo, "nulls: 'last'", "nulls: 'first'"),
    ('M5 filtre de statut ignoré', repo, "...(query.status ? { status: query.status } : {}),", ""),
    ('M6 secteur ignoré dans la synthèse', repo, "...(query.sector ? { sector: { equals: query.sector, mode: 'insensitive' } } : {}),", ""),
    ('M7 tri secondaire absent (pagination instable)', repo, "orderBy: [...orderFor(query.sort ?? 'createdAt', direction), { id: direction }],", "orderBy: [...orderFor(query.sort ?? 'createdAt', direction)],"),
]
res = []
for name, path, a, b in mutants:
    s = open(path, encoding='utf8').read()
    assert s.count(a) == 1, name
    open(path, 'w', encoding='utf8', newline='\n').write(s.replace(a, b))
    try:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=companies-table'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=400).stdout
        killed = ' failed' in out.split('Tests:')[-1].split('\n')[0]
    finally:
        open(path, 'w', encoding='utf8', newline='\n').write(s)
    res.append((name, killed))
    print(name, 'TUÉ' if killed else 'SURVIVANT', flush=True)
print(sum(k for _, k in res), '/', len(res))
