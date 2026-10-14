import Mensagem from "@/components/Mensagem";
import FormEquipamento from "../Formulario";
import { criarEquipamento } from "../acoes";

export default async function NovoEquipamento({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="head"><div><h1>Novo equipamento</h1></div></div>
      <Mensagem sp={sp} />
      <FormEquipamento action={criarEquipamento} />
    </>
  );
}
