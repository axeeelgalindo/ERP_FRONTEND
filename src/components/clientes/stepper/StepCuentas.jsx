"use client";

import { useEffect, useState } from "react";
import { boolish, cx } from "../utils";
import { AccountBalance, Delete, Edit } from "@mui/icons-material";
import { Verified } from "lucide-react";

function Field({ label, value, onChange, required, type = "text", placeholder }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label} {required ? "*" : ""}
      </span>
      <input
        type={type}
        className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all py-2 px-3"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function StepCuentas({
  clienteId,
  cuentas,
  setCuentas,
  api,
  savingGlobal,
  openSnack,
}) {
  const [form, setForm] = useState({
    banco: "",
    tipo_cuenta: "",
    numero: "",
    titular: "",
    rut_titular: "",
    correo_pago: "",
    swift: "",
    iban: "",
    es_principal: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setEditingId(null), [clienteId]);

  const reset = () =>
    setForm({
      banco: "",
      tipo_cuenta: "",
      numero: "",
      titular: "",
      rut_titular: "",
      correo_pago: "",
      swift: "",
      iban: "",
      es_principal: false,
    });

  const pickEdit = (row) => {
    setEditingId(row.id);
    setForm({
      banco: row.banco || "",
      tipo_cuenta: row.tipo_cuenta || "",
      numero: row.numero || "",
      titular: row.titular || "",
      rut_titular: row.rut_titular || "",
      correo_pago: row.correo_pago || "",
      swift: row.swift || "",
      iban: row.iban || "",
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
        banco: (form.banco || "").trim(),
        tipo_cuenta: form.tipo_cuenta?.trim() || null,
        numero: (form.numero || "").trim(),
        titular: form.titular?.trim() || null,
        rut_titular: form.rut_titular?.trim() || null,
        correo_pago: form.correo_pago?.trim() || null,
        swift: form.swift?.trim() || null,
        iban: form.iban?.trim() || null,
        es_principal: boolish(form.es_principal),
      };

      if (!payload.banco || !payload.numero) {
        openSnack("Banco y número son obligatorios", "warning");
        return;
      }

      let row;
      if (editingId) {
        row = await api.updateCuenta(clienteId, editingId, payload);
        setCuentas((prev) => prev.map((x) => (x.id === row.id ? row : x)));
        openSnack("Cuenta actualizada", "success");
      } else {
        row = await api.addCuenta(clienteId, payload);
        setCuentas((prev) => [row, ...prev]);
        openSnack("Cuenta agregada", "success");
      }

      if (payload.es_principal) {
        await api.setCuentaPrincipal(clienteId, row.id);
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
      await api.setCuentaPrincipal(clienteId, row.id);
      await api.loadCuentasYResponsables(clienteId);
      openSnack("Cuenta principal actualizada", "success");
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
      await api.disableCuenta(clienteId, row.id);
      setCuentas((prev) => prev.filter((x) => x.id !== row.id));
      openSnack("Cuenta eliminada", "success");
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
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          Finanzas
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cuentas bancarias para pagos y transferencias
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTA IZQ */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              Cuentas Bancarias
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {cuentas?.length || 0} GUARDADAS
            </span>
          </div>

          <div className="space-y-3">
            {cuentas?.length ? (
              cuentas.map((row) => {
                const principal = !!boolish(row.es_principal);
                return (
                  <div
                    key={row.id}
                    className={cx(
                      "p-4 rounded-xl border transition-all",
                      principal
                        ? "border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        <AccountBalance fontSize="small" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                            {row.banco}
                          </p>
                          <button
                            type="button"
                            onClick={() => markPrincipal(row)}
                            className={cx(
                              "transition-colors",
                              principal
                                ? "text-emerald-600"
                                : "text-slate-300 hover:text-emerald-600"
                            )}
                            disabled={disabled}
                            title="Marcar principal"
                          >
                            <Verified size={18} />
                          </button>
                        </div>

                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase leading-tight">
                          {(row.tipo_cuenta || "—")} • N° {row.numero}
                        </p>
                        {row.titular ? (
                          <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 uppercase">
                            {row.titular}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        onClick={() => pickEdit(row)}
                        disabled={disabled}
                        title="Editar"
                      >
                        <Edit fontSize="small" />
                      </button>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        onClick={() => remove(row)}
                        disabled={disabled}
                        title="Eliminar"
                      >
                        <Delete fontSize="small" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Aún no hay cuentas bancarias.
              </div>
            )}
          </div>
        </div>

        {/* FORM DER */}
        <div className="lg:col-span-2 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              {editingId ? "Editar cuenta" : "Añadir nueva cuenta"}
            </h3>

            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  reset();
                }}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
                disabled={disabled}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Field
                label="Banco"
                required
                value={form.banco}
                onChange={(v) => setForm((f) => ({ ...f, banco: v }))}
                placeholder="Ej. Banco de Chile"
              />
              <Field
                label="Tipo cuenta"
                value={form.tipo_cuenta}
                onChange={(v) => setForm((f) => ({ ...f, tipo_cuenta: v }))}
                placeholder="Corriente / Vista / Ahorro"
              />
              <Field
                label="Número"
                required
                value={form.numero}
                onChange={(v) => setForm((f) => ({ ...f, numero: v }))}
                placeholder="000000000"
              />
              <Field
                label="Titular"
                value={form.titular}
                onChange={(v) => setForm((f) => ({ ...f, titular: v }))}
                placeholder="Nombre completo"
              />
              <Field
                label="RUT Titular"
                value={form.rut_titular}
                onChange={(v) => setForm((f) => ({ ...f, rut_titular: v }))}
                placeholder="12.345.678-9"
              />
              <Field
                label="Correo pago"
                type="email"
                value={form.correo_pago}
                onChange={(v) => setForm((f) => ({ ...f, correo_pago: v }))}
                placeholder="email@ejemplo.com"
              />
              <Field
                label="SWIFT (Opcional)"
                value={form.swift}
                onChange={(v) => setForm((f) => ({ ...f, swift: v }))}
              />
              <Field
                label="IBAN (Opcional)"
                value={form.iban}
                onChange={(v) => setForm((f) => ({ ...f, iban: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!form.es_principal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, es_principal: e.target.checked }))
                  }
                />
                Marcar como cuenta principal
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
  );
}
