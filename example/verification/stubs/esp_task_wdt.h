#pragma once
#include "WiFi.h"

using esp_err_t = int;
constexpr int ESP_OK = 0, ESP_ERR_INVALID_STATE = 1, ESP_ERR_NOT_FOUND = 2;
struct esp_task_wdt_config_t { uint32_t timeout_ms, idle_core_mask; bool trigger_panic; };
inline esp_task_wdt_config_t activeWatchdog{};
inline bool subscribed = false;
inline int esp_task_wdt_init(const esp_task_wdt_config_t*) { return ESP_ERR_INVALID_STATE; }
inline int esp_task_wdt_reconfigure(const esp_task_wdt_config_t* config) {
  activeWatchdog = *config;
  Fake::watchdogTimeout = config->timeout_ms;
  return ESP_OK;
}
inline int esp_task_wdt_status(void*) { return subscribed ? ESP_OK : ESP_ERR_NOT_FOUND; }
inline int esp_task_wdt_add(void*) { subscribed = true; return ESP_OK; }
inline int esp_task_wdt_reset() {
  ++Fake::wdtResets; Fake::lastWatchdogReset = Fake::clock; return ESP_OK;
}
