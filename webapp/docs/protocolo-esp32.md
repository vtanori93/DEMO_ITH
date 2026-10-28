# Contrato para la persona que programa el ESP32

## Quién se conecta a quién

El **ESP32 es cliente WebSocket**. La **webapp Voltio es el servidor receptor**. La aplicación genera la dirección completa desde su pantalla **Conexión**. El firmware puede desarrollarse en Arduino IDE 2.3.10; no se necesitan datos de la placa ni de los GPIO para definir este enlace.

La persona que administra Voltio comparte:

- Dirección completa, como `ws://192.168.1.72:5173/ws/esp32?device=esp32-01` en una red local.
- Con ngrok, una dirección `wss://SU-DOMINIO/ws/esp32?device=esp32-01`.
- Servidor, puerto y ruta, que también se muestran por separado en el panel.

Los nombres y las direcciones anteriores son ejemplos. Utiliza los valores reales de la webapp. Conserva el parámetro `device` y su valor: identifica el emisor aceptado por el receptor.

## Protocolo

Usa WebSocket estándar (RFC 6455). Tras el handshake, envía un objeto JSON completo en cada trama de **texto**:

```json
{ "temperature": -12.3456, "voltage": 11.2345, "current": 8.7654 }
```

| Campo         | Variable    | Tipo        | Unidad | Rango incluido |
| ------------- | ----------- | ----------- | ------ | -------------- |
| `temperature` | Temperatura | Número JSON (flotante) | °C     | −30 a 100      |
| `voltage`     | Voltaje     | Número JSON (flotante) | V      | 0 a 12         |
| `current`     | Corriente   | Número JSON (flotante) | A      | 0 a 50         |

Incluye los tres campos y envíalos en sus unidades físicas, ya convertidos por el firmware. Usa punto decimal, sin comillas ni unidades alrededor de los valores. Los campos adicionales se permiten y no se usan para dibujar las variables. La trama completa admite hasta 4096 bytes.

Las tres mediciones se manejan como punto flotante: `float` en el ejemplo de Arduino C++, `float` en Python y `number` en TypeScript. Los ejemplos generan hasta cuatro decimales. La webapp conserva la fracción recibida en las lecturas, extremos e historial, sin convertir a entero ni redondear al validar. Los indicadores muestran inicialmente dos decimales, configurables de 0 a 4; ese formato no modifica las muestras. El CSV usa cuatro decimales. JSON no distingue entre un tipo entero y otro flotante: `25` y `25.0` son válidos; `"25.0"`, `NaN` e `Infinity` no se aceptan como mediciones. El receptor también acepta notación científica numérica dentro del rango.

Frecuencia prevista: **1 Hz**, una actualización cada **1000 ms**. El emisor no debe esperar una suscripción ni un comando inicial del monitor. El receptor arranca con la webapp y puede recibir aunque todavía no haya un navegador conectado. La visualización se conecta automáticamente al abrir la página.

La webapp recibe, valida y distribuye las lecturas. Si el JSON es inválido, falta un canal o un valor sale del rango, se descarta la actualización completa y se devuelve un aviso JSON de tipo `rejected`. La conexión puede seguir enviando mensajes correctos. Una trama demasiado grande puede cerrar la conexión.

El cliente debe atender ping/pong y volver a conectarse cuando pierda la Wi-Fi o el socket, manteniendo los intentos hasta recuperar el servicio. El receptor envía ping cada 5 segundos y libera una conexión sin respuesta tras 10 segundos. Mantén activo el ciclo de atención de la biblioteca WebSocket entre los envíos; el envío cada segundo no debe bloquearlo. Para WSS debe verificar el certificado TLS del dominio público.

Después de reconectar, reanuda directamente los mensajes de temperatura, voltaje y corriente a 1 Hz. La webapp no puede abrir una conexión desde el microcontrolador: esa reconexión debe formar parte de su cliente WebSocket. El comando `npm run send:sample` permite probar este comportamiento antes de utilizar el hardware.

## Formatear los datos existentes

Si el firmware ya calcula las tres mediciones, basta con formatearlas. Por ejemplo, en C o C++:

```c
#include <math.h>
#include <stdio.h>

// Sustituye estos valores por las mediciones físicas de los sensores.
const float temperature_c = -12.3456f;
const float voltage_v = 11.2345f;
const float current_a = 8.7654f;
if (isfinite(temperature_c) && isfinite(voltage_v) && isfinite(current_a) &&
    temperature_c >= -30.0f && temperature_c <= 100.0f &&
    voltage_v >= 0.0f && voltage_v <= 12.0f &&
    current_a >= 0.0f && current_a <= 50.0f) {
    char json[128];
    int length = snprintf(json, sizeof(json),
        "{\"temperature\":%.4f,\"voltage\":%.4f,\"current\":%.4f}",
        (double)temperature_c, (double)voltage_v, (double)current_a);
    if (length > 0 && (size_t)length < sizeof(json)) {
        // Envía json[0..length) en una trama WebSocket de TEXTO
        // mediante el cliente conectado a la dirección de Voltio.
    }
}
```

La selección de sensores, GPIO, calibración y credenciales Wi-Fi pertenece al firmware del emisor. El receptor trabaja únicamente con los tres números recibidos.

## Reconexión y errores

- **403 al conectar:** el parámetro `device` no coincide con el identificador configurado.
- **409 al conectar:** ya existe un emisor activo. Cierra la conexión anterior antes de reemplazarlo.
- **503 al conectar:** el receptor está pausado o ha alcanzado su límite de conexiones.
- **Se cambia la ruta o el identificador en Voltio:** usa la dirección actualizada del panel. El servidor desconecta el emisor anterior para evitar mezclar fuentes.
- **Se desconecta el emisor:** los monitores conservan la última lectura y muestran su antigüedad.

## Probar el contrato

Desde el proyecto web:

```sh
npm run send:sample -- "DIRECCION_COPIADA" -12.3456 11.2345 8.7654
```

Es un cliente de prueba que publica los valores indicados. Permite comprobar la URL y la recepción antes de conectar el ESP32 físico.
