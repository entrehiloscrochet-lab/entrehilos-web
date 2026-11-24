package pe.entrehilos.admin.data

import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject
import pe.entrehilos.admin.theme.EhColors
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs
import kotlin.math.roundToInt

data class AdminSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAtEpochSec: Long,
    val userId: String,
    val email: String,
    val nombre: String,
    val rol: String,
)

data class PedidoItem(
    val nombre: String,
    val cantidad: Int,
    val precio: Double,
)

data class Pedido(
    val id: Long,
    val createdAt: String,
    val origen: String,
    val usuarioId: String?,
    val clienteNombre: String,
    val clienteTelefono: String,
    val clienteEmail: String?,
    val direccionEnvio: String,
    val items: List<PedidoItem>,
    val total: Double,
    val adelanto: Double,
    val saldoPendiente: Double,
    val fechaEntrega: String?,
    val horaEntrega: String?,
    val metodoPago: String,
    val estado: String,
    val notas: String?,
)

data class PedidoPersonalizado(
    val id: Long,
    val createdAt: String,
    val nombreCliente: String,
    val telefono: String,
    val email: String?,
    val productoNombre: String?,
    val productoPrecio: Double?,
    val detalles: String,
    val colores: String?,
    val tamano: String?,
    val extras: String?,
    val fechaEntrega: String?,
    val horaEntrega: String?,
    val estado: String,
)

data class CatalogProduct(
    val id: String,
    val sku: String,
    val nombre: String,
    val precio: Double,
    val categoria: String,
    val isActive: Boolean,
)

data class DirectoryClient(
    val key: String,
    val usuarioId: String? = null,
    val nombre: String,
    val telefono: String? = null,
    val email: String? = null,
    val direccion: String? = null,
    val origen: String,
)

data class ClientAccountItem(
    val key: String,
    val isRegistered: Boolean,
    val usuarioId: String?,
    val rol: String,
    val nombre: String,
    val email: String?,
    val telefono: String?,
    val direccion: String?,
    val pedidos: List<Pedido>,
    val personalizados: List<PedidoPersonalizado>,
    val totalGastado: Double,
    val createdAt: String,
) {
    val totalPedidosCount: Int get() = pedidos.size + personalizados.size
}

data class Suscriptor(
    val id: Long,
    val createdAt: String,
    val email: String,
    val nombre: String?,
    val activo: Boolean,
)

data class UsuarioPerfil(
    val id: String,
    val createdAt: String,
    val email: String,
    val nombre: String?,
    val telefono: String?,
    val rol: String,
    val direccion: String?,
    val distrito: String?,
)

data class MensajeContacto(
    val id: Long,
    val createdAt: String,
    val nombre: String,
    val email: String,
    val telefono: String?,
    val asunto: String?,
    val mensaje: String,
    val leido: Boolean,
)

data class Resena(
    val id: Long,
    val createdAt: String,
    val productoNombre: String?,
    val nombreCliente: String,
    val calificacion: Int,
    val comentario: String?,
    val aprobado: Boolean,
    val esManual: Boolean,
)

data class Reclamacion(
    val id: Long,
    val createdAt: String,
    val tipo: String,
    val nombreCompleto: String,
    val tipoDocumento: String,
    val numeroDocumento: String,
    val telefono: String,
    val email: String,
    val productoServicio: String,
    val monto: Double,
    val pedidoId: String?,
    val detalle: String,
)

data class AdminAlertRow(
    val id: Long,
    val createdAt: String,
    val tipo: String,
    val titulo: String,
    val cuerpo: String,
    val url: String,
    val seccion: String,
    val sub: String,
)

data class ForegroundAlertEvent(
    val title: String,
    val body: String,
    val url: String,
    val timestampMs: Long = System.currentTimeMillis(),
)

data class NotificationTarget(
    val seccion: String,
    val sub: String,
    val url: String,
)

