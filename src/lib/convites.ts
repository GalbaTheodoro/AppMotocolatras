import { randomBytes } from "crypto";
import { query, queryOne } from "./db";

/**
 * Links de cadastro (um por perfil). Cada link tem um código secreto guardado em "configuracoes".
 * Quem abrir o link cria a própria conta já com aquele perfil e acesso liberado.
 * O administrador pode gerar um link novo a qualquer momento — o anterior para de funcionar.
 */
export const PAPEIS_CONVITE = ["integrante", "operador", "admin"] as const;
export type PapelConvite = (typeof PAPEIS_CONVITE)[number];
export const NOME_PAPEL: Record<PapelConvite, string> = {
  integrante: "Integrante", operador: "Operador", admin: "Administrador",
};

const chave = (p: PapelConvite) => `convite_${p}`;
export const novoCodigo = () => randomBytes(12).toString("base64url");

export async function lerConvites(): Promise<Record<PapelConvite, string>> {
  const rows = await query<{ chave: string; valor: string }>(
    "SELECT chave, valor FROM configuracoes WHERE chave = ANY($1::text[])", [PAPEIS_CONVITE.map(chave)]);
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  const faltando = PAPEIS_CONVITE.filter((p) => !m[chave(p)]);
  if (faltando.length) {
    for (const p of faltando) {
      await query("INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO NOTHING", [chave(p), novoCodigo()]);
    }
    return lerConvites();
  }
  return Object.fromEntries(PAPEIS_CONVITE.map((p) => [p, m[chave(p)]])) as Record<PapelConvite, string>;
}

/** Perfil correspondente ao código do link (ou null se o link não vale mais) */
export async function papelDoConvite(codigo: string | null | undefined): Promise<PapelConvite | null> {
  if (!codigo || codigo.length < 10) return null;
  const r = await queryOne<{ chave: string }>(
    "SELECT chave FROM configuracoes WHERE chave = ANY($1::text[]) AND valor = $2", [PAPEIS_CONVITE.map(chave), codigo]);
  return r ? (r.chave.replace("convite_", "") as PapelConvite) : null;
}

export async function trocarConvite(p: PapelConvite) {
  await query("INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor",
    [chave(p), novoCodigo()]);
}
