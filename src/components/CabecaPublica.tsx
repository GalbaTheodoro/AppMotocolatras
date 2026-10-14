/* eslint-disable @next/next/no-img-element */
export default function CabecaPublica({ titulo }: { titulo: string }) {
  return (
    <div className="cabeca">
      <img src="/logo.png" alt="Motocólatras MC" />
      <div>
        <b>MOTOCÓLATRAS</b>
        <span>{titulo}</span>
      </div>
    </div>
  );
}
