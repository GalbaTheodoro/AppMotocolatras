"use server";

import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { query, queryOne, transacao } from "@/lib/db";
import { txt, comMsg, soDigitos, cpfValido, formatarCPF } from "@/lib/formato";
import { enviarAviso, urlDoSite } from "@/lib/notificar";
import { enviarPush } from "@/lib/push";
import { TIPOS_ARQUIVO, MAX_ARQUIVO, MAX_TOTAL, detectarMime, type TipoArquivo } from "@/lib/arquivos";

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

  // Documentos obrigatórios
  const arquivos: { tipo: TipoArquivo; nome: string; mime: string; dados: Buffer }[] = [];
  let total = 0;
  for (const tipo of Object.keys(TIPOS_ARQUIVO) as TipoArquivo[]) {
    const f = fd.get(`arq_${tipo}`);
    const rotulo = TIPOS_ARQUIVO[tipo];
    if (!(f instanceof File) || f.size === 0) redirect(comMsg(volta, "erro", `Envie: ${rotulo}`));
    if (f.size > MAX_ARQUIVO) redirect(comMsg(volta, "erro", `${rotulo}: arquivo muito grande (máx. 2,5 MB)`));
    const dados = Buffer.from(await f.arrayBuffer());
    const mime = detectarMime(dados);
    if (!mime || (tipo === "rosto" && mime === "application/pdf")) {
      redirect(comMsg(volta, "erro", `${rotulo}: formato não aceito. Envie ${tipo === "rosto" ? "uma foto" : "foto ou PDF"}.`));
    }
    total += f.size;
    arquivos.push({ tipo, nome: f.name.slice(0, 120), mime, dados });
  }
  if (total > MAX_TOTAL) redirect(comMsg(volta, "erro", "Os arquivos juntos passaram de 4 MB. Envie fotos em vez de PDFs grandes."));

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

      // Cadastro em Pessoas: usa a pessoa com o mesmo CPF (atualizando os contatos) ou cria uma nova
      const [existente] = await q<{ id: number }>(
        "SELECT id FROM pessoas WHERE regexp_replace(coalesce(cpf,''),'\\D','','g') = $1 ORDER BY id LIMIT 1", [cpf]);
      let pessoaId: number;
      if (existente) {
        pessoaId = existente.id;
        await q(
          `UPDATE pessoas SET telefone = coalesce($2, telefone), email = coalesce($3, email), endereco = coalesce($4, endereco)
            WHERE id = $1`, [pessoaId, telefone, email?.toLowerCase() ?? null, endereco]);
      } else {
        [{ id: pessoaId }] = await q<{ id: number }>(
          "INSERT INTO pessoas (nome, cpf, telefone, email, endereco, observacoes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
          [nome, formatarCPF(cpf), telefone, email?.toLowerCase() ?? null, endereco, `Cadastro via solicitação ${p}`]);
      }
      await q("UPDATE solicitacoes SET pessoa_id=$1 WHERE id=$2", [pessoaId, s.id]);
      for (const a of arquivos) {
        await q(
          "INSERT INTO arquivos (solicitacao_id, pessoa_id, tipo, nome, mime, tamanho, dados) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [s.id, pessoaId, a.tipo, a.nome, a.mime, a.dados.length, a.dados]);
      }
      for (const i of itensOk) {
        await q("INSERT INTO solicitacao_itens (solicitacao_id, equipamento_id, quantidade) VALUES ($1,$2,$3)", [s.id, i.id, i.qtd]);
      }
      return p;
    }
    throw new Error("Não foi possível gerar o protocolo");
  });
  // Aviso para a equipe (WhatsApp/Telegram). Se falhar, a solicitação continua salva.
  try {
    const info = await queryOne<{ id: number; itens: string }>(
      `SELECT s.id, string_agg(q.nome || ' × ' || i.quantidade, ', ' ORDER BY q.nome) itens
         FROM solicitacoes s JOIN solicitacao_itens i ON i.solicitacao_id=s.id JOIN equipamentos q ON q.id=i.equipamento_id
        WHERE s.protocolo=$1 GROUP BY s.id`, [protocolo]);
    const site = await urlDoSite();
    await Promise.all([
      enviarPush({
        titulo: "🏍️ Nova solicitação de empréstimo",
        corpo: `${nome} · ${info?.itens ?? ""}`.slice(0, 180),
        url: info ? `/solicitacoes/${info.id}` : "/solicitacoes",
        tag: `solic-${protocolo}`,
      }).catch((e) => console.error("Push não enviado:", e)),
      enviarAviso(
      `🏍️ Nova solicitação de empréstimo\n` +
      `Protocolo: ${protocolo}\n` +
      `Nome: ${nome}\n` +
      `Telefone: ${telefone}\n` +
      `Itens: ${info?.itens ?? "-"}` +
      (site && info ? `\n\nAnalisar: ${site}/solicitacoes/${info.id}` : "")
      ),
    ]);
  } catch (e) {
    console.error("Aviso de nova solicitação não enviado:", e);
  }
  redirect(`/solicitar/enviado?p=${protocolo}`);
}

export async function consultarSolicitacao(fd: FormData) {
  const protocolo = (txt(fd, "protocolo") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cpf = soDigitos(txt(fd, "cpf"));
  if (!protocolo && !cpf) redirect("/acompanhar?erro=" + encodeURIComponent("Informe o protocolo, o CPF ou os dois"));
  if (cpf && !cpfValido(cpf)) redirect("/acompanhar?erro=" + encodeURIComponent("CPF inválido. Confira os números."));
  const q = new URLSearchParams();
  if (protocolo) q.set("p", protocolo);
  if (cpf) q.set("c", cpf);
  redirect(`/acompanhar?${q.toString()}`);
}
