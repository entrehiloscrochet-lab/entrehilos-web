package pe.entrehilos.admin

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object AlertPollScheduler {

    private const val ALARM_REQUEST_CODE = 4210
    private const val WORK_NAME = "entrehilos_silent_alert_poll"
    private val limaTz: TimeZone = TimeZone.getTimeZone("America/Lima")
    private val executor = Executors.newSingleThreadExecutor()

    @JvmStatic
    fun start(context: Context) {
        val appCtx = context.applicationContext
        NotificationHelper.clearLegacyServiceNotification(appCtx)

        if (!AlertPrefs.isEnabled(appCtx)) {
            stop(appCtx)
            return
        }

        ensurePeriodicWork(appCtx)
        scheduleNext(appCtx, afterError = false, immediateSeconds = 15L)
    }

    @JvmStatic
    fun stop(context: Context) {
        val appCtx = context.applicationContext
        NotificationHelper.clearLegacyServiceNotification(appCtx)
        try {
            val am = appCtx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            am?.cancel(buildAlarmPendingIntent(appCtx))
        } catch (_: Exception) {
        }
        try {
            WorkManager.getInstance(appCtx).cancelUniqueWork(WORK_NAME)
        } catch (_: Exception) {
        }
    }

    @JvmStatic
    fun pollNowAsync(context: Context) {
        val appCtx = context.applicationContext
        NotificationHelper.clearLegacyServiceNotification(appCtx)
        if (!AlertPrefs.isEnabled(appCtx)) {
            return
        }
        executor.execute {
            val ok = AlertPoller.pollOnce(appCtx)
            scheduleNext(appCtx, afterError = !ok)
        }
    }

    @JvmStatic
    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true
        }
        val am = context.applicationContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        return am?.canScheduleExactAlarms() == true
    }

    fun scheduleNext(context: Context, afterError: Boolean, immediateSeconds: Long? = null) {
        val appCtx = context.applicationContext
        if (!AlertPrefs.isEnabled(appCtx)) {
            return
        }

        val delaySec = immediateSeconds ?: computeDelaySeconds(appCtx, afterError)
        val triggerAt = SystemClock.elapsedRealtime() + (delaySec * 1000L)

        try {
            val am = appCtx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val pi = buildAlarmPendingIntent(appCtx)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (canScheduleExactAlarms(appCtx)) {
                    try {
                        am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                    } catch (_: SecurityException) {
                        am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                    }
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                }
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
        } catch (_: Exception) {
        }
    }

    fun ensurePeriodicWork(context: Context) {
        val appCtx = context.applicationContext
        if (!AlertPrefs.isEnabled(appCtx)) return
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val work = PeriodicWorkRequestBuilder<AlertPollWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(appCtx).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                work
            )
        } catch (_: Exception) {
        }
    }

    private fun computeDelaySeconds(context: Context, afterError: Boolean): Long {
        if (afterError) {
            return 90L
        }
        val screenOn = try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isInteractive == true
        } catch (_: Exception) {
            false
        }
        if (screenOn) {
            return 25L
        }
        val hour = Calendar.getInstance(limaTz).get(Calendar.HOUR_OF_DAY)
        return if (hour in 0..6) 120L else 60L
    }

    private fun buildAlarmPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, AlertPollReceiver::class.java)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        return PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags)
    }
}
