"use client";

import { useEffect, useState } from "react";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function UsuarioFormModal({
  open,
  mode,
  session,
  currentUsr,
  onChangeCurrentUsr,
  onClose,
  onSave,
  saving,
}) {
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [errRoles, setErrRoles] = useState("");

  // Cargar roles al abrir el modal (si no están cargados)
  useEffect(() => {
    if (open && session && roles.length === 0) {
      fetchRoles();
    }
  }, [open, session]);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    setErrRoles("");
    try {
      const res = await fetch(`${API_URL}/roles`, {
        headers: makeHeaders(session),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || json?.error || "Error cargando roles");
      setRoles(json.data || []);
    } catch (e) {
      setErrRoles(e.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  if (!open) return null;

  const isEdit = mode === "edit";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Modifica los datos del usuario."
                : "Crea una nueva cuenta para la plataforma."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={currentUsr?.nombre || ""}
                onChange={(e) =>
                  onChangeCurrentUsr({ ...currentUsr, nombre: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Ej. Juan Pérez"
              />
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={currentUsr?.correo || ""}
                onChange={(e) =>
                  onChangeCurrentUsr({ ...currentUsr, correo: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="juan.perez@empresa.com"
              />
            </div>

            {/* Rol */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Rol del Sistema *
              </label>
              <select
                required
                value={currentUsr?.rol_id || ""}
                onChange={(e) =>
                  onChangeCurrentUsr({ ...currentUsr, rol_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="" disabled>
                  {loadingRoles ? "Cargando roles..." : "Selecciona un rol"}
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} ({r.codigo})
                  </option>
                ))}
              </select>
              {errRoles && <p className="text-xs text-red-500 mt-1">{errRoles}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Contraseña {isEdit && <span className="text-slate-400 font-normal">(Dejar en blanco para no cambiarla)</span>} {!isEdit && "*"}
              </label>
              <input
                type="password"
                required={!isEdit}
                value={currentUsr?.contrasena || ""}
                onChange={(e) =>
                  onChangeCurrentUsr({ ...currentUsr, contrasena: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder={isEdit ? "••••••••" : "Ingresa una contraseña segura"}
              />
            </div>

            {/* Estado (solo en modo edición, aunque se puede omitir si usan los botones directos) */}
            {/* Opcional: <label>Activo</label>... */}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {saving && <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>}
              {saving ? "Guardando..." : "Guardar Usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
