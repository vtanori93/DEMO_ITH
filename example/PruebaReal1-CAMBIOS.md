# PruebaReal1: configuración y cambios

**Idioma: español de México (es-MX).** Actualización: 28 de octubre de 2026.

## Qué incluye el ejemplo

El programa se encuentra completo en `PruebaReal1/PruebaReal1.ino`. Conecta un ESP32 a una de las redes Wi-Fi configuradas y envía tres valores de prueba a Voltio por WebSocket seguro (WSS). La carpeta `PruebaReal1` conserva únicamente ese archivo. Esta guía se entrega fuera de la carpeta del sketch.

## Cambios de esta actualización

Se unificó el destino en una sola constante `WS_URL`, con la dirección WSS completa. El analizador incluido en ESP32 obtiene automáticamente servidor, puerto y ruta, incluidos los parámetros de consulta. El puerto predeterminado es 443 y se admiten puertos explícitos. La validación exige `wss://` y rechaza credenciales en la dirección, fragmentos `#` y puertos inválidos; un error aparece en el monitor serie sin iniciar el socket. No se agregó otra dependencia de Arduino.

El sketch está listo para utilizar el receptor actual cambiando **únicamente `WIFI_SSID` y `WIFI_PASSWORD`**, al principio del archivo. Se dejó una sola red activa y se retiraron las tres redes ficticias que antes había que completar o eliminar. El dominio WSS, puerto 443, ruta `/ws/esp32?device=esp32-01`, certificado CA, NTP, cadencia de un segundo y recuperación automática ya están configurados. El monitor serie también muestra el destino seleccionado, sin imprimir la contraseña. Las redes de respaldo siguen disponibles como opción.

Se actualizó el dominio público a `grain-exploring-setting.ngrok-free.dev` en `webapp/.env`, su plantilla y los ejemplos de Python y ESP32. La web utiliza HTTPS y los emisores WSS sobre el mismo dominio. Se conserva `/ws/esp32?device=esp32-01` como ruta de envío y se regeneró el ZIP para entregar al ingeniero. Después de cambiar de dominio, reinicia la webapp y el ejemplo Python; vuelve a cargar el sketch actualizado en la placa ESP32.

Se alineó el manejo de **valores flotantes** entre el sketch, Python y la webapp. Las tres variables del sketch son `float`, la división de los datos dummy usa `10000.0f` y las tres propiedades del JSON utilizan `%.4f`. Se sustituyó el formato anterior de un decimal para temperatura y dos para voltaje y corriente. Python genera `float` redondeados a cuatro decimales; la webapp conserva la fracción recibida y permite elegir la precisión visible de cada indicador. No se modificó la cadencia de 1 Hz ni la recuperación de Wi-Fi y WSS.

Los cambios de redes y recuperación que también incluye esta entrega son:

1. `WIFI_NETWORKS` toma la red principal de `WIFI_SSID` y `WIFI_PASSWORD`. Permite agregar otras redes de respaldo, cada una con su nombre y contraseña, sin exigirlas para empezar.
2. Se agregó el conteo automático de redes. Para agregar o quitar una red basta modificar los renglones de la lista; el programa exige al menos una.
3. Se agregó la rotación en el orden configurado. Si una red no conecta en 10 segundos, se intenta la siguiente. Después de la última, se vuelve a la primera y los intentos continúan.
4. Se agregó un cambio de red después de 60 segundos sin una conexión o respuesta del servidor, aun cuando el ESP32 siga asociado al Wi-Fi. Esto permite probar otra salida a Internet.
5. Antes de cambiar de red se cierra el socket anterior. Al recuperar la conexión se reinicia la sincronización de hora y se establece una nueva conexión WSS.
6. Se agregó memoria RTC para recordar la siguiente red si un bloqueo provoca un reinicio por watchdog. Ese dato se valida antes de usarlo y no se escribe en la memoria flash. Un encendido normal empieza por la primera red.
7. Se agregaron mensajes en español al monitor serie para identificar la red en prueba, la red conectada y el motivo del cambio. Las contraseñas no se imprimen.
8. Se conservaron los envíos a 1 Hz, la validación TLS, los reintentos de NTP, ping/pong, la detección de sockets silenciosos y el watchdog.

## Inicio rápido: solo red y contraseña

Edita únicamente estas dos líneas al principio de `PruebaReal1/PruebaReal1.ino`:

