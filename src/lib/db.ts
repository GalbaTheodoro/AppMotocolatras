import pg, { type QueryResultRow } from "pg";
const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

// Retorna colunas DATE como texto "YYYY-MM-DD" (evita problemas de fuso horário)
pg.types.setTypeParser(1082, (v: string) => v);
// NUMERIC como número
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));

const globalForPool = globalThis as unknown as { pgPool?: Pool };

function getPool() {
  if (!globalForPool.pgPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
    globalForPool.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForPool.pgPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Data de hoje no fuso de São Paulo, em SQL */
export const HOJE_SQL = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";
