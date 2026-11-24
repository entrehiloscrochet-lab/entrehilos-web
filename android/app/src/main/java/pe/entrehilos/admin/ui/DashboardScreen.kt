package pe.entrehilos.admin.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.BatteryChargingFull
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.R
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.data.UrgencyInfo
import pe.entrehilos.admin.data.UrgencyKind
import pe.entrehilos.admin.theme.EhColors
import pe.entrehilos.admin.viewmodel.AdminUiState
import pe.entrehilos.admin.viewmodel.ClientesSubTab
import pe.entrehilos.admin.viewmodel.MainTab
import pe.entrehilos.admin.viewmodel.PedidosSubTab

private sealed interface UpcomingEntry {
    val sortDays: Int
    val urgency: UrgencyInfo
    val fechaLabel: String
    val horaLabel: String?

    data class StoreOrder(
        val pedido: Pedido,
        override val urgency: UrgencyInfo,
        override val fechaLabel: String,
        override val horaLabel: String?,
        override val sortDays: Int,
    ) : UpcomingEntry

    data class CustomOrder(
        val personalizado: PedidoPersonalizado,
        override val urgency: UrgencyInfo,
        override val fechaLabel: String,
        override val horaLabel: String?,
        override val sortDays: Int,
    ) : UpcomingEntry
}

private data class DashboardMetrics(
    val activePedidosCount: Int,
    val activePersCount: Int,
    val totalActivoSoles: Double,
    val saldoPendienteSoles: Double,
    val atrasadosCount: Int,
    val hoyCount: Int,
    val mananaCount: Int,
    val upcomingList: List<UpcomingEntry>,
) {
    val urgentCount: Int get() = atrasadosCount + hoyCount + mananaCount
}

