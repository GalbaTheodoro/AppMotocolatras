import Link from "next/link";
import { query } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import { EMPRESTADAS_SQL } from "@/lib/cobranca";
import { hojeISO, moeda } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import { criarEmprestimo } from "../acoes";

export default async function NovoEmprestimo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cfg = await lerConfig();
  const equipamentos = await query(
    `SELECT * FROM (
       SELECT q.id, q.nome, q.codigo, q.quantidade - ${EMPRESTADAS_SQL} disp
         FROM equipamentos q WHERE q.status IN ('disponivel','emprestado')
     ) t WHERE disp > 0 ORDER BY nome`);
  const pessoas = await query("SELECT id, nome, telefone FROM pessoas WHERE ativo ORDER BY nome");
  return (
    <>
      <div className="head">
        <div>
          <h1>Novo empréstimo</h1>
          <p className="sub">
            Os primeiros {cfg.meses_gratis} meses são grátis. Depois, {moeda(cfg.valor_mensalidade)} por mês por unidade emprestada.
          </p>
        </div>
      </div>
      <Mensagem sp={sp} />
      {equipamentos.length === 0 || pessoas.length === 0 ? (
        <div className="card">
          {equipamentos.length === 0 && <p>Não há equipamentos com unidades disponíveis. <Link href="/equipamentos/novo">Cadastrar equipamento</Link></p>}
          {pessoas.length === 0 && <p>Não há pessoas cadastradas. <Link href="/pessoas/nova">Cadastrar pessoa</Link></p>}
        </div>
      ) : (
        <form className="f card" action={criarEmprestimo}>
          <label>Equipamento *
            <select name="equipamento_id" defaultValue={sp.equipamento ?? ""} required>
              <option value="">Selecione…</option>
              {equipamentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}{e.codigo ? ` (${e.codigo})` : ""} — {e.disp} {e.disp > 1 ? "disponíveis" : "disponível"}
                </option>
              ))}
            </select>
          </label>
          <label>Quantidade *
            <input type="number" name="quantidade" min={1} step={1} defaultValue={1} required />
          </label>
          <label>Pessoa *
            <select name="pessoa_id" defaultValue={sp.pessoa ?? ""} required>
              <option value="">Selecione…</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.telefone ? ` · ${p.telefone}` : ""}</option>)}
            </select>
          </label>
          <label>Data de início *
            <input type="date" name="data_inicio" defaultValue={hojeISO()} max={hojeISO()} required />
          </label>
          <label className="full">Observações<textarea name="observacoes" placeholder="Estado do equipamento, acessórios entregues, etc." /></label>
          <p className="full sub" style={{ fontSize: ".85rem" }}>
            A mensalidade é cobrada por unidade: 2 unidades = 2 × {moeda(cfg.valor_mensalidade)}.
            Para lançar empréstimos antigos, informe a data real de início — as mensalidades devidas são geradas automaticamente.
          </p>
          <div className="full acoes">
            <button className="btn" type="submit">Registrar empréstimo</button>
            <Link className="btn sec" href="/emprestimos">Cancelar</Link>
          </div>
        </form>
      )}
    </>
  );
}
