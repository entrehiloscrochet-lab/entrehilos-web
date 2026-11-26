"use client";

import React from "react";
import {
  Download,
  X,
  Smartphone,
  Lock,
  BellRing,
  BatteryCharging,
  ShieldCheck,
  Clock,
} from "lucide-react";
import adminApkMeta from "@/lib/admin-apk-meta.json";

const DEFAULT_APK_URL = `/downloads/entrehilos-admin.apk?v=${adminApkMeta.versionName}-${adminApkMeta.versionCode}`;

interface AdminInstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  apkUrl?: string;
}

export default function AdminInstallAppModal({
  isOpen,
  onClose,
  apkUrl = DEFAULT_APK_URL,
}: AdminInstallAppModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-pink-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-b border-pink-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EE6B8D] text-white flex items-center justify-center shadow-xs">
              <Smartphone size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-fredoka text-base sm:text-lg font-bold text-gray-800">
                App Android Admin 100% Nativa (.apk)
              </h2>
              <p className="font-quicksand text-xs text-gray-500">
                Sin navegador ni WebView · Conectada directo a Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-200 flex items-start gap-2.5 text-xs text-gray-600">
            <Lock size={15} className="text-[#EE6B8D] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#C04267]">App Nativa Exclusiva para Administración:</strong>{" "}
              Incluye Dashboard, Pedidos, Personalizados, Agendar entregas, Clientes/Suscriptores y alertas nativas con sonido y vibración aunque cierres la app o bloquees el celular (sin WebView ni consumo de Vercel).
            </div>
          </div>

          {/* Descarga directa del APK */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EE6B8D]/10 via-white to-pink-50 border-2 border-[#EE6B8D]/30 text-center space-y-2.5">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#C04267]">
                Archivo instalable Android firmado (Release)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-pink-200 text-[#C04267] font-mono text-[11px] font-bold">
                v{adminApkMeta.versionName}
              </span>
            </div>
            <a
              href={apkUrl}
              download="entrehilos-admin.apk"
              className="w-full py-3 px-4 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-fredoka font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              <span>Descargar entrehilos-admin.apk</span>
            </a>
            <p className="font-quicksand text-[11px] font-semibold text-gray-600 flex items-center justify-center gap-1.5 flex-wrap">
              <Clock size={12} className="text-[#EE6B8D]" />
              <span>
                Última actualización: {adminApkMeta.updatedAtLabel} · {adminApkMeta.sizeLabel}
              </span>
            </p>
            <p className="font-quicksand text-[10px] text-gray-500">
              Paquete <span className="font-mono text-gray-700">pe.entrehilos.admin</span> · Conectado directamente a Supabase
            </p>
          </div>

          {/* Guía de 4 pasos en Android */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-3">
            <div className="font-bold text-[#C04267] flex items-center gap-1.5 text-xs sm:text-sm">
              <ShieldCheck size={16} />
              Cómo instalar y activar las alertas en tu Android:
            </div>
            <ol className="space-y-2.5 list-decimal list-inside text-gray-600 leading-relaxed">
              <li>
                Pulsa <strong>Descargar entrehilos-admin.apk</strong> arriba para bajar el instalador en tu celular (o pásalo por USB/WhatsApp si lo bajaste en PC).
              </li>
              <li>
                Abre el archivo descargado y, si Android lo pide, activa <strong>Permitir de esta fuente</strong> para completar la instalación.
              </li>
              <li>
                Abre <strong>Entre Hilos Admin</strong> e inicia sesión con tu correo y contraseña de administrador.
              </li>
              <li>
                Acepta el permiso de <strong>Notificaciones</strong> y, dentro de la pestaña <strong>Alertas</strong>, activa{" "}
                <strong>Alarmas exactas</strong> y{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                  <BatteryCharging size={13} /> Sin restricción de batería
                </span>{" "}
                (y <strong>Inicio automático</strong> en Xiaomi) para recibir avisos aunque cierres la app o bloquees la pantalla.
              </li>
            </ol>

            <div className="pt-2 border-t border-gray-200 flex items-start gap-2 text-[11px] text-gray-500">
              <BellRing size={14} className="text-[#EE6B8D] shrink-0 mt-0.5" />
              <span>
                Dispara alertas inmediatas para <strong>pedidos nuevos o agendados</strong>,{" "}
                <strong>nuevos usuarios o suscripciones</strong> y{" "}
                <strong>recordatorios diarios a la hora de entrega (y 2 h antes)</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-quicksand font-bold text-xs transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
