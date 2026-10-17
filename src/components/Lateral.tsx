import Link from "next/link";
import NavLink from "@/components/NavLink";
import { queryOne } from "@/lib/db";
import type { Usuario } from "@/lib/auth";
import { sair } from "@/app/(publico)/acoes";
import InstalarApp from "@/components/InstalarApp";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import { chavesVapid } from "@/lib/push";

const NOME_PAPEL = { admin: "Administrador", operador: "Operador", integrante: "Integrante" } as const;

/** Menu lateral, adaptado ao perfil de quem está logado */
export default async function Lateral({ u }: { u: Usuario }) {
  const equipe = u.papel !== "integrante";
  const pend = equipe
    ? await queryOne<{ n: number }>("SELECT count(*)::int n FROM solicitacoes WHERE status='pendente'").catch(() => null)
    : null;
  const chave = u.papel === "admin" ? await chavesVapid().then((k) => k.publica).catch(() => null) : null;
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
            <div className="sep">Agenda</div>
            <NavLink href="/sede">Agenda do clube</NavLink>
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
            <div className="sep">Agenda</div>
            <NavLink href="/sede">Agenda do clube</NavLink>
          </>
        )}
      </nav>
      <div className="user">
        <b>{u.nome}</b>
        {NOME_PAPEL[u.papel]} · <NavLink href="/meus-dados">Meus dados</NavLink> · <NavLink href={equipe ? "/conta" : "/minha-conta"}>Senha</NavLink>
        <form action={sair}>
          <button type="submit">Sair</button>
        </form>
        <InstalarApp variante="escuro" />
        {chave && <AtivarNotificacoes chavePublica={chave} />}
      </div>
    </aside>
  );
}
