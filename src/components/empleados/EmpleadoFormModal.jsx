"use client";

import { useEffect, useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ✅ arma "Apellidos, Nombres"
function buildDisplayName(apellidos, nombres) {
  const a = String(apellidos || "").trim().replace(/\s+/g, " ");
  const n = String(nombres || "").trim().replace(/\s+/g, " ");
  if (!a && !n) return "";
  if (!a) return n;
  if (!n) return a;
  return `${a}, ${n}`;
}

// ✅ intenta separar desde "Apellidos, Nombres"
function splitDisplayName(full) {
  const s = String(full || "").trim();
  if (!s) return { apellidos: "", nombres: "" };
  const parts = s.split(",");
  if (parts.length >= 2) {
    return {
      apellidos: parts[0].trim(),
      nombres: parts.slice(1).join(",").trim(),
    };
  }
  // fallback: si no hay coma, dejamos todo en nombres (sin inventar apellidos)
  return { apellidos: "", nombres: s };
}

export default function EmpleadoFormModal({
  open,
  mode, // "create" | "edit"
  session,
  currentEmp,
  onChangeCurrentEmp,
  onClose,
  onSave,
  saving,
}) {
  if (!open) return null;

  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // update usuario existente
  const [rolId, setRolId] = useState("");
  const [password, setPassword] = useState("");
  const [userErr, setUserErr] = useState("");

  // ✅ create usuario nuevo (separado)
  const [newApellidos, setNewApellidos] = useState("");
  const [newNombres, setNewNombres] = useState("");
  const [newCorreo, setNewCorreo] = useState("");
  const [newRolId, setNewRolId] = useState("");
  const [newPassword, setNewPassword] = useState("");

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

  // reset al abrir
  useEffect(() => {
    if (!open) return;

    setUserErr("");

    // editar usuario existente
    setPassword("");
    setRolId(currentEmp?.usuario?.rol?.id || "");

    // ✅ crear usuario nuevo (modo create y sin usuario)
    const { apellidos, nombres } = splitDisplayName(currentEmp?.usuario?.nombre || "");
    setNewApellidos(apellidos);
    setNewNombres(nombres);

    setNewCorreo(currentEmp?.usuario?.correo || "");
    setNewRolId(currentEmp?.usuario?.rol?.id || "");
    setNewPassword("");
  }, [
    open,
    currentEmp?.usuario?.rol?.id,
    currentEmp?.usuario?.nombre,
    currentEmp?.usuario?.correo,
  ]);

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
      } catch {
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

    // ✅ 1) empleadoPatch (siempre)
    const empleadoPatch = {
      cargo: currentEmp?.cargo ?? "",
      telefono: currentEmp?.telefono ?? "",
      fecha_ingreso: currentEmp?.fecha_ingreso || null,
      sueldo_base: currentEmp?.sueldo_base ?? 0,
      activo: !!currentEmp?.activo,
    };

    // ✅ 2) usuarioPatch (solo si existe usuario y admin)
    const usuarioPatch =
      hasUsuario && canEditUser
        ? {
            ...(rolId ? { rol_id: rolId } : {}),
            ...(password ? { contrasena: password } : {}),
          }
        : null;

    const patchFinal =
      usuarioPatch && Object.keys(usuarioPatch).length > 0 ? usuarioPatch : null;

    // ✅ 3) usuarioCreate (solo si NO existe usuario, modo create y admin)
    const nombreFinal = buildDisplayName(newApellidos, newNombres);

    const usuarioCreate =
      !hasUsuario && canEditUser && mode === "create"
        ? {
            nombre: nombreFinal,
            correo: String(newCorreo || "").trim(),
            rol_id: String(newRolId || "").trim(),
            contrasena: String(newPassword || ""),
          }
        : null;

    // validación básica del create
    if (usuarioCreate) {
      if (!String(newApellidos || "").trim()) {
        setUserErr("Faltan los apellidos del usuario.");
        return;
      }
      if (!String(newNombres || "").trim()) {
        setUserErr("Faltan los nombres del usuario.");
        return;
      }
      if (!usuarioCreate.nombre) {
        setUserErr("Nombre final inválido.");
        return;
      }
      if (!usuarioCreate.correo) {
        setUserErr("Falta correo para el usuario.");
        return;
      }
      if (!usuarioCreate.rol_id) {
        setUserErr("Debes seleccionar un rol para el usuario.");
        return;
      }
      if (!usuarioCreate.contrasena || usuarioCreate.contrasena.length < 6) {
        setUserErr("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
    }

    await onSave?.({
      empleadoPatch,
      usuarioPatch: patchFinal,
      usuarioCreate,
      clearUsuarioFields: () => {
        setPassword("");
        setNewPassword("");
      },
    });
  };

  const showCreateUserBox = canEditUser && mode === "create" && !hasUsuario;
  const showEditUserBox = canEditUser && hasUsuario;

  const previewNombre = useMemo(
    () => buildDisplayName(newApellidos, newNombres),
    [newApellidos, newNombres]
  );

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

          {/* ✅ CREATE usuario nuevo */}
          {showCreateUserBox && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-slate-700">
                Acceso (crear usuario)
              </div>

              {userErr && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {userErr}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={newApellidos}
                    onChange={(e) => setNewApellidos(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: Gonzalez Ramirez"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Nombres
                  </label>
                  <input
                    type="text"
                    value={newNombres}
                    onChange={(e) => setNewNombres(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: Juan Carlos"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Correo
                  </label>
                  <input
                    type="email"
                    value={newCorreo}
                    onChange={(e) => setNewCorreo(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="correo@empresa.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Rol
                  </label>
                  <select
                    value={newRolId}
                    onChange={(e) => setNewRolId(e.target.value)}
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
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <p className="mt-2 text-[11px] text-gray-500">
                Se guardará como:{" "}
                <span className="font-semibold text-gray-700">
                  {previewNombre || "—"}
                </span>
              </p>
            </div>
          )}

          {/* ✅ EDIT usuario existente */}
          {showEditUserBox && (
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
                value={currentEmp.cargo ?? ""}
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
                value={currentEmp.telefono ?? ""}
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
                value={currentEmp.sueldo_base ?? 0}
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
                  checked={!!currentEmp.activo}
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
