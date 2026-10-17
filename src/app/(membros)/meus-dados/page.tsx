import { exigirLogado } from "@/lib/auth";
import { lerFicha } from "@/lib/ficha";
import Mensagem from "@/components/Mensagem";
import FormFicha from "@/components/FormFicha";

export default async function MeusDados({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await exigirLogado();
  const sp = await searchParams;
  const r = (await lerFicha(u.id))!;
  return (
    <>
      <div className="head"><div><h1>Meus dados</h1><p className="sub">Mantenha sua ficha de integrante atualizada</p></div></div>
      <Mensagem sp={sp} />
      <FormFicha usuario={r.usuario} ficha={r.ficha} filhos={r.filhos} origem="meus-dados" />
    </>
  );
}
