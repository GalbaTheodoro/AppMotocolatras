"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { comMsg, txt } from "@/lib/formato";

export async function salvarConfig(fd: FormData) {
  await exigirAdmin();
  const valor = parseFloat(String(fd.get("valor_mensalidade") ?? "").replace(",", "."));
  const meses = parseInt(String(fd.get("meses_gratis") ?? ""), 10);
  const tol = parseInt(String(fd.get("dias_tolerancia") ?? ""), 10);
  const prazo = parseInt(String(fd.get("termo_prazo_devolucao") ?? "5"), 10);
  if (!(valor >= 0) || !(meses >= 0) || !(tol >= 0) || !(prazo >= 0)) {
    redirect(comMsg("/configuracoes", "erro", "Valores inválidos"));
  }
  const pares: [string, string][] = [
    ["valor_mensalidade", valor.toFixed(2)],
    ["meses_gratis", String(meses)],
    ["dias_tolerancia", String(tol)],
    ["termo_prazo_devolucao", String(prazo)],
    ["clube_nome", txt(fd, "clube_nome") ?? "Motocólatras MC"],
    ["clube_documento", txt(fd, "clube_documento") ?? ""],
    ["clube_endereco", txt(fd, "clube_endereco") ?? ""],
    ["clube_cidade", txt(fd, "clube_cidade") ?? ""],
    ["clube_responsavel", txt(fd, "clube_responsavel") ?? ""],
    ["termo_clausulas_extras", txt(fd, "termo_clausulas_extras") ?? ""],
  ];
  for (const [k, v] of pares) {
    await query(
      "INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor",
      [k, v]
    );
  }
  redirect(comMsg("/configuracoes", "ok", "Configurações salvas"));
}
