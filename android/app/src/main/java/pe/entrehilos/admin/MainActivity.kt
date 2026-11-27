package pe.entrehilos.admin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import pe.entrehilos.admin.data.ForegroundAlertEvent
import pe.entrehilos.admin.data.NotificationTarget
import pe.entrehilos.admin.data.SessionStore
import pe.entrehilos.admin.theme.EntreHilosAdminTheme
import pe.entrehilos.admin.ui.EntreHilosAdminApp
import pe.entrehilos.admin.viewmodel.AdminViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: AdminViewModel by viewModels()
    private var requestedNotifPermThisLaunch = false

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
            viewModel.refreshSystemStatus()
            viewModel.ensureDeviceRegistered()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        NotificationHelper.clearLegacyServiceNotification(this)
        NotificationHelper.ensureChannels(this)

        if (AlertPrefs.isEnabled(this) || SessionStore.getSession(this) != null) {
            AlertPollScheduler.start(this)
        }

        handleIntentTarget(intent)

        setContent {
            EntreHilosAdminTheme {
                val state by viewModel.uiState.collectAsState()

                LaunchedEffect(state.session?.userId) {
                    if (state.session != null && !requestedNotifPermThisLaunch) {
                        requestedNotifPermThisLaunch = true
                        requestNotificationPermissionIfNeeded()
                    }
                }

                EntreHilosAdminApp(
                    state = state,
                    onSignIn = viewModel::signIn,
                    onRefresh = { viewModel.loadAllData(force = true) },
                    onSyncPending = viewModel::syncPendingNow,
                    onSelectMainTab = viewModel::selectMainTab,
                    onSelectPedidosSub = viewModel::selectPedidosSubTab,
                    onSelectClientesSub = viewModel::selectClientesSubTab,
                    onPedidosSearchChange = viewModel::updatePedidosSearch,
                    onPedidosEstadoFilterChange = viewModel::updatePedidosEstadoFilter,
                    onPedidosCanalFilterChange = viewModel::updatePedidosCanalFilter,
                    onPedidosPagoFilterChange = viewModel::updatePedidosPagoFilter,
                    onClearPedidosFilters = viewModel::clearPedidosFilters,
                    onClientesSearchChange = viewModel::updateClientesSearch,
                    onOpenPedidoDetail = viewModel::openPedidoDetail,
                    onOpenPersonalizadoDetail = viewModel::openPersonalizadoDetail,
                    onSetShowAgendarPedido = viewModel::setShowAgendarPedido,
                    onOpenAgendarParaUsuario = viewModel::openAgendarPedidoForClient,
                    onSetShowAgendarPersonalizado = viewModel::setShowAgendarPersonalizado,
                    onUpdatePedidoEstado = viewModel::updatePedidoEstado,
                    onUpdatePersonalizadoEstado = viewModel::updatePersonalizadoEstado,
                    onDeletePedido = viewModel::deletePedido,
                    onDeletePersonalizado = viewModel::deletePersonalizado,
                    onUpdateFullPedido = viewModel::actualizarPedido,
                    onUpdateFullPersonalizado = viewModel::actualizarPersonalizado,
                    onAgendarPedido = viewModel::agendarPedido,
                    onAgendarPersonalizado = viewModel::agendarPersonalizado,
                    onMarcarMensajeLeido = viewModel::marcarMensajeLeido,
                    onToggleAprobarResena = viewModel::toggleAprobarResena,
                    onDeleteUser = viewModel::deleteUsuario,
                    onAssignClientEmail = viewModel::asignarCorreoCliente,
                    onLinkClientOrdersToUser = viewModel::vincularPedidosAUsuario,
                    onRequestNotificationPermission = ::requestNotificationPermissionExplicit,
                    onSyncAlertsNow = viewModel::syncAlertsNow,
                    onSendTestAlert = viewModel::sendTestAlert,
                    onOpenAlertRow = viewModel::openAlertRow,
                    onOpenFromNotification = viewModel::openFromNotification,
                    onDismissForegroundBanner = viewModel::dismissForegroundBanner,
                    onConsumeSnackbar = viewModel::consumeSnackbar,
                    onSignOut = viewModel::signOut,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        NotificationHelper.clearLegacyServiceNotification(this)
        viewModel.setAppInForeground(true)
    }

    override fun onPause() {
        viewModel.setAppInForeground(false)
        if (AlertPrefs.isEnabled(this) || SessionStore.getSession(this) != null) {
            AlertPollScheduler.scheduleNext(this, afterError = false, immediateSeconds = 15L)
        }
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntentTarget(intent)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun requestNotificationPermissionExplicit() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        viewModel.refreshSystemStatus()
        viewModel.ensureDeviceRegistered(showFeedback = true)
    }

    private fun handleIntentTarget(intent: Intent?) {
        val bundle = intent?.extras ?: return
        val rawUrl = bundle.getString("url")?.trim().orEmpty()
        val seccion = bundle.getString("seccion")?.trim().orEmpty()
        val sub = bundle.getString("sub")?.trim().orEmpty()

        if (seccion.isNotEmpty() || rawUrl.isNotEmpty()) {
            val resolvedSeccion = seccion.ifEmpty {
                when {
                    rawUrl.contains("seccion=clientes") -> "clientes"
                    rawUrl.contains("seccion=dashboard") -> "dashboard"
                    else -> "pedidos"
                }
            }
            val resolvedSub = sub.ifEmpty {
                when {
                    rawUrl.contains("sub=personalizados") -> "personalizados"
                    rawUrl.contains("sub=suscriptores") -> "suscriptores"
                    rawUrl.contains("sub=usuarios") -> "usuarios"
                    else -> "pedidos"
                }
            }
            _navigationTargets.value = NotificationTarget(
                seccion = resolvedSeccion,
                sub = resolvedSub,
                url = rawUrl.ifEmpty { "/admin?seccion=$resolvedSeccion&sub=$resolvedSub" }
            )
        }
    }

    companion object {
        private val _foregroundAlerts = MutableSharedFlow<ForegroundAlertEvent>(extraBufferCapacity = 8)
        val foregroundAlerts: SharedFlow<ForegroundAlertEvent> = _foregroundAlerts.asSharedFlow()

        private val _navigationTargets = MutableStateFlow<NotificationTarget?>(null)
        val navigationTargets: StateFlow<NotificationTarget?> = _navigationTargets.asStateFlow()

        fun consumeNavigationTarget() {
            _navigationTargets.value = null
        }

        @JvmStatic
        fun notifyForegroundAlert(titulo: String?, cuerpo: String?, url: String?) {
            _foregroundAlerts.tryEmit(
                ForegroundAlertEvent(
                    title = titulo?.trim().orEmpty(),
                    body = cuerpo?.trim().orEmpty(),
                    url = url?.trim().orEmpty().ifEmpty { "/admin" }
                )
            )
        }
    }
}
