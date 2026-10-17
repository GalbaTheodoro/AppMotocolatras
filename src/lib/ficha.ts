import { query, queryOne } from "./db";

export const MAX_FILHOS = 5;
export const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export type Filho = { nome: string; data_nascimento: string | null; sexo: string | null };
export type Ficha = Record<string, string | null> & { usuario_id?: number };

export async function lerFicha(usuarioId: number) {
  const usuario = await queryOne<{ id: number; nome: string; email: string; telefone: string | null; papel: string; ativo: boolean; criado_em: Date }>(
    "SELECT id, nome, email, telefone, papel, ativo, criado_em FROM usuarios WHERE id=$1", [usuarioId]);
  if (!usuario) return null;
  const ficha = (await queryOne<Ficha>("SELECT * FROM usuario_ficha WHERE usuario_id=$1", [usuarioId])) ?? {};
  const filhos = await query<Filho>(
    "SELECT nome, data_nascimento, sexo FROM usuario_filhos WHERE usuario_id=$1 ORDER BY ordem", [usuarioId]);
  return { usuario, ficha, filhos };
}

/** Idade em anos a partir de "YYYY-MM-DD" */
export function idade(nasc: string | null | undefined) {
  if (!nasc) return null;
  const [y, m, d] = nasc.split("-").map(Number);
  const hoje = new Date();
  let a = hoje.getFullYear() - y;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) a--;
  return a >= 0 && a < 130 ? a : null;
}
