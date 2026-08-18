import "./globals.css";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import AppProviders from "@/components/AppProviders";
import SidebarPortalMount from "@/components/layout/SidebarPortalMount";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://erp.blueinge.com"),
  title: {
    default: "ERP | Blue Ingeniería",
    template: "%s | Blue Ingeniería ERP",
  },
  description:
    "Sistema Integral de Gestión Empresarial (ERP) de Blue Ingeniería SPA. Gestión de proyectos, cotizaciones, compras, operaciones y finanzas.",
  applicationName: "Blue Ingeniería ERP",
  authors: [{ name: "Blue Ingeniería SPA", url: "https://erp.blueinge.com" }],
  creator: "Blue Ingeniería SPA",
  publisher: "Blue Ingeniería SPA",
  keywords: [
    "ERP",
    "Blue Ingeniería",
    "Blue Ingeniería SPA",
    "Gestión Empresarial",
    "Cotizaciones",
    "Costeos",
    "Proyectos",
    "Compras",
    "Chile",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/iconbluein.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "ERP | Blue Ingeniería",
    description:
      "Sistema Integral de Gestión Empresarial (ERP) de Blue Ingeniería SPA.",
    url: "https://erp.blueinge.com",
    siteName: "ERP Blue Ingeniería",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "/Logo_blue.webp",
        width: 1200,
        height: 630,
        alt: "Logo Blue Ingeniería SPA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ERP | Blue Ingeniería",
    description:
      "Sistema Integral de Gestión Empresarial (ERP) de Blue Ingeniería SPA.",
    images: ["/Logo_blue.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://erp.blueinge.com/#organization",
      name: "Blue Ingeniería SPA",
      url: "https://erp.blueinge.com",
      logo: "https://erp.blueinge.com/Logo_blue.webp",
      description: "Servicios de ingeniería, proyectos y gestión industrial.",
    },
    {
      "@type": "WebApplication",
      "@id": "https://erp.blueinge.com/#webapp",
      name: "ERP Blue Ingeniería",
      url: "https://erp.blueinge.com",
      applicationCategory: "BusinessApplication",
      operatingSystem: "All",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      provider: {
        "@id": "https://erp.blueinge.com/#organization",
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/iconbluein.png" sizes="180x180" type="image/png" />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
