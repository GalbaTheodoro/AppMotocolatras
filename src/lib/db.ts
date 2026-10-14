import pg, { type QueryResultRow } from "pg";
const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

// Retorna colunas DATE como texto "YYYY-MM-DD" (evita problemas de fuso horário)
pg.types.setTypeParser(1082, (v: string) => v);
// NUMERIC como número
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));

const globalForPool = globalThis as unknown as { pgPool?: Pool };

/**
 * Monta a configuração de conexão a partir da DATABASE_URL.
 * Bancos na nuvem (Supabase etc.) usam SSL; o certificado do Supabase é de CA própria,
 * por isso não validamos a cadeia (a conexão continua criptografada).
 */
export function configConexao(url: string): pg.PoolConfig {
  let connectionString = url.trim().replace(/^["']|["']$/g, "");
  let local = false;
  try {
    const u = new URL(connectionString);
    local = ["localhost", "127.0.0.1", ""].includes(u.hostname) || u.searchParams.has("host");
  } catch {
    // senha com caracteres especiais pode impedir a leitura como URL; segue com o texto original
  }
  // remove parâmetros de SSL do texto (o SSL é configurado abaixo)
  connectionString = connectionString
    .replace(/([?&])(sslmode|sslcert|sslkey|sslrootcert|pgbouncer|uselibpqcompat)=[^&]*/g, "$1")
    .replace(/[?&]+$/, "")
    .replace(/\?&+/, "?")
    .replace(/&&+/g, "&");
  return {
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  };
}

function getPool() {
  if (!globalForPool.pgPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
    globalForPool.pgPool = new Pool({
      ...configConexao(process.env.DATABASE_URL),
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

/** Executa várias consultas numa única transação (tudo ou nada) */
export async function transacao<R>(fn: (q: <T extends QueryResultRow = any>(text: string, params?: unknown[]) => Promise<T[]>) => Promise<R>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Data de hoje no fuso de São Paulo, em SQL */
export const HOJE_SQL = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";
