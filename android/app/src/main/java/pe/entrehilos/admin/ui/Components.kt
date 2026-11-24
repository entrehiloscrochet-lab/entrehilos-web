package pe.entrehilos.admin.ui

import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.BuildConfig
import pe.entrehilos.admin.data.AdminFormatters
import pe.entrehilos.admin.data.CatalogProduct
import pe.entrehilos.admin.data.DirectoryClient
import pe.entrehilos.admin.theme.EhColors

@Composable
fun EhBadge(
    text: String,
    bgColor: Color,
    fgColor: Color,
    borderColor: Color? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = bgColor,
        contentColor = fgColor,
        shape = RoundedCornerShape(999.dp),
        border = borderColor?.let { BorderStroke(1.dp, it) }
    ) {
        Box(modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)) {
            Text(
                text = text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
        }
    }
}

@Composable
fun UserAvatarCircle(
    name: String,
    isAdmin: Boolean = false,
    size: Dp = 40.dp,
) {
    val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "E"
    val bg = if (isAdmin) EhColors.PrimaryDark else EhColors.PrimarySoft
    val fg = if (isAdmin) Color.White else EhColors.PrimaryDark

    Surface(
        shape = CircleShape,
        color = bg,
        border = if (!isAdmin) BorderStroke(1.dp, EhColors.BorderSoft) else null,
        modifier = Modifier.size(size)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = initial,
                color = fg,
                fontSize = (size.value * 0.42f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
fun BrandOptionSelector(
    label: String,
    options: List<Pair<String, String>>,
    selectedKey: String,
    @DrawableRes iconResForKey: (String) -> Int,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedPair = options.find { it.first.equals(selectedKey, ignoreCase = true) } ?: options.firstOrNull()
    val displayKey = selectedPair?.first ?: selectedKey
    val displayLabel = selectedPair?.second ?: selectedKey

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = EhColors.PrimaryDark
        )

        Surface(
            onClick = { expanded = !expanded },
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            border = BorderStroke(1.dp, if (expanded) EhColors.Primary else EhColors.BorderSoft),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    BrandIcon(resId = iconResForKey(displayKey), size = 24.dp)
                    Text(
                        text = displayLabel,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = EhColors.TextPrimary
                    )
                }
                Icon(
                    imageVector = if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown,
                    contentDescription = if (expanded) "Contraer" else "Desplegar",
                    tint = EhColors.PrimaryDark
                )
            }
        }

        AnimatedVisibility(visible = expanded) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = BorderStroke(1.dp, EhColors.BorderSoft),
                shadowElevation = 3.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    options.forEachIndexed { index, (key, optLabel) ->
                        val isSelected = key.equals(selectedKey, ignoreCase = true)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(if (isSelected) EhColors.PrimarySoft.copy(alpha = 0.7f) else Color.White)
                                .clickable {
                                    onSelect(key)
                                    expanded = false
                                }
                                .padding(horizontal = 14.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                BrandIcon(resId = iconResForKey(key), size = 24.dp)
                                Text(
                                    text = optLabel,
                                    fontSize = 14.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) EhColors.PrimaryDark else EhColors.TextPrimary
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Outlined.Check,
                                    contentDescription = null,
                                    tint = EhColors.PrimaryDark,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        if (index < options.lastIndex) {
                            HorizontalDivider(color = EhColors.BorderSoft.copy(alpha = 0.6f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ClientPickerOverlay(
    directory: List<DirectoryClient>,
    onSelect: (DirectoryClient) -> Unit,
    onDismiss: () -> Unit,
    onRefresh: (() -> Unit)? = null,
) {
    BackHandler(onBack = onDismiss)
    val backdropInteraction = remember { MutableInteractionSource() }
    val sheetInteraction = remember { MutableInteractionSource() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(
                interactionSource = backdropInteraction,
                indication = null,
                onClick = onDismiss
            )
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color.White,
            shadowElevation = 12.dp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.84f)
                .imePadding()
                .clickable(
                    interactionSource = sheetInteraction,
                    indication = null
                ) {}
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
                ClientPickerContent(
                    directory = directory,
                    onSelect = onSelect,
                    onDismiss = onDismiss,
                    onRefresh = onRefresh,
                    dismissIconIsBack = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
fun ClientPickerContent(
    directory: List<DirectoryClient>,
    onSelect: (DirectoryClient) -> Unit,
    onDismiss: () -> Unit,
    onRefresh: (() -> Unit)? = null,
    dismissIconIsBack: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var search by remember { mutableStateOf("") }

    val filtered = remember(directory, search) {
        val q = AdminFormatters.normalizeClientKey(search)
        if (q.isEmpty()) directory else directory.filter { c ->
            AdminFormatters.normalizeClientKey(c.nombre).contains(q) ||
                c.telefono?.contains(q) == true ||
                c.email?.lowercase()?.contains(q) == true
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Seleccionar Cliente",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
                Text(
                    text = "${directory.size} registrados y clientes con pedidos",
                    fontSize = 12.sp,
                    color = EhColors.TextSecondary
                )
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = if (dismissIconIsBack) Icons.AutoMirrored.Outlined.ArrowBack else Icons.Outlined.Close,
                    contentDescription = if (dismissIconIsBack) "Volver" else "Cerrar"
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            placeholder = { Text("Buscar por nombre, teléfono o email...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, tint = EhColors.Primary) },
            trailingIcon = {
                if (search.isNotEmpty()) {
                    IconButton(onClick = { search = "" }) {
                        Icon(Icons.Outlined.Close, contentDescription = "Limpiar")
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = EhColors.Primary,
                unfocusedBorderColor = EhColors.BorderSoft,
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        if (filtered.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = if (directory.isEmpty()) {
                        "Aún no hay usuarios registrados ni clientes cargados."
                    } else {
                        "No se encontraron clientes con \"$search\"."
                    },
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )
                if (directory.isEmpty() && onRefresh != null) {
                    OutlinedButton(
                        onClick = onRefresh,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EhColors.Primary)
                    ) {
                        Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = EhColors.PrimaryDark)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Recargar desde Supabase", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f, fill = false),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filtered, key = { it.key }) { client ->
                    val isReg = client.origen == "Registrado"
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = EhColors.SurfaceVariant),
                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(client) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            UserAvatarCircle(name = client.nombre, isAdmin = isReg, size = 38.dp)
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = client.nombre,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = EhColors.TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f, fill = false)
                                    )
                                    EhBadge(
                                        text = if (isReg) "Registrado" else client.origen,
                                        bgColor = if (isReg) EhColors.SuccessBg else EhColors.PrimarySoft,
                                        fgColor = if (isReg) EhColors.SuccessFg else EhColors.PrimaryDark
                                    )
                                }
                                val contactLine = listOfNotNull(
                                    client.telefono?.takeIf { it.isNotBlank() },
                                    client.email?.takeIf { it.isNotBlank() }
                                ).joinToString(" · ")
                                if (contactLine.isNotBlank()) {
                                    Text(
                                        text = contactLine,
                                        fontSize = 11.sp,
                                        color = EhColors.TextSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                client.direccion?.takeIf { it.isNotBlank() }?.let { dir ->
                                    Text(
                                        text = dir,
                                        fontSize = 11.sp,
                                        color = EhColors.TextSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
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

@Composable
fun CatalogProductPickerOverlay(
    productos: List<CatalogProduct>,
    onPickProduct: (CatalogProduct) -> Unit,
    onDismiss: () -> Unit,
    onRefresh: (() -> Unit)? = null,
) {
    BackHandler(onBack = onDismiss)
    val backdropInteraction = remember { MutableInteractionSource() }
    val sheetInteraction = remember { MutableInteractionSource() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(
                interactionSource = backdropInteraction,
                indication = null,
                onClick = onDismiss
            )
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color.White,
            shadowElevation = 12.dp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.84f)
                .imePadding()
                .clickable(
                    interactionSource = sheetInteraction,
                    indication = null
                ) {}
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
                CatalogProductPickerContent(
                    productos = productos,
                    onPickProduct = onPickProduct,
                    onDismiss = onDismiss,
                    onRefresh = onRefresh,
                    dismissIconIsBack = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
fun CatalogProductPickerContent(
    productos: List<CatalogProduct>,
    onPickProduct: (CatalogProduct) -> Unit,
    onDismiss: () -> Unit,
    onRefresh: (() -> Unit)? = null,
    dismissIconIsBack: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var search by remember { mutableStateOf("") }

    val filtered = remember(productos, search) {
        val q = AdminFormatters.normalizeClientKey(search)
        if (q.isEmpty()) productos else productos.filter { p ->
            AdminFormatters.normalizeClientKey(p.nombre).contains(q) ||
                p.sku.lowercase().contains(q) ||
                AdminFormatters.normalizeClientKey(p.categoria).contains(q)
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Catálogo Entre Hilos",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = EhColors.PrimaryDark
                )
                Text(
                    text = "${productos.size} productos disponibles",
                    fontSize = 12.sp,
                    color = EhColors.TextSecondary
                )
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = if (dismissIconIsBack) Icons.AutoMirrored.Outlined.ArrowBack else Icons.Outlined.Close,
                    contentDescription = if (dismissIconIsBack) "Volver" else "Cerrar"
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            placeholder = { Text("Buscar por nombre, SKU o categoría...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, tint = EhColors.Primary) },
            trailingIcon = {
                if (search.isNotEmpty()) {
                    IconButton(onClick = { search = "" }) {
                        Icon(Icons.Outlined.Close, contentDescription = "Limpiar")
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = EhColors.Primary,
                unfocusedBorderColor = EhColors.BorderSoft,
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        if (filtered.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = if (productos.isEmpty()) {
                        "Aún no se cargaron productos del catálogo."
                    } else {
                        "Sin coincidencias para \"$search\"."
                    },
                    fontSize = 13.sp,
                    color = EhColors.TextSecondary
                )
                if (productos.isEmpty() && onRefresh != null) {
                    OutlinedButton(
                        onClick = onRefresh,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, EhColors.Primary)
                    ) {
                        Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = EhColors.PrimaryDark)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Recargar desde Supabase", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EhColors.PrimaryDark)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f, fill = false),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filtered, key = { it.id }) { prod ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = EhColors.SurfaceVariant),
                        border = BorderStroke(1.dp, EhColors.BorderSoft),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPickProduct(prod) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = prod.nombre,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = EhColors.TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f, fill = false)
                                    )
                                    if (!prod.isActive) {
                                        EhBadge(
                                            text = "Inactivo",
                                            bgColor = EhColors.GrayBg,
                                            fgColor = EhColors.GrayFg
                                        )
                                    }
                                }
                                val sub = listOfNotNull(
                                    prod.categoria.takeIf { it.isNotBlank() },
                                    prod.sku.takeIf { it.isNotBlank() }?.let { "SKU: $it" }
                                ).joinToString(" · ")
                                if (sub.isNotBlank()) {
                                    Text(text = sub, fontSize = 11.sp, color = EhColors.TextSecondary)
                                }
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = AdminFormatters.formatMoney(prod.precio),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = EhColors.PrimaryDark
                                )
                                Surface(
                                    shape = CircleShape,
                                    color = EhColors.Primary,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            Icons.Outlined.Add,
                                            contentDescription = "Agregar",
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp)
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
}

@Composable
fun SectionHeaderDivider(title: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        HorizontalDivider(color = EhColors.BorderSoft)
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = EhColors.PrimaryDark
        )
    }
}

fun openWhatsAppChat(context: Context, rawPhone: String?, message: String = "") {
    val normalized = AdminFormatters.normalizeWhatsAppPhone(rawPhone)
    if (normalized == null) {
        Toast.makeText(context, "Este registro no tiene un teléfono válido.", Toast.LENGTH_SHORT).show()
        return
    }
    val url = buildString {
        append("https://wa.me/")
        append(normalized)
        if (message.isNotBlank()) {
            append("?text=")
            append(Uri.encode(message))
        }
    }
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (_: Exception) {
        Toast.makeText(context, "No se pudo abrir WhatsApp.", Toast.LENGTH_SHORT).show()
    }
}

fun openExternalUrl(context: Context, url: String) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (_: Exception) {
        Toast.makeText(context, "No se encontró navegador para abrir el enlace.", Toast.LENGTH_SHORT).show()
    }
}

fun openWebAdminExternal(context: Context) {
    openExternalUrl(context, BuildConfig.WEB_ADMIN_URL)
}

fun requestExactAlarmPermission(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
            val intent = Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return
        } catch (_: Exception) {
        }
    }
    try {
        val fallback = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${context.packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(fallback)
    } catch (_: Exception) {
        Toast.makeText(
            context,
            "Abre Ajustes > Aplicaciones > Entre Hilos Admin > Alarmas y recordatorios.",
            Toast.LENGTH_SHORT
        ).show()
    }
}

fun requestBatteryOptimizationExemption(context: Context) {
    try {
        val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${context.packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (_: Exception) {
        try {
            val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(fallback)
        } catch (_: Exception) {
            Toast.makeText(context, "Abre Ajustes > Batería para quitar restricciones.", Toast.LENGTH_SHORT).show()
        }
    }
}

fun openXiaomiAutostartOrAppSettings(context: Context) {
    val xiaomiIntents = listOf(
        Intent().setComponent(
            ComponentName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"
            )
        ),
        Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT)
    )

    for (intent in xiaomiIntents) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            return
        } catch (_: Exception) {
        }
    }

    try {
        val appDetails = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null)
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(appDetails)
    } catch (_: Exception) {
        Toast.makeText(context, "Abre Ajustes > Aplicaciones > Entre Hilos Admin.", Toast.LENGTH_SHORT).show()
    }
}
