import Link from "next/link";
import NavLink from "@/components/NavLink";
import { queryOne } from "@/lib/db";
import type { Usuario } from "@/lib/auth";
import { sair } from "@/app/(publico)/acoes";

const NOME_PAPEL = { admin: "Administrador", operador: "Operador", integrante: "Integrante" } as const;

/** Menu lateral, adaptado ao perfil de quem está logado */
export default async function Lateral({ u }: { u: Usuario }) {
  const equipe = u.papel !== "integrante";
  const pend = equipe
    ? await queryOne<{ n: number }>("SELECT count(*)::int n FROM solicitacoes WHERE status='pendente'").catch(() => null)
    : null;
  return (
    <aside className="side">
      <Link href={equipe ? "/" : "/sede"} className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Motocólatras MC" />
        <b>MOTOCÓLATRAS</b>
        <small>Viciados em duas rodas</small>
      </Link>
      <nav>
        {equipe ? (
          <>
            <NavLink href="/">Painel</NavLink>
            <div className="sep">Cadastros</div>
            <NavLink href="/equipamentos">Equipamentos</NavLink>
            <NavLink href="/pessoas">Pessoas</NavLink>
            <div className="sep">Controle</div>
            <NavLink href="/solicitacoes">Solicitações{pend && pend.n > 0 ? <span className="badge">{pend.n}</span> : null}</NavLink>
            <NavLink href="/emprestimos">Empréstimos</NavLink>
            <NavLink href="/mensalidades">Mensalidades</NavLink>
            <div className="sep">Sede</div>
            <NavLink href="/sede">Agenda da sede</NavLink>
            {u.papel === "admin" && (
              <>
                <div className="sep">Administração</div>
                <NavLink href="/usuarios">Usuários</NavLink>
                <NavLink href="/configuracoes">Configurações</NavLink>
              </>
            )}
          </>
        ) : (
          <>
            <div className="sep">Sede</div>
            <NavLink href="/sede">Agenda da sede</NavLink>
          </>
        )}
      </nav>
      <div className="user">
        <b>{u.nome}</b>
        {NOME_PAPEL[u.papel]} · <NavLink href={equipe ? "/conta" : "/minha-conta"}>Minha conta</NavLink>
        <form action={sair}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </aside>
  );
}
