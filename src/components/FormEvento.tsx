import { TIPOS_EVENTO, type Evento } from "@/lib/agenda";

/** Formulário de evento (criar ou editar). Server component: só HTML + server action. */
export default function FormEvento({
  acao, data, ev, botao,
}: { acao: (fd: FormData) => Promise<void>; data: string; ev?: Evento; botao: string }) {
  return (
    <form action={acao} className="f">
      {ev && <input type="hidden" name="id" value={ev.id} />}
      <label>Tipo
        <select name="tipo" defaultValue={ev?.tipo ?? "encontro"}>
          {Object.entries(TIPOS_EVENTO).map(([k, t]) => <option key={k} value={k}>{t.icone} {t.nome}</option>)}
        </select>
      </label>
      <label>Título *<input name="titulo" required defaultValue={ev?.titulo ?? ""} placeholder="Ex.: Reunião mensal, Rolê até a Serra" /></label>
      <label>Data<input name="data" type="date" required defaultValue={ev?.data ?? data} /></label>
      <label>Horário<input name="hora" type="time" defaultValue={ev?.hora ?? ""} /></label>
      <label>Local / ponto de encontro<input name="local" defaultValue={ev?.local ?? ""} placeholder="Deixe vazio se for na sede" /></label>
      <label>É na sede?
        <select name="na_sede" defaultValue={ev?.na_sede ? "sim" : "nao"}>
          <option value="nao">Não</option>
          <option value="sim">Sim — ocupa a sede neste dia</option>
        </select>
      </label>
      <label className="full">Detalhes<textarea name="descricao" defaultValue={ev?.descricao ?? ""} placeholder="Roteiro, o que levar, valor por pessoa…" /></label>
      <div className="full acoes"><button className="btn" type="submit">{botao}</button></div>
    </form>
  );
}