enum class UrgencyKind {
    ATRASADO,
    HOY,
    MANANA,
    PROXIMO,
    FUTURO,
    COMPLETADO,
    SIN_FECHA,
}

data class UrgencyInfo(
    val kind: UrgencyKind,
    val label: String,
    val bgColor: Color,
    val fgColor: Color,
    val accentBarColor: Color,
    val isUrgent: Boolean,
    val diffDays: Int,
)

data class EstadoStyle(
    val key: String,
    val label: String,
    val bg: Color,
    val fg: Color,
)

object AdminFormatters {
    private val limaTz: TimeZone = TimeZone.getTimeZone("America/Lima")

    val PEDIDO_ESTADOS = listOf(
        "pendiente" to "Pendiente",
        "confirmado" to "Confirmado",
        "en_produccion" to "En confección",
        "listo" to "Listo",
        "enviado" to "En camino",
        "entregado" to "Entregado",
        "cancelado" to "Cancelado",
    )

    val PERSONALIZADO_ESTADOS = listOf(
        "pendiente" to "Pendiente",
        "confirmado" to "Confirmado",
        "en_produccion" to "En confección",
        "listo" to "Listo",
        "entregado" to "Entregado",
        "cancelado" to "Cancelado",
    )

    val CANALES_ORIGEN = listOf(
        "whatsapp" to "WhatsApp",
        "facebook" to "Facebook",
        "instagram" to "Instagram",
        "tiktok" to "TikTok",
        "telefono" to "Llamada",
        "presencial" to "Presencial",
        "tienda" to "Tienda Web",
    )

    val METODOS_PAGO = listOf(
        "yape" to "Yape",
        "plin" to "Plin",
        "transferencia" to "Transferencia",
        "efectivo" to "Efectivo",
        "tarjeta" to "Tarjeta",
    )

    fun estadoStyle(rawEstado: String?): EstadoStyle {
        return when (rawEstado?.trim()?.lowercase()) {
            "confirmado" -> EstadoStyle("confirmado", "Confirmado", EhColors.InfoBg, EhColors.InfoFg)
            "en_produccion" -> EstadoStyle("en_produccion", "En confección", EhColors.PurpleBg, EhColors.PurpleFg)
            "listo" -> EstadoStyle("listo", "Listo", EhColors.TealBg, EhColors.TealFg)
            "enviado" -> EstadoStyle("enviado", "En camino", EhColors.InfoBg, EhColors.InfoFg)
            "entregado" -> EstadoStyle("entregado", "Entregado", EhColors.SuccessBg, EhColors.SuccessFg)
            "cancelado" -> EstadoStyle("cancelado", "Cancelado", EhColors.GrayBg, EhColors.GrayFg)
            else -> EstadoStyle("pendiente", "Pendiente", EhColors.WarningBg, EhColors.WarningFg)
        }
    }

    fun origenLabel(origen: String?): String {
        return when (origen?.trim()?.lowercase()) {
            "whatsapp" -> "WhatsApp"
            "facebook" -> "Facebook"
            "instagram" -> "Instagram"
            "tiktok" -> "TikTok"
            "telefono", "llamada" -> "Llamada"
            "presencial" -> "Presencial"
            "tienda", "web", "", null -> "Tienda Web"
            else -> origen.replaceFirstChar { it.uppercase() }
        }
    }

    fun paymentLabel(metodo: String?): String {
        return when (metodo?.trim()?.lowercase()) {
            "plin" -> "Plin"
            "efectivo" -> "Efectivo"
            "contra_entrega" -> "Contra entrega"
            "transferencia" -> "Transferencia"
            "tarjeta" -> "Tarjeta"
            "yape", "", null -> "Yape"
            else -> metodo.replaceFirstChar { it.uppercase() }
        }
    }

