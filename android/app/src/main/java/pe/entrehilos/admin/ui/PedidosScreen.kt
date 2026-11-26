package pe.entrehilos.admin.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.R
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.CatalogProduct
import pe.entrehilos.admin.data.DirectoryClient
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoItem
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.theme.EhColors
import pe.entrehilos.admin.viewmodel.AdminUiState
import pe.entrehilos.admin.viewmodel.PedidosSubTab
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

@Composable
fun PedidosScreen(
    state: AdminUiState,
    onSelectSubTab: (PedidosSubTab) -> Unit,
    onSearchChange: (String) -> Unit,
    onEstadoFilterChange: (String) -> Unit,
    onCanalFilterChange: (String) -> Unit,
    onPagoFilterChange: (String) -> Unit,
    onClearFilters: () -> Unit,
    onRefresh: () -> Unit,
    onOpenPedidoDetail: (Pedido?) -> Unit,
    onOpenPersonalizadoDetail: (PedidoPersonalizado?) -> Unit,
    onOpenAgendarPedido: () -> Unit,
    onOpenAgendarPersonalizado: () -> Unit,
) {
    val context = LocalContext.current
    var showFiltersSheet by rememberSaveable { mutableStateOf(false) }

    val activeFilterCount = remember(
        state.pedidosEstadoFilter,
        state.pedidosCanalFilter,
        state.pedidosPagoFilter
    ) {
        var count = 0
        if (state.pedidosEstadoFilter != "todos") count++
        if (state.pedidosCanalFilter != "todos") count++
        if (state.pedidosPagoFilter != "todos") count++
        count
    }

    val filteredPedidos = remember(
        state.pedidos,
        state.pedidosSearch,
        state.pedidosEstadoFilter,
        state.pedidosCanalFilter,
        state.pedidosPagoFilter
    ) {
        val q = AdminFormatters.normalizeClientKey(state.pedidosSearch)
        state.pedidos.filter { ped ->
            val matchesQuery = if (q.isEmpty()) true else {
                AdminFormatters.normalizeClientKey(ped.clienteNombre).contains(q) ||
                    ped.clienteTelefono.lowercase().contains(q) ||
                    ped.id.toString().contains(q) ||
                    ped.items.any { AdminFormatters.normalizeClientKey(it.nombre).contains(q) }
            }
            val estLower = ped.estado.lowercase()
            val matchesEstado = when (state.pedidosEstadoFilter) {
                "todos" -> true
                "urgentes" -> AdminFormatters.calculateUrgency(ped.fechaEntrega, ped.estado).isUrgent
                "activos" -> estLower !in listOf("entregado", "cancelado")
                "listos" -> estLower in listOf("listo", "enviado")
                else -> estLower == state.pedidosEstadoFilter.lowercase()
            }
            val canalLower = ped.origen.trim().lowercase().let { if (it == "web" || it.isEmpty()) "tienda" else it }
            val matchesCanal = state.pedidosCanalFilter == "todos" || canalLower == state.pedidosCanalFilter
            val pagoLower = ped.metodoPago.trim().lowercase()
            val matchesPago = state.pedidosPagoFilter == "todos" || pagoLower == state.pedidosPagoFilter
            matchesQuery && matchesEstado && matchesCanal && matchesPago
        }
    }

    val filteredPers = remember(state.personalizados, state.pedidosSearch, state.pedidosEstadoFilter) {
        val q = AdminFormatters.normalizeClientKey(state.pedidosSearch)
        state.personalizados.filter { pers ->
            val matchesQuery = if (q.isEmpty()) true else {
                AdminFormatters.normalizeClientKey(pers.nombreCliente).contains(q) ||
                    pers.telefono.lowercase().contains(q) ||
                    AdminFormatters.normalizeClientKey(pers.detalles).contains(q) ||
                    (pers.productoNombre?.let { AdminFormatters.normalizeClientKey(it).contains(q) } == true) ||
                    pers.id.toString().contains(q)
            }
            val estLower = pers.estado.lowercase()
            val matchesEstado = when (state.pedidosEstadoFilter) {
                "todos" -> true
                "urgentes" -> AdminFormatters.calculateUrgency(pers.fechaEntrega, pers.estado).isUrgent
                "activos" -> estLower !in listOf("entregado", "cancelado")
                "listos" -> estLower == "listo"
                else -> estLower == state.pedidosEstadoFilter.lowercase()
            }
            matchesQuery && matchesEstado
        }
    }

    Scaffold(
        containerColor = EhColors.Background,
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (state.pedidosSubTab == PedidosSubTab.TIENDA) {
                        onOpenAgendarPedido()
                    } else {
                        onOpenAgendarPersonalizado()
                    }
                },
                containerColor = EhColors.Primary,
                contentColor = Color.White,
            ) {
                Icon(Icons.Outlined.Add, contentDescription = "Agendar")
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Cabecera
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Pedidos y Entregas",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
                IconButton(onClick = onRefresh) {
                    Icon(
                        imageVector = Icons.Outlined.Refresh,
                        contentDescription = "Refrescar pedidos",
                        tint = EhColors.PrimaryDark
                    )
                }
            }

            // Switch segmentado tipo píldora (100% ancho, CERO scroll horizontal)
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, EhColors.BorderSoft),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    PedidosSubTab.entries.forEach { tab ->
                        val selected = state.pedidosSubTab == tab
                        val count = if (tab == PedidosSubTab.TIENDA) state.pedidos.size else state.personalizados.size
                        Surface(
                            onClick = { onSelectSubTab(tab) },
                            shape = RoundedCornerShape(12.dp),
                            color = if (selected) EhColors.Primary else Color.Transparent,
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier.padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "${tab.label} ($count)",
                                    fontSize = 13.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                                    color = if (selected) Color.White else EhColors.TextSecondary,
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Buscador + Botón de Filtros (con badge)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = state.pedidosSearch,
                    onValueChange = onSearchChange,
                    placeholder = { Text("Buscar cliente, #ID o producto...", fontSize = 13.sp) },
                    leadingIcon = {
                        Icon(Icons.Outlined.Search, contentDescription = null, tint = EhColors.Primary)
                    },
                    trailingIcon = {
                        if (state.pedidosSearch.isNotEmpty()) {
                            IconButton(onClick = { onSearchChange("") }) {
                                Icon(Icons.Outlined.Close, contentDescription = "Limpiar")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = EhColors.Primary,
                        unfocusedBorderColor = EhColors.BorderSoft,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                    ),
                    modifier = Modifier.weight(1f)
                )

                Surface(
                    onClick = { showFiltersSheet = true },
                    shape = RoundedCornerShape(14.dp),
                    color = if (activeFilterCount > 0) EhColors.PrimarySoft else Color.White,
                    border = BorderStroke(
                        1.dp,
                        if (activeFilterCount > 0) EhColors.Primary else EhColors.BorderSoft
                    ),
                    modifier = Modifier.size(52.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (activeFilterCount > 0) {
                            BadgedBox(
                                badge = {
                                    Badge(containerColor = EhColors.PrimaryDark, contentColor = Color.White) {
                                        Text(activeFilterCount.toString(), fontSize = 10.sp)
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.FilterList,
                                    contentDescription = "Filtros",
                                    tint = EhColors.PrimaryDark
                                )
                            }
                        } else {
                            Icon(
                                imageVector = Icons.Outlined.FilterList,
                                contentDescription = "Filtros",
                                tint = EhColors.PrimaryDark
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Barra fija de 4 filtros rápidos (sin scroll horizontal)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val quickFilters = listOf(
                    "todos" to "Todos",
                    "urgentes" to "Urgentes",
                    "activos" to "Activos",
                    "listos" to "Listos",
                )
                quickFilters.forEach { (key, label) ->
                    val selected = state.pedidosEstadoFilter == key
                    Surface(
                        onClick = { onEstadoFilterChange(key) },
                        shape = RoundedCornerShape(12.dp),
                        color = if (selected) EhColors.PrimaryDark else Color.White,
                        border = BorderStroke(
                            1.dp,
                            if (selected) EhColors.PrimaryDark else EhColors.BorderSoft
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier.padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 11.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (selected) Color.White else EhColors.TextPrimary,
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            // Banner de filtros extra activos si se eligió canal/pago/estado específico
            if (state.pedidosCanalFilter != "todos" ||
                state.pedidosPagoFilter != "todos" ||
                state.pedidosEstadoFilter !in listOf("todos", "urgentes", "activos", "listos")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val activeDesc = buildList {
                        if (state.pedidosEstadoFilter !in listOf("todos", "urgentes", "activos", "listos")) {
                            add(AdminFormatters.estadoStyle(state.pedidosEstadoFilter).label)
                        }
                        if (state.pedidosCanalFilter != "todos") {
                            add(AdminFormatters.origenLabel(state.pedidosCanalFilter))
                        }
                        if (state.pedidosPagoFilter != "todos") {
                            add(AdminFormatters.paymentLabel(state.pedidosPagoFilter))
                        }
                    }.joinToString(" · ")
                    Text(
                        text = "Filtro: $activeDesc",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    TextButton(onClick = onClearFilters) {
                        Text("Limpiar", fontSize = 11.sp)
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(6.dp))
            }

            // Lista
            if (state.pedidosSubTab == PedidosSubTab.TIENDA) {
                if (filteredPedidos.isEmpty()) {
                    EmptyPedidosState("No hay pedidos que coincidan con el filtro.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 88.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(filteredPedidos, key = { it.id }) { pedido ->
                            PedidoCard(
                                pedido = pedido,
                                onClick = { onOpenPedidoDetail(pedido) },
                                onWhatsAppClick = {
                                    openWhatsAppChat(
                                        context,
                                        pedido.clienteTelefono,
                                        "Hola ${pedido.clienteNombre}, te escribimos de Entre Hilos sobre tu Pedido #${pedido.id}."
                                    )
                                }
                            )
                        }
                    }
                }
            } else {
                if (filteredPers.isEmpty()) {
                    EmptyPedidosState("No hay pedidos personalizados con ese filtro.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 88.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(filteredPers, key = { it.id }) { pers ->
                            PersonalizadoCard(
                                pers = pers,
                                onClick = { onOpenPersonalizadoDetail(pers) },
                                onWhatsAppClick = {
                                    openWhatsAppChat(
                                        context,
                                        pers.telefono,
                                        "Hola ${pers.nombreCliente}, te escribimos de Entre Hilos sobre tu encargo personalizado #${pers.id}."
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showFiltersSheet) {
        PedidosFiltersBottomSheet(
            isTiendaTab = state.pedidosSubTab == PedidosSubTab.TIENDA,
            selectedEstado = state.pedidosEstadoFilter,
            selectedCanal = state.pedidosCanalFilter,
            selectedPago = state.pedidosPagoFilter,
            onSelectEstado = onEstadoFilterChange,
            onSelectCanal = onCanalFilterChange,
            onSelectPago = onPagoFilterChange,
            onClearAll = {
                onClearFilters()
                showFiltersSheet = false
            },
            onDismiss = { showFiltersSheet = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun PedidosFiltersBottomSheet(
    isTiendaTab: Boolean,
    selectedEstado: String,
    selectedCanal: String,
    selectedPago: String,
    onSelectEstado: (String) -> Unit,
    onSelectCanal: (String) -> Unit,
    onSelectPago: (String) -> Unit,
    onClearAll: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filtrar Pedidos",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
                TextButton(onClick = onClearAll) {
                    Text("Limpiar todo", fontWeight = FontWeight.Bold)
                }
            }

            Text("Estado", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val estados = listOf("todos" to "Todos", "urgentes" to "Urgentes") +
                    if (isTiendaTab) AdminFormatters.PEDIDO_ESTADOS else AdminFormatters.PERSONALIZADO_ESTADOS
                estados.forEach { (key, label) ->
                    FilterChip(
                        selected = selectedEstado == key,
                        onClick = { onSelectEstado(key) },
                        label = { Text(label, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = EhColors.Primary,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            if (isTiendaTab) {
                Text("Canal de origen", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FilterChip(
                        selected = selectedCanal == "todos",
                        onClick = { onSelectCanal("todos") },
                        label = { Text("Todos", fontSize = 12.sp) }
                    )
                    AdminFormatters.CANALES_ORIGEN.forEach { (key, label) ->
                        FilterChip(
                            selected = selectedCanal == key,
                            onClick = { onSelectCanal(key) },
                            leadingIcon = { BrandIcon(channelBrandDrawable(key), size = 16.dp) },
                            label = { Text(label, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = EhColors.PrimarySoft,
                                selectedLabelColor = EhColors.PrimaryDark
                            )
                        )
                    }
                }

                Text("Método de pago", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FilterChip(
                        selected = selectedPago == "todos",
                        onClick = { onSelectPago("todos") },
                        label = { Text("Todos", fontSize = 12.sp) }
                    )
                    AdminFormatters.METODOS_PAGO.forEach { (key, label) ->
                        FilterChip(
                            selected = selectedPago == key,
                            onClick = { onSelectPago(key) },
                            leadingIcon = { BrandIcon(paymentBrandDrawable(key), size = 16.dp) },
                            label = { Text(label, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = EhColors.PrimarySoft,
                                selectedLabelColor = EhColors.PrimaryDark
                            )
                        )
                    }
                }
            }

            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp)
            ) {
                Text("Aplicar Filtros", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun EmptyPedidosState(text: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text = text, fontSize = 14.sp, color = EhColors.TextSecondary)
    }
}

@Composable
private fun PedidoCard(
    pedido: Pedido,
    onClick: () -> Unit,
    onWhatsAppClick: () -> Unit,
) {
    val estStyle = AdminFormatters.estadoStyle(pedido.estado)
    val urgency = AdminFormatters.calculateUrgency(pedido.fechaEntrega, pedido.estado)
    val hasPhone = AdminFormatters.normalizeWhatsAppPhone(pedido.clienteTelefono) != null

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column {
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .width(5.dp)
                        .height(104.dp)
                        .background(urgency.accentBarColor)
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "#${pedido.id}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark
                            )
                            ChannelBrandBadge(origen = pedido.origen, compact = true)
                        }
                        EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = pedido.clienteNombre,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (pedido.clienteTelefono.isNotBlank()) {
                                Text(
                                    text = pedido.clienteTelefono,
                                    fontSize = 12.sp,
                                    color = EhColors.TextSecondary
                                )
                            }
                        }
                        if (hasPhone) {
                            WhatsAppCircleButton(onClick = onWhatsAppClick, size = 34.dp)
                        }
                    }

                    if (pedido.items.isNotEmpty()) {
                        val summary = pedido.items.joinToString(", ") { "${it.cantidad}x ${it.nombre}" }
                        Text(
                            text = summary,
                            fontSize = 12.sp,
                            color = EhColors.TextSecondary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Pie tintado de entrega y pago con logos oficiales
            Surface(
                color = EhColors.SurfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        EhBadge(text = urgency.label, bgColor = urgency.bgColor, fgColor = urgency.fgColor)
                        if (!pedido.fechaEntrega.isNullOrBlank() || !pedido.horaEntrega.isNullOrBlank()) {
                            Text(
                                text = AdminFormatters.formatHora12h(pedido.horaEntrega),
                                fontSize = 11.sp,
                                color = EhColors.TextSecondary
                            )
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        PaymentBrandBadge(metodoPago = pedido.metodoPago)
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = AdminFormatters.formatMoney(pedido.total),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark
                            )
                            if (pedido.saldoPendiente > 0.0) {
                                Text(
                                    text = "Saldo ${AdminFormatters.formatMoney(pedido.saldoPendiente)}",
                                    fontSize = 10.sp,
                                    color = EhColors.WarningFg,
                                    fontWeight = FontWeight.Bold
                                )
                            } else if (pedido.total > 0.0) {
                                Text(
                                    text = "Pagado ✓",
                                    fontSize = 10.sp,
                                    color = EhColors.SuccessFg,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PersonalizadoCard(
    pers: PedidoPersonalizado,
    onClick: () -> Unit,
    onWhatsAppClick: () -> Unit,
) {
    val estStyle = AdminFormatters.estadoStyle(pers.estado)
    val urgency = AdminFormatters.calculateUrgency(pers.fechaEntrega, pers.estado)
    val hasPhone = AdminFormatters.normalizeWhatsAppPhone(pers.telefono) != null

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column {
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .width(5.dp)
                        .height(92.dp)
                        .background(urgency.accentBarColor)
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = "#${pers.id}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark
                            )
                            pers.productoNombre?.let {
                                EhBadge(
                                    text = it,
                                    bgColor = EhColors.PurpleBg,
                                    fgColor = EhColors.PurpleFg
                                )
                            }
                        }
                        EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = pers.nombreCliente,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (pers.telefono.isNotBlank()) {
                                Text(text = pers.telefono, fontSize = 12.sp, color = EhColors.TextSecondary)
                            }
                        }
                        if (hasPhone) {
                            WhatsAppCircleButton(onClick = onWhatsAppClick, size = 34.dp)
                        }
                    }

                    Text(
                        text = pers.detalles,
                        fontSize = 12.sp,
                        color = EhColors.TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Surface(color = EhColors.SurfaceVariant, modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        EhBadge(text = urgency.label, bgColor = urgency.bgColor, fgColor = urgency.fgColor)
                        if (!pers.fechaEntrega.isNullOrBlank() || !pers.horaEntrega.isNullOrBlank()) {
                            Text(
                                text = AdminFormatters.formatHora12h(pers.horaEntrega),
                                fontSize = 11.sp,
                                color = EhColors.TextSecondary
                            )
                        }
                    }
                    pers.productoPrecio?.let {
                        Text(
                            text = AdminFormatters.formatMoney(it),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.PrimaryDark
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PedidoDetailSheet(
    pedido: Pedido,
    directory: List<DirectoryClient>,
    isMutating: Boolean,
    errorBanner: String?,
    onDismiss: () -> Unit,
    onUpdateEstado: (String) -> Unit,
    onDelete: () -> Unit,
    onUpdateFullPedido: (
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
    onWhatsApp: () -> Unit,
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val estStyle = AdminFormatters.estadoStyle(pedido.estado)

    var editMode by remember(pedido.id) { mutableStateOf(false) }
    var showClientPicker by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember(pedido.id) { mutableStateOf(false) }

    var editNombre by remember(pedido.id) { mutableStateOf(pedido.clienteNombre) }
    var editTel by remember(pedido.id) { mutableStateOf(pedido.clienteTelefono) }
    var editEmail by remember(pedido.id) { mutableStateOf(pedido.clienteEmail.orEmpty()) }
    var editUsuarioId by remember(pedido.id) { mutableStateOf(pedido.usuarioId) }
    var editDir by remember(pedido.id) {
        mutableStateOf(
            if (pedido.direccionEnvio.equals("Coordinar por WhatsApp", ignoreCase = true)) ""
            else pedido.direccionEnvio
        )
    }
    var editEstado by remember(pedido.id) { mutableStateOf(pedido.estado) }
    var editMetodoPago by remember(pedido.id) { mutableStateOf(pedido.metodoPago.ifBlank { "yape" }) }
    var editAdelanto by remember(pedido.id) { mutableStateOf(String.format(Locale.US, "%.2f", pedido.adelanto)) }
    var editFecha by remember(pedido.id) { mutableStateOf(AdminFormatters.extractLimaDateOnly(pedido.fechaEntrega).orEmpty()) }
    var editHora by remember(pedido.id) {
        mutableStateOf(
            if (!pedido.fechaEntrega.isNullOrBlank() || !pedido.horaEntrega.isNullOrBlank()) {
                AdminFormatters.normalizeClock24h(pedido.horaEntrega)
            } else {
                ""
            }
        )
    }
    var editNotas by remember(pedido.id) { mutableStateOf(pedido.notas.orEmpty()) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
    ) {
        if (showClientPicker) {
            BackHandler { showClientPicker = false }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 380.dp, max = 580.dp)
            ) {
                ClientPickerContent(
                    directory = directory,
                    onSelect = { c ->
                        editNombre = c.nombre
                        c.telefono?.let { editTel = it }
                        c.email?.let { editEmail = it }
                        c.direccion?.let { editDir = it }
                        editUsuarioId = c.usuarioId
                        showClientPicker = false
                    },
                    onDismiss = { showClientPicker = false },
                    dismissIconIsBack = true,
                )
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Pedido #${pedido.id}",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    ChannelBrandBadge(origen = pedido.origen, compact = true)
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                    IconButton(onClick = { editMode = !editMode }) {
                        Icon(
                            imageVector = Icons.Outlined.Edit,
                            contentDescription = "Editar pedido",
                            tint = if (editMode) EhColors.Primary else EhColors.TextSecondary
                        )
                    }
                }
            }

            HorizontalDivider(color = EhColors.BorderSoft)

            if (!errorBanner.isNullOrBlank()) {
                Surface(
                    color = EhColors.ErrorBg,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorBanner,
                        color = EhColors.ErrorFg,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            if (!editMode) {
                Surface(
                    color = EhColors.SurfaceVariant,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CompactDetailCell("Cliente", pedido.clienteNombre, Modifier.weight(1f))
                            CompactDetailCell(
                                "Teléfono",
                                pedido.clienteTelefono.ifBlank { "Sin teléfono" },
                                Modifier.weight(1f)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CompactDetailCell(
                                "Correo",
                                pedido.clienteEmail ?: "Sin correo",
                                Modifier.weight(1f)
                            )
                            CompactDetailCell("Dirección", pedido.direccionEnvio, Modifier.weight(1f))
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CompactDetailCell(
                                "Entrega",
                                "${AdminFormatters.formatDateDisplay(pedido.fechaEntrega)} · ${AdminFormatters.formatHora12h(pedido.horaEntrega)}",
                                Modifier.weight(1f)
                            )
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(3.dp)
                            ) {
                                Text(
                                    text = "Pago",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = EhColors.TextSecondary
                                )
                                PaymentBrandBadge(metodoPago = pedido.metodoPago)
                            }
                        }

                        HorizontalDivider(color = EhColors.BorderSoft)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Total", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.TextSecondary)
                                Text(
                                    text = AdminFormatters.formatMoney(pedido.total),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = EhColors.PrimaryDark
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Adelanto", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.TextSecondary)
                                Text(
                                    text = AdminFormatters.formatMoney(pedido.adelanto),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = EhColors.SuccessFg
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Saldo", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.TextSecondary)
                                Text(
                                    text = AdminFormatters.formatMoney(pedido.saldoPendiente),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (pedido.saldoPendiente > 0.0) EhColors.WarningFg else EhColors.SuccessFg
                                )
                            }
                        }
                    }
                }

                if (pedido.items.isNotEmpty()) {
                    Text(
                        text = "Productos",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    Surface(
                        color = EhColors.SurfaceVariant,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            pedido.items.forEach { item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${item.cantidad}x ${item.nombre}",
                                        fontSize = 13.sp,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = AdminFormatters.formatMoney(item.precio * item.cantidad),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = EhColors.PrimaryDark
                                    )
                                }
                            }
                        }
                    }
                }

                pedido.notas?.let { DetailLine("Notas", it) }

                Text(
                    text = "Cambio Rápido de Estado",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AdminFormatters.PEDIDO_ESTADOS.forEach { (key, label) ->
                        val current = pedido.estado.equals(key, ignoreCase = true)
                        FilterChip(
                            selected = current,
                            enabled = !isMutating && !current,
                            onClick = { onUpdateEstado(key) },
                            label = { Text(label, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = EhColors.PrimaryDark,
                                selectedLabelColor = Color.White,
                            )
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { editMode = true },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Editar", fontWeight = FontWeight.Bold)
                    }
                    if (AdminFormatters.normalizeWhatsAppPhone(pedido.clienteTelefono) != null) {
                        Button(
                            onClick = onWhatsApp,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            BrandIcon(R.drawable.ic_brand_whatsapp, size = 18.dp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("WhatsApp", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    enabled = !isMutating,
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = EhColors.ErrorFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp)
                ) {
                    Icon(Icons.Outlined.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Eliminar pedido permanentemente", fontWeight = FontWeight.Bold)
                }
            } else {
                // MODO EDICIÓN COMPLETA (Gestionar Pedido)
                OutlinedButton(
                    onClick = { showClientPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.Primary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Outlined.PersonSearch, contentDescription = null, tint = EhColors.PrimaryDark, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Cambiar cliente desde directorio (${directory.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                }

                OutlinedTextField(
                    value = editNombre,
                    onValueChange = { editNombre = it },
                    label = { Text("Cliente") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = editTel,
                        onValueChange = { editTel = it },
                        label = { Text("Teléfono") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = editEmail,
                        onValueChange = { editEmail = it },
                        label = { Text("Correo") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = editDir,
                    onValueChange = { editDir = it },
                    label = { Text("Dirección de entrega") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Fecha y hora de entrega", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FilterChip(
                        selected = editFecha == AdminFormatters.dateOffsetYmd(0),
                        onClick = {
                            editFecha = AdminFormatters.dateOffsetYmd(0)
                            if (editHora.isBlank()) editHora = AdminFormatters.DEFAULT_DELIVERY_TIME
                        },
                        label = { Text("Hoy", fontSize = 12.sp) }
                    )
                    FilterChip(
                        selected = editFecha == AdminFormatters.dateOffsetYmd(1),
                        onClick = {
                            editFecha = AdminFormatters.dateOffsetYmd(1)
                            if (editHora.isBlank()) editHora = AdminFormatters.DEFAULT_DELIVERY_TIME
                        },
                        label = { Text("Mañana", fontSize = 12.sp) }
                    )
                    OutlinedButton(
                        onClick = {
                            showNativeDatePicker(context, editFecha) {
                                editFecha = it
                                if (editHora.isBlank()) editHora = AdminFormatters.DEFAULT_DELIVERY_TIME
                            }
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Outlined.CalendarToday, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (editFecha.isNotBlank()) AdminFormatters.formatDateDisplay(editFecha) else "Fecha", fontSize = 12.sp)
                    }
                }

                DeliveryTimeSelectorSection(
                    hora24 = editHora.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME },
                    hasDate = editFecha.isNotBlank(),
                    onChangeHora = { editHora = it },
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = editAdelanto,
                        onValueChange = { editAdelanto = it },
                        label = { Text("Adelanto S/") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedButton(
                        onClick = { editAdelanto = String.format(Locale.US, "%.2f", pedido.total) },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Cobrar 100%", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                val editAdelNum = (editAdelanto.replace(",", ".").toDoubleOrNull() ?: 0.0).coerceAtLeast(0.0)
                val editSaldo = (pedido.total - editAdelNum).coerceAtLeast(0.0)
                Text(
                    text = "Total: ${AdminFormatters.formatMoney(pedido.total)} · Saldo pendiente: ${AdminFormatters.formatMoney(editSaldo)}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = EhColors.PrimaryDark
                )

                BrandOptionSelector(
                    label = "Método de pago",
                    options = AdminFormatters.METODOS_PAGO,
                    selectedKey = editMetodoPago,
                    iconResForKey = ::paymentBrandDrawable,
                    onSelect = { editMetodoPago = it },
                )

                Text("Estado", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    AdminFormatters.PEDIDO_ESTADOS.forEach { (id, label) ->
                        FilterChip(
                            selected = editEstado.equals(id, true),
                            onClick = { editEstado = id },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }

                OutlinedTextField(
                    value = editNotas,
                    onValueChange = { editNotas = it },
                    label = { Text("Notas") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = { editMode = false },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("Cancelar")
                    }
                    Button(
                        enabled = !isMutating,
                        onClick = {
                            onUpdateFullPedido(
                                editNombre,
                                editTel,
                                editEmail.ifBlank { null },
                                editUsuarioId,
                                editDir.ifBlank { null },
                                editEstado,
                                editMetodoPago,
                                editAdelNum,
                                editFecha.ifBlank { null },
                                if (editFecha.isNotBlank()) editHora.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME } else null,
                                editNotas.ifBlank { null },
                            )
                            editMode = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                        modifier = Modifier.weight(1.4f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(if (isMutating) "Guardando..." else "Guardar Cambios", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { if (!isMutating) showDeleteConfirm = false },
            containerColor = Color.White,
            title = {
                Text(
                    text = "Eliminar Pedido #${pedido.id}",
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
            },
            text = {
                Text(
                    text = "Esta acción eliminará permanentemente el Pedido #${pedido.id} de Supabase (ideal para pedidos creados de prueba). Si deseas conservar el historial de una cancelación real, usa el estado \"Cancelado\".",
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )
            },
            dismissButton = {
                TextButton(
                    enabled = !isMutating,
                    onClick = { showDeleteConfirm = false }
                ) {
                    Text("Cancelar")
                }
            },
            confirmButton = {
                Button(
                    enabled = !isMutating,
                    onClick = {
                        showDeleteConfirm = false
                        onDelete()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Eliminar", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PersonalizadoDetailSheet(
    pers: PedidoPersonalizado,
    directory: List<DirectoryClient>,
    productos: List<CatalogProduct>,
    isMutating: Boolean,
    errorBanner: String?,
    onDismiss: () -> Unit,
    onRefreshData: () -> Unit,
    onUpdateEstado: (String) -> Unit,
    onDelete: () -> Unit,
    onUpdateFullPersonalizado: (
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
    onWhatsApp: () -> Unit,
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val estStyle = AdminFormatters.estadoStyle(pers.estado)

    var editMode by remember(pers.id) { mutableStateOf(false) }
    var showClientPicker by remember { mutableStateOf(false) }
    var showCatalogPicker by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember(pers.id) { mutableStateOf(false) }

    var editNombre by remember(pers.id) { mutableStateOf(pers.nombreCliente) }
    var editTel by remember(pers.id) { mutableStateOf(pers.telefono) }
    var editEmail by remember(pers.id) { mutableStateOf(pers.email.orEmpty()) }
    var editProd by remember(pers.id) { mutableStateOf(pers.productoNombre.orEmpty()) }
    var editPrecio by remember(pers.id) {
        mutableStateOf(pers.productoPrecio?.let { String.format(Locale.US, "%.2f", it) }.orEmpty())
    }
    var editDetalles by remember(pers.id) { mutableStateOf(pers.detalles) }
    var editColores by remember(pers.id) { mutableStateOf(pers.colores.orEmpty()) }
    var editTamano by remember(pers.id) { mutableStateOf(pers.tamano.orEmpty()) }
    var editExtras by remember(pers.id) { mutableStateOf(pers.extras.orEmpty()) }
    var editFecha by remember(pers.id) {
        mutableStateOf(
            AdminFormatters.extractLimaDateOnly(pers.fechaEntrega) ?: AdminFormatters.dateOffsetYmd(1)
        )
    }
    var editHora by remember(pers.id) { mutableStateOf(AdminFormatters.normalizeClock24h(pers.horaEntrega)) }
    var editEstado by remember(pers.id) { mutableStateOf(pers.estado) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
    ) {
        when {
            showClientPicker -> {
                BackHandler { showClientPicker = false }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 380.dp, max = 580.dp)
                ) {
                    ClientPickerContent(
                        directory = directory,
                        onSelect = { c ->
                            editNombre = c.nombre
                            c.telefono?.let { editTel = it }
                            c.email?.let { editEmail = it }
                            showClientPicker = false
                        },
                        onDismiss = { showClientPicker = false },
                        onRefresh = onRefreshData,
                        dismissIconIsBack = true,
                    )
                }
            }
            showCatalogPicker -> {
                BackHandler { showCatalogPicker = false }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 380.dp, max = 580.dp)
                ) {
                    CatalogProductPickerContent(
                        productos = productos,
                        onPickProduct = { prod ->
                            editProd = prod.nombre
                            if (prod.precio > 0.0) {
                                editPrecio = String.format(Locale.US, "%.2f", prod.precio)
                            }
                            showCatalogPicker = false
                        },
                        onDismiss = { showCatalogPicker = false },
                        onRefresh = onRefreshData,
                        dismissIconIsBack = true,
                    )
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 18.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Personalizado #${pers.id}",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    pers.productoNombre?.let {
                        Text(text = it, fontSize = 13.sp, color = EhColors.TextSecondary)
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                    IconButton(onClick = { editMode = !editMode }) {
                        Icon(
                            imageVector = Icons.Outlined.Edit,
                            contentDescription = "Editar personalizado",
                            tint = if (editMode) EhColors.Primary else EhColors.TextSecondary
                        )
                    }
                }
            }

            HorizontalDivider(color = EhColors.BorderSoft)

            if (!errorBanner.isNullOrBlank()) {
                Surface(
                    color = EhColors.ErrorBg,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorBanner,
                        color = EhColors.ErrorFg,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            if (!editMode) {
                Surface(
                    color = EhColors.SurfaceVariant,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CompactDetailCell("Cliente", pers.nombreCliente, Modifier.weight(1f))
                            CompactDetailCell(
                                "Teléfono",
                                pers.telefono.ifBlank { "Sin teléfono" },
                                Modifier.weight(1f)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CompactDetailCell(
                                "Entrega",
                                "${AdminFormatters.formatDateDisplay(pers.fechaEntrega)} · ${AdminFormatters.formatHora12h(pers.horaEntrega)}",
                                Modifier.weight(1f)
                            )
                            CompactDetailCell(
                                "Precio estimado",
                                pers.productoPrecio?.let { AdminFormatters.formatMoney(it) } ?: "Por cotizar",
                                Modifier.weight(1f)
                            )
                        }
                        if (!pers.email.isNullOrBlank() || !pers.colores.isNullOrBlank()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                CompactDetailCell(
                                    "Correo",
                                    pers.email ?: "Sin correo",
                                    Modifier.weight(1f)
                                )
                                CompactDetailCell(
                                    "Colores",
                                    pers.colores ?: "—",
                                    Modifier.weight(1f)
                                )
                            }
                        }
                        if (!pers.tamano.isNullOrBlank()) {
                            CompactDetailCell("Tamaño", pers.tamano, Modifier.fillMaxWidth())
                        }
                    }
                }
                DetailLine("Detalles", pers.detalles)
                pers.extras?.let { DetailLine("Extras", it) }

                Text(
                    text = "Cambiar Estado",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AdminFormatters.PERSONALIZADO_ESTADOS.forEach { (key, label) ->
                        val current = pers.estado.equals(key, ignoreCase = true)
                        FilterChip(
                            selected = current,
                            enabled = !isMutating && !current,
                            onClick = { onUpdateEstado(key) },
                            label = { Text(label, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = EhColors.PrimaryDark,
                                selectedLabelColor = Color.White,
                            )
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { editMode = true },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Editar", fontWeight = FontWeight.Bold)
                    }
                    if (AdminFormatters.normalizeWhatsAppPhone(pers.telefono) != null) {
                        Button(
                            onClick = onWhatsApp,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            BrandIcon(R.drawable.ic_brand_whatsapp, size = 18.dp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("WhatsApp", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    enabled = !isMutating,
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = EhColors.ErrorFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp)
                ) {
                    Icon(Icons.Outlined.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Eliminar pedido permanentemente", fontWeight = FontWeight.Bold)
                }
            } else {
                OutlinedButton(
                    onClick = { showClientPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.Primary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Outlined.PersonSearch, contentDescription = null, tint = EhColors.PrimaryDark, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Elegir cliente del directorio (${directory.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                }

                OutlinedTextField(
                    value = editNombre,
                    onValueChange = { editNombre = it },
                    label = { Text("Cliente *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = editTel,
                        onValueChange = { editTel = it },
                        label = { Text("Teléfono *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = editEmail,
                        onValueChange = { editEmail = it },
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedButton(
                    onClick = { showCatalogPicker = true },
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.Primary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Outlined.Inventory2, contentDescription = null, tint = EhColors.PrimaryDark, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Elegir del catálogo (${productos.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = editProd,
                        onValueChange = { editProd = it },
                        label = { Text("Producto") },
                        singleLine = true,
                        modifier = Modifier.weight(1.3f)
                    )
                    OutlinedTextField(
                        value = editPrecio,
                        onValueChange = { editPrecio = it },
                        label = { Text("Precio S/") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = editDetalles,
                    onValueChange = { editDetalles = it },
                    label = { Text("Detalles *") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = editColores,
                        onValueChange = { editColores = it },
                        label = { Text("Colores") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = editTamano,
                        onValueChange = { editTamano = it },
                        label = { Text("Tamaño") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = editExtras,
                    onValueChange = { editExtras = it },
                    label = { Text("Extras") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedButton(
                    onClick = { showNativeDatePicker(context, editFecha) { editFecha = it } },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Outlined.CalendarToday, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Fecha: ${AdminFormatters.formatDateDisplay(editFecha)}", fontSize = 12.sp)
                }

                DeliveryTimeSelectorSection(
                    hora24 = editHora.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME },
                    hasDate = editFecha.isNotBlank(),
                    onChangeHora = { editHora = it },
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    AdminFormatters.PERSONALIZADO_ESTADOS.forEach { (id, label) ->
                        FilterChip(
                            selected = editEstado.equals(id, true),
                            onClick = { editEstado = id },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = { editMode = false },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("Cancelar")
                    }
                    Button(
                        enabled = !isMutating,
                        onClick = {
                            if (editNombre.isBlank() || editTel.isBlank() || editDetalles.isBlank()) return@Button
                            onUpdateFullPersonalizado(
                                editNombre,
                                editTel,
                                editEmail.ifBlank { null },
                                editProd.ifBlank { null },
                                editPrecio.replace(",", ".").toDoubleOrNull(),
                                editDetalles,
                                editColores.ifBlank { null },
                                editTamano.ifBlank { null },
                                editExtras.ifBlank { null },
                                editFecha,
                                editHora.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME },
                                editEstado,
                            )
                            editMode = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                        modifier = Modifier.weight(1.4f),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(if (isMutating) "Guardando..." else "Guardar Cambios", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { if (!isMutating) showDeleteConfirm = false },
            containerColor = Color.White,
            title = {
                Text(
                    text = "Eliminar Personalizado #${pers.id}",
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
            },
            text = {
                Text(
                    text = "Esta acción eliminará permanentemente el pedido personalizado #${pers.id} de Supabase (ideal para registros creados de prueba). Si deseas conservarlo en el historial, cambia su estado a \"Cancelado\".",
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )
            },
            dismissButton = {
                TextButton(
                    enabled = !isMutating,
                    onClick = { showDeleteConfirm = false }
                ) {
                    Text("Cancelar")
                }
            },
            confirmButton = {
                Button(
                    enabled = !isMutating,
                    onClick = {
                        showDeleteConfirm = false
                        onDelete()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Eliminar", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

@Composable
private fun CompactDetailCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.TextSecondary)
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = EhColors.TextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.TextSecondary)
        Text(text = value, fontSize = 14.sp, color = EhColors.TextPrimary)
    }
}

private data class DraftPedidoItem(
    val nombre: String = "",
    val cantidad: Int = 1,
    val precio: String = "",
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AgendarPedidoDialog(
    directory: List<DirectoryClient>,
    productos: List<CatalogProduct>,
    prefilledClient: DirectoryClient?,
    isSaving: Boolean,
    onRefreshData: () -> Unit,
    onDismiss: () -> Unit,
    onSave: (
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
) {
    val context = LocalContext.current

    var origen by rememberSaveable { mutableStateOf("whatsapp") }
    var usuarioId by rememberSaveable(prefilledClient?.key) { mutableStateOf(prefilledClient?.usuarioId) }
    var clienteNombre by rememberSaveable(prefilledClient?.key) { mutableStateOf(prefilledClient?.nombre.orEmpty()) }
    var clienteTelefono by rememberSaveable(prefilledClient?.key) { mutableStateOf(prefilledClient?.telefono.orEmpty()) }
    var clienteEmail by rememberSaveable(prefilledClient?.key) { mutableStateOf(prefilledClient?.email.orEmpty()) }
    var direccion by rememberSaveable(prefilledClient?.key) { mutableStateOf(prefilledClient?.direccion.orEmpty()) }
    var fechaEntrega by rememberSaveable { mutableStateOf("") }
    var horaEntrega by rememberSaveable { mutableStateOf(AdminFormatters.DEFAULT_DELIVERY_TIME) }
    var metodoPago by rememberSaveable { mutableStateOf("yape") }
    var adelantoText by rememberSaveable { mutableStateOf("") }
    var estado by rememberSaveable { mutableStateOf("pendiente") }
    var notas by rememberSaveable { mutableStateOf("") }
    var formError by rememberSaveable { mutableStateOf<String?>(null) }

    var showClientPicker by remember { mutableStateOf(false) }
    var showCatalogPicker by remember { mutableStateOf(false) }

    val draftItems = remember { mutableStateListOf(DraftPedidoItem()) }

    val parsedItems = draftItems.mapNotNull { d ->
        val n = d.nombre.trim()
        val p = d.precio.replace(",", ".").toDoubleOrNull() ?: 0.0
        if (n.isEmpty()) null else PedidoItem(nombre = n, cantidad = d.cantidad.coerceAtLeast(1), precio = p)
    }
    val total = parsedItems.sumOf { it.precio * it.cantidad }
    val adelanto = (adelantoText.replace(",", ".").toDoubleOrNull() ?: 0.0).coerceAtLeast(0.0)
    val saldo = (total - adelanto).coerceAtLeast(0.0)

    BackHandler {
        when {
            showCatalogPicker -> showCatalogPicker = false
            showClientPicker -> showClientPicker = false
            else -> onDismiss()
        }
    }

    val containerInteraction = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable(interactionSource = containerInteraction, indication = null) {}
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .imePadding(),
            color = EhColors.Background
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Surface(color = Color.White, shadowElevation = 2.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Outlined.Close, contentDescription = "Cerrar")
                        }
                        Text(
                            text = "Agendar Pedido",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.PrimaryDark
                        )
                        Spacer(modifier = Modifier.width(48.dp))
                    }
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (!formError.isNullOrBlank()) {
                        Surface(
                            color = EhColors.ErrorBg,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = formError!!,
                                color = EhColors.ErrorFg,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    BrandOptionSelector(
                        label = "Canal de origen",
                        options = AdminFormatters.CANALES_ORIGEN,
                        selectedKey = origen,
                        iconResForKey = ::channelBrandDrawable,
                        onSelect = { origen = it },
                    )

                    // Tarjeta de cliente + selector de registrados / previos
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Cliente", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                                OutlinedButton(
                                    onClick = { showClientPicker = true },
                                    shape = RoundedCornerShape(10.dp),
                                    border = BorderStroke(1.dp, EhColors.Primary)
                                ) {
                                    Icon(Icons.Outlined.PersonSearch, contentDescription = null, modifier = Modifier.size(16.dp), tint = EhColors.PrimaryDark)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Elegir existente (${directory.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                                }
                            }

                            if (!usuarioId.isNullOrBlank()) {
                                Surface(
                                    color = EhColors.SuccessBg,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = EhColors.SuccessFg, modifier = Modifier.size(14.dp))
                                            Text("Vinculado a cuenta registrada", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EhColors.SuccessFg)
                                        }
                                        Text(
                                            text = "Quitar",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = EhColors.TextSecondary,
                                            modifier = Modifier.clickable { usuarioId = null }
                                        )
                                    }
                                }
                            }

                            OutlinedTextField(
                                value = clienteNombre,
                                onValueChange = {
                                    clienteNombre = it
                                    usuarioId = null
                                },
                                label = { Text("Nombre del cliente *") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = clienteTelefono,
                                    onValueChange = { clienteTelefono = it },
                                    label = { Text("Teléfono / WSP") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedTextField(
                                    value = clienteEmail,
                                    onValueChange = { clienteEmail = it },
                                    label = { Text("Email (opc.)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            OutlinedTextField(
                                value = direccion,
                                onValueChange = { direccion = it },
                                label = { Text("Dirección de entrega") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Text("Fecha y Hora de Entrega", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.dateOffsetYmd(0),
                            onClick = { fechaEntrega = AdminFormatters.dateOffsetYmd(0) },
                            label = { Text("Hoy", fontSize = 12.sp) }
                        )
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.dateOffsetYmd(1),
                            onClick = { fechaEntrega = AdminFormatters.dateOffsetYmd(1) },
                            label = { Text("Mañana", fontSize = 12.sp) }
                        )
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.nextSaturdayYmd(),
                            onClick = { fechaEntrega = AdminFormatters.nextSaturdayYmd() },
                            label = { Text("Sábado", fontSize = 12.sp) }
                        )
                        OutlinedButton(
                            onClick = { showNativeDatePicker(context, fechaEntrega) { fechaEntrega = it } },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Outlined.CalendarToday, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (fechaEntrega.isNotBlank()) AdminFormatters.formatDateDisplay(fechaEntrega) else "Calendario",
                                fontSize = 12.sp
                            )
                        }
                    }

                    DeliveryTimeSelectorSection(
                        hora24 = horaEntrega,
                        hasDate = fechaEntrega.isNotBlank(),
                        onChangeHora = { horaEntrega = it },
                    )

                    // Productos del pedido + buscador de catálogo
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Productos *", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedButton(
                                onClick = { showCatalogPicker = true },
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, EhColors.Primary)
                            ) {
                                Icon(Icons.Outlined.Inventory2, contentDescription = null, modifier = Modifier.size(15.dp), tint = EhColors.PrimaryDark)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Catálogo (${productos.size})", fontSize = 11.sp, color = EhColors.PrimaryDark, fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = { draftItems.add(DraftPedidoItem()) },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(15.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Manual", fontSize = 11.sp)
                            }
                        }
                    }

                    if (draftItems.size == 1 && draftItems.first().nombre.isBlank()) {
                        OutlinedButton(
                            onClick = { showCatalogPicker = true },
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, EhColors.Primary),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Outlined.Inventory2, contentDescription = null, modifier = Modifier.size(17.dp), tint = EhColors.PrimaryDark)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Elegir producto del catálogo (${productos.size})",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark
                            )
                        }
                    }

                    draftItems.forEachIndexed { idx, item ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, EhColors.BorderSoft),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    OutlinedTextField(
                                        value = item.nombre,
                                        onValueChange = { draftItems[idx] = item.copy(nombre = it) },
                                        label = { Text("Producto #${idx + 1}") },
                                        singleLine = true,
                                        modifier = Modifier.weight(1f)
                                    )
                                    if (draftItems.size > 1) {
                                        IconButton(onClick = { draftItems.removeAt(idx) }) {
                                            Icon(Icons.Outlined.Delete, contentDescription = "Quitar", tint = EhColors.ErrorFg)
                                        }
                                    }
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    // Stepper de cantidad
                                    Surface(
                                        color = EhColors.SurfaceVariant,
                                        shape = RoundedCornerShape(12.dp),
                                        border = BorderStroke(1.dp, EhColors.BorderSoft)
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = {
                                                    if (item.cantidad > 1) {
                                                        draftItems[idx] = item.copy(cantidad = item.cantidad - 1)
                                                    }
                                                },
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Icon(Icons.Outlined.Remove, contentDescription = "Menos", modifier = Modifier.size(16.dp))
                                            }
                                            Text(
                                                text = item.cantidad.toString(),
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp)
                                            )
                                            IconButton(
                                                onClick = { draftItems[idx] = item.copy(cantidad = item.cantidad + 1) },
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Icon(Icons.Outlined.Add, contentDescription = "Más", modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }

                                    OutlinedTextField(
                                        value = item.precio,
                                        onValueChange = { draftItems[idx] = item.copy(precio = it) },
                                        label = { Text("Precio S/") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                        singleLine = true,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }

                    // Adelanto + Atajos
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = adelantoText,
                            onValueChange = { adelantoText = it },
                            label = { Text("Adelanto S/") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Surface(
                            color = EhColors.PrimarySoft,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .padding(top = 6.dp)
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text("Total: ${AdminFormatters.formatMoney(total)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                                Text("Saldo: ${AdminFormatters.formatMoney(saldo)}", fontSize = 11.sp, color = EhColors.TextSecondary)
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { adelantoText = "0" },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("S/ 0", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { adelantoText = String.format(Locale.US, "%.2f", total / 2.0) },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("50%", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { adelantoText = String.format(Locale.US, "%.2f", total) },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("100% Pagado", fontSize = 11.sp)
                        }
                    }

                    BrandOptionSelector(
                        label = "Método de pago",
                        options = AdminFormatters.METODOS_PAGO,
                        selectedKey = metodoPago,
                        iconResForKey = ::paymentBrandDrawable,
                        onSelect = { metodoPago = it },
                    )

                    Text("Estado inicial", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("pendiente" to "Pendiente", "confirmado" to "Confirmado", "en_produccion" to "En confección").forEach { (id, label) ->
                            FilterChip(
                                selected = estado == id,
                                onClick = { estado = id },
                                label = { Text(label, fontSize = 12.sp) }
                            )
                        }
                    }

                    OutlinedTextField(
                        value = notas,
                        onValueChange = { notas = it },
                        label = { Text("Notas / Dedicatoria") },
                        maxLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Surface(color = Color.White, shadowElevation = 6.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Cancelar")
                        }
                        Button(
                            enabled = !isSaving,
                            onClick = {
                                if (clienteNombre.trim().isEmpty()) {
                                    formError = "Ingresa el nombre del cliente."
                                    return@Button
                                }
                                if (parsedItems.isEmpty()) {
                                    formError = "Agrega al menos un producto."
                                    return@Button
                                }
                                formError = null
                                onSave(
                                    origen,
                                    usuarioId,
                                    clienteNombre,
                                    clienteTelefono,
                                    clienteEmail.ifBlank { null },
                                    direccion.ifBlank { null },
                                    parsedItems,
                                    total,
                                    adelanto,
                                    fechaEntrega.ifBlank { null },
                                    if (fechaEntrega.isNotBlank()) horaEntrega.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME } else null,
                                    metodoPago,
                                    estado,
                                    notas.ifBlank { null },
                                )
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                            modifier = Modifier.weight(1.4f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text(
                                text = if (isSaving) "Guardando..." else "Guardar Pedido",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        if (showClientPicker) {
            ClientPickerOverlay(
                directory = directory,
                onSelect = { c ->
                    clienteNombre = c.nombre
                    c.telefono?.let { clienteTelefono = it }
                    c.email?.let { clienteEmail = it }
                    c.direccion?.let { direccion = it }
                    usuarioId = c.usuarioId
                    showClientPicker = false
                },
                onDismiss = { showClientPicker = false },
                onRefresh = onRefreshData,
            )
        }

        if (showCatalogPicker) {
            CatalogProductPickerOverlay(
                productos = productos,
                onPickProduct = { prod ->
                    val emptyIdx = draftItems.indexOfFirst { it.nombre.isBlank() }
                    val existingIdx = draftItems.indexOfFirst { it.nombre.equals(prod.nombre, ignoreCase = true) }
                    when {
                        existingIdx >= 0 -> {
                            val cur = draftItems[existingIdx]
                            draftItems[existingIdx] = cur.copy(cantidad = cur.cantidad + 1)
                        }
                        emptyIdx >= 0 -> {
                            draftItems[emptyIdx] = DraftPedidoItem(
                                nombre = prod.nombre,
                                cantidad = 1,
                                precio = String.format(Locale.US, "%.2f", prod.precio)
                            )
                        }
                        else -> {
                            draftItems.add(
                                DraftPedidoItem(
                                    nombre = prod.nombre,
                                    cantidad = 1,
                                    precio = String.format(Locale.US, "%.2f", prod.precio)
                                )
                            )
                        }
                    }
                    showCatalogPicker = false
                },
                onDismiss = { showCatalogPicker = false },
                onRefresh = onRefreshData,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AgendarPersonalizadoDialog(
    directory: List<DirectoryClient>,
    productos: List<CatalogProduct>,
    isSaving: Boolean,
    onRefreshData: () -> Unit,
    onDismiss: () -> Unit,
    onSave: (
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
) {
    val context = LocalContext.current

    var nombre by rememberSaveable { mutableStateOf("") }
    var telefono by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var productoNombre by rememberSaveable { mutableStateOf("") }
    var productoPrecioText by rememberSaveable { mutableStateOf("") }
    var detalles by rememberSaveable { mutableStateOf("") }
    var colores by rememberSaveable { mutableStateOf("") }
    var tamano by rememberSaveable { mutableStateOf("") }
    var extras by rememberSaveable { mutableStateOf("") }
    var fechaEntrega by rememberSaveable { mutableStateOf(AdminFormatters.dateOffsetYmd(2)) }
    var horaEntrega by rememberSaveable { mutableStateOf(AdminFormatters.DEFAULT_DELIVERY_TIME) }
    var estado by rememberSaveable { mutableStateOf("pendiente") }
    var formError by rememberSaveable { mutableStateOf<String?>(null) }
    var showClientPicker by remember { mutableStateOf(false) }
    var showCatalogPicker by remember { mutableStateOf(false) }

    BackHandler {
        when {
            showCatalogPicker -> showCatalogPicker = false
            showClientPicker -> showClientPicker = false
            else -> onDismiss()
        }
    }

    val containerInteraction = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable(interactionSource = containerInteraction, indication = null) {}
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .imePadding(),
            color = EhColors.Background
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Surface(color = Color.White, shadowElevation = 2.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Outlined.Close, contentDescription = "Cerrar")
                        }
                        Text(
                            text = "Nuevo Personalizado",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.PrimaryDark
                        )
                        Spacer(modifier = Modifier.width(48.dp))
                    }
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (!formError.isNullOrBlank()) {
                        Surface(
                            color = EhColors.ErrorBg,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = formError!!,
                                color = EhColors.ErrorFg,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    OutlinedButton(
                        onClick = { showClientPicker = true },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EhColors.Primary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.PersonSearch, contentDescription = null, tint = EhColors.PrimaryDark, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Elegir cliente existente (${directory.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    }

                    OutlinedTextField(
                        value = nombre,
                        onValueChange = { nombre = it },
                        label = { Text("Nombre del cliente *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = telefono,
                            onValueChange = { telefono = it },
                            label = { Text("Teléfono *") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email (opc.)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    OutlinedButton(
                        onClick = { showCatalogPicker = true },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EhColors.Primary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Outlined.Inventory2, contentDescription = null, tint = EhColors.PrimaryDark, modifier = Modifier.size(17.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Elegir producto base del catálogo (${productos.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = productoNombre,
                            onValueChange = { productoNombre = it },
                            label = { Text("Producto base (opc.)") },
                            singleLine = true,
                            modifier = Modifier.weight(1.3f)
                        )
                        OutlinedTextField(
                            value = productoPrecioText,
                            onValueChange = { productoPrecioText = it },
                            label = { Text("Precio S/") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    OutlinedTextField(
                        value = detalles,
                        onValueChange = { detalles = it },
                        label = { Text("Descripción del diseño / encargo *") },
                        minLines = 2,
                        maxLines = 4,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = colores,
                            onValueChange = { colores = it },
                            label = { Text("Colores") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = tamano,
                            onValueChange = { tamano = it },
                            label = { Text("Tamaño") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    OutlinedTextField(
                        value = extras,
                        onValueChange = { extras = it },
                        label = { Text("Extras / Accesorios") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("Fecha de Entrega *", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.dateOffsetYmd(0),
                            onClick = { fechaEntrega = AdminFormatters.dateOffsetYmd(0) },
                            label = { Text("Hoy", fontSize = 12.sp) }
                        )
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.dateOffsetYmd(1),
                            onClick = { fechaEntrega = AdminFormatters.dateOffsetYmd(1) },
                            label = { Text("Mañana", fontSize = 12.sp) }
                        )
                        FilterChip(
                            selected = fechaEntrega == AdminFormatters.dateOffsetYmd(3),
                            onClick = { fechaEntrega = AdminFormatters.dateOffsetYmd(3) },
                            label = { Text("En 3 días", fontSize = 12.sp) }
                        )
                        OutlinedButton(
                            onClick = { showNativeDatePicker(context, fechaEntrega) { fechaEntrega = it } },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Outlined.CalendarToday, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(AdminFormatters.formatDateDisplay(fechaEntrega), fontSize = 12.sp)
                        }
                    }

                    DeliveryTimeSelectorSection(
                        hora24 = horaEntrega,
                        hasDate = fechaEntrega.isNotBlank(),
                        onChangeHora = { horaEntrega = it },
                    )

                    Text("Estado inicial", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("pendiente" to "Pendiente", "confirmado" to "Confirmado", "en_produccion" to "En confección").forEach { (id, label) ->
                            FilterChip(
                                selected = estado == id,
                                onClick = { estado = id },
                                label = { Text(label, fontSize = 12.sp) }
                            )
                        }
                    }
                }

                Surface(color = Color.White, shadowElevation = 6.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Cancelar")
                        }
                        Button(
                            enabled = !isSaving,
                            onClick = {
                                if (nombre.trim().isEmpty()) {
                                    formError = "Ingresa el nombre del cliente."
                                    return@Button
                                }
                                if (telefono.trim().isEmpty()) {
                                    formError = "Ingresa el teléfono del cliente."
                                    return@Button
                                }
                                if (detalles.trim().isEmpty()) {
                                    formError = "Describe el pedido personalizado."
                                    return@Button
                                }
                                if (fechaEntrega.trim().isEmpty()) {
                                    formError = "Selecciona la fecha de entrega."
                                    return@Button
                                }
                                val precioParsed = productoPrecioText.replace(",", ".").toDoubleOrNull()
                                formError = null
                                onSave(
                                    nombre,
                                    telefono,
                                    email.ifBlank { null },
                                    productoNombre.ifBlank { null },
                                    precioParsed,
                                    detalles,
                                    colores.ifBlank { null },
                                    tamano.ifBlank { null },
                                    extras.ifBlank { null },
                                    fechaEntrega,
                                    horaEntrega.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME },
                                    estado,
                                )
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                            modifier = Modifier.weight(1.4f),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text(
                                text = if (isSaving) "Guardando..." else "Guardar Personalizado",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        if (showClientPicker) {
            ClientPickerOverlay(
                directory = directory,
                onSelect = { c ->
                    nombre = c.nombre
                    c.telefono?.let { telefono = it }
                    c.email?.let { email = it }
                    showClientPicker = false
                },
                onDismiss = { showClientPicker = false },
                onRefresh = onRefreshData,
            )
        }

        if (showCatalogPicker) {
            CatalogProductPickerOverlay(
                productos = productos,
                onPickProduct = { prod ->
                    productoNombre = prod.nombre
                    if (prod.precio > 0.0) {
                        productoPrecioText = String.format(Locale.US, "%.2f", prod.precio)
                    }
                    showCatalogPicker = false
                },
                onDismiss = { showCatalogPicker = false },
                onRefresh = onRefreshData,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DeliveryTimeSelectorSection(
    hora24: String,
    hasDate: Boolean,
    onChangeHora: (String) -> Unit,
) {
    val context = LocalContext.current
    val effectiveHora = hora24.ifBlank { AdminFormatters.DEFAULT_DELIVERY_TIME }
    val presets = listOf(
        "08:00" to "8:00 a.m.",
        "10:00" to "10:00 a.m.",
        "12:00" to "12:00 p.m.",
        "15:00" to "3:00 p.m.",
        "18:00" to "6:00 p.m.",
    )

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "Hora exacta (por defecto 12:00 p.m.)",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = EhColors.PrimaryDark
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            presets.forEach { (val24, label) ->
                FilterChip(
                    selected = effectiveHora == val24,
                    onClick = { onChangeHora(val24) },
                    label = { Text(label, fontSize = 11.sp) }
                )
            }
            OutlinedButton(
                onClick = { showNativeTimePicker(context, effectiveHora, onChangeHora) },
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Elegir hora: ${AdminFormatters.formatHora12h(effectiveHora)}", fontSize = 11.sp)
            }
        }
        if (hasDate) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(
                    Icons.Outlined.Schedule,
                    contentDescription = null,
                    tint = EhColors.PrimaryDark,
                    modifier = Modifier.size(13.dp)
                )
                Text(
                    text = "Recordatorio diario a las ${AdminFormatters.formatHora12h(effectiveHora)} hasta la entrega",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = EhColors.PrimaryDark
                )
            }
        }
    }
}

private fun showNativeTimePicker(
    context: android.content.Context,
    currentHora: String,
    onPicked: (String) -> Unit,
) {
    val (initH, initM) = AdminFormatters.parseClock24h(currentHora)
    TimePickerDialog(
        context,
        { _, hourOfDay, minute ->
            onPicked(String.format(Locale.US, "%02d:%02d", hourOfDay, minute))
        },
        initH,
        initM,
        false
    ).show()
}

private fun showNativeDatePicker(
    context: android.content.Context,
    currentYmd: String,
    onPicked: (String) -> Unit,
) {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("America/Lima"))
    val parts = currentYmd.split("-")
    val initY = parts.getOrNull(0)?.toIntOrNull() ?: cal.get(Calendar.YEAR)
    val initM = (parts.getOrNull(1)?.toIntOrNull()?.minus(1)) ?: cal.get(Calendar.MONTH)
    val initD = parts.getOrNull(2)?.toIntOrNull() ?: cal.get(Calendar.DAY_OF_MONTH)

    DatePickerDialog(
        context,
        { _, year, month, dayOfMonth ->
            onPicked(String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, dayOfMonth))
        },
        initY,
        initM,
        initD
    ).show()
}
