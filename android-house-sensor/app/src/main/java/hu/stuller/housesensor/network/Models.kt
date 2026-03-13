package hu.stuller.housesensor.network

data class SensorConfig(
    val sensorLabel: String,
    val recommendedIntervalSeconds: Int,
    val devices: List<SensorDevice>,
)

data class SensorDevice(
    val id: String,
    val name: String,
    val slug: String,
    val ownerName: String?,
    val deviceKind: String,
    val ipAddress: String?,
    val macAddress: String?,
    val vendorName: String?,
    val monitorMethod: String,
    val presenceRole: Boolean,
    val stateRole: Boolean,
)

data class SensorObservation(
    val slug: String,
    val reachabilityState: String,
    val latencyMs: Int?,
    val ipAddress: String?,
    val macAddress: String?,
    val vendorName: String?,
    val confidence: Int,
)
