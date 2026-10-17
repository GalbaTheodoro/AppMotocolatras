"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne, transacao } from "@/lib/db";
import { TIPOS_EVENTO, type TipoEvento } from "@/lib/agenda";
import { enviarPush } from "@/lib/push";
import { exigirLogado, exigirUsuario, ehEquipe } from "@/lib/auth";
import { txt, comMsg, hojeISO } from "@/lib/formato";

function volta(data: string) {
  return `/sede?m=${data.slice(0, 7)}&d=${data}`;
}

type Q = Parameters<Parameters<typeof transacao>[0]>[0];

/** Trava o dia da sede durante a transação (evita reserva e evento na sede ao mesmo tempo) */
async function travarDia(q: Q, data: string) {
  await q("SELECT pg_advisory_xact_lock(hashtext('sede:' || $1::text))", [data]);
}

function valorDe(fd: FormData) {
  const v = txt(fd, "valor");
  if (v === null) return null;
  const n = parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function reservar(fd: FormData) {
  const u = await exigirLogado();
  const equipe = ehEquipe(u);
  const data = txt(fd, "data") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) redirect("/sede");
  if (!equipe && data < hojeISO()) redirect(comMsg(volta(data), "erro", "Não é possível reservar uma data que já passou"));

  let usuarioId: number | null = u.id;
  let responsavel = u.nome;
  let telefone = txt(fd, "telefone");
  let valor: number | null = null;

  if (equipe) {
    const quem = txt(fd, "usuario_id");
    if (quem && quem !== "outro") {
      const i = await queryOne<{ id: number; nome: string; telefone: string | null }>(
        "SELECT id, nome, telefone FROM usuarios WHERE id=$1", [Number(quem)]);
      if (!i) redirect(comMsg(volta(data), "erro", "Integrante não encontrado"));
      usuarioId = i.id; responsavel = i.nome; telefone = telefone ?? i.telefone;
    } else {
      usuarioId = null;
      responsavel = txt(fd, "responsavel") ?? "";
      if (!responsavel) redirect(comMsg(volta(data), "erro", "Informe o nome de quem está reservando"));
    }
    valor = valorDe(fd);
    if (Number.isNaN(valor)) redirect(comMsg(volta(data), "erro", "Valor inválido"));
  } else if (!telefone) {
    const meu = await queryOne<{ telefone: string | null }>("SELECT telefone FROM usuarios WHERE id=$1", [u.id]);
    telefone = meu?.telefone ?? null;
  }

  let ocupado: string | null = null;
  try {
    ocupado = await transacao(async (q) => {
      await travarDia(q, data);
      const ev = await q<{ titulo: string }>("SELECT titulo FROM eventos WHERE data=$1 AND na_sede AND status='ativo' LIMIT 1", [data]);
      if (ev.length) return ev[0].titulo;
      await q(
        `INSERT INTO reservas_sede (data, usuario_id, responsavel, telefone, finalidade, valor, observacoes, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [data, usuarioId, responsavel, telefone, txt(fd, "finalidade"), valor, txt(fd, "observacoes"), u.id]);
      return null;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") redirect(comMsg(volta(data), "erro", "Este dia acabou de ser reservado por outra pessoa"));
    throw e;
  }
  if (ocupado) redirect(comMsg(volta(data), "erro", `A sede já está ocupada neste dia pelo evento "${ocupado}"`));
  revalidatePath("/sede");
  redirect(comMsg(volta(data), "ok", equipe ? "Reserva registrada" : "Reserva feita! A equipe vai confirmar o valor com você."));
}

export async function cancelarReserva(fd: FormData) {
  const u = await exigirLogado();
  const id = Number(fd.get("id"));
  const r = await queryOne<{ data: string; usuario_id: number | null; status: string }>(
    "SELECT data, usuario_id, status FROM reservas_sede WHERE id=$1", [id]);
  if (!r) redirect("/sede");
  const equipe = ehEquipe(u);
  if (!equipe && r.usuario_id !== u.id) redirect(comMsg(volta(r.data), "erro", "Você só pode cancelar as suas reservas"));
  if (!equipe && r.data < hojeISO()) redirect(comMsg(volta(r.data), "erro", "Reservas de datas passadas só podem ser alteradas pela equipe"));
  await query("UPDATE reservas_sede SET status='cancelada', cancelado_em=now() WHERE id=$1 AND status='confirmada'", [id]);
  revalidatePath("/sede");
  redirect(comMsg(volta(r.data), "ok", "Reserva cancelada. O dia está livre novamente."));
}

export async function salvarReserva(fd: FormData) {
  await exigirUsuario(); // somente equipe
  const id = Number(fd.get("id"));
  const r = await queryOne<{ data: string }>("SELECT data FROM reservas_sede WHERE id=$1", [id]);
  if (!r) redirect("/sede");
  const valor = valorDe(fd);
  if (Number.isNaN(valor)) redirect(comMsg(volta(r.data), "erro", "Valor inválido"));
  const pagamento = ["pendente", "pago", "isento"].includes(String(fd.get("pagamento"))) ? String(fd.get("pagamento")) : "pendente";
  const pagoEm = pagamento === "pago" ? (txt(fd, "pago_em") ?? hojeISO()) : null;
  await query(
    `UPDATE reservas_sede SET responsavel=coalesce($1, responsavel), telefone=$2, finalidade=$3, valor=$4,
            pagamento=$5, pago_em=$6, observacoes=$7 WHERE id=$8`,
    [txt(fd, "responsavel"), txt(fd, "telefone"), txt(fd, "finalidade"), valor, pagamento, pagoEm, txt(fd, "observacoes"), id]);
  revalidatePath("/sede");
  redirect(comMsg(volta(r.data), "ok", "Reserva atualizada"));
}

// ===== Eventos do clube (reunião, festa, encontro, rolê) =====

function lerEvento(fd: FormData) {
  const tipo = String(fd.get("tipo")) as TipoEvento;
  const hora = txt(fd, "hora");
  return {
    data: txt(fd, "data") ?? "",
    tipo: tipo in TIPOS_EVENTO ? tipo : "encontro",
    titulo: txt(fd, "titulo"),
    hora: hora && /^\d{2}:\d{2}$/.test(hora) ? hora : null,
    local: txt(fd, "local"),
    na_sede: fd.get("na_sede") === "sim",
    descricao: txt(fd, "descricao"),
  };
}

/** Verifica se a sede está livre para um evento "na sede" (sem reserva e sem outro evento na sede) */
async function conflitoSede(q: Q, data: string, ignorarEvento = 0) {
  const r = await q<{ responsavel: string }>("SELECT responsavel FROM reservas_sede WHERE data=$1 AND status='confirmada' LIMIT 1", [data]);
  if (r.length) return `A sede está reservada neste dia por ${r[0].responsavel}`;
  const e = await q<{ titulo: string }>("SELECT titulo FROM eventos WHERE data=$1 AND na_sede AND status='ativo' AND id<>$2 LIMIT 1", [data, ignorarEvento]);
  if (e.length) return `A sede já está ocupada neste dia pelo evento "${e[0].titulo}"`;
  return null;
}

export async function criarEvento(fd: FormData) {
  const u = await exigirLogado();
  const ev = lerEvento(fd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.data)) redirect("/sede");
  if (!ev.titulo) redirect(comMsg(volta(ev.data), "erro", "Informe o título do evento"));
  if (!ehEquipe(u) && ev.data < hojeISO()) redirect(comMsg(volta(ev.data), "erro", "Não é possível marcar evento em data que já passou"));
  const erro = await transacao(async (q) => {
    if (ev.na_sede) {
      await travarDia(q, ev.data);
      const c = await conflitoSede(q, ev.data);
      if (c) return c;
    }
    await q(`INSERT INTO eventos (data, hora, tipo, titulo, local, na_sede, descricao, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ev.data, ev.hora, ev.tipo, ev.titulo, ev.na_sede ? (ev.local ?? "Sede") : ev.local, ev.na_sede, ev.descricao, u.id]);
    return null;
  });
  if (erro) redirect(comMsg(volta(ev.data), "erro", erro));
  const t = TIPOS_EVENTO[ev.tipo];
  const [y, m, d] = ev.data.split("-");
  await enviarPush({
    titulo: `${t.icone} ${t.nome} marcado(a) na agenda`,
    corpo: `${ev.titulo} · ${d}/${m}/${y}${ev.hora ? " às " + ev.hora : ""}${ev.na_sede ? " · na sede" : ev.local ? " · " + ev.local : ""}`,
    url: volta(ev.data),
    tag: `evento-${ev.data}-${ev.titulo}`.slice(0, 60),
  }, ["admin", "operador", "integrante"]).catch((e) => console.error("Push não enviado:", e));
  revalidatePath("/sede");
  redirect(comMsg(volta(ev.data), "ok", `${t.nome} marcado(a) na agenda`));
}

async function eventoEditavel(id: number) {
  const u = await exigirLogado();
  const e = await queryOne<{ data: string; criado_por: number | null }>("SELECT data, criado_por FROM eventos WHERE id=$1 AND status='ativo'", [id]);
  if (!e) redirect("/sede");
  if (!ehEquipe(u) && e.criado_por !== u.id) redirect(comMsg(volta(e.data), "erro", "Só quem criou o evento ou a equipe pode alterá-lo"));
  return e;
}

export async function salvarEvento(fd: FormData) {
  const id = Number(fd.get("id"));
  const atual = await eventoEditavel(id);
  const ev = lerEvento(fd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.data)) ev.data = atual.data;
  if (!ev.titulo) redirect(comMsg(volta(atual.data), "erro", "Informe o título do evento"));
  const erro = await transacao(async (q) => {
    if (ev.na_sede) {
      await travarDia(q, ev.data);
      const c = await conflitoSede(q, ev.data, id);
      if (c) return c;
    }
    await q(`UPDATE eventos SET data=$1, hora=$2, tipo=$3, titulo=$4, local=$5, na_sede=$6, descricao=$7 WHERE id=$8`,
      [ev.data, ev.hora, ev.tipo, ev.titulo, ev.local, ev.na_sede, ev.descricao, id]);
    return null;
  });
  if (erro) redirect(comMsg(volta(atual.data), "erro", erro));
  revalidatePath("/sede");
  redirect(comMsg(volta(ev.data), "ok", "Evento atualizado"));
}

export async function cancelarEvento(fd: FormData) {
  const id = Number(fd.get("id"));
  const e = await eventoEditavel(id);
  await query("UPDATE eventos SET status='cancelado' WHERE id=$1", [id]);
  revalidatePath("/sede");
  redirect(comMsg(volta(e.data), "ok", "Evento removido da agenda"));
}
