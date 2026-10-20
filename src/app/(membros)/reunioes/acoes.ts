"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne, transacao } from "@/lib/db";
import { exigirLogado, type Usuario } from "@/lib/auth";
import { txt, comMsg, hojeISO } from "@/lib/formato";
import { podeGerir, podeAtualizarTarefa } from "@/lib/reunioes";
import { enviarPush } from "@/lib/push";

const pagina = (id: number, aba?: string) => `/reunioes/${id}${aba ? `#${aba}` : ""}`;
const comAba = (url: string, aba: string) => `${url}#${aba}`;

async function reuniao(id: number) {
  const ev = await queryOne<{ id: number; titulo: string; data: string; criado_por: number | null }>(
    "SELECT id, titulo, data, criado_por FROM eventos WHERE id=$1 AND tipo='reuniao' AND status='ativo'", [id]);
  if (!ev) redirect("/sede");
  return ev;
}

async function exigirGestor(eventoId: number) {
  const u = await exigirLogado();
  const ev = await reuniao(eventoId);
  if (!podeGerir(u, ev)) redirect(comMsg(pagina(eventoId), "erro", "Só a equipe ou quem marcou a reunião pode alterar isto"));
  return { u, ev };
}

function fim(id: number, aba: string, msg: string): never {
  revalidatePath(`/reunioes/${id}`);
  revalidatePath("/tarefas");
  redirect(comAba(comMsg(pagina(id), "ok", msg), aba));
}

// ===== Pauta =====

/** Qualquer integrante pode sugerir assunto para a pauta */
export async function adicionarPauta(fd: FormData) {
  const u = await exigirLogado();
  const id = Number(fd.get("evento_id"));
  await reuniao(id);
  const titulo = txt(fd, "titulo");
  if (!titulo) redirect(comAba(comMsg(pagina(id), "erro", "Escreva o assunto"), "pauta"));
  await query(
    `INSERT INTO reuniao_pauta (evento_id, ordem, titulo, descricao, criado_por)
     VALUES ($1, (SELECT coalesce(max(ordem),0)+1 FROM reuniao_pauta WHERE evento_id=$1), $2, $3, $4)`,
    [id, titulo, txt(fd, "descricao"), u.id]);
  fim(id, "pauta", "Assunto incluído na pauta");
}

async function itemPauta(fd: FormData) {
  const u = await exigirLogado();
  const item = await queryOne<{ id: number; evento_id: number; criado_por: number | null; ordem: number }>(
    "SELECT id, evento_id, criado_por, ordem FROM reuniao_pauta WHERE id=$1", [Number(fd.get("id"))]);
  if (!item) redirect("/sede");
  const ev = await reuniao(item.evento_id);
  return { u, item, gestor: podeGerir(u, ev) };
}

export async function removerPauta(fd: FormData) {
  const { u, item, gestor } = await itemPauta(fd);
  if (!gestor && item.criado_por !== u.id) redirect(comAba(comMsg(pagina(item.evento_id), "erro", "Você só pode remover os assuntos que sugeriu"), "pauta"));
  await query("DELETE FROM reuniao_pauta WHERE id=$1", [item.id]);
  fim(item.evento_id, "pauta", "Assunto removido da pauta");
}

export async function marcarDiscutido(fd: FormData) {
  const { item, gestor } = await itemPauta(fd);
  if (!gestor) redirect(pagina(item.evento_id, "pauta"));
  await query("UPDATE reuniao_pauta SET discutido = NOT discutido WHERE id=$1", [item.id]);
  fim(item.evento_id, "pauta", "Pauta atualizada");
}

export async function moverPauta(fd: FormData) {
  const { item, gestor } = await itemPauta(fd);
  if (!gestor) redirect(pagina(item.evento_id, "pauta"));
  const dir = fd.get("dir") === "cima" ? "cima" : "baixo";
  await transacao(async (q) => {
    const lista = await q<{ id: number }>("SELECT id FROM reuniao_pauta WHERE evento_id=$1 ORDER BY ordem, id", [item.evento_id]);
    const i = lista.findIndex((x) => x.id === item.id);
    const j = dir === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    for (const [k, x] of lista.entries()) await q("UPDATE reuniao_pauta SET ordem=$1 WHERE id=$2", [k + 1, x.id]);
  });
  fim(item.evento_id, "pauta", "Ordem da pauta alterada");
}

