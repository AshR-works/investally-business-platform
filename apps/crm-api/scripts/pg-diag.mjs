// Diagnostic des tests d'intégration (activé par TEST_DB_DIAG=1 dans test-db.mjs) : toutes les 45 s, liste ce que font les connexions à la base de test
// (état, attente, verrou, début de la requête). Sert à voir qui bloque qui quand une passe complète se fige (D149). Ne modifie rien.
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const SQL = `SELECT a.pid, a.state, a.wait_event_type AS wt, a.wait_event AS we, now() - a.xact_start AS xact_age, now() - a.query_start AS query_age,
  cardinality(pg_blocking_pids(a.pid)) AS blocked_by, left(regexp_replace(a.query, '\\s+', ' ', 'g'), 110) AS query
  FROM pg_stat_activity a WHERE a.datname = current_database() AND a.pid <> pg_backend_pid() AND (a.state <> 'idle' OR a.xact_start IS NOT NULL) ORDER BY a.xact_start NULLS LAST`;
for (;;) {
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  try {
    const total = (await client.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`)).rows[0].n;
    const rows = (await client.query(SQL)).rows;
    console.log(`\n[diag ${new Date().toISOString()}] ${total} connexions, ${rows.length} actives ou en transaction`);
    for (const r of rows) console.log(`[diag] pid=${r.pid} ${r.state} wait=${r.wt}/${r.we} xact=${r.xact_age} query=${r.query_age} bloqué_par=${r.blocked_by} :: ${r.query}`);
  } catch (error) {
    console.log('[diag] erreur', String(error).slice(0, 200));
  }
}
