import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function ProyectoBreadcrumbs({ id, nombre }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <Home size={14} />
          <span>Inicio</span>
        </Link>
        <span>/</span>
        <Link href="/proyectos" className="hover:underline">
          Proyectos
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">
          {nombre ?? id}
        </span>
      </div>

      <Link
        href="/proyectos"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <ArrowLeft size={14} />
        Volver a proyectos
      </Link>
    </div>
  );
}
