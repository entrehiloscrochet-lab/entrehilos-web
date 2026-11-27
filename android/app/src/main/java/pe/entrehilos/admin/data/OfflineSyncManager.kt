package pe.entrehilos.admin.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import pe.entrehilos.admin.AlertPoller
import pe.entrehilos.admin.OfflineSyncWorker
import java.util.concurrent.TimeUnit

data class SyncResult(
    val syncedCount: Int,
    val pendingCount: Int,
    val stoppedOffline: Boolean = false,
    val errorMessage: String? = null,
)

object OfflineSyncManager {

    private const val SYNC_WORK_NAME = "entrehilos_offline_outbox_sync"
    private val syncMutex = Mutex()

    suspend fun syncPendingOps(context: Context): SyncResult = withContext(Dispatchers.IO) {
        val appCtx = context.applicationContext
        if (SessionStore.getSession(appCtx) == null) {
            return@withContext SyncResult(0, OfflineOutboxStore.count(appCtx))
        }
        val initialCount = OfflineOutboxStore.count(appCtx)
        if (initialCount == 0) {
            return@withContext SyncResult(0, 0)
        }
        if (!AlertPoller.hasInternet(appCtx)) {
            scheduleBackgroundSync(appCtx)
            return@withContext SyncResult(0, initialCount, stoppedOffline = true)
        }

        syncMutex.withLock {
            var synced = 0
            while (true) {
                val ops = OfflineOutboxStore.getAll(appCtx)
                if (ops.isEmpty()) {
                    return@withLock SyncResult(syncedCount = synced, pendingCount = 0)
                }
                val op = ops.first()
                try {
                    executeOp(appCtx, op)
                    OfflineOutboxStore.removeById(appCtx, op.opId)
                    synced++
                } catch (_: OfflineException) {
                    scheduleBackgroundSync(appCtx)
                    return@withLock SyncResult(
                        syncedCount = synced,
                        pendingCount = OfflineOutboxStore.count(appCtx),
                        stoppedOffline = true,
                    )
                } catch (e: SessionExpiredException) {
                    throw e
                } catch (e: Exception) {
                    val msg = e.message ?: "Error al sincronizar un cambio pendiente."
                    val isNotFoundDelete = (op is PendingOp.DeletePedido || op is PendingOp.DeletePersonalizado) &&
                        (msg.contains("404") || msg.contains("no encontrado", ignoreCase = true))
                    if (isNotFoundDelete) {
                        OfflineOutboxStore.removeById(appCtx, op.opId)
                        synced++
                        continue
                    }
                    scheduleBackgroundSync(appCtx)
                    return@withLock SyncResult(
                        syncedCount = synced,
                        pendingCount = OfflineOutboxStore.count(appCtx),
                        stoppedOffline = false,
                        errorMessage = msg,
                    )
                }
            }
            @Suppress("UNREACHABLE_CODE")
            SyncResult(synced, OfflineOutboxStore.count(appCtx))
        }
    }

