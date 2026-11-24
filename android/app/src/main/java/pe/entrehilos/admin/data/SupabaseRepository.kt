package pe.entrehilos.admin.data

import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import pe.entrehilos.admin.AlertPollScheduler
import pe.entrehilos.admin.AlertPrefs
import pe.entrehilos.admin.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit

class OfflineException(message: String = "Sin conexión a internet. Verifica tu red y vuelve a intentar.") :
    Exception(message)

class SessionExpiredException(message: String = "Tu sesión expiró. Vuelve a iniciar sesión.") :
    Exception(message)

class RepositoryException(message: String) : Exception(message)

object SupabaseRepository {

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    private val refreshMutex = Mutex()

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val baseUrl: String
        get() = BuildConfig.SUPABASE_URL.trimEnd('/')

    private val anonKey: String
        get() = BuildConfig.SUPABASE_ANON_KEY.trim()

    suspend fun signIn(context: Context, email: String, password: String): AdminSession =
        withContext(Dispatchers.IO) {
            val cleanEmail = email.trim()
            val payload = JSONObject().apply {
                put("email", cleanEmail)
                put("password", password)
            }

            val req = Request.Builder()
                .url("$baseUrl/auth/v1/token?grant_type=password")
                .post(payload.toString().toRequestBody(jsonMedia))
                .addHeader("apikey", anonKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "application/json")
                .build()

            val (code, body) = executeRaw(req)
            val json = try {
                JSONObject(body)
            } catch (_: Exception) {
                JSONObject()
            }

            if (code !in 200..299) {
                val rawErr = json.optCleanString(
                    "msg",
                    json.optCleanString(
                        "error_description",
                        json.optCleanString("error", "Credenciales incorrectas.")
                    )
                )
                val friendly = when {
                    rawErr.contains("Invalid login credentials", ignoreCase = true) ->
                        "Correo o contraseña incorrectos."
                    rawErr.contains("Email not confirmed", ignoreCase = true) ->
                        "Confirma tu correo antes de ingresar."
                    else -> rawErr
                }
                throw RepositoryException(friendly)
            }

            val accessToken = json.optCleanString("access_token")
            val refreshToken = json.optCleanString("refresh_token")
            val expiresIn = json.optLong("expires_in", 3600L)
            val expiresAt = (System.currentTimeMillis() / 1000L) + expiresIn
            val userObj = json.optJSONObject("user") ?: JSONObject()
            val userId = userObj.optCleanString("id")
            val userEmail = userObj.optCleanString("email", cleanEmail)
            val metaName = userObj.optJSONObject("user_metadata")?.optCleanString("full_name").orEmpty()

            if (accessToken.isEmpty() || refreshToken.isEmpty() || userId.isEmpty()) {
                throw RepositoryException("Respuesta de autenticación incompleta desde Supabase.")
            }

            val profileReq = Request.Builder()
                .url("$baseUrl/rest/v1/profiles?select=rol,nombre&id=eq.$userId&limit=1")
                .get()
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("Accept", "application/json")
                .build()

            val (pCode, pBody) = executeRaw(profileReq)
            if (pCode !in 200..299) {
                bestEffortLogout(accessToken)
                throw RepositoryException("No se pudo verificar el rol de administrador ($pCode).")
            }

            val arr = try {
                JSONArray(pBody)
            } catch (_: Exception) {
                JSONArray()
            }
            val profileObj = arr.optJSONObject(0)
            val rol = profileObj?.optCleanString("rol")?.lowercase().orEmpty()
            val nombre = profileObj?.optCleanString("nombre").orEmpty()
                .ifEmpty { metaName }
                .ifEmpty { userEmail.substringBefore("@") }

            if (rol != "admin" && rol != "super_admin") {
                bestEffortLogout(accessToken)
                throw RepositoryException("Solo cuentas con rol admin o super_admin pueden entrar a esta app.")
            }

            val session = AdminSession(
                accessToken = accessToken,
                refreshToken = refreshToken,
                expiresAtEpochSec = expiresAt,
                userId = userId,
                email = userEmail,
                nombre = nombre,
                rol = rol
            )
            SessionStore.saveSession(context, session)
            session
        }

