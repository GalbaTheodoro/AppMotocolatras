import Link from "next/link";
import { query } from "@/lib/db";
import { lerConfig } from "@/lib/config";
import { moeda } from "@/lib/formato";
import Mensagem from "@/components/Mensagem";
import CabecaPublica from "@/components/CabecaPublica";
import CampoArquivo from "@/components/CampoArquivo";
import CampoCPF from "@/components/CampoCPF";
import { enviarSolicitacao } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Solicitar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const cfg = await lerConfig();
  const equipamentos = await query(
    "SELECT id, nome, categoria, descricao FROM equipamentos WHERE status IN ('disponivel','emprestado') ORDER BY categoria NULLS LAST, nome");
  return (
    <div className="publico">
      <div className="caixa">
        <CabecaPublica titulo="Solicitação de empréstimo de equipamentos" />
        <Mensagem sp={sp} />
        <form action={enviarSolicitacao}>
          <div className="card">
            <h2>Seus dados</h2>
            <div className="f" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <label>Nome completo *<input name="nome" required /></label>
              <CampoCPF />
              <label>Telefone / WhatsApp *<input name="telefone" inputMode="tel" placeholder="(34) 99999-9999" required /></label>
              <label>E-mail<input name="email" type="email" /></label>
              <label className="full" style={{ gridColumn: "1 / -1" }}>Endereço<input name="endereco" /></label>
            </div>
            <div className="hp" aria-hidden="true"><label>Site<input name="site" tabIndex={-1} autoComplete="off" /></label></div>
          </div>

          <div className="card">
            <h2>Documentos</h2>
            <p className="sub" style={{ marginBottom: 12 }}>
              Pode tirar foto pelo celular. As fotos são reduzidas automaticamente antes do envio.
            </p>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <CampoArquivo name="arq_documento" rotulo="Documento com foto" dica="RG ou CNH — foto ou PDF" />
              <CampoArquivo name="arq_rosto" rotulo="Foto do rosto" dica="Selfie com o rosto bem visível" somenteImagem camera="user" />
              <CampoArquivo name="arq_endereco" rotulo="Comprovante de endereço" dica="Conta de luz, água, etc. — foto ou PDF" />
            </div>
            <p className="sub" style={{ fontSize: ".8rem", marginTop: 12, marginBottom: 0 }}>
              Seus documentos são usados apenas para análise do cadastro pelo Motocólatras MC e ficam visíveis somente para a equipe.
            </p>
          </div>

          <div className="card">
            <h2>Equipamentos desejados</h2>
            <p className="sub" style={{ marginBottom: 12 }}>Informe a quantidade de cada item que você precisa. Deixe 0 nos que não quiser.</p>
            {equipamentos.length === 0 ? (
              <div className="vazio">Nenhum equipamento disponível para solicitação no momento.</div>
            ) : (
              <div className="itens">
                {equipamentos.map((e) => (
                  <div className="item" key={e.id}>
                    <div>
                      <div className="nome">{e.nome}</div>
                      <div className="desc">{[e.categoria, e.descricao].filter(Boolean).join(" · ")}</div>
                    </div>
                    <input type="number" name={`qtd_${e.id}`} min={0} max={50} step={1} defaultValue={0} aria-label={`Quantidade de ${e.nome}`} />
                  </div>
                ))}
              </div>
            )}
            <label style={{ marginTop: 14 }}>Observações<textarea name="observacoes" placeholder="Tamanho, para quando precisa, alguma informação importante…" /></label>
          </div>

          <div className="card">
            <p style={{ marginTop: 0 }}>
              <b>Como funciona:</b> sua solicitação será analisada pela equipe Motocólatras, que confere o cadastro e a disponibilidade.
              Se aprovada, os <b>{cfg.meses_gratis} primeiros meses são grátis</b>; depois, {moeda(cfg.valor_mensalidade)} por mês por unidade.
            </p>
            <button className="btn" type="submit" disabled={equipamentos.length === 0}>Enviar solicitação</button>
          </div>
        </form>
        <div className="rodape">
          Já fez uma solicitação? <Link href="/acompanhar">Acompanhe pelo protocolo</Link>
        </div>
      </div>
    </div>
  );
}
