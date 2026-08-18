import Link from "next/link";
import Image from "next/image";
import { Home, Search } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import HideSidebar from "@/components/layout/HideSidebar";

export default function NotFound() {
  return (
    <div className="relative min-h-svh flex items-center justify-center overflow-hidden">
      <HideSidebar />

      {/* Fondo decorativo: fijo y recortado */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* Usa tamaños concretos para no inflar el layout, y transforms en vez de offsets negativos */}
        <div className="absolute h-[28rem] w-[28rem] left-[-6rem] top-[-6rem] rounded-full bg-linear-to-br from-blue-600 via-indigo-2400 to-fuchsia-600 blur-xl" />
        <div className="absolute h-[32rem] w-[32rem] right-[-8rem] bottom-[-8rem] rounded-full bg-linear-to-tr from-blue-900 via-indigo-800 to-fuchsia-900 blur-xl" />
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" aria-label="Ir al inicio de Blue Ingeniería">
              <Image
                src="/Logo_blue.webp"
                alt="Logo Blue Ingeniería"
                width={150}
                height={40}
                className="h-9 w-auto object-contain"
                priority
              />
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Search size={14} />
              Error 404
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Uy… no encontramos lo que buscas.
          </h1>
          <p className="mt-3 text-gray-600">
            Es posible que el enlace haya cambiado, ya no exista o no tengas permisos para acceder.
            Revisa la URL o vuelve al inicio.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <Home size={16} />
              Ir al inicio
            </Link>

            <BackButton className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
