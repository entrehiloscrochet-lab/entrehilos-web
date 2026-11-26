package pe.entrehilos.admin

import android.content.Context
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.OfflineCacheStore
import pe.entrehilos.admin.data.OfflineOutboxStore
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.data.SessionStore
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs
import kotlin.math.roundToInt

object OfflineDeliveryReminderEngine {

    private const val PREFS_NAME = "entrehilos_offline_reminders"
    private val limaTz: TimeZone = TimeZone.getTimeZone("America/Lima")
    private val lock = Any()

    fun checkAndNotify(context: Context) {
        val appCtx = context.applicationContext
        if (SessionStore.getSession(appCtx) == null) return

        val baseSnap = OfflineCacheStore.loadSnapshot(appCtx) ?: return
        val snap = OfflineOutboxStore.applyPendingOpsToSnapshot(appCtx, baseSnap)
        val offline = !AlertPoller.hasInternet(appCtx)

        val nowMs = System.currentTimeMillis()
        val nowCal = Calendar.getInstance(limaTz).apply { timeInMillis = nowMs }
        val todayYmd = formatYmd(nowCal)

        val pedidosToCheck = if (offline) snap.pedidos else snap.pedidos.filter { it.id < 0L }
        val persToCheck = if (offline) snap.personalizados else snap.personalizados.filter { it.id < 0L }

        synchronized(lock) {
            pedidosToCheck.forEach { ped ->
                evaluatePedido(appCtx, ped, nowMs, nowCal, todayYmd)
            }
            persToCheck.forEach { pers ->
                evaluatePersonalizado(appCtx, pers, nowMs, nowCal, todayYmd)
            }
        }
    }

    private fun evaluatePedido(
        context: Context,
        ped: Pedido,
        nowMs: Long,
        nowCal: Calendar,
        todayYmd: String,
    ) {
        val estado = ped.estado.trim().lowercase()
        if (estado == "entregado" || estado == "cancelado") return
        val ymd = AdminFormatters.extractLimaDateOnly(ped.fechaEntrega) ?: return
        val (h, m) = AdminFormatters.parseClock24h(ped.horaEntrega)
        val horaNorm = String.format(Locale.US, "%02d:%02d", h, m)
        val horaFmt = AdminFormatters.formatHora12h(ped.horaEntrega)
        val fechaDisp = AdminFormatters.formatDateDisplay(ymd)
        val resumen = "$fechaDisp · $horaFmt"
        val cliente = ped.clienteNombre.trim().ifEmpty { "Cliente" }
        val extra = if (ped.total > 0.0) {
            String.format(Locale.US, " (S/ %.2f)", ped.total)
        } else ""
        val idLabel = if (ped.id < 0L) "local" else "#${ped.id}"

        val eval = computeTiming(ymd, h, m, nowMs, nowCal) ?: return
        val notifIdBase = 900_000_000L + abs(ped.id % 40_000_000L)

        // Caso A: Alerta urgente 2h antes de la entrega
        if (eval.minsToDelivery in 1.0..120.0) {
            val key = "ped:2h:${ped.id}:$ymd:$horaNorm"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                val remMins = eval.minsToDelivery.roundToInt().coerceAtLeast(1)
                val tiempo = when {
                    remMins < 60 -> "en $remMins min"
                    (remMins % 60) > 0 -> "en ${remMins / 60}h ${remMins % 60}m"
                    else -> "en ${remMins / 60}h"
                }
                fire(
                    context = context,
                    alertId = notifIdBase + 1L,
                    tipo = "entrega_2h",
                    titulo = "Entrega muy próxima ($tiempo)",
                    cuerpo = "Pedido $idLabel de $cliente$extra — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=pedidos",
                    seccion = "pedidos",
                    sub = "pedidos",
                )
            }
            return
        }

