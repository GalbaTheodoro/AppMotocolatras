import { exigirLogado } from "@/lib/auth";
import Lateral from "@/components/Lateral";

export const dynamic = "force-dynamic";

// Área de qualquer pessoa logada (equipe e integrantes): agenda da sede e minha conta
export default async function MembrosLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirLogado();
  return (
    <div className="shell">
      <Lateral u={u} />
      <main className="main">{children}</main>
    </div>
  );
}
