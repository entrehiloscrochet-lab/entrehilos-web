package pe.entrehilos.admin.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

sealed class PendingOp(
    open val opId: String,
    open val createdAtMs: Long,
) {
    data class AgendarPedido(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val tempId: Long,
        val createdAtIso: String,
        val origen: String,
        val usuarioId: String?,
        val clienteNombre: String,
        val clienteTelefono: String,
        val clienteEmail: String?,
        val direccionEnvio: String?,
        val items: List<PedidoItem>,
        val total: Double,
        val adelanto: Double,
        val fechaEntregaYmd: String?,
        val horaEntrega: String?,
        val metodoPago: String,
        val estado: String,
        val notas: String?,
    ) : PendingOp(opId, createdAtMs)

    data class AgendarPersonalizado(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val tempId: Long,
        val createdAtIso: String,
        val nombreCliente: String,
        val telefono: String,
        val email: String?,
        val productoNombre: String?,
        val productoPrecio: Double?,
        val detalles: String,
        val colores: String?,
        val tamano: String?,
        val extras: String?,
        val fechaEntregaYmd: String,
        val horaEntrega: String?,
        val estado: String,
    ) : PendingOp(opId, createdAtMs)

    data class UpdatePedidoEstado(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
        val nuevoEstado: String,
    ) : PendingOp(opId, createdAtMs)

    data class UpdatePersonalizadoEstado(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
        val nuevoEstado: String,
    ) : PendingOp(opId, createdAtMs)

    data class ActualizarPedido(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
        val clienteNombre: String,
        val clienteTelefono: String,
        val clienteEmail: String?,
        val usuarioId: String?,
        val direccionEnvio: String?,
        val estado: String,
        val metodoPago: String,
        val adelanto: Double,
        val fechaEntregaYmd: String?,
        val horaEntrega: String?,
        val notas: String?,
        val total: Double,
    ) : PendingOp(opId, createdAtMs)

    data class ActualizarPersonalizado(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
        val nombreCliente: String,
        val telefono: String,
        val email: String?,
        val productoNombre: String?,
        val productoPrecio: Double?,
        val detalles: String,
        val colores: String?,
        val tamano: String?,
        val extras: String?,
        val fechaEntregaYmd: String,
        val horaEntrega: String?,
        val estado: String,
    ) : PendingOp(opId, createdAtMs)

    data class DeletePedido(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
    ) : PendingOp(opId, createdAtMs)

    data class DeletePersonalizado(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val pedidoId: Long,
    ) : PendingOp(opId, createdAtMs)

    data class MarcarMensajeLeido(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val mensajeId: Long,
    ) : PendingOp(opId, createdAtMs)

    data class ToggleAprobarResena(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val resenaId: Long,
        val nuevoAprobado: Boolean,
    ) : PendingOp(opId, createdAtMs)

    data class VincularPedidosUsuario(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val targetUserId: String,
        val matchNombre: String,
        val matchTelefono: String?,
        val matchEmail: String?,
    ) : PendingOp(opId, createdAtMs)

    data class AsignarCorreoCliente(
        override val opId: String = UUID.randomUUID().toString(),
        override val createdAtMs: Long = System.currentTimeMillis(),
        val email: String,
        val matchNombre: String,
        val matchTelefono: String?,
        val oldEmail: String?,
    ) : PendingOp(opId, createdAtMs)
}

object OfflineOutboxStore {

    private const val FILE_NAME = "offline_outbox_v1.json"
    private val lock = Any()

    fun getAll(context: Context): List<PendingOp> = synchronized(lock) {
        loadInternal(context)
    }

    fun count(context: Context): Int = synchronized(lock) {
        loadInternal(context).size
    }

