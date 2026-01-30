"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import EmpleadoFormModal from "@/components/empleados/EmpleadoFormModal";
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
  const [soloActivos, setSoloActivos] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [currentEmp, setCurrentEmp] = useState(null);

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

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Empleados</h1>
          <p className="text-sm text-slate-500">
            Gestión de RRHH: empleados, cargos y actividad.
          </p>
          <p className="mt-1 text-xs text-slate-400">Total registrados: {total}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmpleados}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>

          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Nuevo empleado
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fetchEmpleados();
          }}
          placeholder="Buscar por nombre, correo o cargo..."
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="h-4 w-4"
          />
          Solo activos
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          {empleados.length} empleados encontrados
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Fecha ingreso</th>
                <th className="px-4 py-3">Sueldo base</th>
                <th className="px-4 py-3">Rendiciones</th>
                <th className="px-4 py-3">Tareas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {empleados.map((e) => {
                const nombre = e?.usuario?.nombre || "(Sin usuario)";
                const correo = e?.usuario?.correo || "—";
                const rol = e?.usuario?.rol?.codigo || "—";
                const rend = e?._count?.Rendicion ?? 0;
                const tareas = e?._count?.tareas ?? 0;

                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{nombre}</div>
                      <div className="text-xs text-slate-500">{correo}</div>
                      <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {rol}
                      </div>
                    </td>

                    <td className="px-4 py-3">{e?.cargo || "-"}</td>
                    <td className="px-4 py-3">{e?.telefono || "-"}</td>
                    <td className="px-4 py-3">
                      {e?.fecha_ingreso ? String(e.fecha_ingreso).slice(0, 10) : "-"}
                    </td>
                    <td className="px-4 py-3">{fmtCLP(e?.sueldo_base)}</td>
                    <td className="px-4 py-3">{rend}</td>
                    <td className="px-4 py-3">{tareas}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        {e?.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(e)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!empleados.length && (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={9}>
                    {loading ? "Cargando..." : "No hay empleados para mostrar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
