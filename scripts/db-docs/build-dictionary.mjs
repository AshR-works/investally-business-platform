// Construit le dictionnaire de la base de données depuis la base RÉELLE (migrations appliquées) et les commentaires `///` du schéma Prisma :
//   docs/base-de-donnees/DICTIONNAIRE.md
//
//   DATABASE_URL=postgresql://… node scripts/db-docs/build-dictionary.mjs        (base JETABLE ou locale ; lecture seule, rien n'est modifié)
//
// Contenu : par schéma, un diagramme des relations (Mermaid), puis chaque table (colonnes, types, nullité, valeur par défaut, description), ses clés,
// ses règles garanties par la base (CHECK), ses index ; les types énumérés ; les références entre contextes (par identifiant, sans clé étrangère).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(root, 'apps/api/package.json'));
const pg = require('pg');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL est obligatoire (base jetable ou locale).');
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('SET default_transaction_read_only = on');

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const SCHEMAS = ['iam', 'bd', 'training', 'hr', 'docs', 'audit'];
const SCHEMA_LABEL = {
  iam: 'Identité et accès : comptes, rôles, sessions, MFA, invitations',
  bd: 'Business Development : entreprises, contacts, offres, relances, rendez-vous, opportunités, agréments, ambassadeurs, commissions',
  training: 'Investudy : catalogue, sessions, salles, formateurs, apprenants, inscriptions',
  hr: 'Ressources humaines : personnel, absences et congés',
  docs: 'Documents (métadonnées ; les fichiers sont stockés à part)',
  audit: 'Journal d’audit (partitionné par mois)',
};

