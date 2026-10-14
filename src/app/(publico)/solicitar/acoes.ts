"use server";

import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { query, queryOne, transacao } from "@/lib/db";
import { txt, comMsg, soDigitos, cpfValido, formatarCPF } from "@/lib/formato";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I

function gerarProtocolo() {
  let p = "";
  for (let i = 0; i < 6; i++) p += ALFABETO[randomInt(ALFABETO.length)];
  return p;
}

export async function enviarSolicitacao(fd: FormData) {
  // Campo escondido: se vier preenchido, é robô
  if (txt(fd, "site")) redirect("/solicitar/enviado?p=OK");

  const nome = txt(fd, "nome");
  const cpf = soDigitos(txt(fd, "cpf"));
  const telefone = txt(fd, "telefone");
  const email = txt(fd, "email");
  const endereco = txt(fd, "endereco");
  const obs = txt(fd, "observacoes");
  const volta = "/solicitar";

  if (!nome || !telefone) redirect(comMsg(volta, "erro", "Preencha nome e telefone"));
  if (!cpfValido(cpf)) redirect(comMsg(volta, "erro", "CPF inválido. Confira os números."));

  // Itens: campos "qtd_<id do equipamento>"
  const itens: { id: number; qtd: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("qtd_")) continue;
    const qtd = Math.floor(Number(v));
    if (qtd > 0) itens.push({ id: Number(k.slice(4)), qtd: Math.min(qtd, 50) });
  }
  if (itens.length === 0) redirect(comMsg(volta, "erro", "Escolha ao menos um equipamento e a quantidade"));

  const validos = await query<{ id: number }>(
    "SELECT id FROM equipamentos WHERE id = ANY($1::int[]) AND status IN ('disponivel','emprestado')",
    [itens.map((i) => i.id)]
  );
  const idsValidos = new Set(validos.map((v) => v.id));
  const itensOk = itens.filter((i) => idsValidos.has(i.id));
  if (itensOk.length === 0) redirect(comMsg(volta, "erro", "Os equipamentos escolhidos não estão mais disponíveis"));

  const abertas = await queryOne<{ n: number }>(
    "SELECT count(*)::int n FROM solicitacoes WHERE regexp_replace(cpf,'\\D','','g') = $1 AND status = 'pendente'", [cpf]);
  if (abertas && abertas.n >= 3) {
    redirect(comMsg(volta, "erro", "Já existem solicitações suas em análise. Aguarde o retorno ou consulte pelo protocolo."));
  }

  const protocolo = await transacao(async (q) => {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const p = gerarProtocolo();
      const existe = await q("SELECT 1 FROM solicitacoes WHERE protocolo=$1", [p]);
      if (existe.length) continue;
      const [s] = await q<{ id: number }>(
        `INSERT INTO solicitacoes (protocolo, nome, cpf, telefone, email, endereco, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [p, nome, formatarCPF(cpf), telefone, email?.toLowerCase() ?? null, endereco, obs]);
      for (const i of itensOk) {
        await q("INSERT INTO solicitacao_itens (solicitacao_id, equipamento_id, quantidade) VALUES ($1,$2,$3)", [s.id, i.id, i.qtd]);
      }
      return p;
    }
    throw new Error("Não foi possível gerar o protocolo");
  });
  redirect(`/solicitar/enviado?p=${protocolo}`);
}

export async function consultarSolicitacao(fd: FormData) {
  const protocolo = (txt(fd, "protocolo") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cpf = soDigitos(txt(fd, "cpf"));
  redirect(`/acompanhar?p=${encodeURIComponent(protocolo)}&c=${encodeURIComponent(cpf)}`);
}
