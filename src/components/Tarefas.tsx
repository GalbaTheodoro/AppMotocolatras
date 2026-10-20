import { data as fmtData, hojeISO } from "@/lib/formato";
import { STATUS_TAREFA, TAG_TAREFA, podeAtualizarTarefa, type Tarefa } from "@/lib/reunioes";
import type { Usuario } from "@/lib/auth";
import { criarTarefa, atualizarTarefa, editarTarefa } from "@/app/(membros)/reunioes/acoes";
import Tag from "./Tag";
import BotaoConfirmar from "./BotaoConfirmar";

type Pessoa = { id: number; nome: string };

function CamposTarefa({ usuarios, t }: { usuarios: Pessoa[]; t?: Tarefa }) {
  return (
    <>
      <label className="full">O que precisa ser feito *<input name="titulo" required defaultValue={t?.titulo ?? ""} placeholder="Ex.: Orçar churrasqueira nova para a sede" /></label>
      <label>Responsável
        <select name="responsavel_id" defaultValue={t?.responsavel_id ? String(t.responsavel_id) : t?.responsavel_nome ? "outro" : ""}>
          <option value="">— definir depois —</option>
          {usuarios.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value="outro">Outra pessoa (digitar)</option>
        </select>
      </label>
      <label>Nome (se outra pessoa)<input name="responsavel_nome" defaultValue={t?.responsavel_nome ?? ""} /></label>
      <label>Prazo<input name="prazo" type="date" defaultValue={t?.prazo ?? ""} /></label>
      <label className="full">Detalhes<textarea name="descricao" defaultValue={t?.descricao ?? ""} style={{ minHeight: 60 }} /></label>
    </>
  );
}

export function NovaTarefa({ usuarios, eventoId }: { usuarios: Pessoa[]; eventoId?: number }) {
  return (
    <form action={criarTarefa} className="f">
      {eventoId && <input type="hidden" name="evento_id" value={eventoId} />}
      <CamposTarefa usuarios={usuarios} />
      <div className="full acoes"><button className="btn" type="submit">+ Passar tarefa</button></div>
    </form>
  );
}

/** Lista de tarefas com troca rápida de situação; quem pode editar vê "Editar" */
export function ListaTarefas({
  tarefas, u, usuarios, volta, mostrarReuniao = false,
}: { tarefas: Tarefa[]; u: Usuario; usuarios: Pessoa[]; volta?: "reuniao"; mostrarReuniao?: boolean }) {
  const hoje = hojeISO();
  if (tarefas.length === 0) return <div className="vazio">Nenhuma tarefa.</div>;
  return (
    <div className="tarefas">
      {tarefas.map((t) => {
        const atrasada = t.prazo && t.prazo < hoje && (t.status === "pendente" || t.status === "andamento");
        const podeStatus = podeAtualizarTarefa(u, t);
        const podeEditar = u.papel !== "integrante" || t.criado_por === u.id;
        return (
          <div key={t.id} className={`tarefa ${t.status} ${atrasada ? "atrasada" : ""}`}>
            <div className="tarefa-topo">
              <div>
                <b className="tarefa-titulo">{t.status === "concluida" ? "✔ " : ""}{t.titulo}</b>
                <div className="sub" style={{ fontSize: ".82rem" }}>
                  👤 {t.responsavel ?? "sem responsável"}
                  {t.prazo && <> · 📅 {fmtData(t.prazo)}{atrasada && <b style={{ color: "var(--err)" }}> (atrasada)</b>}</>}
                  {t.concluida_em && t.status === "concluida" && <> · concluída em {fmtData(t.concluida_em)}</>}
                  {mostrarReuniao && t.reuniao && <> · 📋 <a href={`/reunioes/${t.evento_id}#tarefas`}>{t.reuniao} ({fmtData(t.reuniao_data)})</a></>}
                </div>
                {t.descricao && <div style={{ fontSize: ".88rem", marginTop: 4, whiteSpace: "pre-wrap" }}>{t.descricao}</div>}
                {t.observacao && <div className="sub" style={{ fontSize: ".85rem", marginTop: 4 }}>💬 {t.observacao}</div>}
              </div>
              <Tag tipo={atrasada ? "atrasado" : TAG_TAREFA[t.status]}>{STATUS_TAREFA[t.status]}</Tag>
            </div>
            {(podeStatus || podeEditar) && (
              <details className="tarefa-acoes">
                <summary className="sub">Atualizar</summary>
                {podeStatus && (
                  <form action={atualizarTarefa} className="f" style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={t.id} />
                    {volta && <input type="hidden" name="volta" value={volta} />}
                    <label>Situação
                      <select name="status" defaultValue={t.status}>
                        {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label>Observação / andamento<input name="observacao" defaultValue={t.observacao ?? ""} placeholder="Ex.: orçamento pedido, aguardando retorno" /></label>
                    <div className="full acoes"><button className="btn peq" type="submit">Salvar situação</button></div>
                  </form>
                )}
                {podeEditar && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="sub">Editar tarefa</summary>
                    <form action={editarTarefa} className="f" style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={t.id} />
                      {volta && <input type="hidden" name="volta" value={volta} />}
                      <CamposTarefa usuarios={usuarios} t={t} />
                      <div className="full acoes">
                        <button className="btn sec peq" type="submit">Salvar alterações</button>
                      </div>
                    </form>
                    <form action={editarTarefa} style={{ marginTop: 6 }}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="excluir" value="sim" />
                      {volta && <input type="hidden" name="volta" value={volta} />}
                      <BotaoConfirmar mensagem="Excluir esta tarefa?">Excluir tarefa</BotaoConfirmar>
                    </form>
                  </details>
                )}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
