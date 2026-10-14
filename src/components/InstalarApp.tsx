"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registra o service worker e mostra o botão "Instalar aplicativo"
 * quando o navegador permitir (Chrome/Edge/Android). No iPhone mostra as instruções.
 */
export default function InstalarApp({ variante = "claro" }: { variante?: "claro" | "escuro" }) {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ios, setIos] = useState(false);
  const [ajudaIos, setAjudaIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) { setInstalado(true); return; }
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const aoPoder = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalar); };
    const aoInstalar = () => { setInstalado(true); setEvento(null); };
    window.addEventListener("beforeinstallprompt", aoPoder);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoder);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;
  const classe = variante === "escuro" ? "instalar escuro" : "instalar";

  if (evento) {
    return (
      <button type="button" className={classe} onClick={async () => {
        await evento.prompt();
        const r = await evento.userChoice;
        if (r.outcome === "accepted") setInstalado(true);
        setEvento(null);
      }}>
        📲 Instalar aplicativo
      </button>
    );
  }
  if (ios) {
    return (
      <div>
        <button type="button" className={classe} onClick={() => setAjudaIos((v) => !v)}>📲 Instalar no iPhone</button>
        {ajudaIos && (
          <p className="ajuda-ios">
            No Safari, toque em <b>Compartilhar</b> (quadrado com seta ↑) e depois em <b>Adicionar à Tela de Início</b>.
          </p>
        )}
      </div>
    );
  }
  return null;
}
