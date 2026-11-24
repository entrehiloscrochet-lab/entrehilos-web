"use client";

import { CheckCircle2, Clock, Package, Sparkles, Truck, XCircle, type LucideIcon } from "lucide-react";

interface StepDef {
  clave: string;
  label: string;
  icon: LucideIcon;
}

const PASOS_ESTANDAR: StepDef[] = [
  { clave: "pendiente", label: "Recibido", icon: Clock },
  { clave: "confirmado", label: "Confirmado", icon: CheckCircle2 },
  { clave: "en_produccion", label: "En taller", icon: Sparkles },
  { clave: "enviado", label: "En camino", icon: Truck },
  { clave: "entregado", label: "Entregado", icon: Package },
];

const PASOS_PERSONALIZADO: StepDef[] = [
  { clave: "pendiente", label: "Solicitado", icon: Clock },
  { clave: "confirmado", label: "Confirmado", icon: CheckCircle2 },
  { clave: "en_produccion", label: "Tejiendo", icon: Sparkles },
  { clave: "listo", label: "Listo", icon: CheckCircle2 },
  { clave: "entregado", label: "Entregado", icon: Package },
];

function getStepIndex(estado: string, isPersonalizado: boolean): number {
  if (isPersonalizado) {
    if (estado === "entregado") return 4;
    if (estado === "listo") return 3;
    if (estado === "en_produccion") return 2;
    if (estado === "confirmado") return 1;
    return 0;
  }

  if (estado === "entregado") return 4;
  if (estado === "enviado") return 3;
  if (estado === "listo" || estado === "en_produccion") return 2;
  if (estado === "confirmado") return 1;
  return 0;
}

export function OrderStepper({
  estado,
  isPersonalizado = false,
}: {
  estado: string;
  isPersonalizado?: boolean;
}) {
  const est = (estado || "pendiente").toLowerCase();

  if (est === "cancelado") {
    return (
      <div className="flex items-start sm:items-center gap-2.5 p-3 sm:p-3.5 bg-rose-50/80 text-rose-800 rounded-xl text-xs font-quicksand font-semibold border border-rose-200/80">
        <XCircle size={16} className="shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
        <span>
          Este pedido fue cancelado. Si tienes alguna consulta, escríbenos directo por WhatsApp.
        </span>
      </div>
    );
  }

  const indexActual = getStepIndex(est, isPersonalizado);
  const pasos = isPersonalizado
    ? PASOS_PERSONALIZADO
    : PASOS_ESTANDAR.map((paso, idx) =>
        idx === 2 && est === "listo" ? { ...paso, label: "Listo" } : paso
      );

  const progressPercent = (indexActual / (pasos.length - 1)) * 100;

  return (
    <div
      className="w-full py-3.5 px-2 sm:px-5 bg-[#FCF8FA] rounded-xl border border-[#F2E3E8]"
      aria-label={`Estado actual del pedido: ${pasos[indexActual]?.label || est}`}
    >
      <div className="relative grid grid-cols-5 items-start">
        {/* Track acotado exactamente entre el centro del primer icono (10%) y el último (90%) */}
        <div
          className="absolute left-[10%] right-[10%] top-3.5 sm:top-4 h-[2px] bg-[#EAD9DF] rounded-full overflow-hidden z-0"
          aria-hidden="true"
        >
          <div
            className="h-full bg-gradient-to-r from-[#C04267] to-[#EE6B8D] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {pasos.map((paso, idx) => {
          const completado = idx <= indexActual;
          const esActual = idx === indexActual;
          const IconPaso = paso.icon;

          return (
            <div key={paso.clave} className="relative z-10 flex flex-col items-center px-0.5">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                  esActual
                    ? "bg-[#EE6B8D] text-white ring-4 ring-[#EE6B8D]/20 shadow-xs"
                    : completado
                    ? "bg-[#C04267] text-white"
                    : "bg-white border border-[#E5D4DA] text-gray-400"
                }`}
              >
                <IconPaso size={13} />
              </div>
              <span
                className={`mt-1.5 font-quicksand text-[10px] sm:text-xs text-center leading-tight transition-colors ${
                  esActual
                    ? "font-bold text-[#C04267]"
                    : completado
                    ? "font-semibold text-gray-700"
                    : "font-medium text-gray-400"
                }`}
              >
                {paso.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
