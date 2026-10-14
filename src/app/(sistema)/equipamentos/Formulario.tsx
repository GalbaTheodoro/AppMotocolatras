type Equip = { id?: number; nome?: string; codigo?: string | null; categoria?: string | null; descricao?: string | null; status?: string };

export default function FormEquipamento({ e = {}, action }: { e?: Equip; action: (fd: FormData) => Promise<void> }) {
  const emprestado = e.status === "emprestado";
  return (
    <form className="f card" action={action}>
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <label>Nome *<input name="nome" defaultValue={e.nome ?? ""} required /></label>
      <label>Código / patrimônio<input name="codigo" defaultValue={e.codigo ?? ""} /></label>
      <label>Categoria<input name="categoria" defaultValue={e.categoria ?? ""} placeholder="Ex.: Capacete, Jaqueta, Intercomunicador" /></label>
      <label>
        Situação
        {emprestado ? (
          <input value="Emprestado (controlado pelo empréstimo)" disabled />
        ) : (
          <select name="status" defaultValue={e.status ?? "disponivel"}>
            <option value="disponivel">Disponível</option>
            <option value="manutencao">Em manutenção</option>
            <option value="inativo">Inativo</option>
          </select>
        )}
      </label>
      <label className="full">Descrição<textarea name="descricao" defaultValue={e.descricao ?? ""} /></label>
      <div className="full acoes">
        <button className="btn" type="submit">Salvar</button>
        <a className="btn sec" href="/equipamentos">Cancelar</a>
      </div>
    </form>
  );
}
