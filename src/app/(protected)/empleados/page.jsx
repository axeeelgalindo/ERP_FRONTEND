"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { makeHeaders } from "@/lib/api";

import EmpleadosHeader from "@/components/empleados/EmpleadosHeader";
import EmpleadosFilters from "@/components/empleados/EmpleadosFilters";
import EmpleadosTable from "@/components/empleados/EmpleadosTable";
import EmpleadoFormModal from "@/components/empleados/EmpleadoFormModal";
import EmpleadoConfirmModal from "@/components/empleados/EmpleadoConfirmModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EmpleadosPage() {
  const { data: session, status } = useSession();

  const [empleados, setEmpleados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filtros
  const [q, setQ] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  // paginación sencilla
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // modal crear/editar
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState("create"); // "create" | "edit"
  const [currentEmp, setCurrentEmp] = useState(null);

  // modal confirmación (deshabilitar / restaurar / eliminar)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "disable" | "restore" | "delete"
  const [targetEmp, setTargetEmp] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isAuthLoading = status === "loading";
  const isDisabled = isAuthLoading || loading;

  const loadEmpleados = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("withUsuario", "true");
      if (q) params.set("q", q);
      if (soloActivos) params.set("activo", "true");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`${API_URL}/empleados?${params.toString()}`, {
        headers: makeHeaders(session),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error al cargar empleados (${res.status})`);
      }

      const json = await res.json();
      setEmpleados(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }, [session, q, soloActivos, page]);

  useEffect(() => {
    if (status === "authenticated") {
      loadEmpleados();
    }
  }, [status, loadEmpleados]);

  /* ========= HANDLERS ========= */

  const handleOpenCreate = () => {
    setEditMode("create");
    setCurrentEmp({
      id: null,
      usuario: null,
      cargo: "",
      telefono: "",
      fecha_ingreso: "",
      sueldo_base: "",
      activo: true,
    });
    setEditOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditMode("edit");
    setCurrentEmp({
      id: emp.id,
      usuario: emp.usuario || null,
      cargo: emp.cargo || "",
      telefono: emp.telefono || "",
      fecha_ingreso: emp.fecha_ingreso ? emp.fecha_ingreso.slice(0, 10) : "",
      sueldo_base:
        typeof emp.sueldo_base === "number" ? String(emp.sueldo_base) : "",
      activo: emp.activo,
    });
    setEditOpen(true);
  };

  /**
   * onSave desde modal: puede venir con usuarioPatch
   * @param {{ usuarioPatch?: any, clearUsuarioFields?: Function }} opts
   */
  const handleSaveEmpleado = async (opts = {}) => {
    if (!session || !currentEmp) return;

    const { usuarioPatch, clearUsuarioFields } = opts;

    try {
      setLoading(true);
      setError("");

      // 1) Guardar EMPLEADO
      const payload = {
        cargo: currentEmp.cargo || null,
        telefono: currentEmp.telefono || null,
        fecha_ingreso: currentEmp.fecha_ingreso || null,
        sueldo_base:
          currentEmp.sueldo_base !== "" ? Number(currentEmp.sueldo_base) : null,
        activo: currentEmp.activo,
      };

      const isEdit = editMode === "edit" && currentEmp.id;
      const url = isEdit
        ? `${API_URL}/empleados/update/${currentEmp.id}`
        : `${API_URL}/empleados/add`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(
          msg || `Error al ${isEdit ? "actualizar" : "crear"} empleado`
        );
      }

      // Si es create, el backend puede devolver el empleado creado
      // para obtener el id y poder patch usuario.
      let savedEmp = null;
      try {
        savedEmp = await res.json();
      } catch {
        savedEmp = null;
      }

      const empleadoIdFinal = currentEmp.id || savedEmp?.id;

      // 2) Guardar USUARIO del empleado (rol/contraseña) -> SOLO SI VIENE PATCH
      if (empleadoIdFinal && usuarioPatch && Object.keys(usuarioPatch).length) {
        const resU = await fetch(`${API_URL}/empleados/${empleadoIdFinal}/usuario`, {
          method: "PATCH",
          headers: {
            ...makeHeaders(session),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(usuarioPatch),
        });

        if (!resU.ok) {
          const msg = await resU.text().catch(() => "");
          throw new Error(msg || "Error al actualizar rol/contraseña del usuario");
        }

        // limpia password en UI (opcional)
        clearUsuarioFields?.();
      }

      setEditOpen(false);
      await loadEmpleados();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar empleado");
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (action, emp) => {
    setConfirmAction(action);
    setTargetEmp(emp);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!session || !targetEmp || !confirmAction) return;
    try {
      setConfirmLoading(true);
      setError("");

      let url = "";
      let method = "PATCH";

      if (confirmAction === "disable") {
        url = `${API_URL}/empleados/disable/${targetEmp.id}`;
      } else if (confirmAction === "restore") {
        url = `${API_URL}/empleados/restore/${targetEmp.id}`;
      } else if (confirmAction === "delete") {
        url = `${API_URL}/empleados/delete/${targetEmp.id}?force=true`;
        method = "DELETE";
      }

      const res = await fetch(url, {
        method,
        headers: {
          ...makeHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // para evitar FST_ERR_CTP_EMPTY_JSON_BODY
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error al ejecutar acción (${confirmAction})`);
      }

      setConfirmOpen(false);
      setTargetEmp(null);
      setConfirmAction(null);
      await loadEmpleados();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al ejecutar acción");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <EmpleadosHeader
        total={total}
        isDisabled={isDisabled}
        onReload={loadEmpleados}
        onCreate={handleOpenCreate}
      />

      <EmpleadosFilters
        q={q}
        soloActivos={soloActivos}
        onSearchChange={(value) => {
          setQ(value);
          setPage(1);
        }}
        onSoloActivosChange={(value) => {
          setSoloActivos(value);
          setPage(1);
        }}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-600">
            {loading ? (
              <>Cargando empleados…</>
            ) : (
              <>
                {total} empleado{total === 1 ? "" : "s"} encontrados
              </>
            )}
          </p>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>

        <EmpleadosTable
          empleados={empleados}
          loading={loading}
          onEdit={handleOpenEdit}
          onConfirmAction={openConfirm}
        />
      </div>

      <EmpleadoFormModal
        open={editOpen}
        mode={editMode}
        session={session} // 👈 IMPORTANTE
        currentEmp={currentEmp}
        onChangeCurrentEmp={setCurrentEmp}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEmpleado} // 👈 recibe opts con usuarioPatch
        saving={loading}
      />

      <EmpleadoConfirmModal
        open={confirmOpen}
        action={confirmAction}
        targetEmp={targetEmp}
        loading={confirmLoading}
        onClose={() => !confirmLoading && setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
