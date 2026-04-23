"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";
import { CircularProgress } from "@mui/material";

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
  const [dropTransition, setDropTransition] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [filters, setFilters] = useState({
    proyecto_id: "",
    responsable_id: "",
    periodo: "semanal",
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [formType, setFormType] = useState("TAREA"); // EPICA, TAREA, SUBTAREA
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    proyecto_id: "",
    epica_id: "",
    tarea_id: "",
    responsable_id: "",
    fecha_inicio_plan: new Date().toISOString().split('T')[0],
    dias_plan: 1,
    prioridad: 2,
  });

  const [parentOptions, setParentOptions] = useState([]); // Epicas or Tareas
  const [loadingParents, setLoadingParents] = useState(false);
  
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showQuickAddMember, setShowQuickAddMember] = useState(false);

  // Sincronizar proyecto del form con proyecto del filtro
  useEffect(() => {
    if (isAddModalOpen && !formData.proyecto_id && filters.proyecto_id) {
      setFormData(prev => ({ ...prev, proyecto_id: filters.proyecto_id }));
    }
  }, [isAddModalOpen, filters.proyecto_id]);

  // Cargar padres (Epicas o Tareas) según el proyecto y tipo seleccionado
  useEffect(() => {
    if (!isAddModalOpen || !formData.proyecto_id || formType === "EPICA") {
      setParentOptions([]);
      return;
    }

    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const headers = makeHeaders(session);
        let url = "";
        if (formType === "TAREA") {
          url = `${process.env.NEXT_PUBLIC_API_URL}/epicas?proyecto_id=${formData.proyecto_id}`;
        } else if (formType === "SUBTAREA") {
          url = `${process.env.NEXT_PUBLIC_API_URL}/tareas?proyectoId=${formData.proyecto_id}&pageSize=200`;
        }

        const res = await fetch(url, { headers });
        const json = await res.json();
        if (json.ok) {
          const list = json.rows || json.items || [];
          setParentOptions(list.map(item => ({
            id: item.id,
            nombre: item.nombre || item.titulo || "Sin nombre"
          })));
        }
      } catch (err) {
        console.error("Error fetching parents:", err);
      } finally {
        setLoadingParents(false);
      }
    };

    fetchParents();
  }, [isAddModalOpen, formData.proyecto_id, formType, session]);

  // Cargar miembros del proyecto
  useEffect(() => {
    if (!isAddModalOpen || !formData.proyecto_id) {
      setProjectMembers([]);
      return;
    }

    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const headers = makeHeaders(session);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos/${formData.proyecto_id}`, { headers });
        const json = await res.json();
        if (json.ok && json.row) {
          const members = (json.row.miembros || []).map(m => ({
            id: m.empleado_id,
            nombre: m.empleado?.usuario?.nombre || "Sin nombre"
          }));
          setProjectMembers(members);
        }
      } catch (err) {
        console.error("Error fetching project members:", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [isAddModalOpen, formData.proyecto_id, session]);

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

    // DETERMINAR SI REQUIERE MODAL
    const itemEnColumna = Object.values(columns).flat().find(t => t.id === taskId && t.tipo === tipo);
    if (!itemEnColumna) {
      console.error("No se encontró el item arrastrado:", taskId, tipo);
      return;
    }

    const currentStatus = itemEnColumna.estado;

    // Caso 1: A "EN CURSO" (si viene de pendiente)
    const requiresStartDate = newStatus === "en_progreso" && (currentStatus === "pendiente" || !itemEnColumna.fecha_inicio_real);
    // Caso 2: A "EN REVISIÓN" o "COMPLETADO"
    const requiresEvidence = (newStatus === "en_revision" || newStatus === "completada");

    if (requiresStartDate || requiresEvidence) {
      setDropTransition({ item: itemEnColumna, targetStatus });
      return;
    }

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

  const handleReviewAction = async (item, action) => {
    if (!session) return;
    setSubmittingReview(true);
    try {
      const isSubtarea = item.tipo === "SUBTAREA";
      const estadoParams = action === "approve" ? "completada" : "en_progreso";
      const body = {
        estado: estadoParams,
        comentario_revision: reviewComment,
        ...(action === "approve" ? { 
          avance: 100,
          fecha_fin_real: new Date().toISOString()
        } : {})
      };
      
      const endpoint = isSubtarea ? `tareas-detalle/update/${item.id}` : `tareas/update/${item.id}`;
      const headers = makeHeaders(session);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/${endpoint}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Error al guardar revisión");

      setSelectedItem(null);
      setReviewComment("");
      fetchData(searchTerm);
    } catch (err) {
      alert("Error en revisión: " + err.message);
    } finally {
      setSubmittingReview(false);
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
                  onClick={(e) => { e.stopPropagation(); onChange(value === opt.id ? "" : opt.id); setIsOpen(false); setSearch(""); }}
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

  // --- Modal de Transición de Estado ---
  const StatusTransitionModal = () => {
    if (!dropTransition) return null;
    const { item, targetStatus } = dropTransition;
    const isStart = targetStatus === "EN CURSO";
    const isFinish = targetStatus === "COMPLETADO" || targetStatus === "COMPLETADA";
    
    // Buscar evidencia previa si ya estaba en revisión o tiene evidencias
    const existingEvidence = item.evidencias && item.evidencias.length > 0 ? item.evidencias[0] : null;

    const [comentario, setComentario] = useState("");
    const [files, setFiles] = useState([]);
    const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("tipo", item.tipo);
        formData.append("targetStatus", targetStatus);
        
        if (isStart) {
          formData.append("fecha_inicio_real", fechaInicio);
        } else {
          formData.append("comentario", comentario);
          // Mandar cada archivo
          files.forEach(f => {
            formData.append("archivo", f);
          });
        }

        const headers = makeHeaders(session);
        // Important: delete Content-Type to let browser set it automatically with boundary
        delete headers["Content-Type"];

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas/${item.id}/transition`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message || "Error al procesar transición");
        }

        setDropTransition(null);
        fetchData(searchTerm);
      } catch (err) {
        alert(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDropTransition(null)}></div>
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
          <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {isStart ? "Iniciar Trabajo" : "Confirmar Evidencia"}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                {item.nombre}
              </p>
            </div>
            <button onClick={() => setDropTransition(null)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div className="p-8 space-y-6">
            {isStart ? (
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">Fecha de Inicio Real</label>
                <input 
                  type="date" 
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <p className="text-[10px] text-gray-400 italic">Indica cuándo comenzaste realmente esta actividad.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {existingEvidence && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Evidencia previa (Cargada en revisión)
                    </p>
                    <div className="aspect-video relative rounded-xl overflow-hidden bg-white border border-blue-200">
                       <img 
                        src={existingEvidence.archivo_url.startsWith('http') ? existingEvidence.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${existingEvidence.archivo_url.replace('/api', '')}`} 
                        className="w-full h-full object-cover" 
                        alt="Evidencia previa"
                      />
                    </div>
                    {existingEvidence.comentario && (
                      <p className="text-[11px] text-blue-800 italic">"{existingEvidence.comentario}"</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">
                    {existingEvidence ? "Añadir Nueva Evidencia (Opcional)" : "Evidencia Fotográfica"}
                  </label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*"
                      multiple
                      onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${files.length > 0 ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                      <span className={`material-symbols-outlined text-3xl mb-2 ${files.length > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                        {files.length > 0 ? 'library_add' : 'add_a_photo'}
                      </span>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${files.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {files.length > 0 ? `${files.length} archivos seleccionados` : (existingEvidence ? "Añadir más fotos..." : "Subir Fotos de Evidencia")}
                      </p>
                    </div>
                  </div>

                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-1">
                      {files.map((f, i) => (
                        <div key={i} className="bg-gray-100 rounded-lg px-2 py-1 flex items-center gap-2 group/item">
                          <span className="text-[10px] text-gray-600 font-medium truncate max-w-[120px]">{f.name}</span>
                          <button 
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setFiles(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="text-gray-400 hover:text-red-500 flex items-center"
                          >
                            <span className="material-symbols-outlined text-sm">cancel</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">Comentario de Cierre</label>
                  <textarea 
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder={existingEvidence ? "Añadir más detalles..." : "Describe lo realizado..."}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <footer className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
            <button 
              onClick={() => setDropTransition(null)}
              className="px-6 py-2.5 text-gray-400 text-sm font-bold hover:text-gray-600"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              disabled={submitting || (!isStart && files.length === 0 && !existingEvidence)}
              className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <CircularProgress size={16} color="inherit" />}
              {isStart ? "Comenzar Trabajo" : (isFinish ? "Finalizar Tarea" : "Enviar a Revisión")}
            </button>
          </footer>
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

            {/* Panel de Revisión (Approve/Reject) */}
            {item.estado === "en_revision" && (
              <div className="mt-8 pt-8 border-t border-amber-100 bg-amber-50/50 -mx-8 px-8 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <span className="material-symbols-outlined text-lg">fact_check</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Control de Calidad</h4>
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Revisar entrega del trabajador</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4 shadow-sm">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Comentario al Trabajador</label>
                    <textarea 
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Indica qué pareció el trabajo o por qué lo rechazas..."
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleReviewAction(item, "reject")}
                      disabled={submittingReview}
                      className="flex-1 px-4 py-3 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                      {submittingReview ? <CircularProgress size={14} color="inherit" /> : <><span className="material-symbols-outlined text-sm">thumb_down</span> Rechazar</>}
                    </button>
                    <button 
                      onClick={() => handleReviewAction(item, "approve")}
                      disabled={submittingReview}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      {submittingReview ? <CircularProgress size={14} color="inherit" /> : <><span className="material-symbols-outlined text-sm">check_circle</span> Aprobar y Finalizar</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                onClick={() => setFilters(prev => ({ ...prev, periodo: prev.periodo === p ? "" : p }))}
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
            onChange={(val) => setFilters(prev => ({ ...prev, responsable_id: val, periodo: val ? "" : prev.periodo }))}
          />

          <SearchableSelect
            label="Proyectos"
            placeholder="Todos"
            options={filterOptions.projects}
            value={filters.proyecto_id}
            onChange={(val) => setFilters(prev => ({ ...prev, proyecto_id: val, periodo: val ? "" : prev.periodo }))}
          />

          <button
            onClick={() => {
              setFormType("TAREA");
              setFormData({
                nombre: "",
                descripcion: "",
                proyecto_id: filters.proyecto_id || "",
                epica_id: "",
                tarea_id: "",
                responsable_id: "",
                fecha_inicio_plan: new Date().toISOString().split('T')[0],
                dias_plan: 1,
                prioridad: 2,
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-[11px] font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            NUEVO
          </button>

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
      
      {/* Modal Transición */}
      <StatusTransitionModal />

      {/* Modal Agregar Item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-gray-900">Nuevo Item</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Añadir al flujo de trabajo</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><span className="material-symbols-outlined">close</span></button>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              {/* Type selector */}
              <div className="bg-gray-50 p-1 rounded-2xl border border-gray-100 flex gap-1">
                {["EPICA", "TAREA", "SUBTAREA"].map(t => (
                  <button
                    key={t}
                    onClick={() => { setFormType(t); setFormData(p => ({ ...p, epica_id: "", tarea_id: "" })); }}
                    className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${formType === t ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre / Título</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border-none ring-1 ring-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder={`Nombre de la ${formType.toLowerCase()}...`}
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proyecto</label>
                  <SearchableSelect
                    label="P"
                    placeholder="Seleccionar..."
                    options={filterOptions.projects}
                    value={formData.proyecto_id}
                    onChange={(val) => setFormData({ ...formData, proyecto_id: val, epica_id: "", tarea_id: "" })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable</label>
                    {formData.proyecto_id && (
                      <button 
                        onClick={() => setShowQuickAddMember(!showQuickAddMember)}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        title="Agregar empleado al proyecto"
                      >
                        <span className="material-symbols-outlined text-[12px]">person_add</span>
                        {showQuickAddMember ? "Cancelar" : "Asociar"}
                      </button>
                    )}
                  </div>
                  
                  {showQuickAddMember ? (
                    <div className="flex gap-2">
                       <div className="flex-1">
                          <SearchableSelect
                            label="E"
                            placeholder="Buscar empleado..."
                            options={filterOptions.employees}
                            value={formData.new_member_id || ""}
                            onChange={(val) => setFormData({ ...formData, new_member_id: val })}
                          />
                       </div>
                       <button 
                         disabled={!formData.new_member_id || addingItem}
                         onClick={async () => {
                            if (!formData.new_member_id) return;
                            setAddingItem(true);
                            try {
                              const headers = makeHeaders(session);
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos/${formData.proyecto_id}/miembros/add`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({ empleado_id: formData.new_member_id })
                              });
                              const json = await res.json();
                              if (!json.ok) throw new Error(json.message || "Error al agregar");
                              
                              // Refresh members
                              const resP = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos/${formData.proyecto_id}`, { headers: makeHeaders(session) });
                              const jsonP = await resP.json();
                              if (jsonP.ok) {
                                setProjectMembers((jsonP.row.miembros || []).map(m => ({
                                  id: m.empleado_id,
                                  nombre: m.empleado?.usuario?.nombre || "Sin nombre"
                                })));
                              }
                              
                              setShowQuickAddMember(false);
                              setFormData(prev => ({ ...prev, new_member_id: "", responsable_id: formData.new_member_id }));
                            } catch (err) {
                              alert(err.message);
                            } finally {
                              setAddingItem(false);
                            }
                         }}
                         className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                       >
                         <span className="material-symbols-outlined text-sm">check</span>
                       </button>
                    </div>
                  ) : (
                    <SearchableSelect
                      label="R"
                      placeholder={loadingMembers ? "Cargando..." : "Miembros..."}
                      options={projectMembers}
                      value={formData.responsable_id}
                      onChange={(val) => setFormData({ ...formData, responsable_id: val })}
                    />
                  )}
                </div>

                {formType !== "EPICA" && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {formType === "TAREA" ? "Vincular a Épica" : "Vincular a Tarea"}
                    </label>
                    <SearchableSelect
                      label={formType === "TAREA" ? "E" : "T"}
                      placeholder={loadingParents ? "Cargando..." : "Seleccionar..."}
                      options={parentOptions}
                      value={formType === "TAREA" ? formData.epica_id : formData.tarea_id}
                      onChange={(val) => setFormData({ ...formData, [formType === "TAREA" ? "epica_id" : "tarea_id"]: val })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha Inicio</label>
                  <input
                    type="date"
                    className="w-full bg-gray-50 border-none ring-1 ring-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                    value={formData.fecha_inicio_plan}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio_plan: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duración (Días)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-gray-50 border-none ring-1 ring-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                    value={formData.dias_plan}
                    onChange={(e) => setFormData({ ...formData, dias_plan: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</label>
                  <textarea
                    rows="3"
                    className="w-full bg-gray-50 border-none ring-1 ring-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                    placeholder="Detalles adicionales..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  ></textarea>
                </div>
              </div>
            </div>

            <footer className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={addingItem || !formData.nombre || !formData.proyecto_id || (formType === "TAREA" && !formData.epica_id) || (formType === "SUBTAREA" && !formData.tarea_id)}
                onClick={async () => {
                  setAddingItem(true);
                  try {
                    const headers = makeHeaders(session);
                    let url = "";
                    let body = {};

                    if (formType === "EPICA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/epicas/add`;
                      body = { ...formData };
                    } else if (formType === "TAREA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/tareas/add`;
                      body = { ...formData };
                    } else if (formType === "SUBTAREA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/tareas-detalle/add`;
                      body = { 
                        ...formData, 
                        titulo: formData.nombre // Subtareas usan titulo
                      };
                    }

                    const res = await fetch(url, {
                      method: "POST",
                      headers,
                      body: JSON.stringify(body)
                    });
                    const json = await res.json();
                    if (!json.ok) throw new Error(json.message || "Error al crear");
                    
                    setIsAddModalOpen(false);
                    fetchData(searchTerm);
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setAddingItem(false);
                  }
                }}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
              >
                {addingItem ? "Creando..." : "Crear Ítem"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
