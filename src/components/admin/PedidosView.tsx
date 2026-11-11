"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  AlertTriangle,
  Bell,
  BellRing,
  Truck,
  DollarSign,
  Phone,
  Flame,
  CreditCard,
  Settings2,
} from "lucide-react";
import GestionarPedidoModal, { PedidoGestion } from "./GestionarPedidoModal";

// Sonido sintetizado de campana armónica de dos tonos con Web Audio API (cero dependencias externas)
function reproducirCampanaSonido() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Campana 1 (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Campana 2 (880 Hz - A5, armónico superior)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch {
    // Si el navegador bloquea audio antes de interacción
  }
}

// Disparador universal de notificaciones para Android Chrome, WebView, PWA y Desktop
async function mostrarNotificacionSistema(titulo: string, opciones?: NotificationOptions) {
  reproducirCampanaSonido();

  // 1. Service Worker showNotification (OBLIGATORIO en Android Chrome donde new Notification() arroja error)
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration("/sw-admin.js");
      if (!reg) {
        reg = await navigator.serviceWorker.ready;
      }
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...opciones,
        });
        return;
      }
    } catch (swErr) {
      console.warn("ServiceWorker showNotification no disponible, reintentando fallback:", swErr);
    }
  }

  // 2. Fallback estándar para navegadores Desktop
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(titulo, {
        icon: "/favicon.ico",
        ...opciones,
      });
    } catch (notifErr) {
      console.warn("new Notification constructor falló:", notifErr);
    }
  }
}

