// src/app/(protected)/compras/page.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL;

/* =========================
   Helpers
========================= */
function makeHeadersJson(session) {
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

function makeHeadersMultipart(session) {
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

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

/** ✅ Filtrar SIEMPRE por fecha_docto (RCV) */
function getCompraDate(c) {
  const raw =
    c?.fecha_docto ??
    c?.fecha_emision ??
    c?.fecha ??
    c?.creada_en ??
    c?.createdAt ??
    null;

  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getVincPct(c) {
  if (c?.vinculadoPct != null && Number.isFinite(Number(c.vinculadoPct))) {
    const x = Number(c.vinculadoPct) * 100; // si viene 0..1
    return Math.max(0, Math.min(100, x));
  }

  if (c?.vinculado_pct != null && Number.isFinite(Number(c.vinculado_pct))) {
    const x = Number(c.vinculado_pct);
    return Math.max(0, Math.min(100, x));
  }

  if (
    c?.vinculadoMonto != null &&
    Number.isFinite(Number(c.vinculadoMonto)) &&
    Number(c?.total || 0) > 0
  ) {
    const pct = (Number(c.vinculadoMonto) / Number(c.total)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  if (
    c?.vinculado_monto != null &&
    Number.isFinite(Number(c.vinculado_monto)) &&
    Number(c?.total || 0) > 0
  ) {
    const pct = (Number(c.vinculado_monto) / Number(c.total)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  return 0;
}

function pctBadge(p) {
  const v = Number(p || 0);
  if (v >= 100) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v > 0) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

/** ✅ pageSize seguro para no romper validación backend (<=100) */
function clampPageSize(n) {
  const x = Number(n || 20);
  if (!Number.isFinite(x)) return 20;
  return Math.min(100, Math.max(1, x));
}

/* =========================
   Mini UI helpers (inline)
========================= */
function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border">
        <div className="p-4 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{title}</div>
          </div>
          <button
            className="h-9 w-9 rounded-lg border hover:bg-slate-50"
            onClick={onClose}
            type="button"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer ? <div className="p-4 border-t">{footer}</div> : null}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

/* =========================
   Page
========================= */
export default function ComprasPage() {
  const { data: session, status } = useSession();

  // ===== Listado =====
  const [bundle, setBundle] = useState(null); // {data, total, page, pageSize}
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // filtros UI
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [q, setQ] = useState("");

  // periodo YYYY-MM
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const defaultPeriodo = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const [periodo, setPeriodo] = useState(defaultPeriodo);

  // ===== Import CSV =====
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // ===== Upload PDF =====
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadErr, setUploadErr] = useState("");
  const fileRefs = useRef({}); // compraId -> input

  // ===== Crear manual (modal) =====
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Campos create
  const [c_proveedorId, setC_proveedorId] = useState("");
  const [c_proyectoId, setC_proyectoId] = useState("");
  const [c_tipoDoc, setC_tipoDoc] = useState("33");
  const [c_folio, setC_folio] = useState("");
  const [c_fechaDocto, setC_fechaDocto] = useState("");
  const [c_total, setC_total] = useState("");

  // lookups para selects
  const [proveedores, setProveedores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsErr, setLookupsErr] = useState("");

  // ===== Vincular (modal) =====
  const [openVincular, setOpenVincular] = useState(false);
  const [compraSel, setCompraSel] = useState(null);

  const [costeosDisponibles, setCosteosDisponibles] = useState([]);
  const [costeosLoading, setCosteosLoading] = useState(false);
  const [costeosErr, setCosteosErr] = useState("");

  // asignaciones: [{ ventaId, monto, locked, meta }]
  const [asignaciones, setAsignaciones] = useState([]);
  const [savingVinc, setSavingVinc] = useState(false);
  const [savingErr, setSavingErr] = useState("");

  /* =========================
     Loaders
  ========================= */
  async function loadCompras(opts = {}) {
    const p = opts.page ?? page;
    const s = opts.pageSize ?? pageSize;

    if (status === "loading") return;
    if (!session) {
      setErr("No hay sesión. Inicia sesión para ver compras.");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API}/compras?page=${p}&pageSize=${clampPageSize(s)}`, {
        headers: makeHeadersJson(session),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        const msg =
          payload?.message ||
          payload?.msg ||
          payload?.error ||
          "Error al cargar compras";
        throw new Error(msg);
      }

      setBundle(payload);
    } catch (e) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    if (status === "loading") return;
    if (!session) return;

    try {
      setLookupsLoading(true);
      setLookupsErr("");

      const [rProv, rProy] = await Promise.all([
        fetch(`${API}/proveedores?page=1&pageSize=100`, {
          headers: makeHeadersJson(session),
        }),
        fetch(`${API}/proyectos?page=1&pageSize=100`, {
          headers: makeHeadersJson(session),
        }),
      ]);

      const [pProv, pProy] = await Promise.all([jsonOrNull(rProv), jsonOrNull(rProy)]);

      if (!rProv.ok)
        throw new Error(
          pProv?.message || pProv?.msg || pProv?.error || "Error proveedores"
        );
      if (!rProy.ok)
        throw new Error(
          pProy?.message || pProy?.msg || pProy?.error || "Error proyectos"
        );

      const provArr = Array.isArray(pProv) ? pProv : pProv?.data || [];
      const proyArr = Array.isArray(pProy) ? pProy : pProy?.data || [];

      setProveedores(provArr);
      setProyectos(proyArr);
    } catch (e) {
      setLookupsErr(e?.message || "Error en lookups");
    } finally {
      setLookupsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await Promise.all([loadCompras({ page: 1, pageSize }), loadLookups()]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  /* =========================
     Filters client-side
  ========================= */
  const rows = useMemo(() => {
    const arr = bundle?.data || [];
    const term = String(q || "").trim().toLowerCase();

    return arr.filter((c) => {
      if (estadoFilter !== "ALL" && String(c.estado) !== estadoFilter) return false;

      if (periodo) {
        const d = getCompraDate(c);
        if (!d) return false;

        const [py, pm] = String(periodo).split("-").map(Number);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;

        if (y !== py) return false;
        if (m !== pm) return false;
      }

      if (!term) return true;

      const proveedorNombre = c?.proveedor?.nombre ?? "";
      const rut = c?.rut_proveedor ?? c?.proveedor?.rut ?? "";
      const razon = c?.razon_social ?? "";
      const folio = c?.folio ?? "";
      const tipoDoc = c?.tipo_doc ?? "";
      const proyecto = c?.proyecto?.nombre ?? "";

      const hay = [proveedorNombre, rut, razon, folio, tipoDoc, proyecto, c?.numero ?? ""]
        .join(" ")
        .toLowerCase();

      return hay.includes(term);
    });
  }, [bundle, q, estadoFilter, periodo]);

  const stats = useMemo(() => {
    const pageTotal = rows.reduce((acc, r) => acc + Number(r?.total ?? 0), 0);
    return { pageTotal };
  }, [rows]);

  const pendientesPeriodo = useMemo(() => {
    return rows.filter((c) => getVincPct(c) < 100).length;
  }, [rows]);

  /* =========================
     Import CSV
  ========================= */
  async function handleImportCSV(file) {
    if (!session || !file) return;

    try {
      setImporting(true);
      setImportErr("");
      setImportResult(null);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API}/compras/import-csv`, {
        method: "POST",
        headers: makeHeadersMultipart(session),
        body: fd,
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        const msg =
          payload?.message ||
          payload?.msg ||
          payload?.error ||
          payload?.detalle ||
          "Error importando CSV";
        throw new Error(msg);
      }

      setImportResult(payload);

      setPage(1);
      await loadCompras({ page: 1, pageSize });
      await loadLookups();
    } catch (e) {
      setImportErr(e?.message || "Error importando CSV");
    } finally {
      setImporting(false);
    }
  }

  /* =========================
     Upload PDF
  ========================= */
  async function uploadFactura(compraId, file) {
    if (!session || !file) return;

    setUploadErr("");
    setUploadingId(compraId);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API}/compras/${compraId}/factura`, {
        method: "POST",
        headers: makeHeadersMultipart(session),
        body: fd,
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "Error subiendo factura");
      }

      await loadCompras({ page, pageSize });
    } catch (e) {
      setUploadErr(e?.message || "Error subiendo factura");
    } finally {
      setUploadingId(null);
    }
  }

  function openFilePicker(compraId) {
    const ref = fileRefs.current[compraId];
    if (ref) ref.click();
  }

  /* =========================
     Crear compra manual
  ========================= */
  function resetCreateForm() {
    setC_proveedorId("");
    setC_proyectoId("");
    setC_tipoDoc("33");
    setC_folio("");
    setC_fechaDocto("");
    setC_total("");
  }

  async function createCompraManual() {
    if (!session) return;
    setCreateErr("");

    if (!c_proveedorId) return setCreateErr("Selecciona un proveedor.");
    if (!c_tipoDoc) return setCreateErr("Selecciona tipo doc.");
    if (!c_folio) return setCreateErr("Ingresa folio.");
    if (!c_fechaDocto) return setCreateErr("Ingresa fecha del documento.");
    if (!c_total || Number(c_total) <= 0) return setCreateErr("Ingresa total > 0.");

    try {
      setCreating(true);

      const body = {
        proveedorId: c_proveedorId,
        proyectoId: c_proyectoId || null,
        tipo_doc: String(c_tipoDoc),
        folio: String(c_folio),
        fecha_docto: new Date(c_fechaDocto).toISOString(),
        total: Number(c_total),
      };

      const res = await fetch(`${API}/compras`, {
        method: "POST",
        headers: makeHeadersJson(session),
        body: JSON.stringify(body),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "Error creando compra");
      }

      setOpenCreate(false);
      resetCreateForm();
      setPage(1);
      await loadCompras({ page: 1, pageSize });
    } catch (e) {
      setCreateErr(e?.message || "Error creando compra");
    } finally {
      setCreating(false);
    }
  }

  /* =========================
     Vinculación costeos (ventas)
     ✅ FIXES:
     - pageSize <= 100
     - GET /compras/:id/costeos lee payload.data (tu backend devuelve { data: rows })
     - PUT /compras/:id/costeos envía { items: [{ venta_id, monto }] }
========================= */
  async function loadCosteosDisponibles() {
    if (!session) return;
    setCosteosLoading(true);
    setCosteosErr("");

    try {
      // ✅ no pases 300 (tu backend valida max 100)
      const res = await fetch(`${API}/ventas?page=1&pageSize=100`, {
        headers: makeHeadersJson(session),
      });
      const payload = await jsonOrNull(res);

      if (!res.ok) {
        throw new Error(payload?.message || payload?.msg || payload?.error || "Error cargando ventas");
      }

      // soporta: { data: [...] } o array directo (por si tu endpoint cambia)
      const arr = Array.isArray(payload) ? payload : payload?.data || [];
      setCosteosDisponibles(arr);
    } catch (e) {
      setCosteosErr(e?.message || "Error cargando ventas");
    } finally {
      setCosteosLoading(false);
    }
  }

  async function loadCosteosCompra(compraId) {
    if (!session) return [];
    try {
      const res = await fetch(`${API}/compras/${compraId}/costeos`, {
        headers: makeHeadersJson(session),
      });
      const payload = await jsonOrNull(res);
      if (!res.ok) return [];

      // ✅ tu backend devuelve: { data: rows }
      const rows = payload?.data || [];

      return rows.map((r) => ({
        ventaId: String(r?.venta_id ?? r?.ventaId ?? r?.venta?.id ?? ""),
        monto: Number(r?.monto || 0),
        locked: true,
        meta: r?.venta || null,
      })).filter((x) => x.ventaId);
    } catch {
      return [];
    }
  }

  async function openVincularModal(compra) {
    setSavingErr("");
    setCosteosErr("");
    setCompraSel(compra);
    setOpenVincular(true);

    await loadCosteosDisponibles();

    const current = await loadCosteosCompra(compra.id);
    setAsignaciones(current.length ? current : []);
  }

  function totalCompraSel() {
    return Number(compraSel?.total || 0);
  }

  function sumAsignado(list = asignaciones) {
    return list.reduce((acc, a) => acc + Number(a.monto || 0), 0);
  }

  function isSelected(ventaId) {
    return asignaciones.some((a) => a.ventaId === ventaId);
  }

  function toggleCosteo(venta) {
    const ventaId = String(venta.id);
    const total = totalCompraSel();

    setAsignaciones((prev) => {
      const exists = prev.find((x) => x.ventaId === ventaId);

      // quitar
      if (exists) {
        const next = prev.filter((x) => x.ventaId !== ventaId);
        if (next.length === 1) {
          return [{ ...next[0], monto: total, locked: false }];
        }
        return next;
      }

      // agregar
      const next = [...prev, { ventaId, monto: 0, locked: false, meta: venta }];

      if (next.length === 1) {
        return [{ ...next[0], monto: total, locked: false }];
      }

      // divide simple
      const base = Math.floor(total / next.length);
      const copy = next.map((a, idx) => ({
        ...a,
        monto: idx === next.length - 1 ? total - base * (next.length - 1) : base,
        locked: false,
      }));
      return copy;
    });
  }

  function updateMonto(ventaId, montoRaw) {
    const monto = Math.max(0, Number(montoRaw || 0));
    const total = totalCompraSel();

    setAsignaciones((prev) => {
      const next = prev.map((a) =>
        a.ventaId === ventaId ? { ...a, monto, locked: true } : a
      );

      const unlocked = next.filter((a) => !a.locked);
      if (unlocked.length === 0) return next;

      const sumLocked = next
        .filter((a) => a.locked)
        .reduce((acc, a) => acc + Number(a.monto || 0), 0);

      const restante = Math.max(0, total - sumLocked);

      const unlockedIds = unlocked.map((u) => u.ventaId);
      const lastUnlockedId = unlockedIds[unlockedIds.length - 1];

      return next.map((a) => {
        if (!a.locked && a.ventaId === lastUnlockedId) {
          return { ...a, monto: restante };
        }
        if (!a.locked && a.ventaId !== lastUnlockedId) {
          return { ...a, monto: 0 };
        }
        return a;
      });
    });
  }

  function resetLocks() {
    setAsignaciones((prev) => {
      if (prev.length <= 1) return prev.map((a) => ({ ...a, locked: false }));
      const lastId = prev[prev.length - 1].ventaId;
      return prev.map((a) => ({
        ...a,
        locked: a.ventaId !== lastId,
      }));
    });
  }

  const diffAsignacion = useMemo(() => {
    const total = totalCompraSel();
    const sum = sumAsignado();
    return Math.round((sum - total) * 100) / 100;
  }, [asignaciones, compraSel]);

  const canSaveVinc = useMemo(() => {
    const total = totalCompraSel();
    const sum = sumAsignado();
    if (!compraSel) return false;
    if (asignaciones.length === 0) return false;
    return Math.abs(sum - total) <= 0.01;
  }, [asignaciones, compraSel]);

  async function saveVinculacion() {
    if (!session || !compraSel) return;

    setSavingErr("");
    setSavingVinc(true);

    try {
      // ✅ BACKEND ESPERA: { items: [{ venta_id, monto }] }
      const body = {
        items: asignaciones.map((a) => ({
          venta_id: a.ventaId,
          monto: Number(a.monto || 0),
        })),
      };

      const res = await fetch(`${API}/compras/${compraSel.id}/costeos`, {
        method: "PUT",
        headers: makeHeadersJson(session),
        body: JSON.stringify(body),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(
          payload?.message || payload?.msg || payload?.error || "Error guardando vinculación"
        );
      }

      setOpenVincular(false);
      setCompraSel(null);
      setAsignaciones([]);

      await loadCompras({ page, pageSize });
    } catch (e) {
      setSavingErr(e?.message || "Error guardando vinculación");
    } finally {
      setSavingVinc(false);
    }
  }

  /* =========================
     Effects
  ========================= */
  async function handleRefresh() {
    await Promise.all([loadCompras({ page, pageSize }), loadLookups()]);
  }

  /* =========================
     Render
  ========================= */
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ===== Header ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold">Compras</h1>
              <p className="mt-1 text-sm text-slate-500">
                Importa el CSV RCV del SII, vincula a costeos y sube facturas en PDF.
              </p>
              {lookupsErr && (
                <div className="mt-2 text-xs text-amber-700">{lookupsErr}</div>
              )}
              {uploadErr && (
                <div className="mt-2 text-xs text-red-700">{uploadErr}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total registros" value={bundle?.total ?? 0} />
              <StatBox label="Total página" value={toCLP(stats.pageTotal)} />
              <StatBox label="Página" value={bundle?.page ?? page} />
              <StatBox label="Tamaño pág." value={bundle?.pageSize ?? pageSize} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
              onClick={handleRefresh}
              disabled={loading || lookupsLoading}
              type="button"
            >
              {loading || lookupsLoading ? "Cargando…" : "Recargar"}
            </button>

            <button
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:opacity-90"
              onClick={() => {
                setCreateErr("");
                if (proveedores.length === 0 || proyectos.length === 0) {
                  loadLookups();
                }
                setOpenCreate(true);
              }}
              type="button"
            >
              + Crear manual
            </button>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>
      </div>

      {/* ===== Import RCV ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="px-4 md:px-5 py-4 border-b">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Importar RCV</h2>
            <p className="text-sm text-slate-500">
              Sube el CSV exportado desde el SII (RCV Compras).
            </p>
          </div>
        </div>

        <div className="px-4 md:px-5 py-4 space-y-3">
          {periodo && pendientesPeriodo > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Hay <b>{pendientesPeriodo}</b> compra(s) del periodo <b>{periodo}</b>{" "}
              que aún no están <b>100%</b> vinculadas a un costeo.
            </div>
          )}

          {importErr && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {importErr}
            </div>
          )}

          {importResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Importación OK:{" "}
              <b>
                {importResult?.insertados ??
                  importResult?.created ??
                  importResult?.ok ??
                  "OK"}
              </b>
              {importResult?.skipped != null ? (
                <>
                  {" "}
                  · Saltados: <b>{importResult.skipped}</b>
                </>
              ) : null}
            </div>
          )}

          <input
            ref={importFileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleImportCSV(f);
            }}
          />

          <div
            className={`rounded-xl border-2 border-dashed p-4 md:p-5 ${
              dragOver ? "border-slate-500 bg-slate-50" : "border-slate-200"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleImportCSV(f);
            }}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Arrastra un CSV aquí o selecciónalo</div>
                <div className="text-xs text-slate-500 mt-1">
                  Tip: si importas el mismo documento (mismo proveedor + tipo doc + folio),
                  debería marcarlo como <b>saltado</b>.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  type="button"
                >
                  Seleccionar
                </button>

                <button
                  className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:opacity-90 disabled:opacity-60"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  type="button"
                >
                  {importing ? "Importando…" : "Importar"}
                </button>

                <button
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
                  onClick={() => {
                    setImportErr("");
                    setImportResult(null);
                  }}
                  type="button"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Listado ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 md:p-5 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Listado de compras</h2>
              <p className="text-sm text-slate-500">
                Documentos importados desde RCV (SII) + compras manuales.
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Estado</span>
                <select
                  className="h-9 rounded-lg border px-2 text-sm bg-white"
                  value={estadoFilter}
                  onChange={(e) => {
                    setEstadoFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Todos</option>
                  <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
                  <option value="FACTURADA">FACTURADA</option>
                  <option value="PAGADA">PAGADA</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Periodo</span>

                <input
                  type="month"
                  className="h-9 rounded-lg border px-2 text-sm bg-white"
                  value={periodo}
                  onChange={(e) => {
                    setPeriodo(e.target.value);
                    setPage(1);
                  }}
                />

                <button
                  type="button"
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => {
                    setPeriodo("");
                    setPage(1);
                  }}
                  disabled={!periodo}
                >
                  Limpiar
                </button>
              </div>

              <input
                className="h-9 w-full md:w-96 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Buscar por proveedor, RUT, folio, tipo doc, proyecto…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <div>
              Mostrando <b>{rows.length}</b> en esta página · Total registros:{" "}
              <b>{bundle?.total ?? 0}</b>
            </div>

            <div className="flex items-center gap-2">
              <span>Tamaño pág:</span>
              <select
                className="h-8 rounded-lg border px-2 bg-white text-xs"
                value={pageSize}
                onChange={(e) => {
                  const s = clampPageSize(e.target.value);
                  setPageSize(s);
                  setPage(1);
                  loadCompras({ page: 1, pageSize: s });
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-auto rounded-xl border">
            <table className="min-w-[1400px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="px-3 py-2">N°</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">RUT</th>
                  <th className="px-3 py-2">Tipo doc</th>
                  <th className="px-3 py-2">Folio</th>
                  <th className="px-3 py-2">Fecha docto</th>
                  <th className="px-3 py-2">Recepción</th>
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2">Vinculado</th>
                  <th className="px-3 py-2">PDF</th>
                  <th className="px-3 py-2">Acciones</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-3 text-slate-400" colSpan={14}>
                        Cargando…
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr className="border-t">
                    <td className="px-3 py-3 text-slate-500" colSpan={14}>
                      No hay compras para mostrar.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => {
                    const proveedor = c?.proveedor?.nombre ?? "-";
                    const rut = c?.rut_proveedor ?? c?.proveedor?.rut ?? "-";
                    const proyecto = c?.proyecto?.nombre ?? "-";
                    const pct = getVincPct(c);
                    const hasPdf = Boolean(c?.factura_url);

                    return (
                      <tr key={c.id} className="border-t hover:bg-slate-50/60">
                        <td className="px-3 py-3">{c?.numero ?? "-"}</td>

                        <td className="px-3 py-3">
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-white">
                            {String(c?.estado ?? "-")}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium">{proveedor}</div>
                          <div className="text-xs text-slate-500">{rut}</div>
                        </td>

                        <td className="px-3 py-3">{rut}</td>
                        <td className="px-3 py-3">{c?.tipo_doc ?? "-"}</td>
                        <td className="px-3 py-3">{c?.folio ?? "-"}</td>
                        <td className="px-3 py-3">{fmtDateDMY(c?.fecha_docto)}</td>
                        <td className="px-3 py-3">{fmtDateDMY(c?.fecha_recepcion)}</td>
                        <td className="px-3 py-3">{proyecto}</td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${pctBadge(
                              pct
                            )}`}
                            title="Porcentaje de vinculación al costeo"
                          >
                            {Math.round(pct)}%
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          {hasPdf ? (
                            <a
                              href={`${API.replace(/\/$/, "")}${c.factura_url}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver factura PDF"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border hover:bg-slate-50"
                            >
                              📄
                            </a>
                          ) : (
                            <span
                              title="Sin factura"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border bg-white text-slate-400"
                            >
                              ✕
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="h-8 rounded-lg border px-2 text-xs hover:bg-slate-50"
                              onClick={() => openVincularModal(c)}
                            >
                              Vincular
                            </button>

                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              ref={(el) => {
                                if (el) fileRefs.current[c.id] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) uploadFactura(c.id, file);
                              }}
                            />

                            <button
                              type="button"
                              className="h-8 rounded-lg border px-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => openFilePicker(c.id)}
                              disabled={uploadingId === c.id}
                              title="Subir factura PDF"
                            >
                              {uploadingId === c.id ? "Subiendo…" : "Subir PDF"}
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-semibold">
                          {toCLP(c?.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ===== Paginación ===== */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Página <b>{bundle?.page ?? page}</b>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={loading || (bundle?.page ?? page) <= 1}
                onClick={() => {
                  const p = Math.max(1, (bundle?.page ?? page) - 1);
                  setPage(p);
                  loadCompras({ page: p });
                }}
              >
                ← Anterior
              </button>

              <button
                className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={
                  loading ||
                  ((bundle?.page ?? page) * (bundle?.pageSize ?? pageSize) >=
                    (bundle?.total ?? 0))
                }
                onClick={() => {
                  const p = (bundle?.page ?? page) + 1;
                  setPage(p);
                  loadCompras({ page: p });
                }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================
          MODAL CREAR MANUAL
      ========================= */}
      <Modal
        open={openCreate}
        title="Crear compra manual"
        onClose={() => {
          if (!creating) setOpenCreate(false);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
              onClick={() => setOpenCreate(false)}
              disabled={creating}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:opacity-90 disabled:opacity-60"
              onClick={createCompraManual}
              disabled={creating}
              type="button"
            >
              {creating ? "Creando…" : "Crear"}
            </button>
          </div>
        }
      >
        {createErr && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {createErr}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Proveedor *</div>
            <select
              className="h-10 w-full rounded-lg border px-2 text-sm bg-white"
              value={c_proveedorId}
              onChange={(e) => setC_proveedorId(e.target.value)}
              disabled={lookupsLoading}
            >
              <option value="">Seleccionar…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ?? p.razon_social ?? p.rut ?? p.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Proyecto</div>
            <select
              className="h-10 w-full rounded-lg border px-2 text-sm bg-white"
              value={c_proyectoId}
              onChange={(e) => setC_proyectoId(e.target.value)}
              disabled={lookupsLoading}
            >
              <option value="">(Sin proyecto)</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ?? p.codigo ?? p.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Tipo doc *</div>
            <select
              className="h-10 w-full rounded-lg border px-2 text-sm bg-white"
              value={c_tipoDoc}
              onChange={(e) => setC_tipoDoc(e.target.value)}
            >
              <option value="33">33 - Factura</option>
              <option value="61">61 - Nota crédito</option>
              <option value="34">34 - Factura exenta</option>
              <option value="56">56 - Nota débito</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Folio *</div>
            <input
              className="h-10 w-full rounded-lg border px-3 text-sm"
              value={c_folio}
              onChange={(e) => setC_folio(e.target.value)}
              placeholder="Ej: 1541"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Fecha docto *</div>
            <input
              type="date"
              className="h-10 w-full rounded-lg border px-3 text-sm"
              value={c_fechaDocto}
              onChange={(e) => setC_fechaDocto(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Total (CLP) *</div>
            <input
              type="number"
              className="h-10 w-full rounded-lg border px-3 text-sm"
              value={c_total}
              onChange={(e) => setC_total(e.target.value)}
              placeholder="Ej: 250000"
              min={0}
            />
          </label>
        </div>

        {lookupsLoading && (
          <div className="mt-3 text-xs text-slate-500">Cargando listas…</div>
        )}
      </Modal>

      {/* =========================
          MODAL VINCULAR
      ========================= */}
      <Modal
        open={openVincular}
        title={
          compraSel
            ? `Vincular compra #${compraSel?.numero ?? "-"} · Total ${toCLP(
                compraSel?.total
              )}`
            : "Vincular compra"
        }
        onClose={() => {
          if (savingVinc) return;
          setOpenVincular(false);
          setCompraSel(null);
          setAsignaciones([]);
          setSavingErr("");
          setCosteosErr("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
              onClick={() => {
                setOpenVincular(false);
                setCompraSel(null);
                setAsignaciones([]);
                setSavingErr("");
                setCosteosErr("");
              }}
              disabled={savingVinc}
              type="button"
            >
              Cancelar
            </button>

            <button
              className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
              onClick={resetLocks}
              disabled={asignaciones.length === 0 || savingVinc}
              type="button"
              title="Dejar último como autoajustable"
            >
              Autoajustar
            </button>

            <button
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm text-white hover:opacity-90 disabled:opacity-60"
              onClick={saveVinculacion}
              disabled={!canSaveVinc || savingVinc}
              type="button"
            >
              {savingVinc ? "Guardando…" : "Guardar"}
            </button>
          </div>
        }
      >
        {costeosErr && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {costeosErr}
          </div>
        )}

        {savingErr && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {savingErr}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lista ventas */} 
          <div className="rounded-xl border">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold text-sm">Costeos disponibles (ventas)</div>
              <button
                className="h-8 rounded-lg border px-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                onClick={loadCosteosDisponibles}
                disabled={costeosLoading}
                type="button"
              >
                {costeosLoading ? "Cargando…" : "Recargar"}
              </button>
            </div>

            <div className="max-h-[360px] overflow-auto p-2">
              {costeosLoading ? (
                <div className="p-3 text-sm text-slate-500">Cargando…</div>
              ) : costeosDisponibles.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">No hay ventas.</div>
              ) : (
                costeosDisponibles.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected(String(v.id))}
                      onChange={() => toggleCosteo(v)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        #{v.numero ?? "-"} {v.descripcion ?? "Sin descripción"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {v.fecha ? fmtDateDMY(v.fecha) : "-"}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Asignación */} 
          <div className="rounded-xl border">
            <div className="p-3 border-b">
              <div className="font-semibold text-sm">Asignación</div>
              <div className="text-xs text-slate-500 mt-1">
                Selecciona 1+ ventas. La suma debe ser igual al total de la compra.
              </div>
            </div>

            <div className="p-3 space-y-2">
              {asignaciones.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Selecciona 1 o más ventas para asignar el total.
                </div>
              ) : (
                <>
                  {asignaciones.map((a) => {
                    const meta =
                      a.meta ||
                      costeosDisponibles.find((x) => String(x.id) === String(a.ventaId)) ||
                      null;

                    return (
                      <div
                        key={a.ventaId}
                        className="flex items-center gap-2 rounded-xl border p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            #{meta?.numero ?? "-"} {meta?.descripcion ?? a.ventaId}
                          </div>
                          <div className="text-xs text-slate-500">
                            {a.locked ? "Fijo" : "Auto"}
                          </div>
                        </div>

                        <input
                          type="number"
                          className="h-9 w-40 rounded-lg border px-2 text-sm"
                          value={Number(a.monto || 0)}
                          onChange={(e) => updateMonto(a.ventaId, e.target.value)}
                          min={0}
                        />
                      </div>
                    );
                  })}

                  <div className="pt-2 border-t text-sm flex items-center justify-between">
                    <div className="text-slate-600">
                      Suma: <b>{toCLP(sumAsignado())}</b>
                    </div>
                    <div
                      className={
                        Math.abs(diffAsignacion) <= 0.01
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }
                    >
                      Diferencia: <b>{toCLP(diffAsignacion)}</b>
                    </div>
                  </div>

                  {!canSaveVinc && (
                    <div className="text-xs text-amber-700">
                      La suma debe ser exactamente igual al total de la compra.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
