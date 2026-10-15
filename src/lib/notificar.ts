import { headers } from "next/headers";
import { query } from "./db";

/**
 * Avisos gratuitos para a equipe:
 *  - WhatsApp pelo CallMeBot (cada pessoa ativa o próprio número e recebe uma "apikey")
 *  - Telegram por um bot próprio (token do @BotFather + chat id de cada pessoa ou grupo)
 * Configurado em Configurações > Avisos. Falhas nunca impedem a solicitação de ser salva.
 */

type ConfigAvisos = {
  whatsapp: { telefone: string; apikey: string }[];
  textmebotKey: string;
  textmebotNumeros: string[];
  telegramToken: string;
  telegramChats: string[];
};

/** Só dígitos; se vier sem o 55 (DDD + número, 10 ou 11 dígitos), acrescenta o código do Brasil */
function comDDI(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? "55" + d : d;
}

export async function lerConfigAvisos(): Promise<ConfigAvisos> {
  const rows = await query<{ chave: string; valor: string }>(
    "SELECT chave, valor FROM configuracoes WHERE chave IN ('aviso_whatsapp','aviso_telegram_token','aviso_telegram_chats','aviso_textmebot_key','aviso_textmebot_numeros')");
  const m = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  const whatsapp = (m.aviso_whatsapp ?? "")
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean)
    .map((l: string) => {
      // "telefone | apikey" — o telefone pode ter espaços, parênteses e traços
      const m = l.match(/^(.*?)\s*[|;]\s*(\S+)\s*$/) ?? l.match(/^(.*)[\s,]+(\S+)\s*$/);
      return { telefone: comDDI(m?.[1] ?? ""), apikey: (m?.[2] ?? "").trim() };
    })
    .filter((w: { telefone: string; apikey: string }) => w.telefone && w.apikey);
  const telegramChats = (m.aviso_telegram_chats ?? "").split(/[\n,;\s]+/).map((s: string) => s.trim()).filter(Boolean);
  const textmebotNumeros = (m.aviso_textmebot_numeros ?? "").split(/[\n,;]+/).map(comDDI).filter(Boolean);
  return {
    whatsapp, textmebotKey: (m.aviso_textmebot_key ?? "").trim(), textmebotNumeros,
    telegramToken: (m.aviso_telegram_token ?? "").trim(), telegramChats,
  };
}

async function comTempo<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

/** Endereço do site (para colocar link na mensagem) */
export async function urlDoSite() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    return host ? `${proto}://${host}` : "";
  } catch {
    return "";
  }
}

/** Envia o texto para todos os destinos configurados. Retorna um resumo (usado no botão de teste). */
export async function enviarAviso(texto: string): Promise<{ ok: number; falhas: string[] }> {
  let cfg: ConfigAvisos;
  try {
    cfg = await lerConfigAvisos();
  } catch {
    return { ok: 0, falhas: ["não foi possível ler as configurações"] };
  }
  const tarefas: Promise<string | null>[] = [];

  for (const w of cfg.whatsapp) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${w.telefone}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(w.apikey)}`;
    tarefas.push(
      comTempo(fetch(url, { cache: "no-store" }))
        .then(async (r) => {
          const corpo = await r.text().catch(() => "");
          return r.ok && !/error|invalid|not/i.test(corpo.slice(0, 300)) ? null : `WhatsApp ${w.telefone}: ${corpo.replace(/<[^>]+>/g, " ").trim().slice(0, 120) || r.status}`;
        })
        .catch((e) => `WhatsApp ${w.telefone}: ${e.message}`)
    );
  }
  // WhatsApp pelo TextMeBot (pago, baixo custo): uma apikey da conta, vários números
  if (cfg.textmebotKey) {
    for (const numero of cfg.textmebotNumeros) {
      const url = `https://api.textmebot.com/send.php?recipient=%2B${numero}&apikey=${encodeURIComponent(cfg.textmebotKey)}&text=${encodeURIComponent(texto)}`;
      tarefas.push(
        comTempo(fetch(url, { cache: "no-store" }), 10000)
          .then(async (r) => {
            const corpo = await r.text().catch(() => "");
            return r.ok && !/error|invalid|not /i.test(corpo.slice(0, 300)) ? null : `WhatsApp ${numero}: ${corpo.replace(/<[^>]+>/g, " ").trim().slice(0, 120) || r.status}`;
          })
          .catch((e) => `WhatsApp ${numero}: ${e.message}`)
      );
    }
  }
  if (cfg.telegramToken) {
    for (const chat of cfg.telegramChats) {
      tarefas.push(
        comTempo(fetch(`https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
          cache: "no-store",
        }))
          .then(async (r) => (r.ok ? null : `Telegram ${chat}: ${(await r.json().catch(() => ({}))).description ?? r.status}`))
          .catch((e) => `Telegram ${chat}: ${e.message}`)
      );
    }
  }
  const res = await Promise.all(tarefas);
  const falhas = res.filter((x): x is string => !!x);
  if (falhas.length) console.error("Falha ao enviar aviso:", falhas);
  return { ok: res.length - falhas.length, falhas };
}
