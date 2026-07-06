"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";



import ComprasKpis from "@/components/compras/ComprasKpis";
import ImportRcvPanel from "@/components/compras/ImportRcvPanel";
import ComprasTable from "@/components/compras/ComprasTable";
import ComprasPagination from "@/components/compras/ComprasPagination";
import CompraManualModal from "@/components/compras/CompraManualModal";
import CompraProvOllamaModal from "@/components/compras/CompraProvOllamaModal";
import QuickProveedorModal from "@/components/compras/QuickProveedorModal";
import VincularCotizacionModal from "@/components/compras/VincularCotizacionModal";
import AsignarImputacionModal from "@/components/compras/AsignarImputacionModal";

const API = process.env.NEXT_PUBLIC_API_URL;

/* =========================
   Helpers (tuyos)
========================= */
function pickEmpresaId(session) {
  const u = session?.user || session || {};
  return u.empresaId ?? u.empresa_id ?? u.empresa?.id ?? u.empresa ?? null;
}

function pickToken(session) {
  const u = session?.user || session || {};
  return u.accessToken || session?.accessToken || "";
}

function makeHeadersJson(session) {
  const token = pickToken(session);
  const empresaId = pickEmpresaId(session);

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

function makeHeadersMultipart(session) {
  const token = pickToken(session);
  const empresaId = pickEmpresaId(session);

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
    const x = Number(c.vinculadoPct) * 100;
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

/** ✅ pageSize seguro para no romper validación backend (<=100) */
function clampPageSize(n) {
  const x = Number(n || 20);
  if (!Number.isFinite(x)) return 20;
  return Math.min(100, Math.max(1, x));
}

/* =========================
   Page
========================= */
export default function ComprasPage() {
  const { data: session, status } = useSession();

  // ===== Listado =====
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // filtros UI (igual que costeos)
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState("ALL");
  const [periodoScale, setPeriodoScale] = useState("todo"); // "todo" | "semanal" | "mensual" | "anual"
  const [refDate, setRefDate] = useState(new Date());

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    const curYear = new Date().getFullYear();
    for (let y = curYear - 5; y <= curYear + 1; y++) {
      years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, []);

  const handleScaleSelect = (scale) => {
    setPeriodoScale(scale);
    setRefDate(new Date());
    setPage(1);
  };

  const handleYearSelect = (e) => {
    const nd = new Date(refDate);
    nd.setFullYear(Number(e.target.value));
    setRefDate(nd);
    setPage(1);
  };

  const handleMonthSelect = (e) => {
    const nd = new Date(refDate);
    nd.setMonth(Number(e.target.value));
    setRefDate(nd);
    setPage(1);
  };

  const handleWeekSelect = (e) => {
    const offset = Number(e.target.value);
    const nd = new Date();
    nd.setDate(nd.getDate() + (offset * 7));
    setRefDate(nd);
    setPage(1);
  };

  const hasFilters = periodoScale !== "todo" || filterEstado !== "ALL" || q !== "";

  // ===== Import CSV =====
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState(null);

  // ===== Upload PDF =====
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadErr, setUploadErr] = useState("");
  const fileRefs = useRef({}); // compraId -> input

  // ===== Crear manual (modal) =====
  const [openCreate, setOpenCreate] = useState(false);
  const [openOllama, setOpenOllama] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Campos create
  const [c_proveedorId, setC_proveedorId] = useState("");
  const [c_destino, setC_destino] = useState("PROYECTO");
  const [c_centro, setC_centro] = useState("");
  const [c_proyectoId, setC_proyectoId] = useState("");
  const [c_tipoDoc, setC_tipoDoc] = useState("33");
  const [c_folio, setC_folio] = useState("");
  const [c_fechaDocto, setC_fechaDocto] = useState("");
  const [c_total, setC_total] = useState("");
  const [c_estado, setC_estado] = useState("ORDEN_COMPRA");

  // lookups
  const [proveedores, setProveedores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsErr, setLookupsErr] = useState("");

  // ===== Quick Proveedor =====
  const [openQuickProv, setOpenQuickProv] = useState(false);
  const [quickProvLoading, setQuickProvLoading] = useState(false);
  const [quickProvErr, setQuickProvErr] = useState("");

  // ===== Vincular cotizaciones =====
  const [openVincular, setOpenVincular] = useState(false);
  const [compraSel, setCompraSel] = useState(null);

  const [cotizacionesDisponibles, setCotizacionesDisponibles] = useState([]);
  const [cotizacionesLoading, setCotizacionesLoading] = useState(false);
  const [cotizacionesErr, setCotizacionesErr] = useState("");

  const [selectedCotizacionId, setSelectedCotizacionId] = useState("");
  const [savingVinc, setSavingVinc] = useState(false);
  const [savingErr, setSavingErr] = useState("");

  // ===== Asignar Imputación =====
  const [openImputacion, setOpenImputacion] = useState(false);
  const [compraImputacionSel, setCompraImputacionSel] = useState(null);
  const [savingImputacion, setSavingImputacion] = useState(false);
  const [imputacionErr, setImputacionErr] = useState("");

  // ===== Confirmación de Pago & Toast =====
  const [compraToToggle, setCompraToToggle] = useState(null);
  const [toast, setToast] = useState({ open: false, msg: "", type: "success" });

  const triggerToast = (msg, type = "success") => {
    setToast({ open: true, msg, type });
  };

  useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => {
        setToast((t) => ({ ...t, open: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.open]);

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

      // ✅ Usar filtros del estado si no se pasan en opts
      const queryQ = opts.q !== undefined ? opts.q : q;
      const queryEstado = opts.estado !== undefined ? opts.estado : filterEstado;
      const scale = opts.periodoScale !== undefined ? opts.periodoScale : periodoScale;
      const rDate = opts.refDate !== undefined ? opts.refDate : refDate;

      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(clampPageSize(s)),
      });

      if (queryQ) params.append("q", queryQ);
      if (queryEstado && queryEstado !== "ALL") params.append("estado", queryEstado);

      // Calculamos las fechas de inicio y fin según la escala y la fecha de referencia
      if (scale !== "todo") {
        let start, end;
        if (scale === "semanal") {
          const day = rDate.getDay();
          const diff = rDate.getDate() - day + (day === 0 ? -6 : 1);
          start = new Date(rDate);
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);

          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
        } else if (scale === "mensual") {
          start = new Date(rDate.getFullYear(), rDate.getMonth(), 1, 0, 0, 0, 0);
          end = new Date(rDate.getFullYear(), rDate.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (scale === "anual") {
          start = new Date(rDate.getFullYear(), 0, 1, 0, 0, 0, 0);
          end = new Date(rDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        if (start && end) {
          params.append("startDate", start.toISOString());
          params.append("endDate", end.toISOString());
        }
      }

      const res = await fetch(`${API}/compras?${params.toString()}`, {
        headers: makeHeadersJson(session)
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

      const [pProv, pProy] = await Promise.all([
        jsonOrNull(rProv),
        jsonOrNull(rProy),
      ]);

      if (!rProv.ok)
        throw new Error(
          pProv?.message || pProv?.msg || pProv?.error || "Error proveedores",
        );
      if (!rProy.ok)
        throw new Error(
          pProy?.message || pProy?.msg || pProy?.error || "Error proyectos",
        );

      const provArr = Array.isArray(pProv)
        ? pProv
        : pProv?.rows || pProv?.items || pProv?.data || [];
      const proyArr = Array.isArray(pProy)
        ? pProy
        : pProy?.items || pProy?.rows || pProy?.data || [];

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
      // ✅ Cargar datos cuando cambian los filtros principales
      await Promise.all([
        loadCompras({ page: 1, pageSize, q, estado: filterEstado, periodoScale, refDate }),
        loadLookups(),
      ]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, q, filterEstado, periodoScale, refDate]);

  /* =========================
     Filters client-side
  ========================= */
  const rows = useMemo(() => {
    return bundle?.data || [];
  }, [bundle]);

  /* =========================
     KPIs (en base a lo que tienes disponible)
  ========================= */
  const kpis = useMemo(() => {
    const pageRows = rows || [];
    const totalMes = bundle?.total ?? 0;

    const pendientesRendicion = pageRows.filter((c) => {
      const rid = c?.rendicion_id ?? c?.rendicionId ?? c?.rendicion?.id ?? null;
      return !rid;
    }).length;

    const sinPdf = pageRows.filter((c) => !c?.factura_url).length;

    const sinVincularCotizacion = pageRows.filter((c) => !c?.cotizacionId && !c?.cotizacion?.id).length;

    return { totalMes, pendientesRendicion, sinPdf, sinVincularCotizacion };
  }, [bundle, rows]);

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
        throw new Error(
          payload?.message || payload?.error || "Error subiendo factura",
        );
      }

      await loadCompras({ page, pageSize });
    } catch (e) {
      setUploadErr(e?.message || "Error subiendo factura");
    } finally {
      setUploadingId(null);
    }
  }

  function ensureFileInput(compraId) {
    if (fileRefs.current[compraId]) return;
    // se crea cuando renderiza la tabla (ver abajo)
  }

  function openFilePicker(compraId) {
    ensureFileInput(compraId);
    const ref = fileRefs.current[compraId];
    if (ref) ref.click();
  }

  /* =========================
     Crear compra manual
  ========================= */
  function resetCreateForm() {
    setC_proveedorId("");
    setC_destino("PROYECTO");
    setC_centro("");
    setC_proyectoId("");
    setC_tipoDoc("33");
    setC_folio("");
    setC_fechaDocto("");
    setC_total("");
    setC_estado("ORDEN_COMPRA");
  }

  async function createCompraManual() {
    if (!session) return;
    setCreateErr("");

    if (!c_proveedorId) return setCreateErr("Selecciona un proveedor.");
    if (!c_destino) return setCreateErr("Selecciona destino.");

    if (c_destino === "PROYECTO" && !c_proyectoId) {
      return setCreateErr("Selecciona un proyecto (destino = PROYECTO).");
    }

    if (c_destino !== "PROYECTO" && !c_centro) {
      return setCreateErr("Selecciona centro (PMC/PUQ) para Administración/Taller.");
    }


    if (!c_tipoDoc) return setCreateErr("Selecciona tipo doc.");
    // Folio ya no es obligatorio
    if (!c_fechaDocto) return setCreateErr("Ingresa fecha del documento.");
    if (!c_total || Number(c_total) <= 0)
      return setCreateErr("Ingresa total > 0.");

    try {
      setCreating(true);

      const body = {
        proveedorId: c_proveedorId,
        destino: c_destino,
        centro_costo: c_destino === "PROYECTO" ? null : c_centro,
        proyecto_id: c_destino === "PROYECTO" ? c_proyectoId || null : null,
        tipo_doc: Number(c_tipoDoc),
        folio: String(c_folio),
        fecha_docto: new Date(c_fechaDocto).toISOString(),
        total: Number(c_total),
        estado: c_estado,
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

  async function handleCreateQuickProveedor(data) {
    if (!session) return;
    try {
      setQuickProvLoading(true);
      setQuickProvErr("");

      const res = await fetch(`${API}/proveedores`, {
        method: "POST",
        headers: makeHeadersJson(session),
        body: JSON.stringify(data),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "Error creando proveedor");
      }

      const newProv = payload.row || payload.data || payload;
      // Recargar lookups y auto-seleccionar
      await loadLookups();
      setC_proveedorId(newProv.id);
      setOpenQuickProv(false);
    } catch (e) {
      setQuickProvErr(e?.message || "Error");
    } finally {
      setQuickProvLoading(false);
    }
  }

  /* =========================
     Vinculación Cotizaciones
  ========================= */
  async function loadCotizacionesDisponibles() {
    if (!session) return;
    setCotizacionesLoading(true);
    setCotizacionesErr("");

    try {
      const res = await fetch(`${API}/cotizaciones`, {
        headers: makeHeadersJson(session),
      });
      const payload = await jsonOrNull(res);

      if (!res.ok) {
        throw new Error(
          payload?.error || "Error al cargar cotizaciones"
        );
      }

      setCotizacionesDisponibles(payload || []);
    } catch (e) {
      setCotizacionesErr(e?.message || "Error al cargar cotizaciones");
    } finally {
      setCotizacionesLoading(false);
    }
  }

  async function openVincularModal(compra) {
    setSavingErr("");
    setCotizacionesErr("");
    setCompraSel(compra);
    setSelectedCotizacionId(compra.cotizacionId ?? compra.cotizacion?.id ?? "");
    setOpenVincular(true);

    await loadCotizacionesDisponibles();
  }

  async function saveVinculacion() {
    if (!session || !compraSel) return;

    setSavingErr("");
    setSavingVinc(true);

    try {
      // Vincular compra a la cotización (PUT /compras/:id).
      // El backend alinea automáticamente el destino, proyecto y centros de costo si la cotización tiene un proyecto.
      const res = await fetch(`${API}/compras/${compraSel.id}`, {
        method: "PUT",
        headers: makeHeadersJson(session),
        body: JSON.stringify({
          cotizacionId: selectedCotizacionId || null,
        }),
      });

      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(
          payload?.error || payload?.message || "Error al vincular cotización"
        );
      }

      triggerToast("Vínculo de cotización guardado exitosamente.", "success");
      setOpenVincular(false);
      setCompraSel(null);
      setSelectedCotizacionId("");

      await loadCompras({ page, pageSize });
    } catch (e) {
      setSavingErr(e?.message || "Error al vincular cotización");
    } finally {
      setSavingVinc(false);
    }
  }

  function toggleCompraPago(compra) {
    if (!compra) return;
    setCompraToToggle(compra);
  }

  async function confirmToggleCompraPago() {
    const compra = compraToToggle;
    if (!session || !compra) return;
    const nuevoEstado = compra.estado === "PAGADA" ? "FACTURADA" : "PAGADA";

    // Cerrar el modal de confirmación antes
    setCompraToToggle(null);

    try {
      setErr("");
      const res = await fetch(`${API}/compras/${compra.id}`, {
        method: "PUT",
        headers: makeHeadersJson(session),
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const payload = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "Error al actualizar estado de la compra");
      }

      // Mostrar Toast Exitoso
      const provNombre = compra.proveedor?.nombre || "Proveedor";
      const totalFmt = toCLP(compra.total);
      triggerToast(`Compra de "${provNombre}" (${totalFmt}) cambiada a ${nuevoEstado} exitosamente.`, "success");

      await loadCompras({ page, pageSize });
    } catch (e) {
      const errMsg = e?.message || "Error al actualizar estado de la compra";
      setErr(errMsg);
      triggerToast(errMsg, "error");
    }
  }

  function openImputacionModal(compra) {
    setImputacionErr("");
    setCompraImputacionSel(compra);
    setOpenImputacion(true);
  }

  async function saveImputacion(payload) {
    if (!session || !compraImputacionSel) return;

    setImputacionErr("");
    setSavingImputacion(true);

    try {
      const res = await fetch(`${API}/compras/${compraImputacionSel.id}`, {
        method: "PUT",
        headers: makeHeadersJson(session),
        body: JSON.stringify(payload),
      });

      const data = await jsonOrNull(res);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Error al asignar imputación.");
      }

      triggerToast("Imputación asignada exitosamente.", "success");
      setOpenImputacion(false);
      setCompraImputacionSel(null);
      await loadCompras({ page, pageSize });
    } catch (e) {
      setImputacionErr(e?.message || "Error al guardar imputación.");
    } finally {
      setSavingImputacion(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([loadCompras({ page, pageSize }), loadLookups()]);
  }

  function handleClearFilters() {
    setQ("");
    setFilterEstado("ALL");
    setPeriodoScale("todo");
    setRefDate(new Date());
    setPage(1);
  }

  /* =========================
     Render
  ========================= */
  return (
    <div className="bg-background-light  text-slate-900  min-h-screen transition-colors duration-200">
      <header className=" mx-auto px-6 py-8">
        {/* header top */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 ">
              Compras
            </h1>
            <p className="text-slate-500  mt-1">
              Gestión avanzada de facturas, vinculación a proyectos y rendiciones.
            </p>

            {lookupsErr ? (
              <div className="mt-2 text-xs text-amber-700">{lookupsErr}</div>
            ) : null}

            {uploadErr ? (
              <div className="mt-2 text-xs text-red-700">{uploadErr}</div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading || lookupsLoading}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200  rounded-lg hover:bg-white  transition-all font-medium text-slate-700  disabled:opacity-60"
              type="button"
            >
              ⟳ Recargar
            </button>

            <button
              className="flex items-center gap-2 px-6 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#1e3a8a]/90 transition-all font-bold shadow-lg shadow-blue-900/10"
              onClick={() => {
                setCreateErr("");
                if (proveedores.length === 0 || proyectos.length === 0) {
                  loadLookups();
                }
                setOpenCreate(true);
              }}
              type="button"
            >
              ＋ Crear manual
            </button>

            <button
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg transition-all font-bold shadow-lg shadow-indigo-900/10"
              onClick={() => {
                setCreateErr("");
                if (proveedores.length === 0 || proyectos.length === 0) {
                  loadLookups();
                }
                setOpenOllama(true);
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">psychology</span>
              Crear desde cotización
            </button>
          </div>
        </div>

        {/* KPIs */}
        <ComprasKpis
          totalMes={kpis.totalMes}
          pendientesRendicion={kpis.pendientesRendicion}
          sinPdf={kpis.sinPdf}
          sinVincularCosteo={kpis.sinVincularCotizacion}
        />

        {/* Import */}
        <ImportRcvPanel
          importing={importing}
          importErr={importErr}
          importResult={importResult}
          onPickFile={() => { }}
          onImportFile={handleImportCSV}
          onClear={() => {
            setImportErr("");
            setImportResult(null);
          }}
        />

        {/* Unified Filters for Compras */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 h-[46px] border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                placeholder="Proveedor, RUT, folio, proyecto..."
                type="text"
              />
            </div>

            {/* Status Select */}
            <div className="relative">
              <select
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value);
                  setPage(1);
                }}
                className="w-full h-[46px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Todos los estados</option>
                <option value="ORDEN_COMPRA">ORDEN_COMPRA</option>
                <option value="FACTURADA">FACTURADA</option>
                <option value="PAGADA">PAGADA</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="VINCULADO">VINCULADO</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
            </div>

            {/* Date Filters Trigger scale */}
            <nav className="flex bg-slate-100 p-1 rounded-xl w-full h-[46px] items-center">
              <button
                onClick={() => handleScaleSelect("todo")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition hover:cursor-pointer ${
                  periodoScale === "todo" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => handleScaleSelect("semanal")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition hover:cursor-pointer ${
                  periodoScale === "semanal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => handleScaleSelect("mensual")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition hover:cursor-pointer ${
                  periodoScale === "mensual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => handleScaleSelect("anual")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition hover:cursor-pointer ${
                  periodoScale === "anual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Año
              </button>
            </nav>
          </div>

          {/* Conditional Dropdowns Row */}
          {periodoScale !== "todo" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {periodoScale === "semanal" && (
                <div className="relative w-full sm:w-44">
                  <select
                    onChange={handleWeekSelect}
                    defaultValue={0}
                    className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value={0}>Esta semana</option>
                    <option value={-1}>Semana pasada</option>
                    <option value={-2}>Hace 2 semanas</option>
                    <option value={-3}>Hace 3 semanas</option>
                    <option value={-4}>Hace 4 semanas</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
                </div>
              )}

              {periodoScale === "mensual" && (
                <div className="relative w-full sm:w-40">
                  <select
                    value={refDate.getMonth()}
                    onChange={handleMonthSelect}
                    className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                  >
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
                </div>
              )}

              {(periodoScale === "mensual" || periodoScale === "anual") && (
                <div className="relative w-full sm:w-32">
                  <select
                    value={refDate.getFullYear()}
                    onChange={handleYearSelect}
                    className="w-full h-[40px] px-3 pr-9 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all appearance-none cursor-pointer font-medium"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">▾</span>
                </div>
              )}
            </div>
          )}

          {/* Clean filters link */}
          {hasFilters && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                {bundle?.total ?? 0} compra{bundle?.total !== 1 ? "s" : ""} encontrada{bundle?.total !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleClearFilters}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 hover:cursor-pointer"
              >
                <span>✕</span> Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="rounded-xl overflow-hidden">
          {/* inputs hidden para PDF por fila */}
          {rows.map((c) => (
            <input
              key={`pdf-${c.id}`}
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
          ))}

          <ComprasTable
            API={API}
            loading={loading}
            rows={rows}
            pageSize={pageSize}
            onChangePageSize={(v) => {
              const s = clampPageSize(v);
              setPageSize(s);
              setPage(1);
              loadCompras({ page: 1, pageSize: s });
            }}
            uploadingId={uploadingId}
            onOpenVincular={openVincularModal}
            onOpenRendicion={() => { }} // Dis habilitar vinculación desde aquí
            onUploadPdfClick={(c) => openFilePicker(c.id)}
            onTogglePaid={toggleCompraPago}
            onOpenImputacion={openImputacionModal}
            fmtDateDMY={fmtDateDMY}
            toCLP={toCLP}
            getVincPct={getVincPct}
          />

          <ComprasPagination
            loading={loading}
            page={bundle?.page ?? page}
            pageSize={bundle?.pageSize ?? pageSize}
            total={bundle?.total ?? 0}
            onPrev={() => {
              const p = Math.max(1, (bundle?.page ?? page) - 1);
              setPage(p);
              loadCompras({ page: p });
            }}
            onNext={() => {
              const p = (bundle?.page ?? page) + 1;
              setPage(p);
              loadCompras({ page: p });
            }}
            onGo={(p) => {
              setPage(p);
              loadCompras({ page: p });
            }}
          />
        </div>
      </header>

      <footer className="max-w-[1600px] mx-auto px-6 pb-12 text-center text-slate-400 text-xs">
        <p>© 2026 Blue Ingeniería ERP - Módulo de Gestión de Compras Avanzado.</p>
      </footer>

      {/* MODAL CREAR MANUAL */}
      <CompraManualModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={async (created) => {
          setPage(1);
          await loadCompras({ page: 1, pageSize });
        }}
        API={API}
        session={
          session
            ? {
                token: pickToken(session),
                empresaId: pickEmpresaId(session),
              }
            : null
        }
        proveedores={proveedores}
        proyectos={proyectos}
        lookupsLoading={lookupsLoading}
        onAddProveedorClick={() => {
          setQuickProvErr("");
          setOpenQuickProv(true);
        }}
      />


      {/* MODAL CREAR DESDE COTIZACIÓN PROVEEDOR (OLLAMA AI) */}
      <CompraProvOllamaModal
        open={openOllama}
        onClose={() => setOpenOllama(false)}
        onSuccess={async (created) => {
          setPage(1);
          await loadCompras({ page: 1, pageSize });
        }}
        API={API}
        session={
          session
            ? {
                token: pickToken(session),
                empresaId: pickEmpresaId(session),
              }
            : null
        }
        proveedores={proveedores}
        proyectos={proyectos}
        lookupsLoading={lookupsLoading}
        onAddProveedorClick={() => {
          setQuickProvErr("");
          setOpenQuickProv(true);
        }}
      />

      {/* MODAL QUICK PROVEEDOR */}
      <QuickProveedorModal
        open={openQuickProv}
        onClose={() => setOpenQuickProv(false)}
        onSubmit={handleCreateQuickProveedor}
        creating={quickProvLoading}
        error={quickProvErr}
      />

      {/* MODAL VINCULAR COTIZACIÓN */}
      <VincularCotizacionModal
        open={openVincular}
        onClose={() => {
          if (savingVinc) return;
          setOpenVincular(false);
          setCompraSel(null);
          setSelectedCotizacionId("");
          setSavingErr("");
          setCotizacionesErr("");
        }}
        compraSel={compraSel}
        cotizacionesDisponibles={cotizacionesDisponibles}
        cotizacionesLoading={cotizacionesLoading}
        cotizacionesErr={cotizacionesErr}
        selectedCotizacionId={selectedCotizacionId}
        setSelectedCotizacionId={setSelectedCotizacionId}
        savingVinc={savingVinc}
        savingErr={savingErr}
        onSave={saveVinculacion}
        toCLP={toCLP}
        fmtDateDMY={fmtDateDMY}
      />

      {/* MODAL ASIGNAR IMPUTACIÓN / CENTRO DE COSTO */}
      <AsignarImputacionModal
        open={openImputacion}
        onClose={() => {
          setOpenImputacion(false);
          setCompraImputacionSel(null);
          setImputacionErr("");
        }}
        compraSel={compraImputacionSel}
        proyectos={proyectos}
        onSave={saveImputacion}
        saving={savingImputacion}
        error={imputacionErr}
      />

      {/* ===== MODAL CONFIRMACION DE PAGO ===== */}
      {compraToToggle && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 p-2.5 rounded-xl text-2xl">
                {compraToToggle.estado === "PAGADA" ? "unpublished" : "task_alt"}
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                Confirmar Cambio de Estado
              </h3>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed">
              La compra de <strong>{compraToToggle.proveedor?.nombre || "Proveedor"}</strong> por un monto de <strong>{toCLP(compraToToggle.total)}</strong> se encuentra registrada actualmente como <span className="font-bold">{compraToToggle.estado}</span>.
            </p>

            <p className="text-slate-600 text-sm leading-relaxed">
              ¿Estás seguro de que deseas marcarla como <span className={`font-bold ${compraToToggle.estado === "PAGADA" ? "text-amber-600" : "text-emerald-600"}`}>{compraToToggle.estado === "PAGADA" ? "FACTURADA (No pagada)" : "PAGADA"}</span>?
            </p>

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-slate-100 pt-4">
              <button
                className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-sm"
                type="button"
                onClick={() => setCompraToToggle(null)}
              >
                Cancelar
              </button>
              <button
                className={`px-6 py-2.5 rounded-lg text-white font-bold transition-all text-sm flex items-center gap-2 ${compraToToggle.estado === "PAGADA"
                    ? "bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-900/10"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/10"
                  }`}
                type="button"
                onClick={confirmToggleCompraPago}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DYNAMIC CUSTOM TOAST SYSTEM ===== */}
      {toast.open && (
        <div className="fixed bottom-6 right-6 z-[99999] animate-slide-in">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border ${toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
            <span className="material-symbols-outlined text-xl">
              {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold tracking-tight">
                {toast.type === "success" ? "Acción Completada" : toast.type === "error" ? "Error" : "Notificación"}
              </span>
              <p className="text-xs font-medium opacity-90">{toast.msg}</p>
            </div>
            <button
              onClick={() => setToast((t) => ({ ...t, open: false }))}
              className="ml-4 p-0.5 hover:bg-black/5 rounded text-slate-500 hover:text-slate-800 transition-colors"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>

  );
}