// ===== Ata =====

export async function salvarAta(fd: FormData) {
  const id = Number(fd.get("evento_id"));
  const { u } = await exigirGestor(id);
  const presentes = fd.getAll("presente").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const hora = (k: string) => { const v = txt(fd, k); return v && /^\d{2}:\d{2}$/.test(v) ? v : null; };
  const aprovada = fd.get("aprovada") === "sim";
  await query(
    `INSERT INTO reuniao_ata (evento_id, hora_inicio, hora_fim, presentes, convidados, texto, secretario, aprovada, atualizado_por, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     ON CONFLICT (evento_id) DO UPDATE SET hora_inicio=EXCLUDED.hora_inicio, hora_fim=EXCLUDED.hora_fim, presentes=EXCLUDED.presentes,
       convidados=EXCLUDED.convidados, texto=EXCLUDED.texto, secretario=EXCLUDED.secretario, aprovada=EXCLUDED.aprovada,
       atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now()`,
    [id, hora("hora_inicio"), hora("hora_fim"), presentes, txt(fd, "convidados"), txt(fd, "texto"), txt(fd, "secretario"), aprovada, u.id]);
  fim(id, "ata", aprovada ? "Ata salva e finalizada" : "Ata salva");
}

// ===== Decisões =====

export async function adicionarDecisao(fd: FormData) {
  const id = Number(fd.get("evento_id"));
  const { u } = await exigirGestor(id);
  const texto = txt(fd, "texto");
  if (!texto) redirect(comAba(comMsg(pagina(id), "erro", "Escreva o que foi decidido"), "decisoes"));
  await query("INSERT INTO reuniao_decisoes (evento_id, texto, criado_por) VALUES ($1,$2,$3)", [id, texto, u.id]);
  fim(id, "decisoes", "Decisão registrada");
}

export async function removerDecisao(fd: FormData) {
  const d = await queryOne<{ evento_id: number }>("SELECT evento_id FROM reuniao_decisoes WHERE id=$1", [Number(fd.get("id"))]);
  if (!d) redirect("/sede");
  await exigirGestor(d.evento_id);
  await query("DELETE FROM reuniao_decisoes WHERE id=$1", [Number(fd.get("id"))]);
  fim(d.evento_id, "decisoes", "Decisão removida");
}

// ===== Tarefas =====

async function responsavelDe(fd: FormData) {
  const r = txt(fd, "responsavel_id");
  if (r && r !== "outro") {
    const u = await queryOne<{ id: number; nome: string }>("SELECT id, nome FROM usuarios WHERE id=$1", [Number(r)]);
    if (u) return { id: u.id, nome: null as string | null };
  }
  return { id: null as number | null, nome: txt(fd, "responsavel_nome") };
}

const prazoDe = (fd: FormData) => { const v = txt(fd, "prazo"); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };

async function avisarResponsavel(u: Usuario, responsavelId: number | null, titulo: string, url: string) {
  if (!responsavelId || responsavelId === u.id) return;
  await enviarPush({ titulo: "✅ Nova tarefa para você", corpo: titulo.slice(0, 160), url, tag: `tarefa-${titulo}`.slice(0, 60) }, [], responsavelId)
    .catch((e) => console.error("Push não enviado:", e));
}

