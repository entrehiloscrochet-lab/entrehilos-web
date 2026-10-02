"use client";

import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Truck,
  DollarSign,
  Phone,
} from "lucide-react";

interface PedidosViewProps {
  pedidos: any[];
  loading: boolean;
  onCambiarEstado: (id: string | number, nuevoEstado: string) => void;
  onOpenAgendarModal: () => void;
}

const CANAL_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  tienda: { label: "Tienda Web", badgeClass: "bg-pink-50 text-[#C04267] border-pink-200" },
  web: { label: "Tienda Web", badgeClass: "bg-pink-50 text-[#C04267] border-pink-200" },
  whatsapp: { label: "WhatsApp", badgeClass: "bg-green-50 text-green-700 border-green-200" },
  facebook: { label: "Facebook", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  instagram: { label: "Instagram", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
  tiktok: { label: "TikTok", badgeClass: "bg-slate-100 text-slate-800 border-slate-300" },
  telefono: { label: "Llamada", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  presencial: { label: "Presencial", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  otro: { label: "Otro", badgeClass: "bg-gray-100 text-gray-700 border-gray-200" },
};

function parseRowData(row: any) {
  let origen = (row.origen || "tienda").toLowerCase();
  let fechaEntrega = row.fecha_entrega || null;
  let horaEntrega = row.hora_entrega || null;
  let adelanto = row.adelanto !== undefined && row.adelanto !== null ? Number(row.adelanto) : 0;
  let saldoPendiente = row.saldo_pendiente !== undefined && row.saldo_pendiente !== null
    ? Number(row.saldo_pendiente)
    : Math.max(0, (Number(row.total) || 0) - adelanto);

  if (row.notas && typeof row.notas === "string") {
    const origMatch = row.notas.match(/\[Origen:\s*([^\]]+)\]/i);
    if (origMatch && (!row.origen || row.origen === "tienda")) {
      origen = origMatch[1].trim().toLowerCase();
    }
    const fechaMatch = row.notas.match(/\[Fecha Entrega:\s*([^\]]+)\]/i);
    if (fechaMatch && !row.fecha_entrega) {
      const parts = fechaMatch[1].trim().split(" ");
      fechaEntrega = parts[0];
      horaEntrega = parts.slice(1).join(" ");
    }
    const adelantoMatch = row.notas.match(/\[Adelanto:\s*S\/?(\d+(\.\d+)?)(\s*\|\s*Saldo:\s*S\/?(\d+(\.\d+)?))?\]/i);
    if (adelantoMatch) {
      adelanto = parseFloat(adelantoMatch[1]) || 0;
      if (adelantoMatch[4]) {
        saldoPendiente = parseFloat(adelantoMatch[4]) || 0;
      }
    }
  }

  const cleanNotas = (row.notas || "")
    .replace(/\[Origen:\s*[^\]]+\]/gi, "")
    .replace(/\[Fecha Entrega:\s*[^\]]+\]/gi, "")
    .replace(/\[Adelanto:[^\]]+\]/gi, "")
    .replace(/\|\s*\|/g, "|")
    .replace(/^\|\s*|\s*\|$/g, "")
    .trim();

  return { origen, fechaEntrega, horaEntrega, adelanto, saldoPendiente, cleanNotas };
}

