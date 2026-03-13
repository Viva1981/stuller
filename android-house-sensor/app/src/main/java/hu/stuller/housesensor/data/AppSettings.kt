package hu.stuller.housesensor.data

data class AppSettings(
    val baseUrl: String = "",
    val sensorToken: String = "",
    val sensorLabel: String = "redmi-note-9-pro",
    val intervalSeconds: Int = 120,
)

fun AppSettings.isConfigured(): Boolean {
    return baseUrl.isNotBlank() && sensorToken.isNotBlank()
}
