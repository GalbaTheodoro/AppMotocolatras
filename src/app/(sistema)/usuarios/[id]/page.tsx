import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { lerFicha } from "@/lib/ficha";
import { data } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import FormFicha from "@/components/FormFicha";

const PAPEL: Record<string, string> = { admin: "Administrador", operador: "Operador", integrante: "Integrante" };

export default async function FichaUsuario({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const r = await lerFicha(Number(id) || 0);
  if (!r) notFound();
  return (
    <>
      <div className="head">
        <div>
          <h1>{r.usuario.nome}</h1>
          <p className="sub">
            <Tag tipo={r.usuario.ativo ? "ativo" : "inativo"}>{PAPEL[r.usuario.papel]}{r.usuario.ativo ? "" : " · inativo"}</Tag>{" "}
            {r.usuario.email} · cadastrado em {data(r.usuario.criado_em)}
            {r.ficha.atualizado_em && ` · ficha atualizada em ${data(r.ficha.atualizado_em as unknown as Date)}`}
          </p>
        </div>
        <Link className="btn sec" href="/usuarios">Voltar</Link>
      </div>
      <Mensagem sp={sp} />
      <FormFicha usuario={r.usuario} ficha={r.ficha} filhos={r.filhos} />
    </>
  );
}