    fun nextTempId(context: Context): Long = synchronized(lock) {
        val ops = loadInternal(context)
        val snap = OfflineCacheStore.loadSnapshot(context)
        val existingNeg = buildSet {
            ops.forEach { op ->
                when (op) {
                    is PendingOp.AgendarPedido -> add(op.tempId)
                    is PendingOp.AgendarPersonalizado -> add(op.tempId)
                    else -> Unit
                }
            }
            snap?.pedidos?.filter { it.id < 0 }?.forEach { add(it.id) }
            snap?.personalizados?.filter { it.id < 0 }?.forEach { add(it.id) }
        }
        var candidate = -(System.currentTimeMillis() % 1_000_000_000L).coerceAtLeast(1L)
        while (candidate in existingNeg) {
            candidate -= 1L
        }
        candidate
    }

    fun enqueue(context: Context, op: PendingOp): Int = synchronized(lock) {
        val list = loadInternal(context).toMutableList()
        when (op) {
            is PendingOp.DeletePedido -> {
                if (op.pedidoId < 0L) {
                    list.removeAll { existing ->
                        (existing is PendingOp.AgendarPedido && existing.tempId == op.pedidoId) ||
                            (existing is PendingOp.UpdatePedidoEstado && existing.pedidoId == op.pedidoId) ||
                            (existing is PendingOp.ActualizarPedido && existing.pedidoId == op.pedidoId) ||
                            (existing is PendingOp.DeletePedido && existing.pedidoId == op.pedidoId)
                    }
                    saveInternal(context, list)
                    return list.size
                }
            }
            is PendingOp.DeletePersonalizado -> {
                if (op.pedidoId < 0L) {
                    list.removeAll { existing ->
                        (existing is PendingOp.AgendarPersonalizado && existing.tempId == op.pedidoId) ||
                            (existing is PendingOp.UpdatePersonalizadoEstado && existing.pedidoId == op.pedidoId) ||
                            (existing is PendingOp.ActualizarPersonalizado && existing.pedidoId == op.pedidoId) ||
                            (existing is PendingOp.DeletePersonalizado && existing.pedidoId == op.pedidoId)
                    }
                    saveInternal(context, list)
                    return list.size
                }
            }
            else -> Unit
        }
        list.add(op)
        saveInternal(context, list)
        list.size
    }

    fun removeById(context: Context, opId: String): Int = synchronized(lock) {
        val list = loadInternal(context).filterNot { it.opId == opId }
        saveInternal(context, list)
        list.size
    }

    fun remapPedidoId(context: Context, tempId: Long, realId: Long) = synchronized(lock) {
        if (realId <= 0L) return@synchronized
        val updated = loadInternal(context).map { op ->
            when (op) {
                is PendingOp.UpdatePedidoEstado ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                is PendingOp.ActualizarPedido ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                is PendingOp.DeletePedido ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                else -> op
            }
        }
        saveInternal(context, updated)
        OfflineCacheStore.updateSnapshot(context) { snap ->
            snap.copy(
                pedidos = snap.pedidos.map { p ->
                    if (p.id == tempId) p.copy(id = realId) else p
                }
            )
        }
    }

    fun remapPersonalizadoId(context: Context, tempId: Long, realId: Long) = synchronized(lock) {
        if (realId <= 0L) return@synchronized
        val updated = loadInternal(context).map { op ->
            when (op) {
                is PendingOp.UpdatePersonalizadoEstado ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                is PendingOp.ActualizarPersonalizado ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                is PendingOp.DeletePersonalizado ->
                    if (op.pedidoId == tempId) op.copy(pedidoId = realId) else op
                else -> op
            }
        }
        saveInternal(context, updated)
        OfflineCacheStore.updateSnapshot(context) { snap ->
            snap.copy(
                personalizados = snap.personalizados.map { p ->
                    if (p.id == tempId) p.copy(id = realId) else p
                }
            )
        }
    }

