#pragma once
#include "WiFi.h"

enum WStype_t { WStype_CONNECTED, WStype_DISCONNECTED, WStype_TEXT, WStype_ERROR, WStype_PING, WStype_PONG };
class WebSocketsClient {
  using Event = void (*)(WStype_t, uint8_t*, size_t);
  Event event = nullptr;
  bool online = false;
  uint32_t failedAt = 0, pongAt = 0, reconnect = 3000;
public:
  std::string host, path, extraHeaders, protocol;
  const char* ca = nullptr;
  uint16_t port = 0;
  int starts = 0;
  uint32_t blockMs = 0;
  void beginSslWithCA(const char* name, uint16_t number, const char* target, const char* certificate, const char* subprotocol) {
    host = name; port = number; path = target; ca = certificate; protocol = subprotocol; ++starts;
  }
  void onEvent(Event handler) { event = handler; }
  void setExtraHeaders(const char* headers) { extraHeaders = headers; }
  void setReconnectInterval(uint32_t ms) { reconnect = ms; }
  void enableHeartbeat(uint32_t, uint32_t, uint8_t) {}
  void forceConnected() {
    online = true; pongAt = Fake::clock; event(WStype_CONNECTED, nullptr, 0);
  }
  void disconnect() {
    if (online) {
      online = false; failedAt = Fake::clock; ++Fake::closes;
      event(WStype_DISCONNECTED, nullptr, 0);
    }
  }
  void loop() {
    if (blockMs) delay(blockMs);
    if (online && (!Fake::routeReady() || !Fake::server)) { disconnect(); return; }
    if (!online && Fake::routeReady() && Fake::server && uint32_t(Fake::clock - failedAt) >= reconnect)
      forceConnected();
    if (online && Fake::reply && uint32_t(Fake::clock - pongAt) >= 5000) {
      pongAt = Fake::clock; event(WStype_PONG, nullptr, 0);
    }
  }
  bool sendTXT(char* data, size_t length) {
    if (!online || Fake::failSend) return false;
    Fake::sentAt.push_back(Fake::clock);
    Fake::messages.emplace_back(data, length);
    return true;
  }
};
