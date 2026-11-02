from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'crm-api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'ambassador.ts')
uc = os.path.join(base, 'application', 'ambassador-use-cases.ts')
ctrl = os.path.join(base, 'presentation', 'ambassadors.controller.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-ambassador.repository.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261108000000_s4_4b_ambassadors', 'migration.sql')
M = [
 ('R1 client sans entreprise accepté', dom, "if (origin === AmbassadorOrigin.Client && !companyId) {", "if (Math.random() > 2) {", 'unit'),
 ('R2 date de début dans le futur acceptée', dom, "if (appointedOn > input.now.toISOString().slice(0, 10))", "if (Math.random() > 2)", 'unit'),
 ('R3 origine non vérifiée', dom, "if (!ORIGINS.includes(raw ?? ''))", "if (Math.random() > 2)", 'unit'),
 ('R4 e-mail partagé permis par la base', mig, "CREATE UNIQUE INDEX \"ambassadors_email_unique\" ON \"bd\".\"ambassadors\"(\"email\") WHERE \"email\" IS NOT NULL;", "", 'db:ambassadors-http'),
 ('R5 entreprise d’un collègue acceptée', uc, "if (!company || !decideFor(access, 'bd.company.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');", "if (!company) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');", 'unit'),
 ('R6 le créateur n’est pas le responsable', uc, "ownerUserId: command.access.actorId, companyId", "ownerUserId: 'inconnu', companyId", 'unit'),
 ('R7 droit de création non contrôlé', uc, "if (!decideFor(command.access, 'bd.ambassador.create', command.access.actorId).allowed) throw new DomainError('FORBIDDEN', \"Vous n'avez pas le droit de créer un ambassadeur\");", "", 'unit'),
 ('R8 portée de la modification ignorée', uc, "if (!ambassador || !decideFor(access, permission, ambassador.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);", "if (!ambassador) throw new DomainError('NOT_FOUND', NOT_FOUND);", 'unit'),
 ('R9 verrou optimiste absent', uc, "if (ambassador.version !== command.version) {", "if (Math.random() > 2) {", 'unit'),
 ('R10 portée de la liste ignorée', uc, "ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,", "ownerIds: undefined,", 'unit'),
 ('R11 un client peut perdre son entreprise', dom, "    assertCompany(next.origin, next.companyId);\n    this.props = next;", "    this.props = next;", 'unit'),
 ('R12 modification sous le droit de lecture (route)', ctrl, "@Protected('bd.ambassador.update')", "@Protected('bd.ambassador.read')", 'db:ambassadors-http'),
 ('R13 client sans entreprise permis par la base', mig, "ALTER TABLE \"bd\".\"ambassadors\" ADD CONSTRAINT \"ambassadors_client_has_company\" CHECK (COALESCE(\"origin\" <> 'CLIENT' OR \"company_id\" IS NOT NULL, false));", "", 'db:ambassadors-http'),
 ('R14 téléphone non enregistré (base)', repo, "      phone: ambassador.phone,\n", "", 'db:ambassadors-http'),
 ('R15 note non enregistrée (base)', repo, "      note: ambassador.note,\n", "", 'db:ambassadors-http'),
 ('R16 filtre par origine ignoré (base)', repo, "...(query.origin ? { origin: query.origin } : {}),", "", 'db:ambassadors-http'),
 ('R17 noms vides permis par la base', mig, "ALTER TABLE \"bd\".\"ambassadors\" ADD CONSTRAINT \"ambassadors_names_not_blank\" CHECK (COALESCE(length(btrim(\"last_name\")) > 0 AND length(btrim(\"first_name\")) > 0, false));", "", 'db:ambassadors-http'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
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
