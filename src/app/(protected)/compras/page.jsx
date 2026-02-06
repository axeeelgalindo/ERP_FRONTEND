// src/app/(protected)/compras/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import ImportComprasBar from "@/components/compras/ImportComprasBar";
import ComprasTable from "@/components/compras/ComprasTable";
import CreateCompraModal from "@/components/compras/CreateCompraModal";
import StatsCards from "@/components/compras/StatsCards";

const API = process.env.NEXT_PUBLIC_API_URL;

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

/** ✅ Filtrar SIEMPRE por fecha_docto (RCV) */
function getCompraDate(c) {
  const raw =
    c?.fecha_docto ?? // ✅ este es el bueno
    c?.fecha_emision ??
    c?.fecha ??
    c?.creada_en ??
    c?.createdAt ??
    null;

  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

  // ✅ Periodo tipo HH: "YYYY-MM" (input type="month")
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const defaultPeriodo = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  // Si quieres que NO filtre por defecto, déjalo en ""
  const [periodo, setPeriodo] = useState(defaultPeriodo);

  // ===== Modal crear manual =====
  const [openCreate, setOpenCreate] = useState(false);

  // ===== Import CSV =====
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importResult, setImportResult] = useState(null);

  // ===== Lookups (para crear manual) =====
  const [proveedores, setProveedores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [productos, setProductos] = useState([]);

  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsErr, setLookupsErr] = useState("");

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

      const res = await fetch(`${API}/compras?page=${p}&pageSize=${s}`, {
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

      // tu backend: pageSize <= 100
      const [rProv, rProy, rProd] = await Promise.all([
        fetch(`${API}/proveedores?page=1&pageSize=100`, {
          headers: makeHeadersJson(session),
        }),
        fetch(`${API}/proyectos?page=1&pageSize=100`, {
          headers: makeHeadersJson(session),
        }),
        fetch(`${API}/productos?page=1&pageSize=100`, {
          headers: makeHeadersJson(session),
        }),
      ]);

      const [pProv, pProy, pProd] = await Promise.all([
        jsonOrNull(rProv),
        jsonOrNull(rProy),
        jsonOrNull(rProd),
      ]);

      if (!rProv.ok)
        throw new Error(
          pProv?.message ||
            pProv?.msg ||
            pProv?.error ||
            "Error al cargar proveedores"
        );
      if (!rProy.ok)
        throw new Error(
          pProy?.message ||
            pProy?.msg ||
            pProy?.error ||
            "Error al cargar proyectos"
        );
      if (!rProd.ok)
        throw new Error(
          pProd?.message ||
            pProd?.msg ||
            pProd?.error ||
            "Error al cargar productos"
        );

      const provArr = Array.isArray(pProv) ? pProv : pProv?.data || [];
      const proyArr = Array.isArray(pProy) ? pProy : pProy?.data || [];
      const prodArr = Array.isArray(pProd) ? pProd : pProd?.data || [];

      setProveedores(provArr);
      setProyectos(proyArr);
      setProductos(prodArr);
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

  // --- filtros client-side (rápido y útil para UX)
  const rows = useMemo(() => {
    const arr = bundle?.data || [];
    const term = String(q || "").trim().toLowerCase();

    return arr.filter((c) => {
      if (estadoFilter !== "ALL" && String(c.estado) !== estadoFilter)
        return false;

      // ✅ filtro por periodo (YYYY-MM) usando fecha_docto
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

      const hay = [
        proveedorNombre,
        rut,
        razon,
        folio,
        tipoDoc,
        proyecto,
        c?.numero ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(term);
    });
  }, [bundle, q, estadoFilter, periodo]);

  // stats
  const stats = useMemo(() => {
    const totalReg = bundle?.total ?? 0;
    const pageTotal = rows.reduce((acc, r) => acc + Number(r?.total ?? 0), 0);
    return { totalReg, pageTotal };
  }, [bundle, rows]);

  async function handleRefresh() {
    await Promise.all([loadCompras({ page, pageSize }), loadLookups()]);
  }

  async function handleImportCSV(file) {
    if (!session) return;

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

      // refrescamos listado (volver a pág 1 para ver lo nuevo)
      setPage(1);
      await loadCompras({ page: 1, pageSize });
      await loadLookups();
    } catch (e) {
      setImportErr(e?.message || "Error importando CSV");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ===== Header ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold">Compras</h1>
              <p className="mt-1 text-sm text-slate-500">
                Importa el CSV RCV del SII y el sistema crea automáticamente
                proveedores y compras.
              </p>
            </div>

            <StatsCards
              totalRegistros={stats.totalReg}
              totalPagina={stats.pageTotal}
              page={bundle?.page ?? page}
              pageSize={bundle?.pageSize ?? pageSize}
              totalLabel={toCLP(stats.pageTotal)}
            />
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
              onClick={() => setOpenCreate(true)}
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

      {/* ===== Import (FULL WIDTH) ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="px-4 md:px-5 py-4 border-b">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Importar RCV</h2>
            <p className="text-sm text-slate-500">
              Sube el CSV exportado desde el SII.
            </p>
          </div>
        </div>

        <div className="px-4 md:px-5 py-4">
          <ImportComprasBar
            importing={importing}
            importErr={importErr}
            importResult={importResult}
            onClearResult={() => {
              setImportErr("");
              setImportResult(null);
            }}
            onImport={handleImportCSV}
          />
        </div>
      </div>

      {/* ===== Listado (FULL WIDTH) ===== */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 md:p-5 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Listado de compras</h2>
              <p className="text-sm text-slate-500">
                Documentos importados desde RCV (SII) + compras manuales.
              </p>

              {lookupsErr && (
                <div className="mt-2 text-xs text-amber-700">{lookupsErr}</div>
              )}
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

              {/* ✅ Periodo tipo calendario (HH): Año-Mes juntos */}
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
                  title="Periodo (Año-Mes)"
                />

                <button
                  type="button"
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => {
                    setPeriodo("");
                    setPage(1);
                  }}
                  disabled={!periodo}
                  title="Quitar filtro de periodo"
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

        <ComprasTable
          rows={rows}
          loading={loading}
          total={bundle?.total ?? 0}
          page={bundle?.page ?? page}
          pageSize={bundle?.pageSize ?? pageSize}
          onPageChange={(p) => {
            setPage(p);
            loadCompras({ page: p });
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
            loadCompras({ page: 1, pageSize: s });
          }}
        />
      </div>

      {/* ===== MODAL CREAR MANUAL ===== */}
      <CreateCompraModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        session={session}
        apiBase={API}
        makeHeadersJson={makeHeadersJson}
        onCreated={async () => {
          setOpenCreate(false);
          await loadCompras({ page: 1, pageSize });
        }}
        lookups={{
          proveedores,
          proyectos,
          productos,
          loading: lookupsLoading,
        }}
      />
    </div>
  );
}
