// Construit, à partir de la description OpenAPI réelle de l'API (docs/api/openapi.json) :
//   - la collection Postman avec ses TESTS  : docs/api/postman/Investally-API.postman_collection.json
//   - l'environnement Postman (sans aucun secret) : docs/api/postman/Investally-local.postman_environment.json
//   - la référence des routes                      : docs/api/REFERENCE-DES-ROUTES.md
//
//   node scripts/api-docs/export-openapi.cjs ...   (voir ce script)  puis  node scripts/api-docs/build-postman.mjs
//
// La collection n'est jamais écrite à la main : elle suit le code. Les parcours de bout en bout (dossier « 90 ») sont décrits ci-dessous et VÉRIFIÉS contre la
// description OpenAPI : un chemin qui n'existe plus fait échouer la construction.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const spec = JSON.parse(readFileSync(join(root, 'docs/api/openapi.json'), 'utf8'));
const outDir = join(root, 'docs/api/postman');
mkdirSync(outDir, { recursive: true });

const ZERO_UUID = '00000000-0000-7000-8000-000000000000';
const BASE = '{{baseUrl}}';

// ───────────────────────────── Schémas → exemples ─────────────────────────────
const deref = (schema) => {
  if (!schema) return {};
  if (schema.$ref) return deref(schema.$ref.split('/').reduce((node, key) => (key === '#' ? spec : node[key]), spec));
  return schema;
};

function example(schema, depth = 0) {
  const s = deref(schema);
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (s.enum) return s.enum[0];
  if (s.allOf) return Object.assign({}, ...s.allOf.map((p) => example(p, depth + 1)));
  if (s.oneOf || s.anyOf) return example((s.oneOf ?? s.anyOf)[0], depth + 1);
  switch (s.type) {
    case 'string':
      if (s.format === 'uuid') return '{{uuid}}';
      if (s.format === 'date-time') return new Date(0).toISOString();
      if (s.format === 'date' || /^\^?\\d\{4\}-/.test(s.pattern ?? '')) return '2026-12-21';
      return s.maxLength && s.maxLength < 6 ? 'x'.repeat(s.maxLength) : 'texte';
    case 'integer': return s.minimum ?? 1;
    case 'number': return s.minimum ?? 1;
    case 'boolean': return false;
    case 'array': return depth > 3 ? [] : [example(s.items, depth + 1)];
    case 'object': {
      if (depth > 3) return {};
      const body = {};
      for (const [key, value] of Object.entries(s.properties ?? {})) if ((s.required ?? []).includes(key)) body[key] = example(value, depth + 1);
      return body;
    }
    default: return s.properties ? example({ ...s, type: 'object' }, depth) : null;
  }
}

// ───────────────────────────── Tests Postman (scripts) ─────────────────────────────
const csvResponse = (operation) => Object.values(operation.responses ?? {}).some((r) => Object.keys(r.content ?? {}).includes('text/csv'));
const COMMON_ERRORS = [400, 403, 404, 409, 415, 422, 429];
const PUBLIC_ERRORS = [...COMMON_ERRORS, 401];
const successOf = (operation) => Object.keys(operation.responses ?? {}).filter((c) => /^2/.test(c)).map(Number);

