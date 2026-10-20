import { Logger } from '@nestjs/common';
import { EmailMessage, invalidReason } from './application/email-sender';
import { LogEmailSender } from './infrastructure/log-email-sender';
import { MicrosoftGraphEmailSender } from './infrastructure/microsoft-graph-email-sender';

const CREDENTIALS = { tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 'SUPER-SECRET-CLIENT-VALUE', sender: 'crm@investally.test' };
const MESSAGE: EmailMessage = { to: 'marie@investally.test', subject: 'Votre invitation', text: 'Bonjour, voici votre lien : https://crm.test/invite/abc' };

interface Call { url: string; init: RequestInit }

/** Faux Microsoft : jeton d'application + sendMail, avec réponses programmables. */
function fakeMicrosoft() {
  const calls: Call[] = [];
  const state = {
    tokenStatus: 200,
    tokenBody: (n: number): unknown => ({ access_token: `TOKEN-${n}`, expires_in: 3600 }),
    sendStatuses: [] as number[],
    sendDefault: 202,
    networkDown: false,
    tokensIssued: 0,
  };
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (state.networkDown) throw new Error('ECONNREFUSED');
    if (url.includes('login.microsoftonline.com')) {
      if (state.tokenStatus !== 200) return new Response(JSON.stringify({ error: 'invalid_client', detail: CREDENTIALS.clientSecret }), { status: state.tokenStatus });
      state.tokensIssued += 1;
      return new Response(JSON.stringify(state.tokenBody(state.tokensIssued)), { status: 200 });
    }
    return new Response('', { status: state.sendStatuses.shift() ?? state.sendDefault });
  };
  const sends = () => calls.filter((c) => c.url.includes('graph.microsoft.com'));
  const tokens = () => calls.filter((c) => c.url.includes('login.microsoftonline.com'));
  return { fetchImpl, state, calls, sends, tokens };
}

/** Capte tout ce que les adaptateurs écrivent dans les journaux. */
function captureLogs() {
  const lines: string[] = [];
  const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')); }),
  );
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) };
}

