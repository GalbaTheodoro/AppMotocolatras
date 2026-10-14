import { query } from "./db";

export type Config = { valor_mensalidade: number; meses_gratis: number; dias_tolerancia: number };

export async function lerConfig(): Promise<Config> {
  const rows = await query<{ chave: string; valor: string }>("SELECT chave, valor FROM configuracoes");
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  return {
    valor_mensalidade: parseFloat(m.valor_mensalidade ?? "0") || 0,
    meses_gratis: parseInt(m.meses_gratis ?? "3", 10),
    dias_tolerancia: parseInt(m.dias_tolerancia ?? "5", 10),
  };
}
