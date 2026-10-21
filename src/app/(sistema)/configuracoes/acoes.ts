"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { comMsg, txt } from "@/lib/formato";
import { enviarAviso, lerConfigAvisos } from "@/lib/notificar";
import { testarIA, PROVEDORES } from "@/lib/ia";

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

// ===== Avisos (WhatsApp / Telegram) =====

export async function salvarAvisos(fd: FormData) {
  await exigirAdmin();
  const pares: [string, string][] = [
    ["aviso_whatsapp", txt(fd, "aviso_whatsapp") ?? ""],
    ["aviso_textmebot_key", txt(fd, "aviso_textmebot_key") ?? ""],
    ["aviso_textmebot_numeros", txt(fd, "aviso_textmebot_numeros") ?? ""],
    ["aviso_telegram_token", txt(fd, "aviso_telegram_token") ?? ""],
    ["aviso_telegram_chats", txt(fd, "aviso_telegram_chats") ?? ""],
  ];
  for (const [k, v] of pares) {
    await query(
      "INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor", [k, v]);
  }
  redirect(comMsg("/configuracoes", "ok", "Avisos salvos. Use “Enviar mensagem de teste” para conferir."));
}

export async function testarAvisos() {
  await exigirAdmin();
  const r = await enviarAviso("✅ Teste do sistema Motocólatras: os avisos de novas solicitações estão funcionando.");
  if (r.ok === 0 && r.falhas.length === 0) {
    redirect(comMsg("/configuracoes", "erro", "Nenhum destino configurado ainda. Preencha WhatsApp ou Telegram e salve."));
  }
  if (r.falhas.length) {
    redirect(comMsg("/configuracoes", "erro", `Enviado para ${r.ok}. Falhou: ${r.falhas.join(" · ")}`));
  }
  redirect(comMsg("/configuracoes", "ok", `Mensagem de teste enviada para ${r.ok} destino(s). Confira o celular.`));
}

/** Lista as conversas que falaram com o bot do Telegram, para descobrir o "chat id" */
export async function descobrirChatsTelegram() {
  await exigirAdmin();
  const cfg = await lerConfigAvisos();
  if (!cfg.telegramToken) redirect(comMsg("/configuracoes", "erro", "Salve primeiro o token do bot do Telegram"));
  try {
    const r = await fetch(`https://api.telegram.org/bot${cfg.telegramToken}/getUpdates`, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) redirect(comMsg("/configuracoes", "erro", `Telegram: ${j.description ?? "token inválido"}`));
    const chats = new Map<string, string>();
    for (const u of j.result ?? []) {
      const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
      if (c) chats.set(String(c.id), c.title ?? [c.first_name, c.last_name].filter(Boolean).join(" ") ?? c.username ?? "");
    }
    if (chats.size === 0) {
      redirect(comMsg("/configuracoes", "erro", "Nenhuma conversa encontrada. Mande um “oi” para o bot no Telegram (ou adicione-o ao grupo e mande uma mensagem) e tente de novo."));
    }
    const lista = [...chats].map(([id, nome]) => `${nome || "conversa"}: ${id}`).join(" · ");
    redirect(comMsg("/configuracoes", "ok", `Chats encontrados — copie o número para o campo “Chat ID”: ${lista}`));
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(comMsg("/configuracoes", "erro", "Não foi possível falar com o Telegram agora"));
  }
}

// ===== Inteligência artificial nas atas (Gemini grátis ou Grok) =====

async function gravar(chave: string, valor: string) {
  await query("INSERT INTO configuracoes (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor", [chave, valor]);
}

export async function salvarIA(fd: FormData) {
  await exigirAdmin();
  const volta = (tipo: "ok" | "erro", m: string) => redirect(comMsg("/configuracoes", tipo, m) + "#ia");
  const remover = txt(fd, "remover");
  if (remover === "gemini" || remover === "grok") {
    await query("DELETE FROM configuracoes WHERE chave=$1", [remover === "gemini" ? "gemini_api_key" : "xai_api_key"]);
    volta("ok", "Chave removida");
  }
  const provedor = fd.get("ia_provedor") === "grok" ? "grok" : "gemini";
  await gravar("ia_provedor", provedor);
  const gk = txt(fd, "gemini_api_key"); if (gk) await gravar("gemini_api_key", gk);
  const xk = txt(fd, "xai_api_key"); if (xk) await gravar("xai_api_key", xk);
  await gravar("gemini_modelo", txt(fd, "gemini_modelo") ?? PROVEDORES.gemini.modelo);
  await gravar("xai_modelo", txt(fd, "xai_modelo") ?? PROVEDORES.grok.modelo);
  let msg = "";
  try {
    msg = await testarIA();
  } catch (e) {
    volta("erro", `Salvo, mas o teste do ${PROVEDORES[provedor].nome} falhou: ${(e as Error).message}`);
  }
  volta("ok", `Salvo. Usando ${PROVEDORES[provedor].nome} · teste OK (respondeu "${msg}")`);
}
