export default function Tag({ tipo, children }: { tipo: string; children: React.ReactNode }) {
  return <span className={`tag ${tipo}`}>{children}</span>;
}
