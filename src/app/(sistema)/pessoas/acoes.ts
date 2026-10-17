"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { exigirUsuario, exigirAdmin } from "@/lib/auth";
import { txt, comMsg } from "@/lib/formato";

function dados(fd: FormData) {
  return {
    nome: txt(fd, "nome"),
    cpf: txt(fd, "cpf"),
    telefone: txt(fd, "telefone"),
    email: txt(fd, "email"),
    endereco: txt(fd, "endereco"),
    observacoes: txt(fd, "observacoes"),
    ativo: fd.get("ativo") !== "nao",
  };
}

export async function criarPessoa(fd: FormData) {
  await exigirUsuario();
  const d = dados(fd);
  if (!d.nome) redirect(comMsg("/pessoas/nova", "erro", "Informe o nome"));
  await query(
    "INSERT INTO pessoas (nome, cpf, telefone, email, endereco, observacoes) VALUES ($1,$2,$3,$4,$5,$6)",
    [d.nome, d.cpf, d.telefone, d.email, d.endereco, d.observacoes]
  );
  revalidatePath("/pessoas");
  redirect(comMsg("/pessoas", "ok", "Pessoa cadastrada"));
}

export async function salvarPessoa(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  const d = dados(fd);
  if (!d.nome) redirect(comMsg(`/pessoas/${id}`, "erro", "Informe o nome"));
  await query(
    "UPDATE pessoas SET nome=$1, cpf=$2, telefone=$3, email=$4, endereco=$5, observacoes=$6, ativo=$7 WHERE id=$8",
    [d.nome, d.cpf, d.telefone, d.email, d.endereco, d.observacoes, d.ativo, id]
  );
  revalidatePath("/pessoas");
  redirect(comMsg(`/pessoas/${id}`, "ok", "Dados salvos"));
}

export async function excluirPessoa(fd: FormData) {
  await exigirAdmin();
  const id = Number(fd.get("id"));
  const uso = await queryOne("SELECT 1 FROM emprestimos WHERE pessoa_id=$1 LIMIT 1", [id]);
  if (uso) {
    redirect(comMsg(`/pessoas/${id}`, "erro", "Esta pessoa tem histórico de empréstimos. Marque como Inativa em vez de excluir."));
  }
  // Solicitações e seus documentos continuam guardados, só deixam de apontar para o cadastro
  await query("UPDATE arquivos SET pessoa_id=NULL WHERE pessoa_id=$1 AND solicitacao_id IS NOT NULL", [id]);
  await query("UPDATE solicitacoes SET pessoa_id=NULL WHERE pessoa_id=$1", [id]);
  await query("DELETE FROM pessoas WHERE id=$1", [id]);
  revalidatePath("/pessoas");
  redirect(comMsg("/pessoas", "ok", "Pessoa excluída"));
}
