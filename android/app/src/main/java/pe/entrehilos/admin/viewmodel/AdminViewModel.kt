package pe.entrehilos.admin.viewmodel

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pe.entrehilos.admin.AlertPollScheduler
import pe.entrehilos.admin.AlertPoller
import pe.entrehilos.admin.AlertPrefs
import pe.entrehilos.admin.MainActivity
import pe.entrehilos.admin.NotificationHelper
import pe.entrehilos.admin.data.AdminAlertRow
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.AdminSession
import pe.entrehilos.admin.data.CatalogProduct
import pe.entrehilos.admin.data.ClientAccountItem
import pe.entrehilos.admin.data.DirectoryClient
import pe.entrehilos.admin.data.ForegroundAlertEvent
import pe.entrehilos.admin.data.MensajeContacto
import pe.entrehilos.admin.data.NotificationTarget
import pe.entrehilos.admin.data.OfflineException
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoItem
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.data.Reclamacion
import pe.entrehilos.admin.data.Resena
import pe.entrehilos.admin.data.SessionExpiredException
import pe.entrehilos.admin.data.SessionStore
import pe.entrehilos.admin.data.SupabaseRepository
import pe.entrehilos.admin.data.Suscriptor
import pe.entrehilos.admin.data.UsuarioPerfil

enum class MainTab(val label: String) {
    DASHBOARD("Inicio"),
    PEDIDOS("Pedidos"),
    CLIENTES("Clientes"),
    ALERTAS("Alertas"),
}

enum class PedidosSubTab(val label: String) {
    TIENDA("Tienda"),
    PERSONALIZADOS("Personalizados"),
}

enum class ClientesSubTab(val label: String) {
    SUSCRIPTORES("Susc."),
    USUARIOS("Usuarios"),
    MENSAJES("Msjs"),
    RESENAS("Reseñas"),
    RECLAMACIONES("Reclamos"),
}

data class AdminUiState(
    val session: AdminSession? = null,
    val loginLoading: Boolean = false,
    val loginError: String? = null,
    val activeTab: MainTab = MainTab.DASHBOARD,
    val pedidosSubTab: PedidosSubTab = PedidosSubTab.TIENDA,
    val clientesSubTab: ClientesSubTab = ClientesSubTab.SUSCRIPTORES,
    val isLoading: Boolean = false,
    val isMutating: Boolean = false,
    val isOffline: Boolean = false,
    val errorBanner: String? = null,
    val pedidos: List<Pedido> = emptyList(),
    val personalizados: List<PedidoPersonalizado> = emptyList(),
    val productos: List<CatalogProduct> = emptyList(),
    val suscriptores: List<Suscriptor> = emptyList(),
    val usuarios: List<UsuarioPerfil> = emptyList(),
    val mensajes: List<MensajeContacto> = emptyList(),
    val resenas: List<Resena> = emptyList(),
    val reclamaciones: List<Reclamacion> = emptyList(),
    val recentAlerts: List<AdminAlertRow> = emptyList(),
    val clientesDirectory: List<DirectoryClient> = emptyList(),
    val clientAccounts: List<ClientAccountItem> = emptyList(),
    val pedidosSearch: String = "",
    val pedidosEstadoFilter: String = "todos",
    val pedidosCanalFilter: String = "todos",
    val pedidosPagoFilter: String = "todos",
    val clientesSearch: String = "",
    val selectedPedido: Pedido? = null,
    val selectedPersonalizado: PedidoPersonalizado? = null,
    val showAgendarPedido: Boolean = false,
    val showAgendarPersonalizado: Boolean = false,
    val prefilledClientForOrder: DirectoryClient? = null,
    val notificationGranted: Boolean = false,
    val isSilentPollingEnabled: Boolean = false,
    val exactAlarmsAllowed: Boolean = true,
    val batteryIgnored: Boolean = false,
    val lastSyncLabel: String = "Pendiente",
    val foregroundBanner: ForegroundAlertEvent? = null,
    val snackbarMessage: String? = null,
)

class AdminViewModel(application: Application) : AndroidViewModel(application) {

    private val appContext: Context
        get() = getApplication<Application>().applicationContext

    private val _uiState = MutableStateFlow(
        AdminUiState(session = SessionStore.getSession(application.applicationContext))
    )
    val uiState: StateFlow<AdminUiState> = _uiState.asStateFlow()

    private var foregroundPollJob: Job? = null
    private var productosLoadedAtMs: Long = 0L
    private var lastSilentLoadAtMs: Long = 0L