/** Cria tarefa: na reunião (organizador) ou avulsa na página de tarefas (equipe) */
export async function criarTarefa(fd: FormData) {
  const u = await exigirLogado();
  const eventoId = Number(fd.get("evento_id")) || null;
  const volta = eventoId ? pagina(eventoId) : "/tarefas";
  if (eventoId) await exigirGestor(eventoId);
  else if (u.papel === "integrante") redirect(comMsg("/tarefas", "erro", "Tarefas avulsas são criadas pela equipe"));
  const titulo = txt(fd, "titulo");
  if (!titulo) redirect(comAba(comMsg(volta, "erro", "Descreva a tarefa"), "tarefas"));
  const resp = await responsavelDe(fd);
  await query(
    `INSERT INTO tarefas (evento_id, titulo, descricao, responsavel_id, responsavel_nome, prazo, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [eventoId, titulo, txt(fd, "descricao"), resp.id, resp.nome, prazoDe(fd), u.id]);
  await avisarResponsavel(u, resp.id, titulo, "/tarefas?f=minhas");
  revalidatePath("/tarefas");
  if (eventoId) fim(eventoId, "tarefas", "Tarefa passada");
  redirect(comMsg("/tarefas", "ok", "Tarefa criada"));
}

/** Muda a situação (a fazer / em andamento / concluída / cancelada) e a observação */
export async function atualizarTarefa(fd: FormData) {
  const u = await exigirLogado();
  const t = await queryOne<{ id: number; evento_id: number | null; criado_por: number | null; responsavel_id: number | null; status: string }>(
    "SELECT id, evento_id, criado_por, responsavel_id, status FROM tarefas WHERE id=$1", [Number(fd.get("id"))]);
  if (!t) redirect("/tarefas");
  const volta = txt(fd, "volta") === "reuniao" && t.evento_id ? pagina(t.evento_id) : "/tarefas";
  if (!podeAtualizarTarefa(u, t)) redirect(comMsg(volta, "erro", "Só o responsável, quem passou a tarefa ou a equipe pode alterá-la"));
  const status = ["pendente", "andamento", "concluida", "cancelada"].includes(String(fd.get("status"))) ? String(fd.get("status")) : t.status;
  await query(
    `UPDATE tarefas SET status=$1, observacao=$2,
            concluida_em = CASE WHEN $1='concluida' THEN coalesce(concluida_em, $3::date) ELSE NULL END WHERE id=$4`,
    [status, txt(fd, "observacao"), hojeISO(), t.id]);
  revalidatePath("/tarefas");
  if (t.evento_id) revalidatePath(`/reunioes/${t.evento_id}`);
  redirect(comAba(comMsg(volta, "ok", "Tarefa atualizada"), "tarefas"));
}

/** Edição completa (título, responsável, prazo) e exclusão — equipe ou quem criou */
export async function editarTarefa(fd: FormData) {
  const u = await exigirLogado();
  const t = await queryOne<{ id: number; evento_id: number | null; criado_por: number | null; responsavel_id: number | null }>(
    "SELECT id, evento_id, criado_por, responsavel_id FROM tarefas WHERE id=$1", [Number(fd.get("id"))]);
  if (!t) redirect("/tarefas");
  const volta = txt(fd, "volta") === "reuniao" && t.evento_id ? pagina(t.evento_id) : "/tarefas";
  if (!(u.papel !== "integrante" || t.criado_por === u.id)) redirect(comMsg(volta, "erro", "Só quem passou a tarefa ou a equipe pode editá-la"));
  if (fd.get("excluir") === "sim") {
    await query("DELETE FROM tarefas WHERE id=$1", [t.id]);
    revalidatePath("/tarefas");
    redirect(comAba(comMsg(volta, "ok", "Tarefa excluída"), "tarefas"));
  }
  const titulo = txt(fd, "titulo");
  if (!titulo) redirect(comMsg(volta, "erro", "Descreva a tarefa"));
  const resp = await responsavelDe(fd);
  await query("UPDATE tarefas SET titulo=$1, descricao=$2, responsavel_id=$3, responsavel_nome=$4, prazo=$5 WHERE id=$6",
    [titulo, txt(fd, "descricao"), resp.id, resp.nome, prazoDe(fd), t.id]);
  if (resp.id !== t.responsavel_id) await avisarResponsavel(u, resp.id, titulo, "/tarefas?f=minhas");
  revalidatePath("/tarefas");
  if (t.evento_id) revalidatePath(`/reunioes/${t.evento_id}`);
  redirect(comAba(comMsg(volta, "ok", "Tarefa alterada"), "tarefas"));
}
