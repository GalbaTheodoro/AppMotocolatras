import { exigirUsuario } from "@/lib/auth";
import Mensagem from "@/components/Mensagem";
import { trocarMinhaSenha } from "../usuarios/acoes";

export default async function Conta({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await exigirUsuario();
  const sp = await searchParams;
  return (
    <>
      <div className="head"><div><h1>Minha conta</h1><p className="sub">{u.nome} · {u.email}</p></div></div>
      <Mensagem sp={sp} />
      <form className="f card" action={trocarMinhaSenha}>
        <label>Senha atual<input name="atual" type="password" required /></label>
        <label>Nova senha<input name="nova" type="password" minLength={6} required /></label>
        <div className="full"><button className="btn" type="submit">Alterar senha</button></div>
      </form>
    </>
  );
}
