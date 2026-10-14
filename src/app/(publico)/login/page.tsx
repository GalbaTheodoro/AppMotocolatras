import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import Mensagem from "@/components/Mensagem";
import { entrar } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  if (await usuarioAtual()) redirect("/");
  const temUsuario = await queryOne("SELECT 1 FROM usuarios LIMIT 1");
  if (!temUsuario) redirect("/setup");
  const sp = await searchParams;
  return (
    <div className="auth">
      <div className="card">
        <div className="logo">Moto<span>cólatras</span></div>
        <p className="sub" style={{ textAlign: "center", marginBottom: 18 }}>Controle de empréstimos</p>
        <Mensagem sp={sp} />
        <form action={entrar}>
          <label>E-mail<input name="email" type="email" required autoFocus /></label>
          <label>Senha<input name="senha" type="password" required /></label>
          <button className="btn" type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}
