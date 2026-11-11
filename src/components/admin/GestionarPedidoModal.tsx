"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  CreditCard,
  Truck,
  Phone,
  MessageSquare,
  ExternalLink,
  Loader2,
  Check,
  Ban,
  ArrowRight,
  Sparkles,
  ShoppingBag,
} from "lucide-react";

export interface PedidoGestionItem {
  id?: string;
  nombre?: string;
  cantidad?: number;
  precio?: number;
}

export interface PedidoGestion {
  id: string | number;
  origen?: string | null;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  adelanto?: number | string | null;
  saldo_pendiente?: number | string | null;
  total?: number | string | null;
  notas?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  cliente_email?: string | null;
  direccion_envio?: string | null;
  estado?: string | null;
  metodo_pago?: string | null;
  items?: unknown;
}

interface GestionarPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: PedidoGestion | null;
  onSaveSuccess: (id: string | number, updatedFields: Record<string, unknown>) => void;
}

const METODOS_PAGO = [
  { id: "yape", label: "Yape", color: "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100" },
  { id: "plin", label: "Plin", color: "border-cyan-300 text-cyan-700 bg-cyan-50 hover:bg-cyan-100" },
  { id: "efectivo", label: "Efectivo", color: "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" },
  { id: "transferencia", label: "Transferencia", color: "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100" },
  { id: "tarjeta", label: "Tarjeta", color: "border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100" },
  { id: "contra_entrega", label: "Contra Entrega", color: "border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200" },
];

