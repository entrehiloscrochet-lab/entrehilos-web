"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useReviews } from "@/context/ReviewsContext";
import { useToast } from "@/components/Toast";
import RatingStars from "@/components/RatingStars";
import { getDepartamentos, getProvincias, getDistritos } from "@/lib/ubigeo";
import {
  UserCircle, Package, Bell, LogOut, Home,
  Clock, CheckCircle2, XCircle, Loader2, ChevronRight,
  Mail, Phone, Calendar, Ruler, MapPin, Star,
  Truck, CheckCheck, Sparkles, Save, ChevronDown, Check,
  ShoppingBag, ShieldCheck, MessageCircle, ExternalLink,
  HelpCircle, ArrowUpRight
} from "lucide-react";

interface ProfileData {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  referencia?: string | null;
  localidad?: string | null;
}

type Tab = "perfil" | "pedidos" | "notificaciones";

interface Pedido {
  id: number;
  created_at: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  direccion_envio?: string;
  items: any;
  total: number;
  estado: string;
}

interface PedidoPersonalizado {
  id: number;
  created_at: string;
  producto_nombre: string | null;
  detalles: string;
  tamano: string | null;
  extras: string | null;
  estado: string;
  fecha_entrega: string | null;
}

interface Notificacion {
  id: string | number;
  pedido_id?: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  created_at: string;
  leido?: boolean;
  es_personalizado?: boolean;
}

const menuItems: { id: Tab; label: string; icon: any }[] = [
  { id: "perfil", label: "Mi perfil", icon: UserCircle },
  { id: "pedidos", label: "Mis pedidos", icon: Package },
  { id: "notificaciones", label: "Notificaciones", icon: Bell },
];

