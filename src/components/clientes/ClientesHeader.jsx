// src/components/clientes/ClientesHeader.jsx
"use client";

import { Add } from "@mui/icons-material";

export default function ClientesHeader({ onNew }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 ">
          Clientes
        </h2>
        <p className="text-slate-500  mt-1">
          Gestiona y visualiza la actividad financiera de tus clientes.
        </p>
      </div>

      <button
        onClick={onNew}
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-600/90 transition-all shadow-lg shadow-blue-600/20"
      >
        <Add fontSize="small" />
        Nuevo Cliente
      </button>
    </div>
  );
}
