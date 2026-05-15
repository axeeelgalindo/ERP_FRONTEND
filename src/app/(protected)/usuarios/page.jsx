"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import UsuarioFormModal from "@/components/usuarios/UsuarioFormModal";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function UsuariosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [currentUsr, setCurrentUsr] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // =========================
  // Fetch List
  // =========================
  const fetchUsuarios = async () => {
    try {
      if (!session) return;
      setErr("");
      setLoading(true);

      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "100");
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${API_URL}/usuarios?${params.toString()}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Error cargando usuarios");
      }

      setUsuarios(Array.isArray(json?.data) ? json.data : []);
      setTotal(Number(json?.total || 0));
    } catch (e) {
      setErr(e?.message || "Error cargando usuarios");
      setUsuarios([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  // =========================
  // Modal Handlers
  // =========================
  const openCreate = () => {
    setMode("create");
    setCurrentUsr({
      nombre: "",
      correo: "",
      rol_id: "",
      contrasena: "",
    });
    setOpenModal(true);
  };

  const openEdit = (u) => {
    setMode("edit");
    setCurrentUsr({
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      rol_id: u.rol?.id || "",
      contrasena: "", // En blanco por seguridad, si la llena, se actualiza
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setCurrentUsr(null);
  };

  // =========================
  // Guardar (CREATE / EDIT)
  // =========================
  const handleSaveUsuario = async () => {
    try {
      if (!session) return;
      setErr("");
      setSaving(true);

      const payload = { ...currentUsr };

      if (mode === "create") {
        const res = await fetch(`${API_URL}/usuarios/add`, {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify(payload),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo crear usuario");
      } else {
        if (!payload.id) throw new Error("Falta el ID del usuario");
        if (!payload.contrasena) delete payload.contrasena; // Si está vacía, no actualizarla

        const res = await fetch(`${API_URL}/usuarios/update/${payload.id}`, {
          method: "PATCH",
          headers: makeHeaders(session),
          body: JSON.stringify(payload),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || json?.error || "No se pudo actualizar usuario");
      }

      closeModal();
      await fetchUsuarios();
    } catch (e) {
      setErr(e?.message || "Error al guardar usuario");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Cambiar Estado (Soft Delete / Restore)
  // =========================
  const toggleEstado = async (u) => {
    if (!session) return;
    const isDeshabilitado = !!u.eliminado;
    const action = isDeshabilitado ? "restore" : "disable";
    const confirmMsg = isDeshabilitado
      ? `¿Estás seguro de HABILITAR el acceso al usuario ${u.nombre}?`
      : `¿Estás seguro de DESHABILITAR el acceso al usuario ${u.nombre}? Perderá acceso a la plataforma.`;

    if (!confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/usuarios/${action}/${u.id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || json?.error || "Error al cambiar estado");

      await fetchUsuarios();
    } catch (e) {
      setErr(e?.message || "Error al cambiar estado");
      setLoading(false);
    }
  };

  // =========================
  // Render states
  // =========================
  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Usuarios</div>
        <div className="mt-1 text-sm text-slate-500">Cargando sesión...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cuentas de Usuario</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona los accesos, roles y credenciales de los usuarios de la plataforma.
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Total registrados: {total}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchUsuarios}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Recargar
          </button>

          <button
            onClick={openCreate}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Nuevo Usuario
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
            if (e.key === "Enter") fetchUsuarios();
          }}
          placeholder="Buscar por nombre o correo..."
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol Sistema</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Perfil Empleado</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => {
                const isActive = !u.eliminado;
                const empleadoVinculado = u.empleado;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold shadow-sm border border-blue-200/50">
                          {u.nombre?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className={`font-bold ${isActive ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-300'}`}>
                            {u.nombre}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">{u.correo}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/60 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <span className="material-symbols-outlined text-[14px] text-slate-500">badge</span>
                        {u.rol?.nombre || u.rol?.codigo || "Sin Rol"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {empleadoVinculado ? (
                        <div>
                          <p className="text-xs font-bold text-slate-700">{empleadoVinculado.cargo || "Sin cargo especificado"}</p>
                          {empleadoVinculado.telefono && <p className="text-[10px] text-slate-500 font-medium">Tel: {empleadoVinculado.telefono}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">No vinculado</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-red-50 text-red-700 border border-red-200/60"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">{isActive ? 'check_circle' : 'cancel'}</span>
                        {isActive ? "Activo" : "Deshabilitado"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(u)}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center transition-all tooltip"
                          title="Editar cuenta"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        <button
                          onClick={() => toggleEstado(u)}
                          className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${
                            isActive
                              ? "border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-200"
                              : "border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                          }`}
                          title={isActive ? "Deshabilitar acceso" : "Restaurar acceso"}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isActive ? "person_off" : "how_to_reg"}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && usuarios.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                        <span className="material-symbols-outlined text-3xl">group_off</span>
                      </div>
                      <p className="text-sm font-medium">No se encontraron usuarios.</p>
                      {q && (
                        <button onClick={() => { setQ(""); fetchUsuarios(); }} className="text-blue-500 hover:underline text-xs font-semibold">
                          Limpiar búsqueda
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {loading && usuarios.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
                      <p className="text-sm font-medium">Cargando cuentas...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UsuarioFormModal
        open={openModal}
        mode={mode}
        session={session}
        currentUsr={currentUsr}
        onChangeCurrentUsr={setCurrentUsr}
        onClose={closeModal}
        onSave={handleSaveUsuario}
        saving={saving}
      />
    </div>
  );
}
