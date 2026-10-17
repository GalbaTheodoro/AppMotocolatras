"use client";

import { useState } from "react";

/** Mostra um link de cadastro com botões para copiar e enviar pelo WhatsApp */
export default function LinkCadastro({ url, perfil }: { url: string; perfil: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Olá! Faça seu cadastro como ${perfil} no sistema do Motocólatras MC: ${url}`;
  return (
    <div className="acoes" style={{ flexWrap: "wrap", gap: 6 }}>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 260px", minWidth: 0, fontSize: ".85rem" }} />
      <button
        type="button" className="btn sec peq"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); } catch {
            const el = document.createElement("textarea"); el.value = url; document.body.appendChild(el); el.select();
            document.execCommand("copy"); el.remove();
          }
          setCopiado(true); setTimeout(() => setCopiado(false), 2000);
        }}
      >{copiado ? "✓ Copiado" : "Copiar"}</button>
      <a className="btn sec peq" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">WhatsApp</a>
    </div>
  );
}
