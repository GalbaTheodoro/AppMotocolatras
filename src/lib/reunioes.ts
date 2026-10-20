import { query, queryOne } from "./db";
import { ehEquipe, type Usuario } from "./auth";
import type { Evento } from "./agenda";

export const STATUS_TAREFA: Record<string, string> = {
  pendente: "A fazer", andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada",
};
/** Classe da etiqueta (Tag) para cada situação */
export const TAG_TAREFA: Record<string, string> = {
  pendente: "pendente", andamento: "manutencao", concluida: "pago", cancelada: "inativo",
};

export type ItemPauta = { id: number; ordem: number; titulo: string; descricao: string | null; discutido: boolean; criado_por: number | null; autor: string | null };
export type Ata = {
  hora_inicio: string | null; hora_fim: string | null; presentes: number[]; convidados: string | null;
  texto: string | null; secretario: string | null; aprovada: boolean; atualizado_em: Date | null; atualizado_por_nome: string | null;
};
export type Decisao = { id: number; texto: string };
export type Tarefa = {
  id: number; evento_id: number | null; titulo: string; descricao: string | null; responsavel_id: number | null;
  responsavel_nome: string | null; responsavel: string | null; prazo: string | null; status: string;
  concluida_em: string | null; observacao: string | null; criado_por: number | null; reuniao: string | null; reuniao_data: string | null;
};

export const SQL_TAREFAS = `
  SELECT t.*, coalesce(u.nome, t.responsavel_nome) responsavel, e.titulo reuniao, e.data reuniao_data
    FROM tarefas t LEFT JOIN usuarios u ON u.id=t.responsavel_id LEFT JOIN eventos e ON e.id=t.evento_id`;

/** Quem organiza a reunião: equipe (admin/operador) ou quem marcou o evento */
export function podeGerir(u: Usuario, ev: { criado_por: number | null }) {
  return ehEquipe(u) || ev.criado_por === u.id;
}

/** Tarefa pode ter a situação alterada pela equipe, por quem criou ou pelo responsável */
export function podeAtualizarTarefa(u: Usuario, t: { criado_por: number | null; responsavel_id: number | null }) {
  return ehEquipe(u) || t.criado_por === u.id || t.responsavel_id === u.id;
}

export async function lerReuniao(id: number) {
  const ev = await queryOne<Evento & { status: string }>(
    `SELECT e.*, u.nome criado_por_nome FROM eventos e LEFT JOIN usuarios u ON u.id=e.criado_por
      WHERE e.id=$1 AND e.status='ativo' AND e.tipo='reuniao'`, [id]);
  if (!ev) return null;
  const [pauta, ata, decisoes, tarefas] = await Promise.all([
    query<ItemPauta>(
      `SELECT p.id, p.ordem, p.titulo, p.descricao, p.discutido, p.criado_por, u.nome autor
         FROM reuniao_pauta p LEFT JOIN usuarios u ON u.id=p.criado_por WHERE p.evento_id=$1 ORDER BY p.ordem, p.id`, [id]),
    queryOne<Ata>(
      `SELECT a.*, u.nome atualizado_por_nome FROM reuniao_ata a LEFT JOIN usuarios u ON u.id=a.atualizado_por WHERE a.evento_id=$1`, [id]),
    query<Decisao>("SELECT id, texto FROM reuniao_decisoes WHERE evento_id=$1 ORDER BY id", [id]),
    query<Tarefa>(`${SQL_TAREFAS} WHERE t.evento_id=$1 ORDER BY t.status='concluida', t.prazo NULLS LAST, t.id`, [id]),
  ]);
  return { ev, pauta, ata, decisoes, tarefas };
}

export async function usuariosAtivos() {
  return query<{ id: number; nome: string; papel: string }>(
    "SELECT id, nome, papel FROM usuarios WHERE ativo ORDER BY nome");
}
