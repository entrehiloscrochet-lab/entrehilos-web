package pe.entrehilos.admin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import pe.entrehilos.admin.data.SessionStore
import java.util.concurrent.Executors

class AlertPollReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return
        val appCtx = context.applicationContext
        NotificationHelper.clearLegacyServiceNotification(appCtx)

        if (!AlertPrefs.isEnabled(appCtx) && SessionStore.getSession(appCtx) == null) {
            return
        }

        val pendingResult = goAsync()
        executor.execute {
            var wakeLock: PowerManager.WakeLock? = null
            try {
                val pm = appCtx.getSystemService(Context.POWER_SERVICE) as? PowerManager
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EntreHilosAdmin:SilentPoll")
                    wakeLock?.setReferenceCounted(false)
                    wakeLock?.acquire(10_000L)
                }

                val ok = AlertPoller.pollOnce(appCtx)
                AlertPollScheduler.scheduleNext(appCtx, afterError = !ok)
            } catch (_: Exception) {
                AlertPollScheduler.scheduleNext(appCtx, afterError = true)
            } finally {
                try {
                    val wl = wakeLock
                    if (wl != null && wl.isHeld) {
                        wl.release()
                    }
                } catch (_: Exception) {
                }
                pendingResult.finish()
            }
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
