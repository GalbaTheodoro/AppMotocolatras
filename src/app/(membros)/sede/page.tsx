import Link from "next/link";
import { query } from "@/lib/db";
import { exigirLogado, ehEquipe } from "@/lib/auth";
import { data as fmtData, moeda, hojeISO } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { reservar, cancelarReserva, salvarReserva } from "./acoes";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const PAGAMENTO: Record<string, string> = { pendente: "Pendente", pago: "Pago", isento: "Isento" };

type Reserva = {
  id: number; data: string; usuario_id: number | null; responsavel: string; telefone: string | null;
  finalidade: string | null; valor: number | null; pagamento: string; pago_em: string | null;
  observacoes: string | null; criado_por_nome: string | null;
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default async function Sede({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await exigirLogado();
  const equipe = ehEquipe(u);
  const sp = await searchParams;
  const hoje = hojeISO();
  const [ay, am] = (/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : hoje.slice(0, 7)).split("-").map(Number);
  const ano = ay, mes = am; // mes 1..12
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const inicio = iso(ano, mes, 1), fim = iso(ano, mes, diasNoMes);
  const anterior = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
  const proximo = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const mParam = `${ano}-${String(mes).padStart(2, "0")}`;

  const reservas = await query<Reserva>(
    `SELECT r.*, c.nome criado_por_nome FROM reservas_sede r LEFT JOIN usuarios c ON c.id=r.criado_por
      WHERE r.status='confirmada' AND r.data BETWEEN $1 AND $2 ORDER BY r.data`, [inicio, fim]);
  const porDia = new Map(reservas.map((r) => [r.data, r]));

  const diaSel = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : null;
  let reservaSel: Reserva | null = null;
  if (diaSel) {
    reservaSel = porDia.get(diaSel) ?? (await query<Reserva>(
      `SELECT r.*, c.nome criado_por_nome FROM reservas_sede r LEFT JOIN usuarios c ON c.id=r.criado_por
        WHERE r.status='confirmada' AND r.data=$1`, [diaSel]))[0] ?? null;
  }
  const integrantes = equipe
    ? await query<{ id: number; nome: string }>("SELECT id, nome FROM usuarios WHERE ativo AND papel='integrante' ORDER BY nome")
    : [];
  const minhas = !equipe
    ? await query<Reserva>(
        `SELECT r.*, NULL criado_por_nome FROM reservas_sede r WHERE r.status='confirmada' AND r.usuario_id=$1 AND r.data >= $2 ORDER BY r.data`,
        [u.id, hoje])
    : [];

  const podeVerDetalhes = (r: Reserva) => equipe || r.usuario_id === u.id;
  const totais = reservas.reduce(
    (t, r) => ({ v: t.v + (Number(r.valor) || 0), p: t.p + (r.pagamento === "pago" ? Number(r.valor) || 0 : 0) }), { v: 0, p: 0 });

  // Células do calendário
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  return (
    <>
      <div className="head">
        <div>
          <h1>Agenda da sede</h1>
          <p className="sub">Reserva por dia inteiro · toque em um dia livre para reservar</p>
        </div>
      </div>
      <Mensagem sp={sp} />

      <div className="card cal-card">
        <div className="cal-topo">
          <Link className="btn sec peq" href={`/sede?m=${anterior}`}>‹ Anterior</Link>
          <h2 style={{ margin: 0 }}>{MESES[mes - 1]} de {ano}</h2>
          <Link className="btn sec peq" href={`/sede?m=${proximo}`}>Próximo ›</Link>
        </div>
        <div className="cal">
          {SEMANA.map((s) => <div key={s} className="cal-sem">{s}</div>)}
          {celulas.map((d, k) => {
            if (!d) return <div key={k} className="cal-dia vazio-dia" />;
            const dia = iso(ano, mes, d);
            const r = porDia.get(dia);
            const passado = dia < hoje;
            const classes = ["cal-dia",
              r ? (r.usuario_id === u.id && !equipe ? "minha" : "reservado") : "livre",
              passado ? "passado" : "", dia === hoje ? "hoje" : "", dia === diaSel ? "sel" : ""].join(" ");
            return (
              <Link key={k} href={`/sede?m=${mParam}&d=${dia}#dia`} className={classes} scroll={false}>
                <span className="num">{d}</span>
                {r ? <span className="quem">{r.responsavel.split(" ")[0]}</span> : !passado && <span className="quem livre-txt">livre</span>}
              </Link>
            );
          })}
        </div>
        <div className="cal-legenda">
          <span><i className="lg livre" /> Livre</span>
          <span><i className="lg reservado" /> Reservado</span>
          {!equipe && <span><i className="lg minha" /> Minha reserva</span>}
          <span><i className="lg hoje" /> Hoje</span>
        </div>
      </div>

      {diaSel && (
        <div className="card" id="dia">
          {(() => {
            const [y, m, d] = diaSel.split("-").map(Number);
            const ds = DIA_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
            return <h2>{fmtData(diaSel)} · {ds}</h2>;
          })()}

          {reservaSel ? (
            <>
              <p style={{ marginTop: 0 }}><Tag tipo="emprestado">Reservado</Tag> por <b>{reservaSel.responsavel}</b></p>
              <dl className="info">
                {reservaSel.finalidade && (<><dt>Finalidade</dt><dd>{reservaSel.finalidade}</dd></>)}
                {podeVerDetalhes(reservaSel) && (
                  <>
                    <dt>Telefone</dt><dd>{reservaSel.telefone ?? "—"}</dd>
                    <dt>Valor</dt><dd>{reservaSel.valor != null ? moeda(reservaSel.valor) : "A definir pela equipe"}</dd>
                    <dt>Pagamento</dt>
                    <dd><Tag tipo={reservaSel.pagamento === "pago" ? "pago" : reservaSel.pagamento === "isento" ? "inativo" : "pendente"}>{PAGAMENTO[reservaSel.pagamento]}</Tag>
                      {reservaSel.pago_em && ` em ${fmtData(reservaSel.pago_em)}`}</dd>
                    {reservaSel.observacoes && (<><dt>Observações</dt><dd>{reservaSel.observacoes}</dd></>)}
                  </>
                )}
                {equipe && (<><dt>Registrada por</dt><dd>{reservaSel.criado_por_nome ?? "—"}</dd></>)}
              </dl>

              {equipe && (
                <form action={salvarReserva} className="f" style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <input type="hidden" name="id" value={reservaSel.id} />
                  <label>Responsável<input name="responsavel" defaultValue={reservaSel.responsavel} /></label>
                  <label>Telefone<input name="telefone" defaultValue={reservaSel.telefone ?? ""} /></label>
                  <label>Finalidade<input name="finalidade" defaultValue={reservaSel.finalidade ?? ""} /></label>
                  <label>Valor (R$)<input name="valor" type="number" step="0.01" min="0" defaultValue={reservaSel.valor ?? ""} placeholder="0,00" /></label>
                  <label>Pagamento
                    <select name="pagamento" defaultValue={reservaSel.pagamento}>
                      <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="isento">Isento</option>
                    </select>
                  </label>
                  <label>Pago em<input name="pago_em" type="date" defaultValue={reservaSel.pago_em ?? hoje} /></label>
                  <label className="full">Observações<textarea name="observacoes" defaultValue={reservaSel.observacoes ?? ""} /></label>
                  <div className="full acoes"><button className="btn" type="submit">Salvar reserva</button></div>
                </form>
              )}

              {(equipe || (reservaSel.usuario_id === u.id && diaSel >= hoje)) && (
                <form action={cancelarReserva} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={reservaSel.id} />
                  <BotaoConfirmar mensagem={`Cancelar a reserva de ${fmtData(diaSel)}?`} className="btn perigo">Cancelar reserva</BotaoConfirmar>
                </form>
              )}
            </>
          ) : !equipe && diaSel < hoje ? (
            <p className="sub">Esta data já passou.</p>
          ) : (
            <form action={reservar} className="f">
              <input type="hidden" name="data" value={diaSel} />
              <p className="full" style={{ margin: 0 }}><Tag tipo="disponivel">Livre</Tag> Reservar a sede para o dia inteiro.</p>
              {equipe ? (
                <>
                  <label>Quem está reservando
                    <select name="usuario_id" defaultValue="outro">
                      <option value="outro">Outra pessoa (digitar nome)</option>
                      {integrantes.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  </label>
                  <label>Nome (se outra pessoa)<input name="responsavel" /></label>
                  <label>Telefone<input name="telefone" /></label>
                  <label>Valor (R$)<input name="valor" type="number" step="0.01" min="0" placeholder="0,00" /></label>
                </>
              ) : (
                <label>Telefone para contato<input name="telefone" placeholder="Se diferente do cadastrado" /></label>
              )}
              <label>Finalidade<input name="finalidade" placeholder="Ex.: aniversário, encontro, churrasco" /></label>
              <label className="full">Observações<textarea name="observacoes" placeholder="Horário previsto, número de pessoas…" /></label>
              <div className="full acoes"><button className="btn" type="submit">Reservar {fmtData(diaSel)}</button></div>
              {!equipe && <p className="full sub" style={{ fontSize: ".85rem", margin: 0 }}>O valor da reserva é combinado e registrado pela equipe.</p>}
            </form>
          )}
        </div>
      )}

      {!equipe && minhas.length > 0 && (
        <>
          <h2>Minhas próximas reservas</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Data</th><th>Finalidade</th><th>Valor</th><th>Pagamento</th><th></th></tr></thead>
              <tbody>
                {minhas.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtData(r.data)}</td><td>{r.finalidade ?? "—"}</td>
                    <td>{r.valor != null ? moeda(r.valor) : "A definir"}</td>
                    <td><Tag tipo={r.pagamento === "pago" ? "pago" : "pendente"}>{PAGAMENTO[r.pagamento]}</Tag></td>
                    <td className="r"><Link href={`/sede?m=${r.data.slice(0, 7)}&d=${r.data}#dia`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Reservas de {MESES[mes - 1].toLowerCase()}</h2>
      {equipe && reservas.length > 0 && (
        <p className="sub" style={{ marginTop: -6 }}>
          {reservas.length} reserva(s) · total {moeda(totais.v)} · recebido {moeda(totais.p)} · a receber {moeda(totais.v - totais.p)}
        </p>
      )}
      <div className="tbl">
        {reservas.length === 0 ? <div className="vazio">Nenhuma reserva neste mês.</div> : (
          <table>
            <thead>
              <tr><th>Data</th><th>Responsável</th><th>Finalidade</th>{equipe && <><th>Telefone</th><th className="r">Valor</th><th>Pagamento</th></>}<th></th></tr>
            </thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id}>
                  <td>{fmtData(r.data)}</td>
                  <td>{r.responsavel}</td>
                  <td>{r.finalidade ?? "—"}</td>
                  {equipe && (
                    <>
                      <td>{r.telefone ?? "—"}</td>
                      <td className="r">{r.valor != null ? moeda(r.valor) : "—"}</td>
                      <td><Tag tipo={r.pagamento === "pago" ? "pago" : r.pagamento === "isento" ? "inativo" : "pendente"}>{PAGAMENTO[r.pagamento]}</Tag></td>
                    </>
                  )}
                  <td className="r"><Link href={`/sede?m=${mParam}&d=${r.data}#dia`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
