package hu.stuller.housesensor.sensor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import hu.stuller.housesensor.R
import hu.stuller.housesensor.data.SettingsRepository
import hu.stuller.housesensor.data.isConfigured
import hu.stuller.housesensor.network.HouseSensorApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class SensorForegroundService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val settingsRepository by lazy { SettingsRepository(applicationContext) }
    private val api = HouseSensorApi()
    private val networkProbe = NetworkProbe()
    private var loopJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopSelf()
            ACTION_RUN_NOW -> serviceScope.launch { runCycle() }
            else -> startLoop()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        loopJob?.cancel()
        runningFlow.value = false
        statusFlow.value = "Leállítva"
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTimeout(startId: Int, fgsType: Int) {
        updateStatus("Szenzor időkorlát", "Az Android leállítja a dataSync szolgáltatást.")
        stopSelf()
    }

    private fun startLoop() {
        startForeground(
            NOTIFICATION_ID,
            buildNotification("House Sensor fut", "Otthoni megfigyelés előkészítése")
        )

        if (loopJob?.isActive == true) {
            return
        }

        runningFlow.value = true
        loopJob = serviceScope.launch {
            while (true) {
                runCycle()
                val settings = settingsRepository.settingsFlow.first()
                delay(settings.intervalSeconds.coerceIn(30, 900) * 1_000L)
            }
        }
    }

    private suspend fun runCycle() {
        val settings = settingsRepository.settingsFlow.first()
        if (!settings.isConfigured()) {
            updateStatus("Hiányos beállítások", "Add meg az URL-t és a tokent.")
            return
        }

        updateStatus("Konfiguráció letöltése", settings.baseUrl)

        runCatching {
            val config = api.fetchConfig(settings)
            val sensorLabel = if (settings.sensorLabel.isBlank()) config.sensorLabel else settings.sensorLabel
            val devices = config.devices.filter { it.monitorMethod == "ping" && !it.ipAddress.isNullOrBlank() }
            val observations = devices.mapNotNull { networkProbe.probe(it) }
            api.sendObservations(settings, sensorLabel, observations)

            val summary = "${observations.count { it.reachabilityState == "online" }}/${observations.size} eszköz elérhető"
            updateStatus("Utolsó mérés kész", summary)
        }.onFailure { error ->
            updateStatus("Mérés sikertelen", error.message ?: "Ismeretlen hiba")
        }
    }

    private fun updateStatus(title: String, text: String) {
        statusFlow.value = "$title — $text"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(title, text))
    }

    private fun buildNotification(title: String, text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(title)
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "house_sensor_channel"
        private const val NOTIFICATION_ID = 20260313

        const val ACTION_START = "hu.stuller.housesensor.action.START"
        const val ACTION_STOP = "hu.stuller.housesensor.action.STOP"
        const val ACTION_RUN_NOW = "hu.stuller.housesensor.action.RUN_NOW"

        val runningFlow = MutableStateFlow(false)
        val statusFlow = MutableStateFlow("Még nem futott mérés.")

        fun start(context: Context) {
            val intent = Intent(context, SensorForegroundService::class.java).apply {
                action = ACTION_START
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, SensorForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        fun runNow(context: Context) {
            val intent = Intent(context, SensorForegroundService::class.java).apply {
                action = ACTION_RUN_NOW
            }
            context.startService(intent)
        }
    }
}
