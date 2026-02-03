"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import { makeHeaders } from "@/lib/api";
import CotizacionesHeader from "@/components/cotizaciones/CotizacionesHeader";
import CotizacionesDesktopTable from "@/components/cotizaciones/CotizacionesDesktopTable";
import CotizacionesMobileCards from "@/components/cotizaciones/CotizacionesMobileCards";
import CotizacionesSnack from "@/components/cotizaciones/CotizacionesSnack";
import CotizacionesState from "@/components/cotizaciones/CotizacionesState";

import ImportCotizacionPdfDialog from "@/components/cotizaciones/ImportCotizacionPdfDialog";

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [expandedId, setExpandedId] = useState(null);

  // Modal import pdf
  const [openImport, setOpenImport] = useState(false);

  // Snackbar
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

  const toggleExpanded = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

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
          data?.error || data?.detalle || "Error al listar cotizaciones"
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
      if (!res.ok) throw new Error(data?.error || data?.detalle || "Error al listar clientes");
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

  const updateEstado = async (cotizacionId, estado) => {
    try {
      const res = await fetch(
        `${API_URL}/cotizaciones/${cotizacionId}/estado`,
        {
          method: "POST",
          headers: makeHeaders(session),
          body: JSON.stringify({ estado }),
        }
      );

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(
          data?.error || data?.detalle || "Error al actualizar estado"
        );
      }

      showSnack("success", `Estado actualizado a ${estado}`);
      setCotizaciones((prev) =>
        prev.map((c) => {
          if (c.id !== cotizacionId) return c;
          return { ...c, ...data, items: data.items ?? c.items ?? [] };
        })
      );
    } catch (e) {
      showSnack("error", e?.message || "Error actualizando estado");
    }
  };

  // Estados base (loading / unauth)
  const stateUI = (
    <CotizacionesState status={status} loading={loading} err={err} />
  );
  if (status !== "authenticated") return stateUI;

  return (
    <Box sx={{ maxWidth: "3xl", mx: "auto", p: { xs: 2, md: 3 } }}>
      {/* Header actual */}
      <CotizacionesHeader loading={loading} onRefresh={fetchCotizaciones} />

      {/* ✅ Botón Importar PDF (rápido, arriba) */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, mb: 2 }}>
        <button
          onClick={() => setOpenImport(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Importar PDF
        </button>
      </Box>

      <CotizacionesState
        status={status}
        loading={loading}
        err={err}
        empty={!loading && !cotizaciones.length && !err}
      />

      {!loading && cotizaciones.length > 0 && !isMobile && (
        <CotizacionesDesktopTable
          cotizaciones={cotizaciones}
          expandedId={expandedId}
          onToggleExpanded={toggleExpanded}
          onUpdateEstado={updateEstado}
        />
      )}

      {!loading && cotizaciones.length > 0 && isMobile && (
        <CotizacionesMobileCards
          cotizaciones={cotizaciones}
          expandedId={expandedId}
          onToggleExpanded={toggleExpanded}
          onUpdateEstado={updateEstado}
        />
      )}

      {/* ✅ Dialog import PDF */}
      <ImportCotizacionPdfDialog
        open={openImport}
        onClose={() => setOpenImport(false)}
        session={session}
        clientes={clientes}
        showSnack={showSnack}
        onCreated={() => fetchCotizaciones()}
      />

      <CotizacionesSnack snack={snack} onClose={closeSnack} />
    </Box>
  );
}
