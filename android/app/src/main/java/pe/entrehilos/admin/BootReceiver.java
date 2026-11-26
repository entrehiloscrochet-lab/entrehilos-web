package pe.entrehilos.admin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import pe.entrehilos.admin.data.SessionStore;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
        ) {
            NotificationHelper.clearLegacyServiceNotification(context);
            if (AlertPrefs.isEnabled(context) || SessionStore.INSTANCE.getSession(context) != null) {
                AlertPollScheduler.start(context);
            }
        }
    }
}