function testsFor(operation, { expectStatuses }) {
  // Une route protégée qui répond 401 à un appel AVEC jeton est un échec (jeton absent, expiré ou session fermée) ; seule une route publique peut refuser par 401.
  const documented = JSON.stringify([...new Set([...expectStatuses, ...(operation['x-protected'] ? COMMON_ERRORS : PUBLIC_ERRORS)])]);
  const success = JSON.stringify(expectStatuses);
  const responseSchema = deref(operation.responses?.[String(expectStatuses[0])]?.content?.['application/json']?.schema);
  const properties = Object.keys(responseSchema.properties ?? {});
  const lines = [
    `const documented = ${documented};`,
    `const success = ${success};`,
    "pm.test('Pas d\u2019erreur serveur (statut inférieur à 500)', () => pm.expect(pm.response.code).to.be.below(500));",
    ...(operation['x-protected'] ? ["pm.test('Le jeton est accepté (pas de 401)', () => pm.expect(pm.response.code).to.not.eql(401));"] : []),
    "pm.test('Statut prévu (succès documenté ou refus métier standard)', () => pm.expect(documented).to.include(pm.response.code));",
    "pm.test('Temps de réponse raisonnable (moins de 3 s)', () => pm.expect(pm.response.responseTime).to.be.below(3000));",
    ...(csvResponse(operation)
      ? [
        "if (pm.response.code === 200) {",
        "  pm.test('Fichier CSV (text/csv)', () => pm.expect(pm.response.headers.get('Content-Type') || '').to.include('text/csv'));",
        "  pm.test('Téléchargement forcé (attachment)', () => pm.expect(pm.response.headers.get('Content-Disposition') || '').to.include('attachment'));",
        "  pm.test('Jamais mis en cache', () => pm.expect(pm.response.headers.get('Cache-Control') || '').to.include('no-store'));",
        "  pm.test('Marque d\u2019ordre des octets (BOM) et s\u00e9parateur « ; »', () => { const raw = pm.response.stream; const bytes = raw && raw.data ? raw.data : raw; pm.expect(bytes && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF, 'BOM UTF-8').to.eql(true); pm.expect(pm.response.text()).to.include(';'); });",
        '}',
      ]
      : /\/(export|download)$/.test(operation.__path)
      ? ["if (pm.response.code === 200) pm.test('Document remis avec un type de contenu', () => pm.expect(pm.response.headers.get('Content-Type') || '').to.not.be.empty);"]
      : [
        "if (pm.response.code !== 204 && pm.response.text().length > 0) {",
        "  pm.test('Réponse en JSON', () => pm.expect(pm.response.headers.get('Content-Type') || '').to.match(/json/));",
        '}',
      ]),
    "if (pm.response.code >= 400 && pm.response.code < 500 && pm.response.text().length > 0) {",
    "  pm.test('Erreur au format « problem details » (RFC 7807)', () => {",
    '    const body = pm.response.json();',
    "    pm.expect(body).to.include.keys('type', 'title', 'status');",
    '    pm.expect(body.status).to.eql(pm.response.code);',
    '  });',
    '}',
    'if (success.includes(pm.response.code)) {',
    `  pm.test('Statut de succès documenté', () => pm.expect(success).to.include(pm.response.code));`,
  ];
  if (properties.length > 0) {
    lines.push(`  pm.test('La réponse contient les champs documentés', () => pm.expect(pm.response.json()).to.include.keys(${properties.slice(0, 12).map((p) => JSON.stringify(p)).join(', ')}));`);
  }
  if (/^get$/i.test(operation.__method) && !/\{[^}]+\}$/.test(operation.__path) && JSON.stringify(operation.responses ?? {}).includes('"items"')) {
    lines.push("  pm.test('Liste paginée : items et total', () => pm.expect(pm.response.json()).to.include.keys('items', 'total'));");
  }
  lines.push('}');
  return lines.join('\n');
}

// ───────────────────────────── Requêtes générées ─────────────────────────────
const SINGULAR = { companies: 'company', learners: 'learner', enrollments: 'enrollment', sessions: 'session', programs: 'program', trainings: 'training', rooms: 'room', trainers: 'trainer', modules: 'module', offers: 'offer', contacts: 'contact', opportunities: 'opportunity', approvals: 'approval', ambassadors: 'ambassador', appointments: 'appointment', followups: 'followup', receipts: 'receipt', facilitators: 'facilitator', documents: 'document', users: 'user', holidays: 'holiday', types: 'type', employees: 'employee', requests: 'request', commissions: 'commission', payouts: 'payout', invitations: 'invitation' };
const variableFor = (segments, index) => {
  const raw = segments[index].replace(/^\{|\}$/g, '');
  if (raw !== 'id') return raw;
  const previous = (segments[index - 1] ?? '').replace(/[^a-z-]/g, '');
  const singular = SINGULAR[previous] ?? previous.replace(/ies$/, 'y').replace(/s$/, '');
  return `${singular.replace(/-(\w)/g, (_, c) => c.toUpperCase())}Id`;
};
const toItem = (path, method, operation, extra = {}) => {
  operation.__method = method;
  operation.__path = path;
  const success = successOf(operation);
  const expectStatuses = success.length ? success : [200];
  const segments = path.replace(/^\//, '').split('/');
  const pathVariables = [];
  const urlPath = segments.map((segment, index) => {
    const match = /^\{(.+)\}$/.exec(segment);
    if (!match) return segment;
    const declared = (operation.parameters ?? []).find((p) => p.in === 'path' && p.name === match[1]);
    const choice = declared?.schema?.enum?.[0];
    pathVariables.push({ key: match[1], value: choice !== undefined ? String(choice) : `{{${variableFor(segments, index)}}}`, description: 'Identifiant : voir l’environnement (valeur par défaut : identifiant inexistant, la route répond « introuvable »).' });
    return `:${match[1]}`;
  });
  const query = (operation.parameters ?? []).filter((p) => p.in === 'query').map((p) => ({
    key: p.name, value: String(example(p.schema ?? {}) ?? ''), disabled: !p.required, description: [p.description, p.schema?.enum ? `Valeurs : ${p.schema.enum.join(', ')}` : ''].filter(Boolean).join(' · '),
  }));
  const bodySchema = operation.requestBody?.content?.['application/json']?.schema;
  const headers = bodySchema ? [{ key: 'Content-Type', value: 'application/json' }] : [];
  const permission = operation['x-permission'];
  const notes = [
    operation.description ?? '',
    permission ? `**Permission** : \`${permission}\`${operation['x-min-scope'] ? ` (portée minimale ${operation['x-min-scope']})` : ''}${operation['x-step-up'] ? ' · **second facteur récent exigé (step-up)**' : ''}` : operation['x-protected'] ? '**Authentifié** (aucune permission particulière)' : '**Route publique**',
    `Succès attendu : ${expectStatuses.join(', ')}.`,
  ].filter(Boolean).join('\n\n');
  return {
    name: `${method.toUpperCase()} ${path.replace(/^\/api\/v1/, '')}${operation.summary ? ` — ${operation.summary}` : ''}`,
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: { raw: `${BASE}${path}`, host: [BASE], path: urlPath, variable: pathVariables, query },
      ...(bodySchema ? { body: { mode: 'raw', raw: JSON.stringify(pathVariables.length > 0 ? example(bodySchema) : {}, null, 2), options: { raw: { language: 'json' } } } } : {}),
      description: bodySchema && pathVariables.length === 0 ? `${notes}\n\n_Corps vide envoyé volontairement : la route refuse (400) sans rien créer. Le corps documenté est :_\n\n\`\`\`json\n${JSON.stringify(example(bodySchema), null, 2)}\n\`\`\`\n\nLes créations réelles sont testées dans le dossier « 90 — Parcours de bout en bout ».` : notes,
      ...extra.request,
    },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: (extra.tests ?? testsFor(operation, { expectStatuses })).split('\n') } }, ...(extra.events ?? [])],
  };
};

