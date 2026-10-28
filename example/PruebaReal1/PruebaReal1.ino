// ESP32: enviar tres valores flotantes de prueba a Voltio cada segundo. Configura las redes Wi-Fi.
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <esp_task_wdt.h>
#include <esp_attr.h>
#include <esp_system.h>
#include <time.h>

struct WifiNetwork {
  const char* ssid;
  const char* password;
};

// Agrega o elimina renglones. Se prueban en este orden; elimina las redes que no uses.
const WifiNetwork WIFI_NETWORKS[] = {
  {"TU_RED_PRINCIPAL", "CONTRASENA_PRINCIPAL"},
  {"TU_RED_DE_RESPALDO", "CONTRASENA_RESPALDO"},
  {"TU_PUNTO_DE_ACCESO", "CONTRASENA_PUNTO_DE_ACCESO"},
};
const size_t WIFI_NETWORK_COUNT = sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]);
static_assert(WIFI_NETWORK_COUNT > 0, "Configura al menos una red Wi-Fi.");
const char WS_HOST[] = "grain-exploring-setting.ngrok-free.dev";
const char WS_PATH[] = "/ws/esp32?device=esp32-01";
const uint32_t SEND_INTERVAL_MS = 1000;
const uint32_t WIFI_RETRY_MS = 10000;
const uint32_t WIFI_FAILOVER_MS = 60000;
const uint32_t NTP_RETRY_MS = 30000;
const uint32_t SOCKET_IDLE_MS = 15000;

// CA oficial de Let's Encrypt para verificar el certificado HTTPS/WSS de ngrok.
// https://letsencrypt.org/certs/isrgrootx1.pem
const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)PEM";

WebSocketsClient socket;
bool connected = false;
bool wifiReady = false;
bool watchdogEnabled = false;
uint32_t lastSend = 0;
uint32_t lastWifiRetry = 0;
uint32_t lastNtpRetry = 0;
uint32_t lastServerActivity = 0;
size_t wifiIndex = 0;

// Conserva la siguiente opción tras un reinicio por bloqueo, sin escribir en la flash.
RTC_NOINIT_ATTR uint32_t wifiRecoveryMarker;
RTC_NOINIT_ATTR uint32_t wifiRecoveryIndex;
const uint32_t WIFI_RECOVERY_MARKER = 0x564F4C54;

void connectWifi(bool nextNetwork) {
  if (nextNetwork) wifiIndex = (wifiIndex + 1) % WIFI_NETWORK_COUNT;
  wifiRecoveryMarker = WIFI_RECOVERY_MARKER;
  wifiRecoveryIndex = static_cast<uint32_t>((wifiIndex + 1) % WIFI_NETWORK_COUNT);
  socket.disconnect();
  connected = false;
  wifiReady = false;
  lastWifiRetry = millis();
  WiFi.disconnect(false, false);
  WiFi.begin(WIFI_NETWORKS[wifiIndex].ssid, WIFI_NETWORKS[wifiIndex].password);
  Serial.printf("[Wi-Fi] Intentando red %u de %u: %s\n",
                static_cast<unsigned>(wifiIndex + 1), static_cast<unsigned>(WIFI_NETWORK_COUNT),
                WIFI_NETWORKS[wifiIndex].ssid);
}

void socketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    connected = true;
    lastServerActivity = millis();
    lastSend = millis() - SEND_INTERVAL_MS;  // Primera muestra inmediata al reconectar.
    Serial.println("Socket conectado. Enviando cada 1 segundo.");
  } else if (type == WStype_DISCONNECTED) {
    connected = false;
    Serial.println("Socket desconectado. Se reintentará automáticamente.");
  } else if (type == WStype_PING || type == WStype_PONG) {
    lastServerActivity = millis();
  } else if (type == WStype_TEXT || type == WStype_ERROR) {
    if (type == WStype_TEXT) lastServerActivity = millis();
    if (payload != nullptr && length > 0) {
      const size_t shown = length > 256 ? 256 : length;
      Serial.printf("Servidor: %.*s\n", static_cast<int>(shown),
                    reinterpret_cast<const char*>(payload));
    }
  }
}

