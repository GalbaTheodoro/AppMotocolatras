import Link from "next/link";
import { query } from "@/lib/db";
import { data, STATUS_SOLIC } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";

export default async function Solicitacoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filtro = sp.s ?? "pendente";
  const busca = sp.q?.trim() ?? "";
  const lista = await query(
    `SELECT s.*,
            (SELECT string_agg(q.nome || ' × ' || i.quantidade, ', ' ORDER BY q.nome)
               FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id WHERE i.solicitacao_id=s.id) itens,
            EXISTS (SELECT 1 FROM pessoas p WHERE regexp_replace(coalesce(p.cpf,''),'\\D','','g') = regexp_replace(s.cpf,'\\D','','g')) ja_cadastrada
       FROM solicitacoes s
      WHERE ($1 = 'todas' OR s.status = $1)
        AND ($2 = '' OR s.nome ILIKE '%'||$2||'%' OR s.cpf ILIKE '%'||$2||'%' OR s.protocolo ILIKE '%'||$2||'%')
      ORDER BY s.criado_em ${filtro === "pendente" ? "ASC" : "DESC"} LIMIT 300`,
    [filtro, busca]
  );
  const link = "/solicitar";
  return (
    <>
      <div className="head">
        <div>
          <h1>Solicitações</h1>
          <p className="sub">Pedidos feitos pelo formulário público · link para divulgar: <Link href={link} target="_blank">{link}</Link></p>
        </div>
      </div>
      <Mensagem sp={sp} />
      <form className="filtros">
        <input name="q" placeholder="Buscar nome, CPF ou protocolo" defaultValue={busca} />
        <select name="s" defaultValue={filtro}>
          <option value="pendente">Em análise</option>
          <option value="aprovada">Aprovadas</option>
          <option value="recusada">Recusadas</option>
          <option value="todas">Todas</option>
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        {lista.length === 0 ? <div className="vazio">Nenhuma solicitação {filtro === "pendente" ? "aguardando análise" : "encontrada"}.</div> : (
          <table>
            <thead><tr><th>Protocolo</th><th>Data</th><th>Nome</th><th>Telefone</th><th>Itens pedidos</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.protocolo}</b></td>
                  <td>{data(s.criado_em)}</td>
                  <td>{s.nome} {s.ja_cadastrada && <Tag tipo="ativo">Já cadastrada</Tag>}</td>
                  <td>{s.telefone}</td>
                  <td>{s.itens}</td>
                  <td><Tag tipo={s.status}>{STATUS_SOLIC[s.status]}</Tag></td>
                  <td className="r"><Link className="btn sec peq" href={`/solicitacoes/${s.id}`}>{s.status === "pendente" ? "Analisar" : "Ver"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