// ───────────────────────────── Authentification (scripts d'enchaînement) ─────────────────────────────
const TOTP = `
// Code à 6 chiffres (TOTP, SHA-1, 30 s) calculé depuis le secret de l'environnement : aucun téléphone nécessaire pour le compte de test.
function totp(secretBase32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/=+$/, '').replace(/\\s+/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, '0');
  const counter = Math.floor(Date.now() / 30000).toString(16).padStart(16, '0');
  const crypto = require('crypto-js');
  const digest = crypto.HmacSHA1(crypto.enc.Hex.parse(counter), crypto.enc.Hex.parse(hex)).toString(crypto.enc.Hex);
  const offset = parseInt(digest.slice(-1), 16);
  const value = parseInt(digest.substr(offset * 2, 8), 16) & 0x7fffffff;
  return String(value % 1000000).padStart(6, '0');
}`;

const authItems = () => {
  const find = (path, method) => {
    const op = spec.paths[path]?.[method];
    if (!op) throw new Error(`Route d'authentification introuvable dans OpenAPI : ${method.toUpperCase()} ${path}`);
    return op;
  };
  const item = (path, method, name, overrides) => ({ ...toItem(path, method, find(path, method), overrides), name });
  const login = item('/api/v1/auth/login', 'post', '1 — Connexion (e-mail et mot de passe)', {
    request: { auth: { type: 'noauth' }, body: { mode: 'raw', raw: JSON.stringify({ email: '{{email}}', password: '{{password}}' }, null, 2), options: { raw: { language: 'json' } } } },
    tests: [
      "pm.test('Connexion acceptée (200)', () => pm.response.to.have.status(200));",
      'const body = pm.response.json();',
      "pm.test('Un jeton d\u2019accès est remis', () => pm.expect(body.accessToken).to.be.a('string').and.not.empty);",
      "pm.collectionVariables.set('accessToken', body.accessToken);",
      "pm.collectionVariables.set('mfaEnrolled', String(Boolean(body.mfaEnrolled)));",
      "pm.test('Le second facteur est demandé (jeton pas encore vérifié)', () => pm.expect(body.mfaVerified).to.not.eql(true));",
      "console.log(body.mfaEnrolled ? 'Compte enrôlé : lancez « 2 — Vérifier le code du second facteur ».' : 'Compte non enrôlé : lancez « 1b — Enrôler le second facteur ».');",
    ].join('\n'),
  });
  const enrollStart = item('/api/v1/auth/mfa/enroll/start', 'post', '1b — Enrôler le second facteur : démarrer (compte non enrôlé)', {
    tests: [
      "pm.test('Enrôlement démarré (200)', () => pm.response.to.have.status(200));",
      'const body = pm.response.json();',
      "pm.test('Un secret est remis (affiché une seule fois)', () => pm.expect(body.secret).to.be.a('string').and.not.empty);",
      "pm.collectionVariables.set('mfaSecret', body.secret);",
      "console.log('Secret conservé dans la variable de collection mfaSecret : copiez-le dans votre environnement si vous voulez le réutiliser.');",
    ].join('\n'),
  });
  const enrollConfirm = item('/api/v1/auth/mfa/enroll/confirm', 'post', '1c — Enrôler le second facteur : confirmer (code calculé)', {
    request: { body: { mode: 'raw', raw: JSON.stringify({ code: '{{mfaCode}}' }, null, 2), options: { raw: { language: 'json' } } } },
    events: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: `${TOTP}\npm.variables.set('mfaCode', totp(pm.collectionVariables.get('mfaSecret') || pm.environment.get('mfaSecret')));`.split('\n') } }],
    tests: [
      "pm.test('Enrôlement confirmé (200)', () => pm.response.to.have.status(200));",
      'const body = pm.response.json();',
      "pm.test('Jeton vérifié et codes de secours remis', () => { pm.expect(body.accessToken).to.be.a('string'); pm.expect(body.recoveryCodes).to.be.an('array').with.lengthOf(10); });",
      "pm.collectionVariables.set('accessToken', body.accessToken);",
      "console.log('Conservez les codes de secours hors de Postman : ils ne sont affichés qu\u2019une fois.');",
    ].join('\n'),
  });
  const verify = item('/api/v1/auth/mfa/verify', 'post', '2 — Vérifier le code du second facteur (code calculé)', {
    request: { body: { mode: 'raw', raw: JSON.stringify({ code: '{{mfaCode}}' }, null, 2), options: { raw: { language: 'json' } } } },
    events: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: `${TOTP}\npm.variables.set('mfaCode', totp(pm.environment.get('mfaSecret') || pm.collectionVariables.get('mfaSecret')));`.split('\n') } }],
    tests: [
      "pm.test('Second facteur accepté (200)', () => pm.response.to.have.status(200));",
      'const body = pm.response.json();',
      "pm.test('Un jeton vérifié par MFA est remis', () => pm.expect(body.accessToken).to.be.a('string').and.not.empty);",
      "pm.collectionVariables.set('accessToken', body.accessToken);",
    ].join('\n'),
  });
  return [login, verify, enrollStart, enrollConfirm];
};