    suspend fun registerAlertDevice(context: Context): Boolean = withContext(Dispatchers.IO) {
        val deviceId = SessionStore.getOrCreateDeviceId(context)
        val deviceName = listOfNotNull(
            Build.MANUFACTURER?.trim()?.takeIf { it.isNotEmpty() },
            Build.MODEL?.trim()?.takeIf { it.isNotEmpty() },
            "Android ${Build.VERSION.RELEASE}"
        ).joinToString(" ").take(180)

        val params = JSONObject().apply {
            put("p_device_id", deviceId)
            put("p_device_name", deviceName)
            put("p_app_version", BuildConfig.VERSION_NAME)
        }

        val respBody = callRpc(context, "register_admin_alert_device", params)
        val json = JSONObject(respBody)
        val deviceSecret = json.optCleanString("device_secret")
        val latestAlertId = json.optLong("latest_alert_id", 0L)
        if (deviceSecret.isEmpty()) {
            throw RepositoryException("Supabase no devolvió secreto del dispositivo.")
        }

        AlertPrefs.saveConfig(
            context,
            baseUrl,
            anonKey,
            deviceId,
            deviceSecret,
            latestAlertId
        )
        AlertPollScheduler.start(context)
        true
    }

    suspend fun sendTestAlert(context: Context): Long = withContext(Dispatchers.IO) {
        if (!AlertPrefs.isEnabled(context)) {
            registerAlertDevice(context)
        }
        val body = callRpc(context, "send_admin_test_alert", JSONObject())
        val json = JSONObject(body)
        val id = json.optLong("id", 0L)
        AlertPollScheduler.pollNowAsync(context)
        id
    }

    suspend fun unregisterAndSignOut(context: Context) = withContext(Dispatchers.IO) {
        val session = SessionStore.getSession(context)
        val deviceId = SessionStore.getOrCreateDeviceId(context)

        if (session != null) {
            try {
                val payload = JSONObject().apply { put("p_device_id", deviceId) }
                callRpc(context, "unregister_admin_alert_device", payload)
            } catch (_: Exception) {
            }
            bestEffortLogout(session.accessToken)
        }

        AlertPollScheduler.stop(context)
        AlertPrefs.clear(context)
        SessionStore.clearSession(context)
    }

