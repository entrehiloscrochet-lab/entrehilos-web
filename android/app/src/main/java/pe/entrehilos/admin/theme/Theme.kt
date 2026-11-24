package pe.entrehilos.admin.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object EhColors {
    val Primary = Color(0xFFEE6B8D)
    val PrimaryDark = Color(0xFFC04267)
    val PrimarySoft = Color(0xFFFDE8EF)
    val Background = Color(0xFFFDF4F7)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceVariant = Color(0xFFFFF8FA)
    val AccentPeach = Color(0xFFFFB4A2)
    val TextPrimary = Color(0xFF3E2D2D)
    val TextSecondary = Color(0xFF6B5B5E)
    val BorderSoft = Color(0xFFF7D5E0)

    val SuccessBg = Color(0xFFECFDF5)
    val SuccessFg = Color(0xFF065F46)
    val WarningBg = Color(0xFFFFFBEB)
    val WarningFg = Color(0xFF92400E)
    val ErrorBg = Color(0xFFFEF2F2)
    val ErrorFg = Color(0xFF991B1B)
    val InfoBg = Color(0xFFEFF6FF)
    val InfoFg = Color(0xFF1E40AF)
    val PurpleBg = Color(0xFFF5F3FF)
    val PurpleFg = Color(0xFF5B21B6)
    val TealBg = Color(0xFFF0FDFA)
    val TealFg = Color(0xFF115E59)
    val GrayBg = Color(0xFFF3F4F6)
    val GrayFg = Color(0xFF4B5563)
}

private val LightColors = lightColorScheme(
    primary = EhColors.Primary,
    onPrimary = Color.White,
    primaryContainer = EhColors.PrimarySoft,
    onPrimaryContainer = EhColors.PrimaryDark,
    secondary = EhColors.PrimaryDark,
    onSecondary = Color.White,
    secondaryContainer = EhColors.AccentPeach.copy(alpha = 0.25f),
    onSecondaryContainer = EhColors.TextPrimary,
    background = EhColors.Background,
    onBackground = EhColors.TextPrimary,
    surface = EhColors.Surface,
    onSurface = EhColors.TextPrimary,
    surfaceVariant = EhColors.PrimarySoft,
    onSurfaceVariant = EhColors.TextSecondary,
    outline = EhColors.BorderSoft,
    inverseSurface = EhColors.PrimaryDark,
    inverseOnSurface = Color.White,
    error = Color(0xFFDC2626),
    onError = Color.White,
)

private val AppTypography = Typography(
    headlineSmall = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
)

@Composable
fun EntreHilosAdminTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = AppTypography,
        content = content
    )
}
