type Equip = {
  id?: number; nome?: string; codigo?: string | null; categoria?: string | null; descricao?: string | null;
  status?: string; quantidade?: number; emprestadas?: number;
};

export default function FormEquipamento({ e = {}, action }: { e?: Equip; action: (fd: FormData) => Promise<void> }) {
  const emprestadas = e.emprestadas ?? 0;
  return (
    <form className="f card" action={action}>
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <label>Nome *<input name="nome" defaultValue={e.nome ?? ""} required /></label>
      <label>Código / patrimônio<input name="codigo" defaultValue={e.codigo ?? ""} /></label>
      <label>Categoria<input name="categoria" defaultValue={e.categoria ?? ""} placeholder="Ex.: Capacete, Jaqueta, Intercomunicador" /></label>
      <label>
        Quantidade em estoque *
        <input name="quantidade" type="number" min={Math.max(1, emprestadas)} step={1} defaultValue={e.quantidade ?? 1} required />
        {e.id && <span className="sub" style={{ fontWeight: 400 }}>{emprestadas} emprestada(s) no momento</span>}
      </label>
      <label>
        Situação
        <select name="status" defaultValue={e.status === "emprestado" ? "disponivel" : e.status ?? "disponivel"}>
          <option value="disponivel">Ativo (pode emprestar)</option>
          <option value="manutencao">Em manutenção</option>
          <option value="inativo">Inativo</option>
        </select>
      </label>
      <label className="full">Descrição<textarea name="descricao" defaultValue={e.descricao ?? ""} /></label>
      <div className="full acoes">
        <button className="btn" type="submit">Salvar</button>
        <a className="btn sec" href="/equipamentos">Cancelar</a>
      </div>
    </form>
  );
}
