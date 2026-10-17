import { query } from "./db";

export const TIPOS_EVENTO = {
  reuniao: { nome: "Reunião", icone: "📋" },
  festa: { nome: "Festa", icone: "🎉" },
  encontro: { nome: "Encontro", icone: "🤝" },
  role: { nome: "Rolê", icone: "🏍️" },
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;

export type Evento = {
  id: number; data: string; hora: string | null; tipo: TipoEvento; titulo: string; local: string | null;
  na_sede: boolean; descricao: string | null; criado_por: number | null; criado_por_nome: string | null;
};

export type Aniversario = {
  dia: string;          // data neste ano (YYYY-MM-DD)
  nome: string;
  quem: "integrante" | "conjuge" | "filho";
  de: string | null;    // nome do integrante (para cônjuge/filho)
  idade: number | null; // idade que completa
  usuario_id: number;
};

export async function eventosEntre(inicio: string, fim: string) {
  return query<Evento>(
    `SELECT e.id, e.data, e.hora, e.tipo, e.titulo, e.local, e.na_sede, e.descricao, e.criado_por, u.nome criado_por_nome
       FROM eventos e LEFT JOIN usuarios u ON u.id=e.criado_por
      WHERE e.status='ativo' AND e.data BETWEEN $1 AND $2
      ORDER BY e.data, e.hora NULLS FIRST, e.id`, [inicio, fim]);
}

/**
 * Aniversários (integrante, cônjuge e filhos) que caem entre duas datas, calculados a partir das fichas.
 * Aparecem sozinhos na agenda assim que a data de nascimento é cadastrada. Funciona entre anos (ex.: dez→jan).
 */
export async function aniversariosEntre(inicio: string, fim: string): Promise<Aniversario[]> {
  const linhas = await query<{ nome: string; quem: Aniversario["quem"]; de: string | null; nasc: string; usuario_id: number }>(
    `SELECT u.nome, 'integrante' quem, NULL de, f.data_nascimento nasc, u.id usuario_id
       FROM usuarios u JOIN usuario_ficha f ON f.usuario_id=u.id WHERE u.ativo AND f.data_nascimento IS NOT NULL
     UNION ALL
     SELECT f.conjuge_nome, 'conjuge', u.nome, f.conjuge_nascimento, u.id
       FROM usuarios u JOIN usuario_ficha f ON f.usuario_id=u.id
      WHERE u.ativo AND f.conjuge_nascimento IS NOT NULL AND coalesce(f.conjuge_nome,'') <> ''
     UNION ALL
     SELECT x.nome, 'filho', u.nome, x.data_nascimento, u.id
       FROM usuarios u JOIN usuario_filhos x ON x.usuario_id=u.id WHERE u.ativo AND x.data_nascimento IS NOT NULL`);
  const anoIni = Number(inicio.slice(0, 4)), anoFim = Number(fim.slice(0, 4));
  const out: Aniversario[] = [];
  for (const l of linhas) {
    const nasc = String(l.nasc).slice(0, 10);
    const [ny, nm, nd] = nasc.split("-").map(Number);
    for (let y = anoIni; y <= anoFim; y++) {
      // 29/02 em ano não bissexto: comemora em 28/02
      const ultimo = new Date(Date.UTC(y, nm, 0)).getUTCDate();
      const dia = `${y}-${String(nm).padStart(2, "0")}-${String(Math.min(nd, ultimo)).padStart(2, "0")}`;
      if (dia < inicio || dia > fim) continue;
      const idade = y - ny;
      out.push({ dia, nome: l.nome, quem: l.quem, de: l.de, idade: idade > 0 && idade < 130 ? idade : null, usuario_id: l.usuario_id });
    }
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome));
}

export function rotuloAniversario(a: Aniversario) {
  const primeiro = (n: string | null) => (n ?? "").split(" ")[0];
  if (a.quem === "conjuge") return `${a.nome} (esposa/cônjuge de ${primeiro(a.de)})`;
  if (a.quem === "filho") return `${a.nome} (filho(a) de ${primeiro(a.de)})`;
  return a.nome;
}
