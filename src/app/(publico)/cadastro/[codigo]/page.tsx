import Link from "next/link";
import { papelDoConvite, NOME_PAPEL } from "@/lib/convites";
import Mensagem from "@/components/Mensagem";
import CabecaPublica from "@/components/CabecaPublica";
import FormFicha from "@/components/FormFicha";

export const dynamic = "force-dynamic";

/** Cadastro pela própria pessoa, a partir do link enviado pelo administrador (um link por perfil) */
export default async function CadastroPorLink({
  params, searchParams,
}: { params: Promise<{ codigo: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { codigo } = await params;
  const sp = await searchParams;
  const papel = await papelDoConvite(codigo);

  if (!papel) {
    return (
      <div className="publico">
        <div className="caixa">
          <CabecaPublica titulo="Cadastro" />
          <div className="card">
            <h2>Link inválido</h2>
            <p className="sub">Este link de cadastro não existe ou foi substituído por um novo. Peça o link atualizado ao administrador do clube.</p>
            <div className="acoes" style={{ marginTop: 12 }}><Link className="btn sec" href="/login">Ir para o login</Link></div>
          </div>
        </div>
      </div>
    );
  }

  const nome = NOME_PAPEL[papel];
  return (
    <div className="publico">
      <div className="caixa">
        <CabecaPublica titulo={`Cadastro de ${nome}`} />
        <Mensagem sp={sp} />
        <div className="card">
          <p className="sub">
            Preencha seus dados abaixo. Ao concluir, seu acesso ao sistema já fica liberado como <b>{nome}</b>.
            Campos com * são obrigatórios. Já tem cadastro? <Link href="/login">Entrar</Link>.
          </p>
        </div>
        <FormFicha
          usuario={{ id: 0, nome: "", email: "", telefone: null }}
          ficha={{}}
          filhos={[]}
          convite={{ codigo, papel: nome }}
        />
      </div>
    </div>
  );
}
