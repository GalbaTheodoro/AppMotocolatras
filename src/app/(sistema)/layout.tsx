import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { sair } from "../(publico)/acoes";

export const dynamic = "force-dynamic";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">Moto<span>cólatras</span></div>
        <nav>
          <Link href="/">Painel</Link>
          <div className="sep">Cadastros</div>
          <Link href="/equipamentos">Equipamentos</Link>
          <Link href="/pessoas">Pessoas</Link>
          <div className="sep">Controle</div>
          <Link href="/emprestimos">Empréstimos</Link>
          <Link href="/mensalidades">Mensalidades</Link>
          {u.papel === "admin" && (
            <>
              <div className="sep">Administração</div>
              <Link href="/usuarios">Usuários</Link>
              <Link href="/configuracoes">Configurações</Link>
            </>
          )}
        </nav>
        <div className="user">
          <b>{u.nome}</b>
          {u.papel === "admin" ? "Administrador" : "Operador"} · <Link href="/conta">Minha conta</Link>
          <form action={sair}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