    fun scheduleBackgroundSync(context: Context) {
        val appCtx = context.applicationContext
        if (OfflineOutboxStore.count(appCtx) == 0) return
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val req = OneTimeWorkRequestBuilder<OfflineSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(appCtx).enqueueUniqueWork(
                SYNC_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                req,
            )
        } catch (_: Exception) {
        }
    }

    private suspend fun executeOp(context: Context, op: PendingOp) {
        when (op) {
            is PendingOp.AgendarPedido -> {
                val realId = SupabaseRepository.agendarPedido(
                    context = context,
                    origen = op.origen,
                    usuarioId = op.usuarioId,
                    clienteNombre = op.clienteNombre,
                    clienteTelefono = op.clienteTelefono,
                    clienteEmail = op.clienteEmail,
                    direccionEnvio = op.direccionEnvio,
                    items = op.items,
                    total = op.total,
                    adelanto = op.adelanto,
                    fechaEntregaYmd = op.fechaEntregaYmd,
                    horaEntrega = op.horaEntrega,
                    metodoPago = op.metodoPago,
                    estado = op.estado,
                    notas = op.notas,
                )
                OfflineOutboxStore.remapPedidoId(context, op.tempId, realId)
            }
            is PendingOp.AgendarPersonalizado -> {
                val realId = SupabaseRepository.agendarPersonalizado(
                    context = context,
                    nombreCliente = op.nombreCliente,
                    telefono = op.telefono,
                    email = op.email,
                    productoNombre = op.productoNombre,
                    productoPrecio = op.productoPrecio,
                    detalles = op.detalles,
                    colores = op.colores,
                    tamano = op.tamano,
                    extras = op.extras,
                    fechaEntregaYmd = op.fechaEntregaYmd,
                    horaEntrega = op.horaEntrega,
                    estado = op.estado,
                )
                OfflineOutboxStore.remapPersonalizadoId(context, op.tempId, realId)
            }
            is PendingOp.UpdatePedidoEstado -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.updatePedidoEstado(context, op.pedidoId, op.nuevoEstado)
                }
            }
            is PendingOp.UpdatePersonalizadoEstado -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.updatePersonalizadoEstado(context, op.pedidoId, op.nuevoEstado)
                }
            }
            is PendingOp.ActualizarPedido -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.actualizarPedido(
                        context = context,
                        pedidoId = op.pedidoId,
                        clienteNombre = op.clienteNombre,
                        clienteTelefono = op.clienteTelefono,
                        clienteEmail = op.clienteEmail,
                        usuarioId = op.usuarioId,
                        direccionEnvio = op.direccionEnvio,
                        estado = op.estado,
                        metodoPago = op.metodoPago,
                        adelanto = op.adelanto,
                        fechaEntregaYmd = op.fechaEntregaYmd,
                        horaEntrega = op.horaEntrega,
                        notas = op.notas,
                        total = op.total,
                    )
                }
            }
            is PendingOp.ActualizarPersonalizado -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.actualizarPersonalizado(
                        context = context,
                        pedidoId = op.pedidoId,
                        nombreCliente = op.nombreCliente,
                        telefono = op.telefono,
                        email = op.email,
                        productoNombre = op.productoNombre,
                        productoPrecio = op.productoPrecio,
                        detalles = op.detalles,
                        colores = op.colores,
                        tamano = op.tamano,
                        extras = op.extras,
                        fechaEntregaYmd = op.fechaEntregaYmd,
                        horaEntrega = op.horaEntrega,
                        estado = op.estado,
                    )
                }
            }
            is PendingOp.DeletePedido -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.deletePedido(context, op.pedidoId)
                }
            }
            is PendingOp.DeletePersonalizado -> {
                if (op.pedidoId > 0L) {
                    SupabaseRepository.deletePersonalizado(context, op.pedidoId)
                }
            }
            is PendingOp.MarcarMensajeLeido -> {
                SupabaseRepository.marcarMensajeLeido(context, op.mensajeId)
            }
            is PendingOp.ToggleAprobarResena -> {
                SupabaseRepository.toggleAprobarResena(context, op.resenaId, op.nuevoAprobado)
            }
            is PendingOp.VincularPedidosUsuario -> {
                SupabaseRepository.vincularPedidosAUsuario(
                    context = context,
                    targetUserId = op.targetUserId,
                    matchNombre = op.matchNombre,
                    matchTelefono = op.matchTelefono,
                    matchEmail = op.matchEmail,
                )
            }
            is PendingOp.AsignarCorreoCliente -> {
                SupabaseRepository.asignarCorreoCliente(
                    context = context,
                    email = op.email,
                    matchNombre = op.matchNombre,
                    matchTelefono = op.matchTelefono,
                    oldEmail = op.oldEmail,
                )
            }
        }
    }
}
