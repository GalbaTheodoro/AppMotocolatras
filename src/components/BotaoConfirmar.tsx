"use client";

export default function BotaoConfirmar({
  children,
  mensagem,
  className = "btn perigo peq",
}: {
  children: React.ReactNode;
  mensagem: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
