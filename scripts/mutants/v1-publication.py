from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'crm-api')
web = str(REPO / 'apps' / 'crm-web')
rel = os.path.join(api, 'src', 'platform', 'released-domains.ts')
guard = os.path.join(api, 'src', 'platform', 'release-gate.guard.ts')
loader = os.path.join(api, 'src', 'platform', 'app-config.loader.ts')
profile = os.path.join(api, 'src', 'modules', 'iam', 'application', 'get-profile.handler.ts')
appmod = os.path.join(api, 'src', 'app.module.ts')
wperm = os.path.join(web, 'lib', 'permissions.ts')
wmod = os.path.join(web, 'lib', 'modules.ts')
DB = 'db:release-gate.integration'
M = [
 # --- Lecture de RELEASED_DOMAINS
 ('R1 le domaine hr n’est plus connu', rel, "['iam', 'audit', 'docs', 'bd', 'hr', 'training', 'reporting']", "['iam', 'audit', 'docs', 'bd', 'training', 'reporting']", 'unit'),
 ('R2 le domaine d’une permission est son deuxième segment', rel, "permission.split('.')[0] ?? ''", "permission.split('.')[1] ?? ''", 'unit'),
 ('R3 RELEASED_DOMAINS facultatif en production', rel, "    if (production) throw new Error(\"RELEASED_DOMAINS est obligatoire", "    if (false) throw new Error(\"RELEASED_DOMAINS est obligatoire", 'unit'),
 ('R4 « all » non reconnu', rel, "  if (value === 'all') return null;\n", "", 'unit'),
 ('R5 domaine inconnu accepté', rel, "if (!(KNOWN_DOMAINS as readonly string[]).includes(domain)) {", "if (false) {", 'unit'),
 ('R6 « iam » non exigé', rel, "if (!domains.includes('iam')) throw", "if (false) throw", 'unit'),
 ('R7 doublons conservés', rel, "[...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))]", "value.split(',').map((part) => part.trim()).filter(Boolean)", 'unit'),
 ('R8 casse non ramenée en minuscules', rel, "raw?.trim().toLowerCase()", "raw?.trim()", 'unit'),
 ('R9 « tout publié » (null) lu comme « rien de publié »', rel, "released === null || released.includes(domain)", "released !== null && released.includes(domain)", 'unit'),
 ('R10 le domaine publié n’est pas reconnu', rel, "released === null || released.includes(domain)", "released === null || !released.includes(domain)", 'unit'),
 ('L1 la configuration ignore RELEASED_DOMAINS', loader, "releasedDomains: parseReleasedDomains(env.RELEASED_DOMAINS, production),", "releasedDomains: null,", 'unit'),
 ('L2 la configuration ignore le mode production', loader, "parseReleasedDomains(env.RELEASED_DOMAINS, production)", "parseReleasedDomains(env.RELEASED_DOMAINS, false)", 'unit'),
 # --- Garde du serveur
 ('G1 les routes sans permission sont examinées', guard, "if (!permission) return true;", "if (false) return true;", 'unit'),
 ('G2 la permission de la classe n’est pas lue', guard, "[context.getHandler(), context.getClass()]", "[context.getHandler()]", 'unit'),
 ('G3 refus avec un autre code que « introuvable »', guard, "throw new DomainError('NOT_FOUND', \"Cette fonction", "throw new DomainError('FORBIDDEN', \"Cette fonction", 'unit'),
 ('G4 un domaine publié est refusé', guard, "if (isDomainReleased(this.config.releasedDomains, domainOfPermission(permission))) return true;", "if (isDomainReleased(this.config.releasedDomains, domainOfPermission(permission))) return false;", 'unit'),
 ('G5 le refus ne mentionne plus la prochaine mise à jour', guard, "elle est prévue pour une prochaine mise à jour.", "essayez plus tard.", 'unit'),
 ('G6 la garde n’est plus branchée', appmod, "    { provide: APP_GUARD, useClass: ReleaseGateGuard },\n", "", DB),
 ('P1 le profil ne dit pas à l’interface ce qui est publié', profile, "releasedDomains: this.config.releasedDomains === null ? null : [...this.config.releasedDomains],", "releasedDomains: null,", DB),
 # --- Interface
 ('W1 domaine publié non reconnu', wperm, "return released == null || released.includes(domain);", "return released != null && released.includes(domain);", 'web'),
 ('W2 les droits ignorent la publication', wperm, "return isReleased(profile, domainOf(permission)) && !!profile?.permissions.some((grant) => grant.code === permission);", "return !!profile?.permissions.some((grant) => grant.code === permission);", 'web'),
 ('W3 les droits « Tous » ignorent la publication', wperm, "return isReleased(profile, domainOf(permission)) && !!profile?.permissions.some((grant) => grant.code === permission && grant.scope === 'ALL');", "return !!profile?.permissions.some((grant) => grant.code === permission && grant.scope === 'ALL');", 'web'),
 ('W4 « À venir » n’accueille pas les modules hors version', wmod, "return MODULES.filter((m) => !m.href || !isModuleReleased(profile, m));", "return MODULES.filter((m) => !m.href);", 'web'),
 ('W5 un module sans permission est jugé non publié', wmod, "return !m.permission || isReleased(profile, domainOf(m.permission));", "return !!m.permission && isReleased(profile, domainOf(m.permission));", 'web'),
 ('W6 le domaine d’une permission est son deuxième segment (interface)', wperm, "permission.split('.')[0] ?? ''", "permission.split('.')[1] ?? ''", 'web'),
 ('W7 aucune page n’est jamais bloquée', wmod, "return module && !isModuleReleased(profile, module) ? module : null;", "return null;", 'web'),
 ('W8 toute page d’un module est bloquée', wmod, "return module && !isModuleReleased(profile, module) ? module : null;", "return module;", 'web'),
 ('W9 le module d’une page est cherché parmi les seuls modules visibles', wmod, "return activeModule(MODULES, pathname);", "return activeModule(MODULES.filter((m) => m.permission === undefined), pathname);", 'web'),
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
        n = read(path)[1].replace('\r\n', '\n').count(a)
        if n != 1:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/platform --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    elif kind == 'web':
        out = subprocess.run('pnpm exec vitest run test/v1-release.test.ts test/n1-navigation.test.ts test/s38.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
        lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
        assert lines, 'run inconclusive: ' + out[-300:]
        return ' failed' in lines[-1] or 'FAIL' in out
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=' + kind.split(':')[1]], cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=800, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines or 'Test Suites:' in out, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée : « Tests » ne compte alors que les autres suites.
    return (bool(lines) and ' failed' in lines[-1]) or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


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
    print(name, 'TUÉ' if killed else ('SURVIVANT' if killed is False else 'INCONCLUANT'), flush=True)
    res.append((name, killed))
survivors = [n for n, k in res if k is not True]
print(f'\n{len(res) - len(survivors)} / {len(res)} tués')
for n in survivors:
    print('  survivant :', n)