export const ESTADO_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pendiente: {
    label: "Pendiente",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  confirmado: {
    label: "Confirmado",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  en_produccion: {
    label: "En confección",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    dotClass: "bg-purple-500",
  },
  listo: {
    label: "Listo p/ entrega",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
    dotClass: "bg-teal-500",
  },
  enviado: {
    label: "En camino",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dotClass: "bg-indigo-500",
  },
  entregado: {
    label: "Entregado",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass: "bg-gray-400",
  },
};

export interface UrgenciaEntrega {
  tipo: "atrasado" | "hoy" | "manana" | "proximo" | "futuro" | "completado" | "sin_fecha";
  label: string;
  badgeClass: string;
  diffDias: number | null;
  esUrgente: boolean;
}

export function calcularUrgenciaEntrega(fechaStr?: string | null, estado?: string | null): UrgenciaEntrega {
  const est = (estado || "").toLowerCase().trim();
  if (est === "entregado" || est === "cancelado") {
    return {
      tipo: "completado",
      label: est === "entregado" ? "Entregado" : "Cancelado",
      badgeClass: "bg-gray-100 text-gray-500 border-gray-200",
      diffDias: null,
      esUrgente: false,
    };
  }

  if (!fechaStr) {
    return {
      tipo: "sin_fecha",
      label: "Inmediata",
      badgeClass: "bg-gray-100 text-gray-400 border-gray-200 italic",
      diffDias: null,
      esUrgente: false,
    };
  }

  // Extraer año, mes, día (ignora horas/zonas para comparar día calendario peruano)
  const dateOnly = fechaStr.split("T")[0].trim();
  const parts = dateOnly.split("-");
  if (parts.length !== 3) {
    return {
      tipo: "sin_fecha",
      label: fechaStr,
      badgeClass: "bg-gray-100 text-gray-500 border-gray-200",
      diffDias: null,
      esUrgente: false,
    };
  }

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const targetDate = new Date(y, m, d);
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDias = Math.round((targetDate.getTime() - todayZero.getTime()) / msPerDay);

  if (diffDias < 0) {
    const dias = Math.abs(diffDias);
    return {
      tipo: "atrasado",
      label: `¡Atrasado (${dias}d)!`,
      badgeClass: "bg-rose-600 text-white border-rose-700 animate-pulse font-bold shadow-xs",
      diffDias,
      esUrgente: true,
    };
  }

  if (diffDias === 0) {
    return {
      tipo: "hoy",
      label: "¡ENTREGA HOY!",
      badgeClass: "bg-[#C04267] text-white border-pink-700 font-extrabold shadow-xs",
      diffDias: 0,
      esUrgente: true,
    };
  }

  if (diffDias === 1) {
    return {
      tipo: "manana",
      label: "Entrega Mañana",
      badgeClass: "bg-amber-500 text-white border-amber-600 font-bold shadow-xs",
      diffDias: 1,
      esUrgente: true,
    };
  }

  if (diffDias === 2) {
    return {
      tipo: "proximo",
      label: "En 2 días",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
      diffDias: 2,
      esUrgente: true,
    };
  }

  if (diffDias <= 5) {
    return {
      tipo: "proximo",
      label: `En ${diffDias} días`,
      badgeClass: "bg-blue-50 text-blue-800 border-blue-200 font-semibold",
      diffDias,
      esUrgente: false,
    };
  }

  return {
    tipo: "futuro",
    label: `En ${diffDias} días`,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 font-medium",
    diffDias,
    esUrgente: false,
  };
}

interface PedidoItem {
  id?: string;
  nombre?: string;
  cantidad?: number;
  precio?: number;
}

interface Pedido {
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
  items?: unknown;
}

interface PedidosViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onCambiarEstado: (id: string | number, nuevoEstado: string) => void;
  onOpenAgendarModal: () => void;
  onActualizarPedido?: (id: string | number, updates: Record<string, unknown>) => void;
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

function parseRowData(row: Pedido) {
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
  onActualizarPedido,
}: PedidosViewProps) {
  const [search, setSearch] = useState("");
  const [filterCanal, setFilterCanal] = useState<string>("todos");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [selectedPedidoGestion, setSelectedPedidoGestion] = useState<PedidoGestion | null>(null);
  const [isGestionModalOpen, setIsGestionModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  const handleOpenGestionModal = useCallback((pedido: Pedido) => {
    setSelectedPedidoGestion(pedido as PedidoGestion);
    setIsGestionModalOpen(true);
  }, []);

  // Métricas de urgencia de entregas
  const metricasEntrega = useMemo(() => {
    let hoyCount = 0;
    let mananaCount = 0;
    let atrasadosCount = 0;
    let proximos48hCount = 0;
    let totalConFecha = 0;

    pedidos.forEach((p) => {
      const { fechaEntrega } = parseRowData(p);
      if (fechaEntrega) totalConFecha++;
      const urg = calcularUrgenciaEntrega(fechaEntrega, p.estado);
      if (urg.tipo === "hoy") hoyCount++;
      if (urg.tipo === "manana") mananaCount++;
      if (urg.tipo === "atrasado") atrasadosCount++;
      if (urg.esUrgente) proximos48hCount++;
    });

    return {
      hoyCount,
      mananaCount,
      atrasadosCount,
      proximos48hCount,
      totalConFecha,
      tieneAlertas: hoyCount > 0 || atrasadosCount > 0 || mananaCount > 0,
    };
  }, [pedidos]);

  // Alerta sonora o notificación en el navegador al detectar pedidos para hoy
  useEffect(() => {
    if (notifPermission !== "granted") return;
    if (metricasEntrega.hoyCount === 0 && metricasEntrega.atrasadosCount === 0) return;
    if (typeof window === "undefined") return;

    const todayStr = new Date().toISOString().split("T")[0];
    const sessionKey = `entrehilos_alerta_mostrada_${todayStr}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "true");
      const bodyMsg =
        metricasEntrega.atrasadosCount > 0
          ? `¡Atención! Tienes ${metricasEntrega.atrasadosCount} pedido(s) atrasados y ${metricasEntrega.hoyCount} para entregar hoy.`
          : `Tienes ${metricasEntrega.hoyCount} entrega(s) programadas para hoy.`;
      
      mostrarNotificacionSistema("Entre Hilos - Agenda de Entregas", {
        body: bodyMsg,
        tag: `entrehilos-alerta-${todayStr}`,
      });
    }
  }, [notifPermission, metricasEntrega.hoyCount, metricasEntrega.atrasadosCount]);

  const handleActivarNotificaciones = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Tu dispositivo o navegador actual no soporta notificaciones locales.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        const bodyMsg =
          metricasEntrega.hoyCount > 0 || metricasEntrega.atrasadosCount > 0
            ? `Tienes ${metricasEntrega.hoyCount} entrega(s) para hoy y ${metricasEntrega.atrasadosCount} vencidas.`
            : "Notificaciones activadas. Te avisaremos con sonido y alerta cuando se acerque una fecha de entrega.";

        await mostrarNotificacionSistema("Entre Hilos", {
          body: bodyMsg,
          tag: "entrehilos-bienvenida",
        });
      } else if (perm === "denied") {
        alert(
          "Las notificaciones están bloqueadas en tu navegador. Puedes activarlas haciendo clic en el icono del candado al lado de la barra de direcciones."
        );
      }
    } catch (e) {
      console.error("Error solicitando permiso:", e);
    }
  };

  const handleProbarNotificacion = async () => {
    await mostrarNotificacionSistema("Entre Hilos - Alerta de Prueba", {
      body: "Las notificaciones estan funcionando correctamente en tu dispositivo.",
      tag: "entrehilos-test-" + Date.now(),
    });
  };


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
      const { origen, fechaEntrega, cleanNotas } = parseRowData(p);
      const urg = calcularUrgenciaEntrega(fechaEntrega, p.estado);

      if (filterCanal === "urgentes") {
        if (!urg.esUrgente) return false;
      } else if (filterCanal === "tienda" && origen !== "tienda" && origen !== "web") {
        return false;
      } else if (filterCanal === "whatsapp" && origen !== "whatsapp") {
        return false;
      } else if (filterCanal === "facebook" && origen !== "facebook") {
        return false;
      } else if (filterCanal === "instagram" && origen !== "instagram") {
        return false;
      } else if (filterCanal === "otros" && ["tienda", "web", "whatsapp", "facebook", "instagram"].includes(origen)) {
        return false;
      }

      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const matchNombre = p.cliente_nombre?.toLowerCase().includes(s);
      const matchTel = p.cliente_telefono?.includes(s);
      const matchId = String(p.id).includes(s);
      const matchNotas = cleanNotas.toLowerCase().includes(s);
      return matchNombre || matchTel || matchId || matchNotas;
    });
  }, [pedidos, filterCanal, search]);

  const generateWhatsAppLink = (row: Pedido) => {
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

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button
              type="button"
              onClick={handleActivarNotificaciones}
              className="px-3.5 py-2 bg-white border border-pink-200 hover:bg-pink-50 text-[#C04267] rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Recibe alertas de entregas urgentes en tu celular o PC"
            >
              <Bell size={15} className="text-[#EE6B8D]" />
              <span>Activar Avisos</span>
            </button>
          )}

          {notifPermission === "granted" && (
            <div className="flex items-center gap-1.5">
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-quicksand font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Avisos de celular activos</span>
              </div>
              <button
                type="button"
                onClick={handleProbarNotificacion}
                className="px-2.5 py-1.5 bg-pink-50 border border-pink-200 hover:bg-pink-100 text-[#C04267] rounded-xl font-quicksand font-bold text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                title="Probar sonido y notificación en este dispositivo ahora mismo"
              >
                <Bell size={13} />
                <span>Probar</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenAgendarModal}
            className="w-full sm:w-auto px-4 py-2 bg-[#EE6B8D] hover:bg-[#C04267] text-white rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Agendar Pedido</span>
          </button>
        </div>
      </div>

      {/* BANNER INTELIGENTE DE ENTREGAS DEL DÍA Y ATRASADAS */}
      {metricasEntrega.tieneAlertas && (
        <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border-2 border-rose-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#C04267] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <BellRing size={20} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-fredoka text-base sm:text-lg font-bold text-[#C04267]">
                    ¡Atención a las fechas de entrega!
                  </h3>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full">
                    Avisos del Sistema
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 font-quicksand text-xs sm:text-sm text-gray-700">
                  {metricasEntrega.atrasadosCount > 0 && (
                    <span className="font-bold text-rose-700 bg-rose-100/90 px-2.5 py-0.5 rounded-lg border border-rose-300 flex items-center gap-1">
                      <AlertTriangle size={12} className="text-rose-600" />
                      {metricasEntrega.atrasadosCount} vencido(s) sin entregar
                    </span>
                  )}
                  {metricasEntrega.hoyCount > 0 && (
                    <span className="font-extrabold text-[#C04267] bg-pink-100/90 px-2.5 py-0.5 rounded-lg border border-pink-300 flex items-center gap-1">
                      <Calendar size={12} className="text-[#EE6B8D]" />
                      {metricasEntrega.hoyCount} entrega(s) para HOY
                    </span>
                  )}
                  {metricasEntrega.mananaCount > 0 && (
                    <span className="font-bold text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-lg border border-amber-300 flex items-center gap-1">
                      <Clock size={12} className="text-amber-700" />
                      {metricasEntrega.mananaCount} entrega(s) mañana
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setFilterCanal(filterCanal === "urgentes" ? "todos" : "urgentes")}
                className={`px-3.5 py-2 rounded-xl font-quicksand text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  filterCanal === "urgentes"
                    ? "bg-rose-700 text-white hover:bg-rose-800"
                    : "bg-[#C04267] text-white hover:bg-[#A03352]"
                }`}
              >
                <Flame size={14} />
                <span>{filterCanal === "urgentes" ? "Ver todos los pedidos" : "Filtrar urgentes (48h)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros por Canal y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#FDE8EF] shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "todos", label: "Todos", count: counts.todos, isUrgent: false },
            ...(metricasEntrega.proximos48hCount > 0
              ? [{ id: "urgentes", label: "Próximos (48h)", count: metricasEntrega.proximos48hCount, isUrgent: true }]
              : []),
            { id: "tienda", label: "Tienda Web", count: counts.tienda, isUrgent: false },
            { id: "whatsapp", label: "WhatsApp", count: counts.whatsapp, isUrgent: false },
            { id: "facebook", label: "Facebook", count: counts.facebook, isUrgent: false },
            { id: "instagram", label: "Instagram", count: counts.instagram, isUrgent: false },
            { id: "otros", label: "Otros", count: counts.otros, isUrgent: false },
          ].map((tab) => {
            const isSelected = filterCanal === tab.id;
            const isTabUrgent = Boolean(tab.isUrgent);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCanal(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-quicksand text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isTabUrgent
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-[#EE6B8D] text-white shadow-xs"
                    : isTabUrgent
                    ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : isTabUrgent
                    ? "bg-rose-200 text-rose-800 font-extrabold"
                    : "bg-gray-200 text-gray-600"
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

      {/* Vista de Pedidos: Tarjetas en Móvil/Tablet y Tabla en Pantallas Grandes */}
      {filteredPedidos.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#FDE8EF] text-gray-400 font-quicksand text-xs">
          No se encontraron pedidos con los filtros aplicados.
        </div>
      ) : (
        <>
          {/* 1. VISTA DE TARJETAS PARA MÓVIL Y TABLET (Evita scroll horizontal y espacios muertos) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3.5">
            {filteredPedidos.map((row: Pedido) => {
              const { origen, fechaEntrega, horaEntrega, adelanto, saldoPendiente, cleanNotas } = parseRowData(row);
              const canalInfo = CANAL_CONFIG[origen] || CANAL_CONFIG.otro;
              const itemsList: PedidoItem[] = Array.isArray(row.items) ? row.items : [];
              const tieneAdelanto = adelanto > 0;
              const displayId = row.id ? (String(row.id).length > 8 ? `#${String(row.id).slice(0, 6)}` : `#${row.id}`) : "#S/N";
              const displayCliente = row.cliente_nombre || row.cliente_email || "Cliente web";
              const urgencia = calcularUrgenciaEntrega(fechaEntrega, row.estado);

              return (
                <div
                  key={row.id}
                  className="bg-white rounded-2xl border border-[#FDE8EF] p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
                >
                  {/* Fila Superior: ID, Canal, Estado y WhatsApp */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-fredoka text-sm font-bold text-gray-900">
                        {displayId}
                      </span>
                      <span className={`inline-block font-quicksand text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${canalInfo.badgeClass}`}>
                        {canalInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {row.cliente_telefono ? (
                        <a
                          href={generateWhatsAppLink(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg font-quicksand text-xs font-bold transition-colors"
                          title="Contactar por WhatsApp"
                        >
                          <ExternalLink size={12} />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Cliente y Entrega */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-quicksand text-xs font-bold text-gray-900">
                          {displayCliente}
                        </p>
                        {row.cliente_telefono && (
                          <a
                            href={`tel:${row.cliente_telefono}`}
                            className="font-quicksand text-[11px] text-gray-500 font-mono hover:text-[#EE6B8D] inline-block"
                          >
                            {row.cliente_telefono}
                          </a>
                        )}
                      </div>

                      {/* Fecha de Entrega y Urgencia */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {urgencia.tipo !== "completado" && urgencia.tipo !== "sin_fecha" && (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${urgencia.badgeClass}`}>
                            {urgencia.tipo === "atrasado" || urgencia.tipo === "hoy" ? (
                              <AlertTriangle size={10} className="shrink-0" />
                            ) : (
                              <Clock size={10} className="shrink-0" />
                            )}
                            <span>{urgencia.label}</span>
                          </span>
                        )}
                        {fechaEntrega ? (
                          <div className="flex items-center justify-end gap-1 text-xs font-quicksand text-gray-800 font-bold">
                            <Calendar size={12} className="text-[#EE6B8D]" />
                            <span>
                              {new Date(fechaEntrega).toLocaleDateString("es-PE", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="font-quicksand text-[11px] text-gray-400 italic">Inmediata</span>
                        )}
                        {horaEntrega && (
                          <p className="font-quicksand text-[10px] text-gray-500">{horaEntrega}</p>
                        )}
                      </div>
                    </div>

                    {row.direccion_envio && (
                      <p className="font-quicksand text-[11px] text-gray-500 bg-gray-50 p-1.5 rounded-lg border border-gray-100/70">
                        {row.direccion_envio}
                      </p>
                    )}
                  </div>

                  {/* Resumen de Productos (solo si hay items o notas) */}
                  {(itemsList.length > 0 || cleanNotas) && (
                    <div className="space-y-1 bg-[#FDF4F7]/40 p-2.5 rounded-xl border border-pink-100/50">
                      {itemsList.length > 0 && (
                        <div className="space-y-1">
                          {itemsList.map((it: PedidoItem, i: number) => (
                            <div key={i} className="font-quicksand text-xs text-gray-700 flex items-center justify-between gap-2">
                              <span className="truncate">
                                {it.cantidad}x {it.nombre}
                              </span>
                              <span className="font-bold text-gray-600 text-[11px] shrink-0">
                                S/ {(Number(it.precio || 0) * (it.cantidad || 1)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {cleanNotas && (
                        <p className="font-quicksand text-[10px] text-gray-500 italic pt-1 border-t border-pink-100/40">
                          Nota: {cleanNotas}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pie de Tarjeta: Totales, Estado y Acciones Rápidas */}
                  <div className="pt-2 border-t border-gray-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-quicksand text-xs font-bold text-gray-900 block">
                          Total: S/ {Number(row.total || 0).toFixed(2)}
                        </span>
                        {tieneAdelanto && (
                          <span className="font-quicksand text-[10px] text-green-600 font-semibold block">
                            Adelanto: S/ {adelanto.toFixed(2)}
                          </span>
                        )}
                        {saldoPendiente > 0 ? (
                          <span className="font-quicksand text-[10px] text-rose-600 font-bold block">
                            Saldo: S/ {saldoPendiente.toFixed(2)}
                          </span>
                        ) : tieneAdelanto ? (
                          <span className="font-quicksand text-[10px] text-emerald-700 font-bold block">
                            Cancelado ✓
                          </span>
                        ) : null}
                      </div>

                      {/* Badge de Estado Actual */}
                      <div className="text-right">
                        {(() => {
                          const estInfo = ESTADO_CONFIG[row.estado || "pendiente"] || ESTADO_CONFIG.pendiente;
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-quicksand font-bold border ${estInfo.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${estInfo.dotClass}`} />
                              {estInfo.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Botón único de Acción / Gestión */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenGestionModal(row)}
                        className={`w-full py-2.5 px-3 rounded-xl font-quicksand font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer ${
                          saldoPendiente > 0
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            : row.estado === "entregado"
                            ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                            : "bg-[#EE6B8D] hover:bg-[#C04267] text-white shadow-xs"
                        }`}
                      >
                        {saldoPendiente > 0 ? (
                          <>
                            <DollarSign size={14} />
                            <span>Cobrar Saldo (S/ {saldoPendiente.toFixed(2)}) y Gestionar</span>
                          </>
                        ) : row.estado === "entregado" ? (
                          <span>Ver / Gestionar Pedido</span>
                        ) : (
                          <span>Completar Venta / Gestionar</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. TABLA COMPLETA PARA PANTALLAS GRANDES */}
          <div className="hidden lg:block bg-white rounded-2xl border border-[#FDE8EF] shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm min-w-full">
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
                {filteredPedidos.map((row: Pedido) => {
                  const { origen, fechaEntrega, horaEntrega, adelanto, saldoPendiente, cleanNotas } = parseRowData(row);
                  const canalInfo = CANAL_CONFIG[origen] || CANAL_CONFIG.otro;
                  const itemsList: PedidoItem[] = Array.isArray(row.items) ? row.items : [];
                  const tieneAdelanto = adelanto > 0;
                  const urgencia = calcularUrgenciaEntrega(fechaEntrega, row.estado);

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

                      {/* Fecha de Entrega y Urgencia */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="space-y-1">
                          {urgencia.tipo !== "completado" && urgencia.tipo !== "sin_fecha" && (
                            <div>
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${urgencia.badgeClass}`}>
                                {urgencia.tipo === "atrasado" || urgencia.tipo === "hoy" ? (
                                  <AlertTriangle size={10} className="shrink-0" />
                                ) : (
                                  <Clock size={10} className="shrink-0" />
                                )}
                                <span>{urgencia.label}</span>
                              </span>
                            </div>
                          )}
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
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-3 py-3">
                        <div className="space-y-1 max-w-[260px]">
                          {itemsList.map((it: PedidoItem, i: number) => (
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

                      {/* Estado y Gestión */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="space-y-1.5">
                          <div>
                            {(() => {
                              const estInfo = ESTADO_CONFIG[row.estado || "pendiente"] || ESTADO_CONFIG.pendiente;
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-quicksand font-bold border ${estInfo.badgeClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${estInfo.dotClass}`} />
                                  {estInfo.label}
                                </span>
                              );
                            })()}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenGestionModal(row)}
                              className={`px-3 py-1.5 rounded-lg font-quicksand font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                                saldoPendiente > 0
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                  : row.estado === "entregado"
                                  ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                                  : "bg-[#EE6B8D] hover:bg-[#C04267] text-white shadow-xs"
                              }`}
                              title="Gestionar estado, pagos y entrega"
                            >
                              {saldoPendiente > 0 ? (
                                <>
                                  <DollarSign size={13} />
                                  <span>Cobrar y Gestionar</span>
                                </>
                              ) : row.estado === "entregado" ? (
                                <span>Ver / Gestionar</span>
                              ) : (
                                <span>Completar Venta</span>
                              )}
                            </button>
                          </div>
                        </div>
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
        </>
      )}

      {/* Modal de Cobro, Métodos de Pago y Completar Venta */}
      <GestionarPedidoModal
        isOpen={isGestionModalOpen}
        onClose={() => {
          setIsGestionModalOpen(false);
          setSelectedPedidoGestion(null);
        }}
        pedido={selectedPedidoGestion}
        onSaveSuccess={(id, updatedFields) => {
          if (onActualizarPedido) {
            onActualizarPedido(id, updatedFields);
          } else if (updatedFields.estado && typeof updatedFields.estado === "string") {
            onCambiarEstado(id, updatedFields.estado);
          }
        }}
      />
    </div>
  );
}

