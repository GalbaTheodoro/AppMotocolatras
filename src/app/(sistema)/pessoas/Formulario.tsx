type Pessoa = { id?: number; nome?: string; cpf?: string | null; telefone?: string | null; email?: string | null; endereco?: string | null; observacoes?: string | null; ativo?: boolean };

export default function FormPessoa({ p = {}, action }: { p?: Pessoa; action: (fd: FormData) => Promise<void> }) {
  return (
    <form className="f card" action={action}>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <label>Nome *<input name="nome" defaultValue={p.nome ?? ""} required /></label>
      <label>CPF<input name="cpf" defaultValue={p.cpf ?? ""} /></label>
      <label>Telefone / WhatsApp<input name="telefone" defaultValue={p.telefone ?? ""} /></label>
      <label>E-mail<input name="email" type="email" defaultValue={p.email ?? ""} /></label>
      <label className="full">Endereço<input name="endereco" defaultValue={p.endereco ?? ""} /></label>
      {p.id && (
        <label>Situação
          <select name="ativo" defaultValue={p.ativo === false ? "nao" : "sim"}>
            <option value="sim">Ativa</option><option value="nao">Inativa</option>
          </select>
        </label>
      )}
      <label className="full">Observações<textarea name="observacoes" defaultValue={p.observacoes ?? ""} /></label>
      <div className="full acoes">
        <button className="btn" type="submit">Salvar</button>
        <a className="btn sec" href="/pessoas">Voltar</a>
      </div>
    </form>
  );
}
