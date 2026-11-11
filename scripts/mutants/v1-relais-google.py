from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
api = str(REPO / 'apps' / 'api')
notif = os.path.join(api, 'src', 'modules', 'notifications', 'infrastructure')
sender = os.path.join(notif, 'smtp-relay-email-sender.ts')
factory = os.path.join(notif, 'email-sender.factory.ts')
loader = os.path.join(api, 'src', 'platform', 'app-config.loader.ts')
listen = os.path.join(api, 'src', 'platform', 'listen-address.ts')
M = [
 # --- Adaptateur d'envoi par le relais SMTP
 ('S1 message invalide envoyé quand même', sender, "    if (reason) {\n      this.logger.warn(`E-mail refusé avant envoi", "    if (false) {\n      this.logger.warn(`E-mail refusé avant envoi"),
 ('S2 le HTML est toujours transmis (même absent)', sender, "...(message.html === undefined ? {} : { html: message.html }),", "html: message.html,"),
 ('S3 l’expéditeur est le destinataire', sender, "from: this.relay.sender,", "from: message.to,"),
 ('S4 destinataire refusé par le relais compté comme envoyé', sender, "if (info.accepted.length === 0) {", "if (false) {"),
 ('S5 refus définitif dès 400', sender, "smtp >= 500", "smtp >= 400"),
 ('S6 refus définitif jamais', sender, "smtp >= 500", "smtp >= 600"),
 ('S7 erreurs de configuration jamais définitives', sender, "if (smtp === null && typeof code === 'string' && REJECTED_CODES.has(code)) {", "if (false) {"),
 ('S8 le code prime sur la réponse SMTP', sender, "if (smtp === null && typeof code === 'string' && REJECTED_CODES.has(code))", "if (typeof code === 'string' && REJECTED_CODES.has(code))"),
 ('S9 échec du chiffrement non définitif', sender, "new Set(['EAUTH', 'EENVELOPE', 'ETLS'])", "new Set(['EAUTH', 'EENVELOPE'])"),
 ('S10 échec d’authentification non définitif', sender, "new Set(['EAUTH', 'EENVELOPE', 'ETLS'])", "new Set(['EENVELOPE', 'ETLS'])"),
 ('S11 chiffrement non exigé', sender, "requireTLS: relay.security === 'starttls',", "requireTLS: false,"),
 ('S12 chiffrement toujours abandonné (ÉQUIVALENT : requireTLS l’emporte sur ignoreTLS dans nodemailer)', sender, "ignoreTLS: relay.security === 'none',", "ignoreTLS: true,"),
 ('S12b chiffrement tenté même en mode « none »', sender, "ignoreTLS: relay.security === 'none',", "ignoreTLS: false,"),
 ('S13 connexion chiffrée d’emblée', sender, "secure: false,", "secure: true,"),
 ('S14 le détail de l’erreur est journalisé', sender, "this.logger.warn(`Envoi SMTP refusé par le relais (réponse ${smtp})`);", "this.logger.warn(`Envoi SMTP refusé par le relais (réponse ${smtp}) ${(error as Error).message}`);"),
 # --- Choix de l'adaptateur
 ('F1 le relais n’est jamais choisi', factory, "if (config.email.provider === 'google-relay' && config.email.googleRelay) return new SmtpRelayEmailSender(config.email.googleRelay);", ""),
 ('F2 le relais est choisi sans réglages', factory, "config.email.provider === 'google-relay' && config.email.googleRelay)", "config.email.provider === 'google-relay')"),
 # --- Configuration
 ('C1 fournisseur « google-relay » non reconnu', loader, "env.EMAIL_PROVIDER === 'google-relay' ? 'google-relay' : 'log'", "false ? 'google-relay' : 'log'"),
 ('C2 adresse d’expédition facultative', loader, "const sender = env.EMAIL_SENDER?.trim() ?? '';", "const sender = env.EMAIL_SENDER?.trim() || 'x@exemple.test';"),
 ('C3 serveur par défaut modifié', loader, "env.SMTP_HOST?.trim() || 'smtp-relay.gmail.com'", "env.SMTP_HOST?.trim() || 'smtp.gmail.com'"),
 ('C4 port par défaut modifié', loader, "env.SMTP_PORT?.trim() || '587'", "env.SMTP_PORT?.trim() || '25'"),
 ('C5 port au-dessus de 65535 accepté', loader, "port > 65535", "port > 65536"),
 ('C6 port zéro accepté', loader, "port < 1", "port < 0"),
 ('C7 chiffrement par défaut abandonné', loader, "env.SMTP_SECURITY?.trim() || 'starttls'", "env.SMTP_SECURITY?.trim() || 'none'"),
 ('C8 « none » accepté en production', loader, "if (production && security === 'none') throw", "if (false && security === 'none') throw"),
 ('C9 mode de chiffrement inconnu accepté', loader, "if (security !== 'starttls' && security !== 'none') throw", "if (false) throw"),
 ('C10 nom de serveur non validé', loader, "if (!/^(?=.{1,253}$)(", "if (false && !/^(?=.{1,253}$)("),
 ('C11 le chiffrement lu est ignoré', loader, "googleRelay = { host, port, sender, security };", "googleRelay = { host, port, sender, security: 'starttls' };"),
 ('C12 le port lu est ignoré', loader, "googleRelay = { host, port, sender, security };", "googleRelay = { host, port: 587, sender, security };"),
 # --- Adresse d'écoute de l'API
 ('L1 l’API écoute sur toutes les interfaces par défaut', listen, "if (!raw) return '127.0.0.1';", "if (!raw) return '0.0.0.0';"),
 ('L2 adresse invalide acceptée', listen, "if (!valid) throw", "if (false) throw"),
 ('L3 octet au-dessus de 255 accepté', listen, "Number(part) <= 255", "Number(part) <= 256"),
 ('L4 adresse à moins de quatre octets acceptée', listen, "octets.length === 4", "octets.length >= 3"),
 ('L5 espaces non retirés', listen, "env.API_HOST?.trim()", "env.API_HOST"),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b in M:
        n = read(path)[1].replace('\r\n', '\n').count(a)
        if n != 1:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run():
    out = subprocess.run('pnpm exec jest src/modules/notifications src/platform --silent', cwd=api, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines or 'Test Suites:' in out, 'run inconclusive: ' + out[-300:]
    # Une suite qui ne compile plus (le vérificateur de types refuse la faute) est aussi une faute détectée : « Tests » ne compte alors que les autres suites.
    return (bool(lines) and ' failed' in lines[-1]) or any(l.startswith('Test Suites:') and ' failed' in l for l in out.splitlines())


res = []
for name, path, a, b in M:
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
        killed = run()
    finally:
        open(path, 'wb').write(raw)
    print(name, 'TUÉ' if killed else 'SURVIVANT', flush=True)
    res.append((name, killed))
survivors = [n for n, k in res if k is not True]
print(f'\n{len(res) - len(survivors)} / {len(res)} tués')
for n in survivors:
    print('  survivant :', n)
