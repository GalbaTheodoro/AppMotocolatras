"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { exigirUsuario, exigirAdmin } from "@/lib/auth";
import { gerarMensalidades } from "@/lib/cobranca";
import { txt, comMsg, hojeISO } from "@/lib/formato";

export async function criarEmprestimo(fd: FormData) {
  const u = await exigirUsuario();
  const equipamento = Number(fd.get("equipamento_id"));
  const pessoa = Number(fd.get("pessoa_id"));
  const inicio = txt(fd, "data_inicio") ?? hojeISO();
  const obs = txt(fd, "observacoes");
  const volta = "/emprestimos/novo";
  if (!equipamento || !pessoa) redirect(comMsg(volta, "erro", "Selecione o equipamento e a pessoa"));
  if (inicio > hojeISO()) redirect(comMsg(volta, "erro", "A data de início não pode ser no futuro"));

  // Reserva o equipamento e cria o empréstimo numa única operação
  const novo = await queryOne<{ id: number }>(
    `WITH eq AS (
       UPDATE equipamentos SET status='emprestado'
        WHERE id=$1 AND status='disponivel' RETURNING id
     )
     INSERT INTO emprestimos (equipamento_id, pessoa_id, data_inicio, observacoes, criado_por)
     SELECT eq.id, $2, $3, $4, $5 FROM eq RETURNING id`,
    [equipamento, pessoa, inicio, obs, u.id]
  );
  if (!novo) redirect(comMsg(volta, "erro", "Este equipamento não está mais disponível"));
  await gerarMensalidades();
  revalidatePath("/emprestimos");
  redirect(comMsg(`/emprestimos/${novo.id}`, "ok", "Empréstimo registrado"));
}

export async function devolver(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  const dataDev = txt(fd, "data_devolucao") ?? hojeISO();
  const volta = `/emprestimos/${id}`;
  const e = await queryOne<{ equipamento_id: number; data_inicio: string; data_devolucao: string | null }>(
    "SELECT equipamento_id, data_inicio, data_devolucao FROM emprestimos WHERE id=$1", [id]);
  if (!e) redirect("/emprestimos");
  if (e.data_devolucao) redirect(comMsg(volta, "erro", "Este empréstimo já foi devolvido"));
  if (dataDev < e.data_inicio) redirect(comMsg(volta, "erro", "A devolução não pode ser antes do início"));
  if (dataDev > hojeISO()) redirect(comMsg(volta, "erro", "A data de devolução não pode ser no futuro"));

  await gerarMensalidades();
  await query("UPDATE emprestimos SET data_devolucao=$1 WHERE id=$2", [dataDev, id]);
  await query("UPDATE equipamentos SET status='disponivel' WHERE id=$1 AND status='emprestado'", [e.equipamento_id]);
  // Remove mensalidades pendentes de competências que começam a partir da devolução
  await query(
    "DELETE FROM mensalidades WHERE emprestimo_id=$1 AND status='pendente' AND competencia_inicio >= $2",
    [id, dataDev]
  );
  revalidatePath("/emprestimos");
  redirect(comMsg(volta, "ok", "Devolução registrada. Equipamento disponível novamente."));
}

export async function salvarObs(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  await query("UPDATE emprestimos SET observacoes=$1 WHERE id=$2", [txt(fd, "observacoes"), id]);
  redirect(comMsg(`/emprestimos/${id}`, "ok", "Observações salvas"));
}

export async function excluirEmprestimo(fd: FormData) {
  await exigirAdmin();
  const id = Number(fd.get("id"));
  const pagas = await queryOne("SELECT 1 FROM mensalidades WHERE emprestimo_id=$1 AND status='pago' LIMIT 1", [id]);
  if (pagas) redirect(comMsg(`/emprestimos/${id}`, "erro", "Há mensalidades pagas neste empréstimo; não é possível excluir"));
  const e = await queryOne<{ equipamento_id: number; data_devolucao: string | null }>(
    "DELETE FROM emprestimos WHERE id=$1 RETURNING equipamento_id, data_devolucao", [id]);
  if (e && !e.data_devolucao) {
    await query("UPDATE equipamentos SET status='disponivel' WHERE id=$1 AND status='emprestado'", [e.equipamento_id]);
  }
  revalidatePath("/emprestimos");
  redirect(comMsg("/emprestimos", "ok", "Empréstimo excluído"));
}
