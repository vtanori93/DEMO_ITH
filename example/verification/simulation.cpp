#ifndef SKETCH_FILE
#define SKETCH_FILE "../PruebaReal1/PruebaReal1.ino"
#endif
#include SKETCH_FILE

#include <fstream>
#include <iostream>
#include <stdexcept>

int failures = 0;
void expect(bool value, const char* message) {
  if (!value) throw std::runtime_error(message);
}
template<class Test> void test(const char* name, Test body) {
  try { body(); std::cout << "PASS | " << name << '\n'; }
  catch (const std::exception& error) { ++failures; std::cout << "FAIL | " << name << ": " << error.what() << '\n'; }
  catch (...) { ++failures; std::cout << "FAIL | " << name << ": reinicio simulado inesperado\n"; }
}
void runFor(uint32_t duration) {
  const uint32_t start = Fake::clock;
  while (uint32_t(Fake::clock - start) < duration) loop();
}
void intervalsSince(size_t first) {
  for (size_t i = first + 1; i < Fake::sentAt.size(); ++i)
    expect(uint32_t(Fake::sentAt[i] - Fake::sentAt[i - 1]) >= 1000, "Se detectó una ráfaga de envíos");
}
void reset(esp_reset_reason_t reason = ESP_RST_POWERON, bool keepRTC = false) {
  socket = WebSocketsClient{};
  socketConfigured = connected = wifiReady = watchdogEnabled = false;
  lastSend = lastWifiRetry = lastNtpRetry = lastServerActivity = 0;
  wifiIndex = 0;
  Fake::clock = Fake::lastWatchdogReset = Fake::watchdogTimeout = 0;
  Fake::wifi = Fake::clockValid = Fake::failSend = false;
  Fake::server = Fake::reply = Fake::ntp = true;
  Fake::ntpRequests = Fake::closes = Fake::wdtResets = 0;
  Fake::aps.clear(); Fake::activeSSID.clear(); Fake::attempts.clear(); Fake::sentAt.clear();
  Fake::serial.clear();
  for (const auto& ap : WIFI_NETWORKS) Fake::aps[ap.ssid] = Fake::AP{};
  if (!keepRTC) wifiRecoveryMarker = wifiRecoveryIndex = 0;
  subscribed = false;
  simulatedReset = reason;
}

