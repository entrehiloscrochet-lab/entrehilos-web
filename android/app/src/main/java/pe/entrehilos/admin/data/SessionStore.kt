package pe.entrehilos.admin.data

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

object SessionStore {

    private const val PREFS_NAME = "entrehilos_admin_session"
    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"
    private const val KEY_EXPIRES_AT = "expires_at_epoch_sec"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_EMAIL = "email"
    private const val KEY_NOMBRE = "nombre"
    private const val KEY_ROL = "rol"
    private const val KEY_DEVICE_ID = "persistent_device_id"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveSession(context: Context, session: AdminSession) {
        prefs(context).edit()
            .putString(KEY_ACCESS_TOKEN, session.accessToken)
            .putString(KEY_REFRESH_TOKEN, session.refreshToken)
            .putLong(KEY_EXPIRES_AT, session.expiresAtEpochSec)
            .putString(KEY_USER_ID, session.userId)
            .putString(KEY_EMAIL, session.email)
            .putString(KEY_NOMBRE, session.nombre)
            .putString(KEY_ROL, session.rol)
            .apply()
    }

    fun getSession(context: Context): AdminSession? {
        val sp = prefs(context)
        val access = sp.getString(KEY_ACCESS_TOKEN, null)?.trim().orEmpty()
        val refresh = sp.getString(KEY_REFRESH_TOKEN, null)?.trim().orEmpty()
        val userId = sp.getString(KEY_USER_ID, null)?.trim().orEmpty()
        val email = sp.getString(KEY_EMAIL, null)?.trim().orEmpty()
        val rol = sp.getString(KEY_ROL, null)?.trim().orEmpty()
        if (access.isEmpty() || refresh.isEmpty() || userId.isEmpty() || (rol != "admin" && rol != "super_admin")) {
            return null
        }
        return AdminSession(
            accessToken = access,
            refreshToken = refresh,
            expiresAtEpochSec = sp.getLong(KEY_EXPIRES_AT, 0L),
            userId = userId,
            email = email,
            nombre = sp.getString(KEY_NOMBRE, null)?.trim().orEmpty().ifEmpty { email },
            rol = rol
        )
    }

    fun clearSession(context: Context) {
        val sp = prefs(context)
        val deviceId = sp.getString(KEY_DEVICE_ID, null)
        sp.edit().clear().apply()
        if (!deviceId.isNullOrBlank()) {
            sp.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }
    }

    fun getOrCreateDeviceId(context: Context): String {
        val sp = prefs(context)
        val existing = sp.getString(KEY_DEVICE_ID, null)?.trim()
        if (!existing.isNullOrEmpty()) {
            return existing
        }
        val generated = "eh-android-" + UUID.randomUUID().toString()
        sp.edit().putString(KEY_DEVICE_ID, generated).apply()
        return generated
    }
}
