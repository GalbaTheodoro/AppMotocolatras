import Link from "next/link";
import { query } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { data, moeda, hojeISO } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

export default async function Emprestimos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filtro = sp.f ?? "ativos";
  const busca = sp.q?.trim() ?? "";
  await gerarMensalidades();
  const cfg = await lerConfig();
  const lista = await query(
    `SELECT e.*, p.nome pessoa, q.nome equipamento, q.codigo,
            (e.data_inicio + make_interval(months => $3::int))::date fim_gratis,
            (SELECT coalesce(sum(m.valor),0) FROM mensalidades m WHERE m.emprestimo_id=e.id AND m.status='pendente') aberto,
            (SELECT count(*)::int FROM mensalidades m WHERE m.emprestimo_id=e.id AND ${situacaoSql("m", cfg.dias_tolerancia)}='atrasado') atrasadas
       FROM emprestimos e JOIN pessoas p ON p.id=e.pessoa_id JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE ($1='todos' OR ($1='ativos' AND e.data_devolucao IS NULL) OR ($1='devolvidos' AND e.data_devolucao IS NOT NULL))
        AND ($2='' OR p.nome ILIKE '%'||$2||'%' OR q.nome ILIKE '%'||$2||'%' OR q.codigo ILIKE '%'||$2||'%')
      ORDER BY e.data_devolucao NULLS FIRST, e.data_inicio DESC`,
    [filtro, busca, cfg.meses_gratis]
  );
  const hoje = hojeISO();
  return (
    <>
      <div className="head">
        <div><h1>Empréstimos</h1><p className="sub">{lista.length} encontrado(s) · {cfg.meses_gratis} primeiros meses grátis</p></div>
        <Link className="btn" href="/emprestimos/novo">+ Novo empréstimo</Link>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar pessoa ou equipamento" defaultValue={busca} />
        <select name="f" defaultValue={filtro}>
          <option value="ativos">Em aberto</option><option value="devolvidos">Devolvidos</option><option value="todos">Todos</option>
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        {lista.length === 0 ? <div className="vazio">Nenhum empréstimo encontrado.</div> : (
          <table>
            <thead><tr><th>Equipamento</th><th>Pessoa</th><th>Início</th><th>Cobrança</th><th className="r">Em aberto</th><th></th></tr></thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>{e.equipamento}{e.codigo ? ` (${e.codigo})` : ""}</td>
                  <td>{e.pessoa}</td>
                  <td>{data(e.data_inicio)}</td>
                  <td>
                    {e.data_devolucao ? <Tag tipo="devolvido">Devolvido {data(e.data_devolucao)}</Tag>
                      : e.fim_gratis > hoje ? <Tag tipo="gratis">Grátis até {data(e.fim_gratis)}</Tag>
                      : <Tag tipo="emprestado">Cobrando desde {data(e.fim_gratis)}</Tag>}
                  </td>
                  <td className="r">{moeda(e.aberto)} {e.atrasadas > 0 && <Tag tipo="atrasado">{e.atrasadas} atrasada(s)</Tag>}</td>
                  <td className="r"><Link href={`/emprestimos/${e.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
