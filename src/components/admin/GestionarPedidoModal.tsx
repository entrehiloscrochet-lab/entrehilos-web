"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  Calendar,
  DollarSign,
  Phone,
  MessageSquare,
  Loader2,
  Check,
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
  { id: "yape", label: "Yape" },
  { id: "plin", label: "Plin" },
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "contra_entrega", label: "Contra Entrega" },
];

const ESTADOS_PRODUCCION = [
  { id: "pendiente", label: "Pendiente" },
  { id: "confirmado", label: "Confirmado" },
  { id: "en_produccion", label: "En preparación" },
  { id: "listo", label: "Listo para entrega" },
  { id: "enviado", label: "Enviado" },
  { id: "entregado", label: "Entregado" },
  { id: "cancelado", label: "Cancelado" },
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
  const [estado, setEstado] = useState<string>("pendiente");
  const [metodoPago, setMetodoPago] = useState<string>("yape");
  const [adelanto, setAdelanto] = useState<string>("0");
  const [fechaEntrega, setFechaEntrega] = useState<string>("");
  const [horaEntrega, setHoraEntrega] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pedido) return;

    let initFecha = "";
    if (pedido.fecha_entrega) {
      initFecha = String(pedido.fecha_entrega).split("T")[0].split(" ")[0].trim();
    }
    let initHora = pedido.hora_entrega || "";
    let initAdelanto =
      pedido.adelanto !== undefined && pedido.adelanto !== null ? Number(pedido.adelanto) : 0;

    if (pedido.notas && typeof pedido.notas === "string") {
      const fechaMatch = pedido.notas.match(/\[Fecha Entrega:\s*([^\]]+)\]/i);
      if (fechaMatch && !initFecha) {
        const parts = fechaMatch[1].trim().split(" ");
        initFecha = parts[0].split("T")[0].trim();
        if (parts.length > 1 && !initHora) {
          initHora = parts.slice(1).join(" ");
        }
      }
      const adelantoMatch = pedido.notas.match(
        /\[Adelanto:\s*S\/?(\d+(\.\d+)?)(\s*\|\s*Saldo:\s*S\/?(\d+(\.\d+)?))?\]/i
      );
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
    setFechaEntrega(initFecha);
    setHoraEntrega(initHora);
    setNotas(cleanNotas);
    setErrorMsg(null);
  }, [pedido]);

  if (!isOpen || !pedido) return null;

  const totalNum = Number(pedido.total || 0);
  const adelantoNum = Math.max(0, parseFloat(adelanto) || 0);
  const saldoActual = Math.max(0, totalNum - adelantoNum);

  const handleCobrarSaldoTotal = () => {
    setAdelanto(totalNum.toFixed(2));
  };

  const handlePresetFecha = (dias: number) => {
    let base: Date;
    if (fechaEntrega && fechaEntrega.includes("-")) {
      const parts = fechaEntrega.split("-").map(Number);
      base = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      const now = new Date();
      base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    base.setDate(base.getDate() + dias);
    setFechaEntrega(formatDateISO(base));
  };

  const handleGuardarCambios = async () => {
    setSaving(true);
    setErrorMsg(null);

    const cleanFecha = fechaEntrega && fechaEntrega.trim() ? fechaEntrega.trim().split("T")[0] : null;
    const cleanHora = horaEntrega && horaEntrega.trim() ? horaEntrega.trim() : null;
    const cleanNotas = notas && notas.trim() ? notas.trim() : null;

    try {
      const payload = {
        action: "actualizar-pedido",
        id: pedido.id,
        updates: {
          estado,
          adelanto: adelantoNum,
          saldo_pendiente: saldoActual,
          metodo_pago: metodoPago,
          fecha_entrega: cleanFecha,
          hora_entrega: cleanHora,
          notas: cleanNotas,
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

  const rawTel = (pedido.cliente_telefono || "").replace(/\D/g, "");
  const numWa = rawTel ? (rawTel.startsWith("51") ? rawTel : `51${rawTel}`) : "";
  const waUrl = numWa
    ? `https://wa.me/${numWa}?text=${encodeURIComponent(
        `Hola ${pedido.cliente_nombre || "Cliente"}, te escribimos de Entre Hilos respecto a tu pedido #${pedido.id}.`
      )}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera limpia y equilibrada */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-fredoka text-lg font-bold text-gray-900">
                Pedido #{pedido.id}
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-[#C04267] border border-pink-100">
                {pedido.origen ? pedido.origen.toUpperCase() : "TIENDA"}
              </span>
            </div>
            <p className="font-quicksand text-xs text-gray-500 mt-0.5">
              Cliente: <span className="font-semibold text-gray-800">{pedido.cliente_nombre || "Cliente web"}</span>
              {pedido.cliente_telefono && ` · ${pedido.cliente_telefono}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-xs font-bold font-quicksand flex items-center gap-1 transition-colors"
                title="Abrir WhatsApp"
              >
                <MessageSquare size={13} />
                <span>WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable con proporción limpia */}
        <div className="p-5 space-y-4 overflow-y-auto font-quicksand text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SECCIÓN COBROS Y SALDOS */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-fredoka text-sm font-bold text-gray-800">
                Cobro y Pagos
              </span>
              {saldoActual > 0 ? (
                <button
                  type="button"
                  onClick={handleCobrarSaldoTotal}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  Marcar todo como pagado
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Check size={13} />
                  Total cancelado
                </span>
              )}
            </div>

            {/* 3 cajitas proporcionales: Total, Adelanto, Saldo */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
                <span className="font-fredoka text-sm font-bold text-gray-900 block mt-0.5">
                  S/ {totalNum.toFixed(2)}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Adelanto (S/)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={totalNum}
                  value={adelanto}
                  onChange={(e) => setAdelanto(e.target.value)}
                  className="w-full font-fredoka text-sm font-bold text-gray-900 mt-0.5 bg-transparent focus:outline-none focus:text-[#EE6B8D]"
                />
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  saldoActual > 0
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <span className="text-[10px] uppercase font-bold block opacity-80">
                  {saldoActual > 0 ? "Saldo por cobrar" : "Saldo"}
                </span>
                <span className="font-fredoka text-sm font-bold block mt-0.5">
                  S/ {saldoActual.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Métodos de Pago */}
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1.5">
                Método de Pago:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {METODOS_PAGO.map((m) => {
                  const isSel = metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-2 px-1.5 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                        isSel
                          ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. SECCIÓN ESTADO DEL PEDIDO */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2.5">
            <label className="font-fredoka text-sm font-bold text-gray-800 block">
              Estado del Pedido
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ESTADOS_PRODUCCION.map((st) => {
                const isSel = estado === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setEstado(st.id)}
                    className={`py-2 px-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                      isSel
                        ? st.id === "entregado"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : st.id === "cancelado"
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-[#EE6B8D] text-white border-[#EE6B8D] shadow-xs"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SECCIÓN FECHA DE ENTREGA */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-fredoka text-sm font-bold text-gray-800">
                Fecha de Entrega
              </label>
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                <span>Aplazar:</span>
                <button
                  type="button"
                  onClick={() => handlePresetFecha(1)}
                  className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetFecha(2)}
                  className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                >
                  +2d
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetFecha(7)}
                  className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                >
                  +1sem
                </button>
                {fechaEntrega && (
                  <button
                    type="button"
                    onClick={() => {
                      setFechaEntrega("");
                      setHoraEntrega("");
                    }}
                    className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                  Día programado
                </label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                  Horario preferido
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tarde (2pm - 6pm)"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
            </div>
          </div>

          {/* 4. SECCIÓN NOTAS / OBSERVACIONES */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-600 block">
              Notas del Pedido
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas de entrega, observaciones, dedicatorias..."
              className="w-full p-2.5 border border-gray-200 rounded-lg text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
            />
          </div>
        </div>

        {/* Pie del modal: Botones proporcionados y sin confusiones */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEstado("cancelado");
            }}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              estado === "cancelado"
                ? "bg-rose-100 text-rose-700"
                : "text-gray-500 hover:text-rose-600"
            }`}
          >
            Cancelar Pedido
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleGuardarCambios}
              className="px-5 py-2 rounded-lg bg-[#EE6B8D] hover:bg-[#C04267] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
