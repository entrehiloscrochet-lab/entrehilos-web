package pe.entrehilos.admin.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.MarkEmailRead
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.ReportProblem
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.R
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.ClientAccountItem
import pe.entrehilos.admin.data.DirectoryClient
import pe.entrehilos.admin.data.MensajeContacto
import pe.entrehilos.admin.data.Pedido
import pe.entrehilos.admin.data.PedidoPersonalizado
import pe.entrehilos.admin.data.Reclamacion
import pe.entrehilos.admin.data.Resena
import pe.entrehilos.admin.data.Suscriptor
import pe.entrehilos.admin.data.UsuarioPerfil
import pe.entrehilos.admin.theme.EhColors
import pe.entrehilos.admin.viewmodel.AdminUiState
import pe.entrehilos.admin.viewmodel.ClientesSubTab

@Composable
fun ClientesScreen(
    state: AdminUiState,
    onSelectSubTab: (ClientesSubTab) -> Unit,
    onSearchChange: (String) -> Unit,
    onRefresh: () -> Unit,
    onMarcarMensajeLeido: (Long) -> Unit,
    onToggleAprobarResena: (Resena) -> Unit,
    onAgendarParaUsuario: (DirectoryClient) -> Unit,
    onOpenClientOrders: (ClientAccountItem) -> Unit,
    onOpenLinkClient: (ClientAccountItem) -> Unit,
    onRequestDeleteUser: (ClientAccountItem) -> Unit,
) {
    val context = LocalContext.current
    val q = AdminFormatters.normalizeClientKey(state.clientesSearch)
    var userFilter by rememberSaveable { mutableStateOf("todos") }

    val suscriptores = remember(state.suscriptores, q) {
        if (q.isEmpty()) state.suscriptores else state.suscriptores.filter {
            it.email.lowercase().contains(q) ||
                (it.nombre?.let { n -> AdminFormatters.normalizeClientKey(n).contains(q) } == true)
        }
    }
    val clientAccounts = remember(state.clientAccounts, q, userFilter) {
        state.clientAccounts.filter { c ->
            val matchesFilter = when (userFilter) {
                "registrados" -> c.isRegistered
                "sin_cuenta" -> !c.isRegistered
                else -> true
            }
            val matchesQuery = if (q.isEmpty()) true else {
                AdminFormatters.normalizeClientKey(c.nombre).contains(q) ||
                    (c.email?.lowercase()?.contains(q) == true) ||
                    (c.telefono?.lowercase()?.contains(q) == true) ||
                    (c.direccion?.let { d -> AdminFormatters.normalizeClientKey(d).contains(q) } == true)
            }
            matchesFilter && matchesQuery
        }
    }
    val mensajes = remember(state.mensajes, q) {
        if (q.isEmpty()) state.mensajes else state.mensajes.filter {
            AdminFormatters.normalizeClientKey(it.nombre).contains(q) ||
                it.email.lowercase().contains(q) ||
                AdminFormatters.normalizeClientKey(it.mensaje).contains(q) ||
                (it.asunto?.let { a -> AdminFormatters.normalizeClientKey(a).contains(q) } == true)
        }
    }
    val resenas = remember(state.resenas, q) {
        if (q.isEmpty()) state.resenas else state.resenas.filter {
            AdminFormatters.normalizeClientKey(it.nombreCliente).contains(q) ||
                (it.productoNombre?.let { p -> AdminFormatters.normalizeClientKey(p).contains(q) } == true) ||
                (it.comentario?.let { c -> AdminFormatters.normalizeClientKey(c).contains(q) } == true)
        }
    }
    val reclamaciones = remember(state.reclamaciones, q) {
        if (q.isEmpty()) state.reclamaciones else state.reclamaciones.filter {
            AdminFormatters.normalizeClientKey(it.nombreCompleto).contains(q) ||
                it.numeroDocumento.lowercase().contains(q) ||
                AdminFormatters.normalizeClientKey(it.detalle).contains(q)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Clientes y Atención",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = EhColors.PrimaryDark
            )
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Actualizar", tint = EhColors.PrimaryDark)
            }
        }

        // Barra fija de 5 columnas (CERO scroll horizontal)
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
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                ClientesSubTab.entries.forEach { tab ->
                    val selected = state.clientesSubTab == tab
                    val count = when (tab) {
                        ClientesSubTab.SUSCRIPTORES -> state.suscriptores.size
                        ClientesSubTab.USUARIOS -> state.clientAccounts.size
                        ClientesSubTab.MENSAJES -> state.mensajes.count { !it.leido }.let { unread ->
                            if (unread > 0) unread else state.mensajes.size
                        }
                        ClientesSubTab.RESENAS -> state.resenas.size
                        ClientesSubTab.RECLAMACIONES -> state.reclamaciones.size
                    }
                    val icon = when (tab) {
                        ClientesSubTab.SUSCRIPTORES -> Icons.Outlined.Email
                        ClientesSubTab.USUARIOS -> Icons.Outlined.People
                        ClientesSubTab.MENSAJES -> Icons.Outlined.Forum
                        ClientesSubTab.RESENAS -> Icons.Outlined.Star
                        ClientesSubTab.RECLAMACIONES -> Icons.Outlined.ReportProblem
                    }

                    Surface(
                        onClick = { onSelectSubTab(tab) },
                        shape = RoundedCornerShape(12.dp),
                        color = if (selected) EhColors.Primary else Color.Transparent,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier.padding(vertical = 7.dp, horizontal = 2.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = tab.label,
                                tint = if (selected) Color.White else EhColors.PrimaryDark,
                                modifier = Modifier.size(17.dp)
                            )
                            Text(
                                text = tab.label,
                                fontSize = 10.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (selected) Color.White else EhColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = count.toString(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (selected) Color.White.copy(alpha = 0.9f) else EhColors.TextSecondary,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }

        OutlinedTextField(
            value = state.clientesSearch,
            onValueChange = onSearchChange,
            placeholder = { Text("Buscar por nombre, correo o teléfono...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, tint = EhColors.Primary) },
            trailingIcon = {
                if (state.clientesSearch.isNotEmpty()) {
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
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp)
        )

        when (state.clientesSubTab) {
            ClientesSubTab.SUSCRIPTORES -> {
                if (suscriptores.isEmpty()) {
                    EmptyClientesBox("No hay suscriptores registrados.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(suscriptores, key = { it.id }) { s -> SuscriptorCard(s) }
                    }
                }
            }

            ClientesSubTab.USUARIOS -> {
                val totalReg = state.clientAccounts.count { it.isRegistered }
                val totalUnreg = state.clientAccounts.count { !it.isRegistered }

                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, end = 16.dp, bottom = 10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val pills = listOf(
                            Triple("todos", "Todos (${state.clientAccounts.size})", state.clientAccounts.size),
                            Triple("registrados", "Registrados ($totalReg)", totalReg),
                            Triple("sin_cuenta", "Sin cuenta ($totalUnreg)", totalUnreg),
                        )
                        pills.forEach { (key, label, _) ->
                            val selected = userFilter == key
                            Surface(
                                onClick = { userFilter = key },
                                shape = RoundedCornerShape(10.dp),
                                color = if (selected) EhColors.PrimaryDark else Color.Transparent,
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                                        color = if (selected) Color.White else EhColors.TextSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }

                if (clientAccounts.isEmpty()) {
                    EmptyClientesBox("No hay clientes o usuarios en esta vista.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(clientAccounts, key = { it.key }) { client ->
                            ClientAccountCard(
                                client = client,
                                currentSessionUserId = state.session?.userId,
                                isMutating = state.isMutating,
                                onWhatsApp = { openWhatsAppChat(context, client.telefono) },
                                onVerPedidos = { onOpenClientOrders(client) },
                                onAgendarPedido = {
                                    onAgendarParaUsuario(
                                        DirectoryClient(
                                            key = AdminFormatters.normalizeClientKey(client.nombre),
                                            usuarioId = client.usuarioId,
                                            nombre = client.nombre,
                                            telefono = client.telefono,
                                            email = client.email,
                                            direccion = client.direccion,
                                            origen = if (client.isRegistered) "Registrado" else "Pedido",
                                        )
                                    )
                                },
                                onDeleteUser = { onRequestDeleteUser(client) },
                                onVincularCuenta = { onOpenLinkClient(client) },
                            )
                        }
                    }
                }
            }

            ClientesSubTab.MENSAJES -> {
                if (mensajes.isEmpty()) {
                    EmptyClientesBox("No hay mensajes de contacto.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(mensajes, key = { it.id }) { m ->
                            MensajeCard(
                                mensaje = m,
                                isMutating = state.isMutating,
                                onMarcarLeido = { onMarcarMensajeLeido(m.id) },
                                onWhatsApp = { openWhatsAppChat(context, m.telefono, "Hola ${m.nombre}, sobre tu mensaje en Entre Hilos:") }
                            )
                        }
                    }
                }
            }

            ClientesSubTab.RESENAS -> {
                if (resenas.isEmpty()) {
                    EmptyClientesBox("No hay reseñas registradas.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(resenas, key = { it.id }) { r ->
                            ResenaCard(
                                resena = r,
                                isMutating = state.isMutating,
                                onToggleAprobar = { onToggleAprobarResena(r) }
                            )
                        }
                    }
                }
            }

            ClientesSubTab.RECLAMACIONES -> {
                if (reclamaciones.isEmpty()) {
                    EmptyClientesBox("No hay registros en el Libro de Reclamaciones.")
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(reclamaciones, key = { it.id }) { rec ->
                            ReclamacionCard(
                                rec = rec,
                                onWhatsApp = { openWhatsAppChat(context, rec.telefono) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyClientesBox(msg: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text = msg, fontSize = 14.sp, color = EhColors.TextSecondary)
    }
}

@Composable
private fun SuscriptorCard(s: Suscriptor) {
    val label = s.nombre?.takeIf { it.isNotBlank() } ?: s.email
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            UserAvatarCircle(name = label, size = 40.dp)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = label,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = s.email,
                    fontSize = 12.sp,
                    color = EhColors.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                val created = AdminFormatters.formatCreatedShort(s.createdAt)
                if (created.isNotBlank()) {
                    Text(text = "Suscrito: $created", fontSize = 11.sp, color = EhColors.TextSecondary)
                }
            }
            EhBadge(
                text = if (s.activo) "Activo" else "Inactivo",
                bgColor = if (s.activo) EhColors.SuccessBg else EhColors.GrayBg,
                fgColor = if (s.activo) EhColors.SuccessFg else EhColors.GrayFg
            )
        }
    }
}

@Composable
private fun ClientAccountCard(
    client: ClientAccountItem,
    currentSessionUserId: String?,
    isMutating: Boolean,
    onWhatsApp: () -> Unit,
    onVerPedidos: () -> Unit,
    onAgendarPedido: () -> Unit,
    onDeleteUser: () -> Unit,
    onVincularCuenta: () -> Unit,
) {
    val isAdmin = client.rol.equals("admin", true) || client.rol.equals("super_admin", true)
    val canDelete = client.isRegistered && !isAdmin && !client.usuarioId.isNullOrBlank() && client.usuarioId != currentSessionUserId
    val hasPhone = AdminFormatters.normalizeWhatsAppPhone(client.telefono) != null

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                UserAvatarCircle(name = client.nombre, isAdmin = isAdmin, size = 42.dp)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = client.nombre,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        val badgeColors = when {
                            !client.isRegistered -> EhColors.WarningBg to EhColors.WarningFg
                            isAdmin -> EhColors.PrimarySoft to EhColors.PrimaryDark
                            else -> EhColors.SuccessBg to EhColors.SuccessFg
                        }
                        EhBadge(
                            text = if (client.isRegistered) client.rol else "Sin cuenta",
                            bgColor = badgeColors.first,
                            fgColor = badgeColors.second
                        )
                    }
                    client.email?.takeIf { it.isNotBlank() }?.let { email ->
                        Text(
                            text = if (client.isRegistered) email else "Correo sync: $email",
                            fontSize = 12.sp,
                            fontWeight = if (client.isRegistered) FontWeight.Normal else FontWeight.Medium,
                            color = if (client.isRegistered) EhColors.TextSecondary else EhColors.SuccessFg,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    val contactDetails = listOfNotNull(
                        client.telefono?.takeIf { it.isNotBlank() },
                        client.direccion?.takeIf { it.isNotBlank() }
                    ).joinToString(" · ")
                    if (contactDetails.isNotBlank()) {
                        Text(
                            text = contactDetails,
                            fontSize = 11.sp,
                            color = EhColors.TextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    EhBadge(
                        text = "${client.totalPedidosCount} pedido(s) · ${AdminFormatters.formatMoney(client.totalGastado)}",
                        bgColor = EhColors.SurfaceVariant,
                        fgColor = EhColors.PrimaryDark,
                        borderColor = EhColors.BorderSoft
                    )
                }
                if (hasPhone) {
                    WhatsAppCircleButton(onClick = onWhatsApp, size = 36.dp)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onVerPedidos,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ReceiptLong,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = EhColors.PrimaryDark
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Ver pedidos (${client.totalPedidosCount})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                OutlinedButton(
                    onClick = onAgendarPedido,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.PrimarySoft),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Add,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = EhColors.PrimaryDark
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Agendar",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                if (canDelete) {
                    OutlinedIconButton(
                        onClick = onDeleteUser,
                        enabled = !isMutating,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0xFFFECACA)),
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.DeleteForever,
                            contentDescription = "Eliminar usuario",
                            tint = EhColors.ErrorFg,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            if (!client.isRegistered) {
                OutlinedButton(
                    onClick = onVincularCuenta,
                    enabled = !isMutating,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, EhColors.Primary),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Link,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = EhColors.PrimaryDark
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (client.email.isNullOrBlank()) {
                            "Vincular cuenta / Asignar correo sync"
                        } else {
                            "Cambiar correo sync o vincular cuenta"
                        },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

private sealed class ClientOrderEntry(val sortKey: String, val itemKey: String) {
    class Standard(val pedido: Pedido) : ClientOrderEntry(pedido.createdAt, "ped-${pedido.id}")
    class Custom(val pers: PedidoPersonalizado) : ClientOrderEntry(pers.createdAt, "pers-${pers.id}")
}

@Composable
fun ClientOrdersOverlay(
    client: ClientAccountItem,
    onOpenPedidoDetail: (Pedido) -> Unit,
    onOpenPersonalizadoDetail: (PedidoPersonalizado) -> Unit,
    onAgendarPedido: () -> Unit,
    onDismiss: () -> Unit,
) {
    BackHandler(onBack = onDismiss)
    val backdropInteraction = remember { MutableInteractionSource() }
    val sheetInteraction = remember { MutableInteractionSource() }

    val entries = remember(client.pedidos, client.personalizados) {
        (client.pedidos.map { ClientOrderEntry.Standard(it) } +
            client.personalizados.map { ClientOrderEntry.Custom(it) })
            .sortedByDescending { it.sortKey }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(interactionSource = backdropInteraction, indication = null, onClick = onDismiss)
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color.White,
            shadowElevation = 12.dp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.86f)
                .clickable(interactionSource = sheetInteraction, indication = null) {}
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp, bottom = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .width(40.dp)
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(EhColors.BorderSoft)
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = client.nombre,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.PrimaryDark,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )
                            EhBadge(
                                text = if (client.isRegistered) client.rol else "Sin cuenta",
                                bgColor = if (client.isRegistered) EhColors.SuccessBg else EhColors.WarningBg,
                                fgColor = if (client.isRegistered) EhColors.SuccessFg else EhColors.WarningFg
                            )
                        }
                        Text(
                            text = "${client.totalPedidosCount} pedido(s) · Total ${AdminFormatters.formatMoney(client.totalGastado)}",
                            fontSize = 12.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = "Cerrar")
                    }
                }

                HorizontalDivider(color = EhColors.BorderSoft)

                if (entries.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Este cliente aún no tiene pedidos registrados.",
                            fontSize = 14.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(entries, key = { it.itemKey }) { entry ->
                            when (entry) {
                                is ClientOrderEntry.Standard -> {
                                    val ped = entry.pedido
                                    val estStyle = AdminFormatters.estadoStyle(ped.estado)
                                    val itemsText = if (ped.items.isNotEmpty()) {
                                        ped.items.joinToString(", ") { "${it.cantidad}x ${it.nombre}" }
                                    } else {
                                        "Sin detalle de productos"
                                    }
                                    Card(
                                        shape = RoundedCornerShape(14.dp),
                                        colors = CardDefaults.cardColors(containerColor = EhColors.SurfaceVariant),
                                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { onOpenPedidoDetail(ped) }
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(12.dp),
                                            verticalArrangement = Arrangement.spacedBy(6.dp)
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
                                                        text = "Pedido #${ped.id}",
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = EhColors.PrimaryDark
                                                    )
                                                    ChannelBrandBadge(origen = ped.origen, compact = true)
                                                }
                                                EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                                            }
                                            Text(
                                                text = itemsText,
                                                fontSize = 12.sp,
                                                color = EhColors.TextPrimary,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    PaymentBrandBadge(metodoPago = ped.metodoPago)
                                                    val fecha = AdminFormatters.formatDateDisplay(ped.fechaEntrega ?: ped.createdAt)
                                                    Text(text = fecha, fontSize = 11.sp, color = EhColors.TextSecondary)
                                                }
                                                Text(
                                                    text = AdminFormatters.formatMoney(ped.total),
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = EhColors.PrimaryDark
                                                )
                                            }
                                        }
                                    }
                                }

                                is ClientOrderEntry.Custom -> {
                                    val pers = entry.pers
                                    val estStyle = AdminFormatters.estadoStyle(pers.estado)
                                    Card(
                                        shape = RoundedCornerShape(14.dp),
                                        colors = CardDefaults.cardColors(containerColor = EhColors.SurfaceVariant),
                                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { onOpenPersonalizadoDetail(pers) }
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(12.dp),
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
                                                        text = "Personalizado #${pers.id}",
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = EhColors.PrimaryDark
                                                    )
                                                    pers.productoNombre?.let {
                                                        EhBadge(text = it, bgColor = EhColors.PurpleBg, fgColor = EhColors.PurpleFg)
                                                    }
                                                }
                                                EhBadge(text = estStyle.label, bgColor = estStyle.bg, fgColor = estStyle.fg)
                                            }
                                            Text(
                                                text = pers.detalles,
                                                fontSize = 12.sp,
                                                color = EhColors.TextPrimary,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "Entrega: ${AdminFormatters.formatDateDisplay(pers.fechaEntrega)}",
                                                    fontSize = 11.sp,
                                                    color = EhColors.TextSecondary
                                                )
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
                        }
                    }
                }

                Surface(color = Color.White, shadowElevation = 6.dp) {
                    Button(
                        onClick = onAgendarPedido,
                        colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Agendar pedido a ${client.nombre}",
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LinkClientAccountOverlay(
    client: ClientAccountItem,
    usuarios: List<UsuarioPerfil>,
    isMutating: Boolean,
    onAssignEmail: (email: String, onResult: (String?) -> Unit) -> Unit,
    onLinkToUser: (targetUserId: String, onResult: (String?) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    BackHandler(onBack = onDismiss)
    val backdropInteraction = remember { MutableInteractionSource() }
    val sheetInteraction = remember { MutableInteractionSource() }

    var emailInput by remember(client.key) { mutableStateOf(client.email.orEmpty()) }
    var searchUser by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var pendingLinkUser by remember { mutableStateOf<UsuarioPerfil?>(null) }

    val filteredUsers = remember(usuarios, searchUser) {
        val q = AdminFormatters.normalizeClientKey(searchUser)
        if (q.isEmpty()) usuarios else usuarios.filter { u ->
            (u.nombre?.let { AdminFormatters.normalizeClientKey(it).contains(q) } == true) ||
                u.email.lowercase().contains(q) ||
                (u.telefono?.lowercase()?.contains(q) == true)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(interactionSource = backdropInteraction, indication = null, onClick = onDismiss)
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color.White,
            shadowElevation = 12.dp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .imePadding()
                .clickable(interactionSource = sheetInteraction, indication = null) {}
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp, bottom = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .width(40.dp)
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(EhColors.BorderSoft)
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Sincronizar a ${client.nombre}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.PrimaryDark,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${client.totalPedidosCount} pedido(s) sin cuenta vinculada",
                            fontSize = 12.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Close, contentDescription = "Cerrar")
                    }
                }

                HorizontalDivider(color = EhColors.BorderSoft)

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (!localError.isNullOrBlank()) {
                        Surface(
                            color = EhColors.ErrorBg,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = localError!!,
                                color = EhColors.ErrorFg,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    Text(
                        text = "1. Guardar correo para sincronización automática",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    Text(
                        text = "Guarda el correo personal de ${client.nombre}. Si ya tiene cuenta se vincula al instante; si se registra en el futuro con ese correo o su teléfono, sus pedidos se asociarán automáticamente.",
                        fontSize = 12.sp,
                        color = EhColors.TextSecondary
                    )

                    OutlinedTextField(
                        value = emailInput,
                        onValueChange = {
                            emailInput = it
                            localError = null
                        },
                        label = { Text("Correo personal del cliente") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        enabled = !isMutating,
                        onClick = {
                            val clean = emailInput.trim()
                            if (clean.isEmpty() || !clean.contains("@") || !clean.contains(".")) {
                                localError = "Ingresa un correo electrónico válido."
                                return@Button
                            }
                            localError = null
                            onAssignEmail(clean) { err ->
                                if (err == null) onDismiss() else localError = err
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (isMutating) "Guardando..." else "Guardar correo personal",
                            fontWeight = FontWeight.Bold
                        )
                    }

                    HorizontalDivider(color = EhColors.BorderSoft, modifier = Modifier.padding(vertical = 4.dp))

                    Text(
                        text = "2. Vincular ahora a una cuenta ya registrada",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )

                    OutlinedTextField(
                        value = searchUser,
                        onValueChange = { searchUser = it },
                        placeholder = { Text("Buscar usuario registrado...", fontSize = 13.sp) },
                        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, tint = EhColors.Primary) },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (filteredUsers.isEmpty()) {
                        Text(
                            text = "No se encontraron usuarios registrados.",
                            fontSize = 13.sp,
                            color = EhColors.TextSecondary,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    } else {
                        filteredUsers.forEach { u ->
                            val uName = u.nombre?.takeIf { it.isNotBlank() } ?: u.email.substringBefore("@")
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = EhColors.SurfaceVariant),
                                border = BorderStroke(1.dp, EhColors.BorderSoft),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = !isMutating) { pendingLinkUser = u }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    UserAvatarCircle(name = uName, isAdmin = u.rol != "user", size = 36.dp)
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = uName,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = EhColors.TextPrimary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        val sub = listOfNotNull(
                                            u.email.takeIf { it.isNotBlank() },
                                            u.telefono?.takeIf { it.isNotBlank() }
                                        ).joinToString(" · ")
                                        Text(
                                            text = sub,
                                            fontSize = 11.sp,
                                            color = EhColors.TextSecondary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Outlined.Link,
                                        contentDescription = "Vincular",
                                        tint = EhColors.PrimaryDark,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pendingLinkUser?.let { target ->
        AlertDialog(
            onDismissRequest = { if (!isMutating) pendingLinkUser = null },
            containerColor = Color.White,
            title = {
                Text(
                    text = "Confirmar vinculación",
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
            },
            text = {
                Text(
                    text = "¿Vincular los ${client.totalPedidosCount} pedido(s) de ${client.nombre} a la cuenta ${target.email}?",
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )
            },
            dismissButton = {
                TextButton(enabled = !isMutating, onClick = { pendingLinkUser = null }) {
                    Text("Cancelar")
                }
            },
            confirmButton = {
                Button(
                    enabled = !isMutating,
                    onClick = {
                        val targetId = target.id
                        pendingLinkUser = null
                        onLinkToUser(targetId) { err ->
                            if (err == null) onDismiss() else localError = err
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary)
                ) {
                    Text("Vincular", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

@Composable
fun DeleteUserPasswordDialog(
    client: ClientAccountItem,
    isMutating: Boolean,
    onConfirmDelete: (adminPassword: String, deleteOrders: Boolean, onResult: (String?) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var deleteOrders by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!isMutating) onDismiss() },
        containerColor = Color.White,
        title = {
            Text(
                text = "Eliminar usuario",
                fontWeight = FontWeight.Bold,
                color = EhColors.PrimaryDark
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Vas a eliminar permanentemente a ${client.nombre} (${client.email ?: "sin correo"}). Se borrarán su acceso, perfil, wishlist, direcciones y carritos en Supabase.",
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )

                if (client.pedidos.isNotEmpty()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable(enabled = !isMutating) { deleteOrders = !deleteOrders }
                            .padding(vertical = 2.dp)
                    ) {
                        Checkbox(
                            checked = deleteOrders,
                            onCheckedChange = { if (!isMutating) deleteOrders = it },
                            colors = CheckboxDefaults.colors(checkedColor = Color(0xFFDC2626))
                        )
                        Text(
                            text = "Eliminar también sus ${client.pedidos.size} pedido(s) (útil si son de prueba)",
                            fontSize = 12.sp,
                            color = EhColors.TextPrimary
                        )
                    }
                }

                OutlinedTextField(
                    value = password,
                    onValueChange = {
                        password = it
                        errorMsg = null
                    },
                    label = { Text("Tu contraseña de administrador *") },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = if (showPassword) "Ocultar" else "Mostrar"
                            )
                        }
                    },
                    isError = !errorMsg.isNullOrBlank(),
                    modifier = Modifier.fillMaxWidth()
                )

                if (!errorMsg.isNullOrBlank()) {
                    Text(
                        text = errorMsg!!,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = EhColors.ErrorFg
                    )
                }
            }
        },
        dismissButton = {
            TextButton(enabled = !isMutating, onClick = onDismiss) {
                Text("Cancelar")
            }
        },
        confirmButton = {
            Button(
                enabled = !isMutating,
                onClick = {
                    if (password.isBlank()) {
                        errorMsg = "Ingresa tu contraseña de administrador."
                        return@Button
                    }
                    errorMsg = null
                    onConfirmDelete(password, deleteOrders) { err ->
                        if (err == null) onDismiss() else errorMsg = err
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
            ) {
                Text(
                    text = if (isMutating) "Verificando..." else "Verificar y eliminar",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    )
}

@Composable
private fun MensajeCard(
    mensaje: MensajeContacto,
    isMutating: Boolean,
    onMarcarLeido: () -> Unit,
    onWhatsApp: () -> Unit,
) {
    val hasPhone = AdminFormatters.normalizeWhatsAppPhone(mensaje.telefono) != null
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, if (mensaje.leido) EhColors.BorderSoft else EhColors.Primary),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                UserAvatarCircle(name = mensaje.nombre, isAdmin = !mensaje.leido, size = 38.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = mensaje.nombre,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.TextPrimary
                    )
                    Text(text = mensaje.email, fontSize = 12.sp, color = EhColors.TextSecondary)
                }
                EhBadge(
                    text = if (mensaje.leido) "Leído" else "Nuevo",
                    bgColor = if (mensaje.leido) EhColors.GrayBg else EhColors.PrimarySoft,
                    fgColor = if (mensaje.leido) EhColors.GrayFg else EhColors.PrimaryDark
                )
            }

            mensaje.asunto?.let {
                Text(text = it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
            }
            Text(text = mensaje.mensaje, fontSize = 13.sp, color = EhColors.TextPrimary)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!mensaje.leido) {
                    OutlinedButton(
                        enabled = !isMutating,
                        onClick = onMarcarLeido,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Outlined.DoneAll, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Marcar leído", fontSize = 12.sp)
                    }
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        Icon(Icons.Outlined.MarkEmailRead, contentDescription = null, tint = EhColors.TextSecondary, modifier = Modifier.size(15.dp))
                        Text("Atendido", fontSize = 11.sp, color = EhColors.TextSecondary)
                    }
                }
                if (hasPhone) {
                    OutlinedButton(
                        onClick = onWhatsApp,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        BrandIcon(R.drawable.ic_brand_whatsapp, size = 16.dp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("WhatsApp", fontSize = 12.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun ResenaCard(
    resena: Resena,
    isMutating: Boolean,
    onToggleAprobar: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    UserAvatarCircle(name = resena.nombreCliente, size = 36.dp)
                    Column {
                        Text(
                            text = resena.nombreCliente,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = EhColors.TextPrimary
                        )
                        resena.productoNombre?.let {
                            Text(text = it, fontSize = 12.sp, color = EhColors.TextSecondary)
                        }
                    }
                }
                EhBadge(
                    text = if (resena.aprobado) "Publicada" else "Pendiente",
                    bgColor = if (resena.aprobado) EhColors.SuccessBg else EhColors.WarningBg,
                    fgColor = if (resena.aprobado) EhColors.SuccessFg else EhColors.WarningFg
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                repeat(5) { idx ->
                    Icon(
                        imageVector = Icons.Outlined.Star,
                        contentDescription = null,
                        tint = if (idx < resena.calificacion) Color(0xFFF59E0B) else Color(0xFFD1D5DB),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            resena.comentario?.let {
                Text(text = it, fontSize = 13.sp, color = EhColors.TextPrimary)
            }

            OutlinedButton(
                enabled = !isMutating,
                onClick = onToggleAprobar,
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = if (resena.aprobado) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (resena.aprobado) "Ocultar reseña" else "Aprobar reseña", fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ReclamacionCard(
    rec: Reclamacion,
    onWhatsApp: () -> Unit,
) {
    val hasPhone = AdminFormatters.normalizeWhatsAppPhone(rec.telefono) != null
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, EhColors.BorderSoft),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${rec.nombreCompleto} (#${rec.id})",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                EhBadge(
                    text = rec.tipo.replaceFirstChar { it.uppercase() },
                    bgColor = if (rec.tipo.equals("reclamo", true)) EhColors.ErrorBg else EhColors.WarningBg,
                    fgColor = if (rec.tipo.equals("reclamo", true)) EhColors.ErrorFg else EhColors.WarningFg
                )
            }
            Text(
                text = "${rec.tipoDocumento}: ${rec.numeroDocumento} · ${rec.email}",
                fontSize = 12.sp,
                color = EhColors.TextSecondary
            )
            Text(
                text = "${rec.productoServicio} · ${AdminFormatters.formatMoney(rec.monto)}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = EhColors.PrimaryDark
            )
            Text(text = rec.detalle, fontSize = 13.sp, color = EhColors.TextPrimary)
            if (hasPhone) {
                OutlinedButton(onClick = onWhatsApp, shape = RoundedCornerShape(12.dp)) {
                    BrandIcon(R.drawable.ic_brand_whatsapp, size = 16.dp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Contactar WhatsApp", fontSize = 12.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
