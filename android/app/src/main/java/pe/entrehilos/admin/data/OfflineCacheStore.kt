package pe.entrehilos.admin.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class OfflineSnapshot(
    val savedAtMs: Long = 0L,
    val pedidos: List<Pedido> = emptyList(),
    val personalizados: List<PedidoPersonalizado> = emptyList(),
    val productos: List<CatalogProduct> = emptyList(),
    val suscriptores: List<Suscriptor> = emptyList(),
    val usuarios: List<UsuarioPerfil> = emptyList(),
    val mensajes: List<MensajeContacto> = emptyList(),
    val resenas: List<Resena> = emptyList(),
    val reclamaciones: List<Reclamacion> = emptyList(),
    val recentAlerts: List<AdminAlertRow> = emptyList(),
)

object OfflineCacheStore {

    private const val FILE_NAME = "offline_snapshot_v1.json"
    private val lock = Any()

    fun loadSnapshot(context: Context): OfflineSnapshot? = synchronized(lock) {
        val file = File(context.applicationContext.filesDir, FILE_NAME)
        if (!file.exists()) return null
        return try {
            val raw = file.readText(Charsets.UTF_8)
            if (raw.isBlank()) return null
            val root = JSONObject(raw)
            OfflineSnapshot(
                savedAtMs = root.optLong("savedAtMs", 0L),
                pedidos = parsePedidos(root.optJSONArray("pedidos")),
                personalizados = parsePersonalizados(root.optJSONArray("personalizados")),
                productos = parseProductos(root.optJSONArray("productos")),
                suscriptores = parseSuscriptores(root.optJSONArray("suscriptores")),
                usuarios = parseUsuarios(root.optJSONArray("usuarios")),
                mensajes = parseMensajes(root.optJSONArray("mensajes")),
                resenas = parseResenas(root.optJSONArray("resenas")),
                reclamaciones = parseReclamaciones(root.optJSONArray("reclamaciones")),
                recentAlerts = parseAlerts(root.optJSONArray("recentAlerts")),
            )
        } catch (_: Exception) {
            null
        }
    }

    fun saveSnapshot(context: Context, snapshot: OfflineSnapshot) = synchronized(lock) {
        val root = JSONObject().apply {
            put("savedAtMs", snapshot.savedAtMs)
            put("pedidos", pedidosToJson(snapshot.pedidos))
            put("personalizados", personalizadosToJson(snapshot.personalizados))
            put("productos", productosToJson(snapshot.productos))
            put("suscriptores", suscriptoresToJson(snapshot.suscriptores))
            put("usuarios", usuariosToJson(snapshot.usuarios))
            put("mensajes", mensajesToJson(snapshot.mensajes))
            put("resenas", resenasToJson(snapshot.resenas))
            put("reclamaciones", reclamacionesToJson(snapshot.reclamaciones))
            put("recentAlerts", alertsToJson(snapshot.recentAlerts))
        }
        writeAtomic(context, root.toString())
    }

    inline fun updateSnapshot(context: Context, transform: (OfflineSnapshot) -> OfflineSnapshot) {
        val current = loadSnapshot(context) ?: OfflineSnapshot()
        val updated = transform(current).copy(savedAtMs = System.currentTimeMillis())
        saveSnapshot(context, updated)
    }

    fun clear(context: Context) = synchronized(lock) {
        val dir = context.applicationContext.filesDir
        File(dir, FILE_NAME).delete()
        File(dir, "$FILE_NAME.tmp").delete()
    }

    private fun writeAtomic(context: Context, content: String) {
        val dir = context.applicationContext.filesDir
        val tmp = File(dir, "$FILE_NAME.tmp")
        val target = File(dir, FILE_NAME)
        tmp.writeText(content, Charsets.UTF_8)
        if (!tmp.renameTo(target)) {
            target.writeText(content, Charsets.UTF_8)
            tmp.delete()
        }
    }

