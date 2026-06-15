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

export default function EmpresaFormModal({
  open,
  mode,
  session,
  currentEmpresa,
  onChangeCurrentEmpresa,
  onClose,
  onSave,
  saving,
}) {
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [errRoles, setErrRoles] = useState("");

  const [createBaseUser, setCreateBaseUser] = useState(false);
  const [baseUser, setBaseUser] = useState({
    nombre: "",
    correo: "",
    contrasena: "",
    rol_id: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (open) {
      setLogoFile(null);
      const currentLogo = currentEmpresa?.logo_url || "";
      if (currentLogo) {
        if (currentLogo.startsWith("http")) {
          setLogoPreview(currentLogo);
        } else {
          const backendBase = API_URL ? API_URL.replace(/\/api$/, "") : "";
          setLogoPreview(`${backendBase}${currentLogo}`);
        }
      } else {
        setLogoPreview("");
      }
    }
  }, [open, currentEmpresa]);

  // Cargar roles si el modal está abierto y se va a crear un usuario base
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
      const rolesList = json.data || [];
      setRoles(rolesList);

      // Auto-seleccionar rol ADMIN o el primero disponible por defecto
      const adminRol = rolesList.find((r) => r.codigo === "ADMIN" || r.codigo === "SUPERADMIN") || rolesList[0];
      if (adminRol) {
        setBaseUser((prev) => ({ ...prev, rol_id: adminRol.id }));
      }
    } catch (e) {
      setErrRoles(e.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setCreateBaseUser(false);
      setBaseUser({
        nombre: "",
        correo: "",
        contrasena: "",
        rol_id: roles.find((r) => r.codigo === "ADMIN" || r.codigo === "SUPERADMIN")?.id || "",
      });
    }
  }, [open, roles]);

  if (!open) return null;

  const isEdit = mode === "edit";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(createBaseUser ? baseUser : null, logoFile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8 rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Editar Empresa" : "Nueva Empresa"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Modifica los datos de la empresa seleccionada."
                : "Registra una nueva empresa en el ERP."}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Nombre de la Empresa */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Nombre de la Empresa *
              </label>
              <input
                type="text"
                required
                value={currentEmpresa?.nombre || ""}
                onChange={(e) =>
                  onChangeCurrentEmpresa({ ...currentEmpresa, nombre: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Ej. Mi Empresa SPA"
              />
            </div>

            {/* Logo de la Empresa */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Logo de la Empresa
              </label>
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                {logoPreview ? (
                  <div className="relative h-16 w-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview("");
                        onChangeCurrentEmpresa({ ...currentEmpresa, logo_url: "" });
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 hover:bg-red-600 transition-colors flex items-center justify-center"
                      title="Eliminar logo"
                    >
                      <span className="material-symbols-outlined text-[12px] block font-bold">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center flex-shrink-0 text-slate-400">
                    <span className="material-symbols-outlined text-2xl">image</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="block w-full text-xs text-slate-500
                      file:mr-4 file:py-1.5 file:px-3
                      file:rounded-xl file:border-0
                      file:text-xs file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP de hasta 2MB</p>
                </div>
              </div>
            </div>

            {/* RUT y Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  RUT
                </label>
                <input
                  type="text"
                  value={currentEmpresa?.rut || ""}
                  onChange={(e) =>
                    onChangeCurrentEmpresa({ ...currentEmpresa, rut: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Ej. 76.123.456-7"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={currentEmpresa?.telefono || ""}
                  onChange={(e) =>
                    onChangeCurrentEmpresa({ ...currentEmpresa, telefono: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Ej. +56 9 1234 5678"
                />
              </div>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Correo de Contacto
              </label>
              <input
                type="email"
                value={currentEmpresa?.correo || ""}
                onChange={(e) =>
                  onChangeCurrentEmpresa({ ...currentEmpresa, correo: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="contacto@empresa.com"
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={currentEmpresa?.direccion || ""}
                onChange={(e) =>
                  onChangeCurrentEmpresa({ ...currentEmpresa, direccion: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Ej. Av. Nueva Providencia 1881, Oficina 501"
              />
            </div>

            {/* Crear Usuario Base (Solo en modo creación) */}
            {!isEdit && (
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createBaseUser}
                    onChange={(e) => setCreateBaseUser(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    Crear usuario base inicial para esta empresa
                  </span>
                </label>

                {createBaseUser && (
                  <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                      Datos del Usuario Administrador
                    </h3>

                    {/* Nombre Usuario */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        required={createBaseUser}
                        value={baseUser.nombre}
                        onChange={(e) =>
                          setBaseUser((prev) => ({ ...prev, nombre: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Ej. Juan Pérez"
                      />
                    </div>

                    {/* Correo Usuario y Contraseña */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Correo Electrónico *
                        </label>
                        <input
                          type="email"
                          required={createBaseUser}
                          value={baseUser.correo}
                          onChange={(e) =>
                            setBaseUser((prev) => ({ ...prev, correo: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="admin@nuevaempresa.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Contraseña *
                        </label>
                        <input
                          type="password"
                          required={createBaseUser}
                          value={baseUser.contrasena}
                          onChange={(e) =>
                            setBaseUser((prev) => ({ ...prev, contrasena: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="Mín. 3 caracteres"
                        />
                      </div>
                    </div>

                    {/* Rol */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Rol del Usuario *
                      </label>
                      <select
                        required={createBaseUser}
                        value={baseUser.rol_id}
                        onChange={(e) =>
                          setBaseUser((prev) => ({ ...prev, rol_id: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
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
                      {errRoles && <p className="text-[10px] text-red-500 mt-0.5">{errRoles}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 shrink-0 rounded-b-2xl">
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
              {saving ? "Guardando..." : "Guardar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
