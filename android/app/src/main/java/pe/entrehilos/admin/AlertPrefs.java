package pe.entrehilos.admin;

import android.content.Context;
import android.content.SharedPreferences;

public final class AlertPrefs {

    private static final String PREFS_NAME = "entrehilos_admin_alerts_prefs";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SUPABASE_URL = "supabase_url";
    private static final String KEY_SUPABASE_ANON_KEY = "supabase_anon_key";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_DEVICE_SECRET = "device_secret";
    private static final String KEY_LAST_ALERT_ID = "last_alert_id";
    private static final String KEY_LAST_SYNC_MS = "last_sync_ms";

    private AlertPrefs() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void saveConfig(
        Context context,
        String supabaseUrl,
        String supabaseAnonKey,
        String deviceId,
        String deviceSecret,
        long incomingLastAlertId
    ) {
        SharedPreferences sp = prefs(context);
        long existingId = sp.getLong(KEY_LAST_ALERT_ID, 0L);
        String existingDeviceId = sp.getString(KEY_DEVICE_ID, "");
        long resolvedLastId = (existingDeviceId != null && existingDeviceId.equals(deviceId) && existingId > 0)
            ? existingId
            : Math.max(0L, incomingLastAlertId);

        sp
            .edit()
            .putBoolean(KEY_ENABLED, true)
            .putString(KEY_SUPABASE_URL, supabaseUrl)
            .putString(KEY_SUPABASE_ANON_KEY, supabaseAnonKey)
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_DEVICE_SECRET, deviceSecret)
            .putLong(KEY_LAST_ALERT_ID, resolvedLastId)
            .apply();
    }

    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }

    public static boolean isEnabled(Context context) {
        SharedPreferences sp = prefs(context);
        return (
            sp.getBoolean(KEY_ENABLED, false) &&
            !getSupabaseUrl(context).isEmpty() &&
            !getSupabaseAnonKey(context).isEmpty() &&
            !getDeviceId(context).isEmpty() &&
            !getDeviceSecret(context).isEmpty()
        );
    }

    public static String getSupabaseUrl(Context context) {
        String val = prefs(context).getString(KEY_SUPABASE_URL, "");
        return val != null ? val.trim() : "";
    }

    public static String getSupabaseAnonKey(Context context) {
        String val = prefs(context).getString(KEY_SUPABASE_ANON_KEY, "");
        return val != null ? val.trim() : "";
    }

    public static String getDeviceId(Context context) {
        String val = prefs(context).getString(KEY_DEVICE_ID, "");
        return val != null ? val.trim() : "";
    }

    public static String getDeviceSecret(Context context) {
        String val = prefs(context).getString(KEY_DEVICE_SECRET, "");
        return val != null ? val.trim() : "";
    }

    public static long getLastAlertId(Context context) {
        return prefs(context).getLong(KEY_LAST_ALERT_ID, 0L);
    }

    public static void setLastAlertId(Context context, long alertId) {
        long current = getLastAlertId(context);
        if (alertId > current) {
            prefs(context).edit().putLong(KEY_LAST_ALERT_ID, alertId).apply();
        }
    }

    public static long getLastSyncAtMs(Context context) {
        return prefs(context).getLong(KEY_LAST_SYNC_MS, 0L);
    }

    public static void touchLastSync(Context context) {
        prefs(context).edit().putLong(KEY_LAST_SYNC_MS, System.currentTimeMillis()).apply();
    }
}
