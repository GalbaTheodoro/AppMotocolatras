import Link from "next/link";
import { query } from "@/lib/db";
import { EMPRESTADAS_SQL } from "@/lib/cobranca";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

const FILTROS: Record<string, string> = {
  com_disp: "Com unidades disponíveis",
  sem_disp: "Todas emprestadas",
  manutencao: "Em manutenção",
  inativo: "Inativos",
};

export default async function Equipamentos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const busca = sp.q?.trim() ?? "";
  const filtro = sp.f ?? "";
  const lista = await query(
    `SELECT * FROM (
       SELECT q.*, ${EMPRESTADAS_SQL} emprestadas,
              (SELECT count(DISTINCT x.pessoa_id)::int FROM emprestimos x WHERE x.equipamento_id=q.id AND x.data_devolucao IS NULL) pessoas
         FROM equipamentos q
        WHERE ($1 = '' OR q.nome ILIKE '%'||$1||'%' OR q.codigo ILIKE '%'||$1||'%' OR q.categoria ILIKE '%'||$1||'%')
     ) t
     WHERE ($2 = ''
        OR ($2 = 'com_disp' AND status IN ('disponivel','emprestado') AND quantidade > emprestadas)
        OR ($2 = 'sem_disp' AND quantidade <= emprestadas)
        OR status = $2)
     ORDER BY nome`,
    [busca, filtro]
  );
  const totais = lista.reduce((a, q) => ({ u: a.u + q.quantidade, e: a.e + q.emprestadas }), { u: 0, e: 0 });
  return (
    <>
      <div className="head">
        <div>
          <h1>Equipamentos</h1>
          <p className="sub">{lista.length} item(ns) · {totais.u} unidade(s) · {totais.e} emprestada(s) · {totais.u - totais.e} disponível(is)</p>
        </div>
        <Link className="btn" href="/equipamentos/novo">+ Novo equipamento</Link>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar por nome, código ou categoria" defaultValue={busca} />
        <select name="f" defaultValue={filtro}>
          <option value="">Todos</option>
          {Object.entries(FILTROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        {lista.length === 0 ? <div className="vazio">Nenhum equipamento encontrado.</div> : (
          <table>
            <thead>
              <tr><th>Nome</th><th>Código</th><th>Categoria</th><th className="r">Total</th><th className="r">Emprestadas</th><th className="r">Disponíveis</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((q) => {
                const disp = q.quantidade - q.emprestadas;
                const ativo = q.status === "disponivel" || q.status === "emprestado";
                return (
                  <tr key={q.id}>
                    <td><Link href={`/equipamentos/${q.id}`}>{q.nome}</Link></td>
                    <td>{q.codigo ?? "—"}</td>
                    <td>{q.categoria ?? "—"}</td>
                    <td className="r">{q.quantidade}</td>
                    <td className="r">{q.emprestadas}{q.pessoas > 0 && <span className="sub"> ({q.pessoas} pessoa{q.pessoas > 1 ? "s" : ""})</span>}</td>
                    <td className="r"><b>{disp}</b></td>
                    <td>
                      {!ativo ? <Tag tipo={q.status}>{q.status === "manutencao" ? "Em manutenção" : "Inativo"}</Tag>
                        : disp > 0 ? <Tag tipo="disponivel">Disponível</Tag>
                        : <Tag tipo="emprestado">Todas emprestadas</Tag>}
                    </td>
                    <td className="r">
                      {ativo && disp > 0 && (
                        <Link className="btn sec peq" href={`/emprestimos/novo?equipamento=${q.id}`}>Emprestar</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
