"use client";

import { useState } from "react";
import { emailDisponivel } from "@/lib/ficha-acoes";

/** E-mail e senha do novo cadastro: confere antes de enviar, para não perder o que já foi preenchido */
export default function AcessoCadastro() {
  const [aviso, setAviso] = useState("");
  return (
    <div className="f">
      <label>E-mail (será seu login) *
        <input
          name="email" type="email" required autoComplete="email"
          onChange={(e) => { e.currentTarget.setCustomValidity(""); setAviso(""); }}
          onBlur={async (e) => {
            const el = e.currentTarget;
            if (!el.value || !el.checkValidity()) return;
            const livre = await emailDisponivel(el.value).catch(() => true);
            const msg = livre ? "" : "Já existe um cadastro com este e-mail.";
            el.setCustomValidity(msg);
            setAviso(msg);
          }}
        />
        {aviso && <span style={{ color: "var(--err)", fontSize: ".8rem" }}>{aviso}</span>}
      </label>
      <label>Senha * <span className="sub" style={{ fontWeight: 400 }}>(mín. 6 caracteres)</span>
        <input
          name="senha" type="password" minLength={6} required autoComplete="new-password"
          onChange={(e) => {
            const c = e.currentTarget.form?.elements.namedItem("senha2") as HTMLInputElement | null;
            if (c?.value) c.setCustomValidity(c.value === e.currentTarget.value ? "" : "As senhas não conferem");
          }}
        />
      </label>
      <label>Repita a senha *
        <input
          name="senha2" type="password" minLength={6} required autoComplete="new-password"
          onChange={(e) => {
            const s = e.currentTarget.form?.elements.namedItem("senha") as HTMLInputElement | null;
            e.currentTarget.setCustomValidity(s && s.value !== e.currentTarget.value ? "As senhas não conferem" : "");
          }}
        />
      </label>
    </div>
  );
}
