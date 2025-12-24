// src/components/proyectos/tareas/DetalleTareaList.jsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

function toDateTimeOrNull(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function DetalleTareaList({ tareaId, miembros, onChange }) {
  const { data: session } = useSession();

  const [rows, setRows] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(""); // "YYYY-MM-DD"
  const [diasPlan, setDiasPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleCreate = async () => {
    if (!session?.user) return;

    if (!titulo.trim()) {
      setErr("El título de la subtarea es obligatorio.");
      return;
    }

    if (!fechaInicio || !diasPlan) {
      setErr("Debes ingresar fecha de inicio y días plan (>0) para la subtarea.");
      return;
    }

    const diasPlanNumber = Number(diasPlan);
    if (Number.isNaN(diasPlanNumber) || diasPlanNumber <= 0) {
      setErr("Los días plan deben ser un número mayor a 0.");
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
        tarea_id: tareaId,
        titulo: titulo.trim(),
        descripcion: null,
        responsable_id: responsableId || null,
        fecha_inicio_plan: toDateTimeOrNull(fechaInicio),
        dias_plan: diasPlanNumber,
      };

      const res = await fetch(`${API}/tareas-detalle/add`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al crear la subtarea"
        );
      }

      // actualiza lista local si quieres
      setRows((prev) => [...prev, json.row ?? json]);
      onChange?.(json);

      // limpiar form
      setTitulo("");
      setResponsableId("");
      setFechaInicio("");
      setDiasPlan("");
    } catch (error) {
      console.error(error);
      setErr(error.message || "Error al crear la subtarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          Subtareas
        </p>
      </div>

      {/* listado simple de subtareas ya creadas */}
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>{r.titulo}</span>
              {/* aquí puedes mostrar fechas, responsable, etc. */}
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ YA NO ES <form>, es un <div> */}
      <div className="mt-2 space-y-2 text-xs">
        {err && (
          <p className="text-red-600 text-[11px]">
            {err}
          </p>
        )}

        <div>
          <label className="block text-[11px] text-gray-600">
            Título de la subtarea
          </label>
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-xs"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-gray-600">
              Responsable
            </label>
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {miembros.map((m) => (
                <option key={m.empleado_id} value={m.empleado_id}>
                  {m.empleado?.usuario?.nombre ||
                    m.empleado?.usuario?.correo ||
                    "Sin nombre"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-600">
              Inicio
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-gray-600">
              Días plan
            </label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              value={diasPlan}
              onChange={(e) => setDiasPlan(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button" // 👈 MUY IMPORTANTE: no submit del form padre
            onClick={handleCreate}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Agregar subtarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
