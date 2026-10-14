"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { exigirUsuario, exigirAdmin } from "@/lib/auth";
import { txt, comMsg } from "@/lib/formato";

function dados(fd: FormData) {
  const status = txt(fd, "status") ?? "disponivel";
  return {
    nome: txt(fd, "nome"),
    codigo: txt(fd, "codigo"),
    categoria: txt(fd, "categoria"),
    descricao: txt(fd, "descricao"),
    status: ["disponivel", "manutencao", "inativo"].includes(status) ? status : "disponivel",
  };
}

function erroUnico(e: unknown) {
  return (e as { code?: string })?.code === "23505";
}

export async function criarEquipamento(fd: FormData) {
  await exigirUsuario();
  const d = dados(fd);
  if (!d.nome) redirect(comMsg("/equipamentos/novo", "erro", "Informe o nome do equipamento"));
  try {
    await query(
      "INSERT INTO equipamentos (nome, codigo, categoria, descricao, status) VALUES ($1,$2,$3,$4,$5)",
      [d.nome, d.codigo, d.categoria, d.descricao, d.status]
    );
  } catch (e) {
    if (erroUnico(e)) redirect(comMsg("/equipamentos/novo", "erro", "Já existe um equipamento com este código"));
    throw e;
  }
  revalidatePath("/equipamentos");
  redirect(comMsg("/equipamentos", "ok", "Equipamento cadastrado"));
}

export async function salvarEquipamento(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  const d = dados(fd);
  const volta = `/equipamentos/${id}`;
  if (!d.nome) redirect(comMsg(volta, "erro", "Informe o nome do equipamento"));
  const atual = await queryOne<{ status: string }>("SELECT status FROM equipamentos WHERE id=$1", [id]);
  if (!atual) redirect("/equipamentos");
  // Se está emprestado, o status é controlado pelo empréstimo
  const status = atual.status === "emprestado" ? "emprestado" : d.status;
  try {
    await query(
      "UPDATE equipamentos SET nome=$1, codigo=$2, categoria=$3, descricao=$4, status=$5 WHERE id=$6",
      [d.nome, d.codigo, d.categoria, d.descricao, status, id]
    );
  } catch (e) {
    if (erroUnico(e)) redirect(comMsg(volta, "erro", "Já existe um equipamento com este código"));
    throw e;
  }
  revalidatePath("/equipamentos");
  redirect(comMsg("/equipamentos", "ok", "Equipamento atualizado"));
}

export async function excluirEquipamento(fd: FormData) {
  await exigirAdmin();
  const id = Number(fd.get("id"));
  const uso = await queryOne("SELECT 1 FROM emprestimos WHERE equipamento_id=$1 LIMIT 1", [id]);
  if (uso) {
    redirect(comMsg(`/equipamentos/${id}`, "erro", "Este equipamento tem histórico de empréstimos. Marque como Inativo em vez de excluir."));
  }
  await query("DELETE FROM equipamentos WHERE id=$1", [id]);
  revalidatePath("/equipamentos");
  redirect(comMsg("/equipamentos", "ok", "Equipamento excluído"));
}
