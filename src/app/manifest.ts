import type { MetadataRoute } from "next";

// Permite instalar o sistema como aplicativo (Chrome, Edge, Android, iPhone)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Motocólatras MC",
    short_name: "Motocólatras",
    description: "Empréstimo de equipamentos e agenda da sede do Motocólatras MC",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Solicitar empréstimo", url: "/solicitar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Agenda da sede", url: "/sede", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
