"use client";

import { useRef, useState } from "react";

const LIMITE_PDF = 2.5 * 1024 * 1024;

/** Reduz a foto no navegador (máx. 1600px, JPEG) para o envio ficar leve */
async function comprimir(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = url;
    });
    const max = 1600;
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) return file;
    const nome = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Campo de documento com dois botões:
 *  - "Tirar foto": abre a câmera do celular (frontal para selfie, traseira para documentos)
 *  - "Escolher arquivo": galeria / arquivos (foto ou PDF)
 * O arquivo final (já comprimido) vai no input "name" que é enviado no formulário.
 */
export default function CampoArquivo({
  name, rotulo, dica, somenteImagem = false, camera = "environment",
}: { name: string; rotulo: string; dica?: string; somenteImagem?: boolean; camera?: "user" | "environment" }) {
  const real = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);

  function definir(f: File | null) {
    const dt = new DataTransfer();
    if (f) dt.items.add(f);
    real.current!.files = dt.files;
    real.current!.setCustomValidity("");
  }

  async function aoEscolher(origem: HTMLInputElement) {
    const f = origem.files?.[0];
    origem.value = "";
    if (!f) return;
    setErro("");
    if (f.type === "application/pdf") {
      if (somenteImagem) { setErro("Aqui precisa ser uma foto (não PDF)."); return; }
      if (f.size > LIMITE_PDF) { setErro("PDF muito grande (máx. 2,5 MB). Tire uma foto do documento."); return; }
      definir(f); setPreview(null); setInfo(`PDF · ${f.name} · ${(f.size / 1024).toFixed(0)} KB`);
      return;
    }
    if (!f.type.startsWith("image/")) { setErro("Formato não aceito. Envie foto ou PDF."); return; }
    setProcessando(true);
    try {
      const menor = await comprimir(f);
      definir(menor);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(menor));
      setInfo(`Foto pronta · ${(menor.size / 1024).toFixed(0)} KB`);
    } catch {
      setErro("Não foi possível ler esta imagem. Tente tirar a foto novamente.");
    } finally {
      setProcessando(false);
    }
  }

  const temArquivo = !!info;
  return (
    <div className="campo-arquivo">
      <div className="rotulo">{rotulo} *</div>
      {dica && <div className="sub" style={{ fontSize: ".82rem" }}>{dica}</div>}

      {/* Entradas escondidas que abrem a câmera ou a galeria */}
      <input ref={cam} type="file" accept="image/*" capture={camera} hidden onChange={(e) => aoEscolher(e.currentTarget)} />
      <input ref={gal} type="file" accept={somenteImagem ? "image/*" : "image/*,application/pdf"} hidden onChange={(e) => aoEscolher(e.currentTarget)} />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="miniatura" />
      )}
      {info && <div className="ok-arquivo">✓ {info}</div>}

      <div className="botoes-arquivo">
        <button type="button" className="btn peq" onClick={() => cam.current?.click()} disabled={processando}>
          📷 {temArquivo ? "Tirar outra" : camera === "user" ? "Tirar selfie" : "Tirar foto"}
        </button>
        <button type="button" className="btn sec peq" onClick={() => gal.current?.click()} disabled={processando}>
          📁 {somenteImagem ? "Escolher foto" : "Escolher arquivo"}
        </button>
      </div>

      {processando && <div className="sub">Preparando a foto…</div>}
      {erro && <div style={{ color: "var(--err)", fontWeight: 500 }}>{erro}</div>}

      {/* Este é o campo enviado; fica invisível mas mantém a validação de "obrigatório" */}
      <input
        ref={real}
        type="file"
        name={name}
        required
        tabIndex={-1}
        className="arquivo-real"
        onInvalid={(e) => e.currentTarget.setCustomValidity(`Falta: ${rotulo}. Tire a foto ou escolha o arquivo.`)}
      />
    </div>
  );
}
