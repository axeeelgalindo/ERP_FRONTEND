import Image from "next/image";

export const metadata = {
  title: "Iniciar sesión",
  description: "Acceso seguro al sistema ERP de Blue Ingeniería SPA.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <div className="h-svh grid grid-cols-1 lg:grid-cols-2 bg-gray-50 overflow-hidden">
      {/* Panel visual */}
      <aside className="relative hidden lg:block h-full" aria-hidden="true">
        {/* Gradiente performante */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-indigo-600 to-fuchsia-600" />
        {/* Malla sutil */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Branding / mensaje */}
        <div className="relative h-full text-white p-10 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-3">
            <Image
              src="/logoblanco.webp"
              width={180}
              height={45}
              alt="Logo Blue Ingeniería SPA"
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          <div className="pr-6">
            <h1 className="text-4xl font-bold leading-tight">
              Gestión simple, <span className="text-white/90">resultados reales</span>
            </h1>
            <p className="mt-4 text-white/85 max-w-lg">
              Sistema Integral de Gestión Empresarial (ERP) de Blue Ingeniería SPA, diseñado para la optimización y control total de operaciones, proyectos y finanzas.
            </p>
            <ul className="mt-6 space-y-2 text-white/90">
              <li className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-white" />
                Autenticación segura y confiable
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-white" />
                Rendimiento optimizado en tiempo real
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-white" />
                Gestión integral de proyectos y operaciones
              </li>
            </ul>
          </div>

          <p className="text-sm text-white/75">
            © {new Date().getFullYear()} ERP | Blue Ingeniería SPA. Todos los derechos reservados.
          </p>
        </div>
      </aside>

      {/* Panel de formulario */}
      <main className="relative h-full">
        {/* Fondo sutil en mobile */}
        <div className="absolute inset-0 lg:hidden bg-linear-to-b from-white via-white to-gray-50" aria-hidden="true" />
        {/* Contenedor centrado y scroll interno si hiciera falta */}
        <div className="relative h-full flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-center lg:hidden">
              <Image
                src="/Logo_blue.webp"
                width={160}
                height={40}
                alt="Logo Blue Ingeniería"
                className="h-9 w-auto object-contain"
                priority
              />
            </div>

            <section className="bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/60 rounded-2xl shadow-sm ring-1 ring-black/5">
              <div className="p-6 sm:p-8">{children}</div>
            </section>

            <div className="mt-6 text-center text-sm text-gray-500">
              ¿Problemas para iniciar sesión? Contacta al administrador.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
