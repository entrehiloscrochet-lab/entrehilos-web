"use client";

import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  Truck,
  XCircle,
} from "lucide-react";
import type { FiltroNotif, Notificacion } from "./types";

interface NotificationsTabProps {
  loading: boolean;
  filtroNotif: FiltroNotif;
  onChangeFiltro: (f: FiltroNotif) => void;
  notificaciones: Notificacion[];
  notificacionesFiltradas: Notificacion[];
  noLeidasCount: number;
  leidasCount: number;
  leidasIds: string[];
  onMarcarLeida: (id: string) => void;
  onMarcarTodasLeidas: () => void;
  onVerPedido: () => void;
}

export function NotificationsTab({
  loading,
  filtroNotif,
  onChangeFiltro,
  notificaciones,
  notificacionesFiltradas,
  noLeidasCount,
  leidasCount,
  leidasIds,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onVerPedido,
}: NotificationsTabProps) {
  const filterOptions: { id: FiltroNotif; label: string; count: number }[] = [
    { id: "todos", label: "Todas", count: notificaciones.length },
    { id: "no_leidos", label: "Sin leer", count: noLeidasCount },
    { id: "leidos", label: "Leídas", count: leidasCount },
  ];

  return (
    <div className="space-y-5">
      {/* Barra superior de filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar notificaciones"
          className="grid grid-cols-3 sm:inline-flex gap-1 bg-white border border-[#F0E2E7] p-1 rounded-2xl shadow-2xs w-full sm:w-auto"
        >
          {filterOptions.map((opt) => {
            const active = filtroNotif === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeFiltro(opt.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] ${
                  active
                    ? "bg-[#C04267] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-[#FCF6F8]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[#FAF0F4] text-[#C04267]"
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {noLeidasCount > 0 && (
          <button
            type="button"
            onClick={onMarcarTodasLeidas}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 font-quicksand text-xs font-semibold text-[#C04267] hover:bg-[#FDF2F5] bg-white border border-[#F0E2E7] px-4 py-2 rounded-full transition-colors cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Lista / Estado vacío */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#F0E2E7] p-14 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
          <p className="font-quicksand text-xs text-gray-500">Cargando avisos...</p>
        </div>
      ) : notificacionesFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#F0E2E7] p-8 sm:p-12 text-center space-y-4 shadow-[0_2px_12px_rgba(192,66,103,0.03)]">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FDF0F4] to-[#F9DCE6] border border-[#F3CCD9] flex items-center justify-center text-[#C04267]">
            <Bell size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-fredoka text-lg font-bold text-gray-800">
              {filtroNotif === "no_leidos"
                ? "Estás al día"
                : filtroNotif === "leidos"
                ? "No hay avisos en tu historial de leídas"
                : "Sin notificaciones todavía"}
            </h3>
            <p className="font-quicksand text-xs sm:text-sm text-gray-500 leading-relaxed">
              {filtroNotif === "no_leidos"
                ? "No tienes avisos pendientes por revisar."
                : "Aquí recibirás actualizaciones cuando nuestro taller confirme, teja o envíe tus pedidos."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notificacionesFiltradas.map((n) => {
            const esLeida = Boolean(n.leido || leidasIds.includes(String(n.id)));
            const tipo = (n.tipo || "").toLowerCase();

            let IconComp = Bell;
            let badgeColor = "bg-[#FCF8FA] text-gray-700 border-[#E8D8DE]";
            if (tipo === "entregado") {
              IconComp = CheckCircle2;
              badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
            } else if (tipo === "enviado") {
              IconComp = Truck;
              badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
            } else if (tipo === "confirmado") {
              IconComp = CheckCircle2;
              badgeColor = "bg-sky-50 text-sky-700 border-sky-200";
            } else if (tipo === "cancelado") {
              IconComp = XCircle;
              badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
            } else if (tipo === "en_produccion" || tipo === "listo") {
              IconComp = Sparkles;
              badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
            }

            return (
              <article
                key={n.id}
                className={`w-full rounded-2xl border transition-all p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4 shadow-[0_2px_12px_rgba(192,66,103,0.03)] ${
                  !esLeida
                    ? "bg-gradient-to-r from-white to-[#FDF3F6] border-[#EE6B8D]/45"
                    : "bg-white border-[#F0E2E7] opacity-90"
                }`}
              >
                <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 border ${badgeColor}`}>
                  <IconComp size={19} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-fredoka text-sm sm:text-base font-bold text-gray-800 leading-snug">
                      {n.titulo}
                    </h3>
                    {!esLeida ? (
                      <button
                        type="button"
                        onClick={() => onMarcarLeida(String(n.id))}
                        className="inline-flex items-center gap-1.5 text-[11px] font-quicksand font-semibold text-[#C04267] hover:bg-[#FDF2F5] px-2 py-0.5 rounded-full shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
                        title="Marcar como leída"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#EE6B8D]" />
                        Nuevo
                      </button>
                    ) : (
                      <span className="text-gray-400 text-[11px] inline-flex items-center gap-1 font-quicksand shrink-0">
                        <Check size={12} /> Leída
                      </span>
                    )}
                  </div>

                  <p className="font-quicksand text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                    {n.mensaje}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#F4E9ED]">
                    <span className="font-quicksand text-[11px] text-gray-400">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleDateString("es-PE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>

                    {n.pedido_id && (
                      <button
                        type="button"
                        onClick={() => {
                          onMarcarLeida(String(n.id));
                          onVerPedido();
                        }}
                        className="font-quicksand text-xs font-semibold text-[#C04267] hover:underline inline-flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] rounded"
                      >
                        Ver pedido #{n.pedido_id}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
