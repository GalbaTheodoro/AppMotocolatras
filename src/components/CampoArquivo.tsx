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
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CampoArquivo({
  name, rotulo, dica, somenteImagem = false, camera,
}: { name: string; rotulo: string; dica?: string; somenteImagem?: boolean; camera?: "user" | "environment" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const [processando, setProcessando] = useState(false);

  async function aoEscolher() {
    const input = ref.current!;
    const f = input.files?.[0];
    setErro(""); setInfo(""); setPreview(null);
    if (!f) return;
    if (f.type === "application/pdf") {
      if (somenteImagem) { input.value = ""; setErro("Envie uma foto (não PDF)."); return; }
      if (f.size > LIMITE_PDF) { input.value = ""; setErro("PDF muito grande (máx. 2,5 MB). Tire uma foto do documento."); return; }
      setInfo(`PDF · ${(f.size / 1024).toFixed(0)} KB`);
      return;
    }
    if (!f.type.startsWith("image/")) { input.value = ""; setErro("Formato não aceito. Envie foto ou PDF."); return; }
    setProcessando(true);
    try {
      const menor = await comprimir(f);
      const dt = new DataTransfer();
      dt.items.add(menor);
      input.files = dt.files;
      setPreview(URL.createObjectURL(menor));
      setInfo(`Foto · ${(menor.size / 1024).toFixed(0)} KB`);
    } catch {
      input.value = "";
      setErro("Não foi possível ler esta imagem. Tente tirar a foto novamente (formato JPG ou PNG).");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <label className="campo-arquivo">
      {rotulo} *
      {dica && <span className="sub" style={{ fontWeight: 400, fontSize: ".82rem" }}>{dica}</span>}
      <input
        ref={ref}
        type="file"
        name={name}
        required
        accept={somenteImagem ? "image/*" : "image/*,application/pdf"}
        capture={camera}
        onChange={aoEscolher}
      />
      {processando && <span className="sub" style={{ fontWeight: 400 }}>Preparando a foto…</span>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="miniatura" />
      )}
      {info && <span className="sub" style={{ fontWeight: 400, fontSize: ".8rem" }}>✓ {info}</span>}
      {erro && <span style={{ color: "var(--err)", fontWeight: 500 }}>{erro}</span>}
    </label>
  );
}
