"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { makeHeaders } from "@/lib/api";

// ✅ Mantén tus dialogs actuales
import EditCotizacionDialog from "@/components/cotizaciones/EditCotizacionDialog";
import ImportCotizacionPdfDialog from "@/components/cotizaciones/ImportCotizacionPdfDialog";
import CotizacionesSnack from "@/components/cotizaciones/CotizacionesSnack";
import CotizacionesState from "@/components/cotizaciones/CotizacionesState";

// ✅ Nuevos componentes (los creas abajo)
import CotizacionesTableLight from "@/components/cotizaciones/CotizacionesTableLight";
import CotizacionDrawerLight from "@/components/cotizaciones/CotizacionDrawerLight";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function CotizacionesPage() {
  const { data: session, status } = useSession();

  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI: drawer + seleccion
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // UI: search (solo frontend)
  const [q, setQ] = useState("");

  // Dialogs
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openImport, setOpenImport] = useState(false);

  // Snackbar (mantienes tu snack MUI)
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showSnack = (severity, message) =>
    setSnack({ open: true, severity, message });

  const closeSnack = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((s) => ({ ...s, open: false }));
  };

  const openEditCot = (id) => {
    setEditingId(id);
    setOpenEdit(true);
  };

  const fetchCotizaciones = async () => {
    if (!session) return;
    try {
      setLoading(true);
      setErr("");

      const res = await fetch(`${API_URL}/cotizaciones`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al listar cotizaciones",
        );
      }

      setCotizaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        headers: makeHeaders(session),
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (!res.ok)
        throw new Error(
          data?.error || data?.detalle || "Error al listar clientes",
        );
      setClientes(Array.isArray(data) ? data : data?.data || []);
    } catch {
      setClientes([]);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchCotizaciones();
      fetchClientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ✅ IMPORTANTE: tu updateEstado (igual)
  const updateEstado = async (cotizacionId, estado, extra = {}) => {
    try {
      const res = await fetch(
        `${API_URL}/cotizaciones/${cotizacionId}/estado`,
        {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify({ estado, ...extra }),
        },
      );

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al actualizar estado",
        );
      }

      if (estado === "ACEPTADA")
        showSnack("success", "Cotización aceptada. Proyecto creado/iniciado.");
      else if (estado === "RECHAZADA")
        showSnack("success", "Cotización rechazada.");
      else showSnack("success", `Estado actualizado a ${estado}`);

      setCotizaciones((prev) =>
        prev.map((c) => {
          if (c.id !== cotizacionId) return c;
          return { ...c, ...data, items: data.items ?? c.items ?? [] };
        }),
      );
    } catch (e) {
      showSnack("error", e?.message || "Error actualizando estado");
    }
  };

  // Selección actual para el drawer
  const selected = useMemo(
    () => cotizaciones.find((c) => c.id === selectedId) || null,
    [cotizaciones, selectedId],
  );

  // Filtro local (cliente / id / estado / numero)
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return cotizaciones;

    return (cotizaciones || []).filter((c) => {
      const cliente = String(c?.cliente?.nombre || "").toLowerCase();
      const id = String(c?.id || "").toLowerCase();
      const estado = String(c?.estado || "").toLowerCase();
      const numero = String(c?.numero ?? "").toLowerCase();
      return (
        cliente.includes(qq) ||
        id.includes(qq) ||
        estado.includes(qq) ||
        numero.includes(qq)
      );
    });
  }, [cotizaciones, q]);

  const stateUI = (
    <CotizacionesState status={status} loading={loading} err={err} />
  );
  if (status !== "authenticated") return stateUI;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header como el ejemplo */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Cotizaciones</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCotizaciones}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <span className="text-lg">⟳</span> Actualizar
          </button>

          <button
            onClick={() => setOpenImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <span className="text-lg">⬆</span> Importar PDF
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6 md:p-8">
        <p className="text-slate-500 mb-6">
          Gestiona estados, revisa detalle y exporta a PDF de manera centralizada.
        </p>

        {/* Toolbar búsqueda + filtros */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔎
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
              placeholder="Buscar por cliente, ID o estado..."
              type="text"
            />
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
            title="(Pendiente) conectar filtros reales"
            onClick={() => showSnack("info", "Filtros: pendiente de conectar")}
          >
            <span className="text-lg">⏷</span> Filtros
          </button>
        </div>

        {/* Estado general (loading/error/empty) */}
        <CotizacionesState
          status={status}
          loading={loading}
          err={err}
          empty={!loading && !filtered.length && !err}
        />

        {/* Tabla */}
        {!loading && filtered.length > 0 && (
          <CotizacionesTableLight
            cotizaciones={filtered}
            onRowClick={(cot) => {
              setSelectedId(cot.id);
              setOpenDrawer(true);
            }}
            onEdit={(id) => openEditCot(id)}
          />
        )}
      </div>

      {/* Drawer + Overlay */}
      <CotizacionDrawerLight
        open={openDrawer}
        cotizacion={selected}
        onClose={() => setOpenDrawer(false)}
        onEdit={(id) => openEditCot(id)}
        onUpdateEstado={updateEstado}
        showSnack={showSnack}
      />

      {/* Dialogs que ya tienes */}
      <ImportCotizacionPdfDialog
        open={openImport}
        onClose={() => setOpenImport(false)}
        session={session}
        clientes={clientes}
        showSnack={showSnack}
        onCreated={() => fetchCotizaciones()}
      />

      <EditCotizacionDialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        session={session}
        cotizacionId={editingId}
        clientes={clientes}
        onUpdated={() => {
          showSnack("success", "Cotización actualizada");
          fetchCotizaciones();
        }}
      />

      <CotizacionesSnack snack={snack} onClose={closeSnack} />
    </div>
  );
}
