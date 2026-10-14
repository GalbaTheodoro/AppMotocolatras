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
        <div className="full"><button className="btn" type="submit">Salvar</button></div>
      </form>
    </>
  );
}
