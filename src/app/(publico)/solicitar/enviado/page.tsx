import Link from "next/link";
import CabecaPublica from "@/components/CabecaPublica";

export default async function Enviado({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <div className="publico">
      <div className="caixa">
        <CabecaPublica titulo="Solicitação de empréstimo de equipamentos" />
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Solicitação enviada!</h2>
          <p>Anote o número do seu protocolo:</p>
          <div className="protocolo">{p}</div>
          <p className="sub">
            Vamos analisar seu cadastro e a disponibilidade dos equipamentos e entraremos em contato.
            Você pode acompanhar a qualquer momento com o protocolo e seu CPF.
          </p>
          <div className="acoes" style={{ justifyContent: "center", marginTop: 16 }}>
            <Link className="btn" href={`/acompanhar?p=${p ?? ""}`}>Acompanhar solicitação</Link>
            <Link className="btn sec" href="/solicitar">Nova solicitação</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
