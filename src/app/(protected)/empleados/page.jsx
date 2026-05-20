"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import EmpleadoFormModal from "@/components/empleados/EmpleadoFormModal";
import EmpleadoDetailDrawer from "@/components/empleados/EmpleadoDetailDrawer";
import { Eye } from "lucide-react";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const fmtCLP = (n) =>
  Number(n || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

export default function EmpleadosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // ✅ Estados SIEMPRE declarados antes de cualquier return
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [empleados, setEmpleados] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [searchCargo, setSearchCargo] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [currentEmp, setCurrentEmp] = useState(null);

  const [openDrawer, setOpenDrawer] = useState(false);
  const [currentViewEmp, setCurrentViewEmp] = useState(null);

  // ✅ Redirect sin romper hooks
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // =========================
  // Fetch list (si hay sesión)
  // =========================
  const fetchEmpleados = async () => {
    try {
      if (!session) return;
      setErr("");
      setLoading(true);

      const params = new URLSearchParams();
      params.set("withUsuario", "true");
      params.set("page", "1");
      params.set("pageSize", "50");
      if (soloActivos) params.set("activo", "true");
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${API_URL}/empleados?${params.toString()}`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Error cargando empleados");
      }

      setEmpleados(Array.isArray(json?.data) ? json.data : []);
      setTotal(Number(json?.total || 0));
      setCurrentPage(1);
    } catch (e) {
      setErr(e?.message || "Error cargando empleados");
      setEmpleados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    fetchEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, soloActivos]);

  // =========================
  // Abrir modal
  // =========================
  const openCreate = () => {
    setMode("create");
    setCurrentEmp({
      cargo: "",
      telefono: "",
      fecha_ingreso: "",
      sueldo_base: 0,
      activo: true,
      usuario: null,
    });
    setOpenModal(true);
  };

  const openEdit = (emp) => {
    setMode("edit");
    setCurrentEmp({
      ...emp,
      cargo: emp?.cargo ?? "",
      telefono: emp?.telefono ?? "",
      fecha_ingreso: emp?.fecha_ingreso ? String(emp.fecha_ingreso).slice(0, 10) : "",
      sueldo_base: emp?.sueldo_base ?? 0,
      activo: !!emp?.activo,
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setCurrentEmp(null);
  };

  const openDetail = (emp) => {
    setCurrentViewEmp(emp);
    setOpenDrawer(true);
  };

  const closeDetail = () => {
    setOpenDrawer(false);
    setCurrentViewEmp(null);
  };

  // =========================
  // Guardar (CREATE / EDIT)
  // =========================
  const handleSaveEmpleado = async ({
    empleadoPatch,
    usuarioPatch,
    usuarioCreate,
    clearUsuarioFields,
  }) => {
    try {
      if (!session) return;

      setErr("");
      setSaving(true);

      // ✅ CREATE
      if (mode === "create") {
        const res = await fetch(`${API_URL}/empleados/add`, {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify({
            ...empleadoPatch,
            usuarioCreate: usuarioCreate || null,
          }),
        });

        const json = await safeJson(res);
        if (!res.ok) {
          throw new Error(json?.message || json?.error || "No se pudo crear empleado");
        }

        clearUsuarioFields?.();
        closeModal();
        await fetchEmpleados();
        return;
      }

      // ✅ EDIT
      if (!currentEmp?.id) throw new Error("Falta ID de empleado para editar");

      // OJO: tu route real es /empleados/update/:id
      const resEmp = await fetch(`${API_URL}/empleados/update/${currentEmp.id}`, {
        method: "PATCH",
        headers: makeHeaders(session),
        body: JSON.stringify(empleadoPatch),
      });
      const jsonEmp = await safeJson(resEmp);
      if (!resEmp.ok) {
        throw new Error(jsonEmp?.message || jsonEmp?.error || "No se pudo actualizar empleado");
      }

      // usuarioPatch (si existe)
      if (usuarioPatch) {
        const resUsr = await fetch(`${API_URL}/empleados/${currentEmp.id}/usuario`, {
          method: "PATCH",
          headers: makeHeaders(session),
          body: JSON.stringify(usuarioPatch),
        });
        const jsonUsr = await safeJson(resUsr);
        if (!resUsr.ok) {
          throw new Error(jsonUsr?.message || jsonUsr?.error || "No se pudo actualizar usuario");
        }
      }

      clearUsuarioFields?.();
      closeModal();
      await fetchEmpleados();
    } catch (e) {
      setErr(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Render states (sin romper hooks)
  // =========================
  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Empleados</div>
        <div className="mt-1 text-sm text-slate-500">Cargando sesión...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold">Empleados</div>
        <div className="mt-1 text-sm text-slate-500">Redirigiendo a login...</div>
      </div>
    );
  }

  const ingresosDelMes = empleados.filter(e => {
    if (!e.fecha_ingreso) return false;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const empDate = new Date(e.fecha_ingreso);
    return empDate.getMonth() === currentMonth && empDate.getFullYear() === currentYear;
  }).length;

  const activosCount = empleados.filter(e => e.activo).length;

  const filteredEmpleados = empleados.filter(e => {
    if (!searchCargo.trim()) return true;
    return e.cargo?.toLowerCase().includes(searchCargo.toLowerCase());
  });

  // -- Paginación local --
  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredEmpleados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredEmpleados.length);
  const currentEmpleados = filteredEmpleados.slice(startIndex, endIndex);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-on-background">
      <div className="p-6 flex-1  mx-auto w-full">
        {/* Page Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-3xl text-on-surface tracking-tight">Empleados</h2>
            <p className="text-secondary text-base mt-1">Gestión de RRHH: empleados, cargos y actividad.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchEmpleados}
              disabled={loading}
              className="flex items-center px-6 py-2 bg-surface-container-highest text-primary font-bold rounded-lg hover:bg-surface-variant transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-2">refresh</span>
              {loading ? "Cargando..." : "Recargar"}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center px-6 py-2 bg-primary text-on-primary font-bold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined mr-2">add</span>
              Nuevo empleado
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {/* Bento Stats / Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mr-4">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <div>
              <p className="text-xs font-medium text-secondary uppercase tracking-wider">Registrados</p>
              <p className="text-3xl font-bold text-on-surface leading-none mt-1">{total}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center">
            <div className="w-12 h-12 bg-tertiary/10 rounded-full flex items-center justify-center text-tertiary mr-4">
              <span className="material-symbols-outlined">person_add</span>
            </div>
            <div>
              <p className="text-xs font-medium text-secondary uppercase tracking-wider">Ingresos del Mes</p>
              <p className="text-3xl font-bold text-on-surface leading-none mt-1">{ingresosDelMes}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center">
            <div className="w-12 h-12 bg-primary-container/10 rounded-full flex items-center justify-center text-primary-container mr-4">
              <span className="material-symbols-outlined">groups</span>
            </div>
            <div>
              <p className="text-xs font-medium text-secondary uppercase tracking-wider">Empleados Activos</p>
              <p className="text-3xl font-bold text-on-surface leading-none mt-1">{activosCount} de {total}</p>
            </div>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary uppercase tracking-wider" htmlFor="filter-name">
              Nombre o correo
            </label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary">search</span>
              <input
                id="filter-name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchEmpleados();
                }}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Buscar por nombre o correo..."
                type="text"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary uppercase tracking-wider" htmlFor="filter-cargo">
              Cargo
            </label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary">work</span>
              <input
                id="filter-cargo"
                value={searchCargo}
                onChange={(e) => {
                  setSearchCargo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Buscar por cargo..."
                type="text"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider">
              {filteredEmpleados.length} empleados encontrados
            </p>
            <div className="flex items-center space-x-4">
              <label className="flex items-center cursor-pointer gap-2">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={soloActivos}
                    onChange={(e) => setSoloActivos(e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${soloActivos ? 'bg-primary' : 'bg-surface-dim'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${soloActivos ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className="text-sm font-medium text-on-surface">Solo activos</span>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Empleado</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Cargo</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Fecha Ingreso</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Sueldo Base</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-medium text-secondary uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {currentEmpleados.map((e) => {
                  const nombre = e?.usuario?.nombre || "(Sin usuario)";
                  const correo = e?.usuario?.correo || "—";

                  return (
                    <tr key={e.id} className="hover:bg-surface transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container mr-4 overflow-hidden border border-outline-variant font-bold uppercase text-lg shrink-0">
                            {nombre.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-lg text-on-surface">{nombre}</p>
                            <p className="text-xs font-medium text-secondary tracking-wider">{correo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-base text-secondary">{e?.cargo || "-"}</td>
                      <td className="px-6 py-4 text-xs font-medium text-secondary tracking-wider">{e?.telefono || "-"}</td>
                      <td className="px-6 py-4 text-base text-secondary">
                        {e?.fecha_ingreso ? String(e.fecha_ingreso).slice(0, 10) : "-"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-lg text-on-surface">{fmtCLP(e?.sueldo_base)}</td>
                      <td className="px-6 py-4">
                        {e?.activo ? (
                          <span className="px-3 py-1 bg-[#dcfce7] text-[#166534] text-xs font-medium tracking-wider rounded-full border border-[#bbf7d0] uppercase">Activo</span>
                        ) : (
                          <span className="px-3 py-1 bg-surface-container-highest text-secondary text-xs font-medium tracking-wider rounded-full border border-outline-variant uppercase">Inactivo</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openDetail(e)}
                            className="p-2 text-secondary hover:text-primary hover:bg-primary/5 rounded transition-all flex items-center justify-center"
                            title="Ver detalle y documentos"
                          >
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          <button
                            onClick={() => openEdit(e)}
                            className="p-2 text-secondary hover:text-primary hover:bg-primary/5 rounded transition-all flex items-center justify-center"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!empleados.length ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-base text-secondary" colSpan={7}>
                      {loading ? "Cargando empleados..." : "No hay empleados para mostrar."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between bg-surface-container-low/30 gap-4">
              <p className="text-sm font-medium text-secondary">
                Mostrando {startIndex + 1} a {endIndex} de {filteredEmpleados.length} resultados
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-all flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  // Logica simple para mostrar paginas cercanas
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded font-medium transition-all ${
                          currentPage === pageNum
                            ? "bg-primary text-on-primary font-bold"
                            : "hover:bg-surface-container text-secondary"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return (
                      <span key={pageNum} className="px-2 text-secondary">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-all flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <EmpleadoFormModal
          open={openModal}
          mode={mode}
          session={session}
          currentEmp={currentEmp}
          onChangeCurrentEmp={setCurrentEmp}
          onClose={closeModal}
          onSave={handleSaveEmpleado}
          saving={saving}
        />

        <EmpleadoDetailDrawer
          open={openDrawer}
          onClose={closeDetail}
          empleado={currentViewEmp}
        />
      </div>
    </div>
  );
}
