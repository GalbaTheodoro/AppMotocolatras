import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motocólatras – Controle de Empréstimos",
  description: "Cadastro de equipamentos, pessoas, empréstimos e mensalidades",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