const ESTADOS_PRODUCCION = [
  { id: "pendiente", label: "Agendado (Pendiente)", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "confirmado", label: "Confirmado", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "en_produccion", label: "En preparación (Tejiendo)", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "listo", label: "Listo para entrega", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "enviado", label: "Enviado / En camino", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "entregado", label: "Entregado (Venta Concluida)", badge: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" },
  { id: "cancelado", label: "Cancelado", badge: "bg-rose-50 text-rose-700 border-rose-200" },
];

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function GestionarPedidoModal({
  isOpen,
  onClose,
  pedido,
  onSaveSuccess,
}: GestionarPedidoModalProps) {
  // Estado local para edición
  const [estado, setEstado] = useState<string>("pendiente");
  const [metodoPago, setMetodoPago] = useState<string>("yape");
  const [adelanto, setAdelanto] = useState<string>("0");
  const [saldoPendiente, setSaldoPendiente] = useState<number>(0);
  const [fechaEntrega, setFechaEntrega] = useState<string>("");
  const [horaEntrega, setHoraEntrega] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  const [showAplazar, setShowAplazar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar campos cuando se abre con un pedido
  useEffect(() => {
    if (!pedido) return;

    let initFecha = pedido.fecha_entrega || "";
    let initHora = pedido.hora_entrega || "";
    let initAdelanto = pedido.adelanto !== undefined && pedido.adelanto !== null ? Number(pedido.adelanto) : 0;
    const totalNum = Number(pedido.total || 0);

    // Extraer de notas si venía empaquetado
    if (pedido.notas && typeof pedido.notas === "string") {
      const fechaMatch = pedido.notas.match(/\[Fecha Entrega:\s*([^\]]+)\]/i);
      if (fechaMatch && !initFecha) {
        const parts = fechaMatch[1].trim().split(" ");
        initFecha = parts[0];
        initHora = parts.slice(1).join(" ");
      }
      const adelantoMatch = pedido.notas.match(/\[Adelanto:\s*S\/?(\d+(\.\d+)?)(\s*\|\s*Saldo:\s*S\/?(\d+(\.\d+)?))?\]/i);
      if (adelantoMatch && initAdelanto === 0) {
        initAdelanto = parseFloat(adelantoMatch[1]) || 0;
      }
    }

    const cleanNotas = (pedido.notas || "")
      .replace(/\[Origen:\s*[^\]]+\]/gi, "")
      .replace(/\[Fecha Entrega:\s*[^\]]+\]/gi, "")
      .replace(/\[Adelanto:[^\]]+\]/gi, "")
      .replace(/\|\s*\|/g, "|")
      .replace(/^\|\s*|\s*\|$/g, "")
      .trim();

    setEstado(pedido.estado || "pendiente");
    setMetodoPago(pedido.metodo_pago || "yape");
    setAdelanto(String(initAdelanto));
    const initSaldo = Math.max(0, totalNum - initAdelanto);
    setSaldoPendiente(initSaldo);
    setFechaEntrega(initFecha);
    setHoraEntrega(initHora);
    setNotas(cleanNotas);
    setShowAplazar(false);
    setErrorMsg(null);
  }, [pedido]);

  if (!isOpen || !pedido) return null;

  const totalNum = Number(pedido.total || 0);
  const adelantoNum = parseFloat(adelanto) || 0;
  const saldoActual = Math.max(0, totalNum - adelantoNum);

  // Acción rápida 1: Marcar Saldo como Cobrado al 100%
  const handleCobrarSaldoTotal = () => {
    setAdelanto(totalNum.toFixed(2));
    setSaldoPendiente(0);
  };

  // Acción rápida 2: Completar Venta y Entregar
  const handleCompletarVenta = () => {
    // Si tenía saldo pendiente, se asume cobrado al entregar
    setAdelanto(totalNum.toFixed(2));
    setSaldoPendiente(0);
    setEstado("entregado");
  };

  // Atajos para aplazar entrega
  const handlePresetFecha = (dias: number) => {
    const base = fechaEntrega ? new Date(fechaEntrega) : new Date();
    base.setDate(base.getDate() + dias);
    setFechaEntrega(formatDateISO(base));
  };

  // Guardar cambios en el backend
  const handleGuardarCambios = async () => {
    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        action: "actualizar-pedido",
        id: pedido.id,
        updates: {
          estado,
          adelanto: adelantoNum,
          saldo_pendiente: saldoActual,
          metodo_pago: metodoPago,
          fecha_entrega: fechaEntrega || null,
          hora_entrega: horaEntrega.trim() || null,
          notas: notas.trim() || null,
        },
      };

      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "No se pudo actualizar el pedido");
      }

      onSaveSuccess(pedido.id, payload.updates);
      onClose();
    } catch (err) {
      console.error("Error al actualizar pedido:", err);
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  // WhatsApp link directo
  const rawTel = (pedido.cliente_telefono || "").replace(/\D/g, "");
  const numWa = rawTel ? (rawTel.startsWith("51") ? rawTel : `51${rawTel}`) : "";
  const waUrl = numWa
    ? `https://wa.me/${numWa}?text=${encodeURIComponent(
        `Hola ${pedido.cliente_nombre || "Cliente"}, te escribimos de Entre Hilos respecto a tu pedido #${pedido.id}.`
      )}`
    : null;

  const itemsList: PedidoGestionItem[] = Array.isArray(pedido.items) ? pedido.items : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-pink-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-b border-pink-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EE6B8D] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-fredoka text-base sm:text-lg font-bold text-gray-800">
                  Gestionar Pedido #{pedido.id}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-pink-200 text-[#C04267]">
                  {pedido.origen || "tienda"}
                </span>
              </div>
              <p className="font-quicksand text-xs text-gray-500">
                Cliente: <strong className="text-gray-700">{pedido.cliente_nombre || "Cliente web"}</strong>
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto font-quicksand text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila Cliente & Contacto */}
          <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-bold text-gray-800 text-xs sm:text-sm">
                {pedido.cliente_nombre || "Sin nombre registrado"}
              </p>
              {pedido.direccion_envio && (
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  📍 {pedido.direccion_envio}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {pedido.cliente_telefono && (
                <a
                  href={`tel:${pedido.cliente_telefono}`}
                  className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Phone size={13} className="text-[#EE6B8D]" />
                  <span>{pedido.cliente_telefono}</span>
                </a>
              )}
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#1e9e4d] font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* SECCIÓN 1: COBRO Y PAGOS (Requerimiento principal del usuario) */}
          <div className="bg-gradient-to-br from-pink-50/60 via-white to-rose-50/40 p-4 rounded-2xl border-2 border-pink-200/80 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-[#C04267]" />
                <h3 className="font-fredoka text-sm sm:text-base font-bold text-gray-800">
                  Estado Financiero y Cobro
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block leading-none">Total Pedido:</span>
                <span className="font-fredoka text-base sm:text-lg font-bold text-[#C04267]">
                  S/ {totalNum.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Tarjetas de Saldo y Adelanto */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-semibold block">Adelanto / Pagado:</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-gray-500 font-bold text-xs">S/</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={totalNum}
                    value={adelanto}
                    onChange={(e) => setAdelanto(e.target.value)}
                    className="w-full font-bold text-xs sm:text-sm text-gray-800 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  saldoActual > 0
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  {saldoActual > 0 ? "Saldo Pendiente:" : "Estado:"}
                </span>
                <span className="font-fredoka text-sm sm:text-base font-bold">
                  {saldoActual > 0 ? `S/ ${saldoActual.toFixed(2)}` : "¡100% Cancelado!"}
                </span>
              </div>
            </div>

            {/* Botón rápido para saldar deuda */}
            {saldoActual > 0 && (
              <button
                type="button"
                onClick={handleCobrarSaldoTotal}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-fredoka font-bold text-xs shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Marcar Saldo Restante como Cobrado (+S/ {saldoActual.toFixed(2)})</span>
              </button>
            )}

            {/* Selector de Método de Pago */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
                Método de Pago utilizado:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {METODOS_PAGO.map((m) => {
                  const isSel = metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition-all text-center cursor-pointer ${
                        isSel
                          ? "bg-[#EE6B8D] text-white border-[#EE6B8D] shadow-xs"
                          : m.color
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: COMPLETAR VENTA Y ESTADO */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#C04267]" />
                <h3 className="font-fredoka text-sm font-bold text-gray-800">
                  Progreso y Entrega del Pedido
                </h3>
              </div>

              {estado !== "entregado" && (
                <button
                  type="button"
                  onClick={handleCompletarVenta}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-fredoka font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <Sparkles size={14} />
                  <span>Completar Venta Ahora</span>
                </button>
              )}
            </div>

            {/* Botones de estado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ESTADOS_PRODUCCION.map((st) => {
                const isSel = estado === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setEstado(st.id)}
                    className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-center cursor-pointer ${
                      isSel
                        ? st.id === "entregado"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : st.id === "cancelado"
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-[#EE6B8D] text-white border-[#EE6B8D] shadow-xs"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 3: FECHA DE ENTREGA Y APLAZAR */}
          <div className="bg-pink-50/40 p-4 rounded-2xl border border-pink-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#EE6B8D]" />
                <h3 className="font-fredoka text-sm font-bold text-gray-800">
                  Fecha y Horario de Entrega
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAplazar(!showAplazar)}
                className="text-[11px] font-bold text-[#C04267] hover:underline cursor-pointer"
              >
                {showAplazar ? "Ocultar reprogramación" : "📅 Aplazar o cambiar fecha"}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Fecha actual:</span>
              <strong className="text-gray-800">
                {fechaEntrega
                  ? new Date(fechaEntrega).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Sin fecha definida (Inmediata)"}
              </strong>
              {horaEntrega && <span className="text-gray-500">({horaEntrega})</span>}
            </div>

            {/* Panel de aplazamiento / reprogramación */}
            {showAplazar && (
              <div className="p-3 bg-white rounded-xl border border-pink-200 space-y-2.5 animate-in fade-in">
                <span className="text-[11px] font-bold text-gray-600 block">
                  Atajos de 1 toque para aplazar:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetFecha(1)}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#C04267] font-bold text-xs"
                  >
                    +1 Día
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetFecha(2)}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#C04267] font-bold text-xs"
                  >
                    +2 Días
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetFecha(7)}
                    className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#C04267] font-bold text-xs"
                  >
                    +1 Semana
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">
                      Nueva fecha:
                    </label>
                    <input
                      type="date"
                      value={fechaEntrega}
                      onChange={(e) => setFechaEntrega(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">
                      Rango horario:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Tarde 2-5pm"
                      value={horaEntrega}
                      onChange={(e) => setHoraEntrega(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: DETALLE DE ITEMS Y NOTAS */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
              Productos del pedido ({itemsList.length})
            </span>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1 max-h-32 overflow-y-auto">
              {itemsList.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-700">
                  <span className="truncate">
                    {it.cantidad || 1}x {it.nombre}
                  </span>
                  <span className="font-bold text-gray-900 shrink-0">
                    S/ {(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">
                Notas del pedido / Taller:
              </label>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones de empaque, dedicatoria, detalles especiales..."
                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#EE6B8D] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Pie con botón de guardado */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleGuardarCambios}
            className="px-5 py-2.5 rounded-xl bg-[#EE6B8D] hover:bg-[#C04267] text-white font-fredoka font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            <span>{saving ? "Guardando..." : "Guardar Cambios del Pedido"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