// ───────────── Commentaires du schéma Prisma (`///`) ─────────────
const prisma = readFileSync(join(root, 'apps/api/prisma/schema.prisma'), 'utf8').replace(/\r\n/g, '\n').split('\n');
const docs = new Map(); // "schema.table.column" -> texte ; "schema.table" -> texte de la table
{
  let model = null;
  let pending = [];
  let blockSchema = null;
  let table = null;
  const fields = [];
  const flush = () => {
    if (!model) return;
    for (const f of fields) if (f.doc) docs.set(`${blockSchema}.${table}.${f.column}`, f.doc);
    if (model.doc) docs.set(`${blockSchema}.${table}`, model.doc);
  };
  for (const line of prisma) {
    const t = line.trim();
    if (t.startsWith('///')) { pending.push(t.replace(/^\/\/\/\s?/, '')); continue; }
    const start = /^model\s+(\w+)\s*\{/.exec(t);
    if (start) { model = { name: start[1], doc: pending.join(' ') }; pending = []; fields.length = 0; blockSchema = null; table = null; continue; }
    if (model && t === '}') { flush(); model = null; pending = []; continue; }
    if (model) {
      const schemaMatch = /@@schema\("(\w+)"\)/.exec(t);
      const mapMatch = /@@map\("(\w+)"\)/.exec(t);
      if (schemaMatch) blockSchema = schemaMatch[1];
      if (mapMatch) table = mapMatch[1];
      const field = /^(\w+)\s+[\w\[\]?]+(.*)$/.exec(t);
      if (field && !t.startsWith('@@') && !t.startsWith('//')) {
        const column = /@map\("(\w+)"\)/.exec(field[2])?.[1] ?? field[1].replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        fields.push({ column, doc: pending.join(' ') });
      }
      pending = [];
    } else pending = [];
  }
}

// ───────────── Lecture du catalogue PostgreSQL ─────────────
const tables = await q(`
  SELECT n.nspname AS schema, c.relname AS name, c.oid, obj_description(c.oid) AS comment
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p') AND n.nspname = ANY($1) AND NOT c.relispartition
  ORDER BY n.nspname, c.relname`, [SCHEMAS]);
const columns = await q(`
  SELECT n.nspname AS schema, c.relname AS "table", a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nullable,
         pg_get_expr(d.adbin, d.adrelid) AS "default", a.attnum
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r','p') AND n.nspname = ANY($1) AND NOT c.relispartition
  ORDER BY n.nspname, c.relname, a.attnum`, [SCHEMAS]);
const constraints = await q(`
  SELECT n.nspname AS schema, c.relname AS "table", k.conname AS name, k.contype AS kind, pg_get_constraintdef(k.oid) AS def, k.confrelid::regclass::text AS ref
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = ANY($1) AND NOT c.relispartition AND k.contype IN ('p','u','f','c')
  ORDER BY n.nspname, c.relname, k.contype, k.conname`, [SCHEMAS]);
const indexes = await q(`
  SELECT schemaname AS schema, tablename AS "table", indexname AS name, indexdef AS def FROM pg_indexes
  WHERE schemaname = ANY($1) AND tablename NOT LIKE '%\\_p20%' ORDER BY schemaname, tablename, indexname`, [SCHEMAS]);
const enums = await q(`
  SELECT n.nspname AS schema, t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = ANY($1) GROUP BY n.nspname, t.typname ORDER BY n.nspname, t.typname`, [SCHEMAS]);
const migrations = await q(`SELECT migration_name, finished_at FROM public._prisma_migrations ORDER BY migration_name`).catch(() => []);
const version = (await q('SHOW server_version'))[0].server_version;
await client.end();

const key = (s, t) => `${s}.${t}`;
const by = (rows, f) => rows.reduce((m, r) => { const k = f(r); (m.get(k) ?? m.set(k, []).get(k)).push(r); return m; }, new Map());
const colsOf = by(columns, (r) => key(r.schema, r.table));
const consOf = by(constraints, (r) => key(r.schema, r.table));
const idxOf = by(indexes, (r) => key(r.schema, r.table));
const clean = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

// ───────────── Rédaction ─────────────
const out = [
  '# Dictionnaire de la base de données', '',
  `*Généré depuis la base réelle (PostgreSQL ${version}, ${migrations.length} migrations appliquées) et les commentaires du schéma Prisma, par \`scripts/db-docs/build-dictionary.mjs\`. Ne pas modifier à la main : régénérer.*`, '',
  '## Vue d’ensemble', '',
  '- **Moteur** : PostgreSQL ; accès par Prisma (client généré) ; migrations versionnées dans `apps/api/prisma/migrations`.',
  '- **Un schéma PostgreSQL par contexte métier** (monolithe modulaire) : `iam`, `bd`, `training`, `hr`, `docs`, `audit`.',
  '- **Aucune clé étrangère entre deux schémas** : un contexte référence un autre **par identifiant** (colonne `*_id` sans contrainte) ; l’existence et l’appartenance sont contrôlées par les cas d’usage (test `core-schema`).',
  '- **Rien n’est supprimé physiquement** sur les données métier : archivage, annulation ou suppression logique (`deleted_at`) ; les clés étrangères sont en `RESTRICT`.',
  '- **Verrou optimiste** : chaque agrégat a une colonne `version` ; une écriture avec une version périmée est refusée.',
  '- **Règles garanties par la base** (CHECK, index uniques) en plus de celles de l’application : une règle violée est refusée même en contournant l’API.',
  '- **Identifiants** : UUID (v7) générés par l’application ; dates en `timestamptz` (UTC) ; jours civils en `date`.', '',
  '| Schéma | Rôle | Tables |', '|---|---|---|',
  ...SCHEMAS.map((s) => `| \`${s}\` | ${SCHEMA_LABEL[s]} | ${tables.filter((t) => t.schema === s).length} |`), '',
];

for (const schema of SCHEMAS) {
  const ts = tables.filter((t) => t.schema === schema);
  out.push(`## Schéma \`${schema}\``, '', SCHEMA_LABEL[schema], '');
  // Diagramme des relations internes au schéma.
  const edges = constraints.filter((c) => c.schema === schema && c.kind === 'f' && c.ref.startsWith(`${schema}.`));
  if (edges.length > 0) {
    out.push('```mermaid', 'erDiagram');
    for (const e of edges) {
      const child = e.table;
      const parent = e.ref.replace(/^"?[a-z_]+"?\./, '').replace(/"/g, '');
      out.push(`  ${parent} ||--o{ ${child} : "${e.def.match(/FOREIGN KEY \(([^)]+)\)/)?.[1] ?? ''}"`);
    }
    out.push('```', '');
  }
  for (const t of ts) {
    const id = key(schema, t.name);
    const description = docs.get(id) ?? t.comment ?? '';
    out.push(`### \`${schema}.${t.name}\``, '', ...(description ? [description, ''] : []));
    out.push('| Colonne | Type | Null | Défaut | Description |', '|---|---|---|---|---|');
    for (const c of colsOf.get(id) ?? []) {
      out.push(`| \`${c.name}\` | ${clean(c.type)} | ${c.nullable ? 'oui' : 'non'} | ${c.default ? `\`${clean(c.default)}\`` : ''} | ${clean(docs.get(`${id}.${c.name}`))} |`);
    }
    out.push('');
    const cons = consOf.get(id) ?? [];
    const named = (kind) => cons.filter((c) => c.kind === kind);
    if (named('p').length) out.push(`**Clé primaire** : ${named('p').map((c) => `\`${c.def.replace(/^PRIMARY KEY /, '')}\``).join(', ')}`, '');
    if (named('f').length) { out.push('**Clés étrangères**', '', ...named('f').map((c) => `- \`${c.name}\` : ${c.def}`), ''); }
    if (named('u').length) { out.push('**Unicité**', '', ...named('u').map((c) => `- \`${c.name}\` : ${c.def}`), ''); }
    if (named('c').length) { out.push('**Règles garanties par la base (CHECK)**', '', ...named('c').map((c) => `- \`${c.name}\` : \`${clean(c.def.replace(/^CHECK /, ''))}\``), ''); }
    const idx = (idxOf.get(id) ?? []).filter((i) => !cons.some((c) => c.name === i.name));
    if (idx.length) { out.push('**Index**', '', ...idx.map((i) => `- \`${i.name}\` : \`${clean(i.def.replace(/^CREATE (UNIQUE )?INDEX \S+ ON \S+ /, (m, u) => (u ? 'UNIQUE ' : '')))}\``), ''); }
  }
  const ens = enums.filter((e) => e.schema === schema);
  if (ens.length) {
    out.push(`### Types énumérés de \`${schema}\``, '', '| Type | Valeurs |', '|---|---|', ...ens.map((e) => `| \`${e.name}\` | ${(Array.isArray(e.labels) ? e.labels : String(e.labels).replace(/^\{|\}$/g, '').split(',')).map((l) => `\`${l}\``).join(', ')} |`), '');
  }
}

// Références entre contextes : colonnes `*_id` sans clé étrangère.
const withFk = new Set(constraints.filter((c) => c.kind === 'f').flatMap((c) => [...c.def.matchAll(/FOREIGN KEY \(([^)]+)\)/g)].flatMap((m) => m[1].split(',').map((x) => `${key(c.schema, c.table)}.${x.trim().replace(/"/g, '')}`))));
const refs = columns.filter((c) => /_id$/.test(c.name) && c.name !== 'id' && !withFk.has(`${key(c.schema, c.table)}.${c.name}`));
out.push('## Références par identifiant (sans clé étrangère)', '', '*Colonnes `*_id` qui désignent un objet d’un autre contexte (ou une personne désignée sans contrainte) : l’existence est contrôlée par l’application, jamais par la base.*', '', '| Table | Colonne | Null |', '|---|---|---|', ...refs.map((c) => `| \`${c.schema}.${c.table}\` | \`${c.name}\` | ${c.nullable ? 'oui' : 'non'} |`), '');
out.push('## Migrations appliquées', '', ...migrations.map((m) => `- \`${m.migration_name}\``), '');

const dir = join(root, 'docs/base-de-donnees');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'DICTIONNAIRE.md'), out.join('\n'), 'utf8');
console.log(`dictionnaire : ${tables.length} tables, ${columns.length} colonnes, ${constraints.length} contraintes, ${enums.length} types énumérés, ${migrations.length} migrations -> docs/base-de-donnees/DICTIONNAIRE.md`);
