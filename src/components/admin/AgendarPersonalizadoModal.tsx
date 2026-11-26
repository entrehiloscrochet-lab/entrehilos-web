"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Package,
  FileText,
  Loader2,
  Check,
  Palette,
  Ruler,
  AlertCircle,
} from "lucide-react";
import OrderPhotoUploader from "./OrderPhotoUploader";
import { DEFAULT_DELIVERY_TIME, formatHora12h } from "@/lib/delivery-schedule";

const HORA_PRESETS = [
  { val: "08:00", label: "8am" },
  { val: "10:00", label: "10am" },
  { val: "12:00", label: "12pm" },
  { val: "15:00", label: "3pm" },
  { val: "18:00", label: "6pm" },
];

interface AgendarPersonalizadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ESTADOS = [
  { id: "pendiente", label: "Pendiente" },
  { id: "confirmado", label: "Confirmado" },
  { id: "en_produccion", label: "En producción" },
  { id: "listo", label: "Listo" },
  { id: "entregado", label: "Entregado" },
  { id: "cancelado", label: "Cancelado" },
];

export default function AgendarPersonalizadoModal({
  isOpen,
  onClose,
  onSaveSuccess,
}: AgendarPersonalizadoModalProps) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [productoNombre, setProductoNombre] = useState("");
  const [productoPrecio, setProductoPrecio] = useState("");
  const [detalles, setDetalles] = useState("");
  const [colores, setColores] = useState("");
  const [tamano, setTamano] = useState("");
  const [extras, setExtras] = useState("");

  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState(DEFAULT_DELIVERY_TIME);
  const [estado, setEstado] = useState("pendiente");

  const [fotos, setFotos] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNombre("");
    setTelefono("");
    setEmail("");
    setProductoNombre("");
    setProductoPrecio("");
    setDetalles("");
    setColores("");
    setTamano("");
    setExtras("");
    setFechaEntrega("");
    setHoraEntrega(DEFAULT_DELIVERY_TIME);
    setEstado("pendiente");
    setFotos([]);
    setErrorMsg(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const setFechaPreset = (dias: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    setFechaEntrega(formatDateISO(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      setErrorMsg("Ingresa el nombre del cliente.");
      return;
    }
    if (!telefono.trim()) {
      setErrorMsg("Ingresa el teléfono o WhatsApp del cliente.");
      return;
    }
    if (!detalles.trim()) {
      setErrorMsg("Describe el encargo personalizado.");
      return;
    }
    if (!fechaEntrega) {
      setErrorMsg("Selecciona la fecha de entrega.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const precioNum = parseFloat(productoPrecio);

      const data = {
        nombre_cliente: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim() || null,
        producto_nombre: productoNombre.trim() || null,
        producto_precio: Number.isFinite(precioNum) && precioNum > 0 ? precioNum : null,
        detalles: detalles.trim(),
        colores: colores.trim() || null,
        tamano: tamano.trim() || null,
        extras: extras.trim() || null,
        fecha_entrega: fechaEntrega,
        hora_entrega: horaEntrega.trim() || DEFAULT_DELIVERY_TIME,
        estado,
        imagenes_url: fotos,
      };

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "personalizado", data }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo guardar el pedido personalizado");
      }

      onSaveSuccess();
      onClose();
    } catch (err) {
      console.error("Error al guardar pedido personalizado:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Error al guardar el pedido personalizado"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-pink-50/70 via-white to-pink-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EE6B8D] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-fredoka text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Nuevo Pedido Personalizado
              </h3>
              <p className="font-quicksand text-[11px] text-gray-500 leading-none mt-0.5">
                Registra encargos a medida recibidos por WhatsApp o redes sociales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Datos del cliente */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 font-quicksand">
              <User size={14} className="text-[#EE6B8D]" />
              <span>Datos del Cliente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nombre del cliente *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
              />
              <div className="relative">
                <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  required
                  placeholder="Teléfono / WhatsApp *"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
            </div>

            <div className="relative">
              <Mail size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="Correo electrónico (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
              />
            </div>
          </div>

          {/* Encargo */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 font-quicksand">
              <Package size={14} className="text-[#EE6B8D]" />
              <span>Detalle del Encargo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Producto o idea (ej. Ramo de 12 tulipanes)"
                  value={productoNombre}
                  onChange={(e) => setProductoNombre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-quicksand">
                  S/
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Precio acordado"
                  value={productoPrecio}
                  onChange={(e) => setProductoPrecio(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
            </div>

            <div className="relative">
              <FileText size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              <textarea
                required
                rows={3}
                placeholder="Describe el encargo: modelo, colores, materiales, dedicatoria... *"
                value={detalles}
                onChange={(e) => setDetalles(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Palette size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Colores"
                  value={colores}
                  onChange={(e) => setColores(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
              <div className="relative">
                <Ruler size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tamaño"
                  value={tamano}
                  onChange={(e) => setTamano(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
              <input
                type="text"
                placeholder="Extras"
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
              />
            </div>
          </div>

          {/* Fecha y estado */}
          <div className="p-3.5 rounded-xl border border-pink-100 bg-pink-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#C04267] font-quicksand">
                <Calendar size={14} />
                <span>Fecha de Entrega</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFechaPreset(0)}
                  className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setFechaPreset(1)}
                  className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                >
                  Mañana
                </button>
                <button
                  type="button"
                  onClick={() => setFechaPreset(3)}
                  className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                >
                  +3 días
                </button>
                <button
                  type="button"
                  onClick={() => setFechaPreset(7)}
                  className="px-2 py-1 bg-white border border-pink-200 text-[#C04267] hover:bg-pink-100 rounded-md text-[11px] font-quicksand font-bold transition-colors"
                >
                  +1 semana
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-quicksand font-semibold mb-0.5">
                  Fecha programada *
                </label>
                <input
                  type="date"
                  required
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-quicksand font-semibold mb-0.5">
                  Hora exacta (default 12:00 p.m.)
                </label>
                <div className="relative">
                  <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C04267] pointer-events-none" />
                  <input
                    type="time"
                    value={horaEntrega || DEFAULT_DELIVERY_TIME}
                    onChange={(e) => setHoraEntrega(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand font-semibold text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-quicksand font-semibold mb-0.5">
                  Estado inicial
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                >
                  {ESTADOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
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
                      className={`px-2 py-0.5 rounded text-[10px] font-quicksand font-bold border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#C04267] text-white border-[#C04267]"
                          : "bg-white text-gray-600 border-pink-200 hover:bg-pink-100"
                      }`}
                    >
                      {hp.label}
                    </button>
                  );
                })}
              </div>
              {fechaEntrega && (
                <span className="text-[11px] font-quicksand font-semibold text-[#C04267] flex items-center gap-1">
                  <Clock size={11} />
                  Aviso diario a las {formatHora12h(horaEntrega || DEFAULT_DELIVERY_TIME)}
                </span>
              )}
            </div>
          </div>

          {/* Fotos de referencia */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-white">
            <OrderPhotoUploader
              fotos={fotos}
              onChange={setFotos}
              max={5}
              label="Fotos de referencia (opcional)"
              hint="Adjunta, arrastra o pega (Ctrl + V) imágenes de lo que el cliente busca."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="px-5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{saving ? "Guardando..." : "Guardar Pedido"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
