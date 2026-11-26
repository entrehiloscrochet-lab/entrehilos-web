package pe.entrehilos.admin

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import pe.entrehilos.admin.data.OfflineSyncManager
import pe.entrehilos.admin.data.SessionExpiredException

class OfflineSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        return try {
            val result = OfflineSyncManager.syncPendingOps(ctx)
            if (result.syncedCount > 0 && AlertPrefs.isEnabled(ctx)) {
                AlertPollScheduler.pollNowAsync(ctx)
            }
            if (result.pendingCount > 0) {
                Result.retry()
            } else {
                Result.success()
            }
        } catch (_: SessionExpiredException) {
            Result.failure()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
