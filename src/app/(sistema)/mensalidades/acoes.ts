"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { exigirUsuario, exigirAdmin } from "@/lib/auth";
import { txt, comMsg, hojeISO } from "@/lib/formato";

function voltar(fd: FormData) {
  const v = txt(fd, "volta") ?? "/mensalidades";
  return v.startsWith("/") ? v.split("?")[0] : "/mensalidades";
}

export async function pagar(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  const pagoEm = txt(fd, "pago_em") ?? hojeISO();
  await query(
    "UPDATE mensalidades SET status='pago', pago_em=$1, forma_pagamento=$2 WHERE id=$3 AND status='pendente'",
    [pagoEm, txt(fd, "forma_pagamento"), id]
  );
  revalidatePath("/", "layout");
  redirect(comMsg(voltar(fd), "ok", "Pagamento registrado"));
}

export async function estornar(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  await query("UPDATE mensalidades SET status='pendente', pago_em=NULL, forma_pagamento=NULL WHERE id=$1", [id]);
  revalidatePath("/", "layout");
  redirect(comMsg(voltar(fd), "ok", "Mensalidade voltou para pendente"));
}

export async function cancelar(fd: FormData) {
  await exigirAdmin();
  const id = Number(fd.get("id"));
  await query("UPDATE mensalidades SET status='cancelado' WHERE id=$1 AND status='pendente'", [id]);
  revalidatePath("/", "layout");
  redirect(comMsg(voltar(fd), "ok", "Mensalidade cancelada (isenta)"));
}