```cpp
const char WIFI_SSID[] = "TU_RED_WIFI";
const char WIFI_PASSWORD[] = "TU_CONTRASENA_WIFI";
```

Carga el sketch en el ESP32 y abre el monitor serie a 115200 baudios. Con la webapp y ngrok activos, el programa conecta al Wi-Fi, sincroniza la hora, establece WSS y envía las tres variables de prueba cada segundo. No necesitas modificar la lista de redes ni los parámetros del servidor para utilizar la configuración actual.

## Agregar varias redes Wi-Fi (opcional)

Edita esta lista al principio del `.ino`:

```cpp
const WifiNetwork WIFI_NETWORKS[] = {
  {WIFI_SSID, WIFI_PASSWORD},
  {"RED_DE_RESPALDO", "CONTRASENA_RESPALDO"},
  {"PUNTO_DE_ACCESO_DEL_CELULAR", "CONTRASENA_DEL_CELULAR"},
};
```

- Coloca primero la red que prefieras para el arranque.
- El archivo entregado contiene solo `{WIFI_SSID, WIFI_PASSWORD}`. Agrega otros renglones únicamente si quieres redes de respaldo.
- Escribe el nombre y la contraseña respetando mayúsculas, minúsculas y espacios.
- Si configuras una sola red, el programa seguirá intentando esa misma red.
- La red debe ser compatible con la placa y permitir acceso a Internet. El ejemplo utiliza credenciales Wi-Fi convencionales; una red con portal de inicio de sesión o autenticación empresarial requiere adaptar la conexión.

La selección se realiza por el orden de la lista. Conserva la red activa mientras el servidor responda. La recuperación de una red de mayor prioridad no interrumpe una conexión que ya funciona.

### Ejemplo de recuperación

1. El ESP32 intenta `RED_PRINCIPAL`.
2. Si no conecta en 10 segundos, intenta `RED_DE_RESPALDO`.
3. Si tampoco conecta, intenta el punto de acceso del celular.
4. Si ninguna conecta, vuelve a iniciar la lista y continúa intentando.
5. Cuando una red funciona, sincroniza la hora, abre WSS y empieza a enviar muestras nuevas cada segundo.

Si el ESP32 se conecta al Wi-Fi pero Voltio deja de responder durante 60 segundos, prueba la siguiente red. El criterio utiliza la conexión WSS y los mensajes de control del servidor. Un túnel apagado, un dominio incorrecto o una falla de Voltio también pueden activar el cambio; la disponibilidad del servidor se debe revisar por separado.

## Parámetros de recuperación

| Parámetro o mecanismo | Valor | Comportamiento |
| --- | --- | --- |
| `SEND_INTERVAL_MS` | 1000 ms | Genera y envía una muestra por segundo mientras WSS está conectado. |
| `WIFI_RETRY_MS` | 10000 ms | Tiempo entre intentos de asociación; cambia al siguiente renglón. |
| `WIFI_FAILOVER_MS` | 60000 ms | Cambia de red si no hay conexión o respuesta de Voltio durante ese periodo. |
| Reconexión WSS | 3000 ms | La librería vuelve a intentar abrir el socket. |
| Ping/pong | Cada 5000 ms | Comprueba que el otro extremo responda. |
| `SOCKET_IDLE_MS` | 15000 ms | Cierra y reconecta un socket sin actividad del servidor. |
| `NTP_RETRY_MS` | 30000 ms | Reintenta obtener una fecha válida para TLS. |
| Watchdog | 20000 ms | Reinicia la placa si el bucle queda bloqueado. Después intenta la siguiente red registrada en RTC. |

Los tiempos de asociación, DNS y negociación TLS también dependen de la red. Los temporizadores utilizan diferencias de 32 bits para tolerar el desbordamiento de `millis()`.

Durante un corte no se pueden entregar mensajes. El programa genera datos nuevos al recuperar WSS y continúa a 1 Hz; no guarda una cola de muestras ni recupera los segundos perdidos en ráfaga.

## Dirección del socket

El destino configurado es:

```text
wss://grain-exploring-setting.ngrok-free.dev/ws/esp32?device=esp32-01
```

La dirección se configura completa en una sola línea:

```cpp
const char WS_URL[] = "wss://grain-exploring-setting.ngrok-free.dev/ws/esp32?device=esp32-01";
```

