import Link from "next/link";
import { query } from "@/lib/db";
import { STATUS_EQUIP } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

export default async function Equipamentos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const busca = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const lista = await query(
    `SELECT q.*, p.nome pessoa, e.id emp_id
       FROM equipamentos q
       LEFT JOIN emprestimos e ON e.equipamento_id=q.id AND e.data_devolucao IS NULL
       LEFT JOIN pessoas p ON p.id=e.pessoa_id
      WHERE ($1 = '' OR q.nome ILIKE '%'||$1||'%' OR q.codigo ILIKE '%'||$1||'%' OR q.categoria ILIKE '%'||$1||'%')
        AND ($2 = '' OR q.status = $2)
      ORDER BY q.nome`,
    [busca, status]
  );
  return (
    <>
      <div className="head">
        <div><h1>Equipamentos</h1><p className="sub">{lista.length} encontrado(s)</p></div>
        <Link className="btn" href="/equipamentos/novo">+ Novo equipamento</Link>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar por nome, código ou categoria" defaultValue={busca} />
        <select name="status" defaultValue={status}>
          <option value="">Todas as situações</option>
          {Object.entries(STATUS_EQUIP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        {lista.length === 0 ? <div className="vazio">Nenhum equipamento cadastrado.</div> : (
          <table>
            <thead><tr><th>Nome</th><th>Código</th><th>Categoria</th><th>Situação</th><th>Com</th><th></th></tr></thead>
            <tbody>
              {lista.map((q) => (
                <tr key={q.id}>
                  <td><Link href={`/equipamentos/${q.id}`}>{q.nome}</Link></td>
                  <td>{q.codigo ?? "—"}</td>
                  <td>{q.categoria ?? "—"}</td>
                  <td><Tag tipo={q.status}>{STATUS_EQUIP[q.status]}</Tag></td>
                  <td>{q.emp_id ? <Link href={`/emprestimos/${q.emp_id}`}>{q.pessoa}</Link> : "—"}</td>
                  <td className="r">
                    {q.status === "disponivel" && (
                      <Link className="btn sec peq" href={`/emprestimos/novo?equipamento=${q.id}`}>Emprestar</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