export default function PedidosView({
  pedidos,
  loading,
  onCambiarEstado,
  onOpenAgendarModal,
}: PedidosViewProps) {
  const [search, setSearch] = useState("");
  const [filterCanal, setFilterCanal] = useState<string>("todos");

  // Conteos por canal
  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: pedidos.length, tienda: 0, whatsapp: 0, facebook: 0, instagram: 0, otros: 0 };
    pedidos.forEach((p) => {
      const { origen } = parseRowData(p);
      if (origen === "tienda" || origen === "web") {
        map.tienda = (map.tienda || 0) + 1;
      } else if (origen === "whatsapp") {
        map.whatsapp = (map.whatsapp || 0) + 1;
      } else if (origen === "facebook") {
        map.facebook = (map.facebook || 0) + 1;
      } else if (origen === "instagram") {
        map.instagram = (map.instagram || 0) + 1;
      } else {
        map.otros = (map.otros || 0) + 1;
      }
    });
    return map;
  }, [pedidos]);

  // Filtrado
  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      const { origen, cleanNotas } = parseRowData(p);
      if (filterCanal === "tienda" && origen !== "tienda" && origen !== "web") return false;
      if (filterCanal === "whatsapp" && origen !== "whatsapp") return false;
      if (filterCanal === "facebook" && origen !== "facebook") return false;
      if (filterCanal === "instagram" && origen !== "instagram") return false;
      if (filterCanal === "otros" && ["tienda", "web", "whatsapp", "facebook", "instagram"].includes(origen)) return false;

      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const matchNombre = p.cliente_nombre?.toLowerCase().includes(s);
      const matchTel = p.cliente_telefono?.includes(s);
      const matchId = String(p.id).includes(s);
      const matchNotas = cleanNotas.toLowerCase().includes(s);
      return matchNombre || matchTel || matchId || matchNotas;
    });
  }, [pedidos, filterCanal, search]);

  const generateWhatsAppLink = (row: any) => {
    const rawTel = (row.cliente_telefono || "").replace(/\D/g, "");
    if (!rawTel) return "#";
    const num = rawTel.startsWith("51") ? rawTel : `51${rawTel}`;
    const cliente = row.cliente_nombre || "Cliente";
    const { fechaEntrega, saldoPendiente } = parseRowData(row);
    const fecha = fechaEntrega
      ? new Date(fechaEntrega).toLocaleDateString("es-PE", { day: "numeric", month: "short" })
      : "";

    let msg = `Hola ${cliente}, te escribimos de Entre Hilos respecto a tu pedido #${row.id}`;
    if (fecha) msg += ` agendado para entrega el ${fecha}`;
    if (row.estado === "confirmado") msg += `. Tu pedido ya está confirmado y en agenda.`;
    else if (row.estado === "en_produccion") msg += `. Estamos confeccionando tu detalle tejido a mano.`;
    else if (row.estado === "listo") msg += `. Tu pedido ya está listo para la entrega.`;
    else if (row.estado === "entregado") msg += `. Confirmamos la entrega exitosa de tu pedido. ¡Gracias por elegir Entre Hilos!`;

    if (saldoPendiente > 0) {
      msg += ` Saldo pendiente: S/ ${saldoPendiente.toFixed(2)}.`;
    }

    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-fredoka text-xl font-bold text-[#C04267]">
            Pedidos y Entregas
          </h2>
          <p className="font-quicksand text-xs text-gray-500 mt-1">
            Gestiona los pedidos de la tienda online y agenda pedidos de WhatsApp o redes sociales
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenAgendarModal}
            className="w-full sm:w-auto px-4 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Agendar Pedido</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros por Canal y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "todos", label: "Todos", count: counts.todos },
            { id: "tienda", label: "Tienda Web", count: counts.tienda },
            { id: "whatsapp", label: "WhatsApp", count: counts.whatsapp },
            { id: "facebook", label: "Facebook", count: counts.facebook },
            { id: "instagram", label: "Instagram", count: counts.instagram },
            { id: "otros", label: "Otros", count: counts.otros },
          ].map((tab) => {
            const isSelected = filterCanal === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCanal(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-quicksand text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#EE6B8D] text-white shadow-xs"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente, teléfono o #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-gray-200 rounded-xl font-quicksand text-gray-800 bg-white focus:outline-none focus:border-[#EE6B8D]"
          />
        </div>
      </div>

      {/* Tabla de Pedidos */}
      {filteredPedidos.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#FDE8EF] text-gray-400 font-quicksand text-xs">
          No se encontraron pedidos con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-[#FDE8EF] bg-gray-50/50">
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">#</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Canal</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha de Entrega</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Detalle del Pedido</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Total / Pagos</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                <th className="px-3 py-3 font-quicksand text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map((row: any) => {
                const { origen, fechaEntrega, horaEntrega, adelanto, saldoPendiente, cleanNotas } = parseRowData(row);
                const canalInfo = CANAL_CONFIG[origen] || CANAL_CONFIG.otro;
                const itemsList: any[] = Array.isArray(row.items) ? row.items : [];
                const tieneAdelanto = adelanto > 0;

                return (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-[#FDF4F7]/40 transition-colors">
                    {/* ID */}
                    <td className="px-3 py-3 font-quicksand text-xs font-bold text-gray-800">
                      #{row.id}
                    </td>

                    {/* Canal */}
                    <td className="px-3 py-3">
                      <span className={`inline-block font-quicksand text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${canalInfo.badgeClass}`}>
                        {canalInfo.label}
                      </span>
                    </td>

                    {/* Cliente */}
                    <td className="px-3 py-3">
                      <p className="font-quicksand text-xs font-bold text-gray-900">{row.cliente_nombre}</p>
                      {row.cliente_telefono && (
                        <p className="font-quicksand text-[11px] text-gray-500 font-mono mt-0.5">{row.cliente_telefono}</p>
                      )}
                      {row.direccion_envio && (
                        <p className="font-quicksand text-[10px] text-gray-400 truncate max-w-[180px]" title={row.direccion_envio}>
                          {row.direccion_envio}
                        </p>
                      )}
                    </td>

                    {/* Fecha de Entrega */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {fechaEntrega ? (
                        <div className="flex items-center gap-1.5 text-xs font-quicksand text-gray-800 font-bold">
                          <Calendar size={13} className="text-[#EE6B8D]" />
                          <span>
                            {new Date(fechaEntrega).toLocaleDateString("es-PE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="font-quicksand text-[11px] text-gray-400 italic">Inmediata</span>
                      )}
                      {horaEntrega && (
                        <p className="font-quicksand text-[10px] text-gray-500 mt-0.5">{horaEntrega}</p>
                      )}
                    </td>

                    {/* Items */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 max-w-[260px]">
                        {itemsList.map((it: any, i: number) => (
                          <div key={i} className="font-quicksand text-xs text-gray-700 flex items-center justify-between gap-2">
                            <span className="truncate">
                              {it.cantidad}x {it.nombre}
                            </span>
                            <span className="font-semibold text-gray-500 text-[11px] shrink-0">
                              S/ {(Number(it.precio || 0) * (it.cantidad || 1)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {cleanNotas && (
                          <p className="font-quicksand text-[10px] text-gray-400 italic bg-gray-50 p-1.5 rounded-lg border border-gray-100 mt-1 max-w-[240px] truncate" title={cleanNotas}>
                            Nota: {cleanNotas}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Total y Pagos */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="font-quicksand text-xs font-bold text-gray-900">
                        S/ {Number(row.total || 0).toFixed(2)}
                      </p>
                      {tieneAdelanto && (
                        <p className="font-quicksand text-[10px] text-green-600 font-semibold mt-0.5">
                          Adelanto: S/ {adelanto.toFixed(2)}
                        </p>
                      )}
                      {saldoPendiente > 0 ? (
                        <p className="font-quicksand text-[10px] text-amber-600 font-bold mt-0.5">
                          Saldo: S/ {saldoPendiente.toFixed(2)}
                        </p>
                      ) : tieneAdelanto ? (
                        <p className="font-quicksand text-[10px] text-green-700 font-bold mt-0.5">
                          Completado
                        </p>
                      ) : null}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3">
                      <select
                        value={row.estado || "pendiente"}
                        onChange={(e) => onCambiarEstado(row.id, e.target.value)}
                        className="font-quicksand text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800 focus:outline-none focus:border-[#EE6B8D]"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="en_produccion">En preparación</option>
                        <option value="listo">Listo</option>
                        <option value="enviado">Enviado</option>
                        <option value="entregado">Entregado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </td>

                    {/* Contacto WhatsApp */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {row.cliente_telefono ? (
                        <a
                          href={generateWhatsAppLink(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl font-quicksand text-xs font-bold transition-colors"
                        >
                          <ExternalLink size={13} />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <span className="font-quicksand text-[11px] text-gray-400 italic">Sin tel.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
