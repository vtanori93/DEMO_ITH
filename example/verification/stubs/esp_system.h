#pragma once
enum esp_reset_reason_t { ESP_RST_POWERON, ESP_RST_SW, ESP_RST_TASK_WDT, ESP_RST_INT_WDT, ESP_RST_WDT };
inline esp_reset_reason_t simulatedReset = ESP_RST_POWERON;
inline esp_reset_reason_t esp_reset_reason() { return simulatedReset; }