Si cambia el dominio, la ruta o el identificador, reemplaza únicamente `WS_URL` con la dirección de **Voltio → Conexión → Dirección para el ESP32**. El sketch obtiene el servidor y la ruta automáticamente, conserva `?device=...` y utiliza el puerto 443 cuando no se especifica otro. Ngrok dirige ese puerto público al puerto local 5173 de la webapp.

La conexión verifica el certificado del servidor con la CA incluida y espera una fecha válida de NTP. La webapp, el túnel y el receptor deben estar activos. El receptor admite un emisor; detén el ejemplo de Python antes de probar el ESP32 con el mismo identificador.

## Datos enviados

```json
{"temperature":-12.3456,"voltage":11.2345,"current":8.7654}
```

| Campo | Unidad | Rango de los datos de prueba |
| --- | --- | --- |
| `temperature` | °C | −30 a 100 |
| `voltage` | V | 0 a 12 |
| `current` | A | 0 a 50 |

Cada mensaje es una trama de texto JSON con los tres números de punto flotante. Se utiliza punto decimal y no se incluyen unidades ni comillas en los valores. También se aceptan valores numéricos sin fracción, por ejemplo `25.0` y `25`; no conviertas las lecturas a `int`. El ejemplo genera valores simulados con resolución de 0.0001, que no implica precisión real de un sensor. Para incorporar sensores se debe sustituir la generación de valores y conservar el contrato de envío.

La webapp utiliza `number` y conserva la fracción en las lecturas, mínimos, máximos e historial. El indicador muestra dos decimales inicialmente, configurables de 0 a 4, sin alterar los datos originales. El CSV exporta cuatro decimales. Los valores de punto flotante tienen representación aproximada; para el formato `snprintf`, el argumento `float` se promueve a `double`, sin convertirlo a entero.

## Cargar y revisar en el ESP32

1. Abre `PruebaReal1/PruebaReal1.ino` en Arduino IDE.
2. Instala el paquete **esp32 by Espressif Systems** y la librería **WebSockets de Markus Sattler / Links2004**.
3. Completa solo `WIFI_SSID` y `WIFI_PASSWORD`. El destino del socket ya está configurado.
4. Selecciona la placa y el puerto USB; verifica y carga el sketch.
5. Abre el monitor serie a **115200 baudios** y revisa el nombre de la red conectada y los mensajes JSON.

La configuración de referencia es **ESP32 Dev Module**, con **esp32 3.3.12** y **WebSockets 2.7.2**, usando la partición predeterminada.

### Verificación realizada

La auditoría de esta entrega repitió una **compilación limpia, sin reutilizar el build anterior**, para **ESP32 Dev Module**, FQBN `esp32:esp32:esp32`, core **3.3.12** y WebSockets **2.7.2**. Terminó con código de salida 0. El archivo generado se comprobó como **ELF32 / Tensilica Xtensa**, y el SHA-256 del sketch compilado coincide con el utilizado por la simulación.

La simulación ejecuta las funciones `setup()` y `loop()` del `.ino` real. Pasaron **16 escenarios con la configuración entregada** y **18 con una copia de prueba que agrega dos redes de respaldo**. Se verificaron los 22 casos de URL, la cadencia a 1 Hz, las pérdidas de Wi-Fi e Internet, NTP sin respuesta, servidor caído, errores de envío, socket silencioso, el watchdog modelado, la recuperación RTC modelada y el desbordamiento de `millis()`. Los **458 mensajes JSON** generados fueron aceptados por `parseTelemetry`, el validador real de Voltio, sin alterar las fracciones.

Esta es una **simulación de lógica en el equipo**, con Wi-Fi, socket, reloj, NTP y watchdog sustituidos por modelos de prueba. No emula las instrucciones del microcontrolador ni comprueba radio, negociación TLS en el ESP32, memoria RTC física o alimentación. No se detectó una placa ESP32 conectada por USB. La compilación comprobada corresponde al perfil indicado; no identifica por sí sola la variante física que vaya a utilizarse.

Se volvió a compilar la versión con una sola `WS_URL` y lista para editar únicamente red y contraseña: **1,091,873 bytes de programa (83 %)** y **48,224 bytes de variables globales (14 %)**, para la configuración de referencia indicada arriba.

