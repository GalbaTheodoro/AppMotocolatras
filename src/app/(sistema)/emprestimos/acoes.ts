"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne, transacao } from "@/lib/db";
import { exigirUsuario, exigirAdmin } from "@/lib/auth";
import { gerarMensalidades } from "@/lib/cobranca";
import { txt, comMsg, hojeISO } from "@/lib/formato";

export async function criarEmprestimo(fd: FormData) {
  const u = await exigirUsuario();
  const equipamento = Number(fd.get("equipamento_id"));
  const pessoa = Number(fd.get("pessoa_id"));
  const qtd = Math.floor(Number(fd.get("quantidade") ?? 1));
  const inicio = txt(fd, "data_inicio") ?? hojeISO();
  const obs = txt(fd, "observacoes");
  const volta = `/emprestimos/novo?equipamento=${equipamento || ""}&pessoa=${pessoa || ""}`;
  if (!equipamento || !pessoa) redirect(comMsg(volta, "erro", "Selecione o equipamento e a pessoa"));
  if (!(qtd >= 1)) redirect(comMsg(volta, "erro", "Informe uma quantidade de 1 ou mais"));
  if (inicio > hojeISO()) redirect(comMsg(volta, "erro", "A data de início não pode ser no futuro"));

  // Trava o equipamento enquanto confere o saldo, para dois empréstimos simultâneos não passarem do estoque
  const r = await transacao(async (q) => {
    const [eq] = await q<{ quantidade: number; status: string }>(
      "SELECT quantidade, status FROM equipamentos WHERE id=$1 FOR UPDATE", [equipamento]);
    if (!eq) return { erro: "Equipamento não encontrado" };
    if (eq.status === "manutencao" || eq.status === "inativo") return { erro: "Este equipamento está em manutenção ou inativo" };
    const [em] = await q<{ n: number }>(
      "SELECT coalesce(sum(quantidade),0)::int n FROM emprestimos WHERE equipamento_id=$1 AND data_devolucao IS NULL", [equipamento]);
    const disp = eq.quantidade - em.n;
    if (qtd > disp) return { erro: `Só há ${disp} unidade(s) disponível(is) deste equipamento` };
    const [novo] = await q<{ id: number }>(
      `INSERT INTO emprestimos (equipamento_id, pessoa_id, quantidade, quantidade_inicial, data_inicio, observacoes, criado_por)
       VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING id`,
      [equipamento, pessoa, qtd, inicio, obs, u.id]);
    return { id: novo.id };
  });
  if ("erro" in r) redirect(comMsg(volta, "erro", r.erro!));
  await gerarMensalidades();
  revalidatePath("/emprestimos");
  redirect(comMsg(`/emprestimos/${r.id}`, "ok", `Empréstimo registrado (${qtd} unidade${qtd > 1 ? "s" : ""})`));
}

export async function devolver(fd: FormData) {
  const u = await exigirUsuario();
  const id = Number(fd.get("id"));
  const dataDev = txt(fd, "data_devolucao") ?? hojeISO();
  const volta = `/emprestimos/${id}`;
  const e = await queryOne<{ quantidade: number; data_inicio: string; data_devolucao: string | null }>(
    "SELECT quantidade, data_inicio, data_devolucao FROM emprestimos WHERE id=$1", [id]);
  if (!e) redirect("/emprestimos");
  const qtd = Math.floor(Number(fd.get("quantidade") ?? e.quantidade));
  if (e.data_devolucao) redirect(comMsg(volta, "erro", "Este empréstimo já foi devolvido"));
  if (!(qtd >= 1) || qtd > e.quantidade) redirect(comMsg(volta, "erro", `Informe uma quantidade entre 1 e ${e.quantidade}`));
  if (dataDev < e.data_inicio) redirect(comMsg(volta, "erro", "A devolução não pode ser antes do início"));
  if (dataDev > hojeISO()) redirect(comMsg(volta, "erro", "A data de devolução não pode ser no futuro"));

  // Gera o que já venceu com a quantidade antiga antes de mudar
  await gerarMensalidades();
  const total = qtd === e.quantidade;
  await transacao(async (q) => {
    await q("INSERT INTO devolucoes (emprestimo_id, data, quantidade, criado_por) VALUES ($1,$2,$3,$4)", [id, dataDev, qtd, u.id]);
    // Mensalidades pendentes de meses que começam a partir da devolução são refeitas (ou removidas, se devolveu tudo)
    await q("DELETE FROM mensalidades WHERE emprestimo_id=$1 AND status='pendente' AND competencia_inicio >= $2", [id, dataDev]);
    if (total) {
      await q("UPDATE emprestimos SET data_devolucao=$1 WHERE id=$2", [dataDev, id]);
    } else {
      await q("UPDATE emprestimos SET quantidade = quantidade - $1 WHERE id=$2", [qtd, id]);
    }
  });
  if (!total) await gerarMensalidades();
  revalidatePath("/emprestimos");
  redirect(comMsg(volta, "ok", total
    ? "Devolução registrada. Empréstimo encerrado."
    : `Devolução parcial registrada: ${qtd} unidade(s). Continuam com a pessoa: ${e.quantidade - qtd}.`));
}

export async function salvarObs(fd: FormData) {
  await exigirUsuario();
  const id = Number(fd.get("id"));
  await query("UPDATE emprestimos SET observacoes=$1 WHERE id=$2", [txt(fd, "observacoes"), id]);
  redirect(comMsg(`/emprestimos/${id}`, "ok", "Observações salvas"));
}

export async function excluirEmprestimo(fd: FormData) {
  await exigirAdmin();
  const id = Number(fd.get("id"));
  const pagas = await queryOne("SELECT 1 FROM mensalidades WHERE emprestimo_id=$1 AND status='pago' LIMIT 1", [id]);
  if (pagas) redirect(comMsg(`/emprestimos/${id}`, "erro", "Há mensalidades pagas neste empréstimo; não é possível excluir"));
  await query("DELETE FROM emprestimos WHERE id=$1", [id]);
  revalidatePath("/emprestimos");
  redirect(comMsg("/emprestimos", "ok", "Empréstimo excluído"));
}
