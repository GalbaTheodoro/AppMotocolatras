import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirLogado } from "@/lib/auth";
import { data as fmtData } from "@/lib/formato";
import { lerReuniao, podeGerir, usuariosAtivos } from "@/lib/reunioes";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { NovaTarefa, ListaTarefas } from "@/components/Tarefas";
import {
  adicionarPauta, removerPauta, marcarDiscutido, moverPauta, salvarAta, adicionarDecisao, removerDecisao,
} from "../acoes";

const DIA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export default async function Reuniao({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await exigirLogado();
  const { id } = await params;
  const sp = await searchParams;
  const r = await lerReuniao(Number(id) || 0);
  if (!r) notFound();
  const { ev, pauta, ata, decisoes, tarefas } = r;
  const gestor = podeGerir(u, ev);
  const usuarios = await usuariosAtivos();
  const presentes = new Set(ata?.presentes ?? []);
  const [y, m, d] = ev.data.split("-").map(Number);
  const diaSemana = DIA_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const abertas = tarefas.filter((t) => t.status === "pendente" || t.status === "andamento").length;

  return (
    <>
      <div className="head">
        <div>
          <h1>📋 {ev.titulo}</h1>
          <p className="sub">
            Reunião · {fmtData(ev.data)} ({diaSemana}){ev.hora ? ` às ${ev.hora}` : ""} · {ev.na_sede ? "na sede" : ev.local ?? "local a definir"}
            {ata?.aprovada && <> · <Tag tipo="aprovada">Ata finalizada</Tag></>}
          </p>
        </div>
        <div className="acoes">
          <Link className="btn sec" href={`/sede?m=${ev.data.slice(0, 7)}&d=${ev.data}#dia`}>Agenda</Link>
          <Link className="btn" href={`/ata/${ev.id}`} target="_blank">🖨️ Imprimir ata</Link>
        </div>
      </div>
      <Mensagem sp={sp} />

      <nav className="abas-reuniao">
        <a href="#pauta">Pauta ({pauta.length})</a>
        <a href="#ata">Ata</a>
        <a href="#decisoes">Decisões ({decisoes.length})</a>
        <a href="#tarefas">Tarefas ({abertas} abertas)</a>
      </nav>

      {/* ===== PAUTA ===== */}
      <section className="card" id="pauta">
        <h2>1. Pauta da reunião</h2>
        {pauta.length === 0 ? <p className="sub">Nenhum assunto na pauta ainda.</p> : (
          <ol className="pauta">
            {pauta.map((p, i) => (
              <li key={p.id} className={p.discutido ? "discutido" : ""}>
                <div className="pauta-item">
                  <div>
                    <b>{p.titulo}</b> {p.discutido && <Tag tipo="pago">Discutido</Tag>}
                    {p.descricao && <div style={{ fontSize: ".9rem", whiteSpace: "pre-wrap" }}>{p.descricao}</div>}
                    <div className="sub" style={{ fontSize: ".78rem" }}>sugerido por {p.autor ?? "—"}</div>
                  </div>
                  <div className="acoes" style={{ gap: 4 }}>
                    {gestor && (
                      <>
                        <form action={moverPauta}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="cima" />
                          <button className="btn sec peq" type="submit" disabled={i === 0} title="Subir">↑</button></form>
                        <form action={moverPauta}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="baixo" />
                          <button className="btn sec peq" type="submit" disabled={i === pauta.length - 1} title="Descer">↓</button></form>
                        <form action={marcarDiscutido}><input type="hidden" name="id" value={p.id} />
                          <button className="btn sec peq" type="submit">{p.discutido ? "Desmarcar" : "✔ Discutido"}</button></form>
                      </>
                    )}
                    {(gestor || p.criado_por === u.id) && (
                      <form action={removerPauta}><input type="hidden" name="id" value={p.id} />
                        <BotaoConfirmar mensagem={`Remover "${p.titulo}" da pauta?`}>✕</BotaoConfirmar></form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <details className="bloco-dia" open={pauta.length === 0}>
          <summary className="btn sec peq" style={{ display: "inline-block" }}>+ Sugerir assunto para a pauta</summary>
          <form action={adicionarPauta} className="f" style={{ marginTop: 10 }}>
            <input type="hidden" name="evento_id" value={ev.id} />
            <label className="full">Assunto *<input name="titulo" required placeholder="Ex.: Prestação de contas do mês" /></label>
            <label className="full">Detalhes<textarea name="descricao" style={{ minHeight: 60 }} /></label>
            <div className="full acoes"><button className="btn" type="submit">Incluir na pauta</button></div>
          </form>
        </details>
      </section>

      {/* ===== ATA ===== */}
      <section className="card" id="ata">
        <h2>2. Ata da reunião</h2>
        {gestor ? (
          <form action={salvarAta} className="f">
            <input type="hidden" name="evento_id" value={ev.id} />
            <label>Início<input name="hora_inicio" type="time" defaultValue={ata?.hora_inicio ?? ev.hora ?? ""} /></label>
            <label>Término<input name="hora_fim" type="time" defaultValue={ata?.hora_fim ?? ""} /></label>
            <label>Secretário(a) / quem redigiu<input name="secretario" defaultValue={ata?.secretario ?? u.nome} /></label>
            <div className="full">
              <b style={{ fontSize: ".9rem" }}>Presentes ({presentes.size})</b>
              <div className="presentes">
                {usuarios.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" name="presente" value={p.id} defaultChecked={presentes.has(p.id)} /> {p.nome}
                  </label>
                ))}
              </div>
            </div>
            <label className="full">Outros presentes / convidados<input name="convidados" defaultValue={ata?.convidados ?? ""} placeholder="Nomes separados por vírgula" /></label>
            <label className="full">Relato da reunião (o que foi discutido)
              <textarea name="texto" defaultValue={ata?.texto ?? ""} style={{ minHeight: 220 }}
                placeholder={pauta.length ? pauta.map((p, i) => `${i + 1}. ${p.titulo}: `).join("\n") : "Escreva aqui o que foi tratado em cada assunto…"} />
            </label>
            <label>Situação da ata
              <select name="aprovada" defaultValue={ata?.aprovada ? "sim" : "nao"}>
                <option value="nao">Rascunho (em elaboração)</option>
                <option value="sim">Finalizada / aprovada</option>
              </select>
            </label>
            <div className="full acoes">
              <button className="btn" type="submit">Salvar ata</button>
              {ata?.atualizado_em && <span className="sub" style={{ fontSize: ".8rem" }}>Última alteração: {ata.atualizado_por_nome ?? "—"}, {fmtData(ata.atualizado_em)}</span>}
            </div>
          </form>
        ) : !ata ? (
          <p className="sub">A ata ainda não foi escrita.</p>
        ) : (
          <dl className="info">
            <dt>Horário</dt><dd>{ata.hora_inicio ?? "—"} às {ata.hora_fim ?? "—"}</dd>
            <dt>Presentes</dt><dd>{usuarios.filter((p) => presentes.has(p.id)).map((p) => p.nome).join(", ") || "—"}{ata.convidados ? `, ${ata.convidados}` : ""}</dd>
            <dt>Relato</dt><dd style={{ whiteSpace: "pre-wrap" }}>{ata.texto ?? "—"}</dd>
            <dt>Secretário(a)</dt><dd>{ata.secretario ?? "—"}</dd>
            <dt>Situação</dt><dd>{ata.aprovada ? "Finalizada" : "Rascunho"}</dd>
          </dl>
        )}
      </section>

      {/* ===== DECISÕES ===== */}
      <section className="card" id="decisoes">
        <h2>3. O que foi decidido</h2>
        {decisoes.length === 0 ? <p className="sub">Nenhuma decisão registrada.</p> : (
          <ol className="decisoes">
            {decisoes.map((x) => (
              <li key={x.id}>
                <span style={{ whiteSpace: "pre-wrap" }}>{x.texto}</span>
                {gestor && (
                  <form action={removerDecisao} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="id" value={x.id} />
                    <BotaoConfirmar mensagem="Remover esta decisão?">✕</BotaoConfirmar>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}
        {gestor && (
          <form action={adicionarDecisao} className="f" style={{ marginTop: 10 }}>
            <input type="hidden" name="evento_id" value={ev.id} />
            <label className="full">Nova decisão<textarea name="texto" required style={{ minHeight: 60 }} placeholder="Ex.: Aprovada a compra de 10 capacetes novos, até R$ 3.000" /></label>
            <div className="full acoes"><button className="btn" type="submit">Registrar decisão</button></div>
          </form>
        )}
      </section>

      {/* ===== TAREFAS ===== */}
      <section className="card" id="tarefas">
        <h2>4. Tarefas passadas (quem faz o quê)</h2>
        <ListaTarefas tarefas={tarefas} u={u} usuarios={usuarios} volta="reuniao" />
        {gestor && (
          <details className="bloco-dia" open={tarefas.length === 0}>
            <summary className="btn sec peq" style={{ display: "inline-block" }}>+ Passar tarefa</summary>
            <div style={{ marginTop: 10 }}><NovaTarefa usuarios={usuarios} eventoId={ev.id} /></div>
          </details>
        )}
        <p className="sub" style={{ fontSize: ".82rem", marginTop: 10 }}>
          Todas as tarefas do clube ficam também em <Link href="/tarefas">Tarefas</Link>. O responsável recebe aviso no celular e pode marcar o andamento.
        </p>
      </section>
    </>
  );
}
