"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { makeHeaders } from "@/lib/api";
import EmpresaFormModal from "@/components/empresas/EmpresaFormModal";
import BaseUserModal from "@/components/empresas/BaseUserModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function EmpresasPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [empresas, setEmpresas] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Modales
  const [openEmpresaModal, setOpenEmpresaModal] = useState(false);
  const [empresaMode, setEmpresaMode] = useState("create"); // "create" | "edit"
  const [currentEmpresa, setCurrentEmpresa] = useState(null);

  const [openBaseUserModal, setOpenBaseUserModal] = useState(false);
  const [selectedEmpresaForUser, setSelectedEmpresaForUser] = useState(null);

  // Redireccionar si no está autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Cargar empresas
  const fetchEmpresas = async () => {
    try {
      if (!session) return;
      setErr("");
      setLoading(true);

      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "100");
      params.set("includeDeleted", showDeleted ? "true" : "false");
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${API_URL}/empresa?${params.toString()}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Error cargando empresas");
      }

      setEmpresas(Array.isArray(json?.data) ? json.data : []);
      setTotal(Number(json?.total || 0));
    } catch (e) {
      setErr(e?.message || "Error cargando empresas");
      setEmpresas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    fetchEmpresas();
  }, [status, session, showDeleted]);

  // Handlers para modal de Empresa
  const openCreateEmpresa = () => {
    setEmpresaMode("create");
    setCurrentEmpresa({
      nombre: "",
      rut: "",
      correo: "",
      telefono: "",
    });
    setOpenEmpresaModal(true);
  };

  const openEditEmpresa = (emp) => {
    setEmpresaMode("edit");
    setCurrentEmpresa({
      id: emp.id,
      nombre: emp.nombre,
      rut: emp.rut || "",
      correo: emp.correo || "",
      telefono: emp.telefono || "",
    });
    setOpenEmpresaModal(true);
  };

  const closeEmpresaModal = () => {
    setOpenEmpresaModal(false);
    setCurrentEmpresa(null);
  };

  // Guardar Empresa (y opcionalmente su usuario base)
  const handleSaveEmpresa = async (baseUserData) => {
    try {
      if (!session) return;
      setErr("");
      setSaving(true);

      let createdEmpresa = null;

      if (empresaMode === "create") {
        // 1. Crear Empresa
        const res = await fetch(`${API_URL}/empresa/add`, {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify(currentEmpresa),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo crear la empresa");
        createdEmpresa = json;

        // 2. Si se solicitó crear usuario base, crearlo usando la empresa recién creada
        if (baseUserData && createdEmpresa?.id) {
          const userPayload = {
            ...baseUserData,
            empresa_id: createdEmpresa.id,
          };

          const userRes = await fetch(`${API_URL}/usuarios/add`, {
            method: "POST",
            headers: makeHeaders(session),
            body: JSON.stringify(userPayload),
          });
          const userJson = await safeJson(userRes);
          if (!userRes.ok) {
            // Logueamos pero no bloqueamos el flujo ya que la empresa sí se creó
            console.error("Error al crear usuario base:", userJson);
            alert(`Empresa creada, pero falló la creación del usuario base: ${userJson?.message || userJson?.error || "Error desconocido"}`);
          }
        }
      } else {
        // Editar Empresa
        if (!currentEmpresa.id) throw new Error("Falta el ID de la empresa");
        const res = await fetch(`${API_URL}/empresa/update/${currentEmpresa.id}`, {
          method: "PATCH",
          headers: makeHeaders(session),
          body: JSON.stringify(currentEmpresa),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo actualizar la empresa");
      }

      closeEmpresaModal();
      await fetchEmpresas();
    } catch (e) {
      setErr(e?.message || "Error al guardar empresa");
    } finally {
      setSaving(false);
    }
  };

  // Deshabilitar / Habilitar / Eliminar
  const toggleEmpresaEstado = async (emp) => {
    if (!session) return;
    const isDeshabilitado = !!emp.eliminado;
    const action = isDeshabilitado ? "restore" : "disable";
    const confirmMsg = isDeshabilitado
      ? `¿Estás seguro de HABILITAR la empresa ${emp.nombre}?`
      : `¿Estás seguro de DESHABILITAR la empresa ${emp.nombre}? Sus usuarios no podrán ingresar al sistema.`;

    if (!confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/empresa/${action}/${emp.id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || json?.error || "Error al cambiar estado");

      await fetchEmpresas();
    } catch (e) {
      setErr(e?.message || "Error al cambiar estado");
      setLoading(false);
    }
  };

  const handleDeleteEmpresa = async (emp) => {
    if (!session) return;
    if (!confirm(`¿Estás seguro de ELIMINAR permanentemente la empresa ${emp.nombre}? Esta acción borrará todas sus relaciones.`)) return;

    try {
      setLoading(true);
      // Primero intentamos borrar directo, si falla por relaciones pedimos force=true
      let res = await fetch(`${API_URL}/empresa/delete/${emp.id}`, {
        method: "DELETE",
        headers: makeHeaders(session),
      });

      let json = await safeJson(res);

      if (res.status === 409) {
        if (confirm(`${json?.message || json?.error || "La empresa tiene datos asociados."} ¿Quieres forzar la eliminación definitiva?`)) {
          res = await fetch(`${API_URL}/empresa/delete/${emp.id}?force=true`, {
            method: "DELETE",
            headers: makeHeaders(session),
          });
          json = await safeJson(res);
        } else {
          setLoading(false);
          return;
        }
      }

      if (!res.ok) throw new Error(json?.message || json?.error || "Error al eliminar empresa");

      await fetchEmpresas();
    } catch (e) {
      setErr(e?.message || "Error al eliminar empresa");
      setLoading(false);
    }
  };

  // Handlers para modal de Usuario Base
  const openAssignUser = (emp) => {
    setSelectedEmpresaForUser(emp);
    setOpenBaseUserModal(true);
  };

  const closeBaseUserModal = () => {
    setOpenBaseUserModal(false);
    setSelectedEmpresaForUser(null);
  };

  const handleSaveBaseUser = async (baseUserData) => {
    try {
      if (!session) return;
      setErr("");
      setSaving(true);

      const res = await fetch(`${API_URL}/usuarios/add`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify(baseUserData),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || json?.error || "Error al asignar usuario base");

      closeBaseUserModal();
      await fetchEmpresas();
    } catch (e) {
      setErr(e?.message || "Error al asignar usuario");
    } finally {
      setSaving(false);
    }
  };

  // Renderizados principales
  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Empresas</div>
        <div className="mt-1 text-sm text-slate-500">Cargando sesión...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="p-6  mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Empresas Registradas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra las distintas organizaciones en la plataforma, asigna sus usuarios base y controla su estado.
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Total empresas: {total}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Mostrar Eliminadas toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span>Mostrar Deshabilitadas</span>
          </label>

          <button
            onClick={fetchEmpresas}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Recargar
          </button>

          <button
            onClick={openCreateEmpresa}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">domain_add</span>
            Nueva Empresa
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-red-500">error</span>
          <p className="mt-0.5 font-medium">{err}</p>
        </div>
      )}

      {/* Buscador */}
      <div className="mb-6 bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 max-w-md focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
        <span className="material-symbols-outlined text-slate-400 ml-2">search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchEmpresas();
          }}
          placeholder="Buscar por nombre, rut o correo..."
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto / Teléfono</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuarios Base</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {empresas.map((emp) => {
                const isActive = !emp.eliminado && emp.activa;
                const activeUsers = Array.isArray(emp.usuarios) ? emp.usuarios : [];

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600 font-bold shadow-sm border border-slate-200/50">
                          {emp.nombre?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className={`font-bold ${isActive ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-300'}`}>
                            {emp.nombre}
                          </div>
                          {emp.rut && <div className="text-xs text-slate-500 font-medium">RUT: {emp.rut}</div>}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {emp.correo ? (
                        <div>
                          <p className="text-xs font-bold text-slate-700">{emp.correo}</p>
                          {emp.telefono && <p className="text-[10px] text-slate-500 font-medium">{emp.telefono}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">Sin contacto</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {activeUsers.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {activeUsers.slice(0, 2).map((u) => (
                            <div key={u.id} className="text-xs flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                              <span className="font-semibold text-slate-700">{u.nombre}</span>
                              <span className="text-slate-400">({u.rol?.nombre || "Sin Rol"})</span>
                            </div>
                          ))}
                          {activeUsers.length > 2 && (
                            <span className="text-[10px] font-bold text-blue-600">
                              + {activeUsers.length - 2} usuario(s) más
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openAssignUser(emp)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          <span className="material-symbols-outlined text-[14px]">person_add</span>
                          Asignar Usuario Base
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-red-50 text-red-700 border border-red-200/60"
                          }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">{isActive ? 'check_circle' : 'cancel'}</span>
                        {isActive ? "Activa" : "Deshabilitada"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openAssignUser(emp)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 flex items-center justify-center transition-all tooltip"
                          title="Asignar Usuario Base"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_add</span>
                        </button>

                        <button
                          onClick={() => openEditEmpresa(emp)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center transition-all tooltip"
                          title="Editar empresa"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        <button
                          onClick={() => toggleEmpresaEstado(emp)}
                          className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${isActive
                              ? "border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-200"
                              : "border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                            }`}
                          title={isActive ? "Deshabilitar empresa" : "Restaurar empresa"}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isActive ? "block" : "settings_backup_restore"}
                          </span>
                        </button>

                        <button
                          onClick={() => handleDeleteEmpresa(emp)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all tooltip"
                          title="Eliminar permanentemente"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && empresas.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                        <span className="material-symbols-outlined text-3xl">domain_disabled</span>
                      </div>
                      <p className="text-sm font-medium">No se encontraron empresas.</p>
                      {q && (
                        <button onClick={() => { setQ(""); fetchEmpresas(); }} className="text-blue-500 hover:underline text-xs font-semibold">
                          Limpiar búsqueda
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {loading && empresas.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
                      <p className="text-sm font-medium">Cargando empresas...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario Modal de Empresa */}
      <EmpresaFormModal
        open={openEmpresaModal}
        mode={empresaMode}
        session={session}
        currentEmpresa={currentEmpresa}
        onChangeCurrentEmpresa={setCurrentEmpresa}
        onClose={closeEmpresaModal}
        onSave={handleSaveEmpresa}
        saving={saving}
      />

      {/* Modal para Crear / Asignar Usuario Base */}
      <BaseUserModal
        open={openBaseUserModal}
        session={session}
        empresa={selectedEmpresaForUser}
        onClose={closeBaseUserModal}
        onSave={handleSaveBaseUser}
        saving={saving}
      />
    </div>
  );
}
