"use client";

import React, { useState, useEffect } from "react";
import {
  X, Folder, FileText, FolderPlus, UploadCloud,
  Trash2, ChevronRight, Eye, MoreVertical, Search, Download
} from "lucide-react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EmpleadoDetailDrawer({ open, onClose, empleado }) {
  const { data: session } = useSession();

  // === ESTADOS PARA EL GESTOR DOCUMENTAL ===
  const [fileSystem, setFileSystem] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Estado para eliminar
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  
  // Limite de historial de actividad
  const [activityLimit, setActivityLimit] = useState(5);

  // Ordenamiento
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Helper para convertir string de tamaño a KB numérico
  const parseSizeToKb = (sizeStr) => {
    if (!sizeStr || sizeStr === '--' || sizeStr === 'Vacía') return 0;
    const val = parseFloat(sizeStr);
    if (isNaN(val)) return 0;
    if (sizeStr.toLowerCase().includes('mb')) return val * 1024;
    if (sizeStr.toLowerCase().includes('gb')) return val * 1024 * 1024;
    return val;
  };

  // Modal/Prompt simple para crear carpeta
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const createFolderOnBackend = async (name, parentId) => {
    try {
      await fetch(`${API_URL}/empleados/${empleado.id}/documentos/carpeta`, {
        method: "POST",
        headers: makeHeaders(session),
        body: JSON.stringify({ nombre: name, parent_id: parentId })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFileSystem = async () => {
    if (!empleado?.id || !session) return;
    try {
      setIsLoadingFiles(true);
      const res = await fetch(`${API_URL}/empleados/${empleado.id}/documentos`, {
        headers: makeHeaders(session)
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map(d => ({
          id: d.id,
          name: d.nombre,
          type: d.es_carpeta ? 'folder' : 'file',
          parentId: d.parent_id,
          createdAt: d.creado_en,
          size: d.tamano || '--',
          url: d.url,
          uploadedBy: d.subido_por || nombre
        }));

        // Función recursiva para obtener tamaño de carpeta
        const getFolderSize = (folderId) => {
          let totalKb = 0;
          const children = mapped.filter(item => item.parentId === folderId);
          for (const child of children) {
            if (child.type === 'file') {
              totalKb += parseSizeToKb(child.size);
            } else if (child.type === 'folder') {
              totalKb += getFolderSize(child.id);
            }
          }
          return totalKb;
        };

        // Calcular tamaños de todas las carpetas
        for (const item of mapped) {
          if (item.type === 'folder') {
            const totalKb = getFolderSize(item.id);
            if (totalKb > 1024) {
              item.size = `${(totalKb / 1024).toFixed(1)} MB`;
            } else if (totalKb > 0) {
              item.size = `${totalKb.toFixed(1)} KB`;
            } else {
              item.size = "Vacía";
            }
          }
        }

        // Si no hay nada, crear "Liquidaciones" por defecto
        if (mapped.length === 0) {
          await createFolderOnBackend('Liquidaciones', null);
          // reload
          return fetchFileSystem();
        } else {
          setFileSystem(mapped);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Cargar desde backend al abrir
  useEffect(() => {
    if (open && empleado) {
      fetchFileSystem();
      setCurrentFolderId(null);
    }
  }, [open, empleado, session]);

  if (!open) return null;

  const nombre = empleado?.usuario?.nombre || "Sin nombre";
  const correo = empleado?.usuario?.correo || "Sin correo";
  const rol = empleado?.usuario?.rol?.codigo || "Sin rol";
  const cargo = empleado?.cargo || "Sin cargo";

  // === LÓGICA GESTOR DOCUMENTAL ===
  const currentItems = fileSystem.filter(item => item.parentId === currentFolderId);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };

  // Construir breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [];
    let curr = currentFolderId;
    while (curr) {
      const folder = fileSystem.find(f => f.id === curr);
      if (folder) {
        crumbs.unshift(folder);
        curr = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const showEllipsis = breadcrumbs.length > 3;
  const visibleBreadcrumbs = showEllipsis ? breadcrumbs.slice(-3) : breadcrumbs;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !session) return;
    try {
      await createFolderOnBackend(newFolderName.trim(), currentFolderId);
      await fetchFileSystem();
    } finally {
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  };

  const handleFiles = async (filesList) => {
    if (!filesList || filesList.length === 0 || !session) return;

    const formData = new FormData();
    if (currentFolderId) {
      formData.append("parent_id", currentFolderId);
    }

    Array.from(filesList).forEach(file => {
      formData.append("files", file);
    });

    try {
      const hdrs = makeHeaders(session);
      delete hdrs["Content-Type"]; // let browser set boundary para multipart

      const res = await fetch(`${API_URL}/empleados/${empleado.id}/documentos/upload`, {
        method: "POST",
        headers: hdrs,
        body: formData
      });
      if (res.ok) {
        await fetchFileSystem();
      }
    } catch (e) {
      console.error("Upload error", e);
    }
  };

  const handleFileUpload = (e) => {
    handleFiles(e.target.files);
    e.target.value = null; // resetear input
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const confirmDelete = async () => {
    if (!session || !itemToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError("");

      const hdrs = makeHeaders(session);
      delete hdrs["Content-Type"];

      const res = await fetch(`${API_URL}/empleados/documentos/${itemToDelete.id}`, {
        method: "DELETE",
        headers: hdrs
      });
      if (res.ok) {
        await fetchFileSystem();
        setItemToDelete(null);
      } else {
        const err = await res.json();
        setDeleteError(err.message || err.error || "No se pudo eliminar el elemento.");
      }
    } catch (e) {
      console.error("Delete error", e);
      setDeleteError("Error de red al intentar eliminar.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isImage = (filename) => /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const isPdf = (filename) => /\.pdf$/i.test(filename);

  const getFullUrl = (url) => {
    if (!url) return null;
    const baseUrl = API_URL.replace(/\/api\/?$/, '');
    return `${baseUrl}${url}`;
  };

  const renderPreview = (fileItem) => {
    if (!fileItem.url) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <FileText className="w-16 h-16 mb-4 text-slate-300" />
          <p>Vista previa no disponible.</p>
        </div>
      );
    }

    const url = getFullUrl(fileItem.url);

    if (isImage(fileItem.name)) {
      return <img src={url} alt={fileItem.name} className="max-w-full max-h-full object-contain" />;
    } else if (isPdf(fileItem.name)) {
      return <iframe src={url} className="w-full h-full rounded-lg bg-white shadow-sm" title={fileItem.name} />;
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <FileText className="w-16 h-16 mb-4 text-slate-300" />
          <p className="font-medium text-slate-700">Archivo no soportado para vista previa</p>
          <p className="text-sm">Puedes descargar el archivo para verlo.</p>
        </div>
      );
    }
  };

  const handleDownload = async (fileItem) => {
    if (fileItem.url) {
      try {
        const fileUrl = getFullUrl(fileItem.url);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("No se pudo descargar");

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileItem.name;
        document.body.appendChild(a);
        a.click();

        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("Error al descargar archivo", err);
        window.open(getFullUrl(fileItem.url), "_blank");
      }
    }
  };

  // --- LÓGICA DE RECIENTES E HISTORIAL ---
  const recentFiles = fileSystem
    .filter(f => f.type === 'file')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const activityHistory = fileSystem
    .map(item => ({
      id: item.id,
      type: item.type === 'folder' ? 'folder_created' : 'file_uploaded',
      itemName: item.name,
      date: item.createdAt,
      user: item.uploadedBy || 'Administrador'
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
    
  const visibleActivityHistory = activityHistory.slice(0, activityLimit);

  const timeAgo = (dateStr) => {
    const ms = new Date() - new Date(dateStr);
    const min = Math.floor(ms / 60000);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `Hace ${day} día${day > 1 ? 's' : ''}`;
    if (hr > 0) return `Hace ${hr} hora${hr > 1 ? 's' : ''}`;
    if (min > 0) return `Hace ${min} min${min > 1 ? 's' : ''}`;
    return 'Hace un momento';
  };

  const getFileIcon = (filename) => {
    if (isImage(filename)) return <div className="flex-shrink-0 w-10 h-10 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center"><FileText className="h-6 w-6" /></div>;
    if (isPdf(filename)) return <div className="flex-shrink-0 w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center"><FileText className="h-6 w-6" /></div>;
    return <div className="flex-shrink-0 w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center"><FileText className="h-6 w-6" /></div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay fondo oscuro */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel lateral (Drawer) */}
      <div className="relative w-full max-w-4xl h-full bg-slate-50 shadow-2xl z-20 flex flex-col transform transition-transform animate-slide-in-right overflow-y-auto">

        {/* CABECERA (Header) */}
        <header className="bg-white p-6 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl uppercase">
              {nombre.charAt(0)}
            </div>
            {/* User Details */}
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-800">{nombre}</h2>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-slate-500">{correo}</span>
                <span className="text-slate-300">•</span>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  {rol}
                </span>
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {cargo}
                </span>
              </div>
            </div>
          </div>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <div className="p-6 space-y-8 flex-1">

          {/* Tarjetas de Información Rápida */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Teléfono</p>
              <p className="text-lg font-bold text-slate-800">{empleado?.telefono || "No registrado"}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha de Ingreso</p>
              <p className="text-lg font-bold text-slate-800">
                {empleado?.fecha_ingreso ? String(empleado.fecha_ingreso).slice(0, 10) : "No registrada"}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sueldo Base</p>
              <p className="text-lg font-bold text-slate-800">
                {Number(empleado?.sueldo_base || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* GESTOR DOCUMENTAL (Documents Section) */}
          <div className="space-y-6">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mr-2 hidden sm:block">Documentos</span>

            <div
              className={`bg-white rounded-2xl border ${isDragging ? 'border-blue-500 ring-4 ring-blue-500/20 bg-blue-50/50' : 'border-slate-200'} overflow-hidden transition-all h-[400px] flex flex-col`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >

              {/* Toolbar Drive */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setCurrentFolderId(null)}
                    className="text-slate-800 hover:text-blue-600 hover:cursor-pointer hover:bg-blue-50 px-2 py-1 rounded-md transition-colors font-medium text-sm"
                  >
                    /
                  </button>

                  {showEllipsis && (
                    <>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <button
                        onClick={() => setCurrentFolderId(breadcrumbs[breadcrumbs.length - 4].id)}
                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 font-medium text-sm px-2 py-1 rounded-md transition-colors"
                        title="Ir a carpeta anterior"
                      >
                        ...
                      </button>
                    </>
                  )}

                  {visibleBreadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <button
                        onClick={() => setCurrentFolderId(crumb.id)}
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors font-medium text-sm truncate max-w-[120px]"
                        title={crumb.name}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex space-x-2 shrink-0 ml-4">
                  <button
                    onClick={() => setShowNewFolderDialog(true)}
                    className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nueva Carpeta
                  </button>

                  <div className="relative">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple
                      onChange={handleFileUpload}
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      Subir Archivo
                    </label>
                  </div>
                </div>
              </div>

              {/* Listado de Archivos/Carpetas */}
              <div className="flex-1 overflow-y-auto relative">
                {isDragging && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm border-2 border-dashed border-blue-400 m-2 rounded-xl">
                    <div className="flex flex-col items-center text-blue-600">
                      <UploadCloud className="w-12 h-12 mb-2 animate-bounce" />
                      <p className="font-semibold text-lg">Suelta los archivos aquí</p>
                    </div>
                  </div>
                )}

                {isLoadingFiles ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <p className="font-medium text-slate-600 animate-pulse">Cargando documentos...</p>
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                      <Folder className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600">Esta carpeta está vacía</p>
                    <p className="text-sm mt-1">Arrastra archivos aquí, usa el botón de subir o crea carpetas.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th 
                          className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                          onClick={() => handleSort('name')}
                        >
                          Nombre {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                          className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                          onClick={() => handleSort('date')}
                        >
                          Modificado {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                          className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                          onClick={() => handleSort('size')}
                        >
                          Tamaño {sortColumn === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentItems
                        .sort((a, b) => {
                          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                          let valA, valB;
                          if (sortColumn === 'name') {
                            valA = a.name.toLowerCase();
                            valB = b.name.toLowerCase();
                          } else if (sortColumn === 'date') {
                            valA = new Date(a.createdAt).getTime();
                            valB = new Date(b.createdAt).getTime();
                          } else if (sortColumn === 'size') {
                            valA = parseSizeToKb(a.size);
                            valB = parseSizeToKb(b.size);
                          }
                          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                          return 0;
                        })
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                            onDoubleClick={() => {
                              if (item.type === 'folder') setCurrentFolderId(item.id);
                            }}
                            onClick={() => {
                              if (item.type === 'file') setSelectedFile(item);
                            }}
                          >
                            <td className="px-6 py-4 flex items-center space-x-3">
                              <div className={item.type === 'folder' ? 'text-blue-500' : 'text-slate-400'}>
                                {item.type === 'folder' ? (
                                  <Folder className="h-5 w-5 fill-blue-100" />
                                ) : (
                                  <FileText className="h-5 w-5" />
                                )}
                              </div>
                              <span
                                className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors"
                                onClick={(e) => {
                                  if (item.type === 'folder') {
                                    e.stopPropagation();
                                    setCurrentFolderId(item.id);
                                  }
                                }}
                              >
                                {item.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {new Date(item.createdAt).toLocaleDateString('es-CL')}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {item.size}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {item.type === 'file' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(item);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title="Descargar"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete(item);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Archivos Recientes */}
            <div className="mt-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Archivos Recientes</p>
              {recentFiles.length === 0 ? (
                <div className="text-sm text-slate-500 p-4 border border-dashed border-slate-200 rounded-xl">
                  No hay archivos recientes.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {recentFiles.map(file => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className="bg-white p-3 rounded-xl border border-slate-100 flex items-center space-x-3 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer"
                    >
                      {getFileIcon(file.name)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {timeAgo(file.createdAt)} • {file.size}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial de Actividad */}
            <div className="mt-8 pb-8">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historial de Actividad</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">({activityHistory.length} registros)</p>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {visibleActivityHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay actividad reciente.</p>
                ) : (
                  visibleActivityHistory.map(event => (
                    <div key={event.id} className="flex space-x-3 items-start">
                      {event.type === 'folder_created' ? (
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs">
                          <FolderPlus className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                          {event.user.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 mt-0.5">
                        <p className="text-sm text-slate-700">
                          <span className="font-bold">{event.user}</span>{' '}
                          {event.type === 'folder_created' ? 'creó la carpeta' : 'subió'}{' '}
                          <span className="font-medium text-blue-600">{event.itemName}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(event.date)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {activityLimit < activityHistory.length && (
                <button 
                  onClick={() => setActivityLimit(prev => prev + 5)}
                  className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase tracking-widest transition-colors w-full text-center"
                >
                  Ver más
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Modal pequeño para crear carpeta */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Nueva Carpeta</h3>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-5"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolderDialog(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Vista Previa */}
      {selectedFile && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 lg:p-8">
          <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-full max-h-[90vh] overflow-hidden animate-slide-in-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                <h3 className="text-lg font-bold text-slate-800 truncate">{selectedFile.name}</h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 lg:p-8 flex items-center justify-center overflow-auto relative">
              {renderPreview(selectedFile)}
            </div>
          </div>
        </div>
      )}

      {/* Modal Moderno para Eliminar */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-in-right">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Eliminar elemento</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    ¿Estás seguro que deseas eliminar <span className="font-semibold text-slate-700">{itemToDelete.name}</span>?
                  </p>
                </div>
              </div>

              {itemToDelete.type === 'folder' && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span className="font-semibold block mb-1">Atención:</span>
                  Eliminar esta carpeta también borrará permanentemente todos los archivos en su interior. Esta acción no se puede deshacer.
                </div>
              )}

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setItemToDelete(null);
                    setDeleteError("");
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilo para animación del drawer */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}
