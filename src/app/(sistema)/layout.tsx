import Link from "next/link";
import NavLink from "@/components/NavLink";
import { exigirUsuario } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sair } from "../(publico)/acoes";

export const dynamic = "force-dynamic";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const pend = await queryOne<{ n: number }>("SELECT count(*)::int n FROM solicitacoes WHERE status='pendente'").catch(() => null);
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Motocólatras MC" />
          <b>MOTOCÓLATRAS</b>
          <small>Viciados em duas rodas</small>
        </Link>
        <nav>
          <NavLink href="/">Painel</NavLink>
          <div className="sep">Cadastros</div>
          <NavLink href="/equipamentos">Equipamentos</NavLink>
          <NavLink href="/pessoas">Pessoas</NavLink>
          <div className="sep">Controle</div>
          <NavLink href="/solicitacoes">Solicitações{pend && pend.n > 0 ? <span className="badge">{pend.n}</span> : null}</NavLink>
          <NavLink href="/emprestimos">Empréstimos</NavLink>
          <NavLink href="/mensalidades">Mensalidades</NavLink>
          {u.papel === "admin" && (
            <>
              <div className="sep">Administração</div>
              <NavLink href="/usuarios">Usuários</NavLink>
              <NavLink href="/configuracoes">Configurações</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <b>{u.nome}</b>
          {u.papel === "admin" ? "Administrador" : "Operador"} · <NavLink href="/conta">Minha conta</NavLink>
          <form action={sair}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
