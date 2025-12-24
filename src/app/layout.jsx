import "./globals.css";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import Providers from "@/components/Providers";
import SidebarPortalMount from "@/components/layout/SidebarPortalMount";

export const metadata = {
  title: "ERP | BLUE INGENIERÍA",
  description: "Sistema ERP multiempresa moderno con Next.js y Tailwind",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 font-sans min-h-screen">
        {/* Slot fijo para el sidebar (no compite con MUI) */}
        <div id="sidebar-slot" />

        {/* 👇 OJO: ahora <main> es el primer hijo estable de <body> */}
        <main className="transition-[padding] duration-300 ease-in-out">
          {/* Todo MUI (CssBaseline/Theme/Emotion) vive DENTRO de main */}
          <Providers>
            {/* El sidebar se monta en el slot (cliente) y ajusta body.has-sidebar */}
            <SidebarPortalMount />
            {children}
          </Providers>
        </main>
      </body>
    </html>
  );
}
