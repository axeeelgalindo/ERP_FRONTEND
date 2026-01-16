"use client";

import { Pencil, Trash } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

export default function ClientsTable({
  rows,            // filas ya paginadas para mostrar
  loading,
  error,
  onEdit,
  onDelete,
  page,
  pageSize,
  total,           // total de filas después de filtros
  onPageChange,
}) {
  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error)   return <div className="p-6 text-sm text-red-500">Error: {error}</div>;
  if (!rows?.length) return <div className="p-6 text-sm text-gray-500">Sin resultados.</div>;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="w-full">
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">RUT</th>
            <th className="px-4 py-3">Correo</th>
            <th className="px-4 py-3">Teléfono</th>
            <th className="px-4 py-3">Notas</th>
            <th className="px-4 py-3 w-[120px] text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-800">{row.nombre}</td>
              <td className="px-4 py-2">{row.rut}</td>
              <td className="px-4 py-2 text-blue-600">{row.correo}</td>
              <td className="px-4 py-2">{row.telefono}</td>
              <td className="px-4 py-2 text-gray-500">{row.notas || "—"}</td>
              <td className="px-4 py-2 text-right">
                <button
                  className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100"
                  onClick={() => onEdit(row)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="inline-flex items-center justify-center p-2 text-red-500 rounded-md hover:bg-red-50"
                  onClick={() => onDelete(row)}
                >
                  <Trash size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          Mostrando <span className="font-medium text-gray-700">{from}-{to}</span> de{" "}
          <span className="font-medium text-gray-700">{total}</span>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