    // --- Serializers ---

    private fun pedidosToJson(list: List<Pedido>): JSONArray = JSONArray().apply {
        list.forEach { p ->
            put(JSONObject().apply {
                put("id", p.id)
                put("createdAt", p.createdAt)
                put("origen", p.origen)
                put("usuarioId", p.usuarioId ?: JSONObject.NULL)
                put("clienteNombre", p.clienteNombre)
                put("clienteTelefono", p.clienteTelefono)
                put("clienteEmail", p.clienteEmail ?: JSONObject.NULL)
                put("direccionEnvio", p.direccionEnvio)
                put("items", JSONArray().apply {
                    p.items.forEach { it ->
                        put(JSONObject().apply {
                            put("nombre", it.nombre)
                            put("cantidad", it.cantidad)
                            put("precio", it.precio)
                        })
                    }
                })
                put("total", p.total)
                put("adelanto", p.adelanto)
                put("saldoPendiente", p.saldoPendiente)
                put("fechaEntrega", p.fechaEntrega ?: JSONObject.NULL)
                put("horaEntrega", p.horaEntrega ?: JSONObject.NULL)
                put("metodoPago", p.metodoPago)
                put("estado", p.estado)
                put("notas", p.notas ?: JSONObject.NULL)
            })
        }
    }

