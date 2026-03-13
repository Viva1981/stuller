package hu.stuller.housesensor.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import hu.stuller.housesensor.data.AppSettings
import hu.stuller.housesensor.data.SettingsRepository
import hu.stuller.housesensor.sensor.SensorForegroundService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class SensorFormState(
    val baseUrl: String = "",
    val sensorToken: String = "",
    val sensorLabel: String = "redmi-note-9-pro",
    val intervalSeconds: String = "120",
)

data class SensorScreenState(
    val form: SensorFormState = SensorFormState(),
    val isRunning: Boolean = false,
    val statusText: String = "Még nem futott mérés.",
)

class SensorViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = SettingsRepository(application)
    private val formState = MutableStateFlow(SensorFormState())

    val uiState: StateFlow<SensorScreenState> = combine(
        formState,
        SensorForegroundService.runningFlow,
        SensorForegroundService.statusFlow,
    ) { form, isRunning, statusText ->
        SensorScreenState(form = form, isRunning = isRunning, statusText = statusText)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = SensorScreenState(),
    )

    init {
        viewModelScope.launch {
            repository.settingsFlow.collect { settings ->
                formState.value = SensorFormState(
                    baseUrl = settings.baseUrl,
                    sensorToken = settings.sensorToken,
                    sensorLabel = settings.sensorLabel,
                    intervalSeconds = settings.intervalSeconds.toString(),
                )
            }
        }
    }

    fun updateBaseUrl(value: String) = updateForm { copy(baseUrl = value) }
    fun updateSensorToken(value: String) = updateForm { copy(sensorToken = value) }
    fun updateSensorLabel(value: String) = updateForm { copy(sensorLabel = value) }
    fun updateIntervalSeconds(value: String) = updateForm { copy(intervalSeconds = value.filter(Char::isDigit)) }

    fun saveSettings() {
        val current = formState.value
        viewModelScope.launch {
            repository.save(
                AppSettings(
                    baseUrl = current.baseUrl,
                    sensorToken = current.sensorToken,
                    sensorLabel = current.sensorLabel,
                    intervalSeconds = current.intervalSeconds.toIntOrNull() ?: 120,
                )
            )
            SensorForegroundService.statusFlow.value = "Beállítások elmentve."
        }
    }

    fun startSensor() {
        SensorForegroundService.start(getApplication())
    }

    fun stopSensor() {
        SensorForegroundService.stop(getApplication())
    }

    fun runNow() {
        SensorForegroundService.runNow(getApplication())
    }

    fun openBatteryOptimizationSettings() {
        val context = getApplication<Application>()
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val packageName = context.packageName

        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !powerManager.isIgnoringBatteryOptimizations(packageName)) {
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
        } else {
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun updateForm(transform: SensorFormState.() -> SensorFormState) {
        formState.value = formState.value.transform()
    }
}
