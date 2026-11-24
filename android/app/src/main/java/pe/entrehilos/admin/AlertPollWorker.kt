package pe.entrehilos.admin

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class AlertPollWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val ctx = applicationContext
        NotificationHelper.clearLegacyServiceNotification(ctx)
        if (!AlertPrefs.isEnabled(ctx)) {
            return Result.success()
        }
        val ok = AlertPoller.pollOnce(ctx)
        AlertPollScheduler.scheduleNext(ctx, afterError = !ok)
        return if (ok) Result.success() else Result.retry()
    }
}
