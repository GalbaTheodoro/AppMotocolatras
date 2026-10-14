import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import { gerarMensalidades, situacaoSql } from "@/lib/cobranca";
import { data, moeda, hojeISO } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import TabelaMensalidades from "../../mensalidades/TabelaMensalidades";
import { devolver, salvarObs, excluirEmprestimo } from "../acoes";

export default async function Emprestimo({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await gerarMensalidades();
  const cfg = await lerConfig();
  const u = await usuarioAtual();
  const e = await queryOne(
    `SELECT e.*, p.nome pessoa, p.telefone, q.nome equipamento, q.codigo, us.nome criado_por_nome,
            (e.data_inicio + make_interval(months => $2::int))::date fim_gratis
       FROM emprestimos e JOIN pessoas p ON p.id=e.pessoa_id JOIN equipamentos q ON q.id=e.equipamento_id
       LEFT JOIN usuarios us ON us.id=e.criado_por
      WHERE e.id=$1`,
    [Number(id) || 0, cfg.meses_gratis]
  );
  if (!e) notFound();
  const mens = await query(
    `SELECT m.*, ${situacaoSql("m", cfg.dias_tolerancia)} situacao FROM mensalidades m
      WHERE m.emprestimo_id=$1 ORDER BY m.competencia_inicio`, [e.id]);
  const aberto = mens.filter((m) => m.status === "pendente").reduce((s, m) => s + Number(m.valor), 0);
  const pago = mens.filter((m) => m.status === "pago").reduce((s, m) => s + Number(m.valor), 0);
  const devolucoes = await query(
    `SELECT d.*, us.nome usuario FROM devolucoes d LEFT JOIN usuarios us ON us.id=d.criado_por
      WHERE d.emprestimo_id=$1 ORDER BY d.data, d.id`, [e.id]);
  const hoje = hojeISO();
  const volta = `/emprestimos/${e.id}`;

  return (
    <>
      <div className="head">
        <div>
          <h1>{e.equipamento}{e.codigo ? ` (${e.codigo})` : ""}</h1>
          <p className="sub">
            {e.data_devolucao ? e.quantidade_inicial : e.quantidade} unidade(s) emprestada(s) para <Link href={`/pessoas/${e.pessoa_id}`}>{e.pessoa}</Link>
          </p>
        </div>
        <div className="acoes">
        <Link className="btn" href={`/termo/emprestimo/${e.id}`}>🖨️ Imprimir termo</Link>
        {u?.papel === "admin" && (
          <form action={excluirEmprestimo}>
            <input type="hidden" name="id" value={e.id} />
            <BotaoConfirmar mensagem="Excluir este empréstimo e suas mensalidades? Use apenas para corrigir lançamentos errados.">Excluir</BotaoConfirmar>
          </form>
        )}
        </div>
      </div>
      <Mensagem sp={sp} />

      <div className="grid">
        <div className="stat"><div className="l">Início</div><div className="n" style={{ fontSize: "1.2rem" }}>{data(e.data_inicio)}</div></div>
        <div className="stat"><div className="l">Grátis até</div><div className="n" style={{ fontSize: "1.2rem" }}>{data(e.fim_gratis)}</div></div>
        <div className="stat"><div className="l">Em aberto</div><div className="n" style={{ fontSize: "1.2rem", color: aberto ? "var(--err)" : undefined }}>{moeda(aberto)}</div></div>
        <div className="stat"><div className="l">Total pago</div><div className="n" style={{ fontSize: "1.2rem", color: "var(--ok)" }}>{moeda(pago)}</div></div>
      </div>

      <div className="card">
        <dl className="info">
          <dt>Situação</dt>
          <dd>
            {e.data_devolucao ? <Tag tipo="devolvido">Devolvido em {data(e.data_devolucao)}</Tag>
              : e.fim_gratis > hoje ? <Tag tipo="gratis">No período grátis</Tag>
              : <Tag tipo="emprestado">Em cobrança mensal</Tag>}
          </dd>
          <dt>Quantidade</dt>
          <dd>
            {e.data_devolucao ? `${e.quantidade_inicial} unidade(s) — todas devolvidas`
              : e.quantidade === e.quantidade_inicial ? `${e.quantidade} unidade(s)`
              : `${e.quantidade} com a pessoa (de ${e.quantidade_inicial} emprestadas)`}
          </dd>
          <dt>Mensalidade atual</dt>
          <dd>{e.data_devolucao ? "—" : `${e.quantidade} × ${moeda(cfg.valor_mensalidade)} = ${moeda(e.quantidade * cfg.valor_mensalidade)}`}</dd>
          <dt>Telefone</dt><dd>{e.telefone ?? "—"}</dd>
          <dt>Registrado por</dt><dd>{e.criado_por_nome ?? "—"}</dd>
        </dl>
      </div>

      {!e.data_devolucao && (
        <div className="card">
          <h2>Registrar devolução</h2>
          <form action={devolver} className="acoes">
            <input type="hidden" name="id" value={e.id} />
            <label style={{ fontWeight: 400 }}>Quantidade devolvida
              <input type="number" name="quantidade" min={1} max={e.quantidade} step={1} defaultValue={e.quantidade} required style={{ width: 120 }} />
            </label>
            <label style={{ fontWeight: 400 }}>Data
              <input type="date" name="data_devolucao" defaultValue={hoje} min={e.data_inicio} max={hoje} required />
            </label>
            <BotaoConfirmar mensagem="Confirmar a devolução?" className="btn">Confirmar devolução</BotaoConfirmar>
          </form>
          <p className="sub" style={{ fontSize: ".85rem", marginTop: 10 }}>
            Pode devolver só parte das unidades: o empréstimo continua com o restante e a mensalidade passa a ser cobrada pela nova quantidade.
            Mensalidades pendentes de meses que começam a partir da data da devolução são recalculadas; as já vencidas continuam como estão.
          </p>
        </div>
      )}

      {devolucoes.length > 0 && (
        <>
          <h2>Devoluções</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Data</th><th className="r">Quantidade</th><th>Registrado por</th></tr></thead>
              <tbody>
                {devolucoes.map((d) => (
                  <tr key={d.id}><td>{data(d.data)}</td><td className="r">{d.quantidade}</td><td>{d.usuario ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Mensalidades</h2>
      {mens.length === 0 && !e.data_devolucao ? (
        <div className="tbl"><div className="vazio">
          Nenhuma mensalidade ainda. A primeira será gerada em {data(e.fim_gratis)} no valor de {moeda(cfg.valor_mensalidade * e.quantidade)} ({e.quantidade} × {moeda(cfg.valor_mensalidade)}).
        </div></div>
      ) : (
        <TabelaMensalidades linhas={mens as never} volta={volta} admin={u?.papel === "admin"} mostrarPessoa={false} />
      )}

      <div className="card">
        <h2>Observações</h2>
        <form action={salvarObs} className="f">
          <input type="hidden" name="id" value={e.id} />
          <label className="full"><textarea name="observacoes" defaultValue={e.observacoes ?? ""} /></label>
          <div className="full"><button className="btn sec" type="submit">Salvar observações</button></div>
        </form>
      </div>
    </>
  );
}
