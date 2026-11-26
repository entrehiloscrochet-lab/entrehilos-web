"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Phone,
  Search,
  User,
  X,
} from "lucide-react";
import OrderPhotoUploader from "./OrderPhotoUploader";
import { parsearFotosEntrega } from "@/lib/fotos-pedido";
import { DEFAULT_DELIVERY_TIME, formatHora12h, toTimeInputValue } from "@/lib/delivery-schedule";

const HORA_PRESETS = [
  { val: "08:00", label: "8am" },
  { val: "10:00", label: "10am" },
  { val: "12:00", label: "12pm" },
  { val: "15:00", label: "3pm" },
  { val: "18:00", label: "6pm" },
];
import {
  ChannelBadge,
  ChannelSelect,
  PaymentMethodSelect,
  WhatsAppLogo,
  normalizeChannelId,
  normalizePaymentId,
} from "./BrandControls";

export interface PedidoGestionItem {
  id?: string;
  nombre?: string;
  cantidad?: number;
  precio?: number;
  imagen?: string;
  esPersonalizado?: boolean;
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
  fotos_entrega?: unknown;
}

interface GestionarPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: PedidoGestion | null;
  onSaveSuccess: (id: string | number, updatedFields: Record<string, unknown>) => void;
}

const ESTADOS_PRODUCCION = [
  { id: "pendiente", label: "Pendiente" },
  { id: "confirmado", label: "Confirmado" },
  { id: "en_produccion", label: "En preparación" },
  { id: "listo", label: "Listo p/ entrega" },
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
  const [origen, setOrigen] = useState<string>("whatsapp");
  const [estado, setEstado] = useState<string>("pendiente");
  const [metodoPago, setMetodoPago] = useState<string>("yape");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [telefono, setTelefono] = useState<string>("");
  const [direccionEnvio, setDireccionEnvio] = useState<string>("");
  const [adelanto, setAdelanto] = useState<string>("0");
  const [fechaEntrega, setFechaEntrega] = useState<string>("");
  const [horaEntrega, setHoraEntrega] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [fotosEntrega, setFotosEntrega] = useState<string[]>([]);

  const [clientesDirectory, setClientesDirectory] = useState<
    Array<{ id: string; nombre: string; telefono?: string; direccion?: string; origen?: string }>
  >([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerSearch, setClientPickerSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin?tab=clientes-directorio")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setClientesDirectory(list);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!pedido) return;

    let initOrigen = pedido.origen || "tienda";
    let initFecha = "";
    if (pedido.fecha_entrega) {
      initFecha = String(pedido.fecha_entrega).split("T")[0].split(" ")[0].trim();
    }
    let initHora = pedido.hora_entrega || "";
    let initAdelanto =
      pedido.adelanto !== undefined && pedido.adelanto !== null ? Number(pedido.adelanto) : 0;

    if (pedido.notas && typeof pedido.notas === "string") {
      const origMatch = pedido.notas.match(/\[Origen:\s*([^\]]+)\]/i);
      if (origMatch && (!pedido.origen || pedido.origen === "tienda")) {
        initOrigen = origMatch[1].trim();
      }
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

    Promise.resolve().then(() => {
      setOrigen(normalizeChannelId(initOrigen));
      setEstado(pedido.estado || "pendiente");
      setMetodoPago(normalizePaymentId(pedido.metodo_pago || "yape"));
      setClienteNombre(pedido.cliente_nombre || "");
      setTelefono(pedido.cliente_telefono || "");
      setDireccionEnvio(
        pedido.direccion_envio && pedido.direccion_envio !== "Coordinar por WhatsApp"
          ? pedido.direccion_envio
          : ""
      );
      setShowClientPicker(false);
      setClientPickerSearch("");
      setAdelanto(String(initAdelanto));
      setFechaEntrega(initFecha);
      setHoraEntrega(
        initFecha
          ? toTimeInputValue(initHora)
          : initHora
          ? toTimeInputValue(initHora)
          : ""
      );
      setNotas(cleanNotas);
      setFotosEntrega(parsearFotosEntrega(pedido));
      setErrorMsg(null);
    });
  }, [pedido]);

  if (!isOpen || !pedido) return null;

  const itemsList: PedidoGestionItem[] = Array.isArray(pedido.items)
    ? (pedido.items as PedidoGestionItem[])
    : [];

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
    if (!horaEntrega) {
      setHoraEntrega(DEFAULT_DELIVERY_TIME);
    }
  };

  const handleGuardarCambios = async () => {
    setSaving(true);
    setErrorMsg(null);

    const cleanFecha = fechaEntrega && fechaEntrega.trim() ? fechaEntrega.trim().split("T")[0] : null;
    const cleanHora = cleanFecha ? horaEntrega.trim() || DEFAULT_DELIVERY_TIME : null;
    const cleanNotas = notas && notas.trim() ? notas.trim() : null;

    try {
      const payload = {
        action: "actualizar-pedido",
        id: pedido.id,
        updates: {
          origen,
          estado,
          cliente_nombre: clienteNombre.trim() || pedido.cliente_nombre || "Cliente",
          cliente_telefono: telefono.trim(),
          direccion_envio: direccionEnvio.trim() || pedido.direccion_envio || "Coordinar por WhatsApp",
          adelanto: adelantoNum,
          saldo_pendiente: saldoActual,
          metodo_pago: metodoPago,
          fecha_entrega: cleanFecha,
          hora_entrega: cleanHora,
          notas: cleanNotas,
          fotos_entrega: fotosEntrega,
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

  const rawTel = (telefono || "").replace(/\D/g, "");
  const numWa = rawTel ? (rawTel.startsWith("51") ? rawTel : `51${rawTel}`) : "";
  const waUrl = numWa
    ? `https://wa.me/${numWa}?text=${encodeURIComponent(
        `Hola ${clienteNombre || pedido.cliente_nombre || "Cliente"}, te escribimos de Entre Hilos respecto a tu pedido #${pedido.id}.`
      )}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera equilibrada con logo oficial del canal */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0 bg-gradient-to-r from-[#FDF2F5]/70 via-white to-white">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-fredoka text-base sm:text-lg font-bold text-[#C04267] leading-tight">
                Pedido #{pedido.id}
              </h2>
              <ChannelBadge channel={origen} />
            </div>
            <p className="font-quicksand text-xs text-gray-500 mt-0.5 truncate">
              Cliente: <span className="font-semibold text-gray-800">{clienteNombre || "Cliente web"}</span>
              {telefono ? ` · ${telefono}` : " · Sin teléfono"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold font-quicksand items-center gap-1.5 transition-colors"
                title="Abrir WhatsApp"
              >
                <WhatsAppLogo size={15} />
                <span>WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenido panorámico en 2 columnas en desktop para evitar scroll innecesario */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 font-quicksand text-xs space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* COLUMNA IZQUIERDA (6 cols): Cliente + Canal, Productos, Notas y Fotos */}
            <div className="lg:col-span-6 space-y-3.5">
              {/* Cliente, Canal de Origen y Contacto */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-fredoka text-sm font-bold text-gray-800">
                    Cliente y Contacto
                  </label>
                  {clientesDirectory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClientPicker((prev) => !prev)}
                      className="text-[11px] font-quicksand font-bold text-[#C04267] bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Search size={11} />
                      <span>Elegir guardado ({clientesDirectory.length})</span>
                    </button>
                  )}
                </div>

                {showClientPicker && (
                  <div className="bg-gray-50 border border-pink-200 rounded-xl p-2 space-y-1.5">
                    <input
                      type="text"
                      value={clientPickerSearch}
                      onChange={(e) => setClientPickerSearch(e.target.value)}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-quicksand focus:outline-none focus:border-[#EE6B8D]"
                    />
                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 bg-white rounded-lg border border-gray-100">
                      {clientesDirectory
                        .filter((c) => {
                          const q = clientPickerSearch.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            c.nombre.toLowerCase().includes(q) ||
                            (c.telefono || "").includes(q)
                          );
                        })
                        .slice(0, 30)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClienteNombre(c.nombre);
                              if (c.telefono) setTelefono(c.telefono);
                              if (c.direccion) setDireccionEnvio(c.direccion);
                              setShowClientPicker(false);
                              setClientPickerSearch("");
                            }}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-[#FDF4F7] transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="font-quicksand text-xs font-bold text-gray-800 truncate">{c.nombre}</p>
                              {(c.telefono || c.direccion) && (
                                <p className="font-quicksand text-[10px] text-gray-400 truncate">
                                  {[c.telefono, c.direccion].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                            {c.origen && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                {c.origen}
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
                  <div>
                    <label className="block font-quicksand text-[11px] font-bold text-gray-600 mb-1">
                      Nombre del cliente
                    </label>
                    <div className="relative">
                      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        placeholder="Nombre completo del cliente"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                      />
                    </div>
                  </div>

                  <ChannelSelect
                    label="Canal de Origen"
                    value={origen}
                    onChange={setOrigen}
                    allowTienda
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Teléfono / WhatsApp (ej. 902578295)"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>
                  <a
                    href={waUrl || "#"}
                    target={waUrl ? "_blank" : undefined}
                    rel={waUrl ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                      if (!waUrl) e.preventDefault();
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors shrink-0 ${
                      waUrl
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                        : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                    title={waUrl ? "Abrir WhatsApp" : "Ingresa un teléfono para habilitar WhatsApp"}
                  >
                    <WhatsAppLogo size={15} />
                    <span>WhatsApp</span>
                  </a>
                </div>

                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={direccionEnvio}
                    onChange={(e) => setDireccionEnvio(e.target.value)}
                    placeholder="Dirección o punto de entrega (opcional)"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>
              </div>

              {/* Productos del Pedido */}
              {itemsList.length > 0 && (
                <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-fredoka text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <Package size={14} className="text-[#EE6B8D]" />
                      Productos del Pedido
                    </label>
                    <span className="text-[11px] font-bold text-gray-400">
                      {itemsList.length} ítem{itemsList.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {itemsList.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50/70 border border-gray-100"
                      >
                        {it.imagen ? (
                          <a
                            href={it.imagen}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                            title="Ver foto de referencia"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={it.imagen}
                              alt={it.nombre || "Producto"}
                              className="w-9 h-9 rounded-lg object-cover border border-gray-200 bg-white"
                            />
                          </a>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-pink-50 text-[#C04267] flex items-center justify-center shrink-0">
                            <ImageIcon size={14} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-800 truncate">{it.nombre}</p>
                          <p className="text-[10px] text-gray-500">
                            {it.cantidad || 1} × S/ {Number(it.precio || 0).toFixed(2)}
                            {it.esPersonalizado ? " · Personalizado" : ""}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-gray-700 shrink-0">
                          S/ {(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas del Pedido */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-white space-y-1.5">
                <label className="font-fredoka text-sm font-bold text-gray-800 block">
                  Notas del Pedido
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas de entrega, observaciones, dedicatorias..."
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-xs text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
                />
              </div>

              {/* Fotos de la Entrega */}
              {(estado === "entregado" || fotosEntrega.length > 0) && (
                <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                  <label className="font-fredoka text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                    <Camera size={14} />
                    Fotos de la Entrega
                  </label>
                  <OrderPhotoUploader
                    fotos={fotosEntrega}
                    onChange={setFotosEntrega}
                    max={8}
                    label=""
                    compact
                    hint="Adjunta, arrastra o pega (Ctrl + V) fotos de cómo se entregó el pedido. Quedan guardadas con el pedido."
                  />
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA (6 cols): Cobro + Selector Método de Pago, Estado, Fecha de Entrega */}
            <div className="lg:col-span-6 space-y-3.5">
              {/* Cobro y Pagos */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
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
                      Total pagado
                    </span>
                  )}
                </div>

                {/* Total, Adelanto, Saldo */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
                    <span className="font-fredoka text-sm font-bold text-gray-900 block mt-0.5">
                      S/ {totalNum.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">
                      Adelanto (S/)
                    </span>
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
                    className={`p-2.5 rounded-xl border ${
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

                {/* Selector elegante de Método de Pago con logos oficiales */}
                <PaymentMethodSelect
                  label="Método de Pago"
                  value={metodoPago}
                  onChange={setMetodoPago}
                  placement="bottom"
                />
              </div>

              {/* Estado del Pedido */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-white space-y-2.5">
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
                        className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
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

              {/* Fecha de Entrega */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <label className="font-fredoka text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#EE6B8D]" />
                    <span>Fecha de Entrega</span>
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
                      onChange={(e) => {
                        setFechaEntrega(e.target.value);
                        if (e.target.value && !horaEntrega) {
                          setHoraEntrega(DEFAULT_DELIVERY_TIME);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 block mb-1">
                      Hora exacta (default 12:00 p.m.)
                    </label>
                    <div className="relative">
                      <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C04267] pointer-events-none" />
                      <input
                        type="time"
                        value={horaEntrega || DEFAULT_DELIVERY_TIME}
                        onChange={(e) => setHoraEntrega(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {HORA_PRESETS.map((hp) => {
                      const active = (horaEntrega || DEFAULT_DELIVERY_TIME) === hp.val;
                      return (
                        <button
                          key={hp.val}
                          type="button"
                          onClick={() => setHoraEntrega(hp.val)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-quicksand font-bold border transition-colors cursor-pointer ${
                            active
                              ? "bg-[#C04267] text-white border-[#C04267]"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-pink-50 hover:border-pink-200"
                          }`}
                        >
                          {hp.label}
                        </button>
                      );
                    })}
                  </div>
                  {fechaEntrega && (
                    <span className="text-[10px] font-quicksand font-semibold text-[#C04267] flex items-center gap-1">
                      <Clock size={11} />
                      Aviso diario a las {formatHora12h(horaEntrega || DEFAULT_DELIVERY_TIME)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEstado("cancelado");
            }}
            className={`px-3 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer ${
              estado === "cancelado"
                ? "bg-rose-100 text-rose-700"
                : "text-gray-500 hover:text-rose-600"
            }`}
          >
            Cancelar Pedido
          </button>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleGuardarCambios}
              className="px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg bg-[#EE6B8D] hover:bg-[#C04267] text-white font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <Check size={14} className="shrink-0" />
              )}
              <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
