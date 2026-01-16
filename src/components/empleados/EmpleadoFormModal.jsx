"use client";

import Modal from "@/components/ui/Modal";

export default function EmpleadoFormModal({
  open,
  mode,
  currentEmp,
  onChangeCurrentEmp,
  onClose,
  onSave,
  saving,
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nuevo empleado" : "Editar empleado"}
    >
      {currentEmp && (
        <div className="space-y-4">
          {currentEmp.usuario && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-600">
              <div className="font-medium text-gray-800">
                {currentEmp.usuario.nombre}
              </div>
              <div>{currentEmp.usuario.correo}</div>
              {currentEmp.usuario.rol && (
                <div className="mt-1">
                  Rol:{" "}
                  <span className="font-semibold">
                    {currentEmp.usuario.rol.nombre}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Cargo
              </label>
              <input
                type="text"
                value={currentEmp.cargo}
                onChange={(e) =>
                  onChangeCurrentEmp((prev) => ({
                    ...prev,
                    cargo: e.target.value,
                  }))
                }
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: Jefe de proyecto"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Teléfono
              </label>
              <input
                type="text"
                value={currentEmp.telefono}
                onChange={(e) =>
                  onChangeCurrentEmp((prev) => ({
                    ...prev,
                    telefono: e.target.value,
                  }))
                }
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="+56 9 ..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Fecha de ingreso
              </label>
              <input
                type="date"
                value={currentEmp.fecha_ingreso || ""}
                onChange={(e) =>
                  onChangeCurrentEmp((prev) => ({
                    ...prev,
                    fecha_ingreso: e.target.value,
                  }))
                }
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Sueldo base (CLP)
              </label>
              <input
                type="number"
                min={0}
                value={currentEmp.sueldo_base}
                onChange={(e) =>
                  onChangeCurrentEmp((prev) => ({
                    ...prev,
                    sueldo_base: e.target.value,
                  }))
                }
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: 900000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={currentEmp.activo}
                  onChange={(e) =>
                    onChangeCurrentEmp((prev) => ({
                      ...prev,
                      activo: e.target.checked,
                    }))
                  }
                />
                Empleado activo
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