describe('MicrosoftGraphEmailSender (D1–D6) — contre un faux serveur', () => {
  let logs: ReturnType<typeof captureLogs>;
  let clock: { now: number };
  beforeEach(() => { logs = captureLogs(); clock = { now: Date.parse('2026-10-20T10:00:00Z') }; });
  afterEach(() => logs.restore());

  const sender = (fake: ReturnType<typeof fakeMicrosoft>) => new MicrosoftGraphEmailSender(CREDENTIALS, fake.fetchImpl, () => clock.now);

  it('D1 — demande un jeton d\'application (client credentials) avec les bons paramètres', async () => {
    const fake = fakeMicrosoft();
    await sender(fake).send(MESSAGE);

    const [token] = fake.tokens();
    expect(token.url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    expect(token.init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(String(token.init.body)))).toEqual({
      client_id: 'client-1', client_secret: CREDENTIALS.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
    });
  });

  it('D1 — met le jeton en cache, puis le renouvelle avant son expiration (marge de 2 minutes)', async () => {
    const fake = fakeMicrosoft();
    const s = sender(fake);
    await s.send(MESSAGE);
    await s.send(MESSAGE);
    expect(fake.tokens()).toHaveLength(1);

    clock.now += (3600 - 121) * 1000; // 1 s avant la limite (expiration moins la marge de 120 s)
    await s.send(MESSAGE);
    expect(fake.tokens()).toHaveLength(1);

    clock.now += 2_000; // la marge est franchie
    await s.send(MESSAGE);
    expect(fake.tokens()).toHaveLength(2);
  });

  it('D2 — envoie un message conforme et attend 202', async () => {
    const fake = fakeMicrosoft();
    expect(await sender(fake).send(MESSAGE)).toEqual({ ok: true });

    const [send] = fake.sends();
    expect(send.url).toBe('https://graph.microsoft.com/v1.0/users/crm%40investally.test/sendMail');
    expect(send.init.method).toBe('POST');
    expect((send.init.headers as Record<string, string>).authorization).toBe('Bearer TOKEN-1');
    expect(JSON.parse(String(send.init.body))).toEqual({
      message: {
        subject: 'Votre invitation',
        body: { contentType: 'Text', content: MESSAGE.text },
        toRecipients: [{ emailAddress: { address: 'marie@investally.test' } }],
      },
      saveToSentItems: false,
    });
  });

  it('D2 — utilise le contenu HTML quand il est fourni', async () => {
    const fake = fakeMicrosoft();
    await sender(fake).send({ ...MESSAGE, html: '<p>Bonjour</p>' });
    expect(JSON.parse(String(fake.sends()[0].init.body)).message.body).toEqual({ contentType: 'HTML', content: '<p>Bonjour</p>' });
  });

  it('D2 — tout statut autre que 202 n\'est pas un succès', async () => {
    for (const status of [200, 204]) {
      const fake = fakeMicrosoft();
      fake.state.sendDefault = status;
      expect((await sender(fake).send(MESSAGE)).ok).toBe(false);
    }
  });

  it('D3 — un jeton refusé (401) est renouvelé UNE fois puis l\'envoi reprend', async () => {
    const fake = fakeMicrosoft();
    fake.state.sendStatuses = [401];
    expect(await sender(fake).send(MESSAGE)).toEqual({ ok: true });
    expect(fake.tokens()).toHaveLength(2);
    expect((fake.sends()[1].init.headers as Record<string, string>).authorization).toBe('Bearer TOKEN-2');
  });

  it('D3 — un 401 persistant s\'arrête après UN seul nouvel essai (pas de boucle)', async () => {
    const fake = fakeMicrosoft();
    fake.state.sendDefault = 401;
    expect(await sender(fake).send(MESSAGE)).toEqual({ ok: false, reason: 'REJECTED' });
    expect(fake.sends()).toHaveLength(2);
  });

  it.each([
    [429, 'UNAVAILABLE'], [500, 'UNAVAILABLE'], [503, 'UNAVAILABLE'], [400, 'REJECTED'], [403, 'REJECTED'], [404, 'REJECTED'],
  ])('classe la réponse %i en %s', async (status, reason) => {
    const fake = fakeMicrosoft();
    fake.state.sendDefault = status;
    expect(await sender(fake).send(MESSAGE)).toEqual({ ok: false, reason });
    expect(fake.sends()).toHaveLength(1); // pas de nouvel essai hors 401
  });

  it("refus d'authentification de l'application, réseau coupé, ou réponse de jeton inattendue : UNAVAILABLE, sans envoi", async () => {
    const refused = fakeMicrosoft();
    refused.state.tokenStatus = 401;
    expect(await sender(refused).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(refused.sends()).toHaveLength(0);

    const down = fakeMicrosoft();
    down.state.networkDown = true;
    expect(await sender(down).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });

    const odd = fakeMicrosoft();
    odd.state.tokenBody = () => ({ unexpected: true });
    expect(await sender(odd).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    odd.state.tokenBody = () => ({ access_token: 42, expires_in: 'x' });
    expect(await sender(odd).send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('D4 — le secret client et le jeton n\'apparaissent JAMAIS dans les journaux, quel que soit l\'échec', async () => {
    const scenarios: ((f: ReturnType<typeof fakeMicrosoft>) => void)[] = [
      (f) => { f.state.tokenStatus = 401; }, // la réponse du faux serveur cite le secret
      (f) => { f.state.sendDefault = 500; },
      (f) => { f.state.sendDefault = 403; },
      (f) => { f.state.networkDown = true; },
      (f) => { f.state.sendStatuses = [401, 401]; },
    ];
    for (const prepare of scenarios) {
      const fake = fakeMicrosoft();
      prepare(fake);
      await sender(fake).send(MESSAGE);
    }
    const everything = logs.lines.join('\n');
    expect(everything).not.toContain(CREDENTIALS.clientSecret);
    expect(everything).not.toMatch(/TOKEN-\d/);
    expect(everything).not.toContain(MESSAGE.text);
    expect(everything.length).toBeGreaterThan(0); // les échecs sont bien journalisés (sans détail sensible)
  });

  it('D5 — refuse l\'injection d\'en-têtes (CR/LF) dans l\'adresse et le sujet, sans aucun appel réseau', async () => {
    const fake = fakeMicrosoft();
    const s = sender(fake);
    for (const bad of [
      { ...MESSAGE, to: 'a@b.test\r\nBcc: evil@x.test' },
      { ...MESSAGE, to: 'a@b.test\nBcc: evil@x.test' },
      { ...MESSAGE, subject: 'Sujet\r\nBcc: evil@x.test' },
      { ...MESSAGE, subject: 'Sujet suite' },
      { ...MESSAGE, to: 'a@b.test,c@d.test' },
      { ...MESSAGE, to: 'Bob <a@b.test>' },
      { ...MESSAGE, to: 'a@b.test;c@d.test' },
      { ...MESSAGE, to: '' },
      { ...MESSAGE, to: 'sans-arobase' },
      { ...MESSAGE, subject: '' },
      { ...MESSAGE, subject: 'x'.repeat(201) },
      { ...MESSAGE, text: '' },
      { ...MESSAGE, text: 'x'.repeat(100_001) },
    ]) {
      expect(await s.send(bad)).toEqual({ ok: false, reason: 'INVALID' });
    }
    expect(fake.calls).toHaveLength(0);
  });

  it('D6 — chaque appel réseau (jeton et envoi) est borné par un délai', async () => {
    const fake = fakeMicrosoft();
    await sender(fake).send(MESSAGE);
    for (const call of fake.calls) expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('D6 — un délai dépassé (AbortError) devient UNAVAILABLE', async () => {
    const aborting = new MicrosoftGraphEmailSender(CREDENTIALS, async () => { throw new DOMException('timeout', 'TimeoutError'); });
    expect(await aborting.send(MESSAGE)).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  });

  it('encode l\'expéditeur dans l\'URL (pas d\'injection de chemin)', async () => {
    const fake = fakeMicrosoft();
    const s = new MicrosoftGraphEmailSender({ ...CREDENTIALS, sender: 'a/../../admin@evil.test' }, fake.fetchImpl, () => clock.now);
    await s.send(MESSAGE);
    expect(fake.sends()[0].url).toBe('https://graph.microsoft.com/v1.0/users/a%2F..%2F..%2Fadmin%40evil.test/sendMail');
  });
});

describe('LogEmailSender (D7)', () => {
  let logs: ReturnType<typeof captureLogs>;
  beforeEach(() => { logs = captureLogs(); });
  afterEach(() => logs.restore());

  it('n\'envoie rien, conserve le message pour les tests et ne journalise jamais son contenu', async () => {
    const sender = new LogEmailSender();
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    expect(await sender.send(MESSAGE)).toEqual({ ok: true });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(sender.sent).toEqual([MESSAGE]);
    const everything = logs.lines.join('\n');
    expect(everything).toContain('NON envoyé');
    expect(everything).not.toContain(MESSAGE.text);
    expect(everything).not.toContain('marie@'); // seul le domaine est journalisé
    expect(everything).not.toContain('invite/abc');
  });

  it('option de développement : affiche le contenu SEULEMENT si on le demande explicitement', async () => {
    const verbose = new LogEmailSender(true);
    await verbose.send(MESSAGE);
    expect(logs.lines.join('\n')).toContain('invite/abc');
    logs.lines.length = 0;
    await new LogEmailSender(false).send(MESSAGE);
    expect(logs.lines.join('\n')).not.toContain('invite/abc');
  });

  it('refuse les mêmes messages invalides que l\'adaptateur réel', async () => {
    const sender = new LogEmailSender();
    expect(await sender.send({ ...MESSAGE, to: 'a@b.test\r\nBcc: x@y.test' })).toEqual({ ok: false, reason: 'INVALID' });
    expect(sender.sent).toHaveLength(0);
  });

  it('ne conserve que les 50 derniers messages (mémoire bornée)', async () => {
    const sender = new LogEmailSender();
    for (let i = 0; i < 60; i++) await sender.send({ ...MESSAGE, subject: `Message ${i}` });
    expect(sender.sent).toHaveLength(50);
    expect(sender.sent[0].subject).toBe('Message 10');
    expect(sender.sent.at(-1)?.subject).toBe('Message 59');
  });
});

describe('invalidReason', () => {
  it('accepte un message correct, y compris avec un sous-domaine et un plus-adressage', () => {
    expect(invalidReason(MESSAGE)).toBeNull();
    expect(invalidReason({ ...MESSAGE, to: 'marie+crm@mail.investally.test' })).toBeNull();
  });
});
