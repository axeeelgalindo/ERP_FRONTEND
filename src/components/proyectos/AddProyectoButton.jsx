// src/components/proyectos/AddProyectoButton.jsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ProyectoFormModal from "@/components/proyectos/ProyectoFormModal";

export default function AddProyectoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        <Plus size={14} />
        Nuevo proyecto
      </button>

      <ProyectoFormModal
        open={open}
        onClose={() => setOpen(false)}
        mode="create"
      />
    </>
  );
}