    private fun parsePedidos(arr: JSONArray?): List<Pedido> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
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
                add(
                    Pedido(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        origen = o.optString("origen", "tienda"),
                        usuarioId = o.optNullableStr("usuarioId"),
                        clienteNombre = o.optString("clienteNombre", "Cliente"),
                        clienteTelefono = o.optString("clienteTelefono", ""),
                        clienteEmail = o.optNullableStr("clienteEmail"),
                        direccionEnvio = o.optString("direccionEnvio", "Coordinar por WhatsApp"),
                        items = items,
                        total = o.optDouble("total", 0.0),
                        adelanto = o.optDouble("adelanto", 0.0),
                        saldoPendiente = o.optDouble("saldoPendiente", 0.0),
                        fechaEntrega = o.optNullableStr("fechaEntrega"),
                        horaEntrega = o.optNullableStr("horaEntrega"),
                        metodoPago = o.optString("metodoPago", "yape"),
                        estado = o.optString("estado", "pendiente"),
                        notas = o.optNullableStr("notas"),
                    )
                )
            }
        }
    }

    private fun personalizadosToJson(list: List<PedidoPersonalizado>): JSONArray = JSONArray().apply {
        list.forEach { p ->
            put(JSONObject().apply {
                put("id", p.id)
                put("createdAt", p.createdAt)
                put("nombreCliente", p.nombreCliente)
                put("telefono", p.telefono)
                put("email", p.email ?: JSONObject.NULL)
                put("productoNombre", p.productoNombre ?: JSONObject.NULL)
                put("productoPrecio", p.productoPrecio ?: JSONObject.NULL)
                put("detalles", p.detalles)
                put("colores", p.colores ?: JSONObject.NULL)
                put("tamano", p.tamano ?: JSONObject.NULL)
                put("extras", p.extras ?: JSONObject.NULL)
                put("fechaEntrega", p.fechaEntrega ?: JSONObject.NULL)
                put("horaEntrega", p.horaEntrega ?: JSONObject.NULL)
                put("estado", p.estado)
            })
        }
    }

    private fun parsePersonalizados(arr: JSONArray?): List<PedidoPersonalizado> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val precio = if (o.has("productoPrecio") && !o.isNull("productoPrecio")) {
                    o.optDouble("productoPrecio", 0.0)
                } else null
                add(
                    PedidoPersonalizado(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        nombreCliente = o.optString("nombreCliente", "Cliente"),
                        telefono = o.optString("telefono", ""),
                        email = o.optNullableStr("email"),
                        productoNombre = o.optNullableStr("productoNombre"),
                        productoPrecio = precio,
                        detalles = o.optString("detalles", ""),
                        colores = o.optNullableStr("colores"),
                        tamano = o.optNullableStr("tamano"),
                        extras = o.optNullableStr("extras"),
                        fechaEntrega = o.optNullableStr("fechaEntrega"),
                        horaEntrega = o.optNullableStr("horaEntrega"),
                        estado = o.optString("estado", "pendiente"),
                    )
                )
            }
        }
    }

    private fun productosToJson(list: List<CatalogProduct>): JSONArray = JSONArray().apply {
        list.forEach { p ->
            put(JSONObject().apply {
                put("id", p.id)
                put("sku", p.sku)
                put("nombre", p.nombre)
                put("precio", p.precio)
                put("categoria", p.categoria)
                put("isActive", p.isActive)
            })
        }
    }

    private fun parseProductos(arr: JSONArray?): List<CatalogProduct> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    CatalogProduct(
                        id = o.optString("id", ""),
                        sku = o.optString("sku", ""),
                        nombre = o.optString("nombre", "Producto"),
                        precio = o.optDouble("precio", 0.0),
                        categoria = o.optString("categoria", "General"),
                        isActive = o.optBoolean("isActive", true),
                    )
                )
            }
        }
    }

    private fun suscriptoresToJson(list: List<Suscriptor>): JSONArray = JSONArray().apply {
        list.forEach { s ->
            put(JSONObject().apply {
                put("id", s.id)
                put("createdAt", s.createdAt)
                put("email", s.email)
                put("nombre", s.nombre ?: JSONObject.NULL)
                put("activo", s.activo)
            })
        }
    }

    private fun parseSuscriptores(arr: JSONArray?): List<Suscriptor> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Suscriptor(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        email = o.optString("email", ""),
                        nombre = o.optNullableStr("nombre"),
                        activo = o.optBoolean("activo", true),
                    )
                )
            }
        }
    }

    private fun usuariosToJson(list: List<UsuarioPerfil>): JSONArray = JSONArray().apply {
        list.forEach { u ->
            put(JSONObject().apply {
                put("id", u.id)
                put("createdAt", u.createdAt)
                put("email", u.email)
                put("nombre", u.nombre ?: JSONObject.NULL)
                put("telefono", u.telefono ?: JSONObject.NULL)
                put("rol", u.rol)
                put("direccion", u.direccion ?: JSONObject.NULL)
                put("distrito", u.distrito ?: JSONObject.NULL)
            })
        }
    }

    private fun parseUsuarios(arr: JSONArray?): List<UsuarioPerfil> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    UsuarioPerfil(
                        id = o.optString("id", ""),
                        createdAt = o.optString("createdAt", ""),
                        email = o.optString("email", ""),
                        nombre = o.optNullableStr("nombre"),
                        telefono = o.optNullableStr("telefono"),
                        rol = o.optString("rol", "user"),
                        direccion = o.optNullableStr("direccion"),
                        distrito = o.optNullableStr("distrito"),
                    )
                )
            }
        }
    }

    private fun mensajesToJson(list: List<MensajeContacto>): JSONArray = JSONArray().apply {
        list.forEach { m ->
            put(JSONObject().apply {
                put("id", m.id)
                put("createdAt", m.createdAt)
                put("nombre", m.nombre)
                put("email", m.email)
                put("telefono", m.telefono ?: JSONObject.NULL)
                put("asunto", m.asunto ?: JSONObject.NULL)
                put("mensaje", m.mensaje)
                put("leido", m.leido)
            })
        }
    }

    private fun parseMensajes(arr: JSONArray?): List<MensajeContacto> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    MensajeContacto(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        nombre = o.optString("nombre", "Visitante"),
                        email = o.optString("email", ""),
                        telefono = o.optNullableStr("telefono"),
                        asunto = o.optNullableStr("asunto"),
                        mensaje = o.optString("mensaje", ""),
                        leido = o.optBoolean("leido", false),
                    )
                )
            }
        }
    }

    private fun resenasToJson(list: List<Resena>): JSONArray = JSONArray().apply {
        list.forEach { r ->
            put(JSONObject().apply {
                put("id", r.id)
                put("createdAt", r.createdAt)
                put("productoNombre", r.productoNombre ?: JSONObject.NULL)
                put("nombreCliente", r.nombreCliente)
                put("calificacion", r.calificacion)
                put("comentario", r.comentario ?: JSONObject.NULL)
                put("aprobado", r.aprobado)
                put("esManual", r.esManual)
            })
        }
    }

    private fun parseResenas(arr: JSONArray?): List<Resena> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Resena(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        productoNombre = o.optNullableStr("productoNombre"),
                        nombreCliente = o.optString("nombreCliente", "Cliente"),
                        calificacion = o.optInt("calificacion", 5),
                        comentario = o.optNullableStr("comentario"),
                        aprobado = o.optBoolean("aprobado", false),
                        esManual = o.optBoolean("esManual", false),
                    )
                )
            }
        }
    }

    private fun reclamacionesToJson(list: List<Reclamacion>): JSONArray = JSONArray().apply {
        list.forEach { r ->
            put(JSONObject().apply {
                put("id", r.id)
                put("createdAt", r.createdAt)
                put("tipo", r.tipo)
                put("nombreCompleto", r.nombreCompleto)
                put("tipoDocumento", r.tipoDocumento)
                put("numeroDocumento", r.numeroDocumento)
                put("telefono", r.telefono)
                put("email", r.email)
                put("productoServicio", r.productoServicio)
                put("monto", r.monto)
                put("pedidoId", r.pedidoId ?: JSONObject.NULL)
                put("detalle", r.detalle)
            })
        }
    }

    private fun parseReclamaciones(arr: JSONArray?): List<Reclamacion> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Reclamacion(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        tipo = o.optString("tipo", "reclamo"),
                        nombreCompleto = o.optString("nombreCompleto", ""),
                        tipoDocumento = o.optString("tipoDocumento", "DNI"),
                        numeroDocumento = o.optString("numeroDocumento", ""),
                        telefono = o.optString("telefono", ""),
                        email = o.optString("email", ""),
                        productoServicio = o.optString("productoServicio", ""),
                        monto = o.optDouble("monto", 0.0),
                        pedidoId = o.optNullableStr("pedidoId"),
                        detalle = o.optString("detalle", ""),
                    )
                )
            }
        }
    }

    private fun alertsToJson(list: List<AdminAlertRow>): JSONArray = JSONArray().apply {
        list.forEach { a ->
            put(JSONObject().apply {
                put("id", a.id)
                put("createdAt", a.createdAt)
                put("tipo", a.tipo)
                put("titulo", a.titulo)
                put("cuerpo", a.cuerpo)
                put("url", a.url)
                put("seccion", a.seccion)
                put("sub", a.sub)
            })
        }
    }

    private fun parseAlerts(arr: JSONArray?): List<AdminAlertRow> {
        if (arr == null) return emptyList()
        return buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    AdminAlertRow(
                        id = o.optLong("id", 0L),
                        createdAt = o.optString("createdAt", ""),
                        tipo = o.optString("tipo", "general"),
                        titulo = o.optString("titulo", "Alerta"),
                        cuerpo = o.optString("cuerpo", ""),
                        url = o.optString("url", "/admin"),
                        seccion = o.optString("seccion", "pedidos"),
                        sub = o.optString("sub", "pedidos"),
                    )
                )
            }
        }
    }

    private fun JSONObject.optNullableStr(key: String): String? {
        if (!has(key) || isNull(key)) return null
        val v = optString(key, "").trim()
        return if (v.isEmpty() || v.equals("null", ignoreCase = true)) null else v
    }
}
