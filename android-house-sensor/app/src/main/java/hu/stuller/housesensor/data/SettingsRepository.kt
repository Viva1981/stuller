package hu.stuller.housesensor.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "house_sensor_settings")

class SettingsRepository(private val context: Context) {
    private object Keys {
        val BaseUrl = stringPreferencesKey("base_url")
        val SensorToken = stringPreferencesKey("sensor_token")
        val SensorLabel = stringPreferencesKey("sensor_label")
        val IntervalSeconds = intPreferencesKey("interval_seconds")
    }

    val settingsFlow: Flow<AppSettings> = context.dataStore.data.map { preferences ->
        AppSettings(
            baseUrl = preferences[Keys.BaseUrl] ?: "",
            sensorToken = preferences[Keys.SensorToken] ?: "",
            sensorLabel = preferences[Keys.SensorLabel] ?: "redmi-note-9-pro",
            intervalSeconds = preferences[Keys.IntervalSeconds] ?: 120,
        )
    }

    suspend fun save(settings: AppSettings) {
        context.dataStore.edit { preferences ->
            preferences[Keys.BaseUrl] = settings.baseUrl.trim().trimEnd('/')
            preferences[Keys.SensorToken] = settings.sensorToken.trim()
            preferences[Keys.SensorLabel] = settings.sensorLabel.trim()
            preferences[Keys.IntervalSeconds] = settings.intervalSeconds.coerceIn(30, 900)
        }
    }
}
