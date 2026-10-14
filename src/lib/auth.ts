import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { queryOne } from "./db";

const COOKIE = "moto_sessao";
const DURACAO_DIAS = 7;

export type Usuario = { id: number; nome: string; email: string; papel: "admin" | "operador" };

function chave() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET não configurada (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
}

export async function criarSessao(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    const u = await queryOne<Usuario>(
      "SELECT id, nome, email, papel FROM usuarios WHERE id = $1 AND ativo",
      [payload.uid]
    );
    return u;
  } catch {
    return null;
  }
}

export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}

export async function exigirAdmin() {
  const u = await exigirUsuario();
  if (u.papel !== "admin") redirect("/?erro=" + encodeURIComponent("Acesso restrito a administradores"));
  return u;
}
