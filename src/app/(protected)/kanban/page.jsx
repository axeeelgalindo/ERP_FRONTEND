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
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [addingItem, setAddingItem] = useState(false);
  const [formType, setFormType] = useState("TAREA"); // EPICA, TAREA, SUBTAREA
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    proyecto_id: "",
    destino: "PROYECTO",
    centro_costo: "",
    epica_id: "",
    tarea_id: "",
    responsable_id: "",
    fecha_inicio_plan: new Date().toISOString().split('T')[0],
    dias_plan: 1,
    prioridad: 2,
    predecesora_id: "",
    requisito_texto: "",
    requisitos: [],
  });

  const [parentOptions, setParentOptions] = useState([]); // Epicas or Tareas
  const [loadingParents, setLoadingParents] = useState(false);

  const [taskOptions, setTaskOptions] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showQuickAddMember, setShowQuickAddMember] = useState(false);

  // Estados para visor de evidencias en modal de detalle / revisión
  const [detailEvidenceTab, setDetailEvidenceTab] = useState("imagenes");
  const [detailActiveImgIndex, setDetailActiveImgIndex] = useState(0);
  const [detailLightboxIndex, setDetailLightboxIndex] = useState(null);

  // Resetear índices de evidencias al cambiar de item
  useEffect(() => {
    setDetailActiveImgIndex(0);
    setDetailLightboxIndex(null);
    setDetailEvidenceTab("imagenes");
  }, [selectedItem?.id]);

  // Teclado para lightbox del modal de detalles
  useEffect(() => {
    if (detailLightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setDetailLightboxIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailLightboxIndex]);

  // --- Estados para Modal de Transición de Estado (Elevados al padre para persistir al cambiar de pestaña) ---
  const [transitionComment, setTransitionComment] = useState("");
  const [transitionFiles, setTransitionFiles] = useState([]);
  const [transitionFechaInicio, setTransitionFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionPreviewIndex, setTransitionPreviewIndex] = useState(null);
  const [transitionExistingImgError, setTransitionExistingImgError] = useState(false);

  // Sincronizar fecha inicial al abrir una nueva transición
  useEffect(() => {
    if (dropTransition) {
      setTransitionFechaInicio(new Date().toISOString().split('T')[0]);
      setTransitionExistingImgError(false);
      setTransitionPreviewIndex(null);
    }
  }, [dropTransition?.item?.id, dropTransition?.targetStatus]);

  // Teclado para carrusel de transición
  useEffect(() => {
    if (transitionPreviewIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setTransitionPreviewIndex(null);
      if (e.key === "ArrowLeft") {
        setTransitionPreviewIndex(prev => (prev > 0 ? prev - 1 : transitionFiles.length - 1));
      }
      if (e.key === "ArrowRight") {
        setTransitionPreviewIndex(prev => (prev < transitionFiles.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transitionPreviewIndex, transitionFiles.length]);

  const closeTransitionModal = () => {
    setDropTransition(null);
    setTransitionComment("");
    setTransitionFiles([]);
    setTransitionPreviewIndex(null);
    setTransitionExistingImgError(false);
  };

  // Sincronizar proyecto del form con proyecto del filtro
  useEffect(() => {
    if (isAddModalOpen && !formData.proyecto_id && filters.proyecto_id) {
      setFormData(prev => ({ ...prev, proyecto_id: filters.proyecto_id }));
    }
  }, [isAddModalOpen, filters.proyecto_id]);

  // Cargar padres (Epicas o Tareas) según el proyecto/destino y tipo seleccionado
  useEffect(() => {
    if (!isAddModalOpen || formType === "EPICA") {
      setParentOptions([]);
      return;
    }

    if (formData.destino === "PROYECTO" && !formData.proyecto_id) {
      setParentOptions([]);
      return;
    }

    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const headers = makeHeaders(session);
        let url = "";
        if (formType === "TAREA") {
          if (formData.destino === "PROYECTO") {
            url = `${process.env.NEXT_PUBLIC_API_URL}/epicas?proyecto_id=${formData.proyecto_id}`;
          } else {
            url = `${process.env.NEXT_PUBLIC_API_URL}/epicas?destino=${formData.destino}${formData.centro_costo ? `&centro_costo=${formData.centro_costo}` : ''}`;
          }
        } else if (formType === "SUBTAREA") {
          if (formData.destino === "PROYECTO") {
            url = `${process.env.NEXT_PUBLIC_API_URL}/tareas?proyectoId=${formData.proyecto_id}&pageSize=200`;
          } else {
            url = `${process.env.NEXT_PUBLIC_API_URL}/tareas?destino=${formData.destino}${formData.centro_costo ? `&centro_costo=${formData.centro_costo}` : ''}&pageSize=200`;
          }
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
  }, [isAddModalOpen, formData.proyecto_id, formData.destino, formData.centro_costo, formType, session]);

  // Cargar miembros del proyecto
  useEffect(() => {
    if (!isAddModalOpen || formData.destino !== "PROYECTO" || !formData.proyecto_id) {
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
  }, [isAddModalOpen, formData.proyecto_id, formData.destino, session]);

  // Cargar tareas del proyecto para dependencias
  useEffect(() => {
    const active = isAddModalOpen ? formType === "TAREA" : (selectedItem?.tipo === "TAREA");
    if (!active) {
      setTaskOptions([]);
      return;
    }

    const dest = isAddModalOpen ? formData.destino : selectedItem?.destino;
    const projId = isAddModalOpen ? formData.proyecto_id : selectedItem?.proyecto_id;
    const cc = isAddModalOpen ? formData.centro_costo : selectedItem?.centro_costo;

    if (dest === "PROYECTO" && !projId) {
      setTaskOptions([]);
      return;
    }

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const headers = makeHeaders(session);
        let url = "";
        if (dest === "PROYECTO") {
          url = `${process.env.NEXT_PUBLIC_API_URL}/tareas?proyectoId=${projId}&pageSize=200`;
        } else {
          url = `${process.env.NEXT_PUBLIC_API_URL}/tareas?destino=${dest}${cc ? `&centro_costo=${cc}` : ''}&pageSize=200`;
        }
        const res = await fetch(url, { headers });
        const json = await res.json();
        if (json.ok) {
          const list = json.rows || json.items || [];
          // Si estamos en detalle, filtrar la tarea actual
          const filtered = selectedItem && !isAddModalOpen
            ? list.filter(t => t.id !== selectedItem.id)
            : list;
          setTaskOptions(filtered.map(t => ({
            id: t.id,
            nombre: t.nombre || "Sin nombre"
          })));
        }
      } catch (err) {
        console.error("Error fetching tasks for dependencies:", err);
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [isAddModalOpen, formType, selectedItem, formData.proyecto_id, formData.destino, formData.centro_costo, session]);

  const fetchData = useCallback(async (q = "") => {
    if (!session) return;
    setLoading(true);
    try {
      const headers = makeHeaders(session);
      const projectParam = filters.proyecto_id || "";
      let finalProyectoId = "";
      let finalDestino = "";
      let finalCentroCosto = "";

      if (projectParam.startsWith("DESTINO:")) {
        const parts = projectParam.split(":");
        finalDestino = parts[1] || "";
        finalCentroCosto = parts[2] || "";
      } else if (projectParam) {
        finalProyectoId = projectParam;
      }

      const qs = new URLSearchParams({
        ...(finalProyectoId ? { proyecto_id: finalProyectoId } : {}),
        ...(finalDestino ? { destino: finalDestino } : {}),
        ...(finalCentroCosto ? { centro_costo: finalCentroCosto } : {}),
        ...(filters.responsable_id ? { responsable_id: filters.responsable_id } : {}),
        ...(filters.periodo ? { periodo: filters.periodo } : {}),
        ...(q ? { q } : {}),
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

  function formatNombreUsuario(raw) {
    if (!raw || raw === "Sin Asignar" || raw === "Proyecto" || raw === "??") return raw || "Sin Asignar";
    const s = String(raw).trim();
    if (s.includes(",")) {
      const [apellidosPart, nombresPart] = s.split(",");
      const primerApellido = (apellidosPart || "").trim().split(/\s+/)[0] || "";
      const primerNombre = (nombresPart || "").trim().split(/\s+/)[0] || "";
      return `${primerNombre} ${primerApellido}`.trim() || s;
    }
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0]} ${tokens[1]}`;
    }
    return s;
  }

  const projectOptions = useMemo(() => {
    const dbProjects = (data?.filters?.projects || [])
      .map(p => ({
        id: p.id,
        nombre: `📁 ${p.nombre}`,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    return [
      ...dbProjects,
      { id: "DESTINO:TALLER", nombre: "🏭 Taller (Todos)" },
      { id: "DESTINO:TALLER:PMC", nombre: "🏭 Taller - PMC" },
      { id: "DESTINO:TALLER:PUQ", nombre: "🏭 Taller - PUQ" },
      { id: "DESTINO:ADMINISTRACION", nombre: "🏢 Administración (Todos)" },
      { id: "DESTINO:ADMINISTRACION:PMC", nombre: "🏢 Administración - PMC" },
      { id: "DESTINO:ADMINISTRACION:PUQ", nombre: "🏢 Administración - PUQ" },
    ];
  }, [data?.filters?.projects]);

  const employeeOptions = useMemo(() => {
    return (data?.filters?.employees || [])
      .map(e => ({
        id: e.id,
        nombre: formatNombreUsuario(e.nombre),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [data?.filters?.employees]);

  const SearchableSelect = ({ options, value, onChange, placeholder, label, align = "left" }) => {
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
          className="px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-xs font-bold text-gray-700 outline-none focus-within:ring-2 focus-within:ring-blue-600 cursor-pointer flex items-center gap-1.5 min-w-[140px] max-w-[190px] hover:border-blue-400 transition-colors shadow-2xs"
        >
          <span className="text-gray-400 whitespace-nowrap text-[10px] uppercase tracking-wider">{label}:</span>
          <span className="flex-1 truncate">{selectedOption ? selectedOption.nombre : placeholder}</span>
          <span className={`material-symbols-outlined text-sm text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>

        {isOpen && (
          <div className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[250] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 w-64 max-w-[90vw]`}>
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">search</span>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700"
                  placeholder="Buscar opción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              <div
                className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer font-bold mb-0.5 transition-colors ${!value ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                onClick={(e) => { e.stopPropagation(); onChange(""); setIsOpen(false); setSearch(""); }}
              >
                Todos
              </div>
              {filteredOptions.map(opt => (
                <div
                  key={opt.id}
                  className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer mb-0.5 transition-colors truncate ${value === opt.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={(e) => { e.stopPropagation(); onChange(value === opt.id ? "" : opt.id); setIsOpen(false); setSearch(""); }}
                  title={opt.nombre}
                >
                  {opt.nombre}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-4 py-4 text-xs text-slate-400 italic text-center">No se encontraron resultados</div>
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
    const formattedName = formatNombreUsuario(item.responsable_nombre);
    const initials = formattedName && formattedName !== "Sin Asignar"
      ? formattedName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : (item.tipo === "EPICA" ? "EP" : "??");

    return (
      <div
        key={`${item.tipo}-${item.id}`}
        draggable="true"
        onDragStart={(e) => onDragStart(e, item.id, item.tipo)}
        onClick={() => setSelectedItem(item)}
        className={`w-full shrink-0 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all relative border-l-[4px] ${borderColor} ${isCompletada ? "opacity-75" : ""} cursor-grab active:cursor-grabbing group`}
      >
        <div className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex gap-1.5 items-center">
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${bgType}`}>
                <span className="material-symbols-outlined text-[10px] font-bold">{icon}</span>
                {item.tipo}
              </div>
              {item.tipo === "TAREA" && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${(item.prioridad ?? 2) === 1 ? "bg-green-50 text-green-700 border border-green-200" :
                  (item.prioridad ?? 2) === 3 ? "bg-red-50 text-red-700 border border-red-200 animate-pulse" :
                    "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${(item.prioridad ?? 2) === 1 ? "bg-green-500" :
                    (item.prioridad ?? 2) === 3 ? "bg-red-500" :
                      "bg-amber-500"
                    }`}></span>
                  {(item.prioridad ?? 2) === 1 ? "Baja" : (item.prioridad ?? 2) === 3 ? "Alta" : "Media"}
                </div>
              )}
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
            {item.predecesora_nombre && (
              <p className="text-[9px] text-amber-600 mt-0.5 flex items-center gap-1 font-semibold" title={`Requiere finalizar: ${item.predecesora_nombre}`}>
                <span className="material-symbols-outlined text-[10px] font-bold">arrow_forward</span>
                Req: {item.predecesora_nombre}
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

  // --- Modal de Transición de Estado (Usa estados elevados para persistir datos al cambiar de ventana/pestaña) ---
  const renderStatusTransitionModal = () => {
    if (!dropTransition) return null;
    const { item, targetStatus } = dropTransition;
    const isStart = targetStatus === "EN CURSO";
    const isFinish = targetStatus === "COMPLETADO" || targetStatus === "COMPLETADA";

    // Buscar evidencia previa si ya estaba en revisión o tiene evidencias
    const existingEvidence = item.evidencias && item.evidencias.length > 0 ? item.evidencias[0] : null;

    const handleConfirm = async () => {
      setTransitionSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("tipo", item.tipo);
        formData.append("targetStatus", targetStatus);

        if (isStart) {
          formData.append("fecha_inicio_real", transitionFechaInicio);
        } else {
          formData.append("comentario", transitionComment);
          // Mandar cada archivo
          transitionFiles.forEach(f => {
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

        closeTransitionModal();
        fetchData(searchTerm);
      } catch (err) {
        alert(err.message);
      } finally {
        setTransitionSubmitting(false);
      }
    };

    return (
      <>
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeTransitionModal}></div>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header Fijo */}
            <header className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-white">
              <div className="min-w-0 pr-3">
                <h2 className="text-lg font-black text-gray-900 leading-tight">
                  {isStart ? "Iniciar Trabajo" : "Confirmar Evidencia"}
                </h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 truncate">
                  {item.nombre}
                </p>
              </div>
              <button 
                onClick={closeTransitionModal} 
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </header>

            {/* Cuerpo Scrolleable */}
            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {isStart ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">Fecha de Inicio Real</label>
                  <input
                    type="date"
                    value={transitionFechaInicio}
                    onChange={(e) => setTransitionFechaInicio(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 italic">Indica cuándo comenzaste realmente esta actividad.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Evidencia Previa */}
                  {existingEvidence && (
                    <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          Evidencia previa (Cargada en revisión)
                        </p>
                        {existingEvidence.archivo_url && !transitionExistingImgError && (
                          <a 
                            href={existingEvidence.archivo_url.startsWith('http') ? existingEvidence.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${existingEvidence.archivo_url.replace('/api', '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            Ver original <span className="material-symbols-outlined text-xs">open_in_new</span>
                          </a>
                        )}
                      </div>

                      {transitionExistingImgError || !existingEvidence.archivo_url ? (
                        <div className="py-4 px-4 flex flex-col items-center justify-center text-slate-400 bg-white/70 rounded-xl border border-dashed border-blue-200 text-center">
                          <span className="material-symbols-outlined text-2xl text-slate-400 mb-1">image_not_supported</span>
                          <span className="text-[11px] font-bold text-slate-500">Sin archivo o vista previa disponible</span>
                        </div>
                      ) : /\.(pdf|doc|docx|xls|xlsx)$/i.test(existingEvidence.archivo_url) ? (
                        <div className="bg-white border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl">description</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">Documento de Evidencia</p>
                            <p className="text-[10px] text-slate-400">Clic en 'Ver original' para abrir</p>
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-44 relative rounded-xl overflow-hidden bg-slate-900/5 border border-blue-200 flex items-center justify-center p-1">
                          <img
                            src={existingEvidence.archivo_url.startsWith('http') ? existingEvidence.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${existingEvidence.archivo_url.replace('/api', '')}`}
                            className="max-h-44 w-auto object-contain rounded-lg"
                            alt="Evidencia previa"
                            onError={() => setTransitionExistingImgError(true)}
                          />
                        </div>
                      )}

                      {existingEvidence.comentario && (
                        <p className="text-xs text-blue-900 italic bg-white/60 p-2 rounded-lg border border-blue-100">
                          "{existingEvidence.comentario}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Zona de Carga de Archivos */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">
                      {existingEvidence ? "Añadir Nueva Evidencia (Opcional)" : "Evidencia (Fotos o Documentos)"}
                    </label>
                    
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        multiple
                        onChange={(e) => setTransitionFiles(prev => [...prev, ...Array.from(e.target.files)])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition-all ${transitionFiles.length > 0 ? 'border-green-400 bg-green-50/50' : 'border-slate-200 bg-slate-50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                        <span className={`material-symbols-outlined text-3xl mb-1 ${transitionFiles.length > 0 ? 'text-green-500' : 'text-slate-400'}`}>
                          {transitionFiles.length > 0 ? 'library_add' : 'cloud_upload'}
                        </span>
                        <p className={`text-xs font-bold uppercase tracking-wider ${transitionFiles.length > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                          {transitionFiles.length > 0 ? `${transitionFiles.length} archivo(s) seleccionado(s)` : (existingEvidence ? "Añadir más fotos o documentos..." : "Subir fotos, PDF, Word o Excel")}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Arrastra o haz clic para seleccionar varios archivos
                        </p>
                      </div>
                    </div>

                    {/* Lista con Previsualización de Archivos Subidos (Click para abrir carrusel) */}
                    {transitionFiles.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {transitionFiles.map((f, i) => {
                          const isImage = f.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name);
                          const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
                          const isWord = /\.(doc|docx)$/i.test(f.name);
                          const isExcel = /\.(xls|xlsx|csv)$/i.test(f.name);
                          const sizeFormatted = f.size > 1024 * 1024 
                            ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
                            : `${Math.round(f.size / 1024)} KB`;

                          return (
                            <div 
                              key={i} 
                              onClick={() => setTransitionPreviewIndex(i)}
                              className="relative group bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2.5 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer"
                              title="Haz clic para ver en pantalla completa"
                            >
                              {isImage ? (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60 flex items-center justify-center">
                                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                                </div>
                              ) : isPdf ? (
                                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 shrink-0 flex flex-col items-center justify-center border border-red-100">
                                  <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                                </div>
                              ) : isWord ? (
                                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 shrink-0 flex flex-col items-center justify-center border border-blue-100">
                                  <span className="material-symbols-outlined text-lg">description</span>
                                </div>
                              ) : isExcel ? (
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 flex flex-col items-center justify-center border border-emerald-100">
                                  <span className="material-symbols-outlined text-lg">table_chart</span>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 shrink-0 flex flex-col items-center justify-center border border-slate-200">
                                  <span className="material-symbols-outlined text-lg">draft</span>
                                </div>
                              )}

                              <div className="flex-1 min-w-0 pr-5">
                                <p className="text-xs font-bold text-slate-800 truncate" title={f.name}>
                                  {f.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {sizeFormatted} <span className="text-blue-500 ml-1 font-bold">Ver</span>
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setTransitionFiles(prev => prev.filter((_, idx) => idx !== i));
                                  if (transitionPreviewIndex === i) setTransitionPreviewIndex(null);
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                                title="Eliminar archivo"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Comentario de Cierre */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest">Comentario de Cierre</label>
                    <textarea
                      value={transitionComment}
                      onChange={(e) => setTransitionComment(e.target.value)}
                      placeholder={existingEvidence ? "Añadir más detalles..." : "Describe el trabajo realizado..."}
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Fijo Siempre Visible */}
            <footer className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={closeTransitionModal}
                className="px-5 py-2 text-gray-500 text-xs font-bold hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={transitionSubmitting || (!isStart && transitionFiles.length === 0 && !existingEvidence)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {transitionSubmitting && <CircularProgress size={14} color="inherit" />}
                {isStart ? "Comenzar Trabajo" : (isFinish ? "Finalizar Tarea" : "Enviar a Revisión")}
              </button>
            </footer>
          </div>
        </div>

        {/* CARROUSEL / LIGHTBOX DE PREVISUALIZACIÓN */}
        {transitionPreviewIndex !== null && transitionFiles[transitionPreviewIndex] && (
          <div 
            onClick={() => setTransitionPreviewIndex(null)}
            className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-150 cursor-pointer select-none"
          >
            {/* Barra Superior del Carrousel */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-between text-white px-4 py-2 cursor-default"
            >
              <div className="flex items-center gap-3">
                <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider">
                  {transitionPreviewIndex + 1} / {transitionFiles.length}
                </span>
                <p className="text-sm font-semibold truncate max-w-xs sm:max-w-md">
                  {transitionFiles[transitionPreviewIndex].name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTransitionPreviewIndex(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Cerrar (Esc o clic afuera)"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Zona Principal del Carrousel */}
            <div 
              onClick={() => setTransitionPreviewIndex(null)}
              className="relative flex-1 w-full max-w-4xl flex items-center justify-center p-2"
            >
              {/* Botón Anterior */}
              {transitionFiles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTransitionPreviewIndex(prev => (prev > 0 ? prev - 1 : transitionFiles.length - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/90 hover:bg-blue-600 border border-white/20 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-2xl hover:scale-110 hover:border-blue-400"
                  title="Anterior (Flecha izquierda)"
                >
                  <span className="material-symbols-outlined text-3xl">chevron_left</span>
                </button>
              )}

              {/* Contenido Visual con Marco y Borde Delimitador */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className="max-h-[70vh] max-w-full flex items-center justify-center p-2 cursor-default"
              >
                {transitionFiles[transitionPreviewIndex].type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(transitionFiles[transitionPreviewIndex].name) ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/20 ring-1 ring-black/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-slate-950/90 flex items-center justify-center">
                    <img
                      src={URL.createObjectURL(transitionFiles[transitionPreviewIndex])}
                      alt={transitionFiles[transitionPreviewIndex].name}
                      className="max-h-[68vh] max-w-full object-contain rounded-2xl animate-in zoom-in-95 duration-150 cursor-default"
                    />
                  </div>
                ) : transitionFiles[transitionPreviewIndex].type === "application/pdf" || /\.pdf$/i.test(transitionFiles[transitionPreviewIndex].name) ? (
                  <div className="bg-slate-900 border border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-md text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 ring-black/80">
                    <div className="w-20 h-20 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30">
                      <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                    </div>
                    <h3 className="text-base font-bold mb-1 truncate max-w-xs">{transitionFiles[transitionPreviewIndex].name}</h3>
                    <p className="text-xs text-slate-400 mb-6">Documento PDF</p>
                    <a
                      href={URL.createObjectURL(transitionFiles[transitionPreviewIndex])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Abrir PDF en nueva pestaña
                    </a>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-white/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-md text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 ring-black/80">
                    <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/30">
                      <span className="material-symbols-outlined text-4xl">description</span>
                    </div>
                    <h3 className="text-base font-bold mb-1 truncate max-w-xs">{transitionFiles[transitionPreviewIndex].name}</h3>
                    <p className="text-xs text-slate-400">Documento adjunto</p>
                  </div>
                )}
              </div>

              {/* Botón Siguiente */}
              {transitionFiles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTransitionPreviewIndex(prev => (prev < transitionFiles.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/90 hover:bg-blue-600 border border-white/20 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-2xl hover:scale-110 hover:border-blue-400"
                  title="Siguiente (Flecha derecha)"
                >
                  <span className="material-symbols-outlined text-3xl">chevron_right</span>
                </button>
              )}
            </div>

            {/* Tira inferior de miniaturas */}
            {transitionFiles.length > 1 && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 max-w-xl overflow-x-auto py-2 px-4 custom-scrollbar cursor-default"
              >
                {transitionFiles.map((f, idx) => {
                  const isImg = f.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTransitionPreviewIndex(idx)}
                      className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                        transitionPreviewIndex === idx ? "border-blue-500 scale-105 shadow-md shadow-blue-500/30" : "border-white/20 opacity-50 hover:opacity-100"
                      }`}
                    >
                      {isImg ? (
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">
                          <span className="material-symbols-outlined text-base">draft</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // --- Modal de Detalles ---
  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const item = selectedItem;
    const { bgType, icon } = getTaskStyles(item);
    const isCompletada = ["completada", "finalizado"].includes(item.estado);
    const canEditPriority = item.tipo === "TAREA" && (!item.creador_id || item.creador_id === session?.user?.id);

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
                    {employeeOptions.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {item.tipo === "TAREA" && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prioridad (Urgencia)</span>
                  <div className="flex items-center gap-2">
                    {canEditPriority ? (
                      <select
                        value={item.prioridad ?? 2}
                        onChange={(e) => {
                          const newPrioridad = parseInt(e.target.value) || 2;
                          setSelectedItem(prev => ({
                            ...prev,
                            prioridad: newPrioridad
                          }));

                          (async () => {
                            setIsUpdating(true);
                            try {
                              const headers = makeHeaders(session);
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas/update/${item.id}`, {
                                method: "PATCH",
                                headers,
                                body: JSON.stringify({ prioridad: newPrioridad }),
                              });
                              if (!res.ok) throw new Error("Error al actualizar la prioridad");
                              fetchData(searchTerm);
                            } catch (err) {
                              console.error(err);
                              alert("Error actualizando prioridad");
                            } finally {
                              setIsUpdating(false);
                            }
                          })();
                        }}
                        className="bg-transparent text-xs font-bold text-gray-700 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none cursor-pointer py-0.5"
                      >
                        <option value={1}>🟢 Baja</option>
                        <option value={2}>🟡 Media</option>
                        <option value={3}>🔴 Alta</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 py-0.5">
                        <span>
                          {(item.prioridad ?? 2) === 1 ? "🟢 Baja" : (item.prioridad ?? 2) === 3 ? "🔴 Alta" : "🟡 Media"}
                        </span>
                        <span className="material-symbols-outlined text-[12px] text-gray-400 cursor-help" title="Solo el creador de la tarea puede editar la prioridad">lock</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {item.tipo === "TAREA" && (
                <div className="space-y-3 md:col-span-2 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">playlist_add_check</span>
                    Requisitos y Pendientes ({item.requisitos?.length || 0})
                  </span>

                  {/* Lista de Requisitos Existentes */}
                  <div className="space-y-2">
                    {(item.requisitos || []).map((req) => (
                      <div key={req.id} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200/60 transition-all">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={req.completado}
                            onChange={async (e) => {
                              const newChecked = e.target.checked;
                              // Optimistic UI update
                              setSelectedItem(prev => ({
                                ...prev,
                                requisitos: (prev.requisitos || []).map(r => r.id === req.id ? { ...r, completado: newChecked } : r)
                              }));

                              try {
                                const headers = makeHeaders(session);
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas-requisito/update/${req.id}`, {
                                  method: "PATCH",
                                  headers,
                                  body: JSON.stringify({ completado: newChecked }),
                                });
                                if (!res.ok) throw new Error("No se pudo actualizar el requisito");
                                fetchData(searchTerm);
                              } catch (err) {
                                console.error(err);
                                // Revert
                                setSelectedItem(prev => ({
                                  ...prev,
                                  requisitos: (prev.requisitos || []).map(r => r.id === req.id ? { ...r, completado: !newChecked } : r)
                                }));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4 cursor-pointer"
                          />
                          <span className={`text-xs font-semibold ${req.completado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {req.nombre}
                            {req.predecesora?.nombre && (
                              <span className="ml-1.5 text-[9px] bg-blue-50 text-blue-600 px-1 rounded uppercase font-extrabold tracking-wider border border-blue-100/50">
                                Tarea
                              </span>
                            )}
                          </span>
                        </label>

                        <button
                          onClick={async () => {
                            if (!confirm("¿Eliminar este requisito?")) return;
                            // Optimistic UI update
                            setSelectedItem(prev => ({
                              ...prev,
                              requisitos: (prev.requisitos || []).filter(r => r.id !== req.id)
                            }));

                            try {
                              const headers = makeHeaders(session);
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas-requisito/delete/${req.id}`, {
                                method: "DELETE",
                                headers,
                              });
                              if (!res.ok) throw new Error("No se pudo eliminar el requisito");
                              fetchData(searchTerm);
                            } catch (err) {
                              console.error(err);
                              alert(err.message);
                              fetchData(searchTerm);
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}

                    {(!item.requisitos || item.requisitos.length === 0) && (
                      <p className="text-[11px] text-slate-400 italic">No hay requisitos agregados aún.</p>
                    )}
                  </div>

                  {/* Agregar Nuevo Requisito */}
                  <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl space-y-2.5 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Agregar Requisito desde Tarea Existente
                      </span>
                      <select
                        id="new-req-predecesora-select"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const predTask = taskOptions.find(t => t.id === val);
                          if (predTask) {
                            const inputEl = document.getElementById("new-req-text-input");
                            if (inputEl) {
                              inputEl.value = predTask.nombre;
                              inputEl.dataset.predecesoraId = predTask.id;
                            }
                          }
                        }}
                        className="bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg p-1.5 outline-none focus:border-blue-500 cursor-pointer w-full"
                      >
                        <option value="">-- Seleccionar una tarea --</option>
                        {taskOptions.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        O escribe un Requisito Personalizado
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          id="new-req-text-input"
                          type="text"
                          placeholder="Ej. Tener los implementos, comprar insumos..."
                          className="bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              document.getElementById("btn-add-req-sidebar")?.click();
                            }
                          }}
                        />
                        <button
                          id="btn-add-req-sidebar"
                          onClick={async () => {
                            const inputEl = document.getElementById("new-req-text-input");
                            const nombre = inputEl?.value?.trim();
                            const predecesora_id = inputEl?.dataset?.predecesoraId || null;

                            if (!nombre) return;

                            setIsUpdating(true);
                            try {
                              const headers = makeHeaders(session);
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas-requisito/add`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                  tarea_id: item.id,
                                  nombre,
                                  predecesora_id,
                                }),
                              });
                              if (!res.ok) throw new Error("No se pudo agregar el requisito");
                              const json = await res.json();

                              setSelectedItem(prev => ({
                                ...prev,
                                requisitos: [...(prev.requisitos || []), json.row]
                              }));

                              if (inputEl) {
                                inputEl.value = "";
                                delete inputEl.dataset.predecesoraId;
                              }
                              const selectEl = document.getElementById("new-req-predecesora-select");
                              if (selectEl) selectEl.value = "";

                              fetchData(searchTerm);
                            } catch (err) {
                              console.error(err);
                              alert(err.message);
                            } finally {
                              setIsUpdating(false);
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Añadir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

            {/* Bloque de Evidencias: ANTES vs DESPUÉS */}
            {(() => {
              const allEvidencias = item.evidencias || [];
              const isDoc = (url) => /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i.test(url || "");
              
              // Separar evidencias antes vs después
              const isAntes = (ev) => {
                const com = (ev.comentario || "").toLowerCase();
                return com.includes("antes") || com.includes("inicial");
              };

              const evidenciasAntes = allEvidencias.filter(isAntes);
              const evidenciasDespues = allEvidencias.filter(e => !isAntes(e));

              const imgDespues = evidenciasDespues.filter(e => !isDoc(e.archivo_url));
              const docDespues = evidenciasDespues.filter(e => isDoc(e.archivo_url));
              const currentImgDespues = imgDespues[detailActiveImgIndex] || imgDespues[0];

              return (
                <div className="space-y-6 pt-2">
                  {/* --- APARTADO 1: EVIDENCIA INICIAL (ANTES) --- */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-amber-500">history_toggle_off</span>
                        1. Evidencia Inicial (Antes)
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        evidenciasAntes.length > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-400"
                      }`}>
                        {evidenciasAntes.length > 0 ? `${evidenciasAntes.length} archivo(s)` : "Sin registro"}
                      </span>
                    </div>

                    {evidenciasAntes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evidenciasAntes.map((ev, idx) => {
                          const url = ev.archivo_url.startsWith('http') ? ev.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${ev.archivo_url.replace('/api', '')}`;
                          const isFileDoc = isDoc(ev.archivo_url);

                          if (isFileDoc) {
                            return (
                              <div key={ev.id || idx} className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-xl">description</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">Documento Inicial</p>
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-amber-700 hover:underline inline-flex items-center gap-0.5 mt-0.5">
                                    Abrir documento <span className="material-symbols-outlined text-xs">open_in_new</span>
                                  </a>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={ev.id || idx}
                              onClick={() => {
                                const targetUrl = url;
                                setDetailLightboxIndex(0);
                              }}
                              className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video flex items-center justify-center group cursor-pointer shadow-sm border border-slate-800"
                            >
                              <img
                                src={url}
                                alt="Evidencia Antes"
                                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                }}
                              />
                              <div className="hidden absolute inset-0 bg-slate-100 flex-col items-center justify-center text-slate-400 text-center p-2">
                                <span className="material-symbols-outlined text-2xl text-slate-400 mb-0.5">image_not_supported</span>
                                <span className="text-[10px] font-bold text-slate-500">Imagen no disponible</span>
                              </div>
                              <div className="absolute top-2 left-2 bg-amber-500/90 backdrop-blur-xs text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                                Estado Antes
                              </div>
                              <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="material-symbols-outlined text-sm">zoom_in</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-slate-400">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base text-slate-400">hide_image</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-600">No se adjuntó evidencia inicial (Antes)</p>
                          <p className="text-[10px] text-slate-400">Esta tarea fue creada sin fotografía o documento de estado inicial.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* --- APARTADO 2: EVIDENCIAS DE ENTREGA / TÉRMINO (DESPUÉS) --- */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-blue-600">task_alt</span>
                        2. Evidencias de Entrega (Después) ({evidenciasDespues.length})
                      </span>

                      {/* Selector de Pestañas: Fotos vs Documentos */}
                      {evidenciasDespues.length > 0 && (
                        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setDetailEvidenceTab("imagenes")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                              detailEvidenceTab === "imagenes"
                                ? "bg-white text-blue-600 shadow-2xs font-extrabold"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">photo_library</span>
                            Fotos ({imgDespues.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailEvidenceTab("documentos")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                              detailEvidenceTab === "documentos"
                                ? "bg-white text-blue-600 shadow-2xs font-extrabold"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">description</span>
                            Documentos ({docDespues.length})
                          </button>
                        </div>
                      )}
                    </div>

                    {evidenciasDespues.length === 0 ? (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-70">
                        <span className="material-symbols-outlined text-3xl mb-1 text-slate-400">pending_actions</span>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sin evidencias de término aún</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">El trabajador adjuntará las evidencias de entrega al pasar a revisión o finalizar.</p>
                      </div>
                    ) : (
                      <>
                        {/* Pestaña: FOTOS (Carrusel) */}
                        {detailEvidenceTab === "imagenes" && (
                          <div>
                            {imgDespues.length > 0 && currentImgDespues ? (
                              <div className="space-y-3">
                                {/* Visor Principal de Foto */}
                                <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video flex items-center justify-center group shadow-md">
                                  <img
                                    src={currentImgDespues.archivo_url.startsWith('http') ? currentImgDespues.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${currentImgDespues.archivo_url.replace('/api', '')}`}
                                    alt="Evidencia Después"
                                    onClick={() => setDetailLightboxIndex(detailActiveImgIndex)}
                                    className="max-h-full max-w-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-102"
                                    title="Haz clic para pantalla completa"
                                  />

                                  {/* Badge Contador */}
                                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-white/10 shadow-sm pointer-events-none">
                                    {detailActiveImgIndex + 1} / {imgDespues.length}
                                  </div>

                                  {/* Badge Estado Después */}
                                  <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                                    Estado Después (Término)
                                  </div>

                                  {/* Botón Anterior */}
                                  {imgDespues.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailActiveImgIndex(prev => (prev > 0 ? prev - 1 : imgDespues.length - 1));
                                      }}
                                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-lg hover:scale-110"
                                      title="Foto anterior"
                                    >
                                      <span className="material-symbols-outlined text-xl">chevron_left</span>
                                    </button>
                                  )}

                                  {/* Botón Siguiente */}
                                  {imgDespues.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailActiveImgIndex(prev => (prev < imgDespues.length - 1 ? prev + 1 : 0));
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-lg hover:scale-110"
                                      title="Foto siguiente"
                                    >
                                      <span className="material-symbols-outlined text-xl">chevron_right</span>
                                    </button>
                                  )}
                                </div>

                                {/* Comentario de la Foto Actual */}
                                {currentImgDespues.comentario && (
                                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-base text-slate-400 mt-0.5">comment</span>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-slate-700 italic">
                                        "{currentImgDespues.comentario}"
                                      </p>
                                      <span className="text-[9px] text-slate-400 font-bold block mt-1">
                                        {formatDate(currentImgDespues.creado_en)}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Tira de Miniaturas */}
                                {imgDespues.length > 1 && (
                                  <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar">
                                    {imgDespues.map((ev, idx) => {
                                      const url = ev.archivo_url.startsWith('http') ? ev.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${ev.archivo_url.replace('/api', '')}`;
                                      return (
                                        <button
                                          key={ev.id || idx}
                                          type="button"
                                          onClick={() => setDetailActiveImgIndex(idx)}
                                          className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 transition-all border-2 cursor-pointer bg-slate-900 ${
                                            detailActiveImgIndex === idx
                                              ? "border-blue-600 scale-105 shadow-md shadow-blue-600/30 ring-2 ring-blue-500/20"
                                              : "border-slate-200 opacity-60 hover:opacity-100"
                                          }`}
                                        >
                                          <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-60">
                                <span className="material-symbols-outlined text-3xl mb-1 text-slate-400">no_photography</span>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No se adjuntaron fotos en la entrega</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pestaña: DOCUMENTOS (PDF, Word, Excel) */}
                        {detailEvidenceTab === "documentos" && (
                          <div>
                            {docDespues.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {docDespues.map((ev, idx) => {
                                  const url = ev.archivo_url.startsWith('http') ? ev.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${ev.archivo_url.replace('/api', '')}`;
                                  const isPdf = /\.pdf$/i.test(ev.archivo_url);
                                  const isWord = /\.(doc|docx)$/i.test(ev.archivo_url);
                                  const isExcel = /\.(xls|xlsx|csv)$/i.test(ev.archivo_url);
                                  const rawFileName = ev.archivo_url.split("/").pop() || `Documento_${idx + 1}`;

                                  return (
                                    <div key={ev.id || idx} className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs transition-all group">
                                      {isPdf ? (
                                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 shrink-0 flex flex-col items-center justify-center border border-red-100">
                                          <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                                          <span className="text-[7px] font-black uppercase">PDF</span>
                                        </div>
                                      ) : isWord ? (
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 shrink-0 flex flex-col items-center justify-center border border-blue-100">
                                          <span className="material-symbols-outlined text-xl">description</span>
                                          <span className="text-[7px] font-black uppercase">DOC</span>
                                        </div>
                                      ) : isExcel ? (
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 flex flex-col items-center justify-center border border-emerald-100">
                                          <span className="material-symbols-outlined text-xl">table_chart</span>
                                          <span className="text-[7px] font-black uppercase">XLS</span>
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 shrink-0 flex flex-col items-center justify-center border border-slate-200">
                                          <span className="material-symbols-outlined text-xl">draft</span>
                                          <span className="text-[7px] font-black uppercase">DOC</span>
                                        </div>
                                      )}

                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate" title={rawFileName}>
                                          {rawFileName}
                                        </p>
                                        {ev.comentario && (
                                          <p className="text-[11px] text-slate-500 italic truncate mt-0.5">
                                            "{ev.comentario}"
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-xs">open_in_new</span>
                                            Abrir documento
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-60">
                                <span className="material-symbols-outlined text-3xl mb-1 text-slate-400">folder_off</span>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No se adjuntaron documentos en la entrega</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Panel de Revisión (Approve/Reject) */}
            {item.estado === "en_revision" && (
              <div className="mt-6 pt-6 border-t border-amber-100 bg-amber-50/60 -mx-8 px-8 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <span className="material-symbols-outlined text-lg">fact_check</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Control de Calidad</h4>
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Revisar entrega del trabajador</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-amber-200 p-4 space-y-3 shadow-2xs">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Comentario al Trabajador</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Indica observaciones del trabajo realizado o motivo de rechazo..."
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReviewAction(item, "reject")}
                      disabled={submittingReview}
                      className="flex-1 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {submittingReview ? <CircularProgress size={14} color="inherit" /> : <><span className="material-symbols-outlined text-sm">thumb_down</span> Rechazar</>}
                    </button>
                    <button
                      onClick={() => handleReviewAction(item, "approve")}
                      disabled={submittingReview}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
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
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20 active:scale-95 transition-all cursor-pointer"
            >
              Entendido
            </button>
          </footer>
        </div>

        {/* Lightbox Pantalla Completa en Detalle */}
        {detailLightboxIndex !== null && (() => {
          const isDoc = (url) => /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i.test(url || "");
          const imgEvidences = (item.evidencias || []).filter(e => !isDoc(e.archivo_url));
          const activeEv = imgEvidences[detailLightboxIndex] || imgEvidences[0];
          if (!activeEv) return null;
          const activeUrl = activeEv.archivo_url.startsWith('http') ? activeEv.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${activeEv.archivo_url.replace('/api', '')}`;

          return (
            <div 
              onClick={() => setDetailLightboxIndex(null)}
              className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-150 cursor-pointer select-none"
            >
              {/* Barra Superior */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between text-white px-4 py-2 cursor-default"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider">
                    {detailLightboxIndex + 1} / {imgEvidences.length}
                  </span>
                  {activeEv.comentario && (
                    <p className="text-sm font-semibold truncate max-w-xs sm:max-w-md italic text-slate-200">
                      "{activeEv.comentario}"
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailLightboxIndex(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
                  title="Cerrar (Esc o clic afuera)"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Zona Central */}
              <div 
                onClick={() => setDetailLightboxIndex(null)}
                className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2"
              >
                {imgEvidences.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailLightboxIndex(prev => (prev > 0 ? prev - 1 : imgEvidences.length - 1));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/90 hover:bg-blue-600 border border-white/20 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-2xl hover:scale-110 hover:border-blue-400"
                    title="Anterior"
                  >
                    <span className="material-symbols-outlined text-3xl">chevron_left</span>
                  </button>
                )}

                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="relative rounded-2xl overflow-hidden border border-white/20 ring-1 ring-black/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-slate-950/90 flex items-center justify-center cursor-default"
                >
                  <img
                    src={activeUrl}
                    alt="Evidencia"
                    className="max-h-[75vh] max-w-full object-contain rounded-2xl animate-in zoom-in-95 duration-150 cursor-default"
                  />
                </div>

                {imgEvidences.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailLightboxIndex(prev => (prev < imgEvidences.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-900/90 hover:bg-blue-600 border border-white/20 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-2xl hover:scale-110 hover:border-blue-400"
                    title="Siguiente"
                  >
                    <span className="material-symbols-outlined text-3xl">chevron_right</span>
                  </button>
                )}
              </div>

              {/* Miniaturas Inferiores */}
              {imgEvidences.length > 1 && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 max-w-xl overflow-x-auto py-2 px-4 custom-scrollbar cursor-default"
                >
                  {imgEvidences.map((ev, idx) => {
                    const u = ev.archivo_url.startsWith('http') ? ev.archivo_url : `${process.env.NEXT_PUBLIC_API_URL}${ev.archivo_url.replace('/api', '')}`;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDetailLightboxIndex(idx)}
                        className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                          detailLightboxIndex === idx ? "border-blue-500 scale-105 shadow-md shadow-blue-500/30" : "border-white/20 opacity-50 hover:opacity-100"
                        }`}
                      >
                        <img src={u} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="bg-[#f8f9fb] text-[#191c1e] h-[calc(100vh-var(--app-topbar,0px))] max-h-[calc(100vh-var(--app-topbar,0px))] overflow-hidden flex flex-col font-sans">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); }
        
        /* Scrollbar fino y estético para todo el tablero */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 9999px;
          transition: background-color 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
        }
      `}</style>

      <header className="w-full shrink-0 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 shadow-xs z-30">
        {/* Título & Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
            <span className="material-symbols-outlined text-white text-lg">view_kanban</span>
          </div>
          <h1 className="text-gray-900 font-extrabold tracking-tight uppercase text-base leading-none">
            Kanban
          </h1>
        </div>

        {/* Buscador y Selector Periodo */}
        <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-600 transition-all outline-none text-gray-700 font-medium placeholder:text-gray-400"
              placeholder="Buscar tareas..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-0.5 bg-gray-100/90 p-0.5 rounded-xl shrink-0">
            {["semanal", "mensual", "anual"].map((p) => (
              <button
                key={p}
                onClick={() => setFilters(prev => ({ ...prev, periodo: prev.periodo === p ? "" : p }))}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider ${filters.periodo === p ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-gray-500 hover:text-gray-800"
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros Dropdowns y Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <SearchableSelect
            label="Miembros"
            placeholder="Todos"
            options={employeeOptions}
            value={filters.responsable_id}
            onChange={(val) => setFilters(prev => ({ ...prev, responsable_id: val, periodo: val ? "" : prev.periodo }))}
            align="left"
          />

          <SearchableSelect
            label="Proyectos"
            placeholder="Todos"
            options={projectOptions}
            value={filters.proyecto_id}
            onChange={(val) => setFilters(prev => ({ ...prev, proyecto_id: val, periodo: val ? "" : prev.periodo }))}
            align="right"
          />

          <button
            onClick={() => {
              setFormType("TAREA");
              setFormData({
                nombre: "",
                descripcion: "",
                proyecto_id: filters.proyecto_id?.startsWith("DESTINO:") ? "" : (filters.proyecto_id || ""),
                destino: filters.proyecto_id?.startsWith("DESTINO:TALLER") ? "TALLER" : filters.proyecto_id?.startsWith("DESTINO:ADMINISTRACION") ? "ADMINISTRACION" : "PROYECTO",
                centro_costo: filters.proyecto_id?.includes(":PMC") ? "PMC" : filters.proyecto_id?.includes(":PUQ") ? "PUQ" : "",
                epica_id: "",
                tarea_id: "",
                responsable_id: "",
                fecha_inicio_plan: new Date().toISOString().split('T')[0],
                dias_plan: 1,
                prioridad: 2,
                predecesora_id: "",
                requisito_texto: "",
                requisitos: [],
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            NUEVO
          </button>

          <button
            onClick={() => fetchData(searchTerm)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-gray-200 cursor-pointer"
            title="Refrescar"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-[#f8f9fb] flex px-3 py-3 gap-3">
        {Object.entries(columns).map(([name, tasks]) => (
          <div
            key={name}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, name)}
            className="flex-shrink-0 w-80 lg:w-[calc(25%-10px)] h-full flex flex-col bg-slate-100/60 border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs relative"
          >
            {/* Cabecera con efecto frosted glass / transparencia profesional */}
            <div className="absolute top-0 inset-x-0 z-10 px-4 py-3 h-12 flex items-center justify-between bg-slate-100/80 backdrop-blur-md border-b border-slate-200/60 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${name === 'POR HACER' ? 'bg-gray-400' :
                  name === 'EN CURSO' ? 'bg-blue-600' :
                    name === 'EN REVISIÓN' ? 'bg-amber-500' : 'bg-green-500'
                  }`}></span>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {name}
                </h2>
                <span className="bg-white/90 backdrop-blur-xs text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200/60 shadow-2xs">
                  {tasks.length}
                </span>
              </div>
            </div>

            {/* Contenedor de tarjetas con pt-14 para permitir paso fluido debajo del header */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 pt-14 pb-32 space-y-3.5 custom-scrollbar">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 opacity-40 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-1">drag_indicator</span>
                  <span className="text-[11px] font-bold text-slate-500">Arrastra aquí</span>
                </div>
              ) : (
                <>
                  {tasks.map(renderCard)}
                  <div className="h-16" />
                </>
              )}
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
      {renderStatusTransitionModal()}

      {/* Modal Agregar Item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setIsAddModalOpen(false); setEvidenceFile(null); }}></div>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-gray-900">Nuevo Item</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Añadir al flujo de trabajo</p>
              </div>
              <button onClick={() => { setIsAddModalOpen(false); setEvidenceFile(null); }} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><span className="material-symbols-outlined">close</span></button>
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

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destino</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { val: "PROYECTO", lab: "Proyecto", icon: "construction" },
                      { val: "TALLER", lab: "Taller", icon: "precision_manufacturing" },
                      { val: "ADMINISTRACION", lab: "Admin", icon: "corporate_fare" }
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.val}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            destino: opt.val,
                            proyecto_id: opt.val === "PROYECTO" ? prev.proyecto_id : "",
                            centro_costo: opt.val !== "PROYECTO" ? "PMC" : "",
                            epica_id: "",
                            tarea_id: ""
                          }));
                        }}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${formData.destino === opt.val
                          ? "bg-blue-50 text-blue-600 border-blue-200 shadow-sm"
                          : "bg-gray-50 text-gray-400 border-transparent hover:border-gray-200"
                          }`}
                      >
                        <span className="material-symbols-outlined mb-1 text-xl">{opt.icon}</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-tight">{opt.lab}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.destino === "PROYECTO" ? (
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
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Centro de Costo</label>
                    <SearchableSelect
                      label="CC"
                      placeholder="Seleccionar..."
                      options={[
                        { id: "PMC", nombre: "PMC" },
                        { id: "PUQ", nombre: "PUQ" }
                      ]}
                      value={formData.centro_costo}
                      onChange={(val) => setFormData({ ...formData, centro_costo: val })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable</label>
                    {formData.destino === "PROYECTO" && formData.proyecto_id && (
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

                  {showQuickAddMember && formData.destino === "PROYECTO" ? (
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
                      placeholder={formData.destino === "PROYECTO" && loadingMembers ? "Cargando..." : "Buscar responsable..."}
                      options={formData.destino === "PROYECTO" ? projectMembers : filterOptions.employees}
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

                {formType === "TAREA" && (
                  <div className="space-y-3 md:col-span-2 pt-3 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">playlist_add_check</span>
                      Requisitos de la Tarea ({formData.requisitos?.length || 0})
                    </span>

                    {/* Lista Local de Requisitos */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {(formData.requisitos || []).map((req, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200/50">
                          <span className="text-xs font-semibold text-gray-700">
                            {req.nombre}
                            {req.predecesora_id && (
                              <span className="ml-1.5 text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-extrabold tracking-wider border border-blue-100/30 uppercase">
                                Tarea
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                requisitos: formData.requisitos.filter((_, i) => i !== idx)
                              });
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}

                      {(!formData.requisitos || formData.requisitos.length === 0) && (
                        <p className="text-[11px] text-gray-400 italic pl-1">No hay requisitos agregados.</p>
                      )}
                    </div>

                    {/* Controles para Añadir Requisito */}
                    <div className="bg-gray-50 border border-gray-200/50 p-3.5 rounded-2xl space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          Vincular Tarea Previa
                        </label>
                        <SearchableSelect
                          label="R"
                          placeholder={loadingTasks ? "Cargando..." : "Seleccionar tarea previa..."}
                          options={taskOptions}
                          value=""
                          onChange={(val) => {
                            if (!val) return;
                            const predTask = taskOptions.find(t => t.id === val);
                            if (predTask) {
                              const inputEl = document.getElementById("new-modal-req-text-input");
                              if (inputEl) {
                                inputEl.value = predTask.nombre;
                                inputEl.dataset.predecesoraId = predTask.id;
                              }
                            }
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          O escribe un Requisito Personalizado
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="new-modal-req-text-input"
                            type="text"
                            placeholder="Ej. Tener los implementos, comprar insumos..."
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:border-blue-500 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                document.getElementById("btn-add-req-modal")?.click();
                              }
                            }}
                          />
                          <button
                            type="button"
                            id="btn-add-req-modal"
                            onClick={() => {
                              const inputEl = document.getElementById("new-modal-req-text-input");
                              const nombre = inputEl?.value?.trim();
                              const predecesora_id = inputEl?.dataset?.predecesoraId || null;

                              if (!nombre) return;

                              setFormData({
                                ...formData,
                                requisitos: [...(formData.requisitos || []), { nombre, predecesora_id }]
                              });

                              if (inputEl) {
                                inputEl.value = "";
                                delete inputEl.dataset.predecesoraId;
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0 active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Añadir
                          </button>
                        </div>
                      </div>
                    </div>
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

                {formType === "TAREA" && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prioridad (Urgencia)</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { val: 1, lab: "Baja", color: "bg-green-500", text: "text-green-700", border: "border-green-200", bg: "bg-green-50/50" },
                        { val: 2, lab: "Media", color: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50/50" },
                        { val: 3, lab: "Alta", color: "bg-red-500", text: "text-red-700", border: "border-red-200", bg: "bg-red-50/50" }
                      ].map(p => (
                        <button
                          type="button"
                          key={p.val}
                          onClick={() => setFormData({ ...formData, prioridad: p.val })}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${formData.prioridad === p.val
                            ? `${p.bg} ${p.text} ${p.border} font-black ring-2 ring-offset-1 ring-blue-500`
                            : "bg-gray-50 text-gray-400 border-transparent hover:border-gray-200"
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${p.color}`}></span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider">{p.lab}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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

                {formType !== "EPICA" && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Foto Evidencia (Antes de comenzar)</label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${evidenceFile ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                        <span className={`material-symbols-outlined text-3xl mb-2 ${evidenceFile ? 'text-green-500' : 'text-gray-400'}`}>
                          {evidenceFile ? 'check_circle' : 'add_a_photo'}
                        </span>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${evidenceFile ? 'text-green-600' : 'text-gray-400'}`}>
                          {evidenceFile ? `Foto seleccionada: ${evidenceFile.name}` : "Subir Foto de Evidencia Antes"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <footer className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEvidenceFile(null);
                }}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={addingItem || !formData.nombre || (formData.destino === "PROYECTO" && !formData.proyecto_id) || (formData.destino !== "PROYECTO" && !formData.centro_costo) || (formType === "TAREA" && !formData.epica_id) || (formType === "SUBTAREA" && !formData.tarea_id)}
                onClick={async () => {
                  setAddingItem(true);
                  try {
                    let evidenciaAntesUrl = null;
                    if (evidenceFile) {
                      const uploadHeaders = makeHeaders(session);
                      delete uploadHeaders["Content-Type"];
                      const uploadData = new FormData();
                      uploadData.append("archivo", evidenceFile);

                      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tareas/upload-evidencia`, {
                        method: "POST",
                        headers: uploadHeaders,
                        body: uploadData,
                      });
                      const uploadJson = await uploadRes.json();
                      if (!uploadJson.ok) throw new Error(uploadJson.message || "Error al subir la foto de evidencia");
                      evidenciaAntesUrl = uploadJson.url;
                    }

                    const headers = makeHeaders(session);
                    let url = "";
                    let body = {};

                    if (formType === "EPICA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/epicas/add`;
                      body = { ...formData };
                    } else if (formType === "TAREA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/tareas/add`;
                      body = {
                        ...formData,
                        requisitos: formData.requisitos || [],
                        evidencia_antes_url: evidenciaAntesUrl
                      };
                    } else if (formType === "SUBTAREA") {
                      url = `${process.env.NEXT_PUBLIC_API_URL}/tareas-detalle/add`;
                      body = {
                        ...formData,
                        titulo: formData.nombre, // Subtareas usan titulo
                        evidencia_antes_url: evidenciaAntesUrl
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
                    setEvidenceFile(null);
                    // Reset formData
                    setFormData({
                      nombre: "",
                      descripcion: "",
                      proyecto_id: "",
                      destino: "PROYECTO",
                      centro_costo: "",
                      epica_id: "",
                      tarea_id: "",
                      responsable_id: "",
                      fecha_inicio_plan: new Date().toISOString().split('T')[0],
                      dias_plan: 1,
                      prioridad: 2,
                      predecesora_id: "",
                      requisito_texto: "",
                      requisitos: [],
                    });
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
