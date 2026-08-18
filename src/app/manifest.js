export default function manifest() {
  return {
    name: "ERP Blue Ingeniería",
    short_name: "Blue ERP",
    description: "Sistema Integral de Gestión Empresarial (ERP) de Blue Ingeniería SPA",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e3a8a",
    icons: [
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/iconbluein.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/Logo_blue.webp",
        sizes: "512x512",
        type: "image/webp",
      },
    ],
  };
}
