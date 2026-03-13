package hu.stuller.housesensor.sensor

import hu.stuller.housesensor.network.SensorDevice
import hu.stuller.housesensor.network.SensorObservation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetAddress

class NetworkProbe {
    suspend fun probe(device: SensorDevice, timeoutMs: Int = 1_500): SensorObservation? = withContext(Dispatchers.IO) {
        val ipAddress = device.ipAddress ?: return@withContext null

        val startedAt = System.nanoTime()
        val reachable = runCatching {
            InetAddress.getByName(ipAddress).isReachable(timeoutMs)
        }.getOrDefault(false)
        val elapsedMs = ((System.nanoTime() - startedAt) / 1_000_000L).toInt()

        SensorObservation(
            slug = device.slug,
            reachabilityState = if (reachable) "online" else "offline",
            latencyMs = if (reachable) elapsedMs else null,
            ipAddress = ipAddress,
            macAddress = device.macAddress,
            vendorName = device.vendorName,
            confidence = if (reachable) 90 else 70,
        )
    }
}
