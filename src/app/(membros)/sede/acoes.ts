"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { exigirLogado, exigirUsuario, ehEquipe } from "@/lib/auth";
import { txt, comMsg, hojeISO } from "@/lib/formato";

function volta(data: string) {
  return `/sede?m=${data.slice(0, 7)}&d=${data}`;
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

  try {
    await query(
      `INSERT INTO reservas_sede (data, usuario_id, responsavel, telefone, finalidade, valor, observacoes, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data, usuarioId, responsavel, telefone, txt(fd, "finalidade"), valor, txt(fd, "observacoes"), u.id]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") redirect(comMsg(volta(data), "erro", "Este dia acabou de ser reservado por outra pessoa"));
    throw e;
  }
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
