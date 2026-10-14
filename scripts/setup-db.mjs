// Cria as tabelas no banco apontado por DATABASE_URL.
// Uso (PowerShell):  $env:DATABASE_URL="postgresql://..."; npm run db:setup
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina a variável DATABASE_URL antes de rodar.");
  process.exit(1);
}
const u = new URL(url);
const local = ["localhost", "127.0.0.1", ""].includes(u.hostname) || u.searchParams.has("host");
["sslmode", "pgbouncer"].forEach((p) => u.searchParams.delete(p));

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString: u.toString(),
  ssl: local ? undefined : { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
await client.end();
console.log("Banco pronto! Agora abra o sistema e crie o primeiro administrador em /setup.");
