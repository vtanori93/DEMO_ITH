# Ejemplos de integración con Voltio

Cada ejemplo vive en una subcarpeta independiente, con instrucciones para ejecutarlo.

| Ejemplo | Descripción |
| --- | --- |
| [python-dummy-sender](python-dummy-sender/main.py) | Un solo archivo `main.py` que envía temperatura, voltaje y corriente por WebSocket cada segundo, con reconexión automática. |
| [PruebaReal1](PruebaReal1/PruebaReal1.ino) | Un único sketch ESP32 listo para agregar únicamente red y contraseña Wi-Fi; envía tres valores de prueba cada segundo y admite respaldos opcionales. |

La aplicación receptora se encuentra en [`../webapp/`](../webapp/README.md). El destino actual ya está configurado en ambos ejemplos; solo necesitas iniciar la webapp y el túnel. La pantalla **Conexión** muestra **Dirección para el ESP32** si en el futuro cambia el servidor.

El dominio configurado actualmente es `https://grain-exploring-setting.ngrok-free.dev`. Los dos ejemplos envían a `wss://grain-exploring-setting.ngrok-free.dev/ws/esp32?device=esp32-01`. Si cambias el dominio, actualiza `webapp/.env`, `URL` en Python y la URL completa `WS_URL` en el sketch; reinicia los procesos y vuelve a cargar el programa en el ESP32.

Los tres canales son **valores de punto flotante**, con números JSON como `{"temperature":-12.3456,"voltage":11.2345,"current":8.7654}`. Python usa `float`; Arduino C++ usa `float` y `snprintf` con `%.4f`. Ambos ejemplos generan hasta cuatro decimales, con punto decimal y sin comillas en los valores. La webapp los recibe como `number` sin convertirlos a enteros. Los indicadores permiten elegir de 0 a 4 decimales visibles; el historial conserva la fracción recibida y el CSV utiliza cuatro decimales. La cantidad de decimales de estos datos dummy no representa la exactitud de un sensor real.

Para agregar otro ejemplo, crea una carpeta dentro de `example/`, documenta cómo instalarlo y ejecutarlo y añádelo a esta tabla. Cada proyecto debe poder instalarse por separado.

## Ejecutar el ejemplo Python

Con Python 3.11 o superior, desde la raíz del proyecto. El entorno se mantiene fuera de `python-dummy-sender/`, que contiene únicamente `main.py`:

```sh
python3.14 -m venv example/.venv
source example/.venv/bin/activate
python -m pip install websockets==17.3
python example/python-dummy-sender/main.py
```

En este equipo el entorno ya está instalado; basta activar `example/.venv` y ejecutar el archivo. Para detener el envío usa Ctrl+C. La dirección WSS se configura en la constante `URL` de `main.py`.

## Cargar PruebaReal1 en el ESP32

1. Abrir `PruebaReal1/PruebaReal1.ino` en Arduino IDE.
2. Instalar **esp32 by Espressif Systems** y la librería **WebSockets de Markus Sattler / Links2004**.
3. Cambiar únicamente `WIFI_SSID` y `WIFI_PASSWORD`, al principio del archivo. El dominio, puerto 443, ruta, identificador, certificado, sincronización de hora y reconexión ya están configurados.
4. Seleccionar la placa ESP32 y el puerto USB, verificar y cargar. Abrir el monitor serie a **115200 baudios**.

Solo debes editar estos dos valores del sketch:

```cpp
const char WIFI_SSID[] = "TU_RED_WIFI";
const char WIFI_PASSWORD[] = "TU_CONTRASENA_WIFI";
```

El destino ya está definido en una sola constante, sin separar servidor, puerto y ruta:

```cpp
const char WS_URL[] = "wss://grain-exploring-setting.ngrok-free.dev/ws/esp32?device=esp32-01";
```

El sketch extrae los componentes automáticamente, utiliza el puerto 443 cuando se omite y conserva los parámetros como `device`. Si cambia el receptor, basta reemplazar esta URL por la dirección de la pantalla **Conexión**. Una URL inválida muestra un aviso en el monitor serie; no se intenta una conexión sin TLS.

El sketch envía `temperature` (−30 a 100 °C), `voltage` (0 a 12 V) y `current` (0 a 50 A) con valores simulados cada segundo. Utiliza WSS con verificación de certificado, sincronización NTP y reconexión automática. La webapp y el túnel deben estar activos, y el receptor debe estar libre de otro emisor. Solo hay una red activa por defecto; no necesitas rellenar ni eliminar redes adicionales.

La cadencia es de **1000 ms mientras la conexión está disponible**. Al reconectar envía una muestra nueva inmediatamente y continúa cada segundo; no acumula ni reproduce muestras antiguas. Intenta las redes Wi-Fi en el orden de `WIFI_NETWORKS`, con 10 segundos por intento, y vuelve al inicio de la lista si ninguna conecta. Si el Wi-Fi está conectado pero Voltio no responde por 60 segundos, prueba la siguiente red. Reintenta NTP cada 30 segundos. Un socket silencioso se reconecta después de 15 segundos; un bloqueo del bucle activa el watchdog de 20 segundos y al reiniciar intenta la siguiente red recordada en memoria RTC.

Durante una caída de Internet, del túnel o del servidor no se pueden entregar mensajes. El sketch mantiene los reintentos y reanuda el envío cuando se recuperan. Los errores de credenciales Wi-Fi, dominio o identificador requieren corregir la configuración.

Compilación verificada para **ESP32 Dev Module**, con **esp32 3.3.12** y **WebSockets 2.7.2**, usando la partición predeterminada. La carga por USB y la conexión Wi-Fi deben probarse en la placa física.

Se repitió una compilación limpia para `esp32:esp32:esp32` y la simulación del sketch completo: 16 escenarios con la red entregada y 18 con respaldos opcionales. Los 458 mensajes simulados pasaron el validador real de Voltio. Los programas para repetir estas pruebas y sus registros están en `verification/`; los detalles y límites de la simulación están en la guía.

La configuración, los cambios y las pruebas están documentados en español de México en [PruebaReal1-CAMBIOS.md](PruebaReal1-CAMBIOS.md).

Para compartir con el ingeniero: [PruebaReal1.zip](PruebaReal1.zip). Incluye el `.ino`, la guía y la verificación; la carpeta `PruebaReal1/` conserva únicamente `PruebaReal1.ino`.
