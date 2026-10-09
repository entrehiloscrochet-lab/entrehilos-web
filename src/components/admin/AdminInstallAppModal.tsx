"use client";

import React, { useState } from "react";
import {
  Download,
  X,
  Smartphone,
  Laptop,
  Tablet,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface InstallPromptEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface AdminInstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: InstallPromptEvent | null;
  onPromptInstall: () => void;
  isInstalled: boolean;
}

export default function AdminInstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onPromptInstall,
  isInstalled,
}: AdminInstallAppModalProps) {
  const [deviceTab, setDeviceTab] = useState<"tablet" | "pc" | "ios">("tablet");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-pink-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-b border-pink-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EE6B8D] text-white flex items-center justify-center shadow-xs">
              <Download size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-fredoka text-base sm:text-lg font-bold text-gray-800">
                Instalar App de Administración
              </h2>
              <p className="font-quicksand text-xs text-gray-500">
                Panel de taller y gestión en pantalla completa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Aviso de exclusividad Admin */}
          <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-200 flex items-start gap-2.5 text-xs text-gray-600">
            <Lock size={15} className="text-[#EE6B8D] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#C04267]">Exclusivo para Administración:</strong> Esta aplicación solo muestra el panel interno de gestión y taller. Los clientes y visitantes de la tienda web no tienen acceso a descargarla ni a verla.
            </div>
          </div>

          {/* Botón de Instalación Directa con 1 Clic si está disponible */}
          {deferredPrompt && !isInstalled && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EE6B8D]/10 via-white to-pink-50 border-2 border-[#EE6B8D]/30 text-center space-y-2">
              <div className="text-xs font-bold text-[#C04267]">
                Tu navegador permite instalación directa
              </div>
              <button
                onClick={onPromptInstall}
                className="w-full py-3 px-4 rounded-2xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-fredoka font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={18} />
                Instalar App Ahora (1 Clic)
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>La aplicación ya está instalada en tu dispositivo.</span>
            </div>
          )}

          {/* Selector de Dispositivos */}
          <div>
            <div className="text-xs font-bold text-gray-700 mb-2">
              Instrucciones paso a paso según tu dispositivo:
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setDeviceTab("tablet")}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  deviceTab === "tablet"
                    ? "bg-white text-[#C04267] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Tablet size={14} />
                <span>Lenovo / Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceTab("pc")}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  deviceTab === "pc"
                    ? "bg-white text-[#C04267] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Laptop size={14} />
                <span>PC / Laptop</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceTab("ios")}
                className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  deviceTab === "ios"
                    ? "bg-white text-[#C04267] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Smartphone size={14} />
                <span>iPad / iPhone</span>
              </button>
            </div>
          </div>

          {/* Pasos según pestaña elegida */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-2.5">
            {deviceTab === "tablet" && (
              <>
                <div className="font-bold text-[#C04267] flex items-center gap-1.5 text-xs sm:text-sm">
                  <Tablet size={16} />
                  En tu Lenovo Idea Tab u otra Tablet Android:
                </div>
                <ol className="space-y-2 list-decimal list-inside text-gray-600 leading-relaxed">
                  <li>
                    Abre <strong>Google Chrome</strong> en tu tablet y entra al panel de administración.
                  </li>
                  <li>
                    Toca el botón de <strong>tres puntos verticales (⋮)</strong> en la esquina superior derecha del navegador.
                  </li>
                  <li>
                    Selecciona la opción <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                  </li>
                  <li>
                    Confirma pulsando <strong>Instalar</strong>.
                  </li>
                </ol>
                <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-200">
                  Aparecerá el ícono de Entre Hilos en tu pantalla de inicio y se abrirá en pantalla completa como una app normal.
                </p>
              </>
            )}

            {deviceTab === "pc" && (
              <>
                <div className="font-bold text-[#C04267] flex items-center gap-1.5 text-xs sm:text-sm">
                  <Laptop size={16} />
                  En tu PC o Laptop (Chrome / Edge / Brave):
                </div>
                <ol className="space-y-2 list-decimal list-inside text-gray-600 leading-relaxed">
                  <li>
                    En la barra de direcciones de arriba, a la derecha de la URL, busca el ícono de <strong>pantalla con flecha hacia abajo</strong> (Instalar Entre Hilos Admin).
                  </li>
                  <li>
                    Haz clic en el ícono y pulsa el botón <strong>&quot;Instalar&quot;</strong>.
                  </li>
                  <li>
                    O abre el menú de tres puntos (⋮) -&gt; <strong>&quot;Guardar y compartir&quot;</strong> -&gt; <strong>&quot;Instalar página como aplicación&quot;</strong>.
                  </li>
                </ol>
                <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-200">
                  La aplicación se abrirá en su propia ventana sin barras del navegador y tendrás un acceso directo en tu escritorio.
                </p>
              </>
            )}

            {deviceTab === "ios" && (
              <>
                <div className="font-bold text-[#C04267] flex items-center gap-1.5 text-xs sm:text-sm">
                  <Smartphone size={16} />
                  En Safari (iPad o iPhone):
                </div>
                <ol className="space-y-2 list-decimal list-inside text-gray-600 leading-relaxed">
                  <li>
                    Abre el panel en <strong>Safari</strong>.
                  </li>
                  <li>
                    Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba).
                  </li>
                  <li>
                    Baja en el menú y selecciona <strong>&quot;Agregar al inicio&quot;</strong>.
                  </li>
                  <li>
                    Toca <strong>Agregar</strong> en la esquina superior derecha.
                  </li>
                </ol>
              </>
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-quicksand font-bold text-xs transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
