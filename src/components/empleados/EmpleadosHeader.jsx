"use client";

import { UserPlus, RefreshCw } from "lucide-react";

export default function EmpleadosHeader({
  total,
  isDisabled,
  onReload,
  onCreate,
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Empleados</h1>
        <p className="text-sm text-gray-500">
          Gestión de RRHH: empleados, cargos y actividad.
        </p>
        {typeof total === "number" && (
          <p className="mt-1 text-xs text-gray-400">
            Total registrados: {total}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onReload}
          disabled={isDisabled}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          Recargar
        </button>
        <button
          onClick={onCreate}
          disabled={isDisabled}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo empleado
        </button>
      </div>
    </div>
  );
}
