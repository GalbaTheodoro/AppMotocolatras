import Mensagem from "@/components/Mensagem";
import FormPessoa from "../Formulario";
import { criarPessoa } from "../acoes";

export default async function NovaPessoa({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="head"><div><h1>Nova pessoa</h1></div></div>
      <Mensagem sp={sp} />
      <FormPessoa action={criarPessoa} />
    </>
  );
}
