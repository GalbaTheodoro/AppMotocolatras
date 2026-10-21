"use client";

import { useEffect, useState } from "react";
import { salvarInscricaoPush, removerInscricaoPush, testarPush } from "@/lib/push-acoes";

function chaveParaBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
}

function nomeAparelho() {
  const ua = navigator.userAgent;
  const so = /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Outro";
  const nav = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : /firefox/i.test(ua) ? "Firefox" : "";
  return `${so} ${nav}`.trim();
}

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "bloqueado" | "desligado" | "ligado";

/** Botão para receber avisos no celular (convites, tarefas e, para o ADM, novas solicitações) */
export default function AtivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(ios && !instalado ? "ios-instalar" : "sem-suporte");
        return;
      }
      if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? "ligado" : "desligado");
    })().catch(() => setEstado("sem-suporte"));
  }, []);

  async function ligar() {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm === "denied" ? "bloqueado" : "desligado"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) });
      const r = await salvarInscricaoPush(JSON.parse(JSON.stringify(sub)), nomeAparelho());
      if (!r.ok) throw new Error();
      setEstado("ligado");
      const t = await testarPush();
      setMsg(t.enviados ? "Pronto! Você deve ter recebido uma notificação de teste." : "Ativado. Se a notificação de teste não chegar, confira as permissões do celular.");
    } catch {
      setMsg("Não foi possível ativar. Tente pelo aplicativo instalado ou outro navegador.");
    }
  }

  async function desligar() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removerInscricaoPush(sub.endpoint); await sub.unsubscribe(); }
    setEstado("desligado"); setMsg("");
  }

  async function testar() {
    const t = await testarPush();
    setMsg(t.enviados ? "Notificação de teste enviada." : "Nenhum aparelho ativo — ative de novo.");
  }

  if (estado === "carregando") return null;
  return (
    <div className="notif">
      {estado === "ligado" && (
        <>
          <div className="notif-ok">🔔 Avisos ligados neste aparelho</div>
          <div className="acoes">
            <button type="button" className="instalar escuro" style={{ marginTop: 6 }} onClick={testar}>Testar</button>
            <button type="button" className="instalar escuro" style={{ marginTop: 6 }} onClick={desligar}>Desligar</button>
          </div>
        </>
      )}
      {estado === "desligado" && (
        <button type="button" className="instalar escuro" onClick={ligar}>🔔 Receber avisos neste celular</button>
      )}
      {estado === "bloqueado" && (
        <div className="notif-info">🔕 Notificações bloqueadas. Libere em Configurações do navegador → Notificações deste site.</div>
      )}
      {estado === "ios-instalar" && (
        <div className="notif-info">🔔 No iPhone, primeiro instale o app (Compartilhar → Adicionar à Tela de Início) e abra por ele para ativar os avisos.</div>
      )}
      {estado === "sem-suporte" && <div className="notif-info">Este navegador não aceita notificações.</div>}
      {msg && <div className="notif-info">{msg}</div>}
    </div>
  );
}
