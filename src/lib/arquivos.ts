export const TIPOS_ARQUIVO = {
  documento: "Documento com foto (RG/CNH)",
  rosto: "Foto do rosto (selfie)",
  endereco: "Comprovante de endereço",
} as const;
export type TipoArquivo = keyof typeof TIPOS_ARQUIVO;

export const MAX_ARQUIVO = 2.5 * 1024 * 1024; // por arquivo, já comprimido
export const MAX_TOTAL = 4.2 * 1024 * 1024; // limite de envio da Vercel é 4,5 MB

/** Descobre o tipo real pelo conteúdo (não confia na extensão) */
export function detectarMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
