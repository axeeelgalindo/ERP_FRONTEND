"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, UserCheck, Users, X, Check, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function AsignarEquipoModal({
  open,
  onClose,
  proyecto,
  empleados = [],
  loadingEmpleados = false,
  onSave,
  saving = false,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");

  // Al abrir, inicializar con los miembros actuales del proyecto
  useEffect(() => {
    if (open && proyecto) {
      const current = Array.isArray(proyecto.miembros)
        ? proyecto.miembros.map((m) => m.empleado_id || m.empleado?.id).filter(Boolean)
        : [];
      setSelectedIds(current);
      setSearch("");
    }
  }, [open, proyecto]);

  const toggleMember = (empId) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const selectAll = () => {
    setSelectedIds(filteredEmpleados.map((e) => e.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const filteredEmpleados = useMemo(() => {
    if (!search.trim()) return empleados;
    const q = search.toLowerCase();
    return empleados.filter((emp) => {
      const nombre = (emp.usuario?.nombre || emp.nombre || "").toLowerCase();
      const cargo = (emp.cargo || emp.usuario?.rol?.nombre || "").toLowerCase();
      const rut = (emp.rut || emp.usuario?.rut || "").toLowerCase();
      const email = (emp.usuario?.email || emp.email || "").toLowerCase();
      return nombre.includes(q) || cargo.includes(q) || rut.includes(q) || email.includes(q);
    });
  }, [empleados, search]);

  const handleConfirm = () => {
    onSave(selectedIds);
  };

  const getInitials = (name) => {
    if (!name) return "E";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Asignar Equipo al Proyecto"
    >
      <div className="flex flex-col gap-4 p-1">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {proyecto?.nombre}
            </h4>
            <p className="text-[11px] text-slate-400">
              Seleccione el personal que formará parte de este proyecto.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            {selectedIds.length} seleccionado(s)
          </span>
        </div>

        {/* Buscador y botones de selección rápida */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar por nombre, cargo, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={selectAll}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-primary hover:bg-slate-100 rounded-md transition-colors"
            >
              Seleccionar todos
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* Lista de Empleados */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto divide-y divide-slate-100 bg-white">
          {loadingEmpleados ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span>Cargando lista de personal...</span>
            </div>
          ) : filteredEmpleados.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No se encontraron empleados coincidentes.
            </div>
          ) : (
            filteredEmpleados.map((emp) => {
              const isSelected = selectedIds.includes(emp.id);
              const nombre = emp.usuario?.nombre || emp.nombre || "Sin nombre";
              const cargo = emp.cargo || emp.usuario?.rol?.nombre || "Empleado";
              const email = emp.usuario?.email || emp.email || "";

              return (
                <div
                  key={emp.id}
                  onClick={() => toggleMember(emp.id)}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-white shadow-sm"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getInitials(nombre)}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold leading-tight ${isSelected ? "text-primary" : "text-slate-800"}`}>
                        {nombre}
                      </span>
                      <span className="text-[11px] text-slate-500">{cargo}</span>
                      {email && <span className="text-[10px] text-slate-400">{email}</span>}
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary border-primary text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <UserCheck size={14} />
                <span>Guardar Equipo ({selectedIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
