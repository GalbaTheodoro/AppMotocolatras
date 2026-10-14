/* eslint-disable @next/next/no-img-element */
export function LogoTopo({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="topo">
      <img src="/logo.png" alt="Motocólatras MC" />
      <b>MOTOCÓLATRAS</b>
      <small>{subtitulo}</small>
    </div>
  );
}
