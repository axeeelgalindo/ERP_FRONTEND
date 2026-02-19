"use client";

import { useEffect, useState } from "react";
import { boolish, cx } from "../utils";
import { Delete, Edit } from "@mui/icons-material";
import { Verified } from "lucide-react";

function Field({ label, value, onChange, required, type = "text", placeholder }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold text-slate-500  uppercase tracking-wider">
        {label} {required ? "*" : ""}
      </span>
      <input
        type={type}
        className="w-full text-sm rounded-lg border border-slate-200  bg-white  text-slate-900  focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all py-2 px-3"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

export default function StepResponsables({
  clienteId,
  responsables,
  setResponsables,
  api,
  savingGlobal,
  openSnack,
}) {
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    telefono: "",
    cargo: "",
    area: "",
    es_principal: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setEditingId(null), [clienteId]);

  const reset = () =>
    setForm({
      nombre: "",
      correo: "",
      telefono: "",
      cargo: "",
      area: "",
      es_principal: false,
    });

  const pickEdit = (row) => {
    setEditingId(row.id);
    setForm({
      nombre: row.nombre || "",
      correo: row.correo || "",
      telefono: row.telefono || "",
      cargo: row.cargo || "",
      area: row.area || "",
      es_principal: false,
    });
  };

  async function submit(e) {
    e.preventDefault();
    if (!clienteId) {
      openSnack("Primero guarda la información del cliente (Paso 1).", "warning");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nombre: (form.nombre || "").trim(),
        correo: form.correo?.trim() || null,
        telefono: form.telefono?.trim() || null,
        cargo: form.cargo?.trim() || null,
        area: form.area?.trim() || null,
        es_principal: boolish(form.es_principal),
      };

      if (!payload.nombre) {
        openSnack("Nombre es obligatorio", "warning");
        return;
      }

      let row;
      if (editingId) {
        row = await api.updateResponsable(clienteId, editingId, payload);
        setResponsables((prev) => prev.map((x) => (x.id === row.id ? row : x)));
        openSnack("Responsable actualizado", "success");
      } else {
        row = await api.addResponsable(clienteId, payload);
        setResponsables((prev) => [row, ...prev]);
        openSnack("Responsable agregado", "success");
      }

      if (payload.es_principal) {
        await api.setResponsablePrincipal(clienteId, row.id);
        await api.loadCuentasYResponsables(clienteId);
      }

      setEditingId(null);
      reset();
    } catch (err) {
      openSnack(String(err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function markPrincipal(row) {
    if (!clienteId) return;
    try {
      setSaving(true);
      await api.setResponsablePrincipal(clienteId, row.id);
      await api.loadCuentasYResponsables(clienteId);
      openSnack("Responsable principal actualizado", "success");
    } catch (err) {
      openSnack(String(err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!clienteId) return;
    try {
      setSaving(true);
      await api.disableResponsable(clienteId, row.id);
      setResponsables((prev) => prev.filter((x) => x.id !== row.id));
      openSnack("Responsable eliminado", "success");
    } catch (err) {
      openSnack(String(err.message || err), "error");
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || savingGlobal;

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-slate-800 ">
          Equipo
        </h2>
        <p className="text-sm text-slate-500 ">
          Contactos clave asignados a este cliente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LISTA IZQ */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 ">
              Equipo Responsable
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700  ">
              {responsables?.length || 0} ASIGNADOS
            </span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {responsables?.length ? (
              responsables.map((row) => {
                const principal = !!boolish(row.es_principal);
                return (
                  <div
                    key={row.id}
                    className="p-3 border border-slate-200  rounded-xl bg-white  hover:border-blue-400/40 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100  flex items-center justify-center text-slate-600  font-bold shrink-0">
                        {initials(row.nombre)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900  truncate">
                            {row.nombre}
                          </p>
                          {principal ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700   uppercase">
                              Principal
                            </span>
                          ) : null}
                        </div>

                        <p className="text-[11px] text-slate-500  leading-tight">
                          {row.cargo || "—"}
                          {row.area ? ` • ${row.area}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {row.correo || "—"}
                          {row.telefono ? ` • ${row.telefono}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => markPrincipal(row)}
                          className={cx(
                            "p-1 transition-colors",
                            principal
                              ? "text-emerald-600"
                              : "text-slate-300 hover:text-emerald-600"
                          )}
                          disabled={disabled}
                          title="Marcar principal"
                        >
                          <Verified size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => pickEdit(row)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          disabled={disabled}
                          title="Editar"
                        >
                          <Edit fontSize="small" />
                        </button>

                        <button
                          type="button"
                          onClick={() => remove(row)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          disabled={disabled}
                          title="Eliminar"
                        >
                          <Delete fontSize="small" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500 ">
                Aún no hay responsables.
              </div>
            )}
          </div>
        </div>

        {/* FORM DER */}
        <div className="lg:col-span-3">
          <div className="p-6 border border-slate-200  rounded-2xl bg-slate-50 ">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 ">
                {editingId ? "Editar responsable" : "Añadir responsable"}
              </h3>

              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    reset();
                  }}
                  className="text-sm text-slate-500 hover:text-slate-900 "
                  disabled={disabled}
                >
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <Field
                  label="Nombre"
                  required
                  value={form.nombre}
                  onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
                  placeholder="Ej. Juan Pérez"
                />
                <Field
                  label="Correo electrónico"
                  type="email"
                  value={form.correo}
                  onChange={(v) => setForm((f) => ({ ...f, correo: v }))}
                  placeholder="juan@ejemplo.com"
                />
                <Field
                  label="Teléfono"
                  value={form.telefono}
                  onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
                  placeholder="+56 9 ..."
                />
                <Field
                  label="Cargo / Puesto"
                  value={form.cargo}
                  onChange={(v) => setForm((f) => ({ ...f, cargo: v }))}
                  placeholder="Ej. Gerente Comercial"
                />
                <div className="md:col-span-2">
                  <Field
                    label="Área"
                    value={form.area}
                    onChange={(v) => setForm((f) => ({ ...f, area: v }))}
                    placeholder="Ej. Mantenimiento, Ventas..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 ">
                  <input
                    type="checkbox"
                    checked={!!form.es_principal}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, es_principal: e.target.checked }))
                    }
                  />
                  Marcar como contacto principal
                </label>

                <button
                  type="submit"
                  disabled={disabled}
                  className={cx(
                    "bg-blue-600 hover:opacity-90 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all",
                    disabled && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {saving ? "Guardando…" : editingId ? "Actualizar" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
