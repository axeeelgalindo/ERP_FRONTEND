// src/components/proyectos/AddProyectoButton.jsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AddProyectoButton() {
  const { data: session } = useSession();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [presupuesto, setPresupuesto] = useState("");

  // cliente principal
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // miembros (empleados)
  const [miembrosIds, setMiembrosIds] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Cuando se abre el modal, cargamos datos
  useEffect(() => {
    if (!open || !session?.user) return;
    loadClientes();
    loadEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

  async function loadClientes() {
    try {
      setLoadingClientes(true);
      const headers = makeHeaders(session);
      const url = new URL(`${API}/clientes`);
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al cargar clientes"
        );
      }

      // según tu backend: { total, data }
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

      // solo con usuario y misma empresa (lo filtra el backend)
      url.searchParams.set("withUsuario", "true");
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al cargar empleados"
        );
      }

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
    setMiembrosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
        presupuesto: presupuesto ? Number(presupuesto) : null,
        // cliente principal (ajusta el nombre de campo a tu backend)
        cliente_id: clienteId || null,
        // array de empleados seleccionados
        miembros: miembrosIds,
      };

      const res = await fetch(`${API}/proyectos/add`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || json?.msg || "Error al crear proyecto");
      }

      resetForm();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        <Plus size={14} />
        Nuevo proyecto
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (!loading) {
            setOpen(false);
            resetForm();
          }
        }}
        title="Crear nuevo proyecto"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Nombre *
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Proyecto SEST"
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve del proyecto..."
            />
          </div>

          {/* Presupuesto */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Presupuesto (CLP)
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={presupuesto}
              onChange={(e) => setPresupuesto(e.target.value)}
              placeholder="Ej: 4000000"
              min={0}
            />
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Cliente
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
          </div>

          {/* Miembros */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Miembros del proyecto (empleados)
            </label>

            <div className="h-40 overflow-y-auto rounded-lg border border-gray-300">
              {loadingEmpleados ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  Cargando empleados...
                </p>
              ) : empleados.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  No hay empleados disponibles
                </p>
              ) : (
                <ul className="text-xs divide-y divide-gray-100">
                  {empleados.map((emp) => (
                    <li
                      key={emp.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-emerald-50"
                      onClick={() => toggleMiembro(emp.id)}
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {emp.usuario?.nombre || "Sin nombre"}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {emp.cargo ||
                            emp.usuario?.rol?.nombre ||
                            "Empleado"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={miembrosIds.includes(emp.id)}
                        readOnly
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              Mantén presionada la tecla Ctrl (o Cmd en Mac) para seleccionar
              varios.
            </p>
          </div>

          {/* Error */}
          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {err}
            </p>
          )}

          {/* Acciones */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (!loading) {
                  setOpen(false);
                  resetForm();
                }
              }}
              className="inline-flex items-center rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear proyecto"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
