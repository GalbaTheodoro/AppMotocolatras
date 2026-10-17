import Link from "next/link";
import { query } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import LinkCadastro from "@/components/LinkCadastro";
import { lerConvites, PAPEIS_CONVITE, NOME_PAPEL } from "@/lib/convites";
import { urlDoSite } from "@/lib/notificar";
import { criarUsuario, atualizarUsuario, trocarLinkCadastro } from "./acoes";

/** Endereço oficial do site (domínio de produção), para os links de cadastro */
async function siteOficial() {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : await urlDoSite();
}

const PAPEIS = (
  <>
    <option value="integrante">Integrante</option>
    <option value="operador">Operador</option>
    <option value="admin">Administrador</option>
  </>
);

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; f?: string }> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const filtro = sp.f ?? "";
  const lista = await query(
    `SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.telefone, f.apelido, f.conjuge_nome, f.cpf,
            (SELECT count(*)::int FROM usuario_filhos x WHERE x.usuario_id=u.id) filhos
       FROM usuarios u LEFT JOIN usuario_ficha f ON f.usuario_id=u.id
      WHERE ($1 = '' OR u.papel = $1) ORDER BY u.papel <> 'admin', u.papel <> 'operador', u.nome`,
    [filtro]);
  const [convites, site] = await Promise.all([lerConvites(), siteOficial()]);
  return (
    <>
      <div className="head"><div><h1>Usuários</h1><p className="sub">Quem pode acessar o sistema</p></div></div>
      <Mensagem sp={sp} />
      <div className="card">
        <h2>Links de cadastro</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          Envie o link do perfil certo para cada pessoa. Ela mesma preenche login, senha e a ficha completa
          (dados pessoais, esposa e filhos), e o acesso já fica liberado. Você recebe um aviso no celular a cada novo cadastro.
          <br /><b>Atenção:</b> quem tiver o link de <b>Administrador</b> ganha acesso total — envie só para quem deve ter.
          Se um link vazar, clique em <b>Gerar novo link</b>: o anterior para de funcionar na hora.
        </p>
        {PAPEIS_CONVITE.map((p) => (
          <div key={p} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div className="acoes" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <b>{NOME_PAPEL[p]}</b>
              <form action={trocarLinkCadastro}>
                <input type="hidden" name="papel" value={p} />
                <BotaoConfirmar className="btn sec peq" mensagem={`Gerar um novo link de ${NOME_PAPEL[p]}? O link atual deixará de funcionar.`}>Gerar novo link</BotaoConfirmar>
              </form>
            </div>
            <LinkCadastro url={`${site}/cadastro/${convites[p]}`} perfil={NOME_PAPEL[p]} />
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Novo usuário</h2>
        <form className="f" action={criarUsuario}>
          <label>Nome<input name="nome" required /></label>
          <label>E-mail (login)<input name="email" type="email" required /></label>
          <label>Telefone / WhatsApp<input name="telefone" /></label>
          <label>Senha inicial<input name="senha" type="password" minLength={6} required /></label>
          <label>Perfil
            <select name="papel" defaultValue="integrante">{PAPEIS}</select>
          </label>
          <div className="full"><button className="btn" type="submit">Criar usuário</button></div>
        </form>
        <p className="sub" style={{ fontSize: ".85rem", marginTop: 12 }}>
          <b>Integrante:</b> membro do clube — vê a agenda da sede e faz/cancela as próprias reservas.{" "}
          <b>Operador:</b> cadastra equipamentos, pessoas, empréstimos, solicitações, reservas e recebe pagamentos.{" "}
          <b>Administrador:</b> também exclui registros, isenta mensalidades, gerencia usuários e configurações.
        </p>
      </div>
      <form className="filtros">
        <select name="f" defaultValue={filtro}>
          <option value="">Todos os perfis</option>
          <option value="integrante">Integrantes</option>
          <option value="operador">Operadores</option>
          <option value="admin">Administradores</option>
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>
      <div className="tbl">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil · telefone · situação · nova senha</th></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/usuarios/${u.id}`}><b>{u.nome}</b></Link>{u.apelido ? ` “${u.apelido}”` : ""} {!u.ativo && <Tag tipo="inativo">Inativo</Tag>}
                  <div className="sub" style={{ fontSize: ".78rem" }}>
                    {u.cpf ? "Ficha preenchida" : <span style={{ color: "var(--warn)" }}>Ficha incompleta</span>}
                    {u.conjuge_nome ? ` · cônjuge: ${u.conjuge_nome}` : ""}{u.filhos ? ` · ${u.filhos} filho(s)` : ""}
                  </div>
                  <Link className="btn sec peq" style={{ marginTop: 4 }} href={`/usuarios/${u.id}`}>Abrir ficha</Link>
                </td>
                <td>{u.email}</td>
                <td>
                  <form action={atualizarUsuario} className="acoes">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="papel" defaultValue={u.papel}>{PAPEIS}</select>
                    <input name="telefone" defaultValue={u.telefone ?? ""} placeholder="Telefone" style={{ width: 140 }} />
                    <select name="ativo" defaultValue={u.ativo ? "sim" : "nao"}><option value="sim">Ativo</option><option value="nao">Inativo</option></select>
                    <input name="senha" type="password" placeholder="Nova senha (opcional)" style={{ width: 170 }} />
                    <button className="btn sec peq" type="submit">Salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