        // Caso B: Día de entrega exacto a la hora programada
        if (eval.daysLeft == 0 && eval.minsSinceDaily in 0.0..90.0) {
            val key = "ped:daily:${ped.id}:$ymd:$horaNorm:$todayYmd"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                fire(
                    context = context,
                    alertId = notifIdBase + 2L,
                    tipo = "entrega_hoy",
                    titulo = "¡Entrega HOY ($horaFmt)!",
                    cuerpo = "Pedido $idLabel de $cliente$extra — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=pedidos",
                    seccion = "pedidos",
                    sub = "pedidos",
                )
            }
            return
        }

        // Caso C: Recordatorio diario en días previos a la hora programada
        if (eval.daysLeft >= 1 && eval.minsSinceDaily in 0.0..90.0) {
            val key = "ped:daily:${ped.id}:$ymd:$horaNorm:$todayYmd"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                val tipo = if (eval.daysLeft == 1) "entrega_24h" else "entrega_diaria"
                val titulo = if (eval.daysLeft == 1) {
                    "¡Entrega mañana! (Falta 1 día)"
                } else {
                    "Faltan ${eval.daysLeft} días para entrega"
                }
                fire(
                    context = context,
                    alertId = notifIdBase + 3L,
                    tipo = tipo,
                    titulo = titulo,
                    cuerpo = "Pedido $idLabel de $cliente$extra — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=pedidos",
                    seccion = "pedidos",
                    sub = "pedidos",
                )
            }
        }
    }

    private fun evaluatePersonalizado(
        context: Context,
        pers: PedidoPersonalizado,
        nowMs: Long,
        nowCal: Calendar,
        todayYmd: String,
    ) {
        val estado = pers.estado.trim().lowercase()
        if (estado == "entregado" || estado == "cancelado") return
        val ymd = AdminFormatters.extractLimaDateOnly(pers.fechaEntrega) ?: return
        val (h, m) = AdminFormatters.parseClock24h(pers.horaEntrega)
        val horaNorm = String.format(Locale.US, "%02d:%02d", h, m)
        val horaFmt = AdminFormatters.formatHora12h(pers.horaEntrega)
        val fechaDisp = AdminFormatters.formatDateDisplay(ymd)
        val resumen = "$fechaDisp · $horaFmt"
        val cliente = pers.nombreCliente.trim().ifEmpty { "Cliente" }
        val prod = pers.productoNombre?.trim()?.takeIf { it.isNotEmpty() }?.let { " ($it)" } ?: ""
        val idLabel = if (pers.id < 0L) "local" else "#${pers.id}"

        val eval = computeTiming(ymd, h, m, nowMs, nowCal) ?: return
        val notifIdBase = 950_000_000L + abs(pers.id % 40_000_000L)

        if (eval.minsToDelivery in 1.0..120.0) {
            val key = "pers:2h:${pers.id}:$ymd:$horaNorm"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                val remMins = eval.minsToDelivery.roundToInt().coerceAtLeast(1)
                val tiempo = when {
                    remMins < 60 -> "en $remMins min"
                    (remMins % 60) > 0 -> "en ${remMins / 60}h ${remMins % 60}m"
                    else -> "en ${remMins / 60}h"
                }
                fire(
                    context = context,
                    alertId = notifIdBase + 1L,
                    tipo = "entrega_2h",
                    titulo = "Entrega muy próxima ($tiempo)",
                    cuerpo = "Personalizado $idLabel de $cliente$prod — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=personalizados",
                    seccion = "pedidos",
                    sub = "personalizados",
                )
            }
            return
        }

        if (eval.daysLeft == 0 && eval.minsSinceDaily in 0.0..90.0) {
            val key = "pers:daily:${pers.id}:$ymd:$horaNorm:$todayYmd"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                fire(
                    context = context,
                    alertId = notifIdBase + 2L,
                    tipo = "entrega_hoy",
                    titulo = "¡Entrega HOY ($horaFmt)!",
                    cuerpo = "Personalizado $idLabel de $cliente$prod — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=personalizados",
                    seccion = "pedidos",
                    sub = "personalizados",
                )
            }
            return
        }

        if (eval.daysLeft >= 1 && eval.minsSinceDaily in 0.0..90.0) {
            val key = "pers:daily:${pers.id}:$ymd:$horaNorm:$todayYmd"
            if (!wasNotified(context, key)) {
                markNotified(context, key)
                val tipo = if (eval.daysLeft == 1) "entrega_24h" else "entrega_diaria"
                val titulo = if (eval.daysLeft == 1) {
                    "¡Entrega mañana! (Falta 1 día)"
                } else {
                    "Faltan ${eval.daysLeft} días para entrega"
                }
                fire(
                    context = context,
                    alertId = notifIdBase + 3L,
                    tipo = tipo,
                    titulo = titulo,
                    cuerpo = "Personalizado $idLabel de $cliente$prod — Entrega: $resumen",
                    url = "/admin?seccion=pedidos&sub=personalizados",
                    seccion = "pedidos",
                    sub = "personalizados",
                )
            }
        }
    }

    private data class TimingEval(
        val daysLeft: Int,
        val minsToDelivery: Double,
        val minsSinceDaily: Double,
    )

    private fun computeTiming(
        deliveryYmd: String,
        hour: Int,
        minute: Int,
        nowMs: Long,
        nowCal: Calendar,
    ): TimingEval? {
        val parts = deliveryYmd.split("-")
        if (parts.size != 3) return null
        val y = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        val d = parts[2].toIntOrNull() ?: return null

        val deliveryDayCal = Calendar.getInstance(limaTz).apply {
            set(y, m - 1, d, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayCal = Calendar.getInstance(limaTz).apply {
            timeInMillis = nowMs
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val daysLeft = ((deliveryDayCal.timeInMillis - todayCal.timeInMillis) / 86_400_000L).toInt()

        val deliveryExactCal = Calendar.getInstance(limaTz).apply {
            set(y, m - 1, d, hour, minute, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayReminderCal = Calendar.getInstance(limaTz).apply {
            timeInMillis = nowCal.timeInMillis
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val minsToDelivery = (deliveryExactCal.timeInMillis - nowMs) / 60_000.0
        val minsSinceDaily = (nowMs - todayReminderCal.timeInMillis) / 60_000.0
        return TimingEval(daysLeft, minsToDelivery, minsSinceDaily)
    }

    private fun fire(
        context: Context,
        alertId: Long,
        tipo: String,
        titulo: String,
        cuerpo: String,
        url: String,
        seccion: String,
        sub: String,
    ) {
        NotificationHelper.showAlertNotification(
            context,
            alertId,
            tipo,
            titulo,
            cuerpo,
            url,
            seccion,
            sub,
        )
        MainActivity.notifyForegroundAlert(titulo, cuerpo, url)
    }

    private fun wasNotified(context: Context, key: String): Boolean {
        val sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return sp.contains(key)
    }

    private fun markNotified(context: Context, key: String) {
        val sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val editor = sp.edit().putLong(key, now)
        if (sp.all.size > 400) {
            val cutoff = now - (20L * 86_400_000L)
            sp.all.forEach { (k, v) ->
                if (v is Long && v < cutoff) {
                    editor.remove(k)
                }
            }
        }
        editor.apply()
    }

    private fun formatYmd(cal: Calendar): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = limaTz
        }
        return fmt.format(cal.time)
    }
}
