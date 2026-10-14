import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { data } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import Tag from "@/components/Tag";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import FormEquipamento from "../Formulario";
import { salvarEquipamento, excluirEquipamento } from "../acoes";

export default async function EditarEquipamento({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const e = await queryOne("SELECT * FROM equipamentos WHERE id=$1", [Number(id) || 0]);
  if (!e) notFound();
  const u = await usuarioAtual();
  const historico = await query(
    `SELECT e.*, p.nome pessoa FROM emprestimos e JOIN pessoas p ON p.id=e.pessoa_id
      WHERE e.equipamento_id=$1 ORDER BY e.data_inicio DESC`, [e.id]);
  return (
    <>
      <div className="head">
        <div><h1>{e.nome}</h1><p className="sub">Editar equipamento</p></div>
        {u?.papel === "admin" && (
          <form action={excluirEquipamento}>
            <input type="hidden" name="id" value={e.id} />
            <BotaoConfirmar mensagem="Excluir este equipamento?">Excluir</BotaoConfirmar>
          </form>
        )}
      </div>
      <Mensagem sp={sp} />
      <FormEquipamento e={e} action={salvarEquipamento} />
      <h2>Histórico de empréstimos</h2>
      <div className="tbl">
        {historico.length === 0 ? <div className="vazio">Ainda não foi emprestado.</div> : (
          <table>
            <thead><tr><th>Pessoa</th><th>Início</th><th>Devolução</th><th></th></tr></thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id}>
                  <td>{h.pessoa}</td><td>{data(h.data_inicio)}</td>
                  <td>{h.data_devolucao ? data(h.data_devolucao) : <Tag tipo="emprestado">Em aberto</Tag>}</td>
                  <td className="r"><Link href={`/emprestimos/${h.id}`}>Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
