import { query } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import { criarUsuario, atualizarUsuario } from "./acoes";

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const lista = await query("SELECT id, nome, email, papel, ativo FROM usuarios ORDER BY nome");
  return (
    <>
      <div className="head"><div><h1>Usuários</h1><p className="sub">Quem pode acessar o sistema</p></div></div>
      <Mensagem sp={sp} />
      <div className="card">
        <h2>Novo usuário</h2>
        <form className="f" action={criarUsuario}>
          <label>Nome<input name="nome" required /></label>
          <label>E-mail<input name="email" type="email" required /></label>
          <label>Senha inicial<input name="senha" type="password" minLength={6} required /></label>
          <label>Perfil
            <select name="papel" defaultValue="operador">
              <option value="operador">Operador</option><option value="admin">Administrador</option>
            </select>
          </label>
          <div className="full"><button className="btn" type="submit">Criar usuário</button></div>
        </form>
        <p className="sub" style={{ fontSize: ".85rem", marginTop: 12 }}>
          <b>Operador:</b> cadastra equipamentos, pessoas, empréstimos e recebe mensalidades. <b>Administrador:</b> também exclui registros, isenta mensalidades, gerencia usuários e configurações.
        </p>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil / situação / nova senha</th></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td>{u.nome} {!u.ativo && <Tag tipo="inativo">Inativo</Tag>}</td>
                <td>{u.email}</td>
                <td>
                  <form action={atualizarUsuario} className="acoes">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="papel" defaultValue={u.papel}><option value="operador">Operador</option><option value="admin">Administrador</option></select>
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
