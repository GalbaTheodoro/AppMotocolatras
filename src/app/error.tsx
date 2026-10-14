"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="auth">
      <div className="card">
        <h2>Ops, algo deu errado</h2>
        <p className="sub">Não foi possível carregar esta página.</p>
        <p>
          Se o sistema acabou de ser publicado, abra o <a href="/diagnostico">diagnóstico da instalação</a> para ver o que falta configurar.
        </p>
        <div className="acoes">
          <button className="btn" onClick={() => reset()}>Tentar de novo</button>
          <a className="btn sec" href="/diagnostico">Diagnóstico</a>
        </div>
      </div>
    </div>
  );
}
