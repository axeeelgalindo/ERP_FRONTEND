"use client";

import { useEffect, useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EmpleadoFormModal({
  open,
  mode,
  session, // 👈 viene del page.jsx
  currentEmp,
  onChangeCurrentEmp,
  onClose,
  onSave,
  saving,
}) {
  if (!open) return null;

  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const [rolId, setRolId] = useState("");
  const [password, setPassword] = useState("");
  const [userErr, setUserErr] = useState("");

  const hasUsuario = Boolean(currentEmp?.usuario?.id);

  // Detecta admin
  const isAdmin = useMemo(() => {
    const u = session?.user || {};
    const code =
      u?.rolCodigo ||
      u?.role ||
      u?.rol?.codigo ||
      u?.rol ||
      u?.rol_id ||
      u?.userRole?.codigo ||
      null;

    return (
      String(code || "").toUpperCase() === "ADMIN" ||
      String(code || "").toUpperCase() === "MASTER"
    );
  }, [session]);

  const canEditUser = isAdmin;

  useEffect(() => {
    if (!open) return;
    setUserErr("");
    setPassword("");
    setRolId(currentEmp?.usuario?.rol?.id || "");
  }, [open, currentEmp?.usuario?.rol?.id]);

  // Cargar roles
  useEffect(() => {
    if (!open) return;
    if (!session) return;
    if (!canEditUser) return;

    let cancelled = false;

    (async () => {
      try {
        setRolesLoading(true);
        const res = await fetch(`${API_URL}/roles`, {
          headers: makeHeaders(session),
        });
        if (!res.ok) throw new Error("No se pudieron cargar roles");
        const json = await res.json();
        if (!cancelled) setRoles(json.data || []);
      } catch (e) {
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, session, canEditUser]);

  const handleSaveClick = async () => {
    setUserErr("");

    const usuarioPatch =
      hasUsuario && canEditUser
        ? {
            ...(rolId ? { rol_id: rolId } : {}),
            ...(password ? { contrasena: password } : {}),
          }
        : null;

    const patchFinal =
      usuarioPatch && Object.keys(usuarioPatch).length > 0 ? usuarioPatch : null;

    // Mandamos al page.jsx
    await onSave?.({
      usuarioPatch: patchFinal,
      clearUsuarioFields: () => setPassword(""),
    });
  };

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
                  Rol actual:{" "}
                  <span className="font-semibold">
                    {currentEmp.usuario.rol.nombre}
                  </span>
                </div>
              )}
            </div>
          )}

          {hasUsuario && canEditUser && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-slate-700">
                Acceso (Usuario)
              </div>

              {userErr && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {userErr}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Rol
                  </label>
                  <select
                    value={rolId}
                    onChange={(e) => setRolId(e.target.value)}
                    disabled={rolesLoading}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  >
                    <option value="">
                      {rolesLoading ? "Cargando..." : "Selecciona un rol"}
                    </option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Opcional: cambia el rol si corresponde.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Escribe para cambiarla"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Si la dejas vacía, no se modifica.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Datos del empleado */}
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
              onClick={handleSaveClick}
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
