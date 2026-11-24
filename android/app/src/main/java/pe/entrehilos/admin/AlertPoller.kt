package pe.entrehilos.admin

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object AlertPoller {

    private const val TAG = "EHAlertPoller"
    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    private val lock = Any()

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    fun hasInternet(context: Context): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return true
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } catch (_: Exception) {
            true
        }
    }

    fun pollOnce(context: Context): Boolean {
        val appCtx = context.applicationContext
        NotificationHelper.clearLegacyServiceNotification(appCtx)

        if (!AlertPrefs.isEnabled(appCtx)) {
            return true
        }
        if (!hasInternet(appCtx)) {
            return true
        }

        synchronized(lock) {
            val baseUrl = AlertPrefs.getSupabaseUrl(appCtx).replace(Regex("/+$"), "")
            val anonKey = AlertPrefs.getSupabaseAnonKey(appCtx)
            val deviceId = AlertPrefs.getDeviceId(appCtx)
            val deviceSecret = AlertPrefs.getDeviceSecret(appCtx)
            var lastAlertId = AlertPrefs.getLastAlertId(appCtx)

            if (baseUrl.isEmpty() || anonKey.isEmpty() || deviceId.isEmpty() || deviceSecret.isEmpty()) {
                return true
            }

            return try {
                val bodyJson = JSONObject().apply {
                    put("p_device_id", deviceId)
                    put("p_device_secret", deviceSecret)
                    put("p_after_id", lastAlertId)
                }

                val request = Request.Builder()
                    .url("$baseUrl/rest/v1/rpc/poll_admin_alerts")
                    .post(bodyJson.toString().toRequestBody(JSON_MEDIA))
                    .addHeader("apikey", anonKey)
                    .addHeader("Authorization", "Bearer $anonKey")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "application/json")
                    .build()

                httpClient.newCall(request).execute().use { response ->
                    val respBody = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        if (respBody.contains("unauthorized_device")) {
                            Log.w(TAG, "Dispositivo revocado en Supabase; desactivando polling.")
                            AlertPrefs.clear(appCtx)
                            AlertPollScheduler.stop(appCtx)
                            return true
                        }
                        Log.w(TAG, "HTTP ${response.code} al consultar alertas: $respBody")
                        return false
                    }

                    AlertPrefs.touchLastSync(appCtx)
                    if (respBody.isEmpty()) {
                        return true
                    }

                    val rows = JSONArray(respBody)
                    for (i in 0 until rows.length()) {
                        val item = rows.optJSONObject(i) ?: continue
                        val id = item.optLong("id", 0L)
                        if (id <= lastAlertId) continue

                        val tipo = item.optString("tipo", "general")
                        val titulo = item.optString("titulo", "Entre Hilos Admin")
                        val cuerpo = item.optString("cuerpo", "")
                        val url = item.optString("url", "/admin")
                        val seccion = item.optString("seccion", "pedidos")
                        val sub = item.optString("sub", "pedidos")

                        AlertPrefs.setLastAlertId(appCtx, id)
                        lastAlertId = id

                        NotificationHelper.showAlertNotification(
                            appCtx,
                            id,
                            tipo,
                            titulo,
                            cuerpo,
                            url,
                            seccion,
                            sub
                        )

                        MainActivity.notifyForegroundAlert(titulo, cuerpo, url)
                    }
                    true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error consultando alertas silenciosas", e)
                false
            }
        }
    }
}