    fun applyPendingOpsToSnapshot(context: Context, base: OfflineSnapshot): OfflineSnapshot {
        val ops = getAll(context)
        if (ops.isEmpty()) return base
        var pedidos = base.pedidos.toMutableList()
        var personalizados = base.personalizados.toMutableList()
        var mensajes = base.mensajes.toMutableList()
        var resenas = base.resenas.toMutableList()

        ops.forEach { op ->
            when (op) {
                is PendingOp.AgendarPedido -> {
                    if (pedidos.none { it.id == op.tempId }) {
                        pedidos.add(
                            0,
                            Pedido(
                                id = op.tempId,
                                createdAt = op.createdAtIso,
                                origen = op.origen,
                                usuarioId = op.usuarioId,
                                clienteNombre = op.clienteNombre.trim(),
                                clienteTelefono = op.clienteTelefono.trim(),
                                clienteEmail = op.clienteEmail?.trim()?.ifEmpty { null },
                                direccionEnvio = op.direccionEnvio?.trim()?.ifEmpty { null } ?: "Coordinar por WhatsApp",
                                items = op.items,
                                total = op.total,
                                adelanto = op.adelanto.coerceAtLeast(0.0),
                                saldoPendiente = (op.total - op.adelanto.coerceAtLeast(0.0)).coerceAtLeast(0.0),
                                fechaEntrega = op.fechaEntregaYmd?.trim()?.ifEmpty { null },
                                horaEntrega = op.horaEntrega?.trim()?.ifEmpty { null },
                                metodoPago = op.metodoPago,
                                estado = op.estado,
                                notas = op.notas?.trim()?.ifEmpty { null },
                            )
                        )
                    }
                }
                is PendingOp.AgendarPersonalizado -> {
                    if (personalizados.none { it.id == op.tempId }) {
                        personalizados.add(
                            0,
                            PedidoPersonalizado(
                                id = op.tempId,
                                createdAt = op.createdAtIso,
                                nombreCliente = op.nombreCliente.trim(),
                                telefono = op.telefono.trim(),
                                email = op.email?.trim()?.ifEmpty { null },
                                productoNombre = op.productoNombre?.trim()?.ifEmpty { null },
                                productoPrecio = op.productoPrecio,
                                detalles = op.detalles.trim(),
                                colores = op.colores?.trim()?.ifEmpty { null },
                                tamano = op.tamano?.trim()?.ifEmpty { null },
                                extras = op.extras?.trim()?.ifEmpty { null },
                                fechaEntrega = op.fechaEntregaYmd.trim(),
                                horaEntrega = op.horaEntrega?.trim()?.ifEmpty { null },
                                estado = op.estado,
                            )
                        )
                    }
                }
                is PendingOp.UpdatePedidoEstado -> {
                    pedidos = pedidos.map {
                        if (it.id == op.pedidoId) it.copy(estado = op.nuevoEstado) else it
                    }.toMutableList()
                }
                is PendingOp.UpdatePersonalizadoEstado -> {
                    personalizados = personalizados.map {
                        if (it.id == op.pedidoId) it.copy(estado = op.nuevoEstado) else it
                    }.toMutableList()
                }
                is PendingOp.ActualizarPedido -> {
                    pedidos = pedidos.map { p ->
                        if (p.id == op.pedidoId) {
                            val cleanAdelanto = op.adelanto.coerceAtLeast(0.0)
                            val effectiveTotal = if (op.total > 0.0) op.total else p.total
                            p.copy(
                                clienteNombre = op.clienteNombre.trim(),
                                clienteTelefono = op.clienteTelefono.trim(),
                                clienteEmail = op.clienteEmail?.trim()?.ifEmpty { null } ?: p.clienteEmail,
                                usuarioId = op.usuarioId?.trim()?.ifEmpty { null } ?: p.usuarioId,
                                direccionEnvio = op.direccionEnvio?.trim()?.ifEmpty { null } ?: "Coordinar por WhatsApp",
                                estado = op.estado,
                                metodoPago = op.metodoPago,
                                adelanto = cleanAdelanto,
                                saldoPendiente = (effectiveTotal - cleanAdelanto).coerceAtLeast(0.0),
                                fechaEntrega = op.fechaEntregaYmd?.trim()?.ifEmpty { null },
                                horaEntrega = op.horaEntrega?.trim()?.ifEmpty { null },
                                notas = op.notas?.trim()?.ifEmpty { null },
                            )
                        } else p
                    }.toMutableList()
                }
                is PendingOp.ActualizarPersonalizado -> {
                    personalizados = personalizados.map { p ->
                        if (p.id == op.pedidoId) {
                            p.copy(
                                nombreCliente = op.nombreCliente.trim(),
                                telefono = op.telefono.trim(),
                                email = op.email?.trim()?.ifEmpty { null },
                                productoNombre = op.productoNombre?.trim()?.ifEmpty { null },
                                productoPrecio = op.productoPrecio,
                                detalles = op.detalles.trim(),
                                colores = op.colores?.trim()?.ifEmpty { null },
                                tamano = op.tamano?.trim()?.ifEmpty { null },
                                extras = op.extras?.trim()?.ifEmpty { null },
                                fechaEntrega = op.fechaEntregaYmd.trim(),
                                horaEntrega = op.horaEntrega?.trim()?.ifEmpty { null },
                                estado = op.estado,
                            )
                        } else p
                    }.toMutableList()
                }
                is PendingOp.DeletePedido -> {
                    pedidos.removeAll { it.id == op.pedidoId }
                }
                is PendingOp.DeletePersonalizado -> {
                    personalizados.removeAll { it.id == op.pedidoId }
                }
                is PendingOp.MarcarMensajeLeido -> {
                    mensajes = mensajes.map {
                        if (it.id == op.mensajeId) it.copy(leido = true) else it
                    }.toMutableList()
                }
                is PendingOp.ToggleAprobarResena -> {
                    resenas = resenas.map {
                        if (it.id == op.resenaId) it.copy(aprobado = op.nuevoAprobado) else it
                    }.toMutableList()
                }
                is PendingOp.VincularPedidosUsuario -> {
                    val normNombre = AdminFormatters.normalizeClientKey(op.matchNombre)
                    val telDigits = op.matchTelefono?.replace(Regex("\\D"), "").orEmpty()
                    val normEmail = op.matchEmail?.trim()?.lowercase().orEmpty()
                    pedidos = pedidos.map { p ->
                        val pTel = p.clienteTelefono.replace(Regex("\\D"), "")
                        val pEmail = p.clienteEmail?.trim()?.lowercase().orEmpty()
                        val matches = (normEmail.isNotEmpty() && pEmail == normEmail) ||
                            (telDigits.length >= 7 && pTel == telDigits) ||
                            (normNombre.isNotEmpty() && AdminFormatters.normalizeClientKey(p.clienteNombre) == normNombre)
                        if (matches && p.usuarioId.isNullOrBlank()) p.copy(usuarioId = op.targetUserId) else p
                    }.toMutableList()
                }
                is PendingOp.AsignarCorreoCliente -> {
                    val cleanNewEmail = op.email.trim()
                    val normNombre = AdminFormatters.normalizeClientKey(op.matchNombre)
                    val telDigits = op.matchTelefono?.replace(Regex("\\D"), "").orEmpty()
                    val normOld = op.oldEmail?.trim()?.lowercase().orEmpty()
                    pedidos = pedidos.map { p ->
                        val pTel = p.clienteTelefono.replace(Regex("\\D"), "")
                        val pEmail = p.clienteEmail?.trim()?.lowercase().orEmpty()
                        val matches = (normOld.isNotEmpty() && pEmail == normOld) ||
                            (telDigits.length >= 7 && pTel == telDigits) ||
                            (normNombre.isNotEmpty() && AdminFormatters.normalizeClientKey(p.clienteNombre) == normNombre)
                        if (matches) p.copy(clienteEmail = cleanNewEmail) else p
                    }.toMutableList()
                    personalizados = personalizados.map { p ->
                        val sTel = p.telefono.replace(Regex("\\D"), "")
                        val sEmail = p.email?.trim()?.lowercase().orEmpty()
                        val matches = (normOld.isNotEmpty() && sEmail == normOld) ||
                            (telDigits.length >= 7 && sTel == telDigits) ||
                            (normNombre.isNotEmpty() && AdminFormatters.normalizeClientKey(p.nombreCliente) == normNombre)
                        if (matches) p.copy(email = cleanNewEmail) else p
                    }.toMutableList()
                }
            }
        }

        return base.copy(
            pedidos = pedidos,
            personalizados = personalizados,
            mensajes = mensajes,
            resenas = resenas,
        )
    }

