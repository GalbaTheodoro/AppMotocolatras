export function moeda(v: number | string | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-10-13" -> "13/10/2026" */
export function data(v: string | Date | null | undefined) {
  if (!v) return "—";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function hojeISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const STATUS_EQUIP: Record<string, string> = {
  disponivel: "Disponível",
  emprestado: "Emprestado",
  manutencao: "Em manutenção",
  inativo: "Inativo",
};

export const SITUACAO_MENS: Record<string, string> = {
  pendente: "Pendente",
  atrasado: "Atrasada",
  pago: "Paga",
  cancelado: "Cancelada",
};

export function txt(fd: FormData, k: string) {
  const v = fd.get(k);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export function comMsg(path: string, tipo: "ok" | "erro", msg: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${tipo}=${encodeURIComponent(msg)}`;
}
