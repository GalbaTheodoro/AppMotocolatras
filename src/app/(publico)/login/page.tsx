import Link from "next/link";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import Mensagem from "@/components/Mensagem";
import { LogoTopo } from "@/components/Marca";
import InstalarApp from "@/components/InstalarApp";
import { entrar } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  if (await usuarioAtual().catch(() => null)) redirect("/");
  let temUsuario: unknown;
  try {
    temUsuario = await queryOne("SELECT 1 FROM usuarios LIMIT 1");
  } catch {
    redirect("/diagnostico"); // banco não configurado ou sem tabelas
  }
  if (!temUsuario) redirect("/setup");
  const sp = await searchParams;
  return (
    <div className="auth">
      <div className="card">
        <LogoTopo subtitulo="Empréstimo de equipamentos" />
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          <Link className="btn" href="/solicitar" style={{ justifyContent: "center", padding: "13px 16px", fontSize: "1rem" }}>
            Quero solicitar um empréstimo
          </Link>
          <Link className="btn sec" href="/acompanhar" style={{ justifyContent: "center" }}>
            Acompanhar minha solicitação
          </Link>
        </div>
        <InstalarApp />
        <div style={{ height: 14 }} />
        <details open={!!sp.erro} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--muted)", fontSize: ".9rem" }}>Acesso da equipe</summary>
          <div style={{ marginTop: 12 }}>
            <Mensagem sp={sp} />
            <form action={entrar}>
              <label>E-mail<input name="email" type="email" required /></label>
              <label>Senha<input name="senha" type="password" required /></label>
              <button className="btn" type="submit">Entrar</button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