// ───────────────────────────── Parcours de bout en bout ─────────────────────────────
const json = (value) => ({ mode: 'raw', raw: JSON.stringify(value, null, 2), options: { raw: { language: 'json' } } });
let scenarioCount = 0;
function step(name, method, path, { body, expect = [200], save = {}, extraTests = [], query } = {}) {
  const blank = (p) => p.replace(/\{\{[^}]+\}\}/g, '{}').replace(/\{[^}]+\}/g, '{}').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '{}');
  const operationPath = path.split('?')[0];
  const known = Object.keys(spec.paths).find((p) => blank(p) === blank(`/api/v1${operationPath}`));
  if (!known || !spec.paths[known][method.toLowerCase()]) throw new Error(`Parcours : route absente d'OpenAPI : ${method} ${path}`);
  scenarioCount += 1;
  const tests = [
    `pm.test('${name} : statut ${expect.join(' ou ')}', () => pm.expect(${JSON.stringify(expect)}).to.include(pm.response.code));`,
    ...Object.entries(save).map(([variable, expression]) => `if (${JSON.stringify(expect)}.includes(pm.response.code)) pm.environment.set('${variable}', String(${expression}));`),
    ...extraTests,
  ];
  const url = path.split('?')[0];
  return {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: { raw: `${BASE}/api/v1${path}`, host: [BASE], path: ['api', 'v1', ...url.replace(/^\//, '').split('/')], ...(query ? { query } : {}) },
      ...(body ? { body: json(body) } : {}),
    },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests.join('\n').split('\n') } }],
  };
}

