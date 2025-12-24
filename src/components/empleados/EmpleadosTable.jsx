"use client";

import { Edit, Trash2, UserX, UserCheck } from "lucide-react";

export default function EmpleadosTable({
  empleados,
  loading,
  onEdit,
  onConfirmAction,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Empleado
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Cargo
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Teléfono
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Fecha ingreso
            </th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Sueldo base
            </th>
            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rendiciones
            </th>
            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              Tareas
            </th>
            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              Estado
            </th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {empleados.length === 0 && !loading ? (
            <tr>
              <td
                colSpan={9}
                className="px-4 py-6 text-center text-sm text-gray-500"
              >
                No hay empleados que cumplan con los filtros.
              </td>
            </tr>
          ) : (
            empleados.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">
                      {emp.usuario?.nombre || "Sin usuario"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {emp.usuario?.correo || "Sin correo"}
                    </span>
                    {emp.usuario?.rol && (
                      <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {emp.usuario.rol.nombre}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {emp.cargo || "-"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {emp.telefono || "-"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {emp.fecha_ingreso
                    ? new Date(emp.fecha_ingreso).toLocaleDateString("es-CL")
                    : "-"}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {typeof emp.sueldo_base === "number"
                    ? emp.sueldo_base.toLocaleString("es-CL", {
                        style: "currency",
                        currency: "CLP",
                      })
                    : "-"}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {emp._count?.Rendicion ?? 0}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {emp._count?.tareas ?? 0}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      emp.activo && !emp.eliminado
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                    }`}
                  >
                    {emp.activo && !emp.eliminado ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => onEdit(emp)}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white p-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    {emp.eliminado ? (
                      <button
                        onClick={() => onConfirmAction("restore", emp)}
                        className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
                        title="Restaurar"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onConfirmAction("disable", emp)}
                        className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 p-1.5 text-xs text-amber-700 hover:bg-amber-100"
                        title="Deshabilitar"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onConfirmAction("delete", emp)}
                      className="inline-flex items-center rounded-md border border-red-200 bg-red-50 p-1.5 text-xs text-red-600 hover:bg-red-100"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
