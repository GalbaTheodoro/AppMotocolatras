"use client";

export default function GlobalError() {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40 }}>
        <h2>Ops, algo deu errado</h2>
        <p>Abra o <a href="/diagnostico">diagnóstico da instalação</a> para ver o que falta configurar.</p>
      </body>
    </html>
  );
}
