"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

/**
 * Kanban Page - Global View
 * Jerarquía Completa: Épicas, Tareas y Subtareas.
 * Incluye modal de detalles con evidencias (fotos y comentarios).
 */
export default function KanbanPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [filters, setFilters] = useState({
    proyecto_id: "",
    responsable_id: "",
    periodo: "semanal",
  });

  const fetchData = useCallback(async (q = "") => {
    if (!session) return;
    setLoading(true);
    try {
      const headers = makeHeaders(session);
      const qs = new URLSearchParams({
        proyecto_id: filters.proyecto_id,
        responsable_id: filters.responsable_id,
        periodo: filters.periodo,
        q: q,
      }).toString();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/kanban?${qs}`, {
        headers,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Error cargando datos");
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, filters.proyecto_id, filters.responsable_id, filters.periodo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchData]);

  const onDragStart = (e, taskId, tipo) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("tipo", tipo);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const tipo = e.dataTransfer.getData("tipo");
    if (!taskId || !tipo) return;

    const statusMap = {
      "POR HACER": "pendiente",
      "EN CURSO": "en_progreso",
      "EN REVISIÓN": "en_revision",
      "COMPLETADO": "completada",
    };

    const newStatus = statusMap[targetStatus];

    // Optimistic Update
    setData(prev => {
      if (!prev) return prev;
      let movedItem = null;
      const newColumns = { ...prev.columns };
      Object.keys(newColumns).forEach(col => {
        const idx = newColumns[col].findIndex(t => t.id === taskId && t.tipo === tipo);
        if (idx !== -1) [movedItem] = newColumns[col].splice(idx, 1);
      });
      if (movedItem) {
        movedItem.estado = newStatus;
        if (newStatus === "completada") movedItem.avance = 100;
        else if (newStatus === "pendiente") movedItem.avance = 0;
        newColumns[targetStatus].push(movedItem);
      }
      return { ...prev, columns: newColumns };
    });

    setIsUpdating(true);
    try {
      const headers = makeHeaders(session);
      let url = "";
      let method = "PATCH";

      if (tipo === "EPICA") {
        url = `${process.env.NEXT_PUBLIC_API_URL}/epicas/update/${taskId}`;
        method = "PUT";
      } else if (tipo === "TAREA") {
        url = `${process.env.NEXT_PUBLIC_API_URL}/tareas/update/${taskId}`;
      } else if (tipo === "SUBTAREA") {
        url = `${process.env.NEXT_PUBLIC_API_URL}/tareas-detalle/update/${taskId}`;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ estado: newStatus }),
      });
      if (!res.ok) throw new Error("Error actualizando estado");
      fetchData(searchTerm);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
      fetchData(searchTerm);
    } finally {
      setIsUpdating(false);
    }
  };

  const stats = data?.stats || { total: 0, critical: 0, inProgress: 0, efficiency: 0 };
  const columns = data?.columns || { "POR HACER": [], "EN CURSO": [], "EN REVISIÓN": [], "COMPLETADO": [] };
  const filterOptions = data?.filters || { projects: [], employees: [] };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    // 16 abr.
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
  };

  const formatResponsibleName = (fullName) => {
    if (!fullName || fullName === "Sin Asignar" || fullName === "Proyecto" || fullName === "??") return fullName;
    if (!fullName.includes(",")) return fullName;
    const [apellidos, nombres] = fullName.split(",").map(s => s.trim());
    const firstNombre = nombres.split(" ")[0] || "";
    return `${firstNombre} ${apellidos}`.trim();
  };

  const SearchableSelect = ({ options, value, onChange, placeholder, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
  
    const selectedOption = options.find(o => o.id === value);
    const filteredOptions = options.filter(o => 
      (o.nombre || "").toLowerCase().includes(search.toLowerCase())
    );
  
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);
  
    return (
      <div className="relative" ref={containerRef}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 outline-none focus-within:ring-2 focus-within:ring-blue-600 cursor-pointer flex items-center gap-2 min-w-[180px] hover:border-blue-400 transition-colors shadow-sm"
        >
          <span className="text-gray-400 whitespace-nowrap">{label}:</span>
          <span className="flex-1 truncate">{selectedOption ? selectedOption.nombre : placeholder}</span>
          <span className={`material-symbols-outlined text-sm text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
        
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-gray-100 shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 w-64">
            <div className="p-3 border-b border-gray-50 bg-gray-50/50">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">search</span>
                <input 
                  type="text" 
                  className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  placeholder="Filtrar opciones..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              <div 
                className={`px-3 py-2 text-xs rounded-lg cursor-pointer font-bold mb-1 transition-colors ${!value ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                onClick={(e) => { e.stopPropagation(); onChange(""); setIsOpen(false); setSearch(""); }}
              >
                Todos
              </div>
              {filteredOptions.map(opt => (
                <div 
                  key={opt.id}
                  className={`px-3 py-2 text-xs rounded-lg cursor-pointer mb-1 transition-colors ${value === opt.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={(e) => { e.stopPropagation(); onChange(opt.id); setIsOpen(false); setSearch(""); }}
                >
                  {opt.nombre}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-4 py-6 text-xs text-gray-400 italic text-center">No se encontraron resultados</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getTaskStyles = (item) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ffp = item.fecha_fin_plan ? new Date(item.fecha_fin_plan) : null;
    const ffr = item.fecha_fin_real ? new Date(item.fecha_fin_real) : null;
    const isCompletada = ["completada", "finalizado"].includes(item.estado);

    const isOverdue = !isCompletada && ffp && ffp < today;
    const isRealDelayed = ffp && (ffr ? ffr > ffp : (!isCompletada && today > ffp));

    let borderColor = "border-outline-variant";
    let bgType = "bg-slate-100 text-slate-600";
    let icon = "assignment";

    if (item.tipo === "EPICA") {
      bgType = "bg-blue-100 text-blue-700";
      icon = "rocket_launch";
    } else if (item.tipo === "SUBTAREA") {
      bgType = "bg-slate-50 text-slate-500 border border-slate-200";
      icon = "layers";
    }

    if (item.prioridad === 1) borderColor = "border-primary";
    if (isOverdue) borderColor = "border-error";
    else if (isRealDelayed && isCompletada) borderColor = "border-amber-500";

    return { borderColor, bgType, icon, isOverdue, isRealDelayed };
  };

  const renderCard = (item) => {
    const { borderColor, bgType, icon, isOverdue, isRealDelayed } = getTaskStyles(item);
    const isCompletada = ["completada", "finalizado"].includes(item.estado);
    const formattedName = formatResponsibleName(item.responsable_nombre);
    const initials = formattedName && formattedName !== "Sin Asignar"
      ? formattedName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : (item.tipo === "EPICA" ? "EP" : "??");

    return (
      <div
        key={`${item.tipo}-${item.id}`}
        draggable="true"
        onDragStart={(e) => onDragStart(e, item.id, item.tipo)}
        onClick={() => setSelectedItem(item)}
        className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all relative border-l-[4px] ${borderColor} ${isCompletada ? "opacity-75" : ""} cursor-grab active:cursor-grabbing group`}
      >
        <div className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${bgType}`}>
              <span className="material-symbols-outlined text-[10px] font-bold">{icon}</span>
              {item.tipo}
            </div>
            <div className="flex gap-1 items-center">
              {item.evidencias?.length > 0 && (
                <span className="material-symbols-outlined text-gray-300 text-xs translate-y-0.5 group-hover:text-blue-500 transition-colors">photo_library</span>
              )}
              {isOverdue && (
                <span className="bg-error text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Retraso</span>
              )}
            </div>
          </div>

          <div className="mb-2">
            <h3 className={`text-sm font-bold text-gray-800 leading-tight ${isCompletada ? "line-through opacity-50" : ""}`}>
              {item.nombre}
            </h3>
            {item.parent_name && (
              <p className="text-[9px] text-gray-400 mt-1 flex items-center gap-1 italic">
                <span className="material-symbols-outlined text-[10px]">link</span>
                {item.parent_name}
              </p>
            )}
          </div>

          {(item.avance > 0 && item.avance < 100) && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Avance</span>
                <span>{item.avance}%</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${item.avance}%` }}></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-[9px] font-bold shadow-xs" title={formattedName}>
              {initials}
            </div>

            <div className="flex-1 ml-4 grid grid-cols-2 gap-x-3 text-right">
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] uppercase font-extrabold text-gray-400 tracking-wider">Inicia</span>
                <span className="text-[10px] font-semibold text-gray-700">
                  {formatDate(item.fecha_inicio_plan)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] uppercase font-extrabold text-gray-400 tracking-wider">Vence</span>
                <span className={`text-[10px] font-bold ${isOverdue ? "text-error" : "text-gray-800"}`}>
                  {formatDate(item.fecha_fin_plan)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Modal de Detalles ---
  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const item = selectedItem;
    const { bgType, icon } = getTaskStyles(item);
    const isCompletada = ["completada", "finalizado"].includes(item.estado);

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        ></div>

        {/* Panel */}
        <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
          <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className={`self-start flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest ${bgType}`}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {item.tipo}
              </div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight">
                {item.nombre}
              </h2>
              {item.parent_name && (
                <div className="flex items-center gap-1 text-xs text-gray-400 font-medium italic">
                  <span className="material-symbols-outlined text-xs">link</span>
                  Asociado a: {item.parent_name}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all bg-gray-50 text-gray-400 hover:text-gray-900"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-black ${isCompletada ? 'text-green-600' : 'text-blue-600'}`}>{item.avance}%</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`${isCompletada ? 'bg-green-500' : 'bg-blue-600'} h-full`} style={{ width: `${item.avance}%` }}></div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable</span>
                <div className="flex items-center gap-2">
                  <select
                    value={item.responsable_id || ""}
                    onChange={(e) => {
                      const newId = e.target.value;
                      const emp = filterOptions.employees.find(emp => emp.id === newId);
                      const newName = emp ? emp.nombre : "Sin Asignar";

                      setSelectedItem(prev => ({
                        ...prev,
                        responsable_id: newId,
                        responsable_nombre: newName
                      }));

                      (async () => {
                        setIsUpdating(true);
                        try {
                          const headers = makeHeaders(session);
                          let url = "";
                          let method = "PATCH";
                          if (item.tipo === "EPICA") {
                            url = `${process.env.NEXT_PUBLIC_API_URL}/epicas/update/${item.id}`;
                            method = "PUT";
                          } else if (item.tipo === "TAREA") {
                            url = `${process.env.NEXT_PUBLIC_API_URL}/tareas/update/${item.id}`;
                          } else if (item.tipo === "SUBTAREA") {
                            url = `${process.env.NEXT_PUBLIC_API_URL}/tareas-detalle/update/${item.id}`;
                          }

                          await fetch(url, {
                            method,
                            headers,
                            body: JSON.stringify({ responsable_id: newId || null }),
                          });
                          fetchData(searchTerm);
                        } catch (err) {
                          console.error(err);
                          alert("Error actualizando responsable");
                        } finally {
                          setIsUpdating(false);
                        }
                      })();
                    }}
                    className="bg-transparent text-xs font-bold text-gray-700 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none cursor-pointer py-0.5"
                  >
                    <option value="">Sin Asignar</option>
                    {filterOptions.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{formatResponsibleName(emp.nombre)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Inicio Plan</span>
                <p className="text-sm font-bold text-gray-700">{formatDate(item.fecha_inicio_plan)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Fin Plan</span>
                <p className="text-sm font-bold text-gray-700">{formatDate(item.fecha_fin_plan)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Inicio Real</span>
                <p className={`text-sm font-bold ${item.fecha_inicio_real ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                  {item.fecha_inicio_real ? formatDate(item.fecha_inicio_real) : "Pendiente"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Fin Real</span>
                <p className={`text-sm font-bold ${item.fecha_fin_real ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                  {item.fecha_fin_real ? formatDate(item.fecha_fin_real) : "Pendiente"}
                </p>
              </div>
            </div>

            {item.descripcion && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</span>
                <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">{item.descripcion}</p>
              </div>
            )}

            {/* Evidencias */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Evidencias y Registro de Término</span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {item.evidencias?.length || 0} Archivos
                </span>
              </div>

              {item.evidencias?.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {item.evidencias.map((ev, idx) => (
                    <div key={ev.id || idx} className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 group hover:border-blue-200 transition-all">
                      <div className="aspect-video relative bg-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          src={ev.archivo_url.startsWith('http') ? ev.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${ev.archivo_url.replace('/api', '')}`}
                          alt={`Evidencia ${idx}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comentario</span>
                          <span className="text-[9px] text-gray-300">{formatDate(ev.creado_en)}</span>
                        </div>
                        <p className="text-gray-700 text-sm italic leading-relaxed">"{ev.comentario || 'Sin comentario proporcionado'}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center opacity-40">
                  <span className="material-symbols-outlined text-4xl mb-2">add_a_photo</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">No hay evidencias cargadas aún</p>
                </div>
              )}
            </div>
          </div>

          <footer className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={() => setSelectedItem(null)}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20 active:scale-95 transition-all"
            >
              Entendido
            </button>
          </footer>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#f8f9fb] text-[#191c1e] min-h-screen overflow-hidden flex flex-col font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.82); backdrop-filter: blur(12px); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #c3c5d7; border-radius: 10px; }
      `}</style>

      <header className="w-full bg-white px-6 pr-14 py-4 flex flex-wrap items-center gap-6 border-b border-gray-200/60 shadow-sm z-10">
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="material-symbols-outlined text-white text-xl">view_kanban</span>
          </div>
          <h1 className="text-gray-900 font-extrabold tracking-tight text-xl leading-none">
            TaskLedger <span className="text-gray-300 font-light mx-1">|</span> <span className="text-gray-500 font-medium">Kanban</span>
          </h1>
        </div>

        <div className="flex-1 flex items-center gap-4">
          <div className="relative flex-grow max-sm:hidden max-w-sm">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
            <input
              className="w-full bg-gray-50 border-none ring-1 ring-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 transition-all outline-none text-gray-700"
              placeholder="Buscar por nombre..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
            {["semanal", "mensual", "anual"].map((p) => (
              <button
                key={p}
                onClick={() => setFilters(prev => ({ ...prev, periodo: p }))}
                className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider ${filters.periodo === p ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-100" : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SearchableSelect
            label="Miembros"
            placeholder="Todos"
            options={filterOptions.employees}
            value={filters.responsable_id}
            onChange={(val) => setFilters(prev => ({ ...prev, responsable_id: val }))}
          />

          <SearchableSelect
            label="Proyectos"
            placeholder="Todos"
            options={filterOptions.projects}
            value={filters.proyecto_id}
            onChange={(val) => setFilters(prev => ({ ...prev, proyecto_id: val }))}
          />

          <button
            onClick={() => fetchData(searchTerm)}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-gray-200"
            title="Refrescar"
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#f8f9fb] flex px-2 gap-1 py-1">
        {Object.entries(columns).map(([name, tasks]) => (
          <div
            key={name}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, name)}
            className="flex-shrink-0 w-80 lg:w-[calc(25%-8px)] h-full flex flex-col"
          >
            <div className="px-5 py-4 flex items-center justify-between sticky top-0 z-10 bg-[#f8f9fb]">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${name === 'POR HACER' ? 'bg-gray-400' :
                  name === 'EN CURSO' ? 'bg-blue-600' :
                    name === 'EN REVISIÓN' ? 'bg-amber-500' : 'bg-green-500'
                  }`}></span>
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-gray-500">
                  {name}
                </h2>
                <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {tasks.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 opacity-10 border-2 border-dashed border-gray-400 rounded-2xl">
                  <span className="material-symbols-outlined text-5xl">inventory_2</span>
                </div>
              )}
              {tasks.map(renderCard)}
            </div>
          </div>
        ))}
      </div>

      {/* Stats Board */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-6 py-3 rounded-2xl shadow-2xl shadow-gray-200/50 flex items-center gap-8 z-20 border border-white/40">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Estado Crítico</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-error">{stats.critical}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
          </div>
        </div>
        <div className="w-[1px] h-8 bg-gray-200/50"></div>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">En Ejecución</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-gray-900">{stats.inProgress}</span>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Active</span>
          </div>
        </div>
        <div className="w-[1px] h-8 bg-gray-200/50"></div>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Eficacia Global</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-green-600">{stats.efficiency}%</span>
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-green-500 h-full" style={{ width: `${stats.efficiency}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {(isUpdating) && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center z-[100] cursor-wait">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 border-r-2"></div>
          </div>
        </div>
      )}

      {/* Renderizar Modal */}
      {renderDetailModal()}
    </div>
  );
}