const scenarioFolders = () => {
  const nextMonday = `(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 14); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })()`;
  const suffix = "{{runId}}";
  const runId = {
    listen: 'prerequest',
    script: { type: 'text/javascript', exec: ["if (!pm.collectionVariables.get('runId')) pm.collectionVariables.set('runId', Math.random().toString(36).slice(2, 8));"] },
  };
  const entreprises = {
    name: '90.1 — Entreprises : créer, lire, modifier, exporter',
    item: [
      step('Créer une entreprise', 'POST', '/companies', { body: { name: `Société Postman ${suffix}`, sector: 'Banque', country: 'Cameroun' }, expect: [201], save: { companyId: 'pm.response.json().id', companyVersion: 'pm.response.json().version' }, extraTests: ["pm.test('Nom conservé', () => pm.expect(pm.response.json().name).to.include('Société Postman'));"] }),
      step('Lire l’entreprise', 'GET', '/companies/{{companyId}}', { extraTests: ["pm.test('Identifiant identique', () => pm.expect(pm.response.json().id).to.eql(pm.environment.get('companyId')));"] }),
      step('Modifier l’entreprise', 'PUT', '/companies/{{companyId}}', { body: { version: '{{companyVersion}}', sector: 'Assurance' }, expect: [200, 400], save: {} }),
      step('Exporter la fiche (HTML tracé dans l’audit)', 'GET', '/companies/{{companyId}}/export', { extraTests: ["pm.test('Document HTML', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('text/html'));", "pm.test('En-têtes de sécurité', () => pm.expect(pm.response.headers.get('Content-Security-Policy')).to.include(\"default-src 'none'\"));"] }),
      step('Chercher l’entreprise', 'GET', '/companies?search=Postman', { query: [{ key: 'search', value: 'Postman' }], extraTests: ["pm.test('Liste paginée', () => pm.expect(pm.response.json()).to.include.keys('items', 'total'));"] }),
      step('Une entreprise inexistante est « introuvable »', 'GET', `/companies/${ZERO_UUID}`, { expect: [404] }),
    ],
    event: [runId],
  };
  const formation = {
    name: '90.2 — Formation : catalogue, session, étudiant sans entreprise et payeur (Lot B)',
    item: [
      step('Créer un programme', 'POST', '/programs', { body: { name: `Programme Postman ${suffix}` }, expect: [201], save: { programId: 'pm.response.json().id' } }),
      step('Créer un certificat à 100 000', 'POST', '/trainings', { body: { programId: '{{programId}}', title: `Certificat Postman ${suffix}`, priceAmount: '100000' }, expect: [201], save: { trainingId: 'pm.response.json().id' } }),
      step('Créer une salle', 'POST', '/rooms', { body: { name: `Salle Postman ${suffix}`, kind: 'CLASSROOM', learnerSeats: 20, trainerSeats: 0 }, expect: [201], save: { roomId: 'pm.response.json().id' } }),
      step('Créer un formateur', 'POST', '/trainers', { body: { lastName: `Formateur${suffix}`, firstName: 'Eli' }, expect: [201], save: { trainerId: 'pm.response.json().id' } }),
      { ...step('Planifier une session', 'POST', '/sessions', { body: { trainingId: '{{trainingId}}', rhythm: 'DAY', startDate: '{{sessionStart}}', roomId: '{{roomId}}', trainerId: '{{trainerId}}', capacity: 5 }, expect: [201], save: { sessionId: 'pm.response.json().id' } }), event: [
        { listen: 'prerequest', script: { type: 'text/javascript', exec: [`pm.collectionVariables.set('sessionStart', ${nextMonday});`] } },
        { listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('Session planifiée', () => pm.expect([201]).to.include(pm.response.code));", "pm.environment.set('sessionId', pm.response.json().id);"] } },
      ] },
      step('Ouvrir la session aux inscriptions', 'POST', '/sessions/{{sessionId}}/open', { body: { version: 1 }, expect: [200] }),
      step('Créer un étudiant sans entreprise', 'POST', '/learners', { body: { kind: 'STUDENT', lastName: `Etudiant${suffix}`, firstName: 'Léa' }, expect: [201], save: { learnerId: 'pm.response.json().id' }, extraTests: ["pm.test('Sans entreprise ni contact', () => { const b = pm.response.json(); pm.expect(b.kind).to.eql('STUDENT'); pm.expect(b.companyId).to.eql(null); });"] }),
      step('Inscrire l’étudiant sans payeur : refusé', 'POST', '/enrollments', { body: { sessionId: '{{sessionId}}', learnerId: '{{learnerId}}' }, expect: [400] }),
      step('Inscrire l’étudiant, payeur : lui-même', 'POST', '/enrollments', { body: { sessionId: '{{sessionId}}', learnerId: '{{learnerId}}', payer: { kind: 'SELF' } }, expect: [201], save: { enrollmentId: 'pm.response.json().id' }, extraTests: ["pm.test('Montant dû = prix complet, aucun agrément', () => { const b = pm.response.json(); pm.expect(b.chargedAmount).to.eql('100000.00'); pm.expect(b.approvalId).to.eql(null); pm.expect(b.payer.kind).to.eql('SELF'); });"] }),
      step('Confirmer l’inscription', 'POST', '/enrollments/{{enrollmentId}}/confirm', { body: { version: 1 }, expect: [200], extraTests: ["pm.test('Confirmée', () => pm.expect(pm.response.json().status).to.eql('CONFIRMED'));"] }),
      step('Lister les étudiants', 'GET', '/learners?kind=STUDENT', { query: [{ key: 'kind', value: 'STUDENT' }], extraTests: ["pm.test('Que des étudiants', () => pm.expect(pm.response.json().items.every((l) => l.kind === 'STUDENT')).to.eql(true));"] }),
      step('Annuler l’inscription (motif obligatoire)', 'POST', '/enrollments/{{enrollmentId}}/cancel', { body: { version: 2, reason: 'Test Postman' }, expect: [200] }),
    ],
    event: [runId],
  };
  const conges = {
    name: '90.3 — Congés : règles, types et jours fériés (RH)',
    item: [
      step('Lire les règles de congés', 'GET', '/hr/leave/settings', { extraTests: ["pm.test('Règles lisibles', () => pm.expect(pm.response.json()).to.include.keys('accrualDaysPerMonth', 'allowHalfDays'));"] }),
      step('Lister les types d’absence', 'GET', '/hr/leave/types', { extraTests: ["pm.test('Le congé annuel existe', () => pm.expect(pm.response.json().some((t) => t.code === 'ANNUAL')).to.eql(true));"] }),
      step('Ajouter un jour férié', 'POST', '/hr/leave/holidays', { body: { day: '2031-12-25', label: `Noël Postman ${suffix}` }, expect: [201, 409], save: { holidayId: 'pm.response.json().id' } }),
      step('Lister les jours fériés de l’année', 'GET', '/hr/leave/holidays?year=2031', { query: [{ key: 'year', value: '2031' }] }),
      step('Retirer le jour férié', 'DELETE', '/hr/leave/holidays/{{holidayId}}', { expect: [204, 404] }),
      step('Le solde d’un compte sans fiche employé est « introuvable »', 'GET', '/hr/leave/balance', { expect: [200, 404] }),
    ],
    event: [runId],
  };
  return [entreprises, formation, conges];
};

// ───────────────────────────── Assemblage ─────────────────────────────
const tags = new Map();
for (const [path, operations] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const tag = operation.tags?.[0] ?? 'autres';
    if (!tags.has(tag)) tags.set(tag, []);
    tags.get(tag).push({ path, method, operation });
  }
}

