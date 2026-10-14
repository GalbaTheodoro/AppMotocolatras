"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { transacao, query } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { gerarMensalidades } from "@/lib/cobranca";
import { txt, comMsg, hojeISO, soDigitos } from "@/lib/formato";

export async function aprovarSolicitacao(fd: FormData) {
  const u = await exigirUsuario();
  const id = Number(fd.get("id"));
  const volta = `/solicitacoes/${id}`;
  const inicio = txt(fd, "data_inicio") ?? hojeISO();
  const resposta = txt(fd, "resposta");
  if (inicio > hojeISO()) redirect(comMsg(volta, "erro", "A data de início não pode ser no futuro"));

  const r = await transacao(async (q) => {
    const [s] = await q("SELECT * FROM solicitacoes WHERE id=$1 FOR UPDATE", [id]);
    if (!s) return { erro: "Solicitação não encontrada" };
    if (s.status !== "pendente") return { erro: "Esta solicitação já foi analisada" };
    const itens = await q("SELECT * FROM solicitacao_itens WHERE solicitacao_id=$1", [id]);
    const aprovados = itens.map((i) => ({ ...i, aprovar: Math.max(0, Math.floor(Number(fd.get(`aprovar_${i.id}`) ?? 0))) }));
    if (!aprovados.some((i) => i.aprovar > 0)) return { erro: "Informe ao menos 1 unidade aprovada (ou use Recusar)" };

    // Pessoa: usa o cadastro existente com o mesmo CPF, ou cria um novo
    const cpf = soDigitos(s.cpf);
    let [p] = await q<{ id: number }>("SELECT id FROM pessoas WHERE regexp_replace(coalesce(cpf,''),'\\D','','g') = $1 ORDER BY id LIMIT 1", [cpf]);
    if (p) {
      await q(
        `UPDATE pessoas SET ativo = TRUE,
                telefone = coalesce(telefone, $2), email = coalesce(email, $3), endereco = coalesce(endereco, $4)
          WHERE id = $1`, [p.id, s.telefone, s.email, s.endereco]);
    } else {
      [p] = await q<{ id: number }>(
        "INSERT INTO pessoas (nome, cpf, telefone, email, endereco, observacoes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [s.nome, s.cpf, s.telefone, s.email, s.endereco, `Cadastro via solicitação ${s.protocolo}`]);
    }

    for (const i of aprovados) {
      if (i.aprovar > i.quantidade) return { erro: "A quantidade aprovada não pode ser maior que a pedida" };
      if (i.aprovar === 0) {
        await q("UPDATE solicitacao_itens SET quantidade_aprovada=0 WHERE id=$1", [i.id]);
        continue;
      }
      const [eq] = await q("SELECT nome, quantidade, status FROM equipamentos WHERE id=$1 FOR UPDATE", [i.equipamento_id]);
      const [em] = await q<{ n: number }>(
        "SELECT coalesce(sum(quantidade),0)::int n FROM emprestimos WHERE equipamento_id=$1 AND data_devolucao IS NULL", [i.equipamento_id]);
      const disp = eq.quantidade - em.n;
      if (eq.status === "manutencao" || eq.status === "inativo") return { erro: `${eq.nome} está em manutenção ou inativo` };
      if (i.aprovar > disp) return { erro: `${eq.nome}: só há ${disp} unidade(s) disponível(is)` };
      const [e] = await q<{ id: number }>(
        `INSERT INTO emprestimos (equipamento_id, pessoa_id, quantidade, quantidade_inicial, data_inicio, observacoes, criado_por)
         VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING id`,
        [i.equipamento_id, p.id, i.aprovar, inicio, `Solicitação ${s.protocolo}`, u.id]);
      await q("UPDATE solicitacao_itens SET quantidade_aprovada=$1, emprestimo_id=$2 WHERE id=$3", [i.aprovar, e.id, i.id]);
    }
    // Os documentos passam a fazer parte do cadastro da pessoa
    await q("UPDATE arquivos SET pessoa_id=$1 WHERE solicitacao_id=$2", [p.id, id]);
    await q(
      "UPDATE solicitacoes SET status='aprovada', resposta=$1, pessoa_id=$2, analisado_por=$3, analisado_em=now() WHERE id=$4",
      [resposta, p.id, u.id, id]);
    return { ok: true };
  });
  if ("erro" in r) redirect(comMsg(volta, "erro", r.erro as string));
  await gerarMensalidades();
  revalidatePath("/", "layout");
  redirect(comMsg(volta, "ok", "Solicitação aprovada: pessoa cadastrada e empréstimos registrados"));
}

export async function recusarSolicitacao(fd: FormData) {
  const u = await exigirUsuario();
  const id = Number(fd.get("id"));
  const resposta = txt(fd, "resposta");
  if (!resposta) redirect(comMsg(`/solicitacoes/${id}`, "erro", "Escreva o motivo da recusa (a pessoa verá essa mensagem)"));
  await query(
    "UPDATE solicitacoes SET status='recusada', resposta=$1, analisado_por=$2, analisado_em=now() WHERE id=$3 AND status='pendente'",
    [resposta, u.id, id]);
  revalidatePath("/", "layout");
  redirect(comMsg(`/solicitacoes/${id}`, "ok", "Solicitação recusada"));
}
