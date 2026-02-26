// src/components/proyectos/tareas/AddTareaModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now()) + "-" + String(Math.random()).slice(2);
  }
}

export default function AddTareaModal({
  open,
  onClose,
  proyectoId,
  miembros = [],
  onSaved, // callback final
}) {
  const { data: session } = useSession();

  // =========================
  // EPICA
  // =========================
  const [epicaNombre, setEpicaNombre] = useState("");
  const [epicaDescripcion, setEpicaDescripcion] = useState("");

  // =========================
  // TAREA
  // =========================
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(""); // plan
  const [diasPlan, setDiasPlan] = useState("");

  // =========================
  // SUBTAREAS (draft)
  // =========================
  const [draftDetalles, setDraftDetalles] = useState([]);
  const [subTitulo, setSubTitulo] = useState("");
  const [subResponsableId, setSubResponsableId] = useState("");
  const [subFechaInicio, setSubFechaInicio] = useState("");
  const [subDiasPlan, setSubDiasPlan] = useState("");
  const [subErr, setSubErr] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function toDateTimeOrNull(value) {
    if (!value) return null;
    return `${value}T00:00:00.000Z`;
  }

  function calcFechaFinISO(fechaInicioStr, dias) {
    const diasInt = Number(dias);
    if (!fechaInicioStr || !diasInt || Number.isNaN(diasInt) || diasInt <= 0) {
      return null;
    }
    const base = new Date(fechaInicioStr);
    if (Number.isNaN(base.getTime())) return null;
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + (diasInt - 1));
    return d.toISOString();
  }

  useEffect(() => {
    if (!open) return;

    // reset siempre (modo crear)
    setEpicaNombre("");
    setEpicaDescripcion("");

    setNombre("");
    setDescripcion("");
    setResponsableId("");
    setFechaInicio("");
    setDiasPlan("");

    setDraftDetalles([]);
    setSubTitulo("");
    setSubResponsableId("");
    setSubFechaInicio("");
    setSubDiasPlan("");
    setSubErr("");

    setErr("");
    setLoading(false);
  }, [open]);

  const miembrosOptions = useMemo(
    () =>
      (miembros || []).map((m) => ({
        value: m.empleado_id ?? m.empleado?.id ?? "",
        label:
          m.empleado?.usuario?.nombre ||
          m.empleado?.usuario?.correo ||
          "Empleado sin nombre",
      })),
    [miembros]
  );

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  // -------- SUBTAREAS draft --------
  const handleAddDraftDetalle = () => {
    if (!subTitulo.trim()) {
      setSubErr("El título de la subtarea es obligatorio.");
      return;
    }
    if (!subFechaInicio || !subDiasPlan) {
      setSubErr("Debes indicar fecha de inicio y días plan de la subtarea.");
      return;
    }
    const dias = Number(subDiasPlan);
    if (Number.isNaN(dias) || dias <= 0) {
      setSubErr("Los días plan de la subtarea deben ser mayores a 0.");
      return;
    }

    const nueva = {
      id: uuid(),
      titulo: subTitulo.trim(),
      responsableId: subResponsableId || "",
      fechaInicio: subFechaInicio,
      diasPlan: dias,
    };

    setDraftDetalles((prev) => [...prev, nueva]);
    setSubTitulo("");
    setSubResponsableId("");
    setSubFechaInicio("");
    setSubDiasPlan("");
    setSubErr("");
  };

  const handleDeleteDraftDetalle = (id) => {
    setDraftDetalles((prev) => prev.filter((d) => d.id !== id));
  };

  // =========================
  // SUBMIT (1 click -> 2 requests)
  // 1) POST /epicas/add
  // 2) POST /tareas/add (con epica_id y detalles)
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return;

    // Validaciones
    if (!epicaNombre.trim()) {
      setErr("El nombre de la épica es obligatorio.");
      return;
    }
    if (!nombre.trim()) {
      setErr("El nombre de la tarea es obligatorio.");
      return;
    }
    if (!fechaInicio || !diasPlan) {
      setErr(
        "Debes ingresar fecha de inicio plan y días plan (>0) para la tarea."
      );
      return;
    }

    const diasPlanNumber = Number(diasPlan);
    if (Number.isNaN(diasPlanNumber) || diasPlanNumber <= 0) {
      setErr("Los días plan de la tarea deben ser un número mayor a 0.");
      return;
    }

    let epicaId = null;

    try {
      setLoading(true);
      setErr("");

      const headers = {
        ...makeHeaders(session),
        "Content-Type": "application/json",
      };

      // -------- 1) CREAR EPICA --------
      const epicaRes = await fetch(`${API}/epicas/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          proyecto_id: proyectoId,
          nombre: epicaNombre.trim(),
          descripcion: epicaDescripcion.trim() || null,
        }),
      });

      const epicaJson = await epicaRes.json().catch(() => null);
      if (!epicaRes.ok) {
        throw new Error(
          epicaJson?.message || epicaJson?.msg || "Error al crear la épica"
        );
      }

      epicaId = epicaJson?.row?.id;
      if (!epicaId) {
        throw new Error("No se recibió epicaId desde el backend.");
      }

      // -------- 2) CREAR TAREA (con detalles) --------
      const fechaFinPlanISO = calcFechaFinISO(fechaInicio, diasPlanNumber);

      const detallesPayload =
        draftDetalles.length > 0
          ? draftDetalles.map((d) => {
              const dDiasPlanNumber = Number(d.diasPlan) || 0;
              const dFechaFinPlanISO = calcFechaFinISO(
                d.fechaInicio,
                dDiasPlanNumber
              );

              return {
                titulo: d.titulo,
                descripcion: null,
                responsable_id: d.responsableId || null,
                fecha_inicio_plan: toDateTimeOrNull(d.fechaInicio),
                dias_plan: dDiasPlanNumber,
                fecha_fin_plan: dFechaFinPlanISO,
              };
            })
          : undefined;

      const tareaBody = {
        proyecto_id: proyectoId,
        epica_id: epicaId, // ✅ CLAVE
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        responsable_id: responsableId || null,

        // PLAN
        fecha_inicio_plan: toDateTimeOrNull(fechaInicio),
        dias_plan: diasPlanNumber,
        fecha_fin_plan: fechaFinPlanISO,

        ...(detallesPayload ? { detalles: detallesPayload } : {}),
      };

      const tareaRes = await fetch(`${API}/tareas/add`, {
        method: "POST",
        headers,
        body: JSON.stringify(tareaBody),
      });

      const tareaJson = await tareaRes.json().catch(() => null);
      if (!tareaRes.ok) {
        // rollback: deshabilitar épica si falla tarea
        try {
          await fetch(`${API}/epicas/disable/${epicaId}`, {
            method: "PATCH",
            headers,
          });
        } catch {}
        throw new Error(
          tareaJson?.message || tareaJson?.msg || "Error al crear la tarea"
        );
      }

      // éxito total
      onSaved?.({
        ok: true,
        epica: epicaJson?.row,
        tarea: tareaJson?.row || tareaJson,
      });

      onClose?.();
    } catch (error) {
      console.error(error);
      setErr(error?.message || "Error al enviar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Crear épica + tarea + subtareas"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* ========================= EPICA ========================= */}
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900">1) Épica</h4>
            <span className="text-[11px] text-gray-500">Obligatorio</span>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Nombre de la épica *
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={epicaNombre}
              onChange={(e) => setEpicaNombre(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1 mt-3">
            <label className="block text-xs font-medium text-gray-700">
              Descripción (opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={2}
              value={epicaDescripcion}
              onChange={(e) => setEpicaDescripcion(e.target.value)}
            />
          </div>
        </div>

        {/* ========================= TAREA ========================= */}
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900">2) Tarea</h4>
            <span className="text-[11px] text-gray-500">Obligatorio</span>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Nombre de la tarea *
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1 mt-3">
            <label className="block text-xs font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="space-y-1 mt-3">
            <label className="block text-xs font-medium text-gray-700">
              Responsable
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {miembrosOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Inicio plan
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Días plan
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={diasPlan}
                onChange={(e) => setDiasPlan(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ========================= SUBTAREAS ========================= */}
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900">3) Subtareas</h4>
            <span className="text-[11px] text-gray-500">Opcional</span>
          </div>

          {draftDetalles.length === 0 ? (
            <p className="text-[11px] text-gray-500 mb-2">
              Aún no has agregado subtareas.
            </p>
          ) : (
            <ul className="space-y-1 mb-2 max-h-32 overflow-y-auto">
              {draftDetalles.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 border border-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800">{d.titulo}</span>
                    <span className="text-[11px] text-gray-500">
                      {d.fechaInicio} · {d.diasPlan} días
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-red-400 text-red-500 hover:bg-red-50"
                    onClick={() => handleDeleteDraftDetalle(d.id)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 space-y-2 text-xs">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-gray-700">
                Nueva subtarea
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Título de la subtarea"
                value={subTitulo}
                onChange={(e) => setSubTitulo(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="block text-[11px] font-medium text-gray-700">
                  Responsable
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={subResponsableId}
                  onChange={(e) => setSubResponsableId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {miembrosOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-gray-700">
                  Inicio
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={subFechaInicio}
                  onChange={(e) => setSubFechaInicio(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-gray-700">
                  Días plan
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={subDiasPlan}
                  onChange={(e) => setSubDiasPlan(e.target.value)}
                />
              </div>
            </div>

            {subErr && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                {subErr}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center rounded bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                onClick={handleAddDraftDetalle}
              >
                Agregar subtarea
              </button>
            </div>
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
            onClick={handleClose}
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
            {loading ? "Enviando..." : "Crear todo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}