    init {
        NotificationHelper.clearLegacyServiceNotification(appContext)
        refreshSystemStatus()

        if (_uiState.value.session != null) {
            if (AlertPrefs.isEnabled(appContext)) {
                AlertPollScheduler.start(appContext)
                AlertPollScheduler.pollNowAsync(appContext)
            }
            ensureDeviceRegistered()
            loadAllData(force = true)
        }

        viewModelScope.launch {
            MainActivity.foregroundAlerts.collect { alert ->
                if (_uiState.value.session != null) {
                    _uiState.update { it.copy(foregroundBanner = alert) }
                    loadAllData(silent = true, force = true)
                    refreshSystemStatus()
                }
            }
        }

        viewModelScope.launch {
            MainActivity.navigationTargets.collect { target ->
                if (target != null && _uiState.value.session != null) {
                    openFromNotification(target)
                    MainActivity.consumeNavigationTarget()
                }
            }
        }
    }

    fun setAppInForeground(inForeground: Boolean) {
        if (inForeground) {
            refreshSystemStatus()
            if (_uiState.value.session != null && foregroundPollJob?.isActive != true) {
                foregroundPollJob = viewModelScope.launch {
                    while (isActive) {
                        if (_uiState.value.session != null && AlertPrefs.isEnabled(appContext)) {
                            withContext(Dispatchers.IO) {
                                AlertPoller.pollOnce(appContext)
                            }
                            refreshSystemStatus()
                        }
                        delay(30_000L)
                    }
                }
            }
        } else {
            foregroundPollJob?.cancel()
            foregroundPollJob = null
        }
    }

    fun refreshSystemStatus() {
        val notifOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        val batteryOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(appContext.packageName) ?: true
        } else {
            true
        }

        val exactOk = AlertPollScheduler.canScheduleExactAlarms(appContext)
        val enabled = AlertPrefs.isEnabled(appContext)
        val lastSync = AdminFormatters.formatTimestampClock(AlertPrefs.getLastSyncAtMs(appContext))

