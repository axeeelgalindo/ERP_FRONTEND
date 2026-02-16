// src/components/clientes/stepper/StepperHeader.jsx
"use client";

import { cx } from "../utils";

import { Check } from "lucide-react";

function StepBtn({ step, current, onGo, label }) {
  const done = step < current;
  const active = step === current;

  const circleClass = done
    ? "bg-emerald-500 text-white"
    : active
      ? "bg-blue-600 text-white"
      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400";

  const labelClass = done
    ? "text-emerald-500"
    : active
      ? "text-blue-600 dark:text-blue-500 font-bold"
      : "text-slate-500 dark:text-slate-400";

  return (
    <button
      type="button"
      onClick={() => onGo(step)}
      className="relative z-10 flex flex-col items-center group"
      disabled={step > current} // solo permite ir hacia atrás o al actual
      title={step > current ? "Completa el paso anterior" : ""}
    >
      <div
        className={cx(
          "w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white dark:ring-slate-900 transition-all",
          circleClass
        )}
      >
        {done ? (
          <Check className="w-4 h-4" />
        ) : (
          step
        )}
      </div>
      <span className={cx("mt-2 text-sm font-medium", labelClass)}>{label}</span>
    </button>
  );
}

export default function StepperHeader({ current, onGo }) {
  return (
    <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 z-0" />
        <StepBtn step={1} current={current} onGo={onGo} label="Información" />
        <StepBtn step={2} current={current} onGo={onGo} label="Finanzas" />
        <StepBtn step={3} current={current} onGo={onGo} label="Equipo" />
      </div>
    </div>
  );
}
