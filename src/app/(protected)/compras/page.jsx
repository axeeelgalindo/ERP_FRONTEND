"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";



import ComprasKpis from "@/components/compras/ComprasKpis";
import ImportRcvPanel from "@/components/compras/ImportRcvPanel";
import ComprasTable from "@/components/compras/ComprasTable";
import ComprasPagination from "@/components/compras/ComprasPagination";
import CompraManualModal from "@/components/compras/CompraManualModal";
import QuickProveedorModal from "@/components/compras/QuickProveedorModal";
import VincularCosteoModal from "@/components/compras/VincularCosteoModal";

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

  // ===== Vincular costeos =====
  const [openVincular, setOpenVincular] = useState(false);
  const [compraSel, setCompraSel] = useState(null);

  const [costeosDisponibles, setCosteosDisponibles] = useState([]);
  const [costeosLoading, setCosteosLoading] = useState(false);
  const [costeosErr, setCosteosErr] = useState("");

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

      // ✅ Usar filtros del estado si no se pasan en opts
      const queryQ = opts.q !== undefined ? opts.q : q;
      const queryEstado = opts.estado !== undefined ? opts.estado : estadoFilter;
      const queryPeriodo = opts.periodo !== undefined ? opts.periodo : periodo;

      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(clampPageSize(s)),
      });

      if (queryQ) params.append("q", queryQ);
      if (queryEstado && queryEstado !== "ALL") params.append("estado", queryEstado);
      if (queryPeriodo) params.append("periodo", queryPeriodo);

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
        loadCompras({ page: 1, pageSize, q, estado: estadoFilter, periodo }),
        loadLookups(),
      ]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, q, estadoFilter, periodo]);

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

    const sinVincularCosteo = pageRows.filter((c) => getVincPct(c) < 100).length;

    return { totalMes, pendientesRendicion, sinPdf, sinVincularCosteo };
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
     Vinculación costeos (ventas)
  ========================= */
  async function loadCosteosDisponibles() {
    if (!session) return;
    setCosteosLoading(true);
    setCosteosErr("");

    try {
      const res = await fetch(`${API}/ventas?page=1&pageSize=100`, {
        headers: makeHeadersJson(session),
      });
      const payload = await jsonOrNull(res);

      if (!res.ok) {
        throw new Error(
          payload?.message || payload?.msg || payload?.error || "Error cargando ventas",
        );
      }

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

      const rows = payload?.data || [];

      return rows
        .map((r) => ({
          ventaId: String(r?.venta_id ?? r?.ventaId ?? r?.venta?.id ?? ""),
          monto: Number(r?.monto || 0),
          locked: true,
          meta: r?.venta || null,
        }))
        .filter((x) => x.ventaId);
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

      if (exists) {
        const next = prev.filter((x) => x.ventaId !== ventaId);
        if (next.length === 1) {
          return [{ ...next[0], monto: total, locked: false }];
        }
        return next;
      }

      const next = [...prev, { ventaId, monto: 0, locked: false, meta: venta }];

      if (next.length === 1) {
        return [{ ...next[0], monto: total, locked: false }];
      }

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
        a.ventaId === ventaId ? { ...a, monto, locked: true } : a,
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
      return prev.map((a) => ({ ...a, locked: a.ventaId !== lastId }));
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
          payload?.message || payload?.msg || payload?.error || "Error guardando vinculación",
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

  async function handleRefresh() {
    await Promise.all([loadCompras({ page, pageSize }), loadLookups()]);
  }

  function handleClearFilters() {
    setQ("");
    setEstadoFilter("ALL");
    setPeriodo(defaultPeriodo);
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
          </div>
        </div>

        {/* KPIs */}
        <ComprasKpis
          totalMes={kpis.totalMes}
          pendientesRendicion={kpis.pendientesRendicion}
          sinPdf={kpis.sinPdf}
          sinVincularCosteo={kpis.sinVincularCosteo}
        />

        {/* Import */}
        <ImportRcvPanel
          importing={importing}
          importErr={importErr}
          importResult={importResult}
          onPickFile={() => {}}
          onImportFile={handleImportCSV}
          onClear={() => {
            setImportErr("");
            setImportResult(null);
          }}
        />

        {/* Tabla + filtros */}
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
            q={q}
            onChangeQ={(v) => {
              setQ(v);
              setPage(1);
            }}
            estadoFilter={estadoFilter}
            onChangeEstado={(v) => {
              setEstadoFilter(v);
              setPage(1);
            }}
            periodo={periodo}
            onChangePeriodo={(v) => {
              setPeriodo(v);
              setPage(1);
            }}
            onClear={handleClearFilters}
            pageSize={pageSize}
            onChangePageSize={(v) => {
              const s = clampPageSize(v);
              setPageSize(s);
              setPage(1);
              loadCompras({ page: 1, pageSize: s });
            }}
            uploadingId={uploadingId}
            onOpenVincular={openVincularModal}
            onOpenRendicion={() => {}} // Dis habilitar vinculación desde aquí
            onUploadPdfClick={(c) => openFilePicker(c.id)}
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
        creating={creating}
        createErr={createErr}
        onClose={() => setOpenCreate(false)}
        onSubmit={createCompraManual}
        proveedores={proveedores}
        proyectos={proyectos}
        lookupsLoading={lookupsLoading}
        c_proveedorId={c_proveedorId}
        setC_proveedorId={setC_proveedorId}
        c_destino={c_destino}
        setC_destino={setC_destino}
        c_centro={c_centro}
        setC_centro={setC_centro}
        c_proyectoId={c_proyectoId}
        setC_proyectoId={setC_proyectoId}
        c_tipoDoc={c_tipoDoc}
        setC_tipoDoc={setC_tipoDoc}
        c_folio={c_folio}
        setC_folio={setC_folio}
        c_estado={c_estado}
        setC_estado={setC_estado}
        c_fechaDocto={c_fechaDocto}
        setC_fechaDocto={setC_fechaDocto}
        c_total={c_total}
        setC_total={setC_total}
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

      {/* MODAL VINCULAR COSTEO */}
      <VincularCosteoModal
        open={openVincular}
        onClose={() => {
          if (savingVinc) return;
          setOpenVincular(false);
          setCompraSel(null);
          setAsignaciones([]);
          setSavingErr("");
          setCosteosErr("");
        }}
        compraSel={compraSel}
        costeosDisponibles={costeosDisponibles}
        costeosLoading={costeosLoading}
        costeosErr={costeosErr}
        asignaciones={asignaciones}
        savingVinc={savingVinc}
        savingErr={savingErr}
        canSaveVinc={canSaveVinc}
        diffAsignacion={diffAsignacion}
        onReloadCosteos={loadCosteosDisponibles}
        onToggleCosteo={toggleCosteo}
        isSelected={isSelected}
        onUpdateMonto={updateMonto}
        onResetLocks={resetLocks}
        onSave={saveVinculacion}
        fmtDateDMY={fmtDateDMY}
        toCLP={toCLP}
        sumAsignado={sumAsignado}
      />

    </div>

  );
}