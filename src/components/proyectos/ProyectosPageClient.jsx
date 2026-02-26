// src/components/proyectos/ProyectosPageClient.jsx
"use client";

import { useState } from "react";
import AddProyectoButton from "@/components/proyectos/AddProyectoButton";
import ProjectsTable from "@/components/proyectos/ProjectsTable";
import ProyectoFormModal from "@/components/proyectos/ProyectoFormModal";

export default function ProyectosPageClient({
  items = [],
  total = 0,
  page = 1,
  pageSize = 10,
}) {
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 ">Proyectos</h1>
          <p className="text-sm text-slate-500  mt-1">
            Crea, edita y gestiona el avance de tus proyectos.
          </p>
        </div>

        <AddProyectoButton />
      </div>

      <div className="bg-white  border border-slate-200 rounded-2xl overflow-hidden">
        <ProjectsTable
          rows={items}
          loading={false}
          error=""
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={() => {}}
          onEdit={(row) => {
            setSelected(row);
            setOpenEdit(true);
          }}
          onDelete={() => {}}
          onStart={() => {}}
          onFinish={() => {}}
        />
      </div>

      {/* Modal edición */}
      <ProyectoFormModal
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setSelected(null);
        }}
        mode="edit"
        initialProyecto={selected}
      />
    </div>
  );
}
