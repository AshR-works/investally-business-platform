import { createServer, Server, Socket } from 'node:net';
import { SmtpRelayEmailSender, SmtpTransport } from './infrastructure/smtp-relay-email-sender';

const RELAY = { host: 'smtp-relay.gmail.com', port: 587, sender: 'no-reply@exemple.test', security: 'starttls' as const };
const MESSAGE = { to: 'prenom.nom@exemple.test', subject: 'Invitation', text: 'Votre lien : https://app.exemple.test/invitation#token=abc' };

const fake = (impl: SmtpTransport['sendMail']): SmtpTransport & { calls: Parameters<SmtpTransport['sendMail']>[0][] } => {
  const calls: Parameters<SmtpTransport['sendMail']>[0][] = [];
  return { calls, sendMail: async (options) => { calls.push(options); return impl(options); } };
};

describe('SmtpRelayEmailSender — issues d’envoi (transport simulé)', () => {
  it('envoie avec l’adresse d’expédition configurée et rend ok', async () => {
    const transport = fake(async () => ({ accepted: ['x'] }));
    expect(await new SmtpRelayEmailSender(RELAY, transport).send({ ...MESSAGE, html: '<p>Bonjour</p>' })).toEqual({ ok: true });
    expect(transport.calls).toEqual([{ from: 'no-reply@exemple.test', to: MESSAGE.to, subject: 'Invitation', text: MESSAGE.text, html: '<p>Bonjour</p>' }]);
  });

  it('n’envoie pas de champ HTML quand il n’y en a pas', async () => {
    const transport = fake(async () => ({ accepted: ['x'] }));
    await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE);
    expect(Object.keys(transport.calls[0]!)).not.toContain('html');
  });

  it('refuse avant tout envoi un message invalide (adresse, injection d’en-tête, sujet vide)', async () => {
    const transport = fake(async () => ({ accepted: ['x'] }));
    const sender = new SmtpRelayEmailSender(RELAY, transport);
    for (const bad of [{ ...MESSAGE, to: 'a@b.cm\r\nBcc: x@y.cm' }, { ...MESSAGE, to: 'pas une adresse' }, { ...MESSAGE, subject: '' }, { ...MESSAGE, subject: 'a\r\nBcc: x@y.cm' }, { ...MESSAGE, text: '' }]) {
      expect(await sender.send(bad)).toEqual({ ok: false, reason: 'INVALID' });
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('un destinataire refusé par le relais donne REJECTED', async () => {
    expect(await new SmtpRelayEmailSender(RELAY, fake(async () => ({ accepted: [] }))).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
  });

  it.each([[550], [553], [500], [554]])('une réponse SMTP %i (refus définitif) donne REJECTED', async (responseCode) => {
    const transport = fake(async () => { throw Object.assign(new Error('refus'), { responseCode }); });
    expect(await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
  });

  it.each([[421], [450], [451], [452], [499]])('une réponse SMTP %i (refus passager) donne UNAVAILABLE', async (responseCode) => {
    const transport = fake(async () => { throw Object.assign(new Error('plus tard'), { responseCode }); });
    expect(await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it.each([['EAUTH'], ['EENVELOPE'], ['ETLS']])('l’erreur de configuration %s (hors réponse SMTP) donne REJECTED', async (code) => {
    const transport = fake(async () => { throw Object.assign(new Error('configuration'), { code }); });
    expect(await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
  });

  it.each([['ECONNECTION'], ['ETIMEDOUT'], ['ESOCKET'], ['EDNS'], ['inconnu']])('l’erreur réseau %s donne UNAVAILABLE', async (code) => {
    const transport = fake(async () => { throw Object.assign(new Error('réseau'), { code }); });
    expect(await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('une réponse SMTP prime sur le code : 550 avec le code ECONNECTION reste REJECTED, et un code de configuration n’y change rien quand la réponse est passagère', async () => {
    expect(await new SmtpRelayEmailSender(RELAY, fake(async () => { throw Object.assign(new Error('x'), { responseCode: 550, code: 'ECONNECTION' }); })).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
    expect(await new SmtpRelayEmailSender(RELAY, fake(async () => { throw Object.assign(new Error('x'), { responseCode: 451, code: 'EAUTH' }); })).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('ne lève jamais d’exception, même pour une valeur levée qui n’est pas une erreur', async () => {
    for (const thrown of [undefined, null, 'texte', 42]) {
      const transport = fake(async () => { throw thrown; });
      expect(await new SmtpRelayEmailSender(RELAY, transport).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    }
  });

  it('ne journalise ni le lien d’invitation ni l’adresse complète du destinataire', async () => {
    const lines: string[] = [];
    const sender = new SmtpRelayEmailSender(RELAY, fake(async () => { throw Object.assign(new Error(`échec pour ${MESSAGE.to} : ${MESSAGE.text}`), { responseCode: 550 }); }));
    const logger = (sender as unknown as { logger: { warn: (m: string) => void } }).logger;
    logger.warn = (m) => { lines.push(m); };
    await sender.send(MESSAGE);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain('abc');
      expect(line).not.toContain('prenom.nom');
    }
  });
});

/** Un faux serveur SMTP minimal : enregistre ce qu'il reçoit ; `rcpt` fixe la réponse à RCPT TO ; `starttls` annonce (ou non) STARTTLS. */
function fakeSmtp(options: { rcpt?: string; offersStarttls?: boolean } = {}): Promise<{ server: Server; port: number; received: string[]; data: string[] }> {
  const received: string[] = [];
  const data: string[] = [];
  const server = createServer((socket: Socket) => {
    let inData = false;
    let buffer = '';
    let body = '';
    socket.write('220 faux.relais.test ESMTP\r\n');
    socket.on('error', () => undefined);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            data.push(body);
            body = '';
            socket.write('250 2.0.0 OK\r\n');
          } else body += `${line}\r\n`;
          continue;
        }
        received.push(line);
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === 'EHLO' || verb === 'HELO') socket.write(`250-faux.relais.test\r\n${options.offersStarttls ? '250-STARTTLS\r\n' : ''}250 8BITMIME\r\n`);
        else if (verb === 'MAIL') socket.write('250 2.1.0 OK\r\n');
        else if (verb === 'RCPT') socket.write(`${options.rcpt ?? '250 2.1.5 OK'}\r\n`);
        else if (verb === 'DATA') { inData = true; socket.write('354 Go\r\n'); }
        else if (verb === 'STAR') socket.write('454 4.7.0 TLS indisponible\r\n');
        else if (verb === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port, received, data })));
}

describe('SmtpRelayEmailSender — vrai nodemailer contre un faux serveur SMTP', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
  });
  const start = async (options?: { rcpt?: string; offersStarttls?: boolean }) => {
    const smtp = await fakeSmtp(options);
    servers.push(smtp.server);
    return smtp;
  };

  it('remet le message avec l’expéditeur, le destinataire, le sujet et le texte', async () => {
    const smtp = await start();
    const sender = new SmtpRelayEmailSender({ host: '127.0.0.1', port: smtp.port, sender: 'no-reply@exemple.test', security: 'none' });
    expect(await sender.send(MESSAGE)).toEqual({ ok: true });
    expect(smtp.received.some((l) => /^MAIL FROM:<no-reply@exemple\.test>/i.test(l))).toBe(true);
    expect(smtp.received.some((l) => /^RCPT TO:<prenom\.nom@exemple\.test>/i.test(l))).toBe(true);
    expect(smtp.data).toHaveLength(1);
    expect(smtp.data[0]).toMatch(/^Subject: Invitation/im);
    expect(smtp.data[0]).toMatch(/^From: no-reply@exemple\.test/im);
    expect(smtp.data[0]).toContain('https://app.exemple.test/invitation#token=abc');
  });

  it('un refus définitif du relais (550) donne REJECTED, un refus passager (452) donne UNAVAILABLE', async () => {
    const refused = await start({ rcpt: '550 5.1.1 Adresse inconnue' });
    expect(await new SmtpRelayEmailSender({ host: '127.0.0.1', port: refused.port, sender: 'no-reply@exemple.test', security: 'none' }).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
    const later = await start({ rcpt: '452 4.2.2 Boîte pleine' });
    expect(await new SmtpRelayEmailSender({ host: '127.0.0.1', port: later.port, sender: 'no-reply@exemple.test', security: 'none' }).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('un relais injoignable donne UNAVAILABLE', async () => {
    const smtp = await start();
    const port = smtp.port;
    await new Promise((resolve) => smtp.server.close(resolve));
    servers.length = 0;
    expect(await new SmtpRelayEmailSender({ host: '127.0.0.1', port, sender: 'no-reply@exemple.test', security: 'none' }).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('en mode « none » (essais locaux), n’ouvre pas de chiffrement même si le relais en propose un', async () => {
    const smtp = await start({ offersStarttls: true });
    expect(await new SmtpRelayEmailSender({ host: '127.0.0.1', port: smtp.port, sender: 'no-reply@exemple.test', security: 'none' }).send(MESSAGE)).toEqual({ ok: true });
    expect(smtp.received.some((l) => /^STARTTLS/i.test(l))).toBe(false);
    expect(smtp.data).toHaveLength(1);
  });

  it('EXIGE le chiffrement : un relais qui n’offre pas STARTTLS ne reçoit JAMAIS le message en clair', async () => {
    const smtp = await start();
    const result = await new SmtpRelayEmailSender({ host: '127.0.0.1', port: smtp.port, sender: 'no-reply@exemple.test', security: 'starttls' }).send(MESSAGE);
    expect(result.ok).toBe(false);
    expect(smtp.data).toHaveLength(0);
    expect(smtp.received.some((l) => /^(MAIL|RCPT|DATA)/i.test(l))).toBe(false);
  });
});
