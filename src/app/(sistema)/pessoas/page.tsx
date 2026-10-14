import Link from "next/link";
import { query } from "@/lib/db";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { lerConfig } from "@/lib/config";
import { moeda } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

export default async function Pessoas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const busca = sp.q?.trim() ?? "";
  const mostrarInativas = sp.inativas === "1";
  await gerarMensalidades();
  const cfg = await lerConfig();
  const lista = await query(
    `SELECT p.*,
            (SELECT coalesce(sum(e.quantidade),0)::int FROM emprestimos e WHERE e.pessoa_id=p.id AND e.data_devolucao IS NULL) ativos,
            (SELECT coalesce(sum(m.valor),0) FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
              WHERE e.pessoa_id=p.id AND m.status='pendente') aberto,
            (SELECT count(*)::int FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
              WHERE e.pessoa_id=p.id AND ${situacaoSql("m", cfg.dias_tolerancia)}='atrasado') atrasadas
       FROM pessoas p
      WHERE ($1 = '' OR p.nome ILIKE '%'||$1||'%' OR p.cpf ILIKE '%'||$1||'%' OR p.telefone ILIKE '%'||$1||'%')
        AND ($2 OR p.ativo)
      ORDER BY p.nome`,
    [busca, mostrarInativas]
  );
  return (
    <>
      <div className="head">
        <div><h1>Pessoas</h1><p className="sub">{lista.length} encontrada(s)</p></div>
        <Link className="btn" href="/pessoas/nova">+ Nova pessoa</Link>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar por nome, CPF ou telefone" defaultValue={busca} />
        <select name="inativas" defaultValue={mostrarInativas ? "1" : ""}>
          <option value="">Somente ativas</option><option value="1">Incluir inativas</option>
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        {lista.length === 0 ? <div className="vazio">Nenhuma pessoa cadastrada.</div> : (
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th className="r">Unidades com ela</th><th className="r">Em aberto</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/pessoas/${p.id}`}>{p.nome}</Link> {!p.ativo && <Tag tipo="inativo">Inativa</Tag>}</td>
                  <td>{p.telefone ?? "—"}</td>
                  <td className="r">{p.ativos}</td>
                  <td className="r">{moeda(p.aberto)} {p.atrasadas > 0 && <Tag tipo="atrasado">{p.atrasadas} atrasada(s)</Tag>}</td>
                  <td className="r">{p.ativo && <Link className="btn sec peq" href={`/emprestimos/novo?pessoa=${p.id}`}>Emprestar</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
