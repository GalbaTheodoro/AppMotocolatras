// Cria as tabelas no banco apontado por DATABASE_URL.
// Uso: DATABASE_URL="postgres://..." npm run db:setup
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina a variável DATABASE_URL antes de rodar.");
  process.exit(1);
}
const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);
await client.end();
console.log("Banco pronto! Agora abra o sistema e crie o primeiro administrador em /setup.");
