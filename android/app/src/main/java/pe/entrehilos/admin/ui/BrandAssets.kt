package pe.entrehilos.admin.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pe.entrehilos.admin.R
import pe.entrehilos.admin.data.AdminFormatters

@DrawableRes
fun channelBrandDrawable(origen: String?): Int {
    return when (origen?.trim()?.lowercase()) {
        "whatsapp" -> R.drawable.ic_brand_whatsapp
        "facebook" -> R.drawable.ic_brand_facebook
        "instagram" -> R.drawable.ic_brand_instagram
        "tiktok" -> R.drawable.ic_brand_tiktok
        "telefono", "llamada" -> R.drawable.ic_brand_llamada
        "presencial" -> R.drawable.ic_brand_presencial
        else -> R.drawable.ic_brand_tienda
    }
}

fun channelBrandColors(origen: String?): Pair<Color, Color> {
    return when (origen?.trim()?.lowercase()) {
        "whatsapp" -> Color(0xFFECFDF5) to Color(0xFF15803D)
        "facebook" -> Color(0xFFEFF6FF) to Color(0xFF1D4ED8)
        "instagram" -> Color(0xFFFDF2F8) to Color(0xFFBE185D)
        "tiktok" -> Color(0xFFF3F4F6) to Color(0xFF111827)
        "telefono", "llamada" -> Color(0xFFFFFBEB) to Color(0xFFB45309)
        "presencial" -> Color(0xFFFFF1F2) to Color(0xFFBE123C)
        else -> Color(0xFFFDE8EF) to Color(0xFFC04267)
    }
}

@DrawableRes
fun paymentBrandDrawable(metodo: String?): Int {
    return when (metodo?.trim()?.lowercase()) {
        "plin" -> R.drawable.ic_logo_plin
        "efectivo", "contra_entrega" -> R.drawable.ic_brand_efectivo
        "transferencia" -> R.drawable.ic_brand_transferencia
        "tarjeta" -> R.drawable.ic_logo_mastercard
        else -> R.drawable.ic_logo_yape
    }
}

fun paymentBrandColors(metodo: String?): Pair<Color, Color> {
    return when (metodo?.trim()?.lowercase()) {
        "plin" -> Color(0xFFECFEFF) to Color(0xFF0E7490)
        "efectivo", "contra_entrega" -> Color(0xFFECFDF5) to Color(0xFF047857)
        "transferencia" -> Color(0xFFEFF6FF) to Color(0xFF1D4ED8)
        "tarjeta" -> Color(0xFFFFF7ED) to Color(0xFFB91C1C)
        else -> Color(0xFFFAF5FF) to Color(0xFF742384)
    }
}

@Composable
fun BrandIcon(
    @DrawableRes resId: Int,
    size: Dp = 18.dp,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(id = resId),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size)
    )
}

@Composable
fun ChannelBrandBadge(
    origen: String?,
    compact: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val (bg, fg) = channelBrandColors(origen)
    val label = AdminFormatters.origenLabel(origen)
    Surface(
        modifier = modifier,
        color = bg,
        contentColor = fg,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(0.5.dp, fg.copy(alpha = 0.2f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = if (compact) 7.dp else 9.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            BrandIcon(resId = channelBrandDrawable(origen), size = 15.dp)
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }
    }
}

@Composable
fun PaymentBrandBadge(
    metodoPago: String?,
    modifier: Modifier = Modifier,
) {
    val (bg, fg) = paymentBrandColors(metodoPago)
    val label = AdminFormatters.paymentLabel(metodoPago)
    Surface(
        modifier = modifier,
        color = bg,
        contentColor = fg,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(0.5.dp, fg.copy(alpha = 0.2f))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            BrandIcon(resId = paymentBrandDrawable(metodoPago), size = 16.dp)
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }
    }
}

@Composable
fun WhatsAppCircleButton(
    onClick: () -> Unit,
    size: Dp = 36.dp,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = Color(0xFFECFDF5),
        border = BorderStroke(1.dp, Color(0xFF25D366).copy(alpha = 0.35f)),
        modifier = modifier.size(size)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Image(
                painter = painterResource(id = R.drawable.ic_brand_whatsapp),
                contentDescription = "WhatsApp",
                modifier = Modifier.size(size * 0.68f)
            )
        }
    }
}
