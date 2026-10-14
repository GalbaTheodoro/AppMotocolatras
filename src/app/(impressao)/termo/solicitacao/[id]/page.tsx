import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import Termo from "@/components/Termo";

export default async function TermoSolicitacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await queryOne("SELECT * FROM solicitacoes WHERE id=$1 AND status='aprovada'", [Number(id) || 0]);
  if (!s) notFound();
  const pessoa = s.pessoa_id
    ? await queryOne("SELECT nome, cpf, telefone, email, endereco FROM pessoas WHERE id=$1", [s.pessoa_id])
    : null;
  const itens = await query(
    `SELECT q.nome, q.codigo, q.categoria, e.quantidade_inicial quantidade, e.data_inicio
       FROM solicitacao_itens i JOIN emprestimos e ON e.id=i.emprestimo_id JOIN equipamentos q ON q.id=e.equipamento_id
      WHERE i.solicitacao_id=$1 ORDER BY q.nome`, [s.id]);
  if (itens.length === 0) notFound();
  const cfg = await lerConfig();
  return (
    <Termo
      cfg={cfg}
      d={{
        numero: s.protocolo,
        voltar: `/solicitacoes/${s.id}`,
        pessoa: pessoa ?? { nome: s.nome, cpf: s.cpf, telefone: s.telefone, email: s.email, endereco: s.endereco },
        itens: itens as never,
        dataInicio: itens[0].data_inicio,
      }}
    />
  );
}