const estados: Record<string, { label: string; color: string; icon: any }> = {
  pendiente: { label: "Pendiente", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock },
  confirmado: { label: "Confirmado", color: "text-blue-700 bg-blue-50 border-blue-200", icon: CheckCircle2 },
  enviado: { label: "En camino", color: "text-purple-700 bg-purple-50 border-purple-200", icon: Truck },
  entregado: { label: "Entregado", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-rose-700 bg-rose-50 border-rose-200", icon: XCircle },
  en_produccion: { label: "En producción", color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: Sparkles },
  listo: { label: "Listo para entrega", color: "text-teal-700 bg-teal-50 border-teal-200", icon: CheckCircle2 },
};

const PASOS_PEDIDO = [
  { clave: "pendiente", label: "Recibido", icon: Clock },
  { clave: "confirmado", label: "Confirmado", icon: CheckCircle2 },
  { clave: "enviado", label: "En camino", icon: Truck },
  { clave: "entregado", label: "Entregado", icon: Package },
];

function OrderStepper({ estado }: { estado: string }) {
  const est = (estado || "pendiente").toLowerCase();
  if (est === "cancelado") {
    return (
      <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-quicksand font-semibold border border-rose-100">
        <XCircle size={15} />
        Este pedido fue cancelado. Si tienes alguna duda, puedes escribir a nuestro canal de soporte.
      </div>
    );
  }

  const indexActual = est === "entregado" ? 3
    : est === "enviado" ? 2
    : est === "confirmado" ? 1
    : 0;

  return (
    <div className="w-full my-3 py-3 px-3 sm:px-6 bg-[#FAF8F6] rounded-xl border border-[#EFEAE6]">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-6 right-6 top-3.5 sm:top-4 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute left-6 top-3.5 sm:top-4 h-0.5 bg-[#EE6B8D] transition-all duration-500 z-0"
          style={{ width: `${(indexActual / (PASOS_PEDIDO.length - 1)) * 100}%` }}
        />

        {PASOS_PEDIDO.map((paso, idx) => {
          const completado = idx <= indexActual;
          const esActual = idx === indexActual;
          const IconPaso = paso.icon;

          return (
            <div key={paso.clave} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                  esActual
                    ? "bg-[#EE6B8D] text-white ring-4 ring-[#EE6B8D]/20 shadow-xs"
                    : completado
                    ? "bg-[#C04267] text-white"
                    : "bg-white border border-gray-300 text-gray-400"
                }`}
              >
                <IconPaso size={13} />
              </div>
              <span
                className={`mt-1 font-quicksand text-[11px] sm:text-xs text-center transition-colors ${
                  esActual
                    ? "font-bold text-[#C04267]"
                    : completado
                    ? "font-medium text-gray-700"
                    : "text-gray-400"
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

function CalificarProducto({ item, nombreCliente }: { item: any; nombreCliente: string }) {
  const { ratedByMe, submitRating, refresh } = useReviews();
  const { showToast } = useToast();
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const yaCalificado = ratedByMe[item?.id];

  const handleEnviar = async () => {
    if (!item?.id || !item?.nombre) return;
    if (estrellas === 0) {
      showToast("Selecciona la cantidad de estrellas", "warning");
      return;
    }
    setEnviando(true);
    const res = await submitRating({
      producto_id: item.id,
      producto_sku: undefined,
      producto_nombre: item.nombre,
      nombre_cliente: nombreCliente || "Cliente",
      calificacion: estrellas,
      comentario: comentario.trim() || undefined,
    });
    setEnviando(false);
    if (res.ok) {
      showToast("Gracias por tu calificación. Se publicará tras revisión.", "success");
      refresh();
    } else {
      showToast(res.error || "Error al enviar la calificación", "error");
    }
  };

  if (yaCalificado) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F2ECE6]">
        <RatingStars value={yaCalificado} size={15} />
        <p className="font-quicksand text-xs font-semibold text-[#C04267]">
          Ya calificaste este producto con {yaCalificado} estrella{yaCalificado !== 1 ? "s" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[#F2ECE6] pt-3">
      <p className="font-quicksand text-xs font-bold uppercase tracking-wider text-[#C04267] mb-2 flex items-center gap-1.5">
        <Star size={13} />
        Calificar producto recibido
      </p>
      <div className="flex items-center gap-3">
        <RatingStars value={estrellas} interactive size={22} onChange={setEstrellas} />
        {estrellas > 0 && (
          <span className="font-quicksand text-xs font-semibold text-gray-600">{estrellas}/5 estrellas</span>
        )}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comparte tu opinión sobre la confección y acabado (opcional)"
        rows={2}
        className="w-full mt-2 rounded-xl border border-[#E8DFD8] bg-white px-3.5 py-2 font-quicksand text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#EE6B8D] resize-none"
      />
      <button
        onClick={handleEnviar}
        disabled={enviando}
        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full font-quicksand text-xs font-semibold text-white bg-[#EE6B8D] hover:bg-[#C04267] transition-colors cursor-pointer"
      >
        {enviando ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
        Publicar calificación
      </button>
    </div>
  );
}

export default function PerfilPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("perfil");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [personalizados, setPersonalizados] = useState<PedidoPersonalizado[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [leidasIds, setLeidasIds] = useState<string[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filtros de subpestañas
  const [filtroPedidos, setFiltroPedidos] = useState<"todos" | "en_curso" | "entregados" | "cancelados">("todos");
  const [filtroNotif, setFiltroNotif] = useState<"todos" | "no_leidos" | "leidos">("todos");

  // Formulario de edición de perfil
  const [formNombre, setFormNombre] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formDepartamento, setFormDepartamento] = useState("");
  const [formProvincia, setFormProvincia] = useState("");
  const [formDistrito, setFormDistrito] = useState("");
  const [formDireccion, setFormDireccion] = useState("");
  const [formReferencia, setFormReferencia] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfilGuardadoExito, setPerfilGuardadoExito] = useState(false);

  const departamentos = useMemo(() => getDepartamentos(), []);
  const provincias = useMemo(() => getProvincias(formDepartamento), [formDepartamento]);
  const distritos = useMemo(() => getDistritos(formDepartamento, formProvincia), [formDepartamento, formProvincia]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // Cargar notificaciones leídas desde localStorage
  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(`entrehilos_notif_leidas_${user.id}`);
        if (stored) {
          setLeidasIds(JSON.parse(stored));
        }
      } catch (e) {}
    }
  }, [user?.id]);

  // Cargar perfil desde API y localStorage
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingProfile(true);
      try {
        const localKey = `entrehilos_perfil_envio_${user.id}`;
        const localStored = localStorage.getItem(localKey);
        if (localStored) {
          try {
            const parsed = JSON.parse(localStored);
            if (parsed) {
              setProfile(parsed);
              if (parsed.nombre) setFormNombre(parsed.nombre);
              if (parsed.telefono) setFormTelefono(parsed.telefono);
              if (parsed.departamento) setFormDepartamento(parsed.departamento);
              if (parsed.provincia) setFormProvincia(parsed.provincia);
              if (parsed.distrito) setFormDistrito(parsed.distrito);
              if (parsed.direccion) setFormDireccion(parsed.direccion);
              if (parsed.referencia) setFormReferencia(parsed.referencia);
            }
          } catch {}
        }

        const res = await fetch(`/api/perfil?userId=${user.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.profile) {
            setProfile(json.profile);
            if (json.profile.nombre) setFormNombre(json.profile.nombre);
            if (json.profile.telefono) setFormTelefono(json.profile.telefono);
            if (json.profile.departamento) setFormDepartamento(json.profile.departamento);
            if (json.profile.provincia) setFormProvincia(json.profile.provincia);
            if (json.profile.distrito) setFormDistrito(json.profile.distrito);
            if (json.profile.direccion) setFormDireccion(json.profile.direccion);
            if (json.profile.referencia) setFormReferencia(json.profile.referencia);
          }
        }
      } catch (e) {
        console.error("Error al cargar perfil:", e);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [user]);

  // Cargar pedidos y notificaciones
  const cargarDatos = async (mostrarCarga = false) => {
    if (!user) return;
    if (mostrarCarga) setLoadingPedidos(true);
    try {
      const { getUsuarioId } = await import("@/lib/anon-id");
      const anonId = getUsuarioId();
      const email = user.email || "";
      const userId = user.id || "";

      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (email) params.set("email", email);
      if (anonId) params.set("anonId", anonId);

      const res = await fetch(`/api/mis-pedidos?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPedidos(json.pedidos || []);
        setPersonalizados(json.personalizados || []);
        setNotificaciones(json.notificaciones || []);
      } else {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseBrowserClient();
        const [pedidosRes, personalizadosRes] = await Promise.all([
          supabase.from("pedidos").select("*").or(`usuario_id.eq.${userId},cliente_email.eq.${email}`).order("created_at", { ascending: false }),
          supabase.from("pedidos_personalizados").select("*").eq("email", email).order("created_at", { ascending: false }),
        ]);
        if (pedidosRes.data) setPedidos(pedidosRes.data);
        if (personalizadosRes.data) setPersonalizados(personalizadosRes.data);
      }
    } catch (e) {
      console.error("Error al cargar pedidos y notificaciones:", e);
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    if (user) {
      cargarDatos(pedidos.length === 0 && notificaciones.length === 0);
    }
  }, [user, tab]);

  // Guardar datos del perfil
  const guardarPerfil = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setGuardandoPerfil(true);
    setPerfilGuardadoExito(false);

    const payload: ProfileData = {
      nombre: formNombre.trim(),
      telefono: formTelefono.trim(),
      email: user.email || null,
      departamento: formDepartamento,
      provincia: formProvincia,
      distrito: formDistrito,
      direccion: formDireccion.trim(),
      referencia: formReferencia.trim(),
      localidad: [formDistrito, formProvincia, formDepartamento].filter(Boolean).join(", "),
    };

    // Guardar en localStorage para disponibilidad inmediata en checkout
    try {
      localStorage.setItem(`entrehilos_perfil_envio_${user.id}`, JSON.stringify({ id: user.id, ...payload }));
    } catch (err) {}

    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...payload }),
      });

      if (!res.ok) {
        showToast("No pudimos guardar en el servidor. Tus datos quedaron solo en este dispositivo.", "error");
        return;
      }

      const json = await res.json().catch(() => null);
      setProfile({ ...payload, ...(json?.profile || {}) });
      setPerfilGuardadoExito(true);
      setTimeout(() => setPerfilGuardadoExito(false), 3500);

      if (json?.partial && Array.isArray(json.campos_no_guardados) && json.campos_no_guardados.length > 0) {
        showToast(
          `Tu nombre y teléfono se guardaron, pero la dirección no: falta aplicar la migración de envío (${json.campos_no_guardados.join(", ")}).`,
          "warning"
        );
      } else {
        showToast("Tus datos de entrega fueron guardados con éxito", "success");
      }
    } catch (err) {
      showToast("No pudimos guardar en el servidor. Tus datos quedaron solo en este dispositivo.", "error");
    } finally {
      setGuardandoPerfil(false);
    }
  };

  // Notificaciones
  const noLeidasCount = notificaciones.filter(
    (n) => !n.leido && !leidasIds.includes(String(n.id))
  ).length;

  const marcarLeida = async (id: string) => {
    if (!leidasIds.includes(id)) {
      const updated = [...leidasIds, id];
      setLeidasIds(updated);
      if (user?.id) {
        try {
          localStorage.setItem(`entrehilos_notif_leidas_${user.id}`, JSON.stringify(updated));
        } catch (e) {}
      }
      const numId = Number(id);
      if (!Number.isNaN(numId) && numId > 0) {
        try {
          const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
          const supabase = getSupabaseBrowserClient();
          await supabase.from("notificaciones").update({ leido: true }).eq("id", numId);
        } catch (e) {}
      }
    }
  };

  const marcarTodasComoLeidas = async () => {
    const allIds = notificaciones.map((n) => String(n.id));
    setLeidasIds(allIds);
    if (user?.id) {
      try {
        localStorage.setItem(`entrehilos_notif_leidas_${user.id}`, JSON.stringify(allIds));
      } catch (e) {}
      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseBrowserClient();
        await supabase
          .from("notificaciones")
          .update({ leido: true })
          .or(`usuario_id.eq.${user.id},email.eq.${user.email}`);
      } catch (e) {}
    }
    showToast("Todas las notificaciones han sido marcadas como leídas", "success");
  };

  // Filtrado de notificaciones
  const notificacionesNoLeidas = useMemo(() => {
    return notificaciones.filter((n) => !n.leido && !leidasIds.includes(String(n.id)));
  }, [notificaciones, leidasIds]);

  const notificacionesLeidas = useMemo(() => {
    return notificaciones.filter((n) => n.leido || leidasIds.includes(String(n.id)));
  }, [notificaciones, leidasIds]);

  const notificacionesFiltradas = useMemo(() => {
    if (filtroNotif === "no_leidos") return notificacionesNoLeidas;
    if (filtroNotif === "leidos") return notificacionesLeidas;
    return notificaciones;
  }, [filtroNotif, notificaciones, notificacionesNoLeidas, notificacionesLeidas]);

  // Filtrado de pedidos
  const pedidosEnCurso = useMemo(() => {
    return pedidos.filter((p) =>
      ["pendiente", "confirmado", "enviado"].includes((p.estado || "pendiente").toLowerCase())
    );
  }, [pedidos]);

  const pedidosEntregados = useMemo(() => {
    return pedidos.filter((p) => (p.estado || "").toLowerCase() === "entregado");
  }, [pedidos]);

  const pedidosCancelados = useMemo(() => {
    return pedidos.filter((p) => (p.estado || "").toLowerCase() === "cancelado");
  }, [pedidos]);

  const persEnCurso = useMemo(() => {
    return personalizados.filter((p) =>
      ["pendiente", "confirmado", "en_produccion", "listo"].includes((p.estado || "pendiente").toLowerCase())
    );
  }, [personalizados]);

  const persEntregados = useMemo(() => {
    return personalizados.filter((p) => (p.estado || "").toLowerCase() === "entregado");
  }, [personalizados]);

  const persCancelados = useMemo(() => {
    return personalizados.filter((p) => (p.estado || "").toLowerCase() === "cancelado");
  }, [personalizados]);

  const pedidosAMostrar = useMemo(() => {
    if (filtroPedidos === "en_curso") return pedidosEnCurso;
    if (filtroPedidos === "entregados") return pedidosEntregados;
    if (filtroPedidos === "cancelados") return pedidosCancelados;
    return pedidos;
  }, [filtroPedidos, pedidos, pedidosEnCurso, pedidosEntregados, pedidosCancelados]);

  const persAMostrar = useMemo(() => {
    if (filtroPedidos === "en_curso") return persEnCurso;
    if (filtroPedidos === "entregados") return persEntregados;
    if (filtroPedidos === "cancelados") return persCancelados;
    return personalizados;
  }, [filtroPedidos, personalizados, persEnCurso, persEntregados, persCancelados]);

  const totalPedidosEnCurso = pedidosEnCurso.length + persEnCurso.length;
  const totalPedidosEntregados = pedidosEntregados.length + persEntregados.length;
  const totalPedidosCancelados = pedidosCancelados.length + persCancelados.length;
  const totalTodosPedidos = pedidos.length + personalizados.length;
  const totalInvertido = pedidos.reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F6]">
        <Loader2 size={32} className="animate-spin text-[#EE6B8D]" />
      </div>
    );
  }

  if (!user) return null;

  const nombreUsuario = formNombre || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Información del usuario */}
      <div className="p-6 border-b border-[#EFEAE6]">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nombreUsuario}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#EE6B8D]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#C04267] flex items-center justify-center text-white font-fredoka font-bold text-lg">
              {nombreUsuario.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-fredoka text-sm font-bold text-gray-800 truncate">{nombreUsuario}</p>
            <p className="font-quicksand text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Navegación lateral */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-quicksand text-sm font-semibold transition-all text-left cursor-pointer ${
                active
                  ? "bg-[#FDF2F4] text-[#C04267] shadow-xs"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={19} strokeWidth={active ? 2.5 : 1.75} />
                {item.label}
              </div>
              {item.id === "notificaciones" && noLeidasCount > 0 && (
                <span className="bg-[#EE6B8D] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {noLeidasCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Acciones inferiores */}
      <div className="p-3 border-t border-[#EFEAE6] space-y-1">
        <Link
          href="/"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-quicksand text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
        >
          <Home size={19} strokeWidth={1.75} />
          Ir a tienda
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-quicksand text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
        >
          <LogOut size={19} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F6] flex">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Barra lateral */}
      <aside
        className={`fixed sm:sticky top-0 left-0 z-50 h-screen w-72 bg-white shadow-sm border-r border-[#EFEAE6] transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Botón hamburguesa móvil */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 sm:hidden w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center relative cursor-pointer"
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
        {noLeidasCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#EE6B8D] rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
            {noLeidasCount > 9 ? "!" : noLeidasCount}
          </span>
        )}
      </button>

      {/* Contenido principal con Layout de 2 Columnas para aprovechar el ancho */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 pt-20 sm:pt-8 w-full max-w-[1400px] mx-auto">
        <div className="w-full">
          {/* TAB 1: MI PERFIL */}
          {tab === "perfil" && (
            <div className="space-y-6 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#EFEAE6]">
                <div>
                  <h2 className="font-fredoka text-2xl sm:text-3xl font-bold text-[#C04267]">Mi perfil</h2>
                  <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
                    Administra tus datos personales y tu dirección habitual de entrega para futuras compras.
                  </p>
                </div>
                {perfilGuardadoExito && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-quicksand text-xs font-semibold">
                    <Check size={14} /> Datos guardados correctamente
                  </span>
                )}
              </div>

              {loadingProfile ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
                  {/* Columna Principal: Formularios */}
                  <form onSubmit={guardarPerfil} className="lg:col-span-8 space-y-6">
                    {/* Tarjeta 1: Datos Personales */}
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-5">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4EFEB]">
                        <div className="w-8 h-8 rounded-lg bg-[#FDF2F4] text-[#C04267] flex items-center justify-center">
                          <UserCircle size={18} />
                        </div>
                        <div>
                          <h3 className="font-fredoka text-base font-bold text-gray-800">
                            Datos personales
                          </h3>
                          <p className="font-quicksand text-xs text-gray-400">
                            Información de contacto asociada a tu cuenta.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Nombre completo
                          </label>
                          <input
                            type="text"
                            value={formNombre}
                            onChange={(e) => setFormNombre(e.target.value)}
                            placeholder="Ej: María Pérez"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent transition-all"
                          />
                        </div>

                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Correo electrónico
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              value={user.email || ""}
                              disabled
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 font-quicksand text-sm text-gray-500 outline-none cursor-not-allowed"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check size={10} /> Verificado
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Teléfono de contacto / WhatsApp
                          </label>
                          <input
                            type="tel"
                            value={formTelefono}
                            onChange={(e) => setFormTelefono(e.target.value)}
                            placeholder="Ej: 999888777"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent transition-all"
                          />
                          <p className="font-quicksand text-[11px] text-gray-400 mt-1">
                            Utilizaremos este número para coordinar la entrega de tus pedidos.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 2: Dirección y Localidad de Entrega */}
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-5">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4EFEB]">
                        <div className="w-8 h-8 rounded-lg bg-[#FDF2F4] text-[#C04267] flex items-center justify-center">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <h3 className="font-fredoka text-base font-bold text-gray-800">
                            Dirección y localidad habitual de entrega
                          </h3>
                          <p className="font-quicksand text-xs text-gray-400">
                            Se sugerirá automáticamente durante el proceso de compra.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Departamento */}
                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Departamento
                          </label>
                          <div className="relative">
                            <select
                              value={formDepartamento}
                              onChange={(e) => {
                                setFormDepartamento(e.target.value);
                                setFormProvincia("");
                                setFormDistrito("");
                              }}
                              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent pr-9 cursor-pointer"
                            >
                              <option value="">Seleccionar departamento</option>
                              {departamentos.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Provincia */}
                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Provincia
                          </label>
                          <div className="relative">
                            <select
                              value={formProvincia}
                              onChange={(e) => {
                                setFormProvincia(e.target.value);
                                setFormDistrito("");
                              }}
                              disabled={!formDepartamento}
                              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent pr-9 disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
                            >
                              <option value="">Seleccionar provincia</option>
                              {provincias.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Distrito */}
                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Distrito / Localidad
                          </label>
                          <div className="relative">
                            <select
                              value={formDistrito}
                              onChange={(e) => setFormDistrito(e.target.value)}
                              disabled={!formProvincia}
                              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent pr-9 disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
                            >
                              <option value="">Seleccionar distrito</option>
                              {distritos.map((dist) => (
                                <option key={dist} value={dist}>{dist}</option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Dirección exacta (calle, avenida, número)
                          </label>
                          <input
                            type="text"
                            value={formDireccion}
                            onChange={(e) => setFormDireccion(e.target.value)}
                            placeholder="Ej: Av. Las Flores 123, Dpto 402"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent transition-all"
                          />
                        </div>

                        <div>
                          <label className="block font-quicksand text-xs font-semibold text-gray-700 mb-1.5">
                            Referencia de llegada (opcional)
                          </label>
                          <input
                            type="text"
                            value={formReferencia}
                            onChange={(e) => setFormReferencia(e.target.value)}
                            placeholder="Ej: Frente al parque, rejas blancas"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-quicksand text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#EE6B8D] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={guardandoPerfil}
                          className="flex items-center gap-2 px-6 py-3 rounded-full font-quicksand text-sm font-semibold text-white bg-[#C04267] hover:bg-[#A33454] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          {guardandoPerfil ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Guardando datos...
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              Guardar datos de entrega
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Columna Lateral: Resumen de Cuenta y Soporte */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Widget 1: Resumen de Cuenta */}
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={nombreUsuario}
                            className="w-14 h-14 rounded-full object-cover border-2 border-[#EE6B8D]"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-[#C04267] text-white flex items-center justify-center font-fredoka text-xl font-bold">
                            {nombreUsuario.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-fredoka text-base font-bold text-gray-800 truncate">{nombreUsuario}</p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                            <ShieldCheck size={12} /> Cliente verificado
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#F4EFEB]">
                        <div className="p-3 bg-[#FAF8F6] rounded-xl text-center">
                          <p className="font-fredoka text-lg font-bold text-gray-800">{totalTodosPedidos}</p>
                          <p className="font-quicksand text-[11px] text-gray-500">Pedidos totales</p>
                        </div>
                        <div className="p-3 bg-[#FAF8F6] rounded-xl text-center">
                          <p className="font-fredoka text-lg font-bold text-[#C04267]">{totalPedidosEnCurso}</p>
                          <p className="font-quicksand text-[11px] text-gray-500">En proceso</p>
                        </div>
                      </div>
                    </div>

                    {/* Widget 2: Beneficios de Entrega */}
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-gray-800">
                        <Truck size={18} className="text-[#C04267]" />
                        <h4 className="font-fredoka text-sm font-bold">Envíos y Embalaje Seguro</h4>
                      </div>
                      <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                        Todos los ramos tejidos y amigurumis se envían en cajas rígidas con protección especial para preservar la forma exacta del hilado.
                      </p>
                    </div>

                    {/* Widget 3: Canal de Ayuda Directa */}
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-gray-800">
                        <MessageCircle size={18} className="text-[#C04267]" />
                        <h4 className="font-fredoka text-sm font-bold">Atención al Cliente</h4>
                      </div>
                      <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                        ¿Tienes dudas con un pedido o requieres una personalización especial? Nuestro taller atiende de lunes a sábado de 9:00 a 19:00 hrs.
                      </p>
                      <a
                        href="https://wa.me/51902578295"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl font-quicksand text-xs font-semibold text-[#C04267] bg-[#FDF2F4] hover:bg-[#FBE4E9] transition-colors"
                      >
                        Consultar por WhatsApp
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MIS PEDIDOS */}
          {tab === "pedidos" && (
            <div className="space-y-6 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#EFEAE6]">
                <div>
                  <h2 className="font-fredoka text-2xl sm:text-3xl font-bold text-[#C04267]">Mis pedidos</h2>
                  <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
                    Sigue en tiempo real el avance de confección y despacho de tus compras.
                  </p>
                </div>
              </div>

              {/* Filtros de estado */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFiltroPedidos("todos")}
                  className={`px-4 py-2 rounded-full font-quicksand text-xs font-semibold transition-all cursor-pointer ${
                    filtroPedidos === "todos"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  Todos ({totalTodosPedidos})
                </button>
                <button
                  onClick={() => setFiltroPedidos("en_curso")}
                  className={`px-4 py-2 rounded-full font-quicksand text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filtroPedidos === "en_curso"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  <Clock size={13} />
                  En proceso ({totalPedidosEnCurso})
                </button>
                <button
                  onClick={() => setFiltroPedidos("entregados")}
                  className={`px-4 py-2 rounded-full font-quicksand text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filtroPedidos === "entregados"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  <CheckCircle2 size={13} />
                  Ya entregados ({totalPedidosEntregados})
                </button>
                {totalPedidosCancelados > 0 && (
                  <button
                    onClick={() => setFiltroPedidos("cancelados")}
                    className={`px-4 py-2 rounded-full font-quicksand text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      filtroPedidos === "cancelados"
                        ? "bg-[#C04267] text-white shadow-xs"
                        : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                    }`}
                  >
                    <XCircle size={13} />
                    Cancelados ({totalPedidosCancelados})
                  </button>
                )}
              </div>

              {loadingPedidos ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
                  {/* Columna Principal: Lista de Pedidos */}
                  <div className="lg:col-span-8 space-y-4">
                    {pedidosAMostrar.length === 0 && persAMostrar.length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-2xl border border-[#EFEAE6] p-8">
                        <ShoppingBag size={44} className="mx-auto text-gray-300 mb-3" />
                        <p className="font-quicksand text-sm text-gray-700 font-semibold">
                          {filtroPedidos === "en_curso"
                            ? "No tienes pedidos en proceso actualmente"
                            : filtroPedidos === "entregados"
                            ? "No tienes pedidos entregados en tu historial"
                            : filtroPedidos === "cancelados"
                            ? "No tienes pedidos cancelados"
                            : "No tienes compras registradas aún"}
                        </p>
                        <p className="font-quicksand text-xs text-gray-400 mt-1 mb-5">
                          Explora nuestras colecciones para elegir tu siguiente detalle hecho a mano.
                        </p>
                        <Link
                          href="/"
                          className="inline-block font-quicksand text-xs font-semibold text-white bg-[#C04267] hover:bg-[#A33454] px-5 py-2.5 rounded-full transition-all"
                        >
                          Ver catálogo
                        </Link>
                      </div>
                    ) : (
                      <>
                        {/* Pedidos Estándar */}
                        {pedidosAMostrar.map((p) => {
                          const estadoConfig = estados[p.estado] || estados.pendiente;
                          const EstadoIcon = estadoConfig.icon || Clock;
                          const estaEntregado = (p.estado || "").toLowerCase() === "entregado";

                          let itemsPedido: any[] = [];
                          if (Array.isArray(p.items)) {
                            itemsPedido = p.items;
                          } else if (typeof p.items === "string") {
                            try { itemsPedido = JSON.parse(p.items); } catch { itemsPedido = []; }
                          }

                          return (
                            <div
                              key={`pd-${p.id}`}
                              className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4EFEB]">
                                <div>
                                  <div className="flex items-center gap-2.5">
                                    <h3 className="font-fredoka text-lg font-bold text-gray-900">
                                      Pedido #{p.id}
                                    </h3>
                                    <span className={`inline-flex items-center gap-1.5 font-quicksand text-xs font-semibold px-3 py-1 rounded-full border ${estadoConfig.color}`}>
                                      <EstadoIcon size={13} />
                                      {estadoConfig.label}
                                    </span>
                                  </div>
                                  <p className="font-quicksand text-xs text-gray-400 mt-1">
                                    Registrado el {new Date(p.created_at).toLocaleDateString("es-PE", {
                                      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                                <div className="sm:text-right">
                                  <span className="font-quicksand text-xs text-gray-400 block">Total</span>
                                  <span className="font-fredoka text-lg font-bold text-gray-900">
                                    S/ {Number(p.total).toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              <OrderStepper estado={p.estado} />

                              {p.direccion_envio && (
                                <div className="flex items-center gap-2 p-3 bg-[#FAF8F6] rounded-xl text-xs font-quicksand text-gray-600 border border-[#EFEAE6]">
                                  <MapPin size={14} className="text-[#C04267] shrink-0" />
                                  <span className="truncate">
                                    <strong className="text-gray-800">Dirección de envío:</strong> {p.direccion_envio}
                                  </span>
                                </div>
                              )}

                              {itemsPedido.length > 0 && (
                                <div className="space-y-3 pt-1">
                                  <p className="font-quicksand text-xs font-bold uppercase tracking-wider text-gray-400">
                                    Detalle del pedido ({itemsPedido.length} artículo{itemsPedido.length > 1 ? "s" : ""})
                                  </p>
                                  {itemsPedido.map((item, index) => (
                                    <div
                                      key={item.id || `${p.id}-${index}`}
                                      className="p-4 rounded-xl bg-[#FAF8F6] border border-[#EFEAE6]"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-fredoka text-sm font-bold text-gray-800">{item.nombre}</p>
                                          <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                                            {item.cantidad || 1} unid. × S/ {Number(item.precio || 0).toFixed(2)}
                                          </p>
                                        </div>
                                        <span className="font-fredoka text-sm font-bold text-gray-900">
                                          S/ {((item.precio || 0) * (item.cantidad || 1)).toFixed(2)}
                                        </span>
                                      </div>

                                      {estaEntregado ? (
                                        <CalificarProducto item={item} nombreCliente={nombreUsuario} />
                                      ) : (
                                        <div className="mt-2.5 pt-2.5 border-t border-[#EFEAE6] flex items-center gap-1.5 text-[11px] text-gray-500 font-quicksand">
                                          <Clock size={12} className="text-amber-600 shrink-0" />
                                          <span>Podrás calificar este producto una vez que sea entregado.</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="pt-2 flex items-center justify-between border-t border-[#F4EFEB]">
                                <a
                                  href={`https://wa.me/51902578295?text=${encodeURIComponent(`Hola, quisiera consultar sobre mi Pedido #${p.id}`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-quicksand font-semibold text-[#C04267] hover:underline flex items-center gap-1"
                                >
                                  Consultar este pedido por WhatsApp
                                  <ArrowUpRight size={13} />
                                </a>
                              </div>
                            </div>
                          );
                        })}

                        {/* Pedidos Personalizados */}
                        {persAMostrar.map((p) => {
                          const estadoConfig = estados[p.estado] || estados.pendiente;
                          const EstadoIcon = estadoConfig.icon || Sparkles;

                          return (
                            <div
                              key={`pc-${p.id}`}
                              className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#F4EFEB]">
                                <div>
                                  <div className="flex items-center gap-2.5">
                                    <p className="font-fredoka text-lg font-bold text-gray-900">
                                      {p.producto_nombre || "Detalle personalizado"}
                                    </p>
                                    <span className={`inline-flex items-center gap-1.5 font-quicksand text-xs font-semibold px-3 py-1 rounded-full border ${estadoConfig.color}`}>
                                      <EstadoIcon size={13} />
                                      {estadoConfig.label}
                                    </span>
                                  </div>
                                  <p className="font-quicksand text-xs text-gray-400 mt-1">
                                    Solicitado el {new Date(p.created_at).toLocaleDateString("es-PE", {
                                      day: "numeric", month: "long", year: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>

                              {p.detalles && (
                                <div className="p-3.5 bg-[#FAF8F6] rounded-xl border border-[#EFEAE6]">
                                  <p className="font-quicksand text-xs text-gray-700 leading-relaxed">
                                    <strong className="text-gray-900">Detalles:</strong> {p.detalles}
                                  </p>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 pt-1">
                                {p.tamano && (
                                  <span className="font-quicksand text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full capitalize flex items-center gap-1.5">
                                    <Ruler size={12} /> {p.tamano}
                                  </span>
                                )}
                                {p.fecha_entrega && (
                                  <span className="font-quicksand text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-1.5">
                                    <Calendar size={12} /> Entrega estimada: {new Date(p.fecha_entrega).toLocaleDateString("es-PE")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Columna Lateral: Resumen de Pedidos */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-4">
                      <h4 className="font-fredoka text-base font-bold text-gray-800">
                        Resumen de compras
                      </h4>
                      <div className="space-y-3 font-quicksand text-xs text-gray-600">
                        <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEB]">
                          <span>Total invertido</span>
                          <strong className="text-gray-900 font-fredoka text-sm">S/ {totalInvertido.toFixed(2)}</strong>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEB]">
                          <span>Pedidos en proceso</span>
                          <strong className="text-[#C04267] font-semibold">{totalPedidosEnCurso}</strong>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEB]">
                          <span>Pedidos entregados</span>
                          <strong className="text-emerald-700 font-semibold">{totalPedidosEntregados}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total de órdenes</span>
                          <strong className="text-gray-900 font-semibold">{totalTodosPedidos}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-gray-800">
                        <HelpCircle size={18} className="text-[#C04267]" />
                        <h4 className="font-fredoka text-sm font-bold">¿Tienes dudas con tu entrega?</h4>
                      </div>
                      <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                        Si necesitas modificar la dirección de entrega de un pedido en proceso o coordinar la fecha exacta, comunícate con nosotros.
                      </p>
                      <a
                        href="https://wa.me/51902578295"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl font-quicksand text-xs font-semibold text-[#C04267] bg-[#FDF2F4] hover:bg-[#FBE4E9] transition-colors"
                      >
                        Contactar por WhatsApp
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTIFICACIONES */}
          {tab === "notificaciones" && (
            <div className="space-y-6 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#EFEAE6]">
                <div>
                  <h2 className="font-fredoka text-2xl sm:text-3xl font-bold text-[#C04267]">Notificaciones</h2>
                  <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-1">
                    Historial de avisos sobre actualizaciones y cambios de estado de tus pedidos.
                  </p>
                </div>
                {noLeidasCount > 0 && (
                  <button
                    onClick={marcarTodasComoLeidas}
                    className="self-start sm:self-auto flex items-center gap-1.5 font-quicksand text-xs font-semibold text-[#C04267] hover:bg-[#FDF2F4] bg-white border border-[#EFEAE6] px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCheck size={14} />
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              {/* Filtros de Notificaciones */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltroNotif("todos")}
                  className={`px-4 py-1.5 rounded-full font-quicksand text-xs font-semibold transition-all cursor-pointer ${
                    filtroNotif === "todos"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  Todas ({notificaciones.length})
                </button>
                <button
                  onClick={() => setFiltroNotif("no_leidos")}
                  className={`px-4 py-1.5 rounded-full font-quicksand text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filtroNotif === "no_leidos"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#EE6B8D]" />
                  No leídas ({notificacionesNoLeidas.length})
                </button>
                <button
                  onClick={() => setFiltroNotif("leidos")}
                  className={`px-4 py-1.5 rounded-full font-quicksand text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filtroNotif === "leidos"
                      ? "bg-[#C04267] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-[#EFEAE6]"
                  }`}
                >
                  <Check size={13} />
                  Leídas ({notificacionesLeidas.length})
                </button>
              </div>

              {loadingPedidos ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
                  {/* Columna Principal: Lista de Notificaciones */}
                  <div className="lg:col-span-8 space-y-3">
                    {notificacionesFiltradas.length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-2xl border border-[#EFEAE6] p-8">
                        <Bell size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="font-quicksand text-sm text-gray-700 font-semibold">
                          {filtroNotif === "no_leidos"
                            ? "No tienes notificaciones pendientes de leer"
                            : filtroNotif === "leidos"
                            ? "No hay notificaciones en tu historial de leídas"
                            : "No tienes notificaciones registradas"}
                        </p>
                        <p className="font-quicksand text-xs text-gray-400 mt-1">
                          Aquí te informaremos automáticamente cuando tus pedidos tengan novedades.
                        </p>
                      </div>
                    ) : (
                      notificacionesFiltradas.map((n) => {
                        const esLeida = n.leido || leidasIds.includes(String(n.id));
                        const tipo = (n.tipo || "").toLowerCase();

                        let IconComp = Bell;
                        let badgeColor = "bg-[#FAF8F6] text-gray-700 border-gray-200";
                        if (tipo === "entregado") {
                          IconComp = CheckCircle2;
                          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        } else if (tipo === "enviado") {
                          IconComp = Truck;
                          badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
                        } else if (tipo === "confirmado") {
                          IconComp = CheckCircle2;
                          badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                        } else if (tipo === "cancelado") {
                          IconComp = XCircle;
                          badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                        } else if (tipo === "en_produccion" || tipo === "listo") {
                          IconComp = Sparkles;
                          badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                        }

                        return (
                          <div
                            key={n.id}
                            onClick={() => marcarLeida(String(n.id))}
                            className={`w-full bg-white rounded-2xl border transition-all p-5 flex items-start gap-4 cursor-pointer hover:border-[#DED5CE] shadow-xs ${
                              !esLeida
                                ? "border-[#EE6B8D]/50 bg-gradient-to-r from-white to-[#FDF2F4]/30"
                                : "border-[#EFEAE6] opacity-85 hover:opacity-100"
                            }`}
                          >
                            <div className={`p-3 rounded-xl shrink-0 border ${badgeColor}`}>
                              <IconComp size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-fredoka text-base font-bold text-gray-800">
                                  {n.titulo}
                                </h3>
                                {!esLeida ? (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full bg-[#EE6B8D] shrink-0 mt-1"
                                    title="No leída"
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xs flex items-center gap-1 font-quicksand">
                                    <Check size={12} /> Leída
                                  </span>
                                )}
                              </div>
                              <p className="font-quicksand text-sm text-gray-600 mt-1 leading-relaxed">
                                {n.mensaje}
                              </p>
                              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100">
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      marcarLeida(String(n.id));
                                      setTab("pedidos");
                                    }}
                                    className="font-quicksand text-xs font-semibold text-[#C04267] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    Ver pedido #{n.pedido_id}
                                    <ChevronRight size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Columna Lateral: Información de Notificaciones */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-4">
                      <h4 className="font-fredoka text-base font-bold text-gray-800">
                        Centro de avisos
                      </h4>
                      <div className="space-y-3 font-quicksand text-xs text-gray-600">
                        <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEB]">
                          <span>Notificaciones totales</span>
                          <strong className="text-gray-900 font-semibold">{notificaciones.length}</strong>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEB]">
                          <span>Pendientes de leer</span>
                          <strong className="text-[#C04267] font-semibold">{notificacionesNoLeidas.length}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Leídas</span>
                          <strong className="text-emerald-700 font-semibold">{notificacionesLeidas.length}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#EFEAE6] p-6 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-gray-800">
                        <Bell size={18} className="text-[#C04267]" />
                        <h4 className="font-fredoka text-sm font-bold">¿Cómo funcionan los avisos?</h4>
                      </div>
                      <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                        Recibirás notificaciones instantáneas cada vez que un pedido sea confirmado por el taller, pase a la fase de tejido a mano o sea despachado a tu dirección.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
