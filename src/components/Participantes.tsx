import { RESPOSTAS, type Convidado } from "@/lib/agenda";
import { responderConvite } from "@/app/(membros)/sede/acoes";
import Tag from "./Tag";

const TAG: Record<Convidado["resposta"], string> = { pendente: "pendente", sim: "pago", nao: "atrasado", talvez: "manutencao" };

/** Lista de participantes com a resposta de cada um + botões para o usuário logado responder */
export default function Participantes({
  eventoId, convidados, usuarioId, volta, passado = false,
}: { eventoId: number; convidados: Convidado[]; usuarioId: number; volta?: "reuniao"; passado?: boolean }) {
  const eu = convidados.find((c) => c.usuario_id === usuarioId);
  const conta = (r: Convidado["resposta"]) => convidados.filter((c) => c.resposta === r).length;
  return (
    <div className="participantes-lista">
      {convidados.length > 0 ? (
        <>
          <div className="sub" style={{ fontSize: ".82rem", marginBottom: 6 }}>
            {convidados.length} convidado(s) · ✅ {conta("sim")} vão · ❌ {conta("nao")} não vão · 🤔 {conta("talvez")} talvez · ⏳ {conta("pendente")} sem resposta
          </div>
          <div className="chips-participantes">
            {convidados.map((c) => (
              <span key={c.usuario_id} className={`part ${c.resposta}`}>{c.nome} <Tag tipo={TAG[c.resposta]}>{RESPOSTAS[c.resposta]}</Tag></span>
            ))}
          </div>
        </>
      ) : <div className="sub" style={{ fontSize: ".85rem" }}>Aberto a todos os integrantes (ninguém foi convidado especificamente).</div>}
      {!passado && (
        <form action={responderConvite} className="acoes resposta-convite">
          <input type="hidden" name="evento_id" value={eventoId} />
          {volta && <input type="hidden" name="volta" value={volta} />}
          <span className="sub" style={{ fontSize: ".85rem" }}>{eu ? (eu.resposta === "pendente" ? "Você foi convidado(a). Vai?" : `Sua resposta: ${RESPOSTAS[eu.resposta]}. Mudar:`) : "Vai participar?"}</span>
          <button className={`btn peq ${eu?.resposta === "sim" ? "" : "sec"}`} name="resposta" value="sim">✅ Vou</button>
          <button className={`btn peq ${eu?.resposta === "talvez" ? "" : "sec"}`} name="resposta" value="talvez">🤔 Talvez</button>
          <button className={`btn peq ${eu?.resposta === "nao" ? "" : "sec"}`} name="resposta" value="nao">❌ Não vou</button>
        </form>
      )}
    </div>
  );
}
