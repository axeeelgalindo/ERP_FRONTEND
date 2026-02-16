// src/components/clientes/ClienteModalStepper.jsx
"use client";

import { useMemo, useState } from "react";
import StepperHeader from "./stepper/StepperHeader";
import StepDatos from "./stepper/StepDatos";
import StepCuentas from "./stepper/StepCuentas";
import StepResponsables from "./stepper/StepResponsables";
import { cleanPayloadCliente } from "./utils";

import { ArrowForward, ArrowBack, Save } from "@mui/icons-material";

export default function ClienteModalStepper({
  editing,
  setEditing,
  saving,
  onClose,
  onSavedBase,
  api,
  openSnack,
  cuentas,
  setCuentas,
  responsables,
  setResponsables,
}) {
  const [step, setStep] = useState(1);

  const clienteCreado = !!editing?.id;

  const title = useMemo(
    () => (editing?.id ? "Editar cliente" : "Nuevo cliente"),
    [editing?.id]
  );

  async function saveStep1() {
    try {
      const isEdit = !!editing?.id;
      const basePayload = cleanPayloadCliente(editing);

      const saved = await api.saveClienteBase(basePayload, isEdit, editing?.id);
      let finalSaved = saved;

      if (editing?._logoFile instanceof File) {
        const up = await api.uploadLogo(saved.id, editing._logoFile);

        finalSaved = await api.saveClienteBase(
          {
            ...basePayload,
            logo_url: up?.logo_url ?? null,
            logo_public_id: up?.logo_public_id ?? null,
          },
          true,
          saved.id
        );
      }

      setEditing((prev) => ({
        ...(prev || {}),
        ...finalSaved,
        _logoFile: null,
        _logoPreview: finalSaved?.logo_url || prev?._logoPreview || "",
      }));

      await api.loadCuentasYResponsables(finalSaved.id);
      onSavedBase?.(finalSaved);

      openSnack(isEdit ? "Cliente actualizado" : "Cliente creado", "success");
      return finalSaved;
    } catch (e) {
      openSnack(String(e.message || e), "error");
      return null;
    }
  }

  async function next() {
    if (step === 1) {
      const saved = await saveStep1();
      if (!saved?.id) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    onClose?.();
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function goTo(n) {
    if (n === 1) return setStep(1);
    if (!clienteCreado) return;
    if (n <= step) setStep(n);
  }

  const isLast = step === 3;

  return (
    <div className="w-full">
      {/* Título interno (opcional). Si quieres evitar “doble título”, puedes borrar este bloque */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Completa la información del cliente en 3 pasos.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6">
        <StepperHeader current={step} onGo={goTo} />
      </div>

      {/* Body */}
      <div className="pb-6">
        {step === 1 && (
          <StepDatos editing={editing} setEditing={setEditing} saving={saving} />
        )}

        {step === 2 && (
          <StepCuentas
            clienteId={editing.id}
            cuentas={cuentas}
            setCuentas={setCuentas}
            api={api}
            savingGlobal={saving}
            openSnack={openSnack}
          />
        )}

        {step === 3 && (
          <StepResponsables
            clienteId={editing.id}
            responsables={responsables}
            setResponsables={setResponsables}
            api={api}
            savingGlobal={saving}
            openSnack={openSnack}
          />
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <button
          className={
            step === 1
              ? "invisible px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2"
              : "px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
          }
          type="button"
          onClick={back}
          disabled={saving}
        >
          <ArrowBack fontSize="small" />
          Atrás
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={next}
            disabled={saving}
            className={
              isLast
                ? "px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center gap-2 disabled:opacity-60"
                : "px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-60"
            }
          >
            <span>{isLast ? "Guardar Cliente" : "Siguiente"}</span>
            {isLast ? <Save fontSize="small" /> : <ArrowForward fontSize="small" />}
          </button>
        </div>
      </div>
    </div>
  );
}