        _uiState.update {
            it.copy(
                notificationGranted = notifOk,
                isSilentPollingEnabled = enabled,
                exactAlarmsAllowed = exactOk,
                batteryIgnored = batteryOk,
                lastSyncLabel = lastSync,
            )
        }
    }

    fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(loginError = "Ingresa tu correo y contraseña.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loginLoading = true, loginError = null) }
            try {
                val session = SupabaseRepository.signIn(appContext, email, password)
                _uiState.update {
                    it.copy(
                        session = session,
                        loginLoading = false,
                        loginError = null,
                        activeTab = MainTab.DASHBOARD,
                    )
                }
                ensureDeviceRegistered()
                loadAllData()
                setAppInForeground(true)
                MainActivity.navigationTargets.value?.let { pending ->
                    openFromNotification(pending)
                    MainActivity.consumeNavigationTarget()
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loginLoading = false,
                        loginError = e.message ?: "No se pudo iniciar sesión.",
                    )
                }
            }
        }
    }

    fun ensureDeviceRegistered(showFeedback: Boolean = false) {
        if (_uiState.value.session == null) return
        viewModelScope.launch {
            try {
                SupabaseRepository.registerAlertDevice(appContext)
                refreshSystemStatus()
                if (showFeedback) {
                    _uiState.update {
                        it.copy(snackbarMessage = "Alertas silenciosas sincronizadas con Supabase.")
                    }
                }
            } catch (e: Exception) {
                refreshSystemStatus()
                if (showFeedback) {
                    _uiState.update {
                        it.copy(snackbarMessage = e.message ?: "No se pudo sincronizar este celular.")
                    }
                }
            }
        }
    }

    fun syncAlertsNow() {
        if (_uiState.value.session == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                if (!AlertPrefs.isEnabled(appContext)) {
                    SupabaseRepository.registerAlertDevice(appContext)
                }
                withContext(Dispatchers.IO) {
                    AlertPoller.pollOnce(appContext)
                }
                loadRecentAlertsOnly()
                refreshSystemStatus()
                _uiState.update {
                    it.copy(isMutating = false, snackbarMessage = "Alertas sincronizadas ahora.")
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun sendTestAlert() {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                SupabaseRepository.sendTestAlert(appContext)
                refreshSystemStatus()
                loadRecentAlertsOnly()
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        snackbarMessage = "Alerta de prueba enviada desde Supabase."
                    )
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            foregroundPollJob?.cancel()
            foregroundPollJob = null
            productosLoadedAtMs = 0L
            lastSilentLoadAtMs = 0L
            SupabaseRepository.unregisterAndSignOut(appContext)
            _uiState.value = AdminUiState()
            refreshSystemStatus()
        }
    }

    fun loadAllData(silent: Boolean = false, force: Boolean = false) {
        if (_uiState.value.session == null) return
        val nowMs = System.currentTimeMillis()
        if (silent && !force && (nowMs - lastSilentLoadAtMs) < 20_000L) {
            return
        }
        viewModelScope.launch {
            if (!silent) {
                _uiState.update { it.copy(isLoading = true, errorBanner = null, isOffline = false) }
            }
            try {
                val cachedProducts = _uiState.value.productos
                val reuseProducts = !force && cachedProducts.isNotEmpty() && (nowMs - productosLoadedAtMs) < 600_000L

                coroutineScope {
                    val pedidosDef = async { SupabaseRepository.fetchPedidos(appContext) }
                    val persDef = async { SupabaseRepository.fetchPersonalizados(appContext) }
                    val productosDef = async {
                        if (reuseProducts) {
                            cachedProducts
                        } else {
                            runCatching { SupabaseRepository.fetchProductos(appContext) }.getOrDefault(emptyList())
                                .also { fetched ->
                                    if (fetched.isNotEmpty()) {
                                        productosLoadedAtMs = System.currentTimeMillis()
                                    }
                                }
                        }
                    }
                    val suscDef = async { SupabaseRepository.fetchSuscriptores(appContext) }
                    val usersDef = async { SupabaseRepository.fetchUsuarios(appContext) }
                    val msgsDef = async { runCatching { SupabaseRepository.fetchMensajes(appContext) }.getOrDefault(emptyList()) }
                    val resDef = async { runCatching { SupabaseRepository.fetchResenas(appContext) }.getOrDefault(emptyList()) }
                    val reclDef = async { runCatching { SupabaseRepository.fetchReclamaciones(appContext) }.getOrDefault(emptyList()) }
                    val alertsDef = async { runCatching { SupabaseRepository.fetchRecentAlerts(appContext) }.getOrDefault(emptyList()) }

                    val pedidos = pedidosDef.await()
                    val pers = persDef.await()
                    val productos = productosDef.await()
                    val susc = suscDef.await()
                    val users = usersDef.await()
                    val msgs = msgsDef.await()
                    val res = resDef.await()
                    val recl = reclDef.await()
                    val alerts = alertsDef.await()

                    lastSilentLoadAtMs = System.currentTimeMillis()
                    val directory = buildClientesDirectory(users, pedidos, pers)
                    val accounts = buildClientAccounts(users, pedidos, pers)

                    _uiState.update { state ->
                        val updatedSelectedPedido = state.selectedPedido?.let { sel ->
                            pedidos.find { it.id == sel.id } ?: sel
                        }
                        val updatedSelectedPers = state.selectedPersonalizado?.let { sel ->
                            pers.find { it.id == sel.id } ?: sel
                        }
                        state.copy(
                            isLoading = false,
                            isOffline = false,
                            errorBanner = null,
                            pedidos = pedidos,
                            personalizados = pers,
                            productos = productos,
                            suscriptores = susc,
                            usuarios = users,
                            mensajes = msgs,
                            resenas = res,
                            reclamaciones = recl,
                            recentAlerts = alerts,
                            clientesDirectory = directory,
                            clientAccounts = accounts,
                            selectedPedido = updatedSelectedPedido,
                            selectedPersonalizado = updatedSelectedPers,
                        )
                    }
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    private fun buildClientAccounts(
        usuarios: List<UsuarioPerfil>,
        pedidos: List<Pedido>,
        personalizados: List<PedidoPersonalizado>,
    ): List<ClientAccountItem> {
        val claimedPedidoIds = HashSet<Long>()
        val claimedPersIds = HashSet<Long>()

        val registered = usuarios.map { u ->
            val uEmail = u.email.trim().lowercase()
            val uTelDigits = u.telefono?.replace(Regex("\\D"), "")?.takeIf { it.length >= 7 }.orEmpty()

            val matchedPedidos = pedidos.filter { ped ->
                val pEmail = ped.clienteEmail?.trim()?.lowercase().orEmpty()
                val pTelDigits = ped.clienteTelefono.replace(Regex("\\D"), "")
                ped.usuarioId == u.id ||
                    (ped.usuarioId.isNullOrBlank() && (
                        (uEmail.isNotEmpty() && pEmail == uEmail) ||
                            (uTelDigits.isNotEmpty() && pTelDigits == uTelDigits)
                        ))
            }
            matchedPedidos.forEach { claimedPedidoIds.add(it.id) }

            val matchedPers = personalizados.filter { pers ->
                val sEmail = pers.email?.trim()?.lowercase().orEmpty()
                val sTelDigits = pers.telefono.replace(Regex("\\D"), "")
                (uEmail.isNotEmpty() && sEmail == uEmail) ||
                    (uTelDigits.isNotEmpty() && sTelDigits == uTelDigits)
            }
            matchedPers.forEach { claimedPersIds.add(it.id) }

            val displayName = u.nombre?.takeIf { it.isNotBlank() } ?: u.email.substringBefore("@")
            val dirFull = listOfNotNull(
                u.direccion?.takeIf { it.isNotBlank() },
                u.distrito?.takeIf { it.isNotBlank() }
            ).joinToString(" · ").takeIf { it.isNotBlank() }

            val totalGastado = matchedPedidos
                .filterNot { it.estado.equals("cancelado", ignoreCase = true) }
                .sumOf { it.total } +
                matchedPers
                    .filterNot { it.estado.equals("cancelado", ignoreCase = true) }
                    .sumOf { it.productoPrecio ?: 0.0 }

            ClientAccountItem(
                key = "reg:${u.id}",
                isRegistered = true,
                usuarioId = u.id,
                rol = u.rol,
                nombre = displayName,
                email = u.email.takeIf { it.isNotBlank() },
                telefono = u.telefono?.takeIf { it.isNotBlank() },
                direccion = dirFull,
                pedidos = matchedPedidos,
                personalizados = matchedPers,
                totalGastado = totalGastado,
                createdAt = u.createdAt,
            )
        }.sortedByDescending { it.createdAt }

        data class UnregBucket(
            var nombre: String,
            var email: String? = null,
            var telefono: String? = null,
            var direccion: String? = null,
            var latestCreatedAt: String = "",
            val pedidos: MutableList<Pedido> = mutableListOf(),
            val personalizados: MutableList<PedidoPersonalizado> = mutableListOf(),
        )

        val buckets = LinkedHashMap<String, UnregBucket>()

        fun resolveBucketKey(rawName: String, rawEmail: String?, rawPhone: String?): String {
            val normName = AdminFormatters.normalizeClientKey(rawName)
            val normEmail = rawEmail?.trim()?.lowercase().orEmpty()
            val telDigits = rawPhone?.replace(Regex("\\D"), "").orEmpty()
            val suffix = when {
                normName.isNotEmpty() -> normName
                normEmail.isNotEmpty() -> normEmail
                telDigits.length >= 7 -> telDigits
                else -> "anon"
            }
            return "unreg:$suffix"
        }

        pedidos.filter { it.id !in claimedPedidoIds }.forEach { ped ->
            val key = resolveBucketKey(ped.clienteNombre, ped.clienteEmail, ped.clienteTelefono)
            val cleanDir = ped.direccionEnvio.takeIf {
                it.isNotBlank() && !it.equals("Coordinar por WhatsApp", ignoreCase = true)
            }
            val bucket = buckets.getOrPut(key) {
                UnregBucket(
                    nombre = ped.clienteNombre.trim().ifEmpty { "Cliente" },
                    email = ped.clienteEmail?.takeIf { it.isNotBlank() },
                    telefono = ped.clienteTelefono.takeIf { it.isNotBlank() },
                    direccion = cleanDir,
                    latestCreatedAt = ped.createdAt,
                )
            }
            if (bucket.email.isNullOrBlank()) bucket.email = ped.clienteEmail?.takeIf { it.isNotBlank() }
            if (bucket.telefono.isNullOrBlank()) bucket.telefono = ped.clienteTelefono.takeIf { it.isNotBlank() }
            if (bucket.direccion.isNullOrBlank()) bucket.direccion = cleanDir
            if (ped.createdAt > bucket.latestCreatedAt) bucket.latestCreatedAt = ped.createdAt
            bucket.pedidos.add(ped)
        }

        personalizados.filter { it.id !in claimedPersIds }.forEach { pers ->
            val key = resolveBucketKey(pers.nombreCliente, pers.email, pers.telefono)
            val bucket = buckets.getOrPut(key) {
                UnregBucket(
                    nombre = pers.nombreCliente.trim().ifEmpty { "Cliente" },
                    email = pers.email?.takeIf { it.isNotBlank() },
                    telefono = pers.telefono.takeIf { it.isNotBlank() },
                    direccion = null,
                    latestCreatedAt = pers.createdAt,
                )
            }
            if (bucket.email.isNullOrBlank()) bucket.email = pers.email?.takeIf { it.isNotBlank() }
            if (bucket.telefono.isNullOrBlank()) bucket.telefono = pers.telefono.takeIf { it.isNotBlank() }
            if (pers.createdAt > bucket.latestCreatedAt) bucket.latestCreatedAt = pers.createdAt
            bucket.personalizados.add(pers)
        }

        val unregistered = buckets.entries.map { (key, b) ->
            val totalGastado = b.pedidos
                .filterNot { it.estado.equals("cancelado", ignoreCase = true) }
                .sumOf { it.total } +
                b.personalizados
                    .filterNot { it.estado.equals("cancelado", ignoreCase = true) }
                    .sumOf { it.productoPrecio ?: 0.0 }

            ClientAccountItem(
                key = key,
                isRegistered = false,
                usuarioId = null,
                rol = "sin_cuenta",
                nombre = b.nombre,
                email = b.email,
                telefono = b.telefono,
                direccion = b.direccion,
                pedidos = b.pedidos,
                personalizados = b.personalizados,
                totalGastado = totalGastado,
                createdAt = b.latestCreatedAt,
            )
        }.sortedWith(
            compareByDescending<ClientAccountItem> { it.totalPedidosCount }
                .thenBy(String.CASE_INSENSITIVE_ORDER) { it.nombre }
        )

        return registered + unregistered
    }

    private fun buildClientesDirectory(
        usuarios: List<UsuarioPerfil>,
        pedidos: List<Pedido>,
        personalizados: List<PedidoPersonalizado>,
    ): List<DirectoryClient> {
        val merged = LinkedHashMap<String, DirectoryClient>()

        fun addOrMerge(entry: DirectoryClient) {
            val cleanName = entry.nombre.trim()
            if (cleanName.isEmpty()) return
            val key = AdminFormatters.normalizeClientKey(cleanName)
            if (key.isEmpty()) return

            val existing = merged[key]
            if (existing == null) {
                merged[key] = entry.copy(key = key, nombre = cleanName)
            } else {
                val resolvedOrigin = when {
                    existing.origen == "Registrado" || entry.origen == "Registrado" -> "Registrado"
                    existing.origen == "Pedido" || entry.origen == "Pedido" -> "Pedido"
                    else -> existing.origen
                }
                merged[key] = existing.copy(
                    usuarioId = existing.usuarioId ?: entry.usuarioId,
                    telefono = existing.telefono?.takeIf { it.isNotBlank() } ?: entry.telefono,
                    email = existing.email?.takeIf { it.isNotBlank() } ?: entry.email,
                    direccion = existing.direccion?.takeIf { it.isNotBlank() } ?: entry.direccion,
                    origen = resolvedOrigin,
                )
            }
        }

        // 1. Usuarios registrados en profiles
        usuarios.forEach { u ->
            val display = u.nombre?.takeIf { it.isNotBlank() } ?: u.email.substringBefore("@")
            val dirFull = listOfNotNull(
                u.direccion?.takeIf { it.isNotBlank() },
                u.distrito?.takeIf { it.isNotBlank() }
            ).joinToString(" · ").takeIf { it.isNotBlank() }

            addOrMerge(
                DirectoryClient(
                    key = "",
                    usuarioId = u.id,
                    nombre = display,
                    telefono = u.telefono,
                    email = u.email,
                    direccion = dirFull,
                    origen = "Registrado",
                )
            )
        }

        // 2. Clientes con pedidos previos
        pedidos.forEach { ped ->
            val dir = ped.direccionEnvio.takeIf {
                it.isNotBlank() && !it.equals("Coordinar por WhatsApp", ignoreCase = true)
            }
            addOrMerge(
                DirectoryClient(
                    key = "",
                    usuarioId = ped.usuarioId,
                    nombre = ped.clienteNombre,
                    telefono = ped.clienteTelefono.takeIf { it.isNotBlank() },
                    email = ped.clienteEmail,
                    direccion = dir,
                    origen = "Pedido",
                )
            )
        }

        // 3. Clientes de pedidos personalizados
        personalizados.forEach { pers ->
            addOrMerge(
                DirectoryClient(
                    key = "",
                    usuarioId = null,
                    nombre = pers.nombreCliente,
                    telefono = pers.telefono.takeIf { it.isNotBlank() },
                    email = pers.email,
                    direccion = null,
                    origen = "Personalizado",
                )
            )
        }

        return merged.values.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.nombre })
    }

    private suspend fun loadRecentAlertsOnly() {
        try {
            val alerts = SupabaseRepository.fetchRecentAlerts(appContext)
            _uiState.update { it.copy(recentAlerts = alerts) }
        } catch (_: Exception) {
        }
    }

    fun selectMainTab(tab: MainTab) {
        _uiState.update { it.copy(activeTab = tab) }
        if (tab == MainTab.ALERTAS) {
            refreshSystemStatus()
        }
    }

    fun selectPedidosSubTab(sub: PedidosSubTab) {
        _uiState.update {
            it.copy(
                pedidosSubTab = sub,
                pedidosEstadoFilter = "todos",
                pedidosCanalFilter = "todos",
                pedidosPagoFilter = "todos",
            )
        }
    }

    fun selectClientesSubTab(sub: ClientesSubTab) {
        _uiState.update { it.copy(clientesSubTab = sub) }
    }

    fun updatePedidosSearch(query: String) {
        _uiState.update { it.copy(pedidosSearch = query) }
    }

    fun updatePedidosEstadoFilter(filter: String) {
        _uiState.update { it.copy(pedidosEstadoFilter = filter) }
    }

    fun updatePedidosCanalFilter(canal: String) {
        _uiState.update { it.copy(pedidosCanalFilter = canal) }
    }

    fun updatePedidosPagoFilter(pago: String) {
        _uiState.update { it.copy(pedidosPagoFilter = pago) }
    }

    fun clearPedidosFilters() {
        _uiState.update {
            it.copy(
                pedidosSearch = "",
                pedidosEstadoFilter = "todos",
                pedidosCanalFilter = "todos",
                pedidosPagoFilter = "todos",
            )
        }
    }

    fun updateClientesSearch(query: String) {
        _uiState.update { it.copy(clientesSearch = query) }
    }

    fun openPedidoDetail(pedido: Pedido?) {
        _uiState.update { it.copy(selectedPedido = pedido) }
    }

    fun openPersonalizadoDetail(pedido: PedidoPersonalizado?) {
        _uiState.update { it.copy(selectedPersonalizado = pedido) }
    }

    fun setShowAgendarPedido(show: Boolean) {
        _uiState.update {
            it.copy(
                showAgendarPedido = show,
                prefilledClientForOrder = if (show) it.prefilledClientForOrder else null,
            )
        }
        if (show && (_uiState.value.productos.isEmpty() || _uiState.value.clientesDirectory.isEmpty())) {
            loadAllData(silent = true)
        }
    }

    fun openAgendarPedidoForClient(client: DirectoryClient) {
        _uiState.update {
            it.copy(
                prefilledClientForOrder = client,
                showAgendarPedido = true,
            )
        }
        if (_uiState.value.productos.isEmpty() || _uiState.value.clientesDirectory.isEmpty()) {
            loadAllData(silent = true)
        }
    }

    fun setShowAgendarPersonalizado(show: Boolean) {
        _uiState.update { it.copy(showAgendarPersonalizado = show) }
        if (show && (_uiState.value.productos.isEmpty() || _uiState.value.clientesDirectory.isEmpty())) {
            loadAllData(silent = true)
        }
    }

    fun dismissForegroundBanner() {
        _uiState.update { it.copy(foregroundBanner = null) }
    }

    fun consumeSnackbar() {
        _uiState.update { it.copy(snackbarMessage = null) }
    }

    fun openFromNotification(target: NotificationTarget) {
        val seccion = target.seccion.lowercase()
        val sub = target.sub.lowercase()

        when (seccion) {
            "clientes", "atencion" -> {
                val cSub = when (sub) {
                    "usuarios" -> ClientesSubTab.USUARIOS
                    "mensajes" -> ClientesSubTab.MENSAJES
                    "resenas" -> ClientesSubTab.RESENAS
                    "reclamaciones" -> ClientesSubTab.RECLAMACIONES
                    else -> ClientesSubTab.SUSCRIPTORES
                }
                _uiState.update {
                    it.copy(
                        activeTab = MainTab.CLIENTES,
                        clientesSubTab = cSub,
                        foregroundBanner = null,
                    )
                }
            }
            "pedidos" -> {
                val pSub = if (sub == "personalizados") {
                    PedidosSubTab.PERSONALIZADOS
                } else {
                    PedidosSubTab.TIENDA
                }
                _uiState.update {
                    it.copy(
                        activeTab = MainTab.PEDIDOS,
                        pedidosSubTab = pSub,
                        foregroundBanner = null,
                    )
                }
            }
            "dashboard" -> {
                _uiState.update { it.copy(activeTab = MainTab.DASHBOARD, foregroundBanner = null) }
            }
            else -> {
                _uiState.update {
                    it.copy(
                        activeTab = MainTab.PEDIDOS,
                        pedidosSubTab = PedidosSubTab.TIENDA,
                        foregroundBanner = null,
                    )
                }
            }
        }
        loadAllData(silent = true, force = true)
    }

    fun openAlertRow(row: AdminAlertRow) {
        openFromNotification(NotificationTarget(row.seccion, row.sub, row.url))
    }

    fun updatePedidoEstado(pedidoId: Long, nuevoEstado: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.updatePedidoEstado(appContext, pedidoId, nuevoEstado)
                _uiState.update { state ->
                    val nextPedidos = state.pedidos.map {
                        if (it.id == pedidoId) it.copy(estado = nuevoEstado) else it
                    }
                    state.copy(
                        isMutating = false,
                        errorBanner = null,
                        pedidos = nextPedidos,
                        clientAccounts = buildClientAccounts(state.usuarios, nextPedidos, state.personalizados),
                        selectedPedido = state.selectedPedido?.let {
                            if (it.id == pedidoId) it.copy(estado = nuevoEstado) else it
                        },
                        snackbarMessage = "Pedido #$pedidoId actualizado a \"$nuevoEstado\"."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun updatePersonalizadoEstado(pedidoId: Long, nuevoEstado: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.updatePersonalizadoEstado(appContext, pedidoId, nuevoEstado)
                _uiState.update { state ->
                    val nextPers = state.personalizados.map {
                        if (it.id == pedidoId) it.copy(estado = nuevoEstado) else it
                    }
                    state.copy(
                        isMutating = false,
                        errorBanner = null,
                        personalizados = nextPers,
                        clientAccounts = buildClientAccounts(state.usuarios, state.pedidos, nextPers),
                        selectedPersonalizado = state.selectedPersonalizado?.let {
                            if (it.id == pedidoId) it.copy(estado = nuevoEstado) else it
                        },
                        snackbarMessage = "Personalizado #$pedidoId actualizado a \"$nuevoEstado\"."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun deletePedido(pedidoId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.deletePedido(appContext, pedidoId)
                _uiState.update { state ->
                    val nextPedidos = state.pedidos.filterNot { it.id == pedidoId }
                    state.copy(
                        isMutating = false,
                        errorBanner = null,
                        pedidos = nextPedidos,
                        clientAccounts = buildClientAccounts(state.usuarios, nextPedidos, state.personalizados),
                        selectedPedido = if (state.selectedPedido?.id == pedidoId) null else state.selectedPedido,
                        snackbarMessage = "Pedido #$pedidoId eliminado permanentemente."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun deletePersonalizado(pedidoId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.deletePersonalizado(appContext, pedidoId)
                _uiState.update { state ->
                    val nextPers = state.personalizados.filterNot { it.id == pedidoId }
                    state.copy(
                        isMutating = false,
                        errorBanner = null,
                        personalizados = nextPers,
                        clientAccounts = buildClientAccounts(state.usuarios, state.pedidos, nextPers),
                        selectedPersonalizado = if (state.selectedPersonalizado?.id == pedidoId) null else state.selectedPersonalizado,
                        snackbarMessage = "Personalizado #$pedidoId eliminado permanentemente."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun actualizarPedido(
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
    ) {
        val existingTotal = _uiState.value.pedidos.find { it.id == pedidoId }?.total ?: 0.0
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.actualizarPedido(
                    context = appContext,
                    pedidoId = pedidoId,
                    clienteNombre = clienteNombre,
                    clienteTelefono = clienteTelefono,
                    clienteEmail = clienteEmail,
                    usuarioId = usuarioId,
                    direccionEnvio = direccionEnvio,
                    estado = estado,
                    metodoPago = metodoPago,
                    adelanto = adelanto,
                    fechaEntregaYmd = fechaEntregaYmd,
                    horaEntrega = horaEntrega,
                    notas = notas,
                    total = existingTotal,
                )
                loadAllData(silent = true, force = true)
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        errorBanner = null,
                        snackbarMessage = "Cambios del pedido #$pedidoId guardados."
                    )
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun actualizarPersonalizado(
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
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                SupabaseRepository.actualizarPersonalizado(
                    context = appContext,
                    pedidoId = pedidoId,
                    nombreCliente = nombreCliente,
                    telefono = telefono,
                    email = email,
                    productoNombre = productoNombre,
                    productoPrecio = productoPrecio,
                    detalles = detalles,
                    colores = colores,
                    tamano = tamano,
                    extras = extras,
                    fechaEntregaYmd = fechaEntregaYmd,
                    horaEntrega = horaEntrega,
                    estado = estado,
                )
                loadAllData(silent = true, force = true)
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        snackbarMessage = "Personalizado #$pedidoId actualizado."
                    )
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun agendarPedido(
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
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                val newId = SupabaseRepository.agendarPedido(
                    context = appContext,
                    origen = origen,
                    usuarioId = usuarioId,
                    clienteNombre = clienteNombre,
                    clienteTelefono = clienteTelefono,
                    clienteEmail = clienteEmail,
                    direccionEnvio = direccionEnvio,
                    items = items,
                    total = total,
                    adelanto = adelanto,
                    fechaEntregaYmd = fechaEntregaYmd,
                    horaEntrega = horaEntrega,
                    metodoPago = metodoPago,
                    estado = estado,
                    notas = notas,
                )
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        showAgendarPedido = false,
                        prefilledClientForOrder = null,
                        snackbarMessage = "Pedido #$newId agendado correctamente."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun agendarPersonalizado(
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
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                val newId = SupabaseRepository.agendarPersonalizado(
                    context = appContext,
                    nombreCliente = nombreCliente,
                    telefono = telefono,
                    email = email,
                    productoNombre = productoNombre,
                    productoPrecio = productoPrecio,
                    detalles = detalles,
                    colores = colores,
                    tamano = tamano,
                    extras = extras,
                    fechaEntregaYmd = fechaEntregaYmd,
                    horaEntrega = horaEntrega,
                    estado = estado,
                )
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        showAgendarPersonalizado = false,
                        snackbarMessage = "Encargo personalizado #$newId guardado."
                    )
                }
                loadAllData(silent = true, force = true)
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun marcarMensajeLeido(mensajeId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                SupabaseRepository.marcarMensajeLeido(appContext, mensajeId)
                loadAllData(silent = true, force = true)
                _uiState.update {
                    it.copy(isMutating = false, snackbarMessage = "Mensaje marcado como leído.")
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun toggleAprobarResena(resena: Resena) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true) }
            try {
                val next = !resena.aprobado
                SupabaseRepository.toggleAprobarResena(appContext, resena.id, next)
                loadAllData(silent = true, force = true)
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        snackbarMessage = if (next) "Reseña aprobada y visible en tienda." else "Reseña ocultada."
                    )
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }

    fun deleteUsuario(
        targetUserId: String,
        adminPassword: String,
        deleteOrders: Boolean,
        onResult: (String?) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                SupabaseRepository.deleteUsuario(
                    context = appContext,
                    targetUserId = targetUserId,
                    adminPassword = adminPassword,
                    deleteOrders = deleteOrders,
                )
                _uiState.update { state ->
                    val nextUsers = state.usuarios.filterNot { it.id == targetUserId }
                    val nextPedidos = if (deleteOrders) {
                        state.pedidos.filterNot { it.usuarioId == targetUserId }
                    } else {
                        state.pedidos.map {
                            if (it.usuarioId == targetUserId) it.copy(usuarioId = null) else it
                        }
                    }
                    state.copy(
                        isMutating = false,
                        errorBanner = null,
                        usuarios = nextUsers,
                        pedidos = nextPedidos,
                        clientesDirectory = buildClientesDirectory(nextUsers, nextPedidos, state.personalizados),
                        clientAccounts = buildClientAccounts(nextUsers, nextPedidos, state.personalizados),
                        snackbarMessage = "Usuario eliminado permanentemente."
                    )
                }
                loadAllData(silent = true, force = true)
                onResult(null)
            } catch (e: Exception) {
                _uiState.update { it.copy(isMutating = false) }
                if (e is SessionExpiredException) {
                    handleError(e)
                }
                onResult(e.message ?: "No se pudo eliminar el usuario.")
            }
        }
    }

    fun vincularPedidosAUsuario(
        targetUserId: String,
        matchNombre: String,
        matchTelefono: String?,
        matchEmail: String?,
        onResult: (String?) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                val (pedCount, persCount) = SupabaseRepository.vincularPedidosAUsuario(
                    context = appContext,
                    targetUserId = targetUserId,
                    matchNombre = matchNombre,
                    matchTelefono = matchTelefono,
                    matchEmail = matchEmail,
                )
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        errorBanner = null,
                        snackbarMessage = "Sincronizado: $pedCount pedido(s) y $persCount personalizado(s) vinculados."
                    )
                }
                loadAllData(silent = true, force = true)
                onResult(null)
            } catch (e: Exception) {
                _uiState.update { it.copy(isMutating = false) }
                if (e is SessionExpiredException) {
                    handleError(e)
                }
                onResult(e.message ?: "No se pudieron vincular los pedidos.")
            }
        }
    }

    fun asignarCorreoCliente(
        email: String,
        matchNombre: String,
        matchTelefono: String?,
        oldEmail: String?,
        onResult: (String?) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isMutating = true, errorBanner = null) }
            try {
                val (pedCount, persCount, linkedNow) = SupabaseRepository.asignarCorreoCliente(
                    context = appContext,
                    email = email,
                    matchNombre = matchNombre,
                    matchTelefono = matchTelefono,
                    oldEmail = oldEmail,
                )
                val msg = if (linkedNow) {
                    "Correo guardado y vinculado de inmediato a su cuenta ($pedCount ped., $persCount pers.)."
                } else {
                    "Correo guardado ($pedCount ped., $persCount pers.). Se sincronizará solo al registrarse."
                }
                _uiState.update {
                    it.copy(
                        isMutating = false,
                        errorBanner = null,
                        snackbarMessage = msg
                    )
                }
                loadAllData(silent = true, force = true)
                onResult(null)
            } catch (e: Exception) {
                _uiState.update { it.copy(isMutating = false) }
                if (e is SessionExpiredException) {
                    handleError(e)
                }
                onResult(e.message ?: "No se pudo guardar el correo del cliente.")
            }
        }
    }

    private fun handleError(e: Exception) {
        when (e) {
            is SessionExpiredException -> {
                foregroundPollJob?.cancel()
                foregroundPollJob = null
                AlertPollScheduler.stop(appContext)
                AlertPrefs.clear(appContext)
                SessionStore.clearSession(appContext)
                _uiState.value = AdminUiState(loginError = e.message)
                refreshSystemStatus()
            }
            is OfflineException -> {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isMutating = false,
                        isOffline = true,
                        errorBanner = e.message,
                        snackbarMessage = e.message,
                    )
                }
            }
            else -> {
                val msg = e.message?.takeIf { it.isNotBlank() }
                    ?: "Error inesperado (${e::class.java.simpleName}) al comunicarse con Supabase."
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isMutating = false,
                        errorBanner = msg,
                        snackbarMessage = msg,
                    )
                }
            }
        }
    }
}
