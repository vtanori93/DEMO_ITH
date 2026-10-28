"""Envía tres valores flotantes simulados a Voltio cada segundo. Salir: Ctrl+C."""

import json
import random
import time

from websockets.exceptions import WebSocketException
from websockets.sync.client import connect

URL = "wss://grain-exploring-setting.ngrok-free.dev/ws/esp32?device=esp32-01"


def main() -> None:
    try:
        while True:
            try:
                with connect(
                    URL,
                    additional_headers={"ngrok-skip-browser-warning": "true"},
                    proxy=None,
                    compression=None,
                    open_timeout=8,
                    close_timeout=2,
                    ping_interval=5,
                    ping_timeout=10,
                ) as socket:
                    print(f"Conectado a {URL}. Enviando cada 1 segundo.", flush=True)
                    while True:
                        # float en los tres canales; cuatro decimales como el ejemplo ESP32.
                        # JSON usa punto decimal y números, sin cadenas ni unidades.
                        datos: dict[str, float] = {
                            "temperature": round(random.uniform(-30.0, 100.0), 4),
                            "voltage": round(random.uniform(0.0, 12.0), 4),
                            "current": round(random.uniform(0.0, 50.0), 4),
                        }
                        mensaje = json.dumps(datos, allow_nan=False)
                        socket.send(mensaje)
                        print(time.strftime("%H:%M:%S"), mensaje, flush=True)
                        time.sleep(1)
            except (OSError, TimeoutError, WebSocketException) as error:
                print(
                    f"Error de conexión: {error}. Reintentando en 3 segundos…",
                    flush=True,
                )
                time.sleep(3)
    except KeyboardInterrupt:
        print("\nEmisor detenido.")


if __name__ == "__main__":
    main()
