"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { txt, comMsg } from "@/lib/formato";

export async function criarUsuario(fd: FormData) {
  await exigirAdmin();
  const nome = txt(fd, "nome");
  const email = (txt(fd, "email") ?? "").toLowerCase();
  const senha = txt(fd, "senha") ?? "";
  const papel = fd.get("papel") === "admin" ? "admin" : "operador";
  if (!nome || !email || senha.length < 6) redirect(comMsg("/usuarios", "erro", "Preencha nome, e-mail e senha (mín. 6 caracteres)"));
  try {
    await query("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4)",
      [nome, email, await bcrypt.hash(senha, 10), papel]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") redirect(comMsg("/usuarios", "erro", "Já existe um usuário com este e-mail"));
    throw e;
  }
  redirect(comMsg("/usuarios", "ok", "Usuário criado"));
}

export async function atualizarUsuario(fd: FormData) {
  const eu = await exigirAdmin();
  const id = Number(fd.get("id"));
  const papel = fd.get("papel") === "admin" ? "admin" : "operador";
  const ativo = fd.get("ativo") === "sim";
  if (id === eu.id && (papel !== "admin" || !ativo)) {
    redirect(comMsg("/usuarios", "erro", "Você não pode remover seu próprio acesso de administrador"));
  }
  await query("UPDATE usuarios SET papel=$1, ativo=$2 WHERE id=$3", [papel, ativo, id]);
  const senha = txt(fd, "senha");
  if (senha) {
    if (senha.length < 6) redirect(comMsg("/usuarios", "erro", "A nova senha precisa ter pelo menos 6 caracteres"));
    await query("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [await bcrypt.hash(senha, 10), id]);
  }
  redirect(comMsg("/usuarios", "ok", "Usuário atualizado"));
}

export async function trocarMinhaSenha(fd: FormData) {
  const eu = await exigirUsuario();
  const atual = txt(fd, "atual") ?? "";
  const nova = txt(fd, "nova") ?? "";
  const r = await queryOne<{ senha_hash: string }>("SELECT senha_hash FROM usuarios WHERE id=$1", [eu.id]);
  if (!r || !(await bcrypt.compare(atual, r.senha_hash))) redirect(comMsg("/conta", "erro", "Senha atual incorreta"));
  if (nova.length < 6) redirect(comMsg("/conta", "erro", "A nova senha precisa ter pelo menos 6 caracteres"));
  await query("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [await bcrypt.hash(nova, 10), eu.id]);
  redirect(comMsg("/conta", "ok", "Senha alterada"));
}
