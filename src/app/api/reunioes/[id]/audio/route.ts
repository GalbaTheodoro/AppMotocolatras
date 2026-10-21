import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { podeGerir } from "@/lib/reunioes";
import { transcrever, anexarTranscricao } from "@/lib/ia";

export const runtime = "nodejs";
export const maxDuration = 60;

// A Vercel aceita no máximo ~4,5 MB por envio; o gravador manda trechos menores que isso
const MAX = 4_300_000;

/** Recebe um trecho de áudio da reunião, transcreve com a IA e guarda o texto */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Faça login novamente" }, { status: 401 });
  const { id } = await params;
  const ev = await queryOne<{ id: number; criado_por: number | null }>(
    "SELECT id, criado_por FROM eventos WHERE id=$1 AND tipo='reuniao' AND status='ativo'", [Number(id) || 0]);
  if (!ev) return NextResponse.json({ erro: "Reunião não encontrada" }, { status: 404 });
  if (!podeGerir(u, ev)) return NextResponse.json({ erro: "Só quem organiza a reunião pode gravar" }, { status: 403 });

  let fd: FormData;
  try { fd = await req.formData(); } catch {
    return NextResponse.json({ erro: "Arquivo muito grande. Envie áudios de até 4 MB (cerca de 20 minutos gravados aqui)." }, { status: 413 });
  }
  const f = fd.get("audio");
  if (!(f instanceof File) || f.size === 0) return NextResponse.json({ erro: "Nenhum áudio recebido" }, { status: 400 });
  if (f.size > MAX) return NextResponse.json({ erro: "Arquivo muito grande. Envie áudios de até 4 MB ou use o gravador do sistema." }, { status: 413 });
  const origem = String(fd.get("origem") ?? "Áudio").slice(0, 60);
  try {
    const { texto, duracao } = await transcrever(f, f.name || "trecho.webm");
    await anexarTranscricao(ev.id, texto || "(trecho sem fala reconhecida)", origem);
    return NextResponse.json({ texto, duracao });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
