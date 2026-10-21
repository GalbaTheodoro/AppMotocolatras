"use client";

import { useEffect, useRef, useState } from "react";
import { anexarTextoAoVivo, salvarTranscricao, gerarResumo, aplicarResumo } from "@/app/(membros)/reunioes/acoes";

type Resumo = { relato: string; decisoes: string[]; tarefas: { titulo: string; responsavel: string | null; prazo: string | null }[] };
type Parte = { n: number; url: string; tam: number; estado: "enviando" | "ok" | "erro"; msg?: string };

const SEGMENTO_MS = 8 * 60 * 1000; // cada trecho gravado tem até 8 min (~2 MB) para caber no envio
const MAX_ARQUIVO = 4_300_000;

function tipoAudio() {
  const tipos = ["audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
  return tipos.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}
const extensao = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Gravação / transcrição da reunião e resumo automático com IA (Gemini ou Grok) */
export default function GravadorAta({ eventoId, transcricaoInicial, ia }: { eventoId: number; transcricaoInicial: string; ia: string | null }) {
  const grokOk = !!ia;
  const [transcricao, setTranscricao] = useState(transcricaoInicial);
  const [alterada, setAlterada] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; txt: string } | null>(null);

  // --- ao vivo (reconhecimento de fala do navegador) ---
  const [aoVivo, setAoVivo] = useState(false);
  const [parcial, setParcial] = useState("");
  const recRef = useRef<{ stop: () => void; start: () => void; onend: (() => void) | null } | null>(null);
  const ativoRef = useRef(false);
  const bufRef = useRef("");
  const [suportaFala, setSuportaFala] = useState(true);

  // --- gravação de áudio ---
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [partes, setPartes] = useState<Parte[]>([]);
  const mediaRef = useRef<{ rec: MediaRecorder | null; stream: MediaStream | null; timer: ReturnType<typeof setTimeout> | null; n: number; parar: boolean }>(
    { rec: null, stream: null, timer: null, n: 0, parar: false });
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  // --- resumo ---
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [usarDec, setUsarDec] = useState<boolean[]>([]);
  const [usarTar, setUsarTar] = useState<boolean[]>([]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSuportaFala(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [gravando]);

  // Avisa antes de fechar a página com gravação em andamento
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (gravando || aoVivo) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [gravando, aoVivo]);

  async function manterTelaLigada(ligar: boolean) {
    try {
      if (ligar && "wakeLock" in navigator) {
        wakeRef.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      } else if (!ligar) { await wakeRef.current?.release(); wakeRef.current = null; }
    } catch { /* sem suporte */ }
  }

  function acrescentar(origem: string, texto: string) {
    if (!texto.trim()) return;
    setTranscricao((t) => (t ? `${t}\n\n` : "") + `[${origem}] ${texto.trim()}`);
  }

  // ===== Ao vivo =====
  async function enviarBuffer() {
    const txt = bufRef.current.trim();
    if (!txt) return;
    bufRef.current = "";
    const r = await anexarTextoAoVivo(eventoId, txt).catch(() => ({ erro: "sem conexão" }));
    if ("erro" in r && r.erro) { bufRef.current = txt + " " + bufRef.current; setAviso({ tipo: "erro", txt: `Não salvou o trecho ao vivo: ${r.erro}. Tentando de novo…` }); }
  }

  function iniciarAoVivo() {
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setAviso({ tipo: "erro", txt: "Este navegador não transcreve ao vivo. Use o Chrome, ou grave o áudio." }); return; }
    const rec = new SR() as {
      lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void;
      onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null;
      onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
    };
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const frase = r[0].transcript.trim();
          if (frase) { bufRef.current += (bufRef.current ? " " : "") + frase; acrescentarAoVivoLocal(frase); }
        } else tmp += r[0].transcript;
      }
      setParcial(tmp);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        ativoRef.current = false; setAoVivo(false);
        setAviso({ tipo: "erro", txt: "Permita o uso do microfone para transcrever." });
      }
    };
    // O navegador para sozinho depois de silêncio: religa enquanto estiver ativo
    rec.onend = () => { if (ativoRef.current) { try { rec.start(); } catch { /* já iniciado */ } } };
    recRef.current = rec;
    ativoRef.current = true;
    try { rec.start(); } catch { /* */ }
    setAoVivo(true); setAviso(null);
    manterTelaLigada(true);
  }

  // Mostra o texto ao vivo num bloco único (sem repetir a etiqueta a cada frase)
  const blocoAoVivo = useRef(false);
  function acrescentarAoVivoLocal(frase: string) {
    setTranscricao((t) => {
      if (blocoAoVivo.current) return `${t} ${frase}`;
      blocoAoVivo.current = true;
      return (t ? `${t}\n\n` : "") + `[Ao vivo] ${frase}`;
    });
  }

  async function pararAoVivo() {
    ativoRef.current = false;
    recRef.current?.stop();
    setAoVivo(false); setParcial(""); blocoAoVivo.current = false;
    await enviarBuffer();
    manterTelaLigada(false);
    setAviso({ tipo: "ok", txt: "Transcrição ao vivo salva." });
  }

  useEffect(() => {
    if (!aoVivo) return;
    const t = setInterval(() => { enviarBuffer(); }, 20000); // salva a cada 20 s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoVivo]);

  // ===== Gravação em trechos =====
  function enviarAudio(blob: Blob, nome: string, origem: string, n: number) {
    const url = URL.createObjectURL(blob);
    setPartes((p) => [...p, { n, url, tam: blob.size, estado: "enviando" }]);
    filaRef.current = filaRef.current.then(async () => {
      const fd = new FormData();
      fd.append("origem", origem);
      fd.append("audio", blob, nome);
      try {
        const r = await fetch(`/api/reunioes/${eventoId}/audio`, { method: "POST", body: fd });
        const j = await r.json().catch(() => ({ erro: `Erro ${r.status}` }));
        if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
        acrescentar(origem, j.texto || "(sem fala reconhecida)");
        setPartes((p) => p.map((x) => (x.n === n ? { ...x, estado: "ok" } : x)));
      } catch (e) {
        setPartes((p) => p.map((x) => (x.n === n ? { ...x, estado: "erro", msg: (e as Error).message } : x)));
      }
    });
  }

  function novoTrecho() {
    const m = mediaRef.current;
    if (!m.stream) return;
    const mime = tipoAudio();
    const rec = new MediaRecorder(m.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    const pedacos: Blob[] = [];
    const n = ++m.n;
    rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
    rec.onstop = () => {
      const tipo = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(pedacos, { type: tipo });
      if (blob.size > 1000) enviarAudio(blob, `reuniao-${eventoId}-parte${n}.${extensao(tipo)}`, `Gravação parte ${n}`, n);
      if (!m.parar) novoTrecho();
      else { m.stream?.getTracks().forEach((t) => t.stop()); m.stream = null; }
    };
    rec.start(1000);
    m.rec = rec;
    m.timer = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, SEGMENTO_MS);
  }

  async function iniciarGravacao() {
    if (!grokOk) { setAviso({ tipo: "erro", txt: "Para transcrever o áudio, configure a inteligência artificial em Configurações." }); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      mediaRef.current = { rec: null, stream, timer: null, n: mediaRef.current.n, parar: false };
      novoTrecho();
      setGravando(true); setSegundos(0); setAviso(null);
      manterTelaLigada(true);
    } catch {
      setAviso({ tipo: "erro", txt: "Não foi possível usar o microfone. Verifique a permissão do navegador." });
    }
  }

  function pararGravacao() {
    const m = mediaRef.current;
    m.parar = true;
    if (m.timer) clearTimeout(m.timer);
    if (m.rec?.state === "recording") m.rec.stop();
    setGravando(false);
    manterTelaLigada(false);
  }

  async function enviarArquivo(f: File | undefined) {
    if (!f) return;
    if (!grokOk) { setAviso({ tipo: "erro", txt: "Configure a inteligência artificial em Configurações para transcrever arquivos." }); return; }
    if (f.size > MAX_ARQUIVO) { setAviso({ tipo: "erro", txt: "Arquivo acima de 4 MB. Use o gravador do sistema (ele divide em partes) ou envie áudios menores." }); return; }
    const n = ++mediaRef.current.n;
    enviarAudio(f, f.name, `Arquivo ${f.name}`.slice(0, 60), n);
  }

  // ===== Transcrição e resumo =====
  async function guardarTranscricao() {
    const r = await salvarTranscricao(eventoId, transcricao);
    if (r.erro) setAviso({ tipo: "erro", txt: r.erro });
    else { setAlterada(false); setAviso({ tipo: "ok", txt: "Transcrição salva." }); }
  }

  async function resumir() {
    setGerando(true); setAviso(null);
    if (alterada) await salvarTranscricao(eventoId, transcricao);
    await filaRef.current; // espera os trechos que ainda estão sendo enviados
    const r = await gerarResumo(eventoId).catch((e) => ({ erro: (e as Error).message, resumo: undefined }));
    setGerando(false);
    if (r.erro || !r.resumo) { setAviso({ tipo: "erro", txt: r.erro ?? "Não foi possível gerar o resumo" }); return; }
    setResumo(r.resumo);
    setUsarDec(r.resumo.decisoes.map(() => true));
    setUsarTar(r.resumo.tarefas.map(() => true));
    setTimeout(() => document.getElementById("revisar-resumo")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const enviando = partes.some((p) => p.estado === "enviando");

  return (
    <div className="gravador">
      <div className="gravador-botoes">
        {!aoVivo ? (
          <button type="button" className="btn sec" onClick={iniciarAoVivo} disabled={gravando || !suportaFala}
            title={suportaFala ? "" : "Disponível no Chrome"}>🎙️ Transcrever ao vivo</button>
        ) : (
          <button type="button" className="btn perigo" onClick={pararAoVivo}>⏹ Parar transcrição</button>
        )}
        {!gravando ? (
          <button type="button" className="btn sec" onClick={iniciarGravacao} disabled={aoVivo}>⏺ Gravar áudio</button>
        ) : (
          <button type="button" className="btn perigo" onClick={pararGravacao}>⏹ Parar gravação · {mmss(segundos)}</button>
        )}
        <label className="btn sec" style={{ cursor: "pointer" }}>
          📁 Enviar arquivo de áudio
          <input type="file" accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.webm" hidden onChange={(e) => { enviarArquivo(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
      </div>
      <p className="sub" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
        <b>Ao vivo</b>: o Chrome escreve enquanto as pessoas falam (grátis). <b>Gravar áudio</b>: grava em partes de 8 min e a IA ({ia ?? "não configurada"}) transcreve cada parte
        (melhor qualidade). Deixe o aparelho perto de quem fala e com a tela ligada.
      </p>

      {aoVivo && <div className="gravando">● Transcrevendo… <span className="sub">{parcial}</span></div>}
      {gravando && <div className="gravando">● Gravando {mmss(segundos)} — parte {mediaRef.current.n}</div>}
      {aviso && <div className={`msg ${aviso.tipo}`} style={{ marginTop: 8 }}>{aviso.txt}</div>}

      {partes.length > 0 && (
        <ul className="partes">
          {partes.map((p) => (
            <li key={p.n}>
              Parte {p.n} · {(p.tam / 1_048_576).toFixed(1)} MB ·{" "}
              {p.estado === "enviando" ? "transcrevendo…" : p.estado === "ok" ? "✔ transcrita" : <span style={{ color: "var(--err)" }}>erro: {p.msg}</span>}
              {" · "}<a href={p.url} download={`reuniao-${eventoId}-parte${p.n}`}>baixar áudio</a>
            </li>
          ))}
        </ul>
      )}

      <label style={{ marginTop: 10, display: "grid", gap: 4 }}>Transcrição (pode corrigir)
        <textarea value={transcricao} onChange={(e) => { setTranscricao(e.target.value); setAlterada(true); }}
          style={{ minHeight: 160, fontSize: ".88rem", width: "100%" }} placeholder="O texto da reunião aparece aqui." />
      </label>
      <div className="acoes" style={{ marginTop: 6 }}>
        <button type="button" className="btn sec peq" onClick={guardarTranscricao} disabled={!alterada}>Salvar transcrição</button>
        <button type="button" className="btn" onClick={resumir} disabled={gerando || !grokOk || transcricao.trim().length < 40 || aoVivo}>
          {gerando ? "Gerando resumo…" : enviando ? "✨ Gerar resumo (aguardando partes)" : `✨ Gerar resumo com ${ia ?? "IA"}`}
        </button>
        {!grokOk && <span className="sub" style={{ fontSize: ".8rem" }}>Configure a inteligência artificial em Configurações.</span>}
      </div>

      {resumo && (
        <form id="revisar-resumo" action={aplicarResumo} className="revisar-resumo">
          <input type="hidden" name="evento_id" value={eventoId} />
          <h3>✨ Resumo sugerido — revise antes de aplicar</h3>
          <label style={{ display: "grid", gap: 4 }}>Relato da ata
            <textarea name="relato" defaultValue={resumo.relato} style={{ minHeight: 220, width: "100%" }} />
          </label>
          {resumo.decisoes.length > 0 && (
            <>
              <b>Decisões</b>
              {resumo.decisoes.map((d, i) => (
                <div key={i} className="sugestao">
                  <input type="checkbox" checked={usarDec[i]} onChange={(e) => setUsarDec((u) => u.map((x, k) => (k === i ? e.target.checked : x)))} />
                  <input name={usarDec[i] ? "decisao" : undefined} value={d}
                    onChange={(e) => setResumo((r) => r && { ...r, decisoes: r.decisoes.map((x, k) => (k === i ? e.target.value : x)) })} />
                </div>
              ))}
            </>
          )}
          {resumo.tarefas.length > 0 && (
            <>
              <b>Tarefas</b>
              {resumo.tarefas.map((t, i) => (
                <div key={i} className="sugestao tarefa-sug">
                  <input type="checkbox" checked={usarTar[i]} onChange={(e) => setUsarTar((u) => u.map((x, k) => (k === i ? e.target.checked : x)))} />
                  <input value={t.titulo} placeholder="Tarefa"
                    onChange={(e) => setResumo((r) => r && { ...r, tarefas: r.tarefas.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)) })} />
                  <input value={t.responsavel ?? ""} placeholder="Responsável"
                    onChange={(e) => setResumo((r) => r && { ...r, tarefas: r.tarefas.map((x, k) => (k === i ? { ...x, responsavel: e.target.value || null } : x)) })} />
                  <input type="date" value={t.prazo ?? ""}
                    onChange={(e) => setResumo((r) => r && { ...r, tarefas: r.tarefas.map((x, k) => (k === i ? { ...x, prazo: e.target.value || null } : x)) })} />
                  {usarTar[i] && <input type="hidden" name="tarefa" value={JSON.stringify(t)} />}
                </div>
              ))}
            </>
          )}
          <p className="sub" style={{ fontSize: ".8rem" }}>
            O relato substitui o texto atual da ata (que continua como rascunho para você editar). As decisões e tarefas marcadas são acrescentadas.
          </p>
          <div className="acoes">
            <button className="btn" type="submit">Aplicar na ata</button>
            <button className="btn sec" type="button" onClick={() => setResumo(null)}>Descartar</button>
          </div>
        </form>
      )}
    </div>
  );
}
