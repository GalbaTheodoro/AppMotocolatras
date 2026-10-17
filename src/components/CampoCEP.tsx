"use client";

import { useState } from "react";

/** CEP que preenche endereço, bairro, cidade e UF automaticamente (ViaCEP, gratuito) */
export default function CampoCEP({ valor }: { valor: string | null }) {
  const [status, setStatus] = useState("");
  async function buscar(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setStatus("Buscando…");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) { setStatus("CEP não encontrado"); return; }
      const form = document.getElementById("form-ficha") as HTMLFormElement | null;
      const set = (n: string, v: string) => {
        const el = form?.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
        if (el && v && !el.value) el.value = v;
      };
      set("endereco", j.logradouro); set("bairro", j.bairro); set("cidade", j.localidade); set("uf", j.uf);
      setStatus("Endereço preenchido ✓");
      (form?.elements.namedItem("numero") as HTMLInputElement | null)?.focus();
    } catch {
      setStatus("");
    }
  }
  return (
    <label>CEP {status && <span className="sub" style={{ fontWeight: 400 }}>{status}</span>}
      <input name="cep" defaultValue={valor ?? ""} inputMode="numeric" placeholder="00000-000" onBlur={(e) => buscar(e.currentTarget.value)} />
    </label>
  );
}
