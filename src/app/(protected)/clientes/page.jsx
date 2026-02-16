// src/app/(protected)/clientes/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

import Modal from "@/components/ui/Modal";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

import ClientesHeader from "@/components/clientes/ClientesHeader";
import ClientesStats from "@/components/clientes/ClientesStats";
import ClientesFiltersBar from "@/components/clientes/ClientesFiltersBar";
import ClientesTable from "@/components/clientes/ClientesTable";
import ClienteModalStepper from "@/components/clientes/ClientesModalStepper";
import { boolish, cleanPayloadCliente } from "@/components/clientes/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function headersNoJson(session) {
  const h = makeHeaders(session);
  const copy = { ...h };
  delete copy["Content-Type"];
  return copy;
}

export default function ClientesPage() {
  const { data: session } = useSession();

  // estado base
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // filtros
  const [q, setQ] = useState("");
  const [rut, setRut] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // paginación local
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // modales
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  // detalle actual (para cuentas/responsables)
  const [cuentas, setCuentas] = useState([]);
  const [responsables, setResponsables] = useState([]);

  // snackbar
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "info",
  });
  const openSnack = (msg, severity = "info") =>
    setSnack({ open: true, msg, severity });
  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  async function load() {
    if (!session?.user) return;
    try {
      setLoading(true);
      setErr("");

      const headers = makeHeaders(session);
      const url = new URL(`${API_URL}/clientes`);
      if (q) url.searchParams.set("q", q);
      if (showDeleted) url.searchParams.set("deleted", "true");

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.message || json?.msg || "Error al cargar");

      const list = Array.isArray(json) ? json : (json?.data ?? []);

      // ✅ ahora agregamos responsablesCount por cada cliente
      const pickList = (j) => {
        if (Array.isArray(j)) return j;
        if (Array.isArray(j?.data)) return j.data;
        if (Array.isArray(j?.responsables)) return j.responsables;
        if (Array.isArray(j?.items)) return j.items;
        return [];
      };

      const withCounts = await Promise.all(
        list.map(async (c) => {
          try {
            const r = await fetch(`${API_URL}/clientes/${c.id}/responsables`, {
              headers,
              cache: "no-store",
            });
            const j = await r.json().catch(() => null);
            const arr = pickList(j);
            return { ...c, responsablesCount: arr.length };
          } catch {
            return { ...c, responsablesCount: 0 };
          }
        }),
      );

      setRows(withCounts);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, q, showDeleted]);

  const filtered = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const r = norm(rut);

    return rows.filter((row) => {
      const hitQ = q
        ? norm(row?.nombre).includes(norm(q)) ||
          norm(row?.correo).includes(norm(q)) ||
          norm(row?.rut).includes(norm(q))
        : true;

      const hitRut = r ? norm(row?.rut).includes(r) : true;
      return hitQ && hitRut;
    });
  }, [rows, q, rut]);

  useEffect(() => setPage(1), [q, rut, showDeleted]);

  const total = filtered.length;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  /* =========================
     CRUD Cliente
  ========================= */
  function openCreate() {
    setCuentas([]);
    setResponsables([]);
    setEditing({
      nombre: "",
      rut: "",
      correo: "",
      telefono: "",
      notas: "",
      logo_url: "",
      logo_public_id: "",
      _logoFile: null,
      _logoPreview: "",
    });
  }

  async function fetchClienteDetail(id) {
    const headers = makeHeaders(session);
    const res = await fetch(`${API_URL}/clientes/${id}`, {
      headers,
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo cargar cliente",
      );

    // soporta: {data:{...}} o {...}
    return json?.data ?? json;
  }

  async function loadCuentasYResponsables(clienteId) {
    const headers = makeHeaders(session);

    // helper: acepta varias formas de respuesta del backend
    const pickList = (json, keys = []) => {
      if (Array.isArray(json)) return json;
      if (json?.data && Array.isArray(json.data)) return json.data;

      for (const k of keys) {
        if (json?.[k] && Array.isArray(json[k])) return json[k];
      }

      return [];
    };

    try {
      const r1 = await fetch(`${API_URL}/clientes/${clienteId}/cuentas`, {
        headers,
        cache: "no-store",
      });
      const j1 = await r1.json().catch(() => null);
      setCuentas(pickList(j1, ["cuentas", "items", "result"]));
    } catch {
      setCuentas([]);
    }

    try {
      const r2 = await fetch(`${API_URL}/clientes/${clienteId}/responsables`, {
        headers,
        cache: "no-store",
      });
      const j2 = await r2.json().catch(() => null);

      // 👇 clave: muchos backends devuelven { responsables: [...] }
      setResponsables(pickList(j2, ["responsables", "items", "result"]));
    } catch {
      setResponsables([]);
    }
  }

  async function openEdit(row) {
    try {
      setSaving(true);

      const detail = await fetchClienteDetail(row.id);

      setEditing({
        ...detail,
        logo_url: detail?.logo_url ?? "",
        logo_public_id: detail?.logo_public_id ?? "",
        _logoFile: null,
        _logoPreview: "", // 👈 IMPORTANTE: lo dejamos vacío
      });

      await loadCuentasYResponsables(row.id);
    } catch (e) {
      openSnack(String(e.message || e), "error");
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirm() {
    if (!deleting) return;
    try {
      setSaving(true);
      const headers = makeHeaders(session);

      const res = await fetch(`${API_URL}/clientes/delete/${deleting.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.msg || json?.message || "No se pudo eliminar");

      setDeleting(null);
      setRows((prev) => prev.filter((x) => x.id !== deleting.id));
      openSnack("Cliente eliminado", "success");
    } catch (e) {
      openSnack(String(e.message || e), "error");
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     API helpers (los mismos que ya tenías)
  ========================= */
  async function uploadLogo(clienteId, file) {
    const headers = makeHeaders(session);
    const safeHeaders = { ...headers };
    delete safeHeaders["Content-Type"];

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${API_URL}/clientes/logo/${clienteId}`, {
      method: "POST",
      headers: safeHeaders,
      body: fd,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.message || json?.msg || "No se pudo subir el logo");
    return json;
  }

  async function saveClienteBase(payload, isEdit, clienteId) {
    const headers = makeHeaders(session);
    const url = isEdit
      ? `${API_URL}/clientes/update/${clienteId}`
      : `${API_URL}/clientes/add`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.msg || json?.message || "No se pudo guardar");
    return json;
  }

  // cuentas
  async function addCuenta(clienteId, payload) {
    const headers = makeHeaders(session);
    const res = await fetch(`${API_URL}/clientes/${clienteId}/cuentas`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo agregar cuenta",
      );
    return json;
  }

  async function updateCuenta(clienteId, cuentaId, payload) {
    const headers = makeHeaders(session);
    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/cuentas/${cuentaId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo actualizar cuenta",
      );
    return json;
  }

  async function setCuentaPrincipal(clienteId, cuentaId) {
    const headers = headersNoJson(session);

    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/cuentas/${cuentaId}/principal`,
      { method: "PATCH", headers },
    );

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo marcar principal",
      );
    return json;
  }

  async function disableCuenta(clienteId, cuentaId) {
    const headers = headersNoJson(session);

    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/cuentas/${cuentaId}/disable`,
      { method: "PATCH", headers },
    );

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo eliminar cuenta",
      );
    return json;
  }

  // responsables
  async function addResponsable(clienteId, payload) {
    const headers = makeHeaders(session);
    const res = await fetch(`${API_URL}/clientes/${clienteId}/responsables`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo agregar responsable",
      );
    return json;
  }

  async function updateResponsable(clienteId, responsableId, payload) {
    const headers = makeHeaders(session);
    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/responsables/${responsableId}`,
      { method: "PATCH", headers, body: JSON.stringify(payload) },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo actualizar responsable",
      );
    return json;
  }

  async function setResponsablePrincipal(clienteId, responsableId) {
    const headers = headersNoJson(session);

    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/responsables/${responsableId}/principal`,
      { method: "PATCH", headers },
    );

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo marcar principal",
      );
    return json;
  }

  async function disableResponsable(clienteId, responsableId) {
    const headers = headersNoJson(session);

    const res = await fetch(
      `${API_URL}/clientes/${clienteId}/responsables/${responsableId}/disable`,
      { method: "PATCH", headers },
    );

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(
        json?.message || json?.msg || "No se pudo eliminar responsable",
      );
    return json;
  }
  const api = {
    uploadLogo,
    saveClienteBase,
    loadCuentasYResponsables,
    // cuentas
    addCuenta,
    updateCuenta,
    setCuentaPrincipal,
    disableCuenta,
    // responsables
    addResponsable,
    updateResponsable,
    setResponsablePrincipal,
    disableResponsable,
  };

  // Stats (por ahora real: totalClientes)
  const stats = useMemo(
    () => ({
      totalClientes: rows.length,
      activos: rows.filter((x) => !boolish(x?.deleted)).length,
      cotPend: "—",
      proyectos: "—",
    }),
    [rows],
  );

  return (
    <div className="p-8 space-y-8  mx-auto w-full">
      <ClientesHeader onNew={openCreate} />

      <ClientesStats stats={stats} />

      <ClientesFiltersBar
        q={q}
        onQ={setQ}
        rut={rut}
        onRut={setRut}
        showDeleted={showDeleted}
        onShowDeleted={setShowDeleted}
        onOpenFilters={() => {}}
        loading={loading}
      />

      <ClientesTable
        rows={pageRows}
        loading={loading}
        error={err}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      {/* Modal eliminar */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar cliente"
      >
        <p className="text-sm text-gray-700">
          ¿Seguro que deseas eliminar a{" "}
          <span className="font-medium">{deleting?.nombre}</span>?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
            onClick={() => setDeleting(null)}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            onClick={onDeleteConfirm}
            disabled={saving}
          >
            {saving ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>

      {/* Modal Crear/Editar Stepper */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar cliente" : "Nuevo cliente"}
      >
        {editing && (
          <ClienteModalStepper
            editing={editing}
            setEditing={setEditing}
            saving={saving}
            onClose={() => setEditing(null)}
            cuentas={cuentas}
            setCuentas={setCuentas}
            responsables={responsables}
            setResponsables={setResponsables}
            api={api}
            openSnack={openSnack}
            onSavedBase={(finalSaved) => {
              // actualiza lista (create/update)
              setRows((prev) => {
                const exists = prev.some((x) => x.id === finalSaved.id);
                if (exists)
                  return prev.map((x) =>
                    x.id === finalSaved.id ? finalSaved : x,
                  );
                return [finalSaved, ...prev];
              });
            }}
          />
        )}
      </Modal>

      {/* Snackbar */}
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
