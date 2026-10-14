import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    // Envio de documentos/fotos na solicitação (as fotos são comprimidas no navegador antes)
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
