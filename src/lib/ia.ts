import { query, queryOne } from "./db";

/**
 * Inteligência artificial das atas de reunião.
 * Provedores:
 *  - "gemini" (padrão, tem plano GRATUITO): Google AI Studio → https://aistudio.google.com/apikey
 *  - "grok" (pago, xAI): https://console.x.ai
 * O provedor e as chaves ficam em Configurações (ou nas variáveis GEMINI_API_KEY / XAI_API_KEY da Vercel).
 */
export type Provedor = "gemini" | "grok";
export const PROVEDORES: Record<Provedor, { nome: string; modelo: string }> = {
  gemini: { nome: "Google Gemini (grátis)", modelo: "gemini-3.6-flash" },
  grok: { nome: "Grok – xAI (pago)", modelo: "grok-4.3" },
};
const GEMINI_API = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const XAI_API = process.env.XAI_API_BASE || "https://api.x.ai/v1";

export async function configIA() {
  const rows = await query<{ chave: string; valor: string }>(
    "SELECT chave, valor FROM configuracoes WHERE chave IN ('ia_provedor','gemini_api_key','gemini_modelo','xai_api_key','xai_modelo')");
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  const provedor: Provedor = m.ia_provedor === "grok" ? "grok" : "gemini";
  const gemini = { chave: process.env.GEMINI_API_KEY || m.gemini_api_key || "", modelo: m.gemini_modelo || PROVEDORES.gemini.modelo, daVariavel: !!process.env.GEMINI_API_KEY };
  const grok = { chave: process.env.XAI_API_KEY || m.xai_api_key || "", modelo: m.xai_modelo || PROVEDORES.grok.modelo, daVariavel: !!process.env.XAI_API_KEY };
  const ativo = provedor === "grok" ? grok : gemini;
  return { provedor, nome: PROVEDORES[provedor].nome.split(" (")[0], chave: ativo.chave, modelo: ativo.modelo, gemini, grok };
}

export async function iaConfigurada() {
  const c = await configIA();
  return c.chave ? c.nome : null;
}

const SEM_CHAVE = "Configure a inteligência artificial em Configurações → Inteligência artificial nas atas.";

async function erroDaApi(r: Response, nome: string, etapa: string) {
  let detalhe = "";
  try {
    const j = await r.json();
    detalhe = j?.error?.message ?? j?.error ?? j?.message ?? JSON.stringify(j);
  } catch {
    detalhe = await r.text().catch(() => "");
  }
  if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(String(detalhe))) return `O Google recusou este tipo de chave (${etapa}). No AI Studio, abra a chave e marque "Restringir à Gemini API" (Restrict to Gemini API), ou crie outra chave e tente de novo.`;
  if (/unrestricted/i.test(String(detalhe))) return `O Google exige que a chave seja restrita à Gemini API (${etapa}). No AI Studio, abra a chave e escolha "Restrict to Gemini API only".`;
  if (r.status === 401 || r.status === 403 || /API key not valid/i.test(String(detalhe))) return `Chave do ${nome} inválida ou sem permissão (${etapa}): ${String(detalhe).slice(0, 160)}`;
  if (r.status === 429) return `Limite de uso do ${nome} atingido por agora. Espere alguns minutos e tente de novo (${etapa}).`;
  return `Erro do ${nome} em ${etapa} (${r.status}): ${String(detalhe).slice(0, 200)}`;
}

// ===== Gemini =====

type ParteGemini = { text: string } | { inline_data: { mime_type: string; data: string } };

async function gemini(partes: ParteGemini[], opcoes: { json?: boolean; sistema?: string; etapa: string }) {
  const c = await configIA();
  if (!c.gemini.chave) throw new Error(SEM_CHAVE);
  const r = await fetch(`${GEMINI_API}/models/${encodeURIComponent(c.gemini.modelo)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": c.gemini.chave, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(opcoes.sistema ? { system_instruction: { parts: [{ text: opcoes.sistema }] } } : {}),
      contents: [{ role: "user", parts: partes }],
      generationConfig: { temperature: 0.2, ...(opcoes.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!r.ok) throw new Error(await erroDaApi(r, "Gemini", opcoes.etapa));
  const j = await r.json();
  const cand = j?.candidates?.[0];
  const texto = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!texto && cand?.finishReason && cand.finishReason !== "STOP") throw new Error(`O Gemini não respondeu (${cand.finishReason}).`);
  return texto;
}

// ===== Grok =====

async function grokChat(mensagens: { role: string; content: string }[], json: boolean, etapa: string) {
  const c = await configIA();
  if (!c.grok.chave) throw new Error(SEM_CHAVE);
  const r = await fetch(`${XAI_API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.grok.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: c.grok.modelo, messages: mensagens, temperature: 0.2, ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!r.ok) throw new Error(await erroDaApi(r, "Grok", etapa));
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content ?? "");
}

// ===== Funções usadas pelo sistema =====

const TIPO_POR_EXT: Record<string, string> = {
  webm: "audio/webm", ogg: "audio/ogg", opus: "audio/ogg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac",
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac",
};

