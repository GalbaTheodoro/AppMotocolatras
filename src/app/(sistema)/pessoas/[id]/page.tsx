import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { data, moeda, SITUACAO_MENS, STATUS_SOLIC } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import Documentos from "@/components/Documentos";
import FormPessoa from "../Formulario";
import { salvarPessoa, excluirPessoa } from "../acoes";

export default async function EditarPessoa({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await queryOne("SELECT * FROM pessoas WHERE id=$1", [Number(id) || 0]);
  if (!p) notFound();
  await gerarMensalidades();
  const cfg = await lerConfig();
  const u = await usuarioAtual();
  const emprestimos = await query(
    `SELECT e.*, q.nome equipamento, q.codigo,
            (e.data_inicio + make_interval(months => $2::int))::date fim_gratis
       FROM emprestimos e JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE e.pessoa_id=$1 ORDER BY e.data_devolucao NULLS FIRST, e.data_inicio DESC`,
    [p.id, cfg.meses_gratis]
  );
  const mensalidades = await query(
    `SELECT m.*, ${situacaoSql("m", cfg.dias_tolerancia)} situacao, q.nome equipamento
       FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE e.pessoa_id=$1 AND m.status <> 'cancelado' ORDER BY m.vencimento DESC LIMIT 24`,
    [p.id]
  );
  const solicitacoes = await query(
    `SELECT s.id, s.protocolo, s.status, s.criado_em,
            (SELECT string_agg(q.nome || ' × ' || i.quantidade, ', ' ORDER BY q.nome)
               FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id WHERE i.solicitacao_id=s.id) itens
       FROM solicitacoes s
      WHERE s.pessoa_id=$1 OR ($2 <> '' AND regexp_replace(coalesce(s.cpf,''),'\\D','','g') = $2)
      ORDER BY s.criado_em DESC`,
    [p.id, String(p.cpf ?? "").replace(/\D/g, "")]
  );
  return (
    <>
      <div className="head">
        <div><h1>{p.nome}</h1><p className="sub">Cadastro da pessoa</p></div>
        <div className="acoes">
          {p.ativo && <Link className="btn" href={`/emprestimos/novo?pessoa=${p.id}`}>+ Emprestar</Link>}
          {u?.papel === "admin" && (
            <form action={excluirPessoa}>
              <input type="hidden" name="id" value={p.id} />
              <BotaoConfirmar mensagem="Excluir esta pessoa?" className="btn perigo">Excluir</BotaoConfirmar>
            </form>
          )}
        </div>
      </div>
      <Mensagem sp={sp} />
      <FormPessoa p={p} action={salvarPessoa} />

      <h2>Documentos</h2>
      <div className="card"><Documentos pessoaId={p.id} /></div>

      {solicitacoes.length > 0 && (
        <>
          <h2>Solicitações</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Protocolo</th><th>Data</th><th>Itens</th><th>Situação</th></tr></thead>
              <tbody>
                {solicitacoes.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/solicitacoes/${s.id}`}><b>{s.protocolo}</b></Link></td>
                    <td>{data(s.criado_em)}</td>
                    <td>{s.itens ?? "—"}</td>
                    <td><Tag tipo={s.status === "aprovada" ? "pago" : s.status === "recusada" ? "inativo" : "pendente"}>{STATUS_SOLIC[s.status] ?? s.status}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Empréstimos</h2>
      <div className="tbl">
        {emprestimos.length === 0 ? <div className="vazio">Nenhum empréstimo.</div> : (
          <table>
            <thead><tr><th>Equipamento</th><th className="r">Qtd.</th><th>Início</th><th>Grátis até</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {emprestimos.map((e) => (
                <tr key={e.id}>
                  <td>{e.equipamento}{e.codigo ? ` (${e.codigo})` : ""}</td>
                  <td className="r">{e.data_devolucao ? e.quantidade_inicial : e.quantidade}</td>
                  <td>{data(e.data_inicio)}</td><td>{data(e.fim_gratis)}</td>
                  <td>{e.data_devolucao ? <Tag tipo="devolvido">Devolvido em {data(e.data_devolucao)}</Tag> : <Tag tipo="emprestado">Com a pessoa</Tag>}</td>
                  <td className="r"><Link href={`/emprestimos/${e.id}`}>Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2>Mensalidades recentes</h2>
      <div className="tbl">
        {mensalidades.length === 0 ? <div className="vazio">Nenhuma mensalidade gerada ainda.</div> : (
          <table>
            <thead><tr><th>Equipamento</th><th>Competência</th><th>Vencimento</th><th>Situação</th><th className="r">Valor</th></tr></thead>
            <tbody>
              {mensalidades.map((m) => (
                <tr key={m.id}>
                  <td>{m.equipamento}{m.quantidade > 1 ? ` × ${m.quantidade}` : ""}</td>
                  <td>{data(m.competencia_inicio)} a {data(m.competencia_fim)}</td>
                  <td>{data(m.vencimento)}</td>
                  <td><Tag tipo={m.situacao}>{SITUACAO_MENS[m.situacao]}</Tag></td>
                  <td className="r">{moeda(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
