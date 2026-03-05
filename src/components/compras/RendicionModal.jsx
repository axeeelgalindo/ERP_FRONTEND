"use client";

import React, { useEffect, useMemo, useState } from "react";

/** =========================
 *  Helpers UI
 * ========================= */
function toCLP(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function fmtDateDMY(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}-${mm}-${yy}`;
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** =========================
 *  Categorías predefinidas
 * ========================= */
const CATEGORIAS = [
  { value: "", label: "Seleccionar…" },
  { value: "MATERIALES", label: "Materiales" },
  { value: "HERRAMIENTAS", label: "Herramientas" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "ALIMENTACION", label: "Alimentación" },
  { value: "ALOJAMIENTO", label: "Alojamiento" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "PEAJES", label: "Peajes" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "OTROS", label: "Otros" },
];

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeDestino(v) {
  const x = String(v || "PROYECTO").toUpperCase();
  if (!["PROYECTO", "ADMINISTRACION", "TALLER"].includes(x)) return "PROYECTO";
  return x;
}

function normalizeCentro(v) {
  if (v == null || v === "") return null;
  const x = String(v).toUpperCase().trim();
  if (!["PMC", "PUQ"].includes(x)) return null;
  return x;
}

/** =========================
 *  Extraer id desde respuestas variadas del backend
 * ========================= */
function extractId(payload) {
  return (
    payload?.row?.id ??
    payload?.data?.id ??
    payload?.rendicion?.id ??
    payload?.result?.id ??
    payload?.id ??
    ""
  );
}

function extractRow(payload) {
  return payload?.row ?? payload?.data ?? payload?.rendicion ?? payload ?? null;
}

export default function RendicionModal({
  open,
  onClose,
  session,
  apiBase,
  compra,
  makeHeadersJson,
  onSaved, // callback para refrescar compras
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // listado rendiciones compatibles
  const [rendiciones, setRendiciones] = useState([]);
  const [rendicionId, setRendicionId] = useState("");

  // crear rendición inline
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Stepper
  const [step, setStep] = useState(1);

  // form create
  const [r_desc, setR_desc] = useState("");
  const [r_empleadoId, setR_empleadoId] = useState("");
  const [r_items, setR_items] = useState([
    {
      fecha: "",
      descripcion: "",
      monto: "",
      categoria: "",
      comprobante_file: null,
      comprobante_name: "",
    },
  ]);

  // para seleccionar empleado si no tienes empleadoId en sesión
  const [empleados, setEmpleados] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  const compraInfo = useMemo(() => {
    const destino = normalizeDestino(compra?.destino ?? "PROYECTO");
    const centro = normalizeCentro(
      compra?.centro_costo ?? compra?.centroCosto ?? null,
    );
    const proyecto = compra?.proyecto?.nombre ?? "-";
    const proyectoId =
      compra?.proyecto_id ?? compra?.proyectoId ?? compra?.proyecto?.id ?? null;

    return { destino, centro, proyecto, proyectoId };
  }, [compra]);

  function isCompatible(r) {
    const cd = normalizeDestino(compra?.destino ?? "PROYECTO");
    const cc = normalizeCentro(compra?.centro_costo ?? compra?.centroCosto ?? null);
    const cp = compraInfo.proyectoId ? String(compraInfo.proyectoId) : null;

    const rd = normalizeDestino(r?.destino ?? "PROYECTO");
    const rc = normalizeCentro(r?.centro_costo ?? r?.centroCosto ?? null);
    const rp = r?.proyecto_id
      ? String(r.proyecto_id)
      : r?.proyecto?.id
        ? String(r.proyecto.id)
        : null;

    if (cd === "PROYECTO") {
      return rd === "PROYECTO" && cp && rp && cp === rp;
    }

    return rd === cd && cc && rc && cc === rc;
  }

  /** =========================
   *  Cargar rendiciones
   * ========================= */
  async function loadRendiciones() {
    if (!session || !compra) return;
    setLoading(true);
    setErr("");

    const headers = makeHeadersJson(session);

    try {
      const base = `${apiBase}/rendiciones?page=1&pageSize=100&includeDeleted=false`;
      const destino = compraInfo.destino;
      const centro = compraInfo.centro;
      const proyectoId = compraInfo.proyectoId;

      let url = base;

      if (destino === "PROYECTO") {
        if (proyectoId) url += `&proyectoId=${encodeURIComponent(String(proyectoId))}`;
        url += `&destino=PROYECTO`;
      } else {
        url += `&destino=${encodeURIComponent(destino)}`;
        if (centro) url += `&centro_costo=${encodeURIComponent(centro)}`;
      }

      let res = await fetch(url, { headers });
      let payload = await jsonOrNull(res);

      // Fallback legacy
      if (!res.ok) {
        const legacy = `${apiBase}/rendiciones?page=1&pageSize=100&proyectoId=${encodeURIComponent(
          String(proyectoId || ""),
        )}&includeDeleted=false`;
        res = await fetch(legacy, { headers });
        payload = await jsonOrNull(res);
      }

      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || "Error cargando rendiciones");
      }

      const rows = payload?.data || payload?.rows || payload?.items || payload || [];
      const compatibles = Array.isArray(rows) ? rows.filter(isCompatible) : [];

      setRendiciones(compatibles);

      const existing =
        compra?.rendicion_id ?? compra?.rendicionId ?? compra?.rendicion?.id ?? "";
      setRendicionId(existing ? String(existing) : "");
    } catch (e) {
      setErr(e?.message || "Error cargando rendiciones");
    } finally {
      setLoading(false);
    }
  }

  async function loadEmpleados() {
    if (!session) return;
    setEmpLoading(true);
    try {
      const res = await fetch(`${apiBase}/empleados?page=1&pageSize=100`, {
        headers: makeHeadersJson(session),
      });
      const payload = await jsonOrNull(res);
      if (!res.ok) throw new Error(payload?.error || "Error cargando empleados");
      const arr = Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      setEmpleados(arr);
    } catch {
      setEmpleados([]);
    } finally {
      setEmpLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadRendiciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compra?.id]);

  function resetCreateForm() {
    setR_desc("");
    setR_items([
      {
        fecha: "",
        descripcion: "",
        monto: "",
        categoria: "",
        comprobante_file: null,
        comprobante_name: "",
      },
    ]);
    setCreateErr("");

    const u = session?.user || session || {};
    const empId = u?.empleadoId ?? u?.empleado_id ?? u?.empleado?.id ?? "";
    setR_empleadoId(empId ? String(empId) : "");
    setStep(1);
  }

  function addItem() {
    setR_items((prev) => [
      ...prev,
      {
        fecha: "",
        descripcion: "",
        monto: "",
        categoria: "",
        comprobante_file: null,
        comprobante_name: "",
      },
    ]);
  }

  function removeItem(idx) {
    setR_items((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx, key, val) {
    setR_items((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  function handleFile(idx, file) {
    if (!file) {
      updateItem(idx, "comprobante_file", null);
      updateItem(idx, "comprobante_name", "");
      return;
    }
    updateItem(idx, "comprobante_file", file);
    updateItem(idx, "comprobante_name", file.name || "archivo");
  }

  /** =========================
   *  Upload comprobante (multipart)
   * ========================= */
  function buildAuthHeaders(session) {
    const token =
      session?.accessToken ||
      session?.token ||
      session?.user?.token ||
      session?.user?.accessToken ||
      "";

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const empresaId = session?.empresaId || session?.user?.empresaId || "";
    if (empresaId) headers["x-empresa-id"] = String(empresaId);

    return headers;
  }

  async function uploadComprobanteItem(rendId, itemId, file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(
      `${apiBase}/rendiciones/${encodeURIComponent(rendId)}/items/${encodeURIComponent(
        itemId,
      )}/comprobante`,
      {
        method: "POST",
        headers: {
          ...buildAuthHeaders(session),
        },
        body: fd,
      },
    );

    const payload = await jsonOrNull(res);
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || "Error subiendo comprobante");
    }
    return payload;
  }

  /** =========================
   *  Crear rendición inline
   * ========================= */
  async function createInlineRendicion() {
    if (!session || !compra) return;
    setCreateErr("");

    const destino = compraInfo.destino;
    const centro = compraInfo.centro;
    const proyectoId = compraInfo.proyectoId;

    if (!r_empleadoId) return setCreateErr("Selecciona un empleado.");
    if (!r_desc.trim()) return setCreateErr("Ingresa una descripción.");

    if (destino === "PROYECTO") {
      if (!proyectoId) return setCreateErr("La compra no tiene proyecto asociado.");
    } else {
      if (!centro) return setCreateErr("La compra no tiene centro de costo (PMC/PUQ).");
    }

    const items = r_items
      .filter((it) => {
        const hasDesc = String(it.descripcion || "").trim() !== "";
        const hasMonto = String(it.monto || "").trim() !== "";
        return hasDesc || hasMonto || it.comprobante_file;
      })
      .map((it, idx) => ({
        linea: idx + 1,
        fecha: it.fecha ? new Date(it.fecha).toISOString() : new Date().toISOString(),
        descripcion: String(it.descripcion || ""),
        monto: Number(it.monto || 0),
        categoria: it.categoria ? String(it.categoria) : null,
        comprobante_url: null,
      }));

    if (items.length === 0) {
      return setCreateErr("Agrega al menos 1 ítem con monto/descripcion o comprobante.");
    }

    try {
      setCreating(true);

      const body = {
        empleado_id: r_empleadoId,
        proyecto_id: destino === "PROYECTO" ? proyectoId : null,
        destino,
        centro_costo: destino === "PROYECTO" ? null : centro,
        descripcion: r_desc,
        estado: "pendiente",
        items,
      };

      const res = await fetch(`${apiBase}/rendiciones`, {
        method: "POST",
        headers: makeHeadersJson(session),
        body: JSON.stringify(body),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || "Error creando rendición");
      }

      const created = extractRow(payload);
      const createdId = extractId(payload) || created?.id || "";
      const createdItems = created?.items || payload?.items || [];

      if (!createdId) {
        setOpenCreate(false);
        await loadRendiciones();
        setCreateErr(
          "Rendición creada, pero la API no devolvió el id. Se recargó la lista; selecciónala desde el combo.",
        );
        return;
      }

      // Subir comprobantes (si hay archivos)
      for (let i = 0; i < r_items.length; i++) {
        const file = r_items[i]?.comprobante_file;
        if (!file) continue;

        const linea = i + 1;
        const serverItem =
          createdItems.find((x) => Number(x?.linea) === linea) || createdItems[i];

        const itemId = serverItem?.id;
        if (!itemId) {
          throw new Error(
            `Rendición creada, pero no pude subir comprobante del ítem #${linea} (sin itemId).`,
          );
        }

        await uploadComprobanteItem(createdId, itemId, file);
      }

      setOpenCreate(false);

      await loadRendiciones();
      setRendicionId(String(createdId));
    } catch (e) {
      setCreateErr(e?.message || "Error creando rendición");
    } finally {
      setCreating(false);
    }
  }

  async function guardarAsignacion() {
    if (!session || !compra) return;
    setErr("");

    try {
      const res = await fetch(`${apiBase}/compras/${compra.id}/asignar-rendicion`, {
        method: "PATCH",
        headers: makeHeadersJson(session),
        body: JSON.stringify({ rendicion_id: rendicionId || null }),
      });
      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || "Error asignando rendición");
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Error asignando rendición");
    }
  }

  // UI helpers
  const totalItems = useMemo(
    () => r_items.reduce((acc, it) => acc + Number(it.monto || 0), 0),
    [r_items],
  );

  const canGoStep2 = useMemo(() => {
    if (!r_empleadoId) return false;
    if (!r_desc.trim()) return false;
    if (compraInfo.destino === "PROYECTO" && !compraInfo.proyectoId) return false;
    if (compraInfo.destino !== "PROYECTO" && !compraInfo.centro) return false;
    return true;
  }, [r_empleadoId, r_desc, compraInfo]);

  function openCreateModal() {
    resetCreateForm();
    setOpenCreate(true);

    const u = session?.user || session || {};
    const empId = u?.empleadoId ?? u?.empleado_id ?? u?.empleado?.id ?? "";
    if (!empId) loadEmpleados();
  }

  function closeCreateModal() {
    if (creating) return;
    setOpenCreate(false);
    setStep(1);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* =========================
          MODAL SELECCIÓN RENDICIÓN (nuevo look)
      ========================= */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header sticky */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-5 flex justify-between items-start bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Rendición
              </span>

              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                Compra #{compra?.numero ?? "-"}{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal">·</span>{" "}
                {toCLP(compra?.total)}
              </h1>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seleccione una rendición compatible con el destino y proyecto.
            </p>

            {err ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}
          </div>

          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            onClick={onClose}
            type="button"
            title="Cerrar"
          >
            <span className="text-slate-400 text-xl leading-none">✕</span>
          </button>
        </div>

        {/* Info bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">🏢</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Destino:{" "}
              <span className="text-slate-800 dark:text-slate-200 uppercase">
                {safeStr(compraInfo.destino)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">📌</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Proyecto:{" "}
              <span className="text-slate-800 dark:text-slate-200 uppercase tracking-tighter">
                {safeStr(compraInfo.proyecto)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-400 text-sm">📅</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Fecha:{" "}
              <span className="text-slate-800 dark:text-slate-200">
                {fmtDateDMY(compra?.fecha_docto)}
              </span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-4 text-sm text-slate-500">
              Cargando rendiciones…
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-12 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Vincular a Rendición
                </label>

                <div className="relative">
                  <select
                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white transition-all"
                    value={rendicionId}
                    onChange={(e) => setRendicionId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">(Sin rendición seleccionada)</option>

                    {rendiciones.map((r) => (
                      <option key={r.id} value={r.id}>
                        {safeStr(r.codigo ?? r.folio ?? `RD-${String(r.id).slice(-6)}`)} -{" "}
                        {safeStr(r.descripcion)} ({toCLP(r.monto_total)})
                      </option>
                    ))}
                  </select>

                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-slate-400">▾</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={loadRendiciones}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-all text-sm group shadow-sm disabled:opacity-60"
                  >
                    <span className="text-slate-400 group-hover:text-blue-500 transition-colors text-lg">
                      ⟳
                    </span>
                    Recargar lista
                  </button>

                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-all text-sm shadow-md shadow-slate-200 dark:shadow-none"
                  >
                    <span className="text-lg">＋</span>
                    Nueva rendición
                  </button>
                </div>
              </div>

              <div className="md:col-span-12 flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <span className="text-blue-500">ℹ️</span>
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                  Solo se muestran rendiciones que coincidan con el destino{" "}
                  <strong>"{safeStr(compraInfo.destino)}"</strong>{" "}
                  {compraInfo.destino === "PROYECTO" ? (
                    <>
                      y el proyecto <strong>"{safeStr(compraInfo.proyecto)}"</strong>
                    </>
                  ) : (
                    <>
                      y el centro <strong>"{safeStr(compraInfo.centro ?? "-")}"</strong>
                    </>
                  )}{" "}
                  para mantener la integridad contable.
                </p>
              </div>
            </div>
          </div>

          {err ? null : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setRendicionId("")}
            className="px-5 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
            title="Desvincular compra de cualquier rendición"
          >
            Desvincular
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={guardarAsignacion}
              className="px-8 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {/* =========================
          MODAL CREAR RENDICIÓN (Stepper 1/2 + click en 1 o 2)
      ========================= */}
      {openCreate ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreateModal();
          }}
        >
          <div className="bg-white dark:bg-[#020617] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Nueva rendición
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Se creará con <span className="font-semibold">destino/centro</span>{" "}
                  de la compra. Si destino es{" "}
                  <span className="font-semibold">PROYECTO</span>, requiere proyecto.
                </p>
              </div>

              <button
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                onClick={closeCreateModal}
                type="button"
                title="Cerrar"
              >
                <span className="text-slate-400 text-xl leading-none">✕</span>
              </button>
            </div>

            {/* Stepper (clickable 1/2) */}
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 flex justify-center border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-4 w-full max-w-md">
                {/* Step 1 */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex flex-col items-center flex-1 focus:outline-none"
                  title="Ir a Datos Generales"
                >
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-800 font-bold z-10 transition-all duration-300
                      ${
                        step === 1
                          ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                          : "border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                      }
                    `}
                  >
                    1
                  </div>
                  <span
                    className={`text-xs font-semibold mt-2 ${
                      step === 1
                        ? "text-slate-700 dark:text-slate-200"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    Datos Generales
                  </span>
                </button>

                <div className="h-0.5 bg-slate-200 dark:bg-slate-700 flex-1 -mt-6" />

                {/* Step 2 */}
                <button
                  type="button"
                  onClick={() => {
                    // permitir click si step1 está OK
                    if (canGoStep2) setStep(2);
                    else setCreateErr("Completa Empleado y Descripción antes de ir al paso 2.");
                  }}
                  className="flex flex-col items-center flex-1 focus:outline-none"
                  title="Ir a Detalle de Ítems"
                >
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-800 font-bold z-10 transition-all duration-300
                      ${
                        step === 2
                          ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                          : "border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                      }
                    `}
                  >
                    2
                  </div>
                  <span
                    className={`text-xs font-semibold mt-2 ${
                      step === 2
                        ? "text-slate-700 dark:text-slate-200"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    Detalle de Ítems
                  </span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8">
              {createErr ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {createErr}
                </div>
              ) : null}

              {/* STEP 1 */}
              {step === 1 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Empleado *
                        </label>
                        <select
                          className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-slate-900 focus:border-slate-900"
                          value={r_empleadoId}
                          onChange={(e) => setR_empleadoId(e.target.value)}
                          disabled={empLoading}
                        >
                          <option value="">
                            {empLoading ? "Cargando..." : "Seleccionar..."}
                          </option>
                          {empleados.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e?.usuario?.nombre ?? e?.nombre ?? e?.rut ?? e.id}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Si tu sesión ya trae empleadoId, quedará preseleccionado.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Descripción *
                        </label>
                        <textarea
                          className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-slate-900 focus:border-slate-900"
                          placeholder="Ej: Rendición compra de materiales..."
                          rows={3}
                          value={r_desc}
                          onChange={(e) => setR_desc(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2">
                        Destino / Centro
                      </span>

                      <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-lg">
                        <span className="text-slate-400">🏢</span>
                        <span>
                          {safeStr(compraInfo.destino)} · {safeStr(compraInfo.centro ?? "-")}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500">Proyecto:</span>
                          <span className="font-medium dark:text-slate-300">
                            {safeStr(compraInfo.proyecto)}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-xs italic text-slate-400">
                            {compraInfo.destino === "PROYECTO"
                              ? "Requiere proyecto_id (se toma desde la compra)."
                              : "No requiere proyecto_id (se guarda null)."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* STEP 2 */}
              {step === 2 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                      <span className="text-slate-400 mr-2">📋</span>
                      Ítems de la Rendición
                    </h3>

                    <button
                      type="button"
                      className="flex items-center space-x-1 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:opacity-80 transition-opacity"
                      onClick={addItem}
                    >
                      <span className="text-sm">＋</span>
                      <span>Agregar ítem</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {r_items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 relative"
                      >
                        <div className="absolute top-4 right-4 flex space-x-2">
                          {r_items.length > 1 ? (
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              onClick={() => removeItem(idx)}
                              title="Eliminar ítem"
                            >
                              🗑️
                            </button>
                          ) : null}
                        </div>

                        <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase">
                          Ítem #{idx + 1}
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Fecha
                            </label>
                            <input
                              className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-slate-900"
                              type="date"
                              value={it.fecha}
                              onChange={(e) => updateItem(idx, "fecha", e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Monto (CLP)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                $
                              </span>
                              <input
                                className="w-full pl-7 text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-slate-900"
                                placeholder="0"
                                type="number"
                                min={0}
                                value={it.monto}
                                onChange={(e) => updateItem(idx, "monto", e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Categoría
                            </label>
                            <select
                              className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-slate-900"
                              value={it.categoria || ""}
                              onChange={(e) => updateItem(idx, "categoria", e.target.value)}
                            >
                              {CATEGORIAS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Descripción
                            </label>
                            <input
                              className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-slate-900"
                              placeholder="Ej: Taxi / materiales / colación..."
                              type="text"
                              value={it.descripcion}
                              onChange={(e) =>
                                updateItem(idx, "descripcion", e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Comprobante
                            </label>

                            <label className="flex items-center justify-center px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <span className="text-sm text-slate-400 mr-2">⬆️</span>
                              <span className="text-xs text-slate-500">
                                {it.comprobante_name ? "Cambiar archivo" : "Subir archivo"}
                              </span>
                              <input
                                className="hidden"
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) =>
                                  handleFile(idx, e.target.files?.[0] || null)
                                }
                              />
                            </label>

                            {it.comprobante_name ? (
                              <div className="text-[11px] text-slate-500 mt-1 truncate">
                                Archivo: <b>{it.comprobante_name}</b>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 mt-1">
                                Opcional. Se sube después de crear la rendición.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">
                      Total estimado:{" "}
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {toCLP(totalItems)}
                      </span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer stepper */}
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              {step === 1 ? (
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    onClick={closeCreateModal}
                    disabled={creating}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="px-8 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-90 shadow-lg shadow-slate-900/10 transition-all flex items-center disabled:opacity-60"
                    onClick={() => {
                      setCreateErr("");
                      if (!canGoStep2) {
                        setCreateErr("Completa Empleado y Descripción antes de continuar.");
                        return;
                      }
                      setStep(2);
                    }}
                    disabled={creating}
                  >
                    Siguiente
                    <span className="ml-2 text-sm">→</span>
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center"
                    onClick={() => setStep(1)}
                    disabled={creating}
                  >
                    <span className="mr-2 text-sm">←</span>
                    Atrás
                  </button>

                  <div className="flex space-x-3">
                    {/* Si no tienes endpoint de borrador, lo dejamos como UI (no hace nada) */}
                    <button
                      type="button"
                      className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      onClick={() => {
                        setCreateErr("Borrador no implementado (solo UI).");
                      }}
                      disabled={creating}
                    >
                      Guardar Borrador
                    </button>

                    <button
                      type="button"
                      className="px-8 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:opacity-90 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-60"
                      onClick={createInlineRendicion}
                      disabled={creating}
                    >
                      {creating ? "Creando…" : "Crear rendición"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* estilos scrollbar + anim */}
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 10px;
            }
            :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #334155;
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}