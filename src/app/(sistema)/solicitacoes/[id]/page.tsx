import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import { EMPRESTADAS_SQL, situacaoSql } from "@/lib/cobranca";
import { data, hojeISO, moeda, STATUS_SOLIC } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import Documentos from "@/components/Documentos";
import { aprovarSolicitacao, recusarSolicitacao } from "../acoes";

export default async function Solicitacao({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await queryOne(
    `SELECT s.*, u.nome analisado_por_nome FROM solicitacoes s LEFT JOIN usuarios u ON u.id=s.analisado_por WHERE s.id=$1`,
    [Number(id) || 0]);
  if (!s) notFound();
  const cfg = await lerConfig();
  const itens = await query(
    `SELECT i.*, q.nome, q.codigo, q.status eq_status, q.quantidade estoque, ${EMPRESTADAS_SQL} emprestadas
       FROM solicitacao_itens i JOIN equipamentos q ON q.id=i.equipamento_id
      WHERE i.solicitacao_id=$1 ORDER BY q.nome`, [s.id]);
  // Cadastro existente com o mesmo CPF
  const pessoa = await queryOne(
    `SELECT p.*,
            (SELECT coalesce(sum(e.quantidade),0)::int FROM emprestimos e WHERE e.pessoa_id=p.id AND e.data_devolucao IS NULL) unidades,
            (SELECT count(*)::int FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
              WHERE e.pessoa_id=p.id AND ${situacaoSql("m", cfg.dias_tolerancia)}='atrasado') atrasadas,
            (SELECT coalesce(sum(m.valor),0) FROM mensalidades m JOIN emprestimos e ON e.id=m.emprestimo_id
              WHERE e.pessoa_id=p.id AND m.status='pendente') aberto
       FROM pessoas p WHERE regexp_replace(coalesce(p.cpf,''),'\\D','','g') = regexp_replace($1,'\\D','','g')
      ORDER BY p.id LIMIT 1`, [s.cpf]);
  const pendente = s.status === "pendente";

  return (
    <>
      <div className="head">
        <div>
          <h1>Solicitação {s.protocolo}</h1>
          <p className="sub">Enviada em {data(s.criado_em)} · <Tag tipo={s.status}>{STATUS_SOLIC[s.status]}</Tag></p>
        </div>
        <Link className="btn sec" href="/solicitacoes">Voltar</Link>
      </div>
      <Mensagem sp={sp} />

      <div className="card">
        <h2>Dados informados</h2>
        <dl className="info">
          <dt>Nome</dt><dd>{s.nome}</dd>
          <dt>CPF</dt><dd>{s.cpf}</dd>
          <dt>Telefone</dt><dd>{s.telefone}</dd>
          <dt>E-mail</dt><dd>{s.email ?? "—"}</dd>
          <dt>Endereço</dt><dd>{s.endereco ?? "—"}</dd>
          <dt>Observações</dt><dd>{s.observacoes ?? "—"}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>Documentos enviados</h2>
        <Documentos solicitacaoId={s.id} />
        <p className="sub" style={{ fontSize: ".82rem", marginBottom: 0 }}>Clique na imagem para abrir em tamanho real. Confira se o rosto confere com o documento.</p>
      </div>

      <div className="card">
        <h2>Cadastro</h2>
        {pessoa ? (
          <>
            <p style={{ marginTop: 0 }}>
              <Tag tipo="ativo">CPF já cadastrado</Tag> como <Link href={`/pessoas/${pessoa.id}`}>{pessoa.nome}</Link>
              {!pessoa.ativo && <> · <Tag tipo="inativo">Inativa</Tag></>}
            </p>
            <dl className="info">
              <dt>Unidades com a pessoa</dt><dd>{pessoa.unidades}</dd>
              <dt>Em aberto</dt><dd>{moeda(pessoa.aberto)}</dd>
              <dt>Mensalidades atrasadas</dt>
              <dd>{pessoa.atrasadas > 0 ? <Tag tipo="atrasado">{pessoa.atrasadas} atrasada(s)</Tag> : "Nenhuma"}</dd>
            </dl>
            {pendente && <p className="sub" style={{ fontSize: ".85rem" }}>Ao aprovar, os empréstimos serão lançados neste cadastro.</p>}
          </>
        ) : (
          <p style={{ margin: 0 }}>
            <Tag tipo="pendente">Pessoa nova</Tag> {pendente && "— ao aprovar, o cadastro será criado automaticamente com os dados acima."}
            {!pendente && s.pessoa_id && <> · <Link href={`/pessoas/${s.pessoa_id}`}>ver cadastro</Link></>}
          </p>
        )}
      </div>

      <form className="card" action={aprovarSolicitacao}>
        <input type="hidden" name="id" value={s.id} />
        <h2>Itens e disponibilidade</h2>
        <div className="tbl" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr><th>Equipamento</th><th className="r">Pedido</th><th className="r">Disponível agora</th><th className="r">{pendente ? "Aprovar" : "Aprovado"}</th></tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const ativo = i.eq_status === "disponivel" || i.eq_status === "emprestado";
                const disp = ativo ? Math.max(0, i.estoque - i.emprestadas) : 0;
                return (
                  <tr key={i.id}>
                    <td>{i.nome}{i.codigo ? ` (${i.codigo})` : ""} {!ativo && <Tag tipo={i.eq_status}>{i.eq_status === "manutencao" ? "Em manutenção" : "Inativo"}</Tag>}</td>
                    <td className="r">{i.quantidade}</td>
                    <td className="r">
                      {disp >= i.quantidade ? <Tag tipo="disponivel">{disp}</Tag> : <Tag tipo="atrasado">{disp}</Tag>}
                    </td>
                    <td className="r">
                      {pendente ? (
                        <input type="number" name={`aprovar_${i.id}`} min={0} max={Math.min(i.quantidade, disp)} step={1}
                          defaultValue={Math.min(i.quantidade, disp)} style={{ width: 90 }} />
                      ) : (
                        <>{i.quantidade_aprovada ?? 0}{i.emprestimo_id && <> · <Link href={`/emprestimos/${i.emprestimo_id}`}>empréstimo</Link></>}</>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pendente ? (
          <>
            <div className="f">
              <label>Data de início dos empréstimos
                <input type="date" name="data_inicio" defaultValue={hojeISO()} max={hojeISO()} required />
              </label>
              <label className="full">Mensagem para a pessoa (aparece na consulta do protocolo)
                <textarea name="resposta" placeholder="Ex.: Aprovado! Retire os equipamentos na sede no sábado." />
              </label>
            </div>
            <div className="acoes" style={{ marginTop: 14 }}>
              <BotaoConfirmar mensagem="Aprovar a solicitação, cadastrar a pessoa e registrar os empréstimos?" className="btn ok">Aprovar e registrar empréstimos</BotaoConfirmar>
              <button className="btn perigo" type="submit" formAction={recusarSolicitacao} formNoValidate>Recusar</button>
            </div>
            <p className="sub" style={{ fontSize: ".85rem", marginTop: 10 }}>
              Pode aprovar menos unidades que o pedido (ou 0 em algum item). Para recusar, escreva o motivo no campo de mensagem.
            </p>
          </>
        ) : (
          <dl className="info">
            <dt>Analisado por</dt><dd>{s.analisado_por_nome ?? "—"} em {data(s.analisado_em)}</dd>
            <dt>Mensagem</dt><dd>{s.resposta ?? "—"}</dd>
          </dl>
        )}
      </form>
    </>
  );
}