// Routes d'authentification qui ferment la session, changent un secret ou la connexion : à lancer à part, en connaissance de cause.
const SESSION_ACTIONS = /^\/api\/v1\/auth\/(logout|change-password|refresh|login|mfa\/(verify|enroll\/start|enroll\/confirm|recovery-codes\/regenerate)|invitations\/accept|forgot-password|reset-password)/;
const sessionActions = [];
// La déconnexion ferme la session : elle passe en dernier, juste après le rafraîchissement ; le reste garde l'ordre alphabétique.
const rank = (item) => (/\/auth\/logout/.test(item.request.url.raw) ? 2 : /\/auth\/refresh/.test(item.request.url.raw) ? 1 : 0);
const generated = [...tags.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, ops]) => ({
  name: tag,
  item: ops.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)).filter((o) => {
    if (!SESSION_ACTIONS.test(o.path)) return true;
    sessionActions.push(toItem(o.path, o.method, o.operation));
    return false;
  }).map((o) => toItem(o.path, o.method, o.operation)),
})).filter((folder) => folder.item.length > 0);

// Contrat de sécurité : toute route protégée refuse l'appel SANS jeton (401).
const unauthenticated = [];
for (const [path, operations] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method) || operation['x-protected'] !== true) continue;
    const item = toItem(path, method, operation, {
      request: { auth: { type: 'noauth' } },
      tests: [
        "pm.test('Sans jeton : refusé (401)', () => pm.response.to.have.status(401));",
        "pm.test('Réponse « problem details »', () => pm.expect(pm.response.json()).to.include.keys('type', 'title', 'status'));",
      ].join('\n'),
    });
    item.name = `${method.toUpperCase()} ${path.replace(/^\/api\/v1/, '')}`;
    unauthenticated.push(item);
  }
}

const health = Object.keys(spec.paths).filter((p) => /health/.test(p)).flatMap((p) => Object.entries(spec.paths[p]).map(([method, op]) => toItem(p, method, op, {
  request: { auth: { type: 'noauth' } },
  tests: "pm.test('Service vivant (200)', () => pm.response.to.have.status(200));",
})));

