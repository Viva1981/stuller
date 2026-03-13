package hu.stuller.housesensor

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.stuller.housesensor.ui.SensorScreenState
import hu.stuller.housesensor.ui.SensorViewModel

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<SensorViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
                    HouseSensorScreen(
                        state = uiState,
                        onBaseUrlChange = viewModel::updateBaseUrl,
                        onTokenChange = viewModel::updateSensorToken,
                        onSensorLabelChange = viewModel::updateSensorLabel,
                        onIntervalChange = viewModel::updateIntervalSeconds,
                        onSave = viewModel::saveSettings,
                        onStart = viewModel::startSensor,
                        onStop = viewModel::stopSensor,
                        onRunNow = viewModel::runNow,
                        onOpenBatterySettings = viewModel::openBatteryOptimizationSettings,
                    )
                }
            }
        }
    }
}

@Composable
private fun HouseSensorScreen(
    state: SensorScreenState,
    onBaseUrlChange: (String) -> Unit,
    onTokenChange: (String) -> Unit,
    onSensorLabelChange: (String) -> Unit,
    onIntervalChange: (String) -> Unit,
    onSave: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onRunNow: () -> Unit,
    onOpenBatterySettings: () -> Unit,
) {
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = {}
    )

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Stuller House Sensor",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
        )

        Text(
            text = "A lakásban maradó Redmi telefon innen küldi a jelenléti és eszköz megfigyeléseket a családi appnak.",
            style = MaterialTheme.typography.bodyMedium,
        )

        Card {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = state.form.baseUrl,
                    onValueChange = onBaseUrlChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Családi app URL") },
                    placeholder = { Text("https://valami.vercel.app") },
                    singleLine = true,
                )

                OutlinedTextField(
                    value = state.form.sensorToken,
                    onValueChange = onTokenChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("HOUSE_SENSOR_TOKEN") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )

                OutlinedTextField(
                    value = state.form.sensorLabel,
                    onValueChange = onSensorLabelChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Szenzor címke") },
                    singleLine = true,
                )

                OutlinedTextField(
                    value = state.form.intervalSeconds,
                    onValueChange = onIntervalChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Mérési ciklus másodpercben") },
                    singleLine = true,
                )

                Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) {
                    Text("Beállítások mentése")
                }
            }
        }

        Card {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Szenzor állapota", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(if (state.isRunning) "A figyelés fut." else "A figyelés jelenleg le van állítva.")
                Text(state.statusText, style = MaterialTheme.typography.bodySmall)

                Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) {
                    Text("Figyelés indítása")
                }

                Button(onClick = onRunNow, modifier = Modifier.fillMaxWidth()) {
                    Text("Mérés most")
                }

                TextButton(onClick = onStop, modifier = Modifier.fillMaxWidth()) {
                    Text("Leállítás")
                }
            }
        }

        Card {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Redmi ajánlások", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Kapcsold ki az akkumulátor-optimalizálást, engedélyezd az értesítéseket, és tartsd a telefont töltőn.")
                TextButton(onClick = onOpenBatterySettings) {
                    Text("Akkumulátor-optimalizálás beállítása")
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
