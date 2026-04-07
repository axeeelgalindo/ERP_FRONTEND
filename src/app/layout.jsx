import "./globals.css";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import AppProviders from "@/components/AppProviders";
import SidebarPortalMount from "@/components/layout/SidebarPortalMount";

export const metadata = {
  title: "ERP | BLUE INGENIERÍA",
  description: "Sistema ERP multiempresa moderno con Next.js y Tailwind",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      </head>
      <body className="bg-surface text-on-surface font-inter min-h-screen">
        <div id="sidebar-slot" />

        <main className="transition-[padding] duration-300 ease-in-out">
          <AppProviders>
            <SidebarPortalMount />
            {children}
          </AppProviders>
        </main>
      </body>
    </html>
  );
}