    fun normalizeClientKey(rawName: String?): String {
        val raw = rawName?.trim().orEmpty()
        if (raw.isEmpty()) return ""
        val decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD)
        return decomposed.replace(Regex("\\p{M}+"), "").lowercase().trim()
    }

    fun extractLimaDateOnly(rawDate: String?): String? {
        val clean = rawDate?.trim()?.takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }
            ?: return null

        if (Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(clean)) {
            return clean
        }

        val normalized = clean
            .replace(" ", "T")
            .replace(Regex("\\.\\d+"), "")
            .replace("Z", "+0000")
            .replace(Regex("([+-]\\d{2}):(\\d{2})$"), "$1$2")

        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ss",
        )
        for (pattern in patterns) {
            try {
                val parser = SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val date = parser.parse(normalized)
                if (date != null) {
                    val out = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                        timeZone = limaTz
                    }
                    return out.format(date)
                }
            } catch (_: Exception) {
            }
        }

        val match = Regex("^(\\d{4}-\\d{2}-\\d{2})").find(clean)
        return match?.groupValues?.getOrNull(1)
    }

    fun formatDateDisplay(rawDate: String?): String {
        val ymd = extractLimaDateOnly(rawDate) ?: return "Sin fecha"
        val parts = ymd.split("-")
        if (parts.size != 3) return ymd
        return "${parts[2]}/${parts[1]}/${parts[0]}"
    }

    fun formatCreatedShort(rawDate: String?): String {
        val ymd = extractLimaDateOnly(rawDate) ?: return ""
        val parts = ymd.split("-")
        if (parts.size != 3) return ymd
        return "${parts[2]}/${parts[1]}/${parts[0]}"
    }

    fun formatTimestampClock(ms: Long): String {
        if (ms <= 0L) return "Pendiente"
        val fmt = SimpleDateFormat("hh:mm a", Locale("es", "PE")).apply {
            timeZone = limaTz
        }
        return fmt.format(ms)
    }

    fun calculateUrgency(fechaStr: String?, estado: String?): UrgencyInfo {
        val est = estado?.trim()?.lowercase().orEmpty()
        if (est == "entregado" || est == "cancelado") {
            return UrgencyInfo(
                kind = UrgencyKind.COMPLETADO,
                label = if (est == "entregado") "Entregado" else "Cancelado",
                bgColor = EhColors.GrayBg,
                fgColor = EhColors.GrayFg,
                accentBarColor = if (est == "entregado") Color(0xFF10B981) else Color(0xFF9CA3AF),
                isUrgent = false,
                diffDays = 9999
            )
        }

        val ymd = extractLimaDateOnly(fechaStr) ?: return UrgencyInfo(
            kind = UrgencyKind.SIN_FECHA,
            label = "Inmediata",
            bgColor = EhColors.GrayBg,
            fgColor = EhColors.GrayFg,
            accentBarColor = EhColors.BorderSoft,
            isUrgent = false,
            diffDays = 9998
        )

        val parts = ymd.split("-")
        if (parts.size != 3) {
            return UrgencyInfo(UrgencyKind.SIN_FECHA, ymd, EhColors.GrayBg, EhColors.GrayFg, EhColors.BorderSoft, false, 9998)
        }

        val y = parts[0].toIntOrNull() ?: return UrgencyInfo(UrgencyKind.SIN_FECHA, ymd, EhColors.GrayBg, EhColors.GrayFg, EhColors.BorderSoft, false, 9998)
        val m = (parts[1].toIntOrNull() ?: 1) - 1
        val d = parts[2].toIntOrNull() ?: 1

        val targetCal = Calendar.getInstance(limaTz).apply {
            set(y, m, d, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayCal = Calendar.getInstance(limaTz).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val diffDays = ((targetCal.timeInMillis - todayCal.timeInMillis).toDouble() / 86_400_000.0).roundToInt()

        return when {
            diffDays < 0 -> UrgencyInfo(
                kind = UrgencyKind.ATRASADO,
                label = "¡Atrasado (${abs(diffDays)}d)!",
                bgColor = EhColors.ErrorBg,
                fgColor = EhColors.ErrorFg,
                accentBarColor = Color(0xFFDC2626),
                isUrgent = true,
                diffDays = diffDays
            )
            diffDays == 0 -> UrgencyInfo(
                kind = UrgencyKind.HOY,
                label = "Entrega HOY",
                bgColor = EhColors.PrimarySoft,
                fgColor = EhColors.PrimaryDark,
                accentBarColor = EhColors.Primary,
                isUrgent = true,
                diffDays = 0
            )
            diffDays == 1 -> UrgencyInfo(
                kind = UrgencyKind.MANANA,
                label = "Mañana",
                bgColor = EhColors.WarningBg,
                fgColor = EhColors.WarningFg,
                accentBarColor = Color(0xFFF59E0B),
                isUrgent = true,
                diffDays = 1
            )
            diffDays in 2..3 -> UrgencyInfo(
                kind = UrgencyKind.PROXIMO,
                label = "En ${diffDays}d",
                bgColor = EhColors.InfoBg,
                fgColor = EhColors.InfoFg,
                accentBarColor = Color(0xFF3B82F6),
                isUrgent = false,
                diffDays = diffDays
            )
            else -> UrgencyInfo(
                kind = UrgencyKind.FUTURO,
                label = formatDateDisplay(ymd),
                bgColor = EhColors.GrayBg,
                fgColor = EhColors.GrayFg,
                accentBarColor = EhColors.BorderSoft,
                isUrgent = false,
                diffDays = diffDays
            )
        }
    }

    fun normalizeWhatsAppPhone(rawPhone: String?): String? {
        val digits = rawPhone?.replace(Regex("\\D"), "").orEmpty()
        if (digits.length < 7) return null
        return when {
            digits.length == 9 && digits.startsWith("9") -> "51$digits"
            digits.startsWith("51") && digits.length >= 11 -> digits
            else -> digits
        }
    }

    fun formatMoney(amount: Double): String = String.format(Locale.US, "S/ %.2f", amount)

    fun dateOffsetYmd(daysAhead: Int): String {
        val cal = Calendar.getInstance(limaTz)
        cal.add(Calendar.DAY_OF_YEAR, daysAhead)
        val out = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = limaTz
        }
        return out.format(cal.time)
    }

    fun nextSaturdayYmd(): String {
        val cal = Calendar.getInstance(limaTz)
        val currentDow = cal.get(Calendar.DAY_OF_WEEK)
        val diff = if (currentDow == Calendar.SATURDAY) 7 else (Calendar.SATURDAY - currentDow + 7) % 7
        cal.add(Calendar.DAY_OF_YEAR, diff)
        val out = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = limaTz
        }
        return out.format(cal.time)
    }
}

