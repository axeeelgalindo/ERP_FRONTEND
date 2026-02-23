// src/components/proyectos/ProyectoFormModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ProyectoFormModal({
  open,
  onClose,
  mode = "create", // "create" | "edit"
  initialProyecto = null, // row de la tabla
  onSaved, // callback opcional
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const isEdit = mode === "edit";

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [presupuesto, setPresupuesto] = useState("");

  // cliente principal (en tu schema Proyecto no existe cliente_id, pero lo dejo en UI por si luego lo agregas)
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // miembros
  const [miembrosIds, setMiembrosIds] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = isEdit ? "Editar proyecto" : "Crear nuevo proyecto";

  const initialMiembrosFromRow = useMemo(() => {
    const m = initialProyecto?.miembros;
    if (!Array.isArray(m)) return [];
    // ProyectoMiembro: { empleado_id, empleado:{...} }
    return m.map((x) => x?.empleado_id).filter(Boolean);
  }, [initialProyecto]);

  // Cuando abre el modal: cargar clientes/empleados y setear valores
  useEffect(() => {
    if (!open || !session?.user) return;

    // prefills
    if (isEdit && initialProyecto) {
      setNombre(initialProyecto?.nombre || "");
      setDescripcion(initialProyecto?.descripcion || "");
      setPresupuesto(
        initialProyecto?.presupuesto == null ? "" : String(initialProyecto.presupuesto)
      );

      // si en el futuro guardas cliente_id en Proyecto:
      setClienteId(initialProyecto?.cliente_id || "");

      setMiembrosIds(initialMiembrosFromRow);
    } else {
      resetForm();
    }

    loadClientes();
    loadEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, isEdit, initialProyecto?.id]);

  async function loadClientes() {
    try {
      setLoadingClientes(true);
      const headers = makeHeaders(session);
      const url = new URL(`${API}/clientes`);
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.message || json?.msg || "Error al cargar clientes");

      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
        ? json
        : [];

      setClientes(list);
    } catch (e) {
      console.error("Error cargando clientes", e);
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  }

  async function loadEmpleados() {
    try {
      setLoadingEmpleados(true);
      const headers = makeHeaders(session);
      const url = new URL(`${API}/empleados`);
      url.searchParams.set("withUsuario", "true");
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.message || json?.msg || "Error al cargar empleados");

      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
        ? json
        : [];

      setEmpleados(list);
    } catch (e) {
      console.error("Error cargando empleados", e);
      setEmpleados([]);
    } finally {
      setLoadingEmpleados(false);
    }
  }

  function resetForm() {
    setNombre("");
    setDescripcion("");
    setPresupuesto("");
    setClienteId("");
    setMiembrosIds([]);
    setErr("");
  }

  function toggleMiembro(id) {
    setMiembrosIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!session?.user) return;

    if (!nombre.trim()) {
      setErr("El nombre del proyecto es obligatorio.");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        presupuesto: presupuesto === "" ? null : Number(presupuesto),
        // si después agregas cliente_id a Proyecto, quedará listo:
        cliente_id: clienteId || null,
        miembros: miembrosIds, // ✅ importante para update también (backend debe soportarlo)
      };

      const url = isEdit
        ? `${API}/proyectos/update/${initialProyecto.id}`
        : `${API}/proyectos/add`;

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.message || json?.msg || "Error al guardar proyecto");

      setLoading(false);
      onClose?.();
      onSaved?.(json);

      // refrescar lista
      router.refresh();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose?.();
      }}
      title={title}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Nombre */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-200">
            Nombre *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proyecto SEST"
            required
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-200">
            Descripción
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción breve del proyecto..."
          />
        </div>

        {/* Presupuesto */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-200">
            Presupuesto (CLP)
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            placeholder="Ej: 4000000"
            min={0}
          />
        </div>

        {/* Cliente (opcional) */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-200">
            Cliente (opcional)
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— Sin cliente asignado —</option>
            {loadingClientes ? (
              <option disabled>Cargando clientes...</option>
            ) : (
              clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.rut ? `· ${c.rut}` : ""}
                </option>
              ))
            )}
          </select>

          <p className="text-[11px] text-gray-400">
            * Ojo: tu modelo <b>Proyecto</b> no tiene <code>cliente_id</code> aún. Este select no guardará nada
            hasta que lo agregues en DB/backend.
          </p>
        </div>

        {/* Miembros */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-200">
            Miembros del proyecto (empleados)
          </label>

          <div className="h-40 overflow-y-auto rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900">
            {loadingEmpleados ? (
              <p className="px-3 py-2 text-xs text-gray-500">Cargando empleados...</p>
            ) : empleados.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">No hay empleados disponibles</p>
            ) : (
              <ul className="text-xs divide-y divide-gray-100 dark:divide-slate-800">
                {empleados.map((emp) => (
                  <li
                    key={emp.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-emerald-50 dark:hover:bg-slate-800"
                    onClick={() => toggleMiembro(emp.id)}
                  >
                    <div>
                      <div className="font-medium text-gray-800 dark:text-slate-100">
                        {emp.usuario?.nombre || "Sin nombre"}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400">
                        {emp.cargo || emp.usuario?.rol?.nombre || "Empleado"}
                      </div>
                    </div>
                    <input type="checkbox" className="h-4 w-4" checked={miembrosIds.includes(emp.id)} readOnly />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {err && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {err}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (isEdit ? "Guardando..." : "Creando...") : isEdit ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}