Se verificó la función extraída del sketch con ocho URLs válidas y catorce inválidas, utilizando un analizador `http_parser` 2.7.0 y un transporte de prueba. Se comprobaron la URL actual, el puerto predeterminado, puertos explícitos, rutas y parámetros de consulta, así como el rechazo de protocolos distintos a WSS, credenciales, fragmentos y puertos incorrectos.

En la revisión anterior, desde este equipo también se validó el certificado del dominio real utilizando exclusivamente la CA incluida en el sketch, se comprobó que dominio, ruta e identificador coinciden con el receptor activo y se abrió una conexión WSS con ping/pong correcto. Esta comprobación no envió mediciones ni sustituyó una prueba de Wi-Fi o TLS desde la placa física.

Las revisiones anteriores ejecutaron 13 escenarios con el código del sketch y funciones de red simuladas: cadencia estable, red principal ausente, contraseña incorrecta, pérdida de señal, todas las redes caídas, pérdida de Internet, arranque sin Internet/NTP, servidor caído, error de envío, socket silencioso, NTP sin respuesta, reinicio por watchdog y desbordamiento de `millis()`. Estas pruebas verifican la lógica de recuperación; la retención física de RTC y las conexiones reales se revisan en la placa.

La revisión de flotantes verificó 253 mensajes generados por el código C++ con funciones de red simuladas y aceptados por el contrato real de la webapp, incluidos valores negativos, `0.0001` y fracciones cercanas a los límites. También se comprobó la exportación a cuatro decimales. El ejemplo Python envió tres muestras al receptor y al monitor mediante WebSocket con intervalos de 1000 y 1008 ms. Las pruebas del navegador verificaron que cambiar la precisión visible no modifica la fracción exportada en el CSV. El sketch compiló para ESP32; esta revisión no incluyó carga ni mediciones en hardware físico.

### Pruebas recomendadas en la placa

- Arranca con la red principal disponible y comprueba el envío de una muestra por segundo.
- Apaga la red principal y verifica que intente la siguiente y recupere WSS.
- Coloca una contraseña incorrecta en la primera red y comprueba que pueda conectarse a la segunda.
- Deja el Wi-Fi principal encendido, desconecta su acceso a Internet y prueba el respaldo con una salida independiente, por ejemplo un punto de acceso con datos móviles.
- Apaga todas las redes; después enciende una y verifica que se recupere sin reiniciar manualmente la placa.
- Revisa que una red de respaldo estable conserve la conexión aunque vuelva la principal.

La compilación y las pruebas con fallas simuladas verifican el programa. La asociación real, las condiciones de radio, la alimentación y el reinicio físico por watchdog se deben comprobar en hardware.

### Repetir la verificación

Desde la raíz del proyecto, con Python 3, un compilador C/C++ nativo y la versión de Node.js utilizada por la webapp:

```sh
python3 example/verification/simulate.py
node example/verification/validate-frames.mjs
```

El primer comando descarga las dos fuentes oficiales de `http_parser` 2.7.0, verifica sus hashes y ejecuta la simulación. El segundo utiliza el validador real de `webapp/`, por lo que debe ejecutarse desde el repositorio completo. Los resultados quedan en `example/verification/artifacts/`. No se modifican las credenciales ni el sketch original.

Con Arduino CLI y las versiones de core y biblioteca indicadas arriba instaladas:

```sh
arduino-cli compile --clean --warnings all --fqbn esp32:esp32:esp32 --build-path example/verification/artifacts/build-esp32 --output-dir example/verification/artifacts/esp32-dev-module example/PruebaReal1
```

Los registros de esta ejecución incluyen `compile-esp32.log`, `compile-esp32.json`, `firmware-identity.json`, `simulation-results.json` y `receiver-contract-results.json`. El ZIP incorpora los programas de verificación y esos registros; los binarios de prueba se conservan fuera del ZIP. Las rutas temporales del registro documentan el entorno de esta ejecución y no son requisitos para instalar Arduino IDE.

## Archivos para entregar

- `PruebaReal1/PruebaReal1.ino`: programa completo en un solo archivo.
- `PruebaReal1-CAMBIOS.md`: esta guía, fuera de la carpeta del sketch.
- `verification/`: simulación reproducible y registros de compilación y validación.
- `PruebaReal1.zip`: contiene el `.ino`, esta guía y la verificación, conservando un solo archivo dentro de `PruebaReal1/`.
