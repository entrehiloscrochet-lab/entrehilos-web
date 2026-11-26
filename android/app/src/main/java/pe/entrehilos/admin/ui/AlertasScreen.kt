package pe.entrehilos.admin.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Alarm
import androidx.compose.material.icons.outlined.BatteryChargingFull
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.MarkEmailUnread
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.BuildConfig
import pe.entrehilos.admin.data.AdminAlertRow
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.theme.EhColors
import pe.entrehilos.admin.viewmodel.AdminUiState

@Composable
fun AlertasScreen(
    state: AdminUiState,
    onRequestNotificationPermission: () -> Unit,
    onSyncNow: () -> Unit,
    onSendTestAlert: () -> Unit,
    onRefresh: () -> Unit,
    onOpenAlertRow: (AdminAlertRow) -> Unit,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    var showLogoutConfirm by rememberSaveable { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Alertas y Cuenta",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )
                    Text(
                        text = "Modo silencioso sin notificación fija · 100% Supabase",
                        fontSize = 12.sp,
                        color = EhColors.TextSecondary
                    )
                }
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Outlined.Refresh, contentDescription = "Actualizar", tint = EhColors.PrimaryDark)
                }
            }
        }

        // Tarjeta Hero de estado silencioso
        item {
            val ready = state.notificationGranted &&
                state.isSilentPollingEnabled &&
                state.exactAlarmsAllowed &&
                state.batteryIgnored
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (ready) EhColors.SuccessBg else EhColors.WarningBg
                ),
                border = BorderStroke(1.dp, if (ready) Color(0xFFA7F3D0) else Color(0xFFFDE68A)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = if (ready) Icons.Outlined.NotificationsActive else Icons.Outlined.WarningAmber,
                        contentDescription = null,
                        tint = if (ready) EhColors.SuccessFg else EhColors.WarningFg,
                        modifier = Modifier.size(28.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (ready) "Alertas Silenciosas Activas" else "Configuración Incompleta",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (ready) EhColors.SuccessFg else EhColors.WarningFg
                        )
                        val missingPerms = buildList {
                            if (!state.notificationGranted) add("Notificaciones")
                            if (!state.exactAlarmsAllowed) add("Alarmas exactas")
                            if (!state.batteryIgnored) add("Sin restricción de batería")
                            if (!state.isSilentPollingEnabled) add("Sincronización activa")
                        }
                        Text(
                            text = if (ready) {
                                "Solo sonarán y aparecerán en pantalla cuando entre un pedido, entrega, usuario o suscripción real (sin barra permanente). Última sync: ${state.lastSyncLabel}."
                            } else {
                                "Falta activar: ${missingPerms.joinToString(", ")} para recibir avisos con la app cerrada. Última sync: ${state.lastSyncLabel}."
                            },
                            fontSize = 12.sp,
                            color = EhColors.TextSecondary
                        )
                    }
                }
            }
        }

        // Lista de verificación Android / Xiaomi
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, EhColors.BorderSoft),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Verificación en tu Celular",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = EhColors.PrimaryDark
                    )

                    StatusActionRow(
                        ok = state.notificationGranted,
                        title = "1. Permiso de Notificaciones",
                        subtitle = if (state.notificationGranted) {
                            "Concedido (aviso con sonido y vibración)"
                        } else {
                            "Falta permitir notificaciones en Android"
                        },
                        actionLabel = if (state.notificationGranted) null else "Activar",
                        onAction = onRequestNotificationPermission
                    )

                    StatusActionRow(
                        ok = state.exactAlarmsAllowed,
                        title = "2. Alarmas Exactas (App Cerrada)",
                        subtitle = if (state.exactAlarmsAllowed) {
                            "Android respeta los avisos puntuales en segundo plano"
                        } else {
                            "Permite despertar el celular cada 25–120s con app cerrada"
                        },
                        actionLabel = if (state.exactAlarmsAllowed) null else "Permitir",
                        iconOverride = Icons.Outlined.Alarm,
                        onAction = { requestExactAlarmPermission(context) }
                    )

                    StatusActionRow(
                        ok = state.batteryIgnored,
                        title = "3. Sin Restricción de Batería",
                        subtitle = if (state.batteryIgnored) {
                            "Android permite alertas con pantalla apagada"
                        } else {
                            "Actívalo para recibir avisos con la app cerrada"
                        },
                        actionLabel = if (state.batteryIgnored) null else "Quitar",
                        iconOverride = Icons.Outlined.BatteryChargingFull,
                        onAction = { requestBatteryOptimizationExemption(context) }
                    )

                    StatusActionRow(
                        ok = true,
                        title = "4. Inicio Automático (Xiaomi / HyperOS)",
                        subtitle = "Asegura ejecución en segundo plano sin cartel fijo",
                        actionLabel = "Ajustes app",
                        iconOverride = Icons.Outlined.Settings,
                        onAction = { openXiaomiAutostartOrAppSettings(context) }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            enabled = !state.isMutating,
                            onClick = onSendTestAlert,
                            colors = ButtonDefaults.buttonColors(containerColor = EhColors.Primary),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1.2f)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Outlined.Send,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Probar Alerta", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }

                        OutlinedButton(
                            enabled = !state.isMutating,
                            onClick = onSyncNow,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Outlined.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Sincronizar", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Cuenta y versión
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, EhColors.BorderSoft),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        UserAvatarCircle(
                            name = state.session?.nombre ?: "Admin",
                            isAdmin = true,
                            size = 42.dp
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = state.session?.nombre ?: "Administrador",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = EhColors.TextPrimary
                            )
                            Text(
                                text = state.session?.email.orEmpty(),
                                fontSize = 12.sp,
                                color = EhColors.TextSecondary
                            )
                            Text(
                                text = "Actualizado ${BuildConfig.APK_BUILD_DATE}",
                                fontSize = 11.sp,
                                color = EhColors.TextSecondary
                            )
                        }
                        EhBadge(
                            text = "${state.session?.rol ?: "admin"} · v${BuildConfig.VERSION_NAME}",
                            bgColor = EhColors.PrimarySoft,
                            fgColor = EhColors.PrimaryDark
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { openWebAdminExternal(context) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Outlined.OpenInNew,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Panel Web", fontSize = 12.sp)
                        }

                        OutlinedButton(
                            enabled = !state.isMutating,
                            onClick = { showLogoutConfirm = true },
                            border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ExitToApp,
                                contentDescription = null,
                                tint = EhColors.ErrorFg,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Cerrar sesión", fontSize = 12.sp, color = EhColors.ErrorFg)
                        }
                    }
                }
            }
        }

        // Historial reciente de alertas
        item {
            Text(
                text = "Historial de Alertas (${state.recentAlerts.size})",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = EhColors.PrimaryDark
            )
        }

        if (state.recentAlerts.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Aún no hay alertas registradas en Supabase.",
                        fontSize = 13.sp,
                        color = EhColors.TextSecondary,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        } else {
            items(state.recentAlerts, key = { it.id }) { alert ->
                val (icon, bg, fg) = alertIconStyle(alert.tipo)
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, EhColors.BorderSoft),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenAlertRow(alert) }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = bg,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
                            }
                        }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = alert.titulo,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = EhColors.TextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = AdminFormatters.formatCreatedShort(alert.createdAt),
                                    fontSize = 11.sp,
                                    color = EhColors.TextSecondary
                                )
                            }
                            Text(
                                text = alert.cuerpo,
                                fontSize = 12.sp,
                                color = EhColors.TextSecondary,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
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

        item { Spacer(modifier = Modifier.height(12.dp)) }
    }

    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Cerrar sesión", fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark) },
            text = {
                Text("Se cerrará tu sesión y dejarás de recibir alertas de administrador en este teléfono.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutConfirm = false
                        onSignOut()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Salir", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

private fun alertIconStyle(tipo: String): Triple<ImageVector, Color, Color> {
    return when (tipo.lowercase()) {
        "nuevo_pedido", "pedido_agendado" -> Triple(Icons.Outlined.ShoppingBag, EhColors.PrimarySoft, EhColors.PrimaryDark)
        "pedido_personalizado" -> Triple(Icons.Outlined.Palette, EhColors.PurpleBg, EhColors.PurpleFg)
        "entrega_24h", "entrega_2h" -> Triple(Icons.Outlined.Alarm, EhColors.ErrorBg, EhColors.ErrorFg)
        "nuevo_suscriptor" -> Triple(Icons.Outlined.MarkEmailUnread, EhColors.InfoBg, EhColors.InfoFg)
        "nuevo_usuario" -> Triple(Icons.Outlined.PersonAdd, EhColors.SuccessBg, EhColors.SuccessFg)
        else -> Triple(Icons.Outlined.NotificationsActive, EhColors.PrimarySoft, EhColors.PrimaryDark)
    }
}

@Composable
private fun StatusActionRow(
    ok: Boolean,
    title: String,
    subtitle: String,
    actionLabel: String?,
    iconOverride: ImageVector? = null,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(
            imageVector = iconOverride ?: if (ok) Icons.Outlined.CheckCircle else Icons.Outlined.WarningAmber,
            contentDescription = null,
            tint = if (ok) EhColors.SuccessFg else EhColors.WarningFg,
            modifier = Modifier.size(22.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = EhColors.TextPrimary)
            Text(text = subtitle, fontSize = 11.sp, color = EhColors.TextSecondary)
        }
        if (actionLabel != null) {
            OutlinedButton(onClick = onAction, shape = RoundedCornerShape(10.dp)) {
                Text(actionLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
