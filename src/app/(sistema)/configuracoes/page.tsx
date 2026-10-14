import { exigirAdmin } from "@/lib/auth";
import { lerConfig } from "@/lib/config";
import Mensagem from "@/components/Mensagem";
import { salvarConfig } from "./acoes";

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const c = await lerConfig();
  return (
    <>
      <div className="head"><div><h1>Configurações</h1><p className="sub">Regras de cobrança</p></div></div>
      <Mensagem sp={sp} />
      <form className="f card" action={salvarConfig}>
        <label>Valor da mensalidade por equipamento (R$)
          <input name="valor_mensalidade" type="number" step="0.01" min="0" defaultValue={c.valor_mensalidade.toFixed(2)} required />
        </label>
        <label>Meses grátis no início de cada empréstimo
          <input name="meses_gratis" type="number" min="0" step="1" defaultValue={c.meses_gratis} required />
        </label>
        <label>Dias de tolerância antes de considerar atrasada
          <input name="dias_tolerancia" type="number" min="0" step="1" defaultValue={c.dias_tolerancia} required />
        </label>
        <p className="full sub" style={{ fontSize: ".85rem" }}>
          Alterar o valor afeta apenas as mensalidades geradas daqui em diante. As já lançadas mantêm o valor original.
        </p>
        <h2 className="full" style={{ marginTop: 10, marginBottom: 0 }}>Dados do clube no termo de empréstimo</h2>
        <label>Nome do clube<input name="clube_nome" defaultValue={c.clube_nome} /></label>
        <label>CNPJ / CPF do responsável (opcional)<input name="clube_documento" defaultValue={c.clube_documento} /></label>
        <label>Endereço da sede<input name="clube_endereco" defaultValue={c.clube_endereco} /></label>
        <label>Cidade (local e foro)<input name="clube_cidade" defaultValue={c.clube_cidade} /></label>
        <label>Responsável que assina pelo clube<input name="clube_responsavel" defaultValue={c.clube_responsavel} placeholder="Nome do presidente / diretor" /></label>
        <label>Prazo para devolver quando solicitado (dias)
          <input name="termo_prazo_devolucao" type="number" min="0" step="1" defaultValue={c.termo_prazo_devolucao} />
        </label>
        <label className="full">Cláusulas extras (opcional — uma por linha, entram no fim do termo)
          <textarea name="termo_clausulas_extras" defaultValue={c.termo_clausulas_extras} placeholder="Ex.: O equipamento deve ser usado apenas em eventos e passeios do clube." />
        </label>
        <div className="full"><button className="btn" type="submit">Salvar</button></div>
      </form>
    </>
  );
}