void setup() {
  Serial.begin(115200);
  // Si una operación bloquea el bucle durante 20 s, el watchdog reinicia el ESP32.
  const esp_task_wdt_config_t watchdog = {20000, 0, true};
  esp_err_t status = esp_task_wdt_init(&watchdog);
  if (status == ESP_ERR_INVALID_STATE) status = esp_task_wdt_reconfigure(&watchdog);
  if (status == ESP_OK && esp_task_wdt_status(nullptr) != ESP_OK)
    status = esp_task_wdt_add(nullptr);
  watchdogEnabled = status == ESP_OK;
  if (!watchdogEnabled) Serial.printf("No se pudo activar el watchdog: %d\n", status);

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  // La rotación de WIFI_NETWORKS controla los intentos y evita volver a una red fallida.
  WiFi.setAutoReconnect(false);
  const esp_reset_reason_t reason = esp_reset_reason();
  const bool watchdogReset = reason == ESP_RST_TASK_WDT || reason == ESP_RST_INT_WDT || reason == ESP_RST_WDT;
  wifiIndex = watchdogReset && wifiRecoveryMarker == WIFI_RECOVERY_MARKER
    ? wifiRecoveryIndex % WIFI_NETWORK_COUNT : 0;
  // TLS necesita la fecha correcta; la conexión se inicia cuando NTP responde.
  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
  lastNtpRetry = millis();

  socket.beginSslWithCA(WS_HOST, 443, WS_PATH, ROOT_CA, "");
  socket.onEvent(socketEvent);
  socket.setExtraHeaders("ngrok-skip-browser-warning: true\r\n");
  socket.setReconnectInterval(3000);
  socket.enableHeartbeat(5000, 5000, 2);
  connectWifi(false);
  Serial.println("Conectando a una red Wi-Fi y sincronizando la fecha...");
}

void loop() {
  if (watchdogEnabled) esp_task_wdt_reset();
  if (WiFi.status() != WL_CONNECTED) {
    if (connected) socket.disconnect();
    connected = false;
    wifiReady = false;
    if (millis() - lastWifiRetry >= WIFI_RETRY_MS) {
      Serial.println("[Wi-Fi] La red no conectó. Intentando la siguiente...");
      connectWifi(true);
    }
    delay(10);
    return;
  }
  if (!wifiReady) {
    wifiReady = true;
    socket.disconnect();
    connected = false;
    lastServerActivity = millis();
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
    lastNtpRetry = millis();
    Serial.printf("[Wi-Fi] Red conectada: %s. Preparando conexión segura...\n",
                  WIFI_NETWORKS[wifiIndex].ssid);
  }
  // Wi-Fi conectado no garantiza Internet: prueba otra red si Voltio no responde.
  if (millis() - lastServerActivity >= WIFI_FAILOVER_MS) {
    Serial.println("[Wi-Fi] Sin respuesta del servidor por 60 s. Cambiando de red...");
    connectWifi(true);
    delay(10);
    return;
  }
  if (time(nullptr) < 1700000000) {
    if (millis() - lastNtpRetry >= NTP_RETRY_MS) {
      lastNtpRetry = millis();
      configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
      Serial.println("Reintentando sincronización de fecha para TLS...");
    }
    delay(10);
    return;
  }

  socket.loop();  // Atiende conexión, reconexión y ping/pong.
  if (watchdogEnabled) esp_task_wdt_reset();
  if (connected && millis() - lastServerActivity >= SOCKET_IDLE_MS) {
    Serial.println("Socket sin respuesta. Reiniciando conexión...");
    socket.disconnect();
    connected = false;
  }
  // Diferencias unsigned: el temporizador sigue funcionando al desbordarse millis().
  // Se genera una muestra por intervalo, sin recuperar envíos perdidos en ráfaga.
  if (connected && millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    // División flotante; no convertir las lecturas a int. Resolución de prueba: 0.0001.
    const float temperature = random(-300000L, 1000001L) / 10000.0f;
    const float voltage = random(0L, 120001L) / 10000.0f;
    const float current = random(0L, 500001L) / 10000.0f;
    char json[128];
    const int length = snprintf(json, sizeof(json),
      "{\"temperature\":%.4f,\"voltage\":%.4f,\"current\":%.4f}",
      static_cast<double>(temperature), static_cast<double>(voltage),
      static_cast<double>(current));
    if (length > 0 && static_cast<size_t>(length) < sizeof(json)) {
      if (socket.sendTXT(json, static_cast<size_t>(length))) {
        Serial.println(json);
      } else {
        Serial.println("Falló el envío. Reconectando socket...");
        socket.disconnect();
        connected = false;
      }
    }
  }
  delay(5);
}
