"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { exigirAdmin, exigirLogado } from "@/lib/auth";
import { txt, comMsg } from "@/lib/formato";

function lerPapel(fd: FormData) {
  const p = fd.get("papel");
  return p === "admin" || p === "integrante" ? p : "operador";
}

export async function criarUsuario(fd: FormData) {
  await exigirAdmin();
  const nome = txt(fd, "nome");
  const email = (txt(fd, "email") ?? "").toLowerCase();
  const senha = txt(fd, "senha") ?? "";
  const papel = lerPapel(fd);
  const telefone = txt(fd, "telefone");
  if (!nome || !email || senha.length < 6) redirect(comMsg("/usuarios", "erro", "Preencha nome, e-mail e senha (mín. 6 caracteres)"));
  let novoId = 0;
  try {
    const [novo] = await query<{ id: number }>("INSERT INTO usuarios (nome, email, senha_hash, papel, telefone) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [nome, email, await bcrypt.hash(senha, 10), papel, telefone]);
    novoId = novo.id;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") redirect(comMsg("/usuarios", "erro", "Já existe um usuário com este e-mail"));
    throw e;
  }
  // Integrante: já abre a ficha completa para preencher
  if (papel === "integrante") redirect(comMsg(`/usuarios/${novoId}`, "ok", "Integrante criado. Preencha a ficha completa abaixo."));
  redirect(comMsg("/usuarios", "ok", "Usuário criado"));
}

export async function atualizarUsuario(fd: FormData) {
  const eu = await exigirAdmin();
  const id = Number(fd.get("id"));
  const papel = lerPapel(fd);
  const ativo = fd.get("ativo") === "sim";
  if (id === eu.id && (papel !== "admin" || !ativo)) {
    redirect(comMsg("/usuarios", "erro", "Você não pode remover seu próprio acesso de administrador"));
  }
  await query("UPDATE usuarios SET papel=$1, ativo=$2, telefone=$3 WHERE id=$4", [papel, ativo, txt(fd, "telefone"), id]);
  const senha = txt(fd, "senha");
  if (senha) {
    if (senha.length < 6) redirect(comMsg("/usuarios", "erro", "A nova senha precisa ter pelo menos 6 caracteres"));
    await query("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [await bcrypt.hash(senha, 10), id]);
  }
  redirect(comMsg("/usuarios", "ok", "Usuário atualizado"));
}

export async function trocarMinhaSenha(fd: FormData) {
  const eu = await exigirLogado();
  const conta = eu.papel === "integrante" ? "/minha-conta" : "/conta";
  const atual = txt(fd, "atual") ?? "";
  const nova = txt(fd, "nova") ?? "";
  const r = await queryOne<{ senha_hash: string }>("SELECT senha_hash FROM usuarios WHERE id=$1", [eu.id]);
  if (!r || !(await bcrypt.compare(atual, r.senha_hash))) redirect(comMsg(conta, "erro", "Senha atual incorreta"));
  if (nova.length < 6) redirect(comMsg(conta, "erro", "A nova senha precisa ter pelo menos 6 caracteres"));
  await query("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [await bcrypt.hash(nova, 10), eu.id]);
  redirect(comMsg(conta, "ok", "Senha alterada"));
}
