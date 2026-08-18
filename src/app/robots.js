export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.blueinge.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/api/",
          "/admin/",
          "/costeos/",
          "/cotizaciones/",
          "/empleados/",
          "/proyectos/",
          "/compras/",
          "/usuarios/",
          "/rendiciones/",
          "/hh/",
          "/asistencia/",
          "/servicios-arriendos/",
          "/reportes/",
          "/kanban/",
          "/clientes/",
          "/proveedores/",
          "/empresas/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