fun JSONObject.optNullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)?.toString()?.trim() ?: return null
    return if (raw.isEmpty() || raw.equals("null", ignoreCase = true)) null else raw
}

fun JSONObject.optCleanString(key: String, fallback: String = ""): String =
    optNullableString(key) ?: fallback

fun JSONObject.optDoubleOrZero(key: String): Double {
    if (!has(key) || isNull(key)) return 0.0
    val d = optDouble(key, Double.NaN)
    return if (d.isNaN()) 0.0 else d
}

fun parsePedidoItems(raw: Any?): List<PedidoItem> {
    val array: JSONArray = when (raw) {
        is JSONArray -> raw
        is String -> try {
            JSONArray(raw)
        } catch (_: Exception) {
            return emptyList()
        }
        else -> return emptyList()
    }
    val list = ArrayList<PedidoItem>(array.length())
    for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        val nombre = obj.optCleanString("nombre", obj.optCleanString("name", "Producto"))
        val cantidad = obj.optInt("cantidad", obj.optInt("quantity", 1)).coerceAtLeast(1)
        val precio = obj.optDoubleOrZero("precio").let {
            if (it == 0.0) obj.optDoubleOrZero("price") else it
        }
        list.add(PedidoItem(nombre = nombre, cantidad = cantidad, precio = precio))
    }
    return list
}