int main(int argc, char** argv) {
  expect(argc == 2, "Indica el archivo de mensajes JSON de salida");
  test("URL única: ocho direcciones válidas conservan servidor, puerto y parámetros", [] {
    struct Case { const char* url; const char* host; uint16_t port; const char* path; };
    const Case cases[] = {
      {WS_URL, "grain-exploring-setting.ngrok-free.dev", 443, "/ws/esp32?device=esp32-01"},
      {"wss://example.com", "example.com", 443, "/"},
      {"wss://example.com?device=esp32-01", "example.com", 443, "/?device=esp32-01"},
      {"wss://example.com:8443/ws?device=uno%2Fdos&mode=real", "example.com", 8443, "/ws?device=uno%2Fdos&mode=real"},
      {"WSS://example.com:443/ws", "example.com", 443, "/ws"},
      {"wss://127.0.0.1:443/ws", "127.0.0.1", 443, "/ws"},
      {"wss://[::1]:8443/ws", "::1", 8443, "/ws"},
      {"wss://example.com:65535/", "example.com", 65535, "/"},
    };
    for (const auto& value : cases) {
      reset(); expect(configureSocketUrl(value.url), "Rechazó una URL válida");
      expect(socket.starts == 1 && socket.host == value.host && socket.port == value.port && socket.path == value.path,
             "No conservó los componentes de la URL");
      expect(socket.ca == ROOT_CA, "No conservó la verificación de certificado");
    }
  });
  test("URL única: catorce direcciones inválidas se rechazan sin abrir WSS", [] {
    const std::string tooLong = "wss://example.com/" + std::string(2048, 'a');
    const char* cases[] = {nullptr, "", "ws://example.com/ws", "https://example.com/ws", "wss:///ws",
      "wss://example.com:0/ws", "wss://example.com:65536/ws", "wss://example.com:abc/ws",
      "wss://u:p@example.com/ws", "wss://example.com/ws#detalle", "wss://exa mple.com/ws",
      "wss://example.com\r\n/ws", tooLong.c_str(), "wss://example.com/ws#"};
    for (const char* value : cases) {
      reset(); expect(!configureSocketUrl(value), "Aceptó una URL inválida");
      expect(socket.starts == 0, "Abrió WSS con una URL inválida");
    }
  });
  test("Configuración WSS: URL, CA y encabezado de ngrok", [] {
    reset(); setup();
    expect(socketConfigured && socket.starts == 1, "No se configuró el socket");
    expect(socket.host == "grain-exploring-setting.ngrok-free.dev", "Servidor incorrecto");
    expect(socket.port == 443 && socket.path == "/ws/esp32?device=esp32-01", "Puerto, ruta o identificador incorrecto");
    expect(socket.ca == ROOT_CA && std::strstr(socket.ca, "BEGIN CERTIFICATE"), "No se conserva el certificado CA");
    expect(socket.extraHeaders == "ngrok-skip-browser-warning: true\r\n", "Falta encabezado de ngrok");
    expect(Fake::serial.find(WIFI_PASSWORD) == std::string::npos, "La contraseña aparece en el monitor serie");
  });
  test("Red estable: un mensaje cada 1000 ms durante 73 segundos", [] {
    reset(); setup(); runFor(73000);
    expect(watchdogEnabled && subscribed && activeWatchdog.timeout_ms == 20000 && activeWatchdog.trigger_panic,
           "Configuración del watchdog incorrecta");
    expect(Fake::sentAt.size() >= 60, "No se enviaron las muestras esperadas");
    expect(Fake::attempts.size() == 1, "Se cambió de red sin necesidad");
    for (size_t i = 1; i < Fake::sentAt.size(); ++i)
      expect(uint32_t(Fake::sentAt[i] - Fake::sentAt[i - 1]) == 1000, "Intervalo distinto de 1000 ms");
  });
  test("Sin Wi-Fi: reintenta en orden y recupera una red disponible", [] {
    reset(); for (auto& ap : Fake::aps) ap.second.visible = false;
    setup(); runFor(45000);
    expect(Fake::sentAt.empty() && Fake::attempts.size() >= 5, "No se mantuvieron los reintentos");
    for (size_t i = 0; i < Fake::attempts.size(); ++i)
      expect(Fake::attempts[i] == WIFI_NETWORKS[i % WIFI_NETWORK_COUNT].ssid, "Orden de redes incorrecto");
    Fake::aps[WIFI_NETWORKS[WIFI_NETWORK_COUNT - 1].ssid].visible = true;
    runFor(WIFI_NETWORK_COUNT * WIFI_RETRY_MS + 5000);
    expect(!Fake::sentAt.empty(), "No se recuperó el envío"); intervalsSince(0);
  });
  test("Contraseña incorrecta: no envía y recupera la conexión al corregirse", [] {
    reset(); for (auto& ap : Fake::aps) ap.second.passwordCorrect = false;
    setup(); runFor(35000);
    expect(Fake::sentAt.empty() && Fake::attempts.size() >= 4, "Comportamiento incorrecto sin credenciales válidas");
    for (auto& ap : Fake::aps) ap.second.passwordCorrect = true;
    runFor(12000); expect(!Fake::sentAt.empty(), "No recuperó la conexión"); intervalsSince(0);
  });
  test("Pérdida de señal: conserva reintentos y reanuda sin ráfagas", [] {
    reset(); setup(); runFor(6000); const size_t before = Fake::sentAt.size();
    for (auto& ap : Fake::aps) ap.second.visible = false;
    runFor(16000); expect(Fake::sentAt.size() == before, "Envió con Wi-Fi desconectado");
    for (auto& ap : Fake::aps) ap.second.visible = true;
    runFor(12000); expect(Fake::sentAt.size() > before, "No recuperó el envío"); intervalsSince(before);
  });
  test("Wi-Fi sin Internet: reintenta y se recupera", [] {
    reset(); setup(); runFor(6000); const size_t before = Fake::sentAt.size();
    for (auto& ap : Fake::aps) ap.second.internet = false;
    runFor(66000); expect(Fake::sentAt.size() == before && Fake::attempts.size() >= 2, "No detectó la caída de Internet");
    for (auto& ap : Fake::aps) ap.second.internet = true;
    runFor(12000); expect(Fake::sentAt.size() > before, "No recuperó Internet"); intervalsSince(before);
  });
  test("Arranque sin NTP: espera una fecha válida antes de abrir WSS", [] {
    reset(); Fake::ntp = false; setup(); runFor(61000);
    expect(Fake::sentAt.empty() && !connected && Fake::ntpRequests >= 3, "Intentó enviar sin fecha válida");
    Fake::ntp = true; runFor(35000);
    expect(Fake::clockValid && !Fake::sentAt.empty(), "No se recuperó tras sincronizar la fecha"); intervalsSince(0);
  });
  test("Servidor caído: mantiene intentos y recupera el envío", [] {
    reset(); setup(); runFor(6000); const size_t before = Fake::sentAt.size();
    Fake::server = false; runFor(130000);
    expect(Fake::sentAt.size() == before && Fake::attempts.size() >= 3, "No mantuvo los reintentos");
    Fake::server = true; runFor(10000);
    expect(Fake::sentAt.size() > before, "No se recuperó el servidor"); intervalsSince(before);
  });
  test("Error de envío: reconecta sin reproducir datos perdidos", [] {
    reset(); setup(); runFor(6000); const size_t before = Fake::sentAt.size();
    Fake::failSend = true; runFor(1200);
    expect(Fake::sentAt.size() == before && Fake::closes > 0, "No cerró el socket al fallar el envío");
    Fake::failSend = false; runFor(5000);
    expect(Fake::sentAt.size() > before, "No recuperó el envío"); intervalsSince(before);
  });
  test("Socket silencioso: se cierra y recupera", [] {
    reset(); setup(); runFor(6000); Fake::reply = false; runFor(17000);
    expect(Fake::closes > 0, "No cerró el socket silencioso");
    Fake::reply = true; const size_t before = Fake::sentAt.size(); runFor(7000);
    expect(Fake::sentAt.size() > before, "No recuperó el socket"); intervalsSince(before);
  });
  test("Bloqueo de E/S: watchdog modelado y recuperación tras reinicio", [] {
    reset(); setup(); runFor(6000); socket.blockMs = 25000;
    bool rebooted = false;
    try { loop(); } catch (const Fake::WatchdogReset&) { rebooted = true; }
    expect(rebooted, "No se activó el watchdog modelado de 20 segundos");
    reset(ESP_RST_TASK_WDT, true); setup(); runFor(6000);
    expect(!Fake::sentAt.empty(), "No se recuperó tras el reinicio modelado");
  });
  test("Memoria RTC: siguiente red tras watchdog y validación del marcador", [] {
    reset(); setup(); expect(wifiRecoveryIndex == 1 % WIFI_NETWORK_COUNT, "Siguiente red incorrecta");
    reset(ESP_RST_TASK_WDT, true); setup(); expect(wifiIndex == 1 % WIFI_NETWORK_COUNT, "No utilizó la red guardada");
    reset(ESP_RST_POWERON, true); setup(); expect(wifiIndex == 0, "Un encendido normal no empieza por la primera red");
    reset(ESP_RST_TASK_WDT, true); wifiRecoveryMarker = 0; setup(); expect(wifiIndex == 0, "No validó el marcador RTC");
  });
  test("Desbordamiento de millis: conserva los intervalos de envío", [] {
    reset(); setup(); runFor(6000);
    Fake::clock = UINT32_MAX - 800; Fake::lastWatchdogReset = Fake::clock; socket.forceConnected();
    const size_t before = Fake::sentAt.size(); runFor(3500);
    expect(Fake::sentAt.size() >= before + 3 && Fake::wdtResets > 0, "Se detuvo al desbordarse millis"); intervalsSince(before);
  });
  test("URL inválida: no abre el socket ni empieza a enviar", [] {
    reset(); expect(!configureSocketUrl("ws://example.com/ws"), "Aceptó una URL sin TLS");
    runFor(1000);
    expect(socket.starts == 0 && Fake::sentAt.empty() && Fake::attempts.empty(), "Se inició sin una URL válida");
  });
  if constexpr (WIFI_NETWORK_COUNT > 1) {
    test("Respaldo opcional: cambia de red por señal o credenciales incorrectas", [] {
      reset(); Fake::aps[WIFI_NETWORKS[0].ssid].visible = false; setup(); runFor(16000);
      expect(wifiIndex == 1 && !Fake::sentAt.empty(), "No encontró la red de respaldo");
      reset(); Fake::aps[WIFI_NETWORKS[0].ssid].passwordCorrect = false; setup(); runFor(16000);
      expect(wifiIndex == 1 && !Fake::sentAt.empty(), "No pasó a la segunda red");
    });
    test("Respaldo opcional: cambia de red al perder Internet y conserva la red estable", [] {
      reset(); setup(); runFor(6000); Fake::aps[WIFI_NETWORKS[0].ssid].internet = false; runFor(66000);
      expect(wifiIndex == 1 && !Fake::sentAt.empty(), "No cambió al respaldo con Internet");
      const size_t attempts = Fake::attempts.size();
      Fake::aps[WIFI_NETWORKS[0].ssid].internet = true; runFor(70000);
      expect(wifiIndex == 1 && Fake::attempts.size() == attempts, "Interrumpió un respaldo estable");
    });
  }
  std::ofstream output(argv[1]);
  for (const auto& message : Fake::messages) output << message << '\n';
  return failures ? 1 : 0;
}