    suspend fun fetchPedidos(context: Context): List<Pedido> = withContext(Dispatchers.IO) {
        val select = "id,created_at,origen,usuario_id,cliente_nombre,cliente_telefono,cliente_email," +
            "direccion_envio,items,total,adelanto,saldo_pendiente,fecha_entrega,hora_entrega,metodo_pago,estado,notas"
        val body = authedGet(context, "/rest/v1/pedidos?select=$select&order=created_at.desc&limit=150")
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val notas = o.optNullableString("notas")
                val total = o.optDoubleOrZero("total")
                val adelanto = o.optDoubleOrZero("adelanto")
                val rawSaldo = if (o.has("saldo_pendiente") && !o.isNull("saldo_pendiente")) {
                    o.optDoubleOrZero("saldo_pendiente")
                } else {
                    (total - adelanto).coerceAtLeast(0.0)
                }
                add(
                    Pedido(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        origen = o.optCleanString("origen", "tienda"),
                        usuarioId = o.optNullableString("usuario_id"),
                        clienteNombre = o.optCleanString("cliente_nombre", "Cliente"),
                        clienteTelefono = o.optCleanString("cliente_telefono"),
                        clienteEmail = o.optNullableString("cliente_email"),
                        direccionEnvio = o.optCleanString("direccion_envio", "Coordinar por WhatsApp"),
                        items = parsePedidoItems(o.opt("items")),
                        total = total,
                        adelanto = adelanto,
                        saldoPendiente = rawSaldo,
                        fechaEntrega = o.optNullableString("fecha_entrega"),
                        horaEntrega = o.optNullableString("hora_entrega"),
                        metodoPago = o.optCleanString("metodo_pago", "yape"),
                        estado = o.optCleanString("estado", "pendiente"),
                        notas = notas,
                    )
                )
            }
        }
    }

    suspend fun fetchPersonalizados(context: Context): List<PedidoPersonalizado> =
        withContext(Dispatchers.IO) {
            val select = "id,created_at,nombre_cliente,telefono,email,producto_nombre," +
                "producto_precio,detalles,colores,tamano,extras,fecha_entrega,hora_entrega,estado"
            val body = authedGet(
                context,
                "/rest/v1/pedidos_personalizados?select=$select&order=created_at.desc&limit=150"
            )
            val arr = JSONArray(body)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val precio = if (o.has("producto_precio") && !o.isNull("producto_precio")) {
                        o.optDoubleOrZero("producto_precio")
                    } else null
                    add(
                        PedidoPersonalizado(
                            id = o.optLong("id", 0L),
                            createdAt = o.optCleanString("created_at"),
                            nombreCliente = o.optCleanString("nombre_cliente", "Cliente"),
                            telefono = o.optCleanString("telefono"),
                            email = o.optNullableString("email"),
                            productoNombre = o.optNullableString("producto_nombre"),
                            productoPrecio = precio,
                            detalles = o.optCleanString("detalles"),
                            colores = o.optNullableString("colores"),
                            tamano = o.optNullableString("tamano"),
                            extras = o.optNullableString("extras"),
                            fechaEntrega = o.optNullableString("fecha_entrega"),
                            horaEntrega = o.optNullableString("hora_entrega"),
                            estado = o.optCleanString("estado", "pendiente"),
                        )
                    )
                }
            }
        }

    suspend fun fetchProductos(context: Context): List<CatalogProduct> = withContext(Dispatchers.IO) {
        val body = try {
            authedGet(
                context,
                "/rest/v1/productos?select=id,sku,nombre,precio,categoria,is_active&order=nombre.asc&limit=300"
            )
        } catch (_: Exception) {
            return@withContext emptyList()
        }
        val arr = try {
            JSONArray(body)
        } catch (_: Exception) {
            return@withContext emptyList()
        }
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    CatalogProduct(
                        id = o.optCleanString("id"),
                        sku = o.optCleanString("sku"),
                        nombre = o.optCleanString("nombre", "Producto"),
                        precio = o.optDoubleOrZero("precio"),
                        categoria = o.optCleanString("categoria", "General"),
                        isActive = o.optBoolean("is_active", true),
                    )
                )
            }
        }.sortedWith(
            compareByDescending<CatalogProduct> { it.isActive }
                .thenBy(String.CASE_INSENSITIVE_ORDER) { it.nombre }
        )
    }

    suspend fun fetchSuscriptores(context: Context): List<Suscriptor> = withContext(Dispatchers.IO) {
        val body = authedGet(
            context,
            "/rest/v1/suscriptores?select=id,created_at,email,nombre,activo&order=created_at.desc&limit=200"
        )
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Suscriptor(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        email = o.optCleanString("email"),
                        nombre = o.optNullableString("nombre"),
                        activo = o.optBoolean("activo", true),
                    )
                )
            }
        }
    }

    suspend fun fetchUsuarios(context: Context): List<UsuarioPerfil> = withContext(Dispatchers.IO) {
        val body = authedGet(
            context,
            "/rest/v1/profiles?select=id,created_at,email,nombre,telefono,rol,direccion,distrito&order=created_at.desc&limit=250"
        )
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    UsuarioPerfil(
                        id = o.optCleanString("id"),
                        createdAt = o.optCleanString("created_at"),
                        email = o.optCleanString("email"),
                        nombre = o.optNullableString("nombre"),
                        telefono = o.optNullableString("telefono"),
                        rol = o.optCleanString("rol", "user"),
                        direccion = o.optNullableString("direccion"),
                        distrito = o.optNullableString("distrito"),
                    )
                )
            }
        }
    }

    suspend fun fetchMensajes(context: Context): List<MensajeContacto> = withContext(Dispatchers.IO) {
        val body = try {
            authedGet(
                context,
                "/rest/v1/mensajes_contacto?select=id,created_at,nombre,email,telefono,asunto,mensaje,leido&order=created_at.desc&limit=150"
            )
        } catch (e: RepositoryException) {
            if (e.message?.contains("PGRST205") == true || e.message?.contains("404") == true) {
                return@withContext emptyList()
            }
            throw e
        }
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    MensajeContacto(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        nombre = o.optCleanString("nombre", "Visitante"),
                        email = o.optCleanString("email"),
                        telefono = o.optNullableString("telefono"),
                        asunto = o.optNullableString("asunto"),
                        mensaje = o.optCleanString("mensaje"),
                        leido = o.optBoolean("leido", false),
                    )
                )
            }
        }
    }

    suspend fun fetchResenas(context: Context): List<Resena> = withContext(Dispatchers.IO) {
        val body = authedGet(
            context,
            "/rest/v1/resenas?select=id,created_at,producto_nombre,nombre_cliente,calificacion,comentario,aprobado,es_manual&order=created_at.desc&limit=150"
        )
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Resena(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        productoNombre = o.optNullableString("producto_nombre"),
                        nombreCliente = o.optCleanString("nombre_cliente", "Cliente"),
                        calificacion = o.optInt("calificacion", 5),
                        comentario = o.optNullableString("comentario"),
                        aprobado = o.optBoolean("aprobado", false),
                        esManual = o.optBoolean("es_manual", false),
                    )
                )
            }
        }
    }

    suspend fun fetchReclamaciones(context: Context): List<Reclamacion> = withContext(Dispatchers.IO) {
        val select = "id,created_at,tipo,nombre_completo,tipo_documento,numero_documento,telefono,email,producto_servicio,monto,pedido_id,detalle"
        val body = authedGet(
            context,
            "/rest/v1/libro_reclamaciones?select=$select&order=created_at.desc&limit=100"
        )
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    Reclamacion(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        tipo = o.optCleanString("tipo", "reclamo"),
                        nombreCompleto = o.optCleanString("nombre_completo"),
                        tipoDocumento = o.optCleanString("tipo_documento", "DNI"),
                        numeroDocumento = o.optCleanString("numero_documento"),
                        telefono = o.optCleanString("telefono"),
                        email = o.optCleanString("email"),
                        productoServicio = o.optCleanString("producto_servicio"),
                        monto = o.optDoubleOrZero("monto"),
                        pedidoId = o.optNullableString("pedido_id"),
                        detalle = o.optCleanString("detalle"),
                    )
                )
            }
        }
    }

    suspend fun fetchRecentAlerts(context: Context): List<AdminAlertRow> = withContext(Dispatchers.IO) {
        val body = try {
            authedGet(
                context,
                "/rest/v1/admin_alerts?select=id,created_at,tipo,titulo,cuerpo,url,seccion,sub&order=id.desc&limit=40"
            )
        } catch (e: RepositoryException) {
            if (e.message?.contains("PGRST205") == true || e.message?.contains("404") == true) {
                return@withContext emptyList()
            }
            throw e
        }
        val arr = JSONArray(body)
        buildList(arr.length()) {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    AdminAlertRow(
                        id = o.optLong("id", 0L),
                        createdAt = o.optCleanString("created_at"),
                        tipo = o.optCleanString("tipo", "general"),
                        titulo = o.optCleanString("titulo", "Alerta"),
                        cuerpo = o.optCleanString("cuerpo"),
                        url = o.optCleanString("url", "/admin"),
                        seccion = o.optCleanString("seccion", "pedidos"),
                        sub = o.optCleanString("sub", "pedidos"),
                    )
                )
            }
        }
    }

    suspend fun updatePedidoEstado(context: Context, pedidoId: Long, nuevoEstado: String) {
        val params = JSONObject().apply {
            put("p_pedido_id", pedidoId)
            put("p_estado", nuevoEstado)
        }
        callRpc(context, "admin_update_pedido_estado", params)
    }

    suspend fun updatePersonalizadoEstado(context: Context, pedidoId: Long, nuevoEstado: String) {
        val params = JSONObject().apply {
            put("p_pedido_id", pedidoId)
            put("p_estado", nuevoEstado)
        }
        callRpc(context, "admin_update_personalizado_estado", params)
    }

    suspend fun actualizarPedido(
        context: Context,
        pedidoId: Long,
        clienteNombre: String,
        clienteTelefono: String,
        clienteEmail: String?,
        usuarioId: String?,
        direccionEnvio: String?,
        estado: String,
        metodoPago: String,
        adelanto: Double,
        fechaEntregaYmd: String?,
        horaEntrega: String?,
        notas: String?,
        total: Double = 0.0,
    ) = withContext(Dispatchers.IO) {
        val params = JSONObject().apply {
            put("p_pedido_id", pedidoId)
            put("p_cliente_nombre", clienteNombre.trim())
            put("p_cliente_telefono", clienteTelefono.trim())
            put("p_cliente_email", clienteEmail?.trim().orEmpty())
            put("p_usuario_id", usuarioId?.trim().orEmpty())
            put("p_direccion_envio", direccionEnvio?.trim().orEmpty())
            put("p_estado", estado)
            put("p_metodo_pago", metodoPago)
            put("p_adelanto", adelanto)
            put("p_fecha_entrega", fechaEntregaYmd?.trim().orEmpty())
            put("p_hora_entrega", horaEntrega?.trim().orEmpty())
            put("p_notas", notas?.trim().orEmpty())
        }
        try {
            callRpc(context, "admin_actualizar_pedido", params)
        } catch (e: RepositoryException) {
            if (!isMissingRpcError(e)) throw e
            val cleanAdelanto = adelanto.coerceAtLeast(0.0)
            val cleanFecha = fechaEntregaYmd?.trim()?.takeIf { Regex("^\\d{4}-\\d{2}-\\d{2}").containsMatchIn(it) }
                ?.take(10)
            val patch = JSONObject().apply {
                put("cliente_nombre", clienteNombre.trim())
                put("cliente_telefono", clienteTelefono.trim())
                if (!clienteEmail.isNullOrBlank()) {
                    put("cliente_email", clienteEmail.trim())
                }
                if (!usuarioId.isNullOrBlank()) {
                    put("usuario_id", usuarioId.trim())
                }
                put("direccion_envio", direccionEnvio?.trim()?.ifEmpty { null } ?: "Coordinar por WhatsApp")
                put("estado", estado.trim().lowercase())
                put("metodo_pago", metodoPago.trim().lowercase().ifEmpty { "yape" })
                put("adelanto", cleanAdelanto)
                if (total > 0.0) {
                    put("saldo_pendiente", (total - cleanAdelanto).coerceAtLeast(0.0))
                }
                put("fecha_entrega", if (cleanFecha != null) "${cleanFecha}T12:00:00-05:00" else JSONObject.NULL)
                put("hora_entrega", horaEntrega?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("notas", notas?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
            }
            authedPatch(context, "/rest/v1/pedidos?id=eq.$pedidoId", patch.toString())
        }
    }

    suspend fun actualizarPersonalizado(
        context: Context,
        pedidoId: Long,
        nombreCliente: String,
        telefono: String,
        email: String?,
        productoNombre: String?,
        productoPrecio: Double?,
        detalles: String,
        colores: String?,
        tamano: String?,
        extras: String?,
        fechaEntregaYmd: String,
        horaEntrega: String?,
        estado: String,
    ) = withContext(Dispatchers.IO) {
        val params = JSONObject().apply {
            put("p_pedido_id", pedidoId)
            put("p_nombre_cliente", nombreCliente.trim())
            put("p_telefono", telefono.trim())
            put("p_email", email?.trim().orEmpty())
            put("p_producto_nombre", productoNombre?.trim().orEmpty())
            if (productoPrecio != null && productoPrecio > 0.0) {
                put("p_producto_precio", productoPrecio)
            } else {
                put("p_producto_precio", JSONObject.NULL)
            }
            put("p_detalles", detalles.trim())
            put("p_colores", colores?.trim().orEmpty())
            put("p_tamano", tamano?.trim().orEmpty())
            put("p_extras", extras?.trim().orEmpty())
            put("p_fecha_entrega", fechaEntregaYmd.trim())
            put("p_hora_entrega", horaEntrega?.trim().orEmpty())
            put("p_estado", estado)
        }
        try {
            callRpc(context, "admin_actualizar_personalizado", params)
        } catch (e: RepositoryException) {
            if (!isMissingRpcError(e)) throw e
            val patch = JSONObject().apply {
                put("nombre_cliente", nombreCliente.trim())
                put("telefono", telefono.trim())
                put("email", email?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("producto_nombre", productoNombre?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                if (productoPrecio != null && productoPrecio > 0.0) {
                    put("producto_precio", productoPrecio)
                } else {
                    put("producto_precio", JSONObject.NULL)
                }
                put("detalles", detalles.trim())
                put("colores", colores?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("tamano", tamano?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("extras", extras?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("fecha_entrega", fechaEntregaYmd.trim())
                put("hora_entrega", horaEntrega?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
                put("estado", estado.trim().lowercase())
            }
            authedPatch(context, "/rest/v1/pedidos_personalizados?id=eq.$pedidoId", patch.toString())
        }
    }

    suspend fun deletePedido(context: Context, pedidoId: Long) = withContext(Dispatchers.IO) {
        val params = JSONObject().apply { put("p_pedido_id", pedidoId) }
        try {
            callRpc(context, "admin_eliminar_pedido", params)
        } catch (e: RepositoryException) {
            if (!isMissingRpcError(e)) throw e
            authedDelete(context, "/rest/v1/pedidos?id=eq.$pedidoId")
        }
    }

    suspend fun deletePersonalizado(context: Context, pedidoId: Long) = withContext(Dispatchers.IO) {
        val params = JSONObject().apply { put("p_pedido_id", pedidoId) }
        try {
            callRpc(context, "admin_eliminar_personalizado", params)
        } catch (e: RepositoryException) {
            if (!isMissingRpcError(e)) throw e
            authedDelete(context, "/rest/v1/pedidos_personalizados?id=eq.$pedidoId")
        }
    }

    suspend fun agendarPedido(
        context: Context,
        origen: String,
        usuarioId: String?,
        clienteNombre: String,
        clienteTelefono: String,
        clienteEmail: String?,
        direccionEnvio: String?,
        items: List<PedidoItem>,
        total: Double,
        adelanto: Double,
        fechaEntregaYmd: String?,
        horaEntrega: String?,
        metodoPago: String,
        estado: String,
        notas: String?,
    ): Long {
        val itemsArray = JSONArray().apply {
            items.forEachIndexed { idx, it ->
                put(
                    JSONObject().apply {
                        put("id", "nat-${System.currentTimeMillis()}-$idx")
                        put("nombre", it.nombre)
                        put("cantidad", it.cantidad)
                        put("precio", it.precio)
                    }
                )
            }
        }
        val params = JSONObject().apply {
            put("p_origen", origen)
            put("p_cliente_nombre", clienteNombre.trim())
            put("p_cliente_telefono", clienteTelefono.trim())
            put("p_cliente_email", clienteEmail?.trim().orEmpty())
            put("p_direccion_envio", direccionEnvio?.trim().orEmpty())
            put("p_items", itemsArray)
            put("p_total", total)
            put("p_adelanto", adelanto)
            put("p_fecha_entrega", fechaEntregaYmd?.trim().orEmpty())
            put("p_hora_entrega", horaEntrega?.trim().orEmpty())
            put("p_metodo_pago", metodoPago)
            put("p_estado", estado)
            put("p_notas", notas?.trim().orEmpty())
        }
        val body = callRpc(context, "admin_agendar_pedido", params)
        val json = JSONObject(body)
        val newId = json.optLong("id", 0L)
        if (newId > 0L && !usuarioId.isNullOrBlank() && json.optNullableString("usuario_id") == null) {
            try {
                val patch = JSONObject().apply { put("usuario_id", usuarioId.trim()) }
                authedPatch(context, "/rest/v1/pedidos?id=eq.$newId", patch.toString())
            } catch (_: Exception) {
            }
        }
        AlertPollScheduler.pollNowAsync(context)
        return newId
    }

    suspend fun agendarPersonalizado(
        context: Context,
        nombreCliente: String,
        telefono: String,
        email: String?,
        productoNombre: String?,
        productoPrecio: Double?,
        detalles: String,
        colores: String?,
        tamano: String?,
        extras: String?,
        fechaEntregaYmd: String,
        horaEntrega: String?,
        estado: String,
    ): Long {
        val params = JSONObject().apply {
            put("p_nombre_cliente", nombreCliente.trim())
            put("p_telefono", telefono.trim())
            put("p_email", email?.trim().orEmpty())
            put("p_producto_nombre", productoNombre?.trim().orEmpty())
            if (productoPrecio != null && productoPrecio > 0.0) {
                put("p_producto_precio", productoPrecio)
            } else {
                put("p_producto_precio", JSONObject.NULL)
            }
            put("p_detalles", detalles.trim())
            put("p_colores", colores?.trim().orEmpty())
            put("p_tamano", tamano?.trim().orEmpty())
            put("p_extras", extras?.trim().orEmpty())
            put("p_fecha_entrega", fechaEntregaYmd.trim())
            put("p_hora_entrega", horaEntrega?.trim().orEmpty())
            put("p_estado", estado)
        }
        val body = callRpc(context, "admin_agendar_personalizado", params)
        val json = JSONObject(body)
        AlertPollScheduler.pollNowAsync(context)
        return json.optLong("id", 0L)
    }

    suspend fun marcarMensajeLeido(context: Context, mensajeId: Long) {
        val payload = JSONObject().apply { put("leido", true) }
        authedPatch(context, "/rest/v1/mensajes_contacto?id=eq.$mensajeId", payload.toString())
    }

    suspend fun toggleAprobarResena(context: Context, resenaId: Long, nuevoAprobado: Boolean) {
        val payload = JSONObject().apply { put("aprobado", nuevoAprobado) }
        authedPatch(context, "/rest/v1/resenas?id=eq.$resenaId", payload.toString())
    }

    suspend fun verifyAdminPassword(context: Context, password: String): Unit = withContext(Dispatchers.IO) {
        val current = SessionStore.getSession(context) ?: throw SessionExpiredException()
        if (password.isBlank()) {
            throw RepositoryException("Ingresa tu contraseña de administrador.")
        }
        val payload = JSONObject().apply {
            put("email", current.email)
            put("password", password)
        }
        val req = Request.Builder()
            .url("$baseUrl/auth/v1/token?grant_type=password")
            .post(payload.toString().toRequestBody(jsonMedia))
            .addHeader("apikey", anonKey)
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .build()

        val (code, body) = executeRaw(req)
        if (code !in 200..299) {
            throw RepositoryException("Contraseña de administrador incorrecta.")
        }

        val json = try {
            JSONObject(body)
        } catch (_: Exception) {
            JSONObject()
        }
        val newAccess = json.optCleanString("access_token")
        val newRefresh = json.optCleanString("refresh_token", current.refreshToken)
        val expiresIn = json.optLong("expires_in", 3600L)
        if (newAccess.isNotEmpty()) {
            SessionStore.saveSession(
                context,
                current.copy(
                    accessToken = newAccess,
                    refreshToken = newRefresh,
                    expiresAtEpochSec = (System.currentTimeMillis() / 1000L) + expiresIn
                )
            )
        }
    }

    suspend fun deleteUsuario(
        context: Context,
        targetUserId: String,
        adminPassword: String,
        deleteOrders: Boolean,
    ): Unit = withContext(Dispatchers.IO) {
        verifyAdminPassword(context, adminPassword)
        val params = JSONObject().apply {
            put("p_target_user_id", targetUserId.trim())
            put("p_delete_orders", deleteOrders)
        }
        callRpc(context, "admin_eliminar_usuario", params)
    }

    suspend fun vincularPedidosAUsuario(
        context: Context,
        targetUserId: String,
        matchNombre: String,
        matchTelefono: String?,
        matchEmail: String?,
    ): Pair<Int, Int> = withContext(Dispatchers.IO) {
        val params = JSONObject().apply {
            put("p_target_user_id", targetUserId.trim())
            put("p_match_nombre", matchNombre.trim())
            put("p_match_telefono", matchTelefono?.trim().orEmpty())
            put("p_match_email", matchEmail?.trim().orEmpty())
        }
        val resp = callRpc(context, "admin_vincular_pedidos_a_usuario", params)
        val json = JSONObject(resp)
        json.optInt("updated_pedidos", 0) to json.optInt("updated_personalizados", 0)
    }

    suspend fun asignarCorreoCliente(
        context: Context,
        email: String,
        matchNombre: String,
        matchTelefono: String?,
        oldEmail: String?,
    ): Triple<Int, Int, Boolean> = withContext(Dispatchers.IO) {
        val params = JSONObject().apply {
            put("p_email", email.trim())
            put("p_match_nombre", matchNombre.trim())
            put("p_match_telefono", matchTelefono?.trim().orEmpty())
            put("p_old_email", oldEmail?.trim().orEmpty())
        }
        val resp = callRpc(context, "admin_asignar_correo_cliente", params)
        val json = JSONObject(resp)
        val linkedUid = json.optNullableString("linked_user_id")
        Triple(
            json.optInt("updated_pedidos", 0),
            json.optInt("updated_personalizados", 0),
            !linkedUid.isNullOrBlank()
        )
    }

    // --- Internals HTTP + Auto-refresh ---

    private suspend fun getValidSession(context: Context, forceRefresh: Boolean = false): AdminSession {
        val current = SessionStore.getSession(context) ?: throw SessionExpiredException()
        val nowSec = System.currentTimeMillis() / 1000L
        if (!forceRefresh && current.expiresAtEpochSec > nowSec + 60L) {
            return current
        }
        return refreshMutex.withLock {
            val latest = SessionStore.getSession(context) ?: throw SessionExpiredException()
            val checkSec = System.currentTimeMillis() / 1000L
            if (!forceRefresh && latest.expiresAtEpochSec > checkSec + 60L) {
                return@withLock latest
            }
            val payload = JSONObject().apply { put("refresh_token", latest.refreshToken) }
            val req = Request.Builder()
                .url("$baseUrl/auth/v1/token?grant_type=refresh_token")
                .post(payload.toString().toRequestBody(jsonMedia))
                .addHeader("apikey", anonKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "application/json")
                .build()
            val (code, body) = executeRaw(req)
            if (code !in 200..299) {
                SessionStore.clearSession(context)
                throw SessionExpiredException()
            }
            val json = JSONObject(body)
            val newAccess = json.optCleanString("access_token")
            val newRefresh = json.optCleanString("refresh_token", latest.refreshToken)
            val expiresIn = json.optLong("expires_in", 3600L)
            if (newAccess.isEmpty()) {
                SessionStore.clearSession(context)
                throw SessionExpiredException()
            }
            val updated = latest.copy(
                accessToken = newAccess,
                refreshToken = newRefresh,
                expiresAtEpochSec = (System.currentTimeMillis() / 1000L) + expiresIn
            )
            SessionStore.saveSession(context, updated)
            updated
        }
    }

    private suspend fun authedGet(context: Context, pathAndQuery: String): String =
        executeAuthed(context) { token ->
            Request.Builder()
                .url("$baseUrl$pathAndQuery")
                .get()
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Accept", "application/json")
                .build()
        }

    private suspend fun authedPatch(context: Context, pathAndQuery: String, jsonBody: String): String =
        executeAuthed(context) { token ->
            Request.Builder()
                .url("$baseUrl$pathAndQuery")
                .patch(jsonBody.toRequestBody(jsonMedia))
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .build()
        }

    private suspend fun authedDelete(context: Context, pathAndQuery: String): String =
        executeAuthed(context) { token ->
            Request.Builder()
                .url("$baseUrl$pathAndQuery")
                .delete()
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Prefer", "return=minimal")
                .build()
        }

    private suspend fun callRpc(context: Context, functionName: String, params: JSONObject): String =
        executeAuthed(context) { token ->
            Request.Builder()
                .url("$baseUrl/rest/v1/rpc/$functionName")
                .post(params.toString().toRequestBody(jsonMedia))
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "application/json")
                .build()
        }

    private suspend fun executeAuthed(
        context: Context,
        requestBuilder: (accessToken: String) -> Request,
    ): String = withContext(Dispatchers.IO) {
        var session = getValidSession(context, forceRefresh = false)
        var (code, body) = executeRaw(requestBuilder(session.accessToken))
        if (code == 401 || body.contains("JWT expired", ignoreCase = true) || body.contains("PGRST301")) {
            session = getValidSession(context, forceRefresh = true)
            val retry = executeRaw(requestBuilder(session.accessToken))
            code = retry.first
            body = retry.second
        }
        if (code == 401) {
            SessionStore.clearSession(context)
            throw SessionExpiredException()
        }
        if (code !in 200..299) {
            throw RepositoryException(parseSupabaseError(code, body))
        }
        body
    }

    private suspend fun executeRaw(request: Request): Pair<Int, String> = withContext(Dispatchers.IO) {
        try {
            httpClient.newCall(request).execute().use { response ->
                val respBody = response.body?.string().orEmpty()
                response.code to respBody
            }
        } catch (_: IOException) {
            throw OfflineException()
        }
    }

    private suspend fun bestEffortLogout(accessToken: String) = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("$baseUrl/auth/v1/logout")
                .post("{}".toRequestBody(jsonMedia))
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", "Bearer $accessToken")
                .build()
            httpClient.newCall(req).execute().close()
        } catch (_: Exception) {
        }
    }

    private fun isMissingRpcError(e: RepositoryException): Boolean {
        val m = e.message.orEmpty()
        return m.contains("PGRST202", ignoreCase = true) ||
            m.contains("Could not find the function", ignoreCase = true) ||
            m.contains("Falta ejecutar las migraciones", ignoreCase = true)
    }

    private fun parseSupabaseError(code: Int, body: String): String {
        val json = try {
            JSONObject(body)
        } catch (_: Exception) {
            null
        }
        val msg = json?.optCleanString("message")
            ?.ifEmpty { json.optCleanString("error_description") }
            ?.ifEmpty { json.optCleanString("error") }
            ?: body
        val errCode = json?.optCleanString("code").orEmpty()

        if (code == 404 && (msg.contains("Could not find the function", ignoreCase = true) || errCode == "PGRST202")) {
            return "Falta ejecutar las migraciones SQL 032–036 en Supabase SQL Editor."
        }
        if (errCode == "PGRST205") {
            return "PGRST205: $msg"
        }
        if (errCode == "42501" || msg.contains("forbidden", ignoreCase = true)) {
            return "Tu cuenta no tiene permisos de administrador para esta acción."
        }
        return msg.takeIf { it.isNotBlank() } ?: "Error Supabase ($code)"
    }
}
