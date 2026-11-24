"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Clock,
  Home,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import { getDepartamentos, getDistritos, getProvincias } from "@/lib/ubigeo";
import { NotificationsTab } from "@/components/perfil/NotificationsTab";
import { OrdersTab } from "@/components/perfil/OrdersTab";
import { ProfileTab } from "@/components/perfil/ProfileTab";
import {
  WHATSAPP_BASE_URL,
  formatCurrency,
  isPedidoEnCurso,
  type FiltroNotif,
  type FiltroPedidos,
  type Notificacion,
  type Pedido,
  type PedidoPersonalizado,
  type ProfileData,
  type Tab,
} from "@/components/perfil/types";

const MENU_ITEMS: { id: Tab; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { id: "perfil", label: "Mi perfil", shortLabel: "Mi perfil", icon: UserCircle },
  { id: "pedidos", label: "Mis pedidos", shortLabel: "Mis pedidos", icon: Package },
  { id: "notificaciones", label: "Notificaciones", shortLabel: "Avisos", icon: Bell },
];

const TAB_DESCRIPTIONS: Record<Tab, { title: string; subtitle: string }> = {
  perfil: {
    title: "Mi perfil",
    subtitle: "Administra tus datos de contacto y dirección habitual para agilizar tus compras.",
  },
  pedidos: {
    title: "Mis pedidos",
    subtitle: "Sigue en tiempo real la confección, empaque y entrega de tus compras.",
  },
  notificaciones: {
    title: "Notificaciones",
    subtitle: "Historial de avisos sobre confirmaciones, avances del taller y entregas.",
  },
};

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
  const [avatarError, setAvatarError] = useState(false);

  const [filtroPedidos, setFiltroPedidos] = useState<FiltroPedidos>("todos");
  const [filtroNotif, setFiltroNotif] = useState<FiltroNotif>("todos");

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
  const distritos = useMemo(
    () => getDistritos(formDepartamento, formProvincia),
    [formDepartamento, formProvincia]
  );

  // Sincronizar pestaña inicial desde query param (?tab=pedidos|notificaciones) sin romper SSR
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const qTab = params.get("tab");
        if (qTab === "perfil" || qTab === "pedidos" || qTab === "notificaciones") {
          setTab(qTab);
        }
      } catch {
        // Ignorar errores de acceso a location
      }
    });
  }, []);

  const selectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    try {
      const url = new URL(window.location.href);
      if (nextTab === "perfil") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", nextTab);
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Ignorar en entornos sin history
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // Cargar notificaciones leídas desde localStorage
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem(`entrehilos_notif_leidas_${uid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setLeidasIds(parsed);
        }
      } catch {
        // Ignorar JSON corrupto
      }
    });
  }, [user?.id]);

  // Cargar perfil desde localStorage y API
  useEffect(() => {
    if (!user) return;
    let active = true;

    const applyProfileToForm = (data: ProfileData) => {
      setProfile(data);
      setFormNombre(data.nombre || "");
      setFormTelefono(data.telefono || "");
      setFormDepartamento(data.departamento || "");
      setFormProvincia(data.provincia || "");
      setFormDistrito(data.distrito || "");
      setFormDireccion(data.direccion || "");
      setFormReferencia(data.referencia || "");
    };

    (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoadingProfile(true);
      try {
        const localKey = `entrehilos_perfil_envio_${user.id}`;
        const localStored = localStorage.getItem(localKey);
        if (localStored) {
          try {
            const parsed = JSON.parse(localStored) as ProfileData;
            if (parsed && active) {
              applyProfileToForm(parsed);
            }
          } catch {
            // Ignorar caché inválido
          }
        }

        const res = await fetch(`/api/perfil?userId=${encodeURIComponent(user.id)}`);
        if (res.ok && active) {
          const json = await res.json();
          if (json.profile && active) {
            applyProfileToForm(json.profile as ProfileData);
          }
        }
      } catch (e) {
        console.error("Error al cargar perfil:", e);
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  // Cargar pedidos y notificaciones
  const cargarDatos = useCallback(
    async (mostrarCarga = false) => {
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
            supabase
              .from("pedidos")
              .select("*")
              .or(`usuario_id.eq.${userId},cliente_email.eq.${email}`)
              .order("created_at", { ascending: false }),
            supabase
              .from("pedidos_personalizados")
              .select("*")
              .eq("email", email)
              .order("created_at", { ascending: false }),
          ]);
          if (pedidosRes.data) setPedidos(pedidosRes.data);
          if (personalizadosRes.data) setPersonalizados(personalizadosRes.data);
        }
      } catch (e) {
        console.error("Error al cargar pedidos y notificaciones:", e);
      } finally {
        setLoadingPedidos(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        cargarDatos(pedidos.length === 0 && notificaciones.length === 0);
      }
    });
    return () => {
      active = false;
    };
  }, [user, tab, cargarDatos, pedidos.length, notificaciones.length]);

  const resetProfileForm = useCallback(() => {
    setFormNombre(profile?.nombre || "");
    setFormTelefono(profile?.telefono || "");
    setFormDepartamento(profile?.departamento || "");
    setFormProvincia(profile?.provincia || "");
    setFormDistrito(profile?.distrito || "");
    setFormDireccion(profile?.direccion || "");
    setFormReferencia(profile?.referencia || "");
  }, [profile]);

  const isProfileDirty = useMemo(() => {
    return (
      formNombre.trim() !== (profile?.nombre || "").trim() ||
      formTelefono.trim() !== (profile?.telefono || "").trim() ||
      formDepartamento !== (profile?.departamento || "") ||
      formProvincia !== (profile?.provincia || "") ||
      formDistrito !== (profile?.distrito || "") ||
      formDireccion.trim() !== (profile?.direccion || "").trim() ||
      formReferencia.trim() !== (profile?.referencia || "").trim()
    );
  }, [
    formNombre,
    formTelefono,
    formDepartamento,
    formProvincia,
    formDistrito,
    formDireccion,
    formReferencia,
    profile,
  ]);

  const guardarPerfil = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      rol: profile?.rol ?? null,
    };

    try {
      localStorage.setItem(
        `entrehilos_perfil_envio_${user.id}`,
        JSON.stringify({ id: user.id, ...payload })
      );
    } catch {
      // Ignorar fallo de almacenamiento local
    }

    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...payload }),
      });

      if (!res.ok) {
        showToast(
          "No pudimos guardar en el servidor. Tus datos quedaron guardados solo en este dispositivo.",
          "error"
        );
        return;
      }

      const json = await res.json().catch(() => null);
      setProfile({ ...payload, ...(json?.profile || {}) });
      setPerfilGuardadoExito(true);
      setTimeout(() => setPerfilGuardadoExito(false), 3500);

      if (json?.partial && Array.isArray(json.campos_no_guardados) && json.campos_no_guardados.length > 0) {
        showToast(
          `Tu nombre y teléfono se guardaron, pero faltaron campos de envío (${json.campos_no_guardados.join(", ")}).`,
          "warning"
        );
      } else {
        showToast("Tus datos de entrega fueron guardados con éxito", "success");
      }

      // Refresca pedidos por si el teléfono o nombre ingresado vincula órdenes agendadas manualmente
      await cargarDatos(false);
    } catch {
      showToast(
        "No pudimos guardar en el servidor. Tus datos quedaron solo en este dispositivo.",
        "error"
      );
    } finally {
      setGuardandoPerfil(false);
    }
  };

  // Notificaciones
  const noLeidasCount = useMemo(
    () => notificaciones.filter((n) => !n.leido && !leidasIds.includes(String(n.id))).length,
    [notificaciones, leidasIds]
  );

  const marcarLeida = async (id: string) => {
    if (!leidasIds.includes(id)) {
      const updated = [...leidasIds, id];
      setLeidasIds(updated);
      if (user?.id) {
        try {
          localStorage.setItem(`entrehilos_notif_leidas_${user.id}`, JSON.stringify(updated));
        } catch {
          // Ignorar
        }
      }
      const numId = Number(id);
      if (!Number.isNaN(numId) && numId > 0) {
        try {
          const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
          const supabase = getSupabaseBrowserClient();
          await supabase.from("notificaciones").update({ leido: true }).eq("id", numId);
        } catch {
          // Ignorar
        }
      }
    }
  };

  const marcarTodasComoLeidas = async () => {
    const allIds = notificaciones.map((n) => String(n.id));
    setLeidasIds(allIds);
    if (user?.id) {
      try {
        localStorage.setItem(`entrehilos_notif_leidas_${user.id}`, JSON.stringify(allIds));
      } catch {
        // Ignorar
      }
      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseBrowserClient();
        await supabase
          .from("notificaciones")
          .update({ leido: true })
          .or(`usuario_id.eq.${user.id},email.eq.${user.email}`);
      } catch {
        // Ignorar
      }
    }
    showToast("Todas las notificaciones han sido marcadas como leídas", "success");
  };

  const notificacionesNoLeidas = useMemo(
    () => notificaciones.filter((n) => !n.leido && !leidasIds.includes(String(n.id))),
    [notificaciones, leidasIds]
  );

  const notificacionesLeidas = useMemo(
    () => notificaciones.filter((n) => Boolean(n.leido || leidasIds.includes(String(n.id)))),
    [notificaciones, leidasIds]
  );

  const notificacionesFiltradas = useMemo(() => {
    if (filtroNotif === "no_leidos") return notificacionesNoLeidas;
    if (filtroNotif === "leidos") return notificacionesLeidas;
    return notificaciones;
  }, [filtroNotif, notificaciones, notificacionesNoLeidas, notificacionesLeidas]);

  // Pedidos agrupados por estado real
  const pedidosEnCurso = useMemo(
    () => pedidos.filter((p) => isPedidoEnCurso(p.estado)),
    [pedidos]
  );
  const pedidosEntregados = useMemo(
    () => pedidos.filter((p) => (p.estado || "").toLowerCase() === "entregado"),
    [pedidos]
  );
  const pedidosCancelados = useMemo(
    () => pedidos.filter((p) => (p.estado || "").toLowerCase() === "cancelado"),
    [pedidos]
  );

  const persEnCurso = useMemo(
    () => personalizados.filter((p) => isPedidoEnCurso(p.estado)),
    [personalizados]
  );
  const persEntregados = useMemo(
    () => personalizados.filter((p) => (p.estado || "").toLowerCase() === "entregado"),
    [personalizados]
  );
  const persCancelados = useMemo(
    () => personalizados.filter((p) => (p.estado || "").toLowerCase() === "cancelado"),
    [personalizados]
  );

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
  const totalInvertido = useMemo(
    () =>
      pedidos.reduce((sum, p) => {
        if ((p.estado || "").toLowerCase() === "cancelado") return sum;
        return sum + (Number(p.total) || 0);
      }, 0),
    [pedidos]
  );

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#FCF8FA]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#EE6B8D]" />
          <p className="font-quicksand text-xs text-gray-500">Cargando tu cuenta...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const nombreUsuario =
    formNombre.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Cliente Entre Hilos";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const showAvatarImg = Boolean(avatarUrl && !avatarError);
  const isAdmin = profile?.rol === "admin" || profile?.rol === "super_admin";
  const hasSavedPhone = Boolean((profile?.telefono || formTelefono).trim());
  const hasSavedAddress = Boolean((profile?.direccion || formDireccion).trim());
  const sectionInfo = TAB_DESCRIPTIONS[tab];

  return (
    <div className="min-h-dvh bg-[#FCF8FA] flex flex-col">
      {/* Barra superior sticky de marca (Desktop + Mobile) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F2E2E8]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] rounded-xl pr-1"
            >
              <Image
                src="/logo.png"
                alt="Entre Hilos"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#F2DCE4] shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-fredoka text-base sm:text-lg font-bold text-[#C04267] tracking-tight truncate">
                Entre Hilos
              </span>
            </Link>
            <span className="hidden sm:inline text-[#E6CFD7]" aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline font-quicksand text-xs font-semibold text-gray-500">
              Mi cuenta
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FDF2F5] hover:bg-[#FAE3EA] border border-[#F3CED9] font-quicksand text-xs font-bold text-[#C04267] transition-colors"
              >
                <ShieldCheck size={14} />
                <span className="hidden sm:inline">Panel Admin</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-[#EFE1E6] bg-white hover:bg-[#FCF8FA] font-quicksand text-xs font-semibold text-gray-700 hover:text-[#C04267] transition-colors"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Volver a la tienda</span>
              <span className="sm:hidden">Tienda</span>
            </Link>

            <button
              type="button"
              onClick={signOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100/80 font-quicksand text-xs font-semibold text-rose-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación móvil sticky por pestañas segmentadas (sin botón flotante ni drawer) */}
      <div className="lg:hidden sticky top-14 sm:top-16 z-20 bg-[#FCF8FA]/95 backdrop-blur-md border-b border-[#F2E2E8] px-3 py-2.5">
        <div
          role="tablist"
          aria-label="Secciones de mi cuenta"
          className="grid grid-cols-3 gap-1 bg-white p-1 rounded-2xl border border-[#F0E2E7] shadow-2xs max-w-[1160px] mx-auto"
        >
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const badge =
              item.id === "pedidos"
                ? totalTodosPedidos
                : item.id === "notificaciones"
                ? noLeidasCount
                : 0;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(item.id)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl font-quicksand text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D] ${
                  active
                    ? "bg-[#C04267] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-[#FCF6F8]"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{item.shortLabel}</span>
                {badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums shrink-0 ${
                      active ? "bg-white/20 text-white" : "bg-[#FDF0F4] text-[#C04267]"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cuerpo principal */}
      <main className="flex-1 w-full max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-6">
        {/* Hero Card de Cuenta + Métricas rápidas */}
        <section
          aria-label="Resumen de cuenta"
          className="rounded-2xl border border-[#F2DCE4] bg-gradient-to-r from-white via-[#FFF9FB] to-[#FDF1F5] p-4 sm:p-6 shadow-[0_4px_20px_rgba(192,66,103,0.05)]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Identidad cliente */}
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {showAvatarImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={nombreUsuario}
                  onError={() => setAvatarError(true)}
                  className="w-13 h-13 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-[#EE6B8D] shadow-xs shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#EE6B8D] to-[#C04267] text-white flex items-center justify-center font-fredoka text-xl sm:text-2xl font-bold shadow-xs shrink-0"
                >
                  {nombreUsuario.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 space-y-1">
                <h1 className="font-fredoka text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {nombreUsuario}
                </h1>
                <p className="font-quicksand text-xs sm:text-sm text-gray-500 truncate">
                  {user.email}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-quicksand font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck size={12} />
                    Cliente verificado
                  </span>
                  {!hasSavedPhone || !hasSavedAddress ? (
                    <button
                      type="button"
                      onClick={() => selectTab("perfil")}
                      className="inline-flex items-center gap-1 text-[11px] font-quicksand font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      Completa tu envío
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-quicksand font-semibold text-[#C04267] bg-[#FDF2F5] border border-[#F4CED9] px-2.5 py-0.5 rounded-full">
                      <Truck size={11} />
                      Envío rápido listo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 w-full lg:w-auto lg:min-w-[400px]">
              <button
                type="button"
                onClick={() => {
                  setFiltroPedidos("todos");
                  selectTab("pedidos");
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-white/90 hover:bg-white border border-[#F0DCE3] text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
              >
                <p className="font-fredoka text-base sm:text-lg font-bold text-gray-900 tabular-nums">
                  {totalTodosPedidos}
                </p>
                <p className="font-quicksand text-[11px] text-gray-500">Pedidos</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroPedidos("en_curso");
                  selectTab("pedidos");
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-white/90 hover:bg-white border border-[#F0DCE3] text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
              >
                <p className="font-fredoka text-base sm:text-lg font-bold text-[#C04267] tabular-nums">
                  {totalPedidosEnCurso}
                </p>
                <p className="font-quicksand text-[11px] text-gray-500">En curso</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroPedidos("entregados");
                  selectTab("pedidos");
                }}
                className="p-2.5 sm:p-3 rounded-xl bg-white/90 hover:bg-white border border-[#F0DCE3] text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]"
              >
                <p className="font-fredoka text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
                  {totalPedidosEntregados}
                </p>
                <p className="font-quicksand text-[11px] text-gray-500">Entregados</p>
              </button>

              <div className="hidden sm:flex flex-col justify-center p-2.5 sm:p-3 rounded-xl bg-white/90 border border-[#F0DCE3] text-center">
                <p className="font-fredoka text-base sm:text-lg font-bold text-gray-900 tabular-nums truncate">
                  {formatCurrency(totalInvertido)}
                </p>
                <p className="font-quicksand text-[11px] text-gray-500">Total compras</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace Desktop de 2 Columnas + Área Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] gap-6 lg:gap-7 items-start">
          {/* Rail izquierdo sticky en desktop */}
          <aside className="hidden lg:flex flex-col gap-4 sticky top-24">
            <nav
              role="tablist"
              aria-label="Navegación de cuenta"
              className="bg-white rounded-2xl border border-[#F0E2E7] p-2 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-1"
            >
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                const badge =
                  item.id === "pedidos"
                    ? totalTodosPedidos
                    : item.id === "notificaciones"
                    ? noLeidasCount
                    : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold transition-all text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B8D]/60 ${
                      active
                        ? "bg-[#FDF1F5] text-[#C04267] ring-1 ring-[#F4CED9]"
                        : "text-gray-600 hover:bg-[#FCF8FA] hover:text-gray-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                      {item.label}
                    </span>
                    {badge > 0 && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                          active ? "bg-[#C04267] text-white" : "bg-[#FAF0F4] text-[#C04267]"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="my-2 border-t border-[#F4E9ED]" />

              <Link
                href="/"
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold text-gray-600 hover:bg-[#FCF8FA] hover:text-gray-900 transition-colors"
              >
                <Store size={17} strokeWidth={1.8} />
                Explorar catálogo
              </Link>
              <Link
                href="/personalizados"
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold text-gray-600 hover:bg-[#FCF8FA] hover:text-[#C04267] transition-colors"
              >
                <Sparkles size={17} strokeWidth={1.8} />
                Pedir personalizado
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-quicksand text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <LogOut size={17} strokeWidth={1.8} />
                Cerrar sesión
              </button>
            </nav>

            {/* Tarjeta de atención del taller */}
            <div className="bg-white rounded-2xl border border-[#F0E2E7] p-4 shadow-[0_2px_12px_rgba(192,66,103,0.03)] space-y-3">
              <div className="flex items-center gap-2 text-gray-800">
                <div className="w-8 h-8 rounded-lg bg-[#FDF2F5] text-[#C04267] flex items-center justify-center shrink-0">
                  <MessageCircle size={16} />
                </div>
                <div>
                  <h2 className="font-fredoka text-sm font-bold text-gray-800 leading-tight">
                    Taller Entre Hilos
                  </h2>
                  <p className="font-quicksand text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> Lun–Sáb · 9:00 a 19:00
                  </p>
                </div>
              </div>

              <p className="font-quicksand text-xs text-gray-600 leading-relaxed">
                Empaque rígido seguro para ramos tejidos y amigurumis. ¿Necesitas coordinar fecha o cambios?
              </p>

              <a
                href={WHATSAPP_BASE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl font-quicksand text-xs font-semibold text-[#C04267] bg-[#FDF2F5] hover:bg-[#FAE3EA] border border-[#F4CED9] transition-colors"
              >
                Consultar por WhatsApp
                <ArrowUpRight size={13} />
              </a>
            </div>
          </aside>

          {/* Columna de contenido activo */}
          <div className="min-w-0 space-y-5">
            <div className="pb-2 border-b border-[#EFE1E6]">
              <h2 className="font-fredoka text-xl sm:text-2xl font-bold text-[#C04267]">
                {sectionInfo.title}
              </h2>
              <p className="font-quicksand text-xs sm:text-sm text-gray-500 mt-0.5">
                {sectionInfo.subtitle}
              </p>
            </div>

            {tab === "perfil" &&
              (loadingProfile ? (
                <div className="bg-white rounded-2xl border border-[#F0E2E7] p-14 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={28} className="animate-spin text-[#EE6B8D]" />
                  <p className="font-quicksand text-xs text-gray-500">Cargando tu perfil...</p>
                </div>
              ) : (
                <ProfileTab
                  userEmail={user.email || ""}
                  formNombre={formNombre}
                  formTelefono={formTelefono}
                  formDepartamento={formDepartamento}
                  formProvincia={formProvincia}
                  formDistrito={formDistrito}
                  formDireccion={formDireccion}
                  formReferencia={formReferencia}
                  departamentos={departamentos}
                  provincias={provincias}
                  distritos={distritos}
                  isDirty={isProfileDirty}
                  guardando={guardandoPerfil}
                  guardadoExito={perfilGuardadoExito}
                  onChangeNombre={setFormNombre}
                  onChangeTelefono={setFormTelefono}
                  onChangeDepartamento={setFormDepartamento}
                  onChangeProvincia={setFormProvincia}
                  onChangeDistrito={setFormDistrito}
                  onChangeDireccion={setFormDireccion}
                  onChangeReferencia={setFormReferencia}
                  onReset={resetProfileForm}
                  onSubmit={guardarPerfil}
                />
              ))}

            {tab === "pedidos" && (
              <OrdersTab
                loading={loadingPedidos}
                filtroPedidos={filtroPedidos}
                onChangeFiltro={setFiltroPedidos}
                pedidosAMostrar={pedidosAMostrar}
                persAMostrar={persAMostrar}
                totalTodosPedidos={totalTodosPedidos}
                totalPedidosEnCurso={totalPedidosEnCurso}
                totalPedidosEntregados={totalPedidosEntregados}
                totalPedidosCancelados={totalPedidosCancelados}
                nombreUsuario={nombreUsuario}
                hasSavedPhone={hasSavedPhone}
                onRefresh={() => cargarDatos(true)}
                onGoToProfile={() => selectTab("perfil")}
              />
            )}

            {tab === "notificaciones" && (
              <NotificationsTab
                loading={loadingPedidos}
                filtroNotif={filtroNotif}
                onChangeFiltro={setFiltroNotif}
                notificaciones={notificaciones}
                notificacionesFiltradas={notificacionesFiltradas}
                noLeidasCount={noLeidasCount}
                leidasCount={notificacionesLeidas.length}
                leidasIds={leidasIds}
                onMarcarLeida={marcarLeida}
                onMarcarTodasLeidas={marcarTodasComoLeidas}
                onVerPedido={() => {
                  setFiltroPedidos("todos");
                  selectTab("pedidos");
                }}
              />
            )}

            {/* Tarjeta de ayuda directa visible solo en móvil/tablet */}
            <section className="lg:hidden bg-white rounded-2xl border border-[#F0E2E7] p-4 shadow-[0_2px_12px_rgba(192,66,103,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FDF2F5] text-[#C04267] flex items-center justify-center shrink-0">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h3 className="font-fredoka text-sm font-bold text-gray-800">
                    ¿Necesitas ayuda con un pedido?
                  </h3>
                  <p className="font-quicksand text-xs text-gray-500 mt-0.5">
                    Atención Lun–Sáb de 9:00 a 19:00 hrs · Embalaje seguro en cajas rígidas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={WHATSAPP_BASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-4 py-2 rounded-xl font-quicksand text-xs font-semibold text-[#C04267] bg-[#FDF2F5] hover:bg-[#FAE3EA] border border-[#F4CED9] transition-colors"
                >
                  WhatsApp
                  <ArrowUpRight size={13} />
                </a>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-quicksand text-xs font-semibold text-gray-600 bg-[#FAF6F8] border border-[#E8D8DE]"
                >
                  <Home size={13} />
                  Catálogo
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
