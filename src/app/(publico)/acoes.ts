"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { criarSessao, encerrarSessao } from "@/lib/auth";
import { txt, comMsg } from "@/lib/formato";

export async function entrar(fd: FormData) {
  const email = (txt(fd, "email") ?? "").toLowerCase();
  const senha = txt(fd, "senha") ?? "";
  const u = await queryOne<{ id: number; senha_hash: string }>(
    "SELECT id, senha_hash FROM usuarios WHERE lower(email) = $1 AND ativo",
    [email]
  );
  if (!u || !(await bcrypt.compare(senha, u.senha_hash))) {
    redirect(comMsg("/login", "erro", "E-mail ou senha inválidos"));
  }
  await criarSessao(u.id);
  redirect("/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

export async function criarPrimeiroAdmin(fd: FormData) {
  const existe = await queryOne("SELECT 1 FROM usuarios LIMIT 1");
  if (existe) redirect("/login");
  const nome = txt(fd, "nome");
  const email = (txt(fd, "email") ?? "").toLowerCase();
  const senha = txt(fd, "senha") ?? "";
  if (!nome || !email || senha.length < 6) {
    redirect(comMsg("/setup", "erro", "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres"));
  }
  const hash = await bcrypt.hash(senha, 10);
  const [u] = await query<{ id: number }>(
    "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1,$2,$3,'admin') RETURNING id",
    [nome, email, hash]
  );
  await criarSessao(u.id);
  redirect("/");
}
