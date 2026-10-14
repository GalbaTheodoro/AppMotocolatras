import { query } from "./db";

export type Config = {
  valor_mensalidade: number;
  meses_gratis: number;
  dias_tolerancia: number;
  // Dados do clube usados no termo de empréstimo
  clube_nome: string;
  clube_documento: string;
  clube_endereco: string;
  clube_cidade: string;
  clube_responsavel: string;
  termo_prazo_devolucao: number; // dias para devolver quando solicitado
  termo_clausulas_extras: string;
};

export async function lerConfig(): Promise<Config> {
  const rows = await query<{ chave: string; valor: string }>("SELECT chave, valor FROM configuracoes");
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  return {
    valor_mensalidade: parseFloat(m.valor_mensalidade ?? "0") || 0,
    meses_gratis: parseInt(m.meses_gratis ?? "3", 10),
    dias_tolerancia: parseInt(m.dias_tolerancia ?? "5", 10),
    clube_nome: m.clube_nome ?? "Motocólatras MC",
    clube_documento: m.clube_documento ?? "",
    clube_endereco: m.clube_endereco ?? "",
    clube_cidade: m.clube_cidade ?? "Araguari - MG",
    clube_responsavel: m.clube_responsavel ?? "",
    termo_prazo_devolucao: parseInt(m.termo_prazo_devolucao ?? "5", 10),
    termo_clausulas_extras: m.termo_clausulas_extras ?? "",
  };
}
