// src/components/proyectos/tareas/AddTareaButton.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/ui/Modal";
import { makeHeaders } from "@/lib/api";
import DetalleTareaList from "./DetalleTareaList";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AddTareaModal({
  open,
  onClose,
  proyectoId,
  miembros = [],
  tarea, // si viene => editar, si no => crear
  onSaved,
}) {
  const { data: session } = useSession();
  const isEdit = Boolean(tarea?.id);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(""); // plan
  const [diasPlan, setDiasPlan] = useState("");
  const [avance, setAvance] = useState("0");
  const [estado, setEstado] = useState("pendiente");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // -------- SUBTAREAS EN CREACIÓN --------
  const [draftDetalles, setDraftDetalles] = useState([]);
  const [subTitulo, setSubTitulo] = useState("");
  const [subResponsableId, setSubResponsableId] = useState("");
  const [subFechaInicio, setSubFechaInicio] = useState("");
  const [subDiasPlan, setSubDiasPlan] = useState("");
  const [subErr, setSubErr] = useState("");

  function toDateTimeOrNull(value) {
    if (!value) return null;
    return `${value}T00:00:00.000Z`;
  }

  useEffect(() => {
    if (!open) return;

    if (tarea) {
      setNombre(tarea.nombre ?? "");
      setDescripcion(tarea.descripcion ?? "");
      setResponsableId(tarea.responsable_id ?? tarea.responsable?.id ?? "");
      setFechaInicio(
        tarea.fecha_inicio_plan
          ? String(tarea.fecha_inicio_plan).slice(0, 10)
          : ""
      );
      setDiasPlan(
        typeof tarea.dias_plan === "number" && !Number.isNaN(tarea.dias_plan)
          ? String(tarea.dias_plan)
          : ""
      );
      const a =
        typeof tarea.avance === "number" && !Number.isNaN(tarea.avance)
          ? String(tarea.avance)
          : "0";
      setAvance(a);
      setEstado(tarea.estado || "pendiente");
    } else {
      setNombre("");
      setDescripcion("");
      setResponsableId("");
      setFechaInicio("");
      setDiasPlan("");
      setAvance("0");
      setEstado("pendiente");
      // reset subtareas en modo CREAR
      setDraftDetalles([]);
      setSubTitulo("");
      setSubResponsableId("");
      setSubFechaInicio("");
      setSubDiasPlan("");
      setSubErr("");
    }
    setErr("");
  }, [open, tarea]);

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

  const handleAvanceChange = (e) => {
    let value = e.target.value;

    if (value === "") {
      setAvance("0");
      setEstado("pendiente");
      return;
    }

    let n = Number(value);
    if (Number.isNaN(n)) return;

    if (n < 0) n = 0;
    if (n > 100) n = 100;

    setAvance(String(n));

    if (n >= 100) setEstado("completada");
    else if (n > 0) setEstado("en_progreso");
    else setEstado("pendiente");
  };

  // ===== refrescar tarea desde backend cuando cambian subtareas =====
  const refreshTareaFromServer = async () => {
    if (!session?.user || !tarea?.id) return;
    try {
      const res = await fetch(`${API}/tareas/${tarea.id}`, {
        headers: makeHeaders(session),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok && json.row) {
        const t = json.row;
        const a =
          typeof t.avance === "number" && !Number.isNaN(t.avance)
            ? String(t.avance)
            : "0";
        setAvance(a);
        setEstado(t.estado || "pendiente");
        setFechaInicio(
          t.fecha_inicio_plan ? String(t.fecha_inicio_plan).slice(0, 10) : ""
        );
        setDiasPlan(
          typeof t.dias_plan === "number" && !Number.isNaN(t.dias_plan)
            ? String(t.dias_plan)
            : ""
        );
      }
    } catch (e) {
      console.error("Error refrescando tarea después de subtareas", e);
    }
  };

  // ------- alta rápida de SUBTAREA en modo CREAR (SIN <form>) --------
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
      id: crypto.randomUUID(),
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

  function calcFechaFinISO(fechaInicioStr, dias) {
    const diasInt = Number(dias);
    if (!fechaInicioStr || !diasInt || Number.isNaN(diasInt) || diasInt <= 0) {
      return null;
    }

    const base = new Date(fechaInicioStr);
    if (Number.isNaN(base.getTime())) return null;

    const d = new Date(base.getTime());
    // inclusive: 1 día => mismo día, 5 días => +4 días
    d.setDate(d.getDate() + (diasInt - 1));

    return d.toISOString();
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return;

    if (!nombre.trim()) {
      setErr("El nombre de la tarea es obligatorio.");
      return;
    }

    if (!fechaInicio || !diasPlan) {
      setErr("Debes ingresar fecha de inicio plan y días plan (>0).");
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

      const avanceNumber =
        avance !== "" ? Math.min(100, Math.max(0, Number(avance))) : 0;

      // calcular fecha_fin_plan de la TAREA (aunque el backend igual la calcula)
      const fechaFinPlanISO = calcFechaFinISO(fechaInicio, diasPlanNumber);

      // subtareas para enviar sólo en CREAR
      const detallesPayload =
        !isEdit && draftDetalles.length
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
                // fecha_fin_plan no es necesaria para el backend, pero no molesta
                fecha_fin_plan: dFechaFinPlanISO,
              };
            })
          : undefined;

      const baseBody = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        proyecto_id: proyectoId,
        responsable_id: responsableId || null,

        // PLAN
        fecha_inicio_plan: toDateTimeOrNull(fechaInicio),
        dias_plan: diasPlanNumber,
        fecha_fin_plan: fechaFinPlanISO,

        ...(detallesPayload ? { detalles: detallesPayload } : {}),
      };

      const body = isEdit
        ? {
            ...baseBody,
            avance: avanceNumber,
            estado,
          }
        : baseBody;

      const url = isEdit
        ? `${API}/tareas/update/${tarea.id}`
        : `${API}/tareas/add`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.message || json?.msg || "Error al guardar la tarea"
        );
      }

      onSaved?.(json);
    } catch (error) {
      console.error(error);
      setErr(error.message || "Error al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Editar tarea" : "Agregar tarea"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Nombre */}
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
          />
        </div>

        {/* Responsable */}
        <div className="space-y-1">
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

        {/* Fechas plan (inicio + días) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Avance / estado solo en edición */}
        {isEdit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Avance (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={avance}
                onChange={handleAvanceChange}
              />
            </div>
          </div>
        )}

        {/* SUBTAREAS */}
        {!isEdit ? (
          <div className="mt-2 border-t pt-3 text-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Subtareas</span>
              <span className="text-[11px] text-gray-500">
                Se crearán junto con la tarea
              </span>
            </div>

            {/* lista draft */}
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
                      <span className="font-medium text-gray-800">
                        {d.titulo}
                      </span>
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

            {/* formulario rápida subtarea */}
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
        ) : (
          // MODO EDITAR: usamos la lista conectada al backend
          <div className="mt-4 border-t pt-3">
            <DetalleTareaList
              tareaId={tarea.id}
              miembros={miembros}
              onChange={refreshTareaFromServer}
            />
          </div>
        )}

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
            {loading
              ? isEdit
                ? "Guardando..."
                : "Creando..."
              : isEdit
              ? "Guardar cambios"
              : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
