// src/app/(protected)/proyectos/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";
import PageHeader from "@/components/layout/PageHeader";
import ProjectsFilters from "@/components/proyectos/ProjectsFilters";
import ProjectsTable from "@/components/proyectos/ProjectsTable";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import AddProyectoButton from "@/components/proyectos/AddProyectoButton";

const API = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ProyectosPage() {
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [cliente, setCliente] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "info",
  });

  const openSnack = (msg, severity = "info") =>
    setSnack({ open: true, msg, severity });
  const closeSnack = () =>
    setSnack((s) => ({
      ...s,
      open: false,
    }));

  async function load() {
    try {
      setLoading(true);
      const headers = makeHeaders(session);
      const url = new URL(`${API}/proyectos`);
      if (q) url.searchParams.set("q", q);
      if (estado) url.searchParams.set("estado", estado);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await safeJson(res);

      if (!res.ok)
        throw new Error(json?.message || json?.msg || "Error al cargar");

      const list = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
          ? json
          : [];

      setRows(list);
      setTotal(Number(json?.total ?? list.length) || 0);
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, estado, page]);

  const filtered = useMemo(() => {
    const needle = String(cliente || "")
      .toLowerCase()
      .trim();
    if (!needle) return rows;
    return rows.filter((r) => {
      const cs = (r?.ventas || [])
        .map((v) => v?.cliente)
        .filter(Boolean)
        .map((c) => `${c.nombre || ""} ${c.rut || ""}`.toLowerCase());
      return cs.some((txt) => txt.includes(needle));
    });
  }, [rows, cliente]);

  // ✅ INICIAR (fecha real)
  const handleStartProyecto = async (row) => {
    if (!session) return;
    if (!row?.id) return;

    const ok = window.confirm(
      "¿Iniciar proyecto ahora?\nSe guardará la fecha real de inicio.",
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API}/proyectos/${row.id}/iniciar`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify({}), // ✅ FIX
      });

      const json = await safeJson(res);
      if (!res.ok)
        throw new Error(
          json?.error || json?.detalle || "Error al iniciar proyecto",
        );

      openSnack("Proyecto iniciado ✅", "success");
      await load();
    } catch (e) {
      openSnack(e?.message || "Error al iniciar proyecto", "error");
    }
  };

  // ✅ FINALIZAR (fecha real)
  const handleFinishProyecto = async (row) => {
    if (!session) return;
    if (!row?.id) return;

    const ok = window.confirm(
      "¿Finalizar proyecto ahora?\nSe guardará la fecha real de término.",
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API}/proyectos/${row.id}/finalizar`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify({}), // ✅ FIX

      });

      const json = await safeJson(res);
      if (!res.ok)
        throw new Error(
          json?.error || json?.detalle || "Error al finalizar proyecto",
        );

      openSnack("Proyecto finalizado ✅", "success");
      await load();
    } catch (e) {
      openSnack(e?.message || "Error al finalizar proyecto", "error");
    }
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Proyectos"
        subtitle="Gestiona y supervisa los proyectos de tu empresa"
        breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Proyectos" }]}
        actions={<AddProyectoButton />}
      >
        <ProjectsFilters
          q={q}
          onQ={setQ}
          estado={estado}
          onEstado={setEstado}
          cliente={cliente}
          onCliente={setCliente}
          loading={loading}
        />
      </PageHeader>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <ProjectsTable
          rows={filtered}
          loading={loading}
          error={err}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => setPage(p)}
          // ✅ NUEVO
          onStart={handleStartProyecto}
          onFinish={handleFinishProyecto}
        />
      </div>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MuiAlert
          elevation={3}
          variant="filled"
          onClose={closeSnack}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
