"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Phone,
  User,
  ShoppingBag,
  DollarSign,
  FileText,
  Loader2,
  Check,
  Search,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface AgendarPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: any[];
  onSaveSuccess: () => void;
}

interface ItemPedido {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  esPersonalizado?: boolean;
}

const CANALES_ORIGEN = [
  { id: "whatsapp", label: "WhatsApp", color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
  { id: "facebook", label: "Facebook", color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  { id: "instagram", label: "Instagram", color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
  { id: "tiktok", label: "TikTok", color: "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200" },
  { id: "telefono", label: "Llamada", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { id: "presencial", label: "Presencial", color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" },
  { id: "otro", label: "Otro Canal", color: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200" },
];

export default function AgendarPedidoModal({
  isOpen,
  onClose,
  availableProducts,
  onSaveSuccess,
}: AgendarPedidoModalProps) {
  const [origen, setOrigen] = useState("whatsapp");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [direccionEnvio, setDireccionEnvio] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [metodoPago, setMetodoPago] = useState("yape");
  const [adelanto, setAdelanto] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [notas, setNotas] = useState("");

  const [items, setItems] = useState<ItemPedido[]>([]);

  // Selección de producto existente
  const [selectedProdId, setSelectedProdId] = useState("");
  const [prodCantidad, setProdCantidad] = useState(1);
  const [prodSearchFilter, setProdSearchFilter] = useState("");

  // Añadir ítem libre/personalizado
  const [customNombre, setCustomNombre] = useState("");
  const [customPrecio, setCustomPrecio] = useState("");
  const [customCantidad, setCustomCantidad] = useState(1);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtrado de productos disponibles
  const filteredAvailable = availableProducts.filter((p) =>
    !prodSearchFilter ||
    p.nombre?.toLowerCase().includes(prodSearchFilter.toLowerCase()) ||
    p.sku?.toLowerCase().includes(prodSearchFilter.toLowerCase())
  );

  const totalCalculado = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const adelantoNum = parseFloat(adelanto) || 0;
  const saldoPendiente = Math.max(0, totalCalculado - adelantoNum);

  const handleAddProduct = () => {
    if (!selectedProdId) return;
    const prod = availableProducts.find((p) => p.id === selectedProdId);
    if (!prod) return;

    setItems((prev) => {
      const existing = prev.find((it) => it.id === prod.id);
      if (existing) {
        return prev.map((it) =>
          it.id === prod.id ? { ...it, cantidad: it.cantidad + prodCantidad } : it
        );
      }
      return [
        ...prev,
        {
          id: prod.id,
          nombre: prod.nombre,
          precio: Number(prod.precio) || 0,
          cantidad: prodCantidad,
          imagen: prod.imagen,
        },
      ];
    });

    setSelectedProdId("");
    setProdCantidad(1);
  };

  const handleAddCustomItem = () => {
    if (!customNombre.trim()) return;
    const precioNum = parseFloat(customPrecio) || 0;
    if (precioNum <= 0) return;

    const newItem: ItemPedido = {
      id: `custom_${Date.now()}`,
      nombre: customNombre.trim(),
      precio: precioNum,
      cantidad: customCantidad,
      esPersonalizado: true,
    };

    setItems((prev) => [...prev, newItem]);
    setCustomNombre("");
    setCustomPrecio("");
    setCustomCantidad(1);
    setShowCustomForm(false);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNombre.trim()) {
      setErrorMsg("El nombre del cliente es obligatorio.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Agrega al menos un producto o detalle al pedido.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        action: "agendar-pedido",
        origen,
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: clienteTelefono.trim(),
        cliente_email: clienteEmail.trim() || null,
        direccion_envio: direccionEnvio.trim() || "Coordinar por WhatsApp",
        items,
        total: totalCalculado,
        adelanto: adelantoNum,
        saldo_pendiente: saldoPendiente,
        fecha_entrega: fechaEntrega || null,
        hora_entrega: horaEntrega.trim() || null,
        metodo_pago: metodoPago,
        estado,
        notas: notas.trim() || null,
      };

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "No se pudo agendar el pedido");
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error al agendar pedido:", err);
      setErrorMsg(err.message || "Error al procesar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-gradient-to-r from-pink-50/50 via-white to-pink-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 text-[#C04267] flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="font-fredoka text-lg font-bold text-gray-900">
                Agendar Nuevo Pedido
              </h3>
              <p className="font-quicksand text-xs text-gray-500">
                Registra pedidos recibidos por WhatsApp, Facebook, llamadas o de forma presencial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario scrollable */}
        <form onSubmit={handleSavePedido} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-quicksand">
              {errorMsg}
            </div>
          )}

          {/* 1. Canal de procedencia */}
          <div>
            <label className="block font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Canal de Origen
            </label>
            <div className="flex flex-wrap gap-2">
              {CANALES_ORIGEN.map((c) => {
                const isSelected = origen === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setOrigen(c.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-quicksand font-bold transition-all ${
                      isSelected
                        ? "border-[#EE6B8D] bg-[#FDF4F7] text-[#C04267] shadow-xs"
                        : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 2. Datos del cliente */}
          <div className="space-y-4">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Datos del Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. María Elena López"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="Ej. 987654321"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Dirección o Lugar de Entrega / Recojo
                </label>
                <input
                  type="text"
                  placeholder="Ej. Calle Los Molinos 456, Pisco (o Recojo en taller)"
                  value={direccionEnvio}
                  onChange={(e) => setDireccionEnvio(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 3. Fecha y Turno de Entrega */}
          <div className="space-y-4">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Fecha y Horario Agendado
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Fecha de Entrega Programada
                </label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Turno u Horario Estimado
                </label>
                <input
                  type="text"
                  placeholder="Ej. Mañana (10:00 am - 1:00 pm)"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 4. Productos del pedido */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
                Productos del Pedido *
              </h4>
              <button
                type="button"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="text-xs font-quicksand font-bold text-[#EE6B8D] hover:text-[#C04267] flex items-center gap-1"
              >
                <Plus size={14} />
                <span>{showCustomForm ? "Cancelar ítem libre" : "Añadir ítem libre / personalizado"}</span>
              </button>
            </div>

            {/* Añadir producto del catálogo */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <p className="font-quicksand text-xs font-bold text-gray-700">
                Seleccionar producto del catálogo:
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                >
                  <option value="">Selecciona un producto del catálogo...</option>
                  {filteredAvailable.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.nombre} — S/ {Number(p.precio).toFixed(2)}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="number"
                    min="1"
                    value={prodCantidad}
                    onChange={(e) => setProdCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-center bg-white"
                    title="Cantidad"
                  />
                  <button
                    type="button"
                    disabled={!selectedProdId}
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Formulario desplegable para ítem libre */}
            {showCustomForm && (
              <div className="p-3.5 bg-pink-50/50 rounded-xl border border-pink-200 space-y-3 animate-in fade-in duration-150">
                <p className="font-quicksand text-xs font-bold text-[#C04267]">
                  Añadir ítem libre o encargo especial:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Descripción del ítem (ej. Ramo 10 tulipanes personalizados)"
                    value={customNombre}
                    onChange={(e) => setCustomNombre(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Precio S/"
                      value={customPrecio}
                      onChange={(e) => setCustomPrecio(e.target.value)}
                      className="w-24 px-3 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                    />
                    <button
                      type="button"
                      disabled={!customNombre.trim() || !customPrecio}
                      onClick={handleAddCustomItem}
                      className="flex-1 px-3 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs transition-colors disabled:opacity-50"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de productos agregados */}
            {items.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-quicksand text-xs">
                No has agregado ningún producto todavía. Selecciona del catálogo o añade un ítem libre arriba.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      {it.imagen ? (
                        <img src={it.imagen} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-pink-50 text-[#C04267] flex items-center justify-center shrink-0 text-xs font-bold">
                          {it.esPersonalizado ? "Esp" : "Prod"}
                        </div>
                      )}
                      <div>
                        <p className="font-quicksand text-xs font-bold text-gray-800">{it.nombre}</p>
                        <p className="font-quicksand text-[11px] text-gray-500">
                          {it.cantidad} {it.cantidad === 1 ? "unidad" : "unidades"} x S/ {it.precio.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-quicksand text-xs font-bold text-gray-800">
                        S/ {(it.precio * it.cantidad).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* 5. Pago y Cobros */}
          <div className="space-y-4">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Información de Pago
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Total del Pedido
                </label>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-quicksand text-sm font-bold text-gray-900">
                  S/ {totalCalculado.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Adelanto / Seña (S/)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  value={adelanto}
                  onChange={(e) => setAdelanto(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                />
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Saldo Pendiente
                </label>
                <div className={`p-2.5 border rounded-xl font-quicksand text-sm font-bold ${
                  saldoPendiente > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700"
                }`}>
                  S/ {saldoPendiente.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                >
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="contra_entrega">Contra Entrega</option>
                </select>
              </div>

              <div>
                <label className="block font-quicksand text-xs font-bold text-gray-700 mb-1">
                  Estado Inicial del Pedido
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
                >
                  <option value="pendiente">Agendado (Pendiente)</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="en_produccion">En preparación (Tejiendo)</option>
                  <option value="listo">Listo para entrega</option>
                  <option value="entregado">Entregado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 6. Dedicatoria y notas */}
          <div className="space-y-2">
            <h4 className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
              Dedicatoria de Tarjeta o Notas Especiales
            </h4>
            <textarea
              rows={2}
              placeholder="Dedicatoria para tarjeta de regalo, colores específicos solicitados, indicaciones de entrega..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D] resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-quicksand font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSavePedido}
            className="px-5 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{saving ? "Guardando..." : "Guardar y Agendar Pedido"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
