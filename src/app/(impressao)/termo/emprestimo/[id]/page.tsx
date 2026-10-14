import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import Termo from "@/components/Termo";

export default async function TermoEmprestimo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await queryOne(
    `SELECT e.id, e.quantidade, e.quantidade_inicial, e.data_inicio, e.data_devolucao,
            q.nome, q.codigo, q.categoria,
            p.nome pnome, p.cpf, p.telefone, p.email, p.endereco
       FROM emprestimos e JOIN equipamentos q ON q.id=e.equipamento_id JOIN pessoas p ON p.id=e.pessoa_id
      WHERE e.id=$1`, [Number(id) || 0]);
  if (!e) notFound();
  const cfg = await lerConfig();
  return (
    <Termo
      cfg={cfg}
      d={{
        numero: `E-${String(e.id).padStart(5, "0")}`,
        voltar: `/emprestimos/${e.id}`,
        pessoa: { nome: e.pnome, cpf: e.cpf, telefone: e.telefone, email: e.email, endereco: e.endereco },
        itens: [{ nome: e.nome, codigo: e.codigo, categoria: e.categoria, quantidade: e.quantidade_inicial, data_inicio: e.data_inicio }],
        dataInicio: e.data_inicio,
      }}
    />
  );
}
