import Link from "next/link";
import { query, queryOne, HOJE_SQL } from "@/lib/db";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { lerConfig } from "@/lib/config";
import { moeda, data } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

export default async function Painel({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  await gerarMensalidades();
  const cfg = await lerConfig();

  const eq = await queryOne<{ total: number; disp: number; emp: number; man: number }>(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE status='disponivel')::int disp,
            count(*) FILTER (WHERE status='emprestado')::int emp,
            count(*) FILTER (WHERE status='manutencao')::int man
       FROM equipamentos`
  );
  const pessoas = await queryOne<{ n: number }>("SELECT count(*)::int n FROM pessoas WHERE ativo");
  const sit = situacaoSql("m", cfg.dias_tolerancia);
  const fin = await queryOne<{ pend_n: number; pend_v: number; atr_n: number; atr_v: number; mes_v: number }>(
    `SELECT count(*) FILTER (WHERE s='pendente')::int pend_n,
            coalesce(sum(valor) FILTER (WHERE s='pendente'),0) pend_v,
            count(*) FILTER (WHERE s='atrasado')::int atr_n,
            coalesce(sum(valor) FILTER (WHERE s='atrasado'),0) atr_v,
            coalesce(sum(valor) FILTER (WHERE status='pago' AND date_trunc('month', pago_em) = date_trunc('month', ${HOJE_SQL})),0) mes_v
       FROM (SELECT m.*, ${sit} s FROM mensalidades m) x`
  );
  const comecam = await query(
    `SELECT e.id, p.nome pessoa, q.nome equipamento,
            (e.data_inicio + make_interval(months => $1::int))::date fim_gratis
       FROM emprestimos e JOIN pessoas p ON p.id=e.pessoa_id JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE e.data_devolucao IS NULL
        AND (e.data_inicio + make_interval(months => $1::int))::date BETWEEN ${HOJE_SQL} AND ${HOJE_SQL} + 30
      ORDER BY 4`,
    [cfg.meses_gratis]
  );
  const atrasadas = await query(
    `SELECT m.id, m.vencimento, m.valor, p.nome pessoa, p.telefone, q.nome equipamento, e.id emp_id
       FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
       JOIN pessoas p ON p.id=e.pessoa_id JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE ${sit} = 'atrasado' ORDER BY m.vencimento LIMIT 10`
  );

  return (
    <>
      <div className="head">
        <div>
          <h1>Painel</h1>
          <p className="sub">Visão geral dos equipamentos e cobranças</p>
        </div>
        <Link className="btn" href="/emprestimos/novo">+ Novo empréstimo</Link>
      </div>
      <Mensagem sp={sp} />
      <div className="grid">
        <div className="stat"><div className="l">Equipamentos</div><div className="n">{eq?.total}</div></div>
        <div className="stat"><div className="l">Disponíveis</div><div className="n">{eq?.disp}</div></div>
        <div className="stat"><div className="l">Emprestados</div><div className="n">{eq?.emp}</div></div>
        <div className="stat"><div className="l">Pessoas ativas</div><div className="n">{pessoas?.n}</div></div>
      </div>
      <div className="grid">
        <div className="stat"><div className="l">A receber (em dia) · {fin?.pend_n}</div><div className="n">{moeda(fin?.pend_v)}</div></div>
        <div className="stat"><div className="l">Em atraso · {fin?.atr_n}</div><div className="n" style={{ color: "var(--err)" }}>{moeda(fin?.atr_v)}</div></div>
        <div className="stat"><div className="l">Recebido neste mês</div><div className="n" style={{ color: "var(--ok)" }}>{moeda(fin?.mes_v)}</div></div>
        <div className="stat"><div className="l">Mensalidade atual</div><div className="n">{moeda(cfg.valor_mensalidade)}</div></div>
      </div>

      <h2>Mensalidades em atraso</h2>
      <div className="tbl">
        {atrasadas.length === 0 ? <div className="vazio">Nenhuma mensalidade em atraso.</div> : (
          <table>
            <thead><tr><th>Pessoa</th><th>Telefone</th><th>Equipamento</th><th>Vencimento</th><th className="r">Valor</th></tr></thead>
            <tbody>
              {atrasadas.map((m) => (
                <tr key={m.id}>
                  <td>{m.pessoa}</td><td>{m.telefone ?? "—"}</td>
                  <td><Link href={`/emprestimos/${m.emp_id}`}>{m.equipamento}</Link></td>
                  <td><Tag tipo="atrasado">{data(m.vencimento)}</Tag></td>
                  <td className="r">{moeda(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2>Período grátis terminando nos próximos 30 dias</h2>
      <div className="tbl">
        {comecam.length === 0 ? <div className="vazio">Nenhum empréstimo entra em cobrança nos próximos 30 dias.</div> : (
          <table>
            <thead><tr><th>Pessoa</th><th>Equipamento</th><th>Começa a cobrar em</th></tr></thead>
            <tbody>
              {comecam.map((c) => (
                <tr key={c.id}>
                  <td>{c.pessoa}</td>
                  <td><Link href={`/emprestimos/${c.id}`}>{c.equipamento}</Link></td>
                  <td><Tag tipo="gratis">{data(c.fim_gratis)}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
