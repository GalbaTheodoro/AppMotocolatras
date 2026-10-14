"use client";

import { cpfValido, formatarCPF } from "@/lib/formato";

/** Confere o CPF antes de enviar, para a pessoa não perder o que já preencheu */
export default function CampoCPF() {
  return (
    <label>
      CPF *
      <input
        name="cpf"
        inputMode="numeric"
        placeholder="000.000.000-00"
        required
        onBlur={(e) => {
          const el = e.currentTarget;
          if (el.value && cpfValido(el.value)) el.value = formatarCPF(el.value);
        }}
        onInvalid={(e) => {
          if (e.currentTarget.value) e.currentTarget.setCustomValidity("CPF inválido. Confira os números.");
        }}
        pattern="\d{3}\.?\d{3}\.?\d{3}-?\d{2}"
        onChange={(e) => {
          const el = e.currentTarget;
          const d = el.value.replace(/\D/g, "");
          el.setCustomValidity(d.length === 11 && !cpfValido(d) ? "CPF inválido. Confira os números." : "");
        }}
      />
    </label>
  );
}