    fun clear(context: Context) = synchronized(lock) {
        val dir = context.applicationContext.filesDir
        File(dir, FILE_NAME).delete()
        File(dir, "$FILE_NAME.tmp").delete()
    }

    // --- Persistence ---

    private fun loadInternal(context: Context): List<PendingOp> {
        val file = File(context.applicationContext.filesDir, FILE_NAME)
        if (!file.exists()) return emptyList()
        return try {
            val raw = file.readText(Charsets.UTF_8)
            if (raw.isBlank()) return emptyList()
            val arr = JSONArray(raw)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    fromJson(o)?.let { add(it) }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveInternal(context: Context, list: List<PendingOp>) {
        val arr = JSONArray().apply {
            list.forEach { put(toJson(it)) }
        }
        val dir = context.applicationContext.filesDir
        val tmp = File(dir, "$FILE_NAME.tmp")
        val target = File(dir, FILE_NAME)
        tmp.writeText(arr.toString(), Charsets.UTF_8)
        if (!tmp.renameTo(target)) {
            target.writeText(arr.toString(), Charsets.UTF_8)
            tmp.delete()
        }
    }

    private fun toJson(op: PendingOp): JSONObject = JSONObject().apply {
        put("opId", op.opId)
        put("createdAtMs", op.createdAtMs)
        when (op) {
            is PendingOp.AgendarPedido -> {
                put("type", "AGENDAR_PEDIDO")
                put("tempId", op.tempId)
                put("createdAtIso", op.createdAtIso)
                put("origen", op.origen)
                put("usuarioId", op.usuarioId ?: JSONObject.NULL)
                put("clienteNombre", op.clienteNombre)
                put("clienteTelefono", op.clienteTelefono)
                put("clienteEmail", op.clienteEmail ?: JSONObject.NULL)
                put("direccionEnvio", op.direccionEnvio ?: JSONObject.NULL)
                put("items", JSONArray().apply {
                    op.items.forEach { it ->
                        put(JSONObject().apply {
                            put("nombre", it.nombre)
                            put("cantidad", it.cantidad)
                            put("precio", it.precio)
                        })
                    }
                })
                put("total", op.total)
                put("adelanto", op.adelanto)
                put("fechaEntregaYmd", op.fechaEntregaYmd ?: JSONObject.NULL)
                put("horaEntrega", op.horaEntrega ?: JSONObject.NULL)
                put("metodoPago", op.metodoPago)
                put("estado", op.estado)
                put("notas", op.notas ?: JSONObject.NULL)
            }
            is PendingOp.AgendarPersonalizado -> {
                put("type", "AGENDAR_PERSONALIZADO")
                put("tempId", op.tempId)
                put("createdAtIso", op.createdAtIso)
                put("nombreCliente", op.nombreCliente)
                put("telefono", op.telefono)
                put("email", op.email ?: JSONObject.NULL)
                put("productoNombre", op.productoNombre ?: JSONObject.NULL)
                put("productoPrecio", op.productoPrecio ?: JSONObject.NULL)
                put("detalles", op.detalles)
                put("colores", op.colores ?: JSONObject.NULL)
                put("tamano", op.tamano ?: JSONObject.NULL)
                put("extras", op.extras ?: JSONObject.NULL)
                put("fechaEntregaYmd", op.fechaEntregaYmd)
                put("horaEntrega", op.horaEntrega ?: JSONObject.NULL)
                put("estado", op.estado)
            }
            is PendingOp.UpdatePedidoEstado -> {
                put("type", "UPDATE_PEDIDO_ESTADO")
                put("pedidoId", op.pedidoId)
                put("nuevoEstado", op.nuevoEstado)
            }
            is PendingOp.UpdatePersonalizadoEstado -> {
                put("type", "UPDATE_PERSONALIZADO_ESTADO")
                put("pedidoId", op.pedidoId)
                put("nuevoEstado", op.nuevoEstado)
            }
            is PendingOp.ActualizarPedido -> {
                put("type", "ACTUALIZAR_PEDIDO")
                put("pedidoId", op.pedidoId)
                put("clienteNombre", op.clienteNombre)
                put("clienteTelefono", op.clienteTelefono)
                put("clienteEmail", op.clienteEmail ?: JSONObject.NULL)
                put("usuarioId", op.usuarioId ?: JSONObject.NULL)
                put("direccionEnvio", op.direccionEnvio ?: JSONObject.NULL)
                put("estado", op.estado)
                put("metodoPago", op.metodoPago)
                put("adelanto", op.adelanto)
                put("fechaEntregaYmd", op.fechaEntregaYmd ?: JSONObject.NULL)
                put("horaEntrega", op.horaEntrega ?: JSONObject.NULL)
                put("notas", op.notas ?: JSONObject.NULL)
                put("total", op.total)
            }
            is PendingOp.ActualizarPersonalizado -> {
                put("type", "ACTUALIZAR_PERSONALIZADO")
                put("pedidoId", op.pedidoId)
                put("nombreCliente", op.nombreCliente)
                put("telefono", op.telefono)
                put("email", op.email ?: JSONObject.NULL)
                put("productoNombre", op.productoNombre ?: JSONObject.NULL)
                put("productoPrecio", op.productoPrecio ?: JSONObject.NULL)
                put("detalles", op.detalles)
                put("colores", op.colores ?: JSONObject.NULL)
                put("tamano", op.tamano ?: JSONObject.NULL)
                put("extras", op.extras ?: JSONObject.NULL)
                put("fechaEntregaYmd", op.fechaEntregaYmd)
                put("horaEntrega", op.horaEntrega ?: JSONObject.NULL)
                put("estado", op.estado)
            }
            is PendingOp.DeletePedido -> {
                put("type", "DELETE_PEDIDO")
                put("pedidoId", op.pedidoId)
            }
            is PendingOp.DeletePersonalizado -> {
                put("type", "DELETE_PERSONALIZADO")
                put("pedidoId", op.pedidoId)
            }
            is PendingOp.MarcarMensajeLeido -> {
                put("type", "MARCAR_MENSAJE_LEIDO")
                put("mensajeId", op.mensajeId)
            }
            is PendingOp.ToggleAprobarResena -> {
                put("type", "TOGGLE_APROBAR_RESENA")
                put("resenaId", op.resenaId)
                put("nuevoAprobado", op.nuevoAprobado)
            }
            is PendingOp.VincularPedidosUsuario -> {
                put("type", "VINCULAR_PEDIDOS_USUARIO")
                put("targetUserId", op.targetUserId)
                put("matchNombre", op.matchNombre)
                put("matchTelefono", op.matchTelefono ?: JSONObject.NULL)
                put("matchEmail", op.matchEmail ?: JSONObject.NULL)
            }
            is PendingOp.AsignarCorreoCliente -> {
                put("type", "ASIGNAR_CORREO_CLIENTE")
                put("email", op.email)
                put("matchNombre", op.matchNombre)
                put("matchTelefono", op.matchTelefono ?: JSONObject.NULL)
                put("oldEmail", op.oldEmail ?: JSONObject.NULL)
            }
        }
    }

    private fun fromJson(o: JSONObject): PendingOp? {
        val opId = o.optString("opId", UUID.randomUUID().toString())
        val createdAtMs = o.optLong("createdAtMs", System.currentTimeMillis())
        return when (o.optString("type")) {
            "AGENDAR_PEDIDO" -> {
                val itemsArr = o.optJSONArray("items") ?: JSONArray()
                val items = buildList(itemsArr.length()) {
                    for (j in 0 until itemsArr.length()) {
                        val io = itemsArr.optJSONObject(j) ?: continue
                        add(
                            PedidoItem(
                                nombre = io.optString("nombre", "Producto"),
                                cantidad = io.optInt("cantidad", 1).coerceAtLeast(1),
                                precio = io.optDouble("precio", 0.0),
                            )
                        )
                    }
                }
                PendingOp.AgendarPedido(
                    opId = opId,
                    createdAtMs = createdAtMs,
                    tempId = o.optLong("tempId"),
                    createdAtIso = o.optString("createdAtIso", ""),
                    origen = o.optString("origen", "tienda"),
                    usuarioId = o.optNullableStr("usuarioId"),
                    clienteNombre = o.optString("clienteNombre", "Cliente"),
                    clienteTelefono = o.optString("clienteTelefono", ""),
                    clienteEmail = o.optNullableStr("clienteEmail"),
                    direccionEnvio = o.optNullableStr("direccionEnvio"),
                    items = items,
                    total = o.optDouble("total", 0.0),
                    adelanto = o.optDouble("adelanto", 0.0),
                    fechaEntregaYmd = o.optNullableStr("fechaEntregaYmd"),
                    horaEntrega = o.optNullableStr("horaEntrega"),
                    metodoPago = o.optString("metodoPago", "yape"),
                    estado = o.optString("estado", "pendiente"),
                    notas = o.optNullableStr("notas"),
                )
            }
            "AGENDAR_PERSONALIZADO" -> {
                val precio = if (o.has("productoPrecio") && !o.isNull("productoPrecio")) {
                    o.optDouble("productoPrecio", 0.0)
                } else null
                PendingOp.AgendarPersonalizado(
                    opId = opId,
                    createdAtMs = createdAtMs,
                    tempId = o.optLong("tempId"),
                    createdAtIso = o.optString("createdAtIso", ""),
                    nombreCliente = o.optString("nombreCliente", "Cliente"),
                    telefono = o.optString("telefono", ""),
                    email = o.optNullableStr("email"),
                    productoNombre = o.optNullableStr("productoNombre"),
                    productoPrecio = precio,
                    detalles = o.optString("detalles", ""),
                    colores = o.optNullableStr("colores"),
                    tamano = o.optNullableStr("tamano"),
                    extras = o.optNullableStr("extras"),
                    fechaEntregaYmd = o.optString("fechaEntregaYmd", ""),
                    horaEntrega = o.optNullableStr("horaEntrega"),
                    estado = o.optString("estado", "pendiente"),
                )
            }
            "UPDATE_PEDIDO_ESTADO" -> PendingOp.UpdatePedidoEstado(
                opId = opId,
                createdAtMs = createdAtMs,
                pedidoId = o.optLong("pedidoId"),
                nuevoEstado = o.optString("nuevoEstado", "pendiente"),
            )
            "UPDATE_PERSONALIZADO_ESTADO" -> PendingOp.UpdatePersonalizadoEstado(
                opId = opId,
                createdAtMs = createdAtMs,
                pedidoId = o.optLong("pedidoId"),
                nuevoEstado = o.optString("nuevoEstado", "pendiente"),
            )
            "ACTUALIZAR_PEDIDO" -> PendingOp.ActualizarPedido(
                opId = opId,
                createdAtMs = createdAtMs,
                pedidoId = o.optLong("pedidoId"),
                clienteNombre = o.optString("clienteNombre", "Cliente"),
                clienteTelefono = o.optString("clienteTelefono", ""),
                clienteEmail = o.optNullableStr("clienteEmail"),
                usuarioId = o.optNullableStr("usuarioId"),
                direccionEnvio = o.optNullableStr("direccionEnvio"),
                estado = o.optString("estado", "pendiente"),
                metodoPago = o.optString("metodoPago", "yape"),
                adelanto = o.optDouble("adelanto", 0.0),
                fechaEntregaYmd = o.optNullableStr("fechaEntregaYmd"),
                horaEntrega = o.optNullableStr("horaEntrega"),
                notas = o.optNullableStr("notas"),
                total = o.optDouble("total", 0.0),
            )
            "ACTUALIZAR_PERSONALIZADO" -> {
                val precio = if (o.has("productoPrecio") && !o.isNull("productoPrecio")) {
                    o.optDouble("productoPrecio", 0.0)
                } else null
                PendingOp.ActualizarPersonalizado(
                    opId = opId,
                    createdAtMs = createdAtMs,
                    pedidoId = o.optLong("pedidoId"),
                    nombreCliente = o.optString("nombreCliente", "Cliente"),
                    telefono = o.optString("telefono", ""),
                    email = o.optNullableStr("email"),
                    productoNombre = o.optNullableStr("productoNombre"),
                    productoPrecio = precio,
                    detalles = o.optString("detalles", ""),
                    colores = o.optNullableStr("colores"),
                    tamano = o.optNullableStr("tamano"),
                    extras = o.optNullableStr("extras"),
                    fechaEntregaYmd = o.optString("fechaEntregaYmd", ""),
                    horaEntrega = o.optNullableStr("horaEntrega"),
                    estado = o.optString("estado", "pendiente"),
                )
            }
            "DELETE_PEDIDO" -> PendingOp.DeletePedido(
                opId = opId,
                createdAtMs = createdAtMs,
                pedidoId = o.optLong("pedidoId"),
            )
            "DELETE_PERSONALIZADO" -> PendingOp.DeletePersonalizado(
                opId = opId,
                createdAtMs = createdAtMs,
                pedidoId = o.optLong("pedidoId"),
            )
            "MARCAR_MENSAJE_LEIDO" -> PendingOp.MarcarMensajeLeido(
                opId = opId,
                createdAtMs = createdAtMs,
                mensajeId = o.optLong("mensajeId"),
            )
            "TOGGLE_APROBAR_RESENA" -> PendingOp.ToggleAprobarResena(
                opId = opId,
                createdAtMs = createdAtMs,
                resenaId = o.optLong("resenaId"),
                nuevoAprobado = o.optBoolean("nuevoAprobado", true),
            )
            "VINCULAR_PEDIDOS_USUARIO" -> PendingOp.VincularPedidosUsuario(
                opId = opId,
                createdAtMs = createdAtMs,
                targetUserId = o.optString("targetUserId", ""),
                matchNombre = o.optString("matchNombre", ""),
                matchTelefono = o.optNullableStr("matchTelefono"),
                matchEmail = o.optNullableStr("matchEmail"),
            )
            "ASIGNAR_CORREO_CLIENTE" -> PendingOp.AsignarCorreoCliente(
                opId = opId,
                createdAtMs = createdAtMs,
                email = o.optString("email", ""),
                matchNombre = o.optString("matchNombre", ""),
                matchTelefono = o.optNullableStr("matchTelefono"),
                oldEmail = o.optNullableStr("oldEmail"),
            )
            else -> null
        }
    }

    private fun JSONObject.optNullableStr(key: String): String? {
        if (!has(key) || isNull(key)) return null
        val v = optString(key, "").trim()
        return if (v.isEmpty() || v.equals("null", ignoreCase = true)) null else v
    }
}