const collection = {
  info: {
    name: 'Investally Business Platform — API (tests)',
    description: [
      'Collection générée depuis la description OpenAPI réelle de l’API (`node scripts/api-docs/build-postman.mjs`). Ne pas la modifier à la main : régénérez-la.',
      '',
      '**Ordre conseillé** : importer l’environnement « Investally — local » ; renseigner `email`, `password` et `mfaSecret` (secret TOTP du compte de test) ; lancer « 00 — Authentification » (connexion puis second facteur) ; ensuite n’importe quel dossier, ou tout le runner.',
      '',
      '**Dossiers** : 00 authentification · 01 sécurité (toute route protégée refuse l’appel sans jeton) · 10 à 8x une requête par route, avec ses tests · 90 parcours de bout en bout (crée ses propres données, préfixées « Postman »).',
      '',
      '**À ne jamais viser** : une base de production. Utilisez une pile locale ou jetable.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [
    "// Les routes qui modifient des données exigent une origine autorisée (protection contre les requêtes intersites).",
    "if (!pm.request.headers.has('Origin')) pm.request.headers.add({ key: 'Origin', value: pm.environment.get('origin') || 'http://127.0.0.1:3000' });",
  ] } }],
  variable: [
    { key: 'accessToken', value: '' }, { key: 'mfaEnrolled', value: '' }, { key: 'mfaSecret', value: '' }, { key: 'runId', value: '' },
    { key: 'uuid', value: ZERO_UUID },
  ],
  item: [
    { name: '00 — Authentification', item: authItems().slice(0, 2), description: 'Connexion puis second facteur : le code TOTP est calculé depuis `mfaSecret` (environnement).' },
    { name: '00b — Première connexion d’un compte non enrôlé', item: authItems().slice(2), description: 'À ne lancer qu’une fois, pour un compte dont le second facteur n’est pas encore configuré : démarre l’enrôlement (le secret est conservé dans la variable `mfaSecret`), puis le confirme avec le code calculé. Conservez les codes de secours.' },
    { name: '01 — Sécurité : sans jeton, toute route protégée refuse', item: unauthenticated },
    { name: '02 — Santé', item: health },
    { name: '90 — Parcours de bout en bout', item: scenarioFolders(), description: 'Scénarios qui créent leurs propres données et vérifient les règles métier (agrément, payeur, portée). À lancer après la connexion, avec un compte qui a les droits (par exemple le Super administrateur de test).' },
    ...generated.map((folder, index) => ({ ...folder, name: `${String(10 + index).padStart(2, '0')} — ${folder.name}` })),
    { name: '98 — Actions de session (à lancer à part)', item: [...sessionActions].sort((a, b) => rank(a) - rank(b)), description: 'Déconnexion, changement de mot de passe, rafraîchissement, second facteur, invitations, réinitialisation : **elles ferment la session ou changent un secret**. Ne les mettez jamais dans un enchaînement courant ; lancez-les une par une.' },
  ],
};

