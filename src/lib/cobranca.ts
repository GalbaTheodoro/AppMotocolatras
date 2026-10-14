import { query, HOJE_SQL } from "./db";
import { lerConfig } from "./config";

/**
 * Regra de cobrança:
 * - Cada empréstimo tem os primeiros N meses grátis (padrão 3), contados da data de início.
 * - Depois disso, é gerada 1 mensalidade por mês para aquele equipamento,
 *   com vencimento no início de cada competência, enquanto o equipamento não for devolvido.
 * - Gera apenas competências que já começaram (até hoje). É idempotente.
 * - O valor usado é o valor global vigente no momento em que a mensalidade é gerada.
 */
export async function gerarMensalidades() {
  const cfg = await lerConfig();
  await query(
    `INSERT INTO mensalidades (emprestimo_id, competencia_inicio, competencia_fim, vencimento, valor)
     SELECT e.id,
            (e.data_inicio + make_interval(months => k))::date,
            ((e.data_inicio + make_interval(months => k + 1))::date - 1),
            (e.data_inicio + make_interval(months => k))::date,
            $2
       FROM emprestimos e
       CROSS JOIN LATERAL generate_series(
            $1::int,
            (EXTRACT(YEAR FROM age(LEAST(COALESCE(e.data_devolucao, ${HOJE_SQL}), ${HOJE_SQL}), e.data_inicio)) * 12
             + EXTRACT(MONTH FROM age(LEAST(COALESCE(e.data_devolucao, ${HOJE_SQL}), ${HOJE_SQL}), e.data_inicio)))::int
       ) AS k
      WHERE (e.data_inicio + make_interval(months => k))::date <= ${HOJE_SQL}
        AND (e.data_devolucao IS NULL OR (e.data_inicio + make_interval(months => k))::date < e.data_devolucao)
     ON CONFLICT (emprestimo_id, competencia_inicio) DO NOTHING`,
    [cfg.meses_gratis, cfg.valor_mensalidade]
  );
}

/** Expressão SQL para situação da mensalidade (pendente vira 'atrasado' após a tolerância) */
export function situacaoSql(alias = "m", tolerancia = 5) {
  return `CASE WHEN ${alias}.status = 'pendente' AND ${alias}.vencimento + ${Number(tolerancia)} < ${HOJE_SQL}
               THEN 'atrasado' ELSE ${alias}.status END`;
}
