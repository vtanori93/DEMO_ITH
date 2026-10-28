#pragma once
#include <cctype>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <ctime>
#include <map>
#include <string>
#include <vector>

#define PROGMEM

class String {
  std::string value;
public:
  String(const char* text) : value(text) {}
  String(const char* text, size_t length) : value(text, length) {}
  const char* c_str() const { return value.c_str(); }
  bool equalsIgnoreCase(const char* other) const {
    if (value.size() != std::strlen(other)) return false;
    for (size_t i = 0; i < value.size(); ++i)
      if (std::tolower(static_cast<unsigned char>(value[i])) !=
          std::tolower(static_cast<unsigned char>(other[i]))) return false;
    return true;
  }
  String& operator+=(char other) { value += other; return *this; }
  String& operator+=(const String& other) { value += other.value; return *this; }
};

namespace Fake {
struct AP { bool visible = true, passwordCorrect = true, internet = true; };
struct WatchdogReset {};
inline uint32_t clock = 0, lastWatchdogReset = 0, watchdogTimeout = 0;
inline bool wifi = false, server = true, clockValid = false, reply = true;
inline bool failSend = false, ntp = true;
inline int ntpRequests = 0, closes = 0, wdtResets = 0;
inline std::map<std::string, AP> aps;
inline std::string activeSSID, serial;
inline std::vector<std::string> attempts, messages;
inline std::vector<uint32_t> sentAt;
inline uint32_t rng = 0x12345678;
inline bool routeReady() {
  return wifi && aps.count(activeSSID) && aps.at(activeSSID).visible && aps.at(activeSSID).internet;
}
}

inline uint32_t millis() { return Fake::clock; }
inline void delay(uint32_t ms) {
  Fake::clock += ms;
  if (Fake::watchdogTimeout && uint32_t(Fake::clock - Fake::lastWatchdogReset) >= Fake::watchdogTimeout)
    throw Fake::WatchdogReset{};
}
inline long random(long lower, long upper) {
  Fake::rng = Fake::rng * 1664525u + 1013904223u;
  return lower + Fake::rng % static_cast<uint32_t>(upper - lower);
}
inline time_t fakeTime(time_t*) { return Fake::clockValid ? 1800000000 : 0; }
#define time fakeTime
inline void configTime(long, int, const char*, const char*, const char*) {
  ++Fake::ntpRequests;
  if (Fake::ntp && Fake::routeReady()) Fake::clockValid = true;
}
struct FakeSerial {
  void begin(unsigned long) {}
  void println(const char* text) { Fake::serial += std::string(text) + '\n'; }
  int printf(const char* format, ...) {
    char buffer[2048];
    va_list args;
    va_start(args, format);
    const int length = std::vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Fake::serial += buffer;
    return length;
  }
};
inline FakeSerial Serial;
constexpr int WIFI_STA = 1, WL_CONNECTED = 3;
struct FakeWiFi {
  void persistent(bool) {}
  void mode(int) {}
  void setAutoReconnect(bool) {}
  void begin(const char* name, const char*) {
    Fake::activeSSID = name;
    Fake::attempts.emplace_back(name);
    Fake::wifi = Fake::aps.count(name) && Fake::aps.at(name).visible && Fake::aps.at(name).passwordCorrect;
  }
  int status() {
    if (!Fake::aps.count(Fake::activeSSID) || !Fake::aps.at(Fake::activeSSID).visible) Fake::wifi = false;
    return Fake::wifi ? WL_CONNECTED : 0;
  }
  void disconnect(bool, bool) { Fake::wifi = false; }
};
inline FakeWiFi WiFi;