@Composable
fun DashboardScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onNavigateTab: (MainTab) -> Unit,
    onNavigatePedidosSub: (PedidosSubTab, String) -> Unit,
    onNavigateClientesSub: (ClientesSubTab) -> Unit,
    onOpenAgendarPedido: () -> Unit,
    onOpenAgendarPersonalizado: () -> Unit,
    onOpenPedidoDetail: (Pedido) -> Unit,
    onOpenPersonalizadoDetail: (PedidoPersonalizado) -> Unit,
) {
    val context = LocalContext.current

    val metrics = remember(state.pedidos, state.personalizados) {
        val activePedidos = state.pedidos.filter {
            it.estado.lowercase() !in listOf("entregado", "cancelado")
        }
        val activePers = state.personalizados.filter {
            it.estado.lowercase() !in listOf("entregado", "cancelado")
        }

        val totalActivo = activePedidos.sumOf { it.total }
        val saldoTotal = activePedidos.sumOf { it.saldoPendiente }

        var atrasados = 0
        var hoy = 0
        var manana = 0

        val upcoming = buildList<UpcomingEntry> {
            activePedidos.forEach { ped ->
                val urg = AdminFormatters.calculateUrgency(ped.fechaEntrega, ped.estado)
                when (urg.kind) {
                    UrgencyKind.ATRASADO -> atrasados++
                    UrgencyKind.HOY -> hoy++
                    UrgencyKind.MANANA -> manana++
                    else -> {}
                }
                if (!ped.fechaEntrega.isNullOrBlank() &&
                    urg.kind != UrgencyKind.COMPLETADO &&
                    urg.kind != UrgencyKind.SIN_FECHA
                ) {
                    add(
                        UpcomingEntry.StoreOrder(
                            pedido = ped,
                            urgency = urg,
                            fechaLabel = AdminFormatters.formatDateDisplay(ped.fechaEntrega),
                            horaLabel = ped.horaEntrega,
                            sortDays = urg.diffDays,
                        )
                    )
                }
            }
            activePers.forEach { pers ->
                val urg = AdminFormatters.calculateUrgency(pers.fechaEntrega, pers.estado)
                when (urg.kind) {
                    UrgencyKind.ATRASADO -> atrasados++
                    UrgencyKind.HOY -> hoy++
                    UrgencyKind.MANANA -> manana++
                    else -> {}
                }
                if (!pers.fechaEntrega.isNullOrBlank() &&
                    urg.kind != UrgencyKind.COMPLETADO &&
                    urg.kind != UrgencyKind.SIN_FECHA
                ) {
                    add(
                        UpcomingEntry.CustomOrder(
                            personalizado = pers,
                            urgency = urg,
                            fechaLabel = AdminFormatters.formatDateDisplay(pers.fechaEntrega),
                            horaLabel = pers.horaEntrega,
                            sortDays = urg.diffDays,
                        )
                    )
                }
            }
        }.sortedBy { it.sortDays }.take(8)

        DashboardMetrics(
            activePedidosCount = activePedidos.size,
            activePersCount = activePers.size,
            totalActivoSoles = totalActivo,
            saldoPendienteSoles = saldoTotal,
            atrasadosCount = atrasados,
            hoyCount = hoy,
            mananaCount = manana,
            upcomingList = upcoming,
        )
    }

    val unreadMensajes = remember(state.mensajes) { state.mensajes.count { !it.leido } }
    val pendingResenas = remember(state.resenas) { state.resenas.count { !it.aprobado } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Hero Header de marca
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(EhColors.PrimaryDark, EhColors.Primary)
                        ),
                        shape = RoundedCornerShape(bottomStart = 26.dp, bottomEnd = 26.dp)
                    )
                    .padding(horizontal = 16.dp, vertical = 16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White,
                            modifier = Modifier.size(46.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Image(
                                    painter = painterResource(id = R.drawable.logo_entrehilos),
                                    contentDescription = "Entre Hilos",
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                )
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Hola, ${state.session?.nombre ?: "Admin"}",
                                fontSize = 19.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "Entre Hilos · ${state.session?.rol ?: "admin"}",
                                fontSize = 12.sp,
                                color = Color.White.copy(alpha = 0.88f)
                            )
                        }

                        Surface(
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.18f),
                            modifier = Modifier.size(38.dp)
                        ) {
                            IconButton(onClick = onRefresh) {
                                Icon(
                                    imageVector = Icons.Outlined.Refresh,
                                    contentDescription = "Actualizar",
                                    tint = Color.White
                                )
                            }
                        }
                    }

                    // Franja financiera resumen
                    Surface(
                        color = Color.White.copy(alpha = 0.16f),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Pedidos Activos",
                                    fontSize = 11.sp,
                                    color = Color.White.copy(alpha = 0.85f)
                                )
                                Text(
                                    text = AdminFormatters.formatMoney(metrics.totalActivoSoles),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Saldos por Cobrar",
                                    fontSize = 11.sp,
                                    color = Color.White.copy(alpha = 0.85f)
                                )
                                Text(
                                    text = AdminFormatters.formatMoney(metrics.saldoPendienteSoles),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFFDE68A)
                                )
                            }
                        }
                    }
                }
            }
        }

        // Banner de entregas urgentes si existen
        if (metrics.atrasadosCount > 0 || metrics.hoyCount > 0 || metrics.mananaCount > 0) {
            item {
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (metrics.atrasadosCount > 0 || metrics.hoyCount > 0) {
                            EhColors.ErrorBg
                        } else {
                            EhColors.WarningBg
                        }
                    ),
                    border = BorderStroke(
                        1.dp,
                        if (metrics.atrasadosCount > 0 || metrics.hoyCount > 0) Color(0xFFFECACA) else Color(0xFFFDE68A)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .clickable { onNavigatePedidosSub(PedidosSubTab.TIENDA, "urgentes") }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CalendarToday,
                            contentDescription = null,
                            tint = if (metrics.atrasadosCount > 0 || metrics.hoyCount > 0) EhColors.ErrorFg else EhColors.WarningFg,
                            modifier = Modifier.size(22.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Entregas que requieren atención",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (metrics.atrasadosCount > 0 || metrics.hoyCount > 0) EhColors.ErrorFg else EhColors.WarningFg
                            )
                            val parts = buildList {
                                if (metrics.atrasadosCount > 0) add("${metrics.atrasadosCount} atrasado(s)")
                                if (metrics.hoyCount > 0) add("${metrics.hoyCount} hoy")
                                if (metrics.mananaCount > 0) add("${metrics.mananaCount} mañana")
                            }.joinToString(" · ")
                            Text(text = parts, fontSize = 12.sp, color = EhColors.TextSecondary)
                        }
                        EhBadge(
                            text = "Ver",
                            bgColor = Color.White,
                            fgColor = EhColors.PrimaryDark,
                            borderColor = EhColors.BorderSoft
                        )
                    }
                }
            }
        }

        // Accesos rápidos para agendar
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onOpenAgendarPedido,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = EhColors.Primary,
                        contentColor = Color.White,
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Agendar Pedido", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = onOpenAgendarPersonalizado,
                    border = BorderStroke(1.dp, EhColors.Primary),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = Color.White,
                        contentColor = EhColors.PrimaryDark,
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                ) {
                    Icon(Icons.Outlined.Palette, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Personalizado", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Grilla 2x2 de KPIs
        item {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    KpiCard(
                        title = "Pedidos Tienda",
                        value = metrics.activePedidosCount.toString(),
                        subtitle = "${state.pedidos.size} en total",
                        icon = Icons.Outlined.ShoppingBag,
                        accentBg = EhColors.PrimarySoft,
                        accentFg = EhColors.PrimaryDark,
                        onClick = { onNavigatePedidosSub(PedidosSubTab.TIENDA, "todos") },
                        modifier = Modifier.weight(1f)
                    )
                    KpiCard(
                        title = "Urgentes 48h",
                        value = metrics.urgentCount.toString(),
                        subtitle = "Hoy, mañana y atrasos",
                        icon = Icons.Outlined.CalendarToday,
                        accentBg = if (metrics.urgentCount > 0) EhColors.ErrorBg else EhColors.SuccessBg,
                        accentFg = if (metrics.urgentCount > 0) EhColors.ErrorFg else EhColors.SuccessFg,
                        onClick = { onNavigatePedidosSub(PedidosSubTab.TIENDA, "urgentes") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    KpiCard(
                        title = "Personalizados",
                        value = metrics.activePersCount.toString(),
                        subtitle = "${state.personalizados.size} encargos",
                        icon = Icons.Outlined.Palette,
                        accentBg = EhColors.PurpleBg,
                        accentFg = EhColors.PurpleFg,
                        onClick = { onNavigatePedidosSub(PedidosSubTab.PERSONALIZADOS, "todos") },
                        modifier = Modifier.weight(1f)
                    )
                    KpiCard(
                        title = "Clientes y Red",
                        value = "${state.clientesDirectory.size}",
                        subtitle = "$unreadMensajes msj · $pendingResenas reseñas",
                        icon = Icons.Outlined.People,
                        accentBg = EhColors.InfoBg,
                        accentFg = EhColors.InfoFg,
                        onClick = {
                            if (unreadMensajes > 0) onNavigateClientesSub(ClientesSubTab.MENSAJES)
                            else onNavigateClientesSub(ClientesSubTab.USUARIOS)
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Estado compacto de alertas silenciosas
        item {
            val allGood = state.notificationGranted && state.isSilentPollingEnabled
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (allGood) EhColors.SuccessBg else EhColors.WarningBg
                ),
                border = BorderStroke(
                    1.dp,
                    if (allGood) Color(0xFFA7F3D0) else Color(0xFFFDE68A)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .clickable { onNavigateTab(MainTab.ALERTAS) }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = when {
                            !allGood -> Icons.Outlined.WarningAmber
                            !state.batteryIgnored -> Icons.Outlined.BatteryChargingFull
                            else -> Icons.Outlined.NotificationsActive
                        },
                        contentDescription = null,
                        tint = if (allGood) EhColors.SuccessFg else EhColors.WarningFg,
                        modifier = Modifier.size(24.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (allGood) "Alertas silenciosas activas" else "Configura tus alertas",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (allGood) EhColors.SuccessFg else EhColors.WarningFg
                        )
                        Text(
                            text = when {
                                !state.notificationGranted -> "Activa el permiso de notificaciones"
                                !state.isSilentPollingEnabled -> "Sincroniza el dispositivo en Alertas"
                                !state.batteryIgnored -> "Sin notificación fija · Toca para quitar ahorro de batería"
                                else -> "Sin notificación fija · Última sync: ${state.lastSyncLabel}"
                            },
                            fontSize = 11.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                    Icon(
                        imageVector = Icons.Outlined.ChevronRight,
                        contentDescription = null,
                        tint = EhColors.TextSecondary
                    )
                }
            }
        }

        // Próximas Entregas
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Próximas Entregas",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
                Text(
                    text = "Ver todas",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.Primary,
                    modifier = Modifier
                        .clickable { onNavigateTab(MainTab.PEDIDOS) }
                        .padding(4.dp)
                )
            }
        }

        if (metrics.upcomingList.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CheckCircle,
                            contentDescription = null,
                            tint = EhColors.SuccessFg
                        )
                        Text(
                            text = "No hay entregas programadas pendientes.",
                            fontSize = 13.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                }
            }
        } else {
            items(metrics.upcomingList) { entry ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .clickable {
                            when (entry) {
                                is UpcomingEntry.StoreOrder -> onOpenPedidoDetail(entry.pedido)
                                is UpcomingEntry.CustomOrder -> onOpenPersonalizadoDetail(entry.personalizado)
                            }
                        }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(4.dp)
                                .height(48.dp)
                                .background(entry.urgency.accentBarColor, RoundedCornerShape(4.dp))
                        )

                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                EhBadge(
                                    text = entry.urgency.label,
                                    bgColor = entry.urgency.bgColor,
                                    fgColor = entry.urgency.fgColor
                                )
                                when (entry) {
                                    is UpcomingEntry.StoreOrder -> {
                                        ChannelBrandBadge(origen = entry.pedido.origen, compact = true)
                                        Text(
                                            text = "#${entry.pedido.id}",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = EhColors.TextSecondary
                                        )
                                    }
                                    is UpcomingEntry.CustomOrder -> {
                                        EhBadge(
                                            text = "Personalizado #${entry.personalizado.id}",
                                            bgColor = EhColors.PurpleBg,
                                            fgColor = EhColors.PurpleFg
                                        )
                                    }
                                }
                            }

                            Text(
                                text = when (entry) {
                                    is UpcomingEntry.StoreOrder -> entry.pedido.clienteNombre
                                    is UpcomingEntry.CustomOrder -> entry.personalizado.nombreCliente
                                },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )

                            val horaTxt = entry.horaLabel?.takeIf { it.isNotBlank() } ?: "09:00 (ref.)"
                            Text(
                                text = "${entry.fechaLabel} · $horaTxt",
                                fontSize = 12.sp,
                                color = EhColors.TextSecondary
                            )
                        }

                        if (entry is UpcomingEntry.StoreOrder) {
                            Text(
                                text = AdminFormatters.formatMoney(entry.pedido.total),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark
                            )
                        }
                        Icon(
                            imageVector = Icons.Outlined.ChevronRight,
                            contentDescription = null,
                            tint = EhColors.TextSecondary
                        )
                    }
                }
            }
        }

        // Enlace opcional a editores web (Banners / Producción)
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, EhColors.BorderSoft),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Editores Web (Banners / Producción)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.TextPrimary
                        )
                        Text(
                            text = "Abrir panel web externo para portadas y costos",
                            fontSize = 11.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = { openWebAdminExternal(context) },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.OpenInNew,
                            contentDescription = null,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Abrir", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    accentBg: Color,
    accentFg: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier.clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = accentBg,
                    modifier = Modifier.size(34.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = accentFg,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Text(
                    text = value,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
            }
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = EhColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = EhColors.TextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
