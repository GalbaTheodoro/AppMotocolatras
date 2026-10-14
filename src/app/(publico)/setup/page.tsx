import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import Mensagem from "@/components/Mensagem";
import { LogoTopo } from "@/components/Marca";
import { criarPrimeiroAdmin } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  let temUsuario: unknown;
  try {
    temUsuario = await queryOne("SELECT 1 FROM usuarios LIMIT 1");
  } catch {
    redirect("/diagnostico"); // banco não configurado ou sem tabelas
  }
  if (temUsuario) redirect("/login");
  const sp = await searchParams;
  return (
    <div className="auth">
      <div className="card">
        <LogoTopo subtitulo="Primeiro acesso" />
        <p className="sub" style={{ textAlign: "center", marginBottom: 14 }}>Crie o usuário administrador</p>
        <Mensagem sp={sp} />
        <form action={criarPrimeiroAdmin}>
          <label>Nome<input name="nome" required autoFocus /></label>
          <label>E-mail<input name="email" type="email" required /></label>
          <label>Senha<input name="senha" type="password" minLength={6} required /></label>
          <button className="btn" type="submit">Criar administrador</button>
        </form>
      </div>
    </div>
  );
}
