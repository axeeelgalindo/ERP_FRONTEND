"use client";

import React, { useState } from "react";
import {
  Printer,
  Download,
  CheckCircle2,
  FolderCheck,
  X,
  FileText,
  Calendar,
  User,
  Building,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import {
  downloadComprobanteVacaciones,
  printComprobanteVacaciones,
  assignComprobanteToEmpleado,
  fmtFechaEspanol,
  fmtFechaCorta,
  fmtDias,
  getPeriodoContractual
} from "@/lib/comprobanteVacacionesPDF";
import { calcularDiasHabilesVacaciones } from "@/lib/diasHabiles";

export default function ComprobanteVacacionesModal({
  isOpen,
  onClose,
  vacacion,
  empleado,
  session,
  isNewlyCreated = false,
}) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignedStatus, setAssignedStatus] = useState(isNewlyCreated);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !vacacion) return null;

  const empNombre = empleado?.nombre || empleado?.usuario?.nombre || "Funcionario";
  const empRut = empleado?.rut || "—";
  const empCargo = empleado?.cargo || "—";
  const sede = String(empleado?.sede || "PMC").toUpperCase();
  const ciudad = sede === "PUQ" ? "Punta Arenas" : "Puerto Montt";
  const direccion = sede === "PUQ" 
    ? "Capitán Juan Guillermos 02233, Punta Arenas"
    : "Av San Agustin La Paloma PC38 Puerto Montt";

  const calc = calcularDiasHabilesVacaciones(vacacion.desde, vacacion.hasta);
  const diasHabiles = Number(vacacion.dias ?? calc.diasHabiles ?? 1);
  const domingosInhabiles = calc.finesDeSemana + calc.feriadosCount;
  const totalDiasCorridos = calc.diasTotales > 0 ? calc.diasTotales : diasHabiles;

  const periodoContractual = vacacion.periodo_contractual || getPeriodoContractual(empleado?.fecha_ingreso, vacacion.desde);

  // Saldos
  let saldoAnterior = vacacion.saldo_anterior;
  let saldoPendiente = vacacion.saldo_pendiente;
  if (saldoAnterior == null) {
    if (vacacion.saldo_disponible != null) {
      saldoAnterior = Number(vacacion.saldo_disponible) + diasHabiles;
      saldoPendiente = Number(vacacion.saldo_disponible);
    } else if (empleado?.saldo_disponible != null) {
      saldoAnterior = Number(empleado.saldo_disponible);
      saldoPendiente = saldoAnterior - diasHabiles;
    } else {
      saldoAnterior = diasHabiles;
      saldoPendiente = 0;
    }
  }
  if (saldoPendiente == null) {
    saldoPendiente = saldoAnterior - diasHabiles;
  }

  const payload = {
    empleado: {
      id: empleado?.id || vacacion.empleado_id,
      nombre: empNombre,
      rut: empRut,
      cargo: empCargo,
      sede,
      fecha_ingreso: empleado?.fecha_ingreso,
    },
    vacacion: {
      ...vacacion,
      dias: diasHabiles,
      saldo_anterior: saldoAnterior,
      saldo_pendiente: saldoPendiente,
      domingos_inhabiles: domingosInhabiles,
      periodo_contractual: periodoContractual,
    },
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setErrorMsg("");
      await downloadComprobanteVacaciones(payload);
    } catch (e) {
      setErrorMsg("Error al generar PDF: " + (e.message || ""));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      setErrorMsg("");
      await printComprobanteVacaciones(payload);
    } catch (e) {
      setErrorMsg("Error al enviar a impresión: " + (e.message || ""));
    } finally {
      setPrinting(false);
    }
  };

  const handleAssignToDocuments = async () => {
    const empId = empleado?.id || vacacion.empleado_id;
    if (!session || !empId) return;
    try {
      setAssigning(true);
      setErrorMsg("");
      const res = await assignComprobanteToEmpleado({
        session,
        empleadoId: empId,
        vacacion: payload.vacacion,
        empleado: payload.empleado,
      });
      if (res?.success) {
        setAssignedStatus(true);
      } else {
        throw new Error(res?.error || "Error al asignar comprobante");
      }
    } catch (e) {
      setErrorMsg(e.message || "Error al subir a documentos");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Comprobante de Vacaciones
                </h3>
                {assignedStatus ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Asignado a Documentos
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                    PDF Listo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Documento legal oficial para firma de ambas partes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación de Asignación Automática si recién se creó */}
        {isNewlyCreated && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2.5 text-xs text-emerald-800">
            <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>¡Vacación registrada y comprobante asignado!</strong> El documento se guardó automáticamente en la carpeta <em>Vacaciones</em> del empleado.
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Hoja de Previsualización del Documento (Diseño Comprobante) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-slate-100/60">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6 text-slate-800 text-xs sm:text-[13px] font-sans">
            {/* Membrete Documento */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <img
                  src="/Logo_blue.png"
                  alt="Blue Ingeniería Logo"
                  className="h-10 w-auto object-contain mb-2"
                />
                <h4 className="font-bold text-slate-900 text-sm">Blue Ingenieria Spa</h4>
                <p className="text-slate-500 text-xs">R.U.T.: 78.115.957-3</p>
                <p className="text-slate-500 text-xs">{direccion}</p>
              </div>

              <div className="text-left sm:text-right self-end sm:self-start">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Lugar y Fecha
                </span>
                <p className="font-medium text-slate-700">
                  {ciudad}, {fmtFechaEspanol(new Date())}
                </p>
              </div>
            </div>

            {/* Título Oficial */}
            <div className="text-center py-1">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-wide">
                CERTIFICADO DE VACACIONES
              </h2>
            </div>

            {/* Datos del Trabajador y Periodo */}
            <div className="bg-slate-50/70 rounded-xl p-4 sm:p-5 border border-slate-200/60 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Período Contractual:</span>
                <span className="sm:col-span-2 font-semibold text-slate-900">{periodoContractual}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Funcionario:</span>
                <span className="sm:col-span-2 font-black text-slate-900 uppercase">{empNombre}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Rut:</span>
                <span className="sm:col-span-2 font-mono font-bold text-slate-900">{empRut}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Vacaciones concedidas:</span>
                <span className="sm:col-span-2 font-semibold text-blue-700">
                  {fmtFechaCorta(vacacion.desde)} al {fmtFechaCorta(vacacion.hasta)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Total días:</span>
                <span className="sm:col-span-2 font-bold text-slate-900">
                  {fmtDias(diasHabiles)} días hábiles
                  {totalDiasCorridos > diasHabiles && (
                    <span className="text-slate-500 font-normal ml-1">
                      ({totalDiasCorridos} días corridos)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Detalle del Feriado */}
            <div className="space-y-3">
              <h5 className="font-bold text-slate-900 text-xs sm:text-sm border-b border-slate-200 pb-1 underline decoration-slate-400 underline-offset-4">
                Detalle del Feriado:
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-600">Saldo anterior :</span>
                  <span className="font-bold text-slate-900">{fmtDias(saldoAnterior)} días</span>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-600">Días Hábiles :</span>
                  <span className="font-bold text-blue-700">{fmtDias(diasHabiles)} días</span>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-600">Domingos e Inhábiles :</span>
                  <span className="font-bold text-slate-900">{fmtDias(domingosInhabiles)} días</span>
                </div>
                <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                  <span className="text-blue-900 font-medium">Saldo pendiente :</span>
                  <span className="font-black text-blue-800">{fmtDias(saldoPendiente)} días</span>
                </div>
              </div>

              <div className="pt-2 text-slate-600 flex items-center justify-between text-xs">
                <span>Fecha Ingreso al trabajo:</span>
                <strong className="text-slate-900 font-bold">
                  {fmtFechaEspanol(empleado?.fecha_ingreso)}
                </strong>
              </div>
            </div>

            {/* Espacio de Firmas */}
            <div className="pt-10 pb-4 grid grid-cols-2 gap-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-40 sm:w-52 border-b-2 border-slate-400 mb-2"></div>
                <span className="font-bold text-slate-900 text-[11px] sm:text-xs">FIRMA DEL TRABAJADOR</span>
                <span className="text-[10px] text-slate-500 uppercase">{empNombre}</span>
                <span className="text-[10px] text-slate-400 font-mono">RUT: {empRut}</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-40 sm:w-52 border-b-2 border-slate-400 mb-2"></div>
                <span className="font-bold text-slate-900 text-[11px] sm:text-xs">FIRMA DEL EMPLEADOR</span>
                <span className="text-[10px] text-slate-500">BLUE INGENIERÍA SPA</span>
                <span className="text-[10px] text-slate-400 font-mono">RUT: 78.115.957-3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            Listo para imprimir en hoja A4 y firmar
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!assignedStatus && (
              <button
                onClick={handleAssignToDocuments}
                disabled={assigning}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Subir y asignar copia en los documentos del empleado"
              >
                <FolderCheck className="w-4 h-4 text-slate-600" />
                {assigning ? "Asignando..." : "Asignar a Documentos"}
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Generando..." : "Descargar PDF"}
            </button>

            <button
              onClick={handlePrint}
              disabled={printing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {printing ? "Preparando..." : "Imprimir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
