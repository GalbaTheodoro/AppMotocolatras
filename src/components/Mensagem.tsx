export default function Mensagem({ sp }: { sp: { ok?: string; erro?: string } }) {
  return (
    <>
      {sp.ok && <div className="msg ok">{sp.ok}</div>}
      {sp.erro && <div className="msg erro">{sp.erro}</div>}
    </>
  );
}