/** Transcreve um áudio (webm/ogg/mp4/m4a/mp3/wav…) em português, com o provedor escolhido */
export async function transcrever(arquivo: Blob, nome: string): Promise<{ texto: string; duracao: number }> {
  const c = await configIA();
  if (!c.chave) throw new Error(SEM_CHAVE);
  if (c.provedor === "grok") {
    const fd = new FormData();
    fd.append("language", "pt");
    fd.append("format", "true");
    fd.append("file", arquivo, nome); // o arquivo precisa ser o último campo
    const r = await fetch(`${XAI_API}/stt`, { method: "POST", headers: { Authorization: `Bearer ${c.chave}` }, body: fd });
    if (!r.ok) throw new Error(await erroDaApi(r, "Grok", "transcrição"));
    const j = (await r.json()) as { text?: string; duration?: number };
    return { texto: (j.text ?? "").trim(), duracao: Number(j.duration) || 0 };
  }
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  const mime = (arquivo.type || TIPO_POR_EXT[ext] || "audio/webm").split(";")[0];
  const dados = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  const texto = await gemini([
    { inline_data: { mime_type: mime, data: dados } },
    { text: "Transcreva este áudio de uma reunião de motoclube, em português do Brasil, palavra por palavra. " +
            "Não resuma nem comente. Quando der para perceber que mudou quem está falando, comece um novo parágrafo. " +
            "Se não houver fala, responda apenas: (sem fala)." },
  ], { etapa: "transcrição" });
  return { texto: texto.trim(), duracao: 0 };
}

export type ResumoReuniao = {
  relato: string;
  decisoes: string[];
  tarefas: { titulo: string; responsavel: string | null; prazo: string | null }[];
};

/** Gera relato, decisões e tarefas a partir da transcrição e da pauta */
export async function resumirReuniao(dados: {
  titulo: string; data: string; pauta: string[]; presentes: string[]; integrantes: string[]; transcricao: string; hoje: string;
}): Promise<ResumoReuniao> {
  const c = await configIA();
  if (!c.chave) throw new Error(SEM_CHAVE);
  const sistema =
    "Você é o secretário de um motoclube brasileiro e redige atas de reunião em português do Brasil, " +
    "em linguagem formal, clara e objetiva. Use apenas o que está na transcrição; não invente fatos, valores ou nomes. " +
    "Responda SOMENTE com um JSON válido no formato: " +
    '{"relato": "texto da ata organizado por assunto da pauta, em parágrafos", ' +
    '"decisoes": ["cada decisão tomada, uma por item"], ' +
    '"tarefas": [{"titulo": "o que precisa ser feito", "responsavel": "nome da pessoa ou null", "prazo": "AAAA-MM-DD ou null"}]}';
  const usuario = [
    `Reunião: ${dados.titulo} (${dados.data}). Hoje é ${dados.hoje}.`,
    dados.pauta.length ? `Pauta:\n${dados.pauta.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "Pauta: (não informada)",
    dados.presentes.length ? `Presentes: ${dados.presentes.join(", ")}` : "",
    `Integrantes do clube (use estes nomes para os responsáveis quando reconhecer): ${dados.integrantes.join(", ")}`,
    "No relato, organize por assunto da pauta (numerado), resuma as discussões e registre assuntos extras ao final em 'Assuntos gerais'.",
    "Nas tarefas, inclua apenas o que alguém ficou de fazer. Converta prazos como 'semana que vem' em data quando possível.",
    `\nTranscrição:\n"""\n${dados.transcricao.slice(0, 400_000)}\n"""`,
  ].filter(Boolean).join("\n\n");

  const bruto = c.provedor === "grok"
    ? await grokChat([{ role: "system", content: sistema }, { role: "user", content: usuario }], true, "resumo")
    : await gemini([{ text: usuario }], { json: true, sistema, etapa: "resumo" });
  const json = bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1);
  let j: Partial<ResumoReuniao>;
  try {
    j = JSON.parse(json);
  } catch {
    return { relato: bruto.trim(), decisoes: [], tarefas: [] };
  }
  const data = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    relato: String(j.relato ?? "").trim(),
    decisoes: (Array.isArray(j.decisoes) ? j.decisoes : []).map((d) => String(d).trim()).filter(Boolean),
    tarefas: (Array.isArray(j.tarefas) ? j.tarefas : [])
      .map((t) => ({ titulo: String(t?.titulo ?? "").trim(), responsavel: t?.responsavel ? String(t.responsavel).trim() : null, prazo: data(t?.prazo) }))
      .filter((t) => t.titulo),
  };
}

/** Teste rápido da chave do provedor escolhido (usado em Configurações) */
export async function testarIA() {
  const c = await configIA();
  const r = c.provedor === "grok"
    ? await grokChat([{ role: "user", content: "Responda apenas: OK" }], false, "teste")
    : await gemini([{ text: "Responda apenas: OK" }], { etapa: "teste" });
  return r.trim().slice(0, 40);
}

/** Acrescenta um trecho à transcrição guardada da reunião */
export async function anexarTranscricao(eventoId: number, texto: string, origem: string) {
  if (!texto.trim()) return;
  await queryOne(
    `INSERT INTO reuniao_ata (evento_id, transcricao) VALUES ($1, $2)
     ON CONFLICT (evento_id) DO UPDATE SET transcricao = concat_ws(E'\\n\\n', nullif(reuniao_ata.transcricao, ''), EXCLUDED.transcricao)`,
    [eventoId, `[${origem}] ${texto.trim()}`]);
}
