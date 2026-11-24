package pe.entrehilos.admin.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.R
import pe.entrehilos.admin.data.AdminAlertRow
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.ClientAccountItem
import pe.entrehilos.admin.data.DirectoryClient
import pe.entrehilos.admin.data.ForegroundAlertEvent
import pe.entrehilos.admin.data.NotificationTarget
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoItem
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.data.Resena
import pe.entrehilos.admin.theme.EhColors
import pe.entrehilos.admin.viewmodel.AdminUiState
import pe.entrehilos.admin.viewmodel.ClientesSubTab
import pe.entrehilos.admin.viewmodel.MainTab
import pe.entrehilos.admin.viewmodel.PedidosSubTab

@Composable
fun EntreHilosAdminApp(
    state: AdminUiState,
    onSignIn: (String, String) -> Unit,
    onRefresh: () -> Unit,
    onSelectMainTab: (MainTab) -> Unit,
    onSelectPedidosSub: (PedidosSubTab) -> Unit,
    onSelectClientesSub: (ClientesSubTab) -> Unit,
    onPedidosSearchChange: (String) -> Unit,
    onPedidosEstadoFilterChange: (String) -> Unit,
    onPedidosCanalFilterChange: (String) -> Unit,
    onPedidosPagoFilterChange: (String) -> Unit,
    onClearPedidosFilters: () -> Unit,
    onClientesSearchChange: (String) -> Unit,
    onOpenPedidoDetail: (Pedido?) -> Unit,
    onOpenPersonalizadoDetail: (PedidoPersonalizado?) -> Unit,
    onSetShowAgendarPedido: (Boolean) -> Unit,
    onOpenAgendarParaUsuario: (DirectoryClient) -> Unit,
    onSetShowAgendarPersonalizado: (Boolean) -> Unit,
    onUpdatePedidoEstado: (Long, String) -> Unit,
    onUpdatePersonalizadoEstado: (Long, String) -> Unit,
    onDeletePedido: (Long) -> Unit,
    onDeletePersonalizado: (Long) -> Unit,
    onUpdateFullPedido: (
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
    ) -> Unit,
    onUpdateFullPersonalizado: (
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
    ) -> Unit,
    onAgendarPedido: (
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
    ) -> Unit,
    onAgendarPersonalizado: (
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
    ) -> Unit,
    onMarcarMensajeLeido: (Long) -> Unit,
    onToggleAprobarResena: (Resena) -> Unit,
    onDeleteUser: (targetUserId: String, adminPassword: String, deleteOrders: Boolean, onResult: (String?) -> Unit) -> Unit,
    onAssignClientEmail: (email: String, matchNombre: String, matchTelefono: String?, oldEmail: String?, onResult: (String?) -> Unit) -> Unit,
    onLinkClientOrdersToUser: (targetUserId: String, matchNombre: String, matchTelefono: String?, matchEmail: String?, onResult: (String?) -> Unit) -> Unit,
    onRequestNotificationPermission: () -> Unit,
    onSyncAlertsNow: () -> Unit,
    onSendTestAlert: () -> Unit,
    onOpenAlertRow: (AdminAlertRow) -> Unit,
    onOpenFromNotification: (NotificationTarget) -> Unit,
    onDismissForegroundBanner: () -> Unit,
    onConsumeSnackbar: () -> Unit,
    onSignOut: () -> Unit,
) {
    if (state.session == null) {
        LoginScreen(
            isLoading = state.loginLoading,
            errorMessage = state.loginError,
            onSignIn = onSignIn
        )
        return
    }

    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    var selectedClientOrdersKey by remember { mutableStateOf<String?>(null) }
    var selectedClientToLinkKey by remember { mutableStateOf<String?>(null) }
    var userToDelete by remember { mutableStateOf<ClientAccountItem?>(null) }

    LaunchedEffect(state.snackbarMessage) {
        val msg = state.snackbarMessage
        if (!msg.isNullOrBlank()) {
            snackbarHostState.showSnackbar(msg)
            onConsumeSnackbar()
        }
    }

    val urgentOrdersCount = remember(state.pedidos, state.personalizados) {
        state.pedidos.count { AdminFormatters.calculateUrgency(it.fechaEntrega, it.estado).isUrgent } +
            state.personalizados.count { AdminFormatters.calculateUrgency(it.fechaEntrega, it.estado).isUrgent }
    }
    val unreadMessagesCount = remember(state.mensajes) {
        state.mensajes.count { !it.leido }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            containerColor = EhColors.Background,
            snackbarHost = {
                SnackbarHost(hostState = snackbarHostState) { data ->
                    Snackbar(
                        snackbarData = data,
                        containerColor = EhColors.PrimaryDark,
                        contentColor = Color.White,
                        actionColor = EhColors.PrimarySoft,
                        shape = RoundedCornerShape(14.dp),
                    )
                }
            },
            bottomBar = {
            Column {
                HorizontalDivider(color = EhColors.BorderSoft, thickness = 1.dp)
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                ) {
                    MainTab.entries.forEach { tab ->
                        val selected = state.activeTab == tab
                        val badgeCount = when (tab) {
                            MainTab.PEDIDOS -> urgentOrdersCount
                            MainTab.CLIENTES -> unreadMessagesCount
                            MainTab.ALERTAS -> if (
                                !state.notificationGranted ||
                                !state.isSilentPollingEnabled ||
                                !state.exactAlarmsAllowed ||
                                !state.batteryIgnored
                            ) 1 else 0
                            MainTab.DASHBOARD -> 0
                        }
                        val icon = when (tab) {
                            MainTab.DASHBOARD -> Icons.Outlined.Dashboard
                            MainTab.PEDIDOS -> Icons.Outlined.ShoppingBag
                            MainTab.CLIENTES -> Icons.Outlined.People
                            MainTab.ALERTAS -> Icons.Outlined.Notifications
                        }

                        NavigationBarItem(
                            selected = selected,
                            onClick = { onSelectMainTab(tab) },
                            icon = {
                                if (badgeCount > 0) {
                                    BadgedBox(
                                        badge = {
                                            Badge(containerColor = EhColors.Primary, contentColor = Color.White) {
                                                Text(if (badgeCount > 9) "9+" else badgeCount.toString(), fontSize = 10.sp)
                                            }
                                        }
                                    ) {
                                        Icon(icon, contentDescription = tab.label)
                                    }
                                } else {
                                    Icon(icon, contentDescription = tab.label)
                                }
                            },
                            label = {
                                Text(
                                    text = tab.label,
                                    fontSize = 11.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    maxLines = 1
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = EhColors.PrimaryDark,
                                selectedTextColor = EhColors.PrimaryDark,
                                indicatorColor = EhColors.PrimarySoft,
                                unselectedIconColor = EhColors.TextSecondary,
                                unselectedTextColor = EhColors.TextSecondary,
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (state.isLoading || state.isMutating) {
                LinearProgressIndicator(
                    color = EhColors.Primary,
                    trackColor = EhColors.PrimarySoft,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (!state.errorBanner.isNullOrBlank()) {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (state.isOffline) EhColors.WarningBg else EhColors.ErrorBg
                    ),
                    border = BorderStroke(
                        1.dp,
                        if (state.isOffline) Color(0xFFFDE68A) else Color(0xFFFECACA)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.WifiOff,
                            contentDescription = null,
                            tint = if (state.isOffline) EhColors.WarningFg else EhColors.ErrorFg,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = state.errorBanner,
                            fontSize = 12.sp,
                            color = if (state.isOffline) EhColors.WarningFg else EhColors.ErrorFg,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = onRefresh) {
                            Text("Reintentar", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }

            state.foregroundBanner?.let { banner ->
                ForegroundBannerCard(
                    banner = banner,
                    onClick = {
                        val lower = banner.url.lowercase()
                        val sub = when {
                            lower.contains("personalizados") -> "personalizados"
                            lower.contains("suscriptores") -> "suscriptores"
                            lower.contains("usuarios") -> "usuarios"
                            else -> "pedidos"
                        }
                        val seccion = if (sub == "suscriptores" || sub == "usuarios") "clientes" else "pedidos"
                        onOpenFromNotification(NotificationTarget(seccion, sub, banner.url))
                    },
                    onDismiss = onDismissForegroundBanner
                )
            }

            Box(modifier = Modifier.weight(1f)) {
                when (state.activeTab) {
                    MainTab.DASHBOARD -> DashboardScreen(
                        state = state,
                        onRefresh = onRefresh,
                        onNavigateTab = onSelectMainTab,
                        onNavigatePedidosSub = { sub, filter ->
                            onSelectPedidosSub(sub)
                            onPedidosEstadoFilterChange(filter)
                            onSelectMainTab(MainTab.PEDIDOS)
                        },
                        onNavigateClientesSub = { sub ->
                            onSelectClientesSub(sub)
                            onSelectMainTab(MainTab.CLIENTES)
                        },
                        onOpenAgendarPedido = { onSetShowAgendarPedido(true) },
                        onOpenAgendarPersonalizado = { onSetShowAgendarPersonalizado(true) },
                        onOpenPedidoDetail = onOpenPedidoDetail,
                        onOpenPersonalizadoDetail = onOpenPersonalizadoDetail,
                    )

                    MainTab.PEDIDOS -> PedidosScreen(
                        state = state,
                        onSelectSubTab = onSelectPedidosSub,
                        onSearchChange = onPedidosSearchChange,
                        onEstadoFilterChange = onPedidosEstadoFilterChange,
                        onCanalFilterChange = onPedidosCanalFilterChange,
                        onPagoFilterChange = onPedidosPagoFilterChange,
                        onClearFilters = onClearPedidosFilters,
                        onRefresh = onRefresh,
                        onOpenPedidoDetail = onOpenPedidoDetail,
                        onOpenPersonalizadoDetail = onOpenPersonalizadoDetail,
                        onOpenAgendarPedido = { onSetShowAgendarPedido(true) },
                        onOpenAgendarPersonalizado = { onSetShowAgendarPersonalizado(true) },
                    )

                    MainTab.CLIENTES -> ClientesScreen(
                        state = state,
                        onSelectSubTab = onSelectClientesSub,
                        onSearchChange = onClientesSearchChange,
                        onRefresh = onRefresh,
                        onMarcarMensajeLeido = onMarcarMensajeLeido,
                        onToggleAprobarResena = onToggleAprobarResena,
                        onAgendarParaUsuario = onOpenAgendarParaUsuario,
                        onOpenClientOrders = { client -> selectedClientOrdersKey = client.key },
                        onOpenLinkClient = { client -> selectedClientToLinkKey = client.key },
                        onRequestDeleteUser = { client -> userToDelete = client },
                    )

                    MainTab.ALERTAS -> AlertasScreen(
                        state = state,
                        onRequestNotificationPermission = onRequestNotificationPermission,
                        onSyncNow = onSyncAlertsNow,
                        onSendTestAlert = onSendTestAlert,
                        onRefresh = onRefresh,
                        onOpenAlertRow = onOpenAlertRow,
                        onSignOut = onSignOut,
                    )
                }
            }
            }
        }

        selectedClientOrdersKey?.let { key ->
            state.clientAccounts.find { it.key == key }?.let { liveClient ->
                ClientOrdersOverlay(
                    client = liveClient,
                    onOpenPedidoDetail = onOpenPedidoDetail,
                    onOpenPersonalizadoDetail = onOpenPersonalizadoDetail,
                    onAgendarPedido = {
                        selectedClientOrdersKey = null
                        onOpenAgendarParaUsuario(
                            DirectoryClient(
                                key = AdminFormatters.normalizeClientKey(liveClient.nombre),
                                usuarioId = liveClient.usuarioId,
                                nombre = liveClient.nombre,
                                telefono = liveClient.telefono,
                                email = liveClient.email,
                                direccion = liveClient.direccion,
                                origen = if (liveClient.isRegistered) "Registrado" else "Pedido",
                            )
                        )
                    },
                    onDismiss = { selectedClientOrdersKey = null },
                )
            } ?: run {
                selectedClientOrdersKey = null
            }
        }

        selectedClientToLinkKey?.let { key ->
            state.clientAccounts.find { it.key == key }?.let { liveClient ->
                LinkClientAccountOverlay(
                    client = liveClient,
                    usuarios = state.usuarios,
                    isMutating = state.isMutating,
                    onAssignEmail = { email, onResult ->
                        onAssignClientEmail(
                            email,
                            liveClient.nombre,
                            liveClient.telefono,
                            liveClient.email,
                            onResult
                        )
                    },
                    onLinkToUser = { targetUserId, onResult ->
                        onLinkClientOrdersToUser(
                            targetUserId,
                            liveClient.nombre,
                            liveClient.telefono,
                            liveClient.email,
                            onResult
                        )
                    },
                    onDismiss = { selectedClientToLinkKey = null },
                )
            } ?: run {
                selectedClientToLinkKey = null
            }
        }

        if (state.showAgendarPedido) {
            AgendarPedidoDialog(
                directory = state.clientesDirectory,
                productos = state.productos,
                prefilledClient = state.prefilledClientForOrder,
                isSaving = state.isMutating,
                onRefreshData = onRefresh,
                onDismiss = { onSetShowAgendarPedido(false) },
                onSave = onAgendarPedido
            )
        }

        if (state.showAgendarPersonalizado) {
            AgendarPersonalizadoDialog(
                directory = state.clientesDirectory,
                productos = state.productos,
                isSaving = state.isMutating,
                onRefreshData = onRefresh,
                onDismiss = { onSetShowAgendarPersonalizado(false) },
                onSave = onAgendarPersonalizado
            )
        }
    }

    userToDelete?.let { target ->
        val uid = target.usuarioId
        if (!uid.isNullOrBlank()) {
            DeleteUserPasswordDialog(
                client = target,
                isMutating = state.isMutating,
                onConfirmDelete = { adminPassword, deleteOrders, onResult ->
                    onDeleteUser(uid, adminPassword, deleteOrders, onResult)
                },
                onDismiss = { userToDelete = null },
            )
        } else {
            userToDelete = null
        }
    }

    // Hojas globales de detalle y edición
    state.selectedPedido?.let { selected ->
        PedidoDetailSheet(
            pedido = selected,
            directory = state.clientesDirectory,
            isMutating = state.isMutating,
            errorBanner = state.errorBanner,
            onDismiss = { onOpenPedidoDetail(null) },
            onUpdateEstado = { newEstado -> onUpdatePedidoEstado(selected.id, newEstado) },
            onDelete = { onDeletePedido(selected.id) },
            onUpdateFullPedido = { nombre, tel, email, uid, dir, est, pago, adel, fecha, hora, notas ->
                onUpdateFullPedido(
                    selected.id,
                    nombre,
                    tel,
                    email,
                    uid,
                    dir,
                    est,
                    pago,
                    adel,
                    fecha,
                    hora,
                    notas,
                )
            },
            onWhatsApp = {
                openWhatsAppChat(
                    context,
                    selected.clienteTelefono,
                    "Hola ${selected.clienteNombre}, sobre tu Pedido #${selected.id} de Entre Hilos:"
                )
            }
        )
    }

    state.selectedPersonalizado?.let { selected ->
        PersonalizadoDetailSheet(
            pers = selected,
            directory = state.clientesDirectory,
            productos = state.productos,
            isMutating = state.isMutating,
            errorBanner = state.errorBanner,
            onDismiss = { onOpenPersonalizadoDetail(null) },
            onRefreshData = onRefresh,
            onUpdateEstado = { newEstado -> onUpdatePersonalizadoEstado(selected.id, newEstado) },
            onDelete = { onDeletePersonalizado(selected.id) },
            onUpdateFullPersonalizado = { nombre, tel, email, prod, precio, det, col, tam, ext, fecha, hora, est ->
                onUpdateFullPersonalizado(
                    selected.id,
                    nombre,
                    tel,
                    email,
                    prod,
                    precio,
                    det,
                    col,
                    tam,
                    ext,
                    fecha,
                    hora,
                    est,
                )
            },
            onWhatsApp = {
                openWhatsAppChat(
                    context,
                    selected.telefono,
                    "Hola ${selected.nombreCliente}, sobre tu pedido personalizado #${selected.id} en Entre Hilos:"
                )
            }
        )
    }
}

@Composable
private fun ForegroundBannerCard(
    banner: ForegroundAlertEvent,
    onClick: () -> Unit,
    onDismiss: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = EhColors.PrimaryDark),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 6.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = Icons.Outlined.NotificationsActive,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = banner.title.ifBlank { "Nueva alerta" },
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (banner.body.isNotBlank()) {
                    Text(
                        text = banner.body,
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            IconButton(onClick = onDismiss) {
                Icon(Icons.Outlined.Close, contentDescription = "Cerrar", tint = Color.White)
            }
        }
    }
}
