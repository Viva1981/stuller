package hu.stuller.housesensor.network

import hu.stuller.housesensor.data.AppSettings
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class HouseSensorApi {
    fun fetchConfig(settings: AppSettings): SensorConfig {
        val connection = createConnection("${settings.baseUrl}/api/house/config", settings.sensorToken)
        connection.requestMethod = "GET"

        val response = connection.inputStream.bufferedReader().use(BufferedReader::readText)
        val json = JSONObject(response)
        val devicesJson = json.optJSONArray("devices") ?: JSONArray()

        return SensorConfig(
            sensorLabel = json.optString("sensorLabel", settings.sensorLabel),
            recommendedIntervalSeconds = json.optInt("recommendedIntervalSeconds", settings.intervalSeconds),
            devices = buildList {
                for (index in 0 until devicesJson.length()) {
                    val item = devicesJson.getJSONObject(index)
                    add(
                        SensorDevice(
                            id = item.getString("id"),
                            name = item.getString("name"),
                            slug = item.getString("slug"),
                            ownerName = item.optString("owner_name").takeIf { it.isNotBlank() },
                            deviceKind = item.optString("device_kind"),
                            ipAddress = item.optString("ip_address").takeIf { it.isNotBlank() },
                            macAddress = item.optString("mac_address").takeIf { it.isNotBlank() },
                            vendorName = item.optString("vendor_name").takeIf { it.isNotBlank() },
                            monitorMethod = item.optString("monitor_method"),
                            presenceRole = item.optBoolean("presence_role"),
                            stateRole = item.optBoolean("state_role"),
                        )
                    )
                }
            }
        )
    }

    fun sendObservations(settings: AppSettings, sensorLabel: String, observations: List<SensorObservation>) {
        if (observations.isEmpty()) return

        val connection = createConnection("${settings.baseUrl}/api/house/ingest", settings.sensorToken)
        connection.requestMethod = "POST"
        connection.doOutput = true

        val payload = JSONObject().apply {
            put("sensorLabel", sensorLabel)
            put("observations", JSONArray().apply {
                observations.forEach { observation ->
                    put(
                        JSONObject().apply {
                            put("slug", observation.slug)
                            put("reachabilityState", observation.reachabilityState)
                            if (observation.latencyMs != null) put("latencyMs", observation.latencyMs)
                            if (observation.ipAddress != null) put("ipAddress", observation.ipAddress)
                            if (observation.macAddress != null) put("macAddress", observation.macAddress)
                            if (observation.vendorName != null) put("vendorName", observation.vendorName)
                            put("confidence", observation.confidence)
                        }
                    )
                }
            })
        }

        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(payload.toString())
            writer.flush()
        }

        val statusCode = connection.responseCode
        if (statusCode !in 200..299) {
            val errorBody = connection.errorStream?.bufferedReader()?.use(BufferedReader::readText)
            throw IllegalStateException("Az ingest hívás sikertelen: $statusCode ${errorBody.orEmpty()}")
        }
    }

    private fun createConnection(url: String, token: String): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.setRequestProperty("Authorization", "Bearer $token")
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        return connection
    }
}
