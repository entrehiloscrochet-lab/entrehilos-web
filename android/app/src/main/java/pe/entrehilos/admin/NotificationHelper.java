package pe.entrehilos.admin;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public final class NotificationHelper {

    private static final String LEGACY_CHANNEL_SERVICE_STATUS = "entrehilos_service_status";
    private static final int LEGACY_SERVICE_NOTIFICATION_ID = 1001;
    public static final String CHANNEL_ADMIN_ALERTS = "entrehilos_admin_alerts";

    private NotificationHelper() {}

    public static void clearLegacyServiceNotification(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
        try {
            manager.cancel(LEGACY_SERVICE_NOTIFICATION_ID);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.deleteNotificationChannel(LEGACY_CHANNEL_SERVICE_STATUS);
            }
        } catch (Exception ignored) {
        }
    }

    public static void ensureChannels(Context context) {
        clearLegacyServiceNotification(context);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel alertsChannel = new NotificationChannel(
            CHANNEL_ADMIN_ALERTS,
            "Alertas Entre Hilos Admin",
            NotificationManager.IMPORTANCE_HIGH
        );
        alertsChannel.setDescription("Pedidos nuevos, entregas próximas y nuevas suscripciones");
        alertsChannel.enableLights(true);
        alertsChannel.setLightColor(Color.parseColor("#EE6B8D"));
        alertsChannel.enableVibration(true);
        alertsChannel.setVibrationPattern(new long[] { 0, 250, 150, 250 });
        alertsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alertsChannel.setShowBadge(true);

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alertsChannel.setSound(soundUri, audioAttributes);

        manager.createNotificationChannel(alertsChannel);
    }

    public static void showAlertNotification(
        Context context,
        long alertId,
        String tipo,
        String titulo,
        String cuerpo,
        String url,
        String seccion,
        String sub
    ) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return;
        }

        ensureChannels(context);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        intent.putExtra("alertId", String.valueOf(alertId));
        intent.putExtra("tipo", tipo != null ? tipo : "general");
        intent.putExtra("url", url != null && !url.isEmpty() ? url : "/admin");
        intent.putExtra("seccion", seccion != null ? seccion : "pedidos");
        intent.putExtra("sub", sub != null ? sub : "pedidos");

        int requestCode = 20000 + (int) Math.abs(alertId % 100000L);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(context, requestCode, intent, flags);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ADMIN_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(Color.parseColor("#EE6B8D"))
            .setContentTitle(titulo != null && !titulo.isEmpty() ? titulo : "Entre Hilos Admin")
            .setContentText(cuerpo != null ? cuerpo : "")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo != null ? cuerpo : ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build();

        manager.notify(requestCode, notification);
    }
}