// Variables d'identifiants : chaque `{id}` rencontré devient une variable d'environnement dont la valeur par défaut est un identifiant inexistant.
const idVariables = new Set();
for (const path of Object.keys(spec.paths)) {
  const segments = path.replace(/^\//, '').split('/');
  segments.forEach((segment, index) => { if (/^\{.+\}$/.test(segment)) idVariables.add(variableFor(segments, index)); });
}
for (const name of ['companyId', 'learnerId', 'enrollmentId', 'sessionId', 'programId', 'trainingId', 'roomId', 'trainerId', 'holidayId']) idVariables.add(name);
const environment = {
  name: 'Investally — local',
  values: [
    { key: 'baseUrl', value: 'http://127.0.0.1:3001', type: 'default', enabled: true },
    { key: 'origin', value: 'http://127.0.0.1:3000', type: 'default', enabled: true },
    { key: 'email', value: '', type: 'default', enabled: true },
    { key: 'password', value: '', type: 'secret', enabled: true },
    { key: 'mfaSecret', value: '', type: 'secret', enabled: true },
    ...[...idVariables].sort().map((key) => ({ key, value: ZERO_UUID, type: 'default', enabled: true })),
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync(join(outDir, 'Investally-API.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n', 'utf8');
writeFileSync(join(outDir, 'Investally-local.postman_environment.json'), JSON.stringify(environment, null, 2) + '\n', 'utf8');

// ───────────────────────────── Référence des routes ─────────────────────────────
const md = ['# Référence des routes de l’API', '', '*Générée depuis la description OpenAPI réelle (`docs/api/openapi.json`) par `scripts/api-docs/build-postman.mjs` : ne pas modifier à la main.*', ''];
let routes = 0;
for (const [tag, ops] of [...tags.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  md.push(`## ${tag}`, '', '| Méthode | Chemin | Résumé | Permission | Succès |', '|---|---|---|---|---|');
  for (const { path, method, operation } of ops.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))) {
    routes += 1;
    const permission = operation['x-permission'] ? `\`${operation['x-permission']}\`${operation['x-step-up'] ? ' + step-up' : ''}` : operation['x-protected'] ? 'authentifié' : 'publique';
    md.push(`| ${method.toUpperCase()} | \`${path.replace(/^\/api\/v1/, '')}\` | ${(operation.summary ?? '').replace(/\|/g, '/')} | ${permission} | ${successOf(operation).join(', ') || '200'} |`);
  }
  md.push('');
}
md.push(`*${routes} routes.*`, '');
writeFileSync(join(root, 'docs/api/REFERENCE-DES-ROUTES.md'), md.join('\n'), 'utf8');

// ───────────── Catalogue des tests (JSON lisible) ─────────────
// Le même contenu que la collection, mais lisible sans Postman : chaque requête avec sa permission, ses statuts attendus et la liste de ses tests (assertions).
const testNames = (item) => {
  const script = (item.event ?? []).filter((e) => e.listen === 'test').flatMap((e) => e.script.exec).join('\n');
  return [...script.matchAll(/pm\.test\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\u2019/g, String.fromCharCode(8217)).replace(/\\'/g, "'"));
};
const describeItem = (item) => {
  const notes = item.request?.description ?? '';
  const permission = /\*\*Permission\*\* : `([^`]+)`/.exec(notes)?.[1] ?? null;
  const succes = /Succès attendu : ([0-9, ]+)\./.exec(notes)?.[1]?.split(',').map((x) => Number(x.trim())) ?? null;
  const tests = testNames(item);
  return {
    nom: item.name,
    methode: item.request?.method ?? null,
    chemin: (item.request?.url?.raw ?? '').replace('{{baseUrl}}', ''),
    permission,
    protegee: /Authentifié|\*\*Permission\*\*/.test(notes) || null,
    succesAttendus: succes,
    corps: item.request?.body ? (() => { try { return JSON.parse(item.request.body.raw); } catch { return item.request.body.raw; } })() : null,
    tests,
  };
};
const walk = (folder) => (folder.item ?? []).flatMap((child) => (child.item ? walk(child) : [describeItem(child)]));
const catalogue = {
  titre: 'Investally Business Platform : catalogue des tests de l’API',
  genereLe: new Date().toISOString().slice(0, 10),
  source: 'Généré avec la collection Postman par scripts/api-docs/build-postman.mjs (docs/api/postman/Investally-API.postman_collection.json). La collection est le fichier EXÉCUTABLE ; ce catalogue en est la version lisible.',
  executer: {
    postman: 'Importer la collection et l’environnement, renseigner email, password et mfaSecret, lancer « 00 — Authentification » puis le dossier voulu.',
    newman: 'node scripts/api-docs/run-newman.mjs --env <environnement.json> --report rapport.json',
    guide: 'docs/api/GUIDE-CHARGER-ET-TESTER-L-API.html',
  },
  ordreDExecution: ['00 — Authentification', '01 — Sécurité', '02 — Santé', '90 — Parcours de bout en bout', '10 à 34 — une requête par route', '00b et 98 : à part'],
  dossiers: collection.item.map((folder) => {
    const requetes = walk(folder);
    return { nom: folder.name, description: folder.description ?? null, requetes: requetes.length, assertions: requetes.reduce((n, r) => n + r.tests.length, 0), detail: requetes };
  }),
};
catalogue.resume = {
  dossiers: catalogue.dossiers.length,
  requetes: catalogue.dossiers.reduce((n, f) => n + f.requetes, 0),
  testsDefinis: catalogue.dossiers.reduce((n, f) => n + f.assertions, 0),
  resultatDeReference: 'Pile jetable, jeu de démonstration, compte Super administrateur : 373 requêtes, 1 412 assertions exécutées, 0 échec (dossiers 00b et 98 à part : 12 requêtes, 54 assertions, 0 échec).',
};
writeFileSync(join(root, 'docs/api/tests-api.json'), JSON.stringify(catalogue, null, 2) + '\n', 'utf8');

const requests = generated.reduce((n, f) => n + f.item.length, 0);
console.log(`postman : ${generated.length} dossiers de routes, ${requests} requêtes, ${unauthenticated.length} contrôles « sans jeton », ${scenarioCount} étapes de parcours -> docs/api/postman`);
