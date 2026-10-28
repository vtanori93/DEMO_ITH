# Voltio · Recepción de datos ESP32

Aplicación en React 19.3.1, Vite 8.3.5 y TypeScript 7.0.2 para visualizar **temperatura de −30 a 100 °C, voltaje de 0 a 12 V y corriente de 0 a 50 A**. Incluye un servidor WebSocket en Node.js: **el ESP32 es el cliente que envía; la webapp recibe y muestra los datos**.

```text
ESP32 por Wi-Fi → servidor WebSocket de Voltio → monitores web
```

La ruta y el identificador de recepción viven en la pantalla **Conexión**. El dominio público de ngrok se define en **`webapp/.env`**; las direcciones se generan a partir de él. No necesitas conocer los GPIO ni configurar las credenciales Wi-Fi del ESP32 en la webapp.

## Ejecutar

Requiere Node.js **22.22 o superior** y npm.

```sh
npm install
npm run build
npm start
```

Abre **http://localhost:5173**. El servidor escucha también en la red local.

Este es el modo recomendado para compartir con ngrok y usar desde móviles: sirve la aplicación compilada y mantiene el receptor supervisado. Para editar el código con recarga de desarrollo utiliza `npm run dev`, con `npm start` detenido.

## Dominio público en `.env`

Edita `webapp/.env` con la URL HTTPS que muestre `ngrok http 5173`:

```dotenv
NGROK_URL=https://grain-exploring-setting.ngrok-free.dev
```

Cuando cambie el dominio, modifica únicamente esa línea y reinicia `npm run dev`, `npm run preview` o `npm start`, según el modo que utilices. No agregues `/connection`, `/ws/esp32` ni el puerto local `:5173` a la URL de ngrok. La webapp genera el enlace público, el host autorizado de Vite, el puerto y la dirección WSS del ESP32 usando ese valor, junto con la ruta y el identificador del panel.

El valor se publica a React mediante la API del receptor al ejecutar la aplicación, por lo que **no necesitas volver a compilar** cuando cambie el dominio. El monitor usa el origen de la página abierta: en ngrok conecta por `wss://` al mismo dominio; desde localhost sigue conectado al mismo receptor local. La API también utiliza el origen actual. Así, la web, la API y ambos sockets comparten el túnel.

`NGROK_URL` tiene prioridad sobre una URL guardada en Conexión. Ese campo se muestra de solo lectura cuando el entorno define el dominio. Puedes usar `NGROK_URL=` para activar la alternativa manual o la detección automática. Prioridad: entorno → URL guardada → túnel detectado desde localhost → origen abierto/red local. Las variables de entorno del proceso tienen prioridad sobre `.env`; Vite también admite sus archivos de entorno por modo.

El archivo `.env` está excluido de Git y se incluye `.env.example` como plantilla para instalaciones nuevas. Este archivo no configura por sí mismo ngrok: inicia el túnel con `ngrok http 5173`. Si el dominio cambia, comparte la nueva dirección del panel con el ESP32 o Python; esos clientes externos conservan la dirección que hayas configurado en su propio código.

## Configurar y compartir desde la aplicación

1. Abre **Conexión**.
2. Configura el **identificador del ESP32**, la **ruta de recepción** y si se aceptan conexiones. Los valores iniciales son `esp32-01`, `/ws/esp32` y receptor habilitado.
3. La **URL pública** se toma de `NGROK_URL` en `.env`. Si está vacía, puedes indicar una URL en el panel o dejar que Voltio detecte el túnel al ejecutar `ngrok http 5173`. Sin túnel utiliza el dominio abierto o una dirección de tu red.
4. Pulsa **Guardar configuración** si has cambiado algún ajuste.
5. Copia **Dirección para el ESP32** y compártela con la persona que programa el emisor. El panel muestra también servidor, puerto y ruta, incluidos los parámetros que debe utilizar el firmware.
6. El monitor se conecta automáticamente al abrir la aplicación. Cuando el ESP32 envíe las lecturas, los tres indicadores se actualizarán sin pulsar botones de conexión. **Ver datos en el monitor** permite volver a esa pantalla.

Ejemplos de direcciones generadas:

```text
ws://IP-DEL-EQUIPO:5173/ws/esp32?device=esp32-01
wss://DOMINIO-NGROK/ws/esp32?device=esp32-01
```

Usa la dirección completa que muestra la webapp. El parámetro `device` debe coincidir con el identificador configurado. Se admite un ESP32 emisor activo y varios monitores; un segundo emisor simultáneo se rechaza para evitar mezclar señales.

Los ajustes se guardan automáticamente en `.voltio/gateway.json`, excluido de Git. Se mantienen al reiniciar. Los cambios de ruta, identificador o habilitación se aplican al servidor sin editar código. La ruta `/ws/monitor` se reserva para los navegadores y se conecta automáticamente sobre el dominio actual; con HTTPS utiliza WSS. Las conexiones a servidores externos siguen disponibles en las opciones avanzadas del monitor y se activan manualmente.

El receptor arranca junto con la webapp, en desarrollo, preview y con `npm start`. El ESP32 puede conectarse y enviar datos aunque no haya ningún navegador abierto. No necesita esperar una suscripción, un botón del monitor ni un comando inicial. Al abrir o recargar la página, el monitor recibe la última lectura con su antigüedad real y continúa mostrando las nuevas.

## Mensaje que debe enviar el ESP32

El firmware de la otra persona, desarrollado en Arduino IDE 2.3.10 o en su entorno de ESP32, debe abrir una conexión **WebSocket estándar** a la dirección copiada y publicar tramas de **texto JSON**:

```json
{ "temperature": -12.3456, "voltage": 11.2345, "current": 8.7654 }
```

Los tres campos son **valores de punto flotante finitos**: `temperature` en °C, de −30 a 100; `voltage` en V, de 0 a 12; `current` en A, de 0 a 50. Los límites están incluidos. Usa números JSON con punto decimal; no envíes cadenas como `"11.2345"` ni comas decimales. `25` y `25.0` representan el mismo valor numérico y ambos se aceptan. Envía las mediciones ya convertidas a estas unidades. La frecuencia prevista es **un mensaje cada 1000 ms (1 Hz)**. No se requieren comandos de suscripción del navegador. Los mensajes incompletos, binarios, incorrectos o fuera de rango se descartan; los últimos valores válidos se conservan.

TypeScript utiliza `number`, Python `float` y el sketch ESP32 `float`, sin convertir mediciones a enteros. Los ejemplos publican valores con hasta cuatro decimales. Las lecturas, mínimos, máximos e historial conservan la fracción recibida. Cada indicador y cada banda del historial tiene su propia escala y unidad. La precisión visible es configurable entre 0 y 4 decimales (2 inicialmente) y solo afecta la presentación. El CSV exporta `fecha_iso,temperature_c,voltage_v,current_a` con cuatro decimales, independiente de la configuración del indicador. La representación de punto flotante es aproximada, por lo que el número de decimales del mensaje no garantiza la exactitud del sensor.

El servidor comprueba el contrato antes de publicar los datos a los monitores. Si un monitor se conecta después de llegar una lectura, recibe la última muestra disponible con su antigüedad real. Una muestra antigua no se presenta como recién recibida.

La guía para compartir con la persona que programa el ESP32 está en [docs/protocolo-esp32.md](docs/protocolo-esp32.md).

## ngrok

Con `npm run dev` en ejecución, abre otra terminal:

```sh
ngrok http 5173
```

Abre la URL HTTPS de ngrok, entra en **Conexión** y copia la dirección WSS generada para el ESP32. También se actualiza automáticamente si administras desde localhost. La página, API y ambos WebSockets —emisor y monitor— comparten el mismo túnel al puerto 5173. El acceso público usa HTTPS/WSS y puerto 443; no agregues `:5173` al dominio público.

El agente ngrok debe estar instalado y autenticado. Define su dominio en `NGROK_URL` dentro de `.env`; no hace falta una segunda variable para autorizar el host de Vite. Si dejas ese valor vacío, la detección alternativa consulta los endpoints del propio puerto en `127.0.0.1:4040`. `npm run tunnel` ejecuta el mismo comando. Más detalles en [docs/ngrok.md](docs/ngrok.md).

## Comprobar el envío sin hardware

Puedes probar el mismo punto de recepción con un cliente externo:

```sh
npm run send:sample -- "DIRECCION_COPIADA_DE_LA_WEBAPP" -12.3456 11.2345 8.7654
```

Este comando envía los tres valores de prueba a **1 Hz** y reintenta automáticamente si se pierde la conexión. No son mediciones de un dispositivo físico. Detén el emisor con Ctrl+C antes de conectar el ESP32 real.

También tienes un ejemplo Python de un solo archivo en [`../example/python-dummy-sender/main.py`](../example/python-dummy-sender/main.py), con valores dummy cada segundo y reconexión. El catálogo [`../example/`](../example/README.md) permite agregar más ejemplos en subcarpetas separadas.

## Aplicación compilada con servidor integrado

```sh
npm run build
npm start
```

`npm start` inicia un supervisor que mantiene el servidor de `dist/`, la API y el receptor WebSocket en el puerto 5173. Reinicia el proceso si se cae o deja de responder a la comprobación de salud. Ejecuta este modo con el servidor de desarrollo detenido. `npm run start:once` ejecuta el servidor directamente cuando la supervisión la proporciona tu infraestructura.

`npm run preview` también incluye el receptor para revisar la compilación en el puerto 4173. `npm run tunnel:preview` comparte esa vista previa.

## Recuperación ante fallos

- El monitor reintenta indefinidamente, con espera progresiva de aproximadamente 1 a 5 segundos. Al volver la red o regresar a la pestaña comprueba la conexión y recupera inmediatamente un socket inactivo.
- El handshake y las consultas HTTP tienen tiempo límite. Una petición atascada no bloquea las siguientes ni detiene la entrada de lecturas.
- Ping/pong comprueba los clientes cada 5 segundos y retira conexiones fantasma tras 10 segundos sin respuesta. Un heartbeat interno permite al navegador detectar un transporte silencioso en 15 segundos, aunque el ESP32 esté desconectado. No se cuenta como medición.
- Las lecturas antiguas se identifican tras 3 segundos sin datos. Las reconexiones conservan la última lectura, extremos e historial de la sesión, y no duplican la última muestra reenviada por el servidor.
- Los ajustes se escriben de forma atómica y se mantiene `.voltio/gateway.json.bak`. Si la configuración principal está dañada, se utiliza la copia válida. Si ambas fallan, el receptor utiliza los ajustes iniciales y muestra un aviso para revisarlos y guardarlos desde Conexión.
- `GET /api/gateway/health` informa de la salud del proceso y de si acepta datos. El supervisor lo consulta cada segundo; un receptor pausado deliberadamente no provoca reinicios.

La recuperación requiere que el equipo, la red y el túnel estén disponibles. El ESP32 debe reabrir su conexión cuando se corte y reanudar los envíos cada segundo. Para conservar también las mediciones generadas mientras está desconectado, el firmware necesita almacenarlas y reenviarlas; las muestras y el historial actuales permanecen en memoria.

## Interfaz y comprobaciones

- Tipografía Candara normal y negrita alojada localmente.
- Diseño adaptable a móvil, tablet y escritorio; controles de al menos 44 × 44 píxeles y áreas seguras.
- Header visible al desplazarse, también en móvil horizontal. Sidebar de escritorio colapsable desde el botón del header; recuerda la preferencia en este navegador y conserva la navegación por iconos. Los márgenes de escritorio se mantienen en 24 píxeles en ambos estados.
- Menú hamburguesa móvil con panel lateral personalizado, sección activa y estado del ESP32. Se cierra al navegar, tocar el fondo, pulsar el cierre o usar Escape; conserva el desplazamiento y respeta el movimiento reducido.
- Indicadores, mínimos y máximos, gráfica de 30/60/120 segundos y exportación CSV.
- Personalización independiente de cada indicador: nombre, color de paleta o HEX, arco/anillo/barra/digital, 0–4 decimales, tamaño del valor y grosor. Permite mostrar u ocultar escala, divisiones y extremos, y activar animaciones. El editor se monta al abrirlo, sin nuevas descargas, e incluye una vista previa con valores de ejemplo.
- Umbrales inferior y superior por variable con avisos visuales para lecturas recientes. Los rangos físicos, los mensajes WebSocket y el CSV conservan los valores originales. Los cambios se aplican al guardar; se pueden cancelar o restaurar por tarjeta o para las tres.
- Las preferencias se guardan en este navegador y se sincronizan entre sus pestañas. Si el almacenamiento está bloqueado, se aplican durante la sesión y se muestra un aviso. Una preferencia dañada recupera los valores iniciales de la variable afectada.
- Reconexión, detección de lecturas antiguas y simulación explícita.
- Historial del navegador limitado a 120 segundos / 1200 muestras y un máximo de 10 muestras por segundo. Mínimos y máximos consideran todos los mensajes válidos recibidos por ese monitor.
- Los ajustes persisten; las mediciones permanecen en memoria. El servidor conserva la última muestra hasta un cambio de fuente o reinicio.

```sh
npm run check
npm run build
npm test
```

`npm run check` comprueba los tipos y ejecuta Oxlint con análisis de tipos, sin permitir avisos. TypeScript está en modo estricto para la interfaz, servidor, configuración, scripts y pruebas; también comprueba índices, propiedades opcionales y retornos. El lint rechaza `any` explícito, accesos inseguros, aserciones no nulas y promesas sin manejar, y revisa los hooks de React. Las respuestas de la API se validan antes de incorporarlas al estado.

Puedes ejecutar `npm run typecheck` y `npm run lint` por separado. `npm run lint:fix` aplica las correcciones automáticas seguras. La compilación ejecuta estas comprobaciones antes de generar `dist/`.

Para las pruebas de navegador, instala una vez `npx playwright install chromium firefox webkit`. Las pruebas HTTPS usan OpenSSL para generar un certificado temporal. Las suites comprueban recepción desde un cliente externo, configuración y persistencia, WebSocket por HTTPS/WSS, rangos de temperatura, voltaje y corriente, reconexión, CSV, tamaños de 320 a 1440 píxeles y texto al 200 %. Usan clientes de prueba y servidores locales, sin hardware ni túneles públicos activos.

Tras compilar, `VOLTIO_TEST_PRODUCTION=1 npx playwright test tests/browser/view-loading.spec.ts` comprueba la navegación sin descargas adicionales, los cortes de red y la recuperación de lecturas en Chromium, Firefox y WebKit móvil sobre el servidor de producción.

## Organización

Las vistas utilizan React Router con rutas `/monitor`, `/connection` y `/protocol`. Las vistas y la personalización de indicadores se incluyen en la carga inicial: navegar o abrir el editor no descarga módulos adicionales. Así, un corte de cobertura o una pestaña reanudada no deja una importación fallida bloqueada durante toda la sesión. Mantienen Atrás/Adelante y permiten recargar una ruta directamente en desarrollo, preview y con el servidor integrado. Los enlaces antiguos `/#monitor`, `/#connection` y `/#protocol` redirigen a sus rutas actuales; las direcciones desconocidas redirigen automáticamente al monitor principal (`/monitor`), reemplazando la entrada inválida del historial.

El guard de configuración espera a que el receptor esté disponible y vuelve a comprobarlo automáticamente si falla. El guard de cambios pendientes permite continuar editando o descartar antes de cambiar de ruta, y avisa al recargar o cerrar la pestaña. La recepción WebSocket continúa entre pantallas.

`src/shared/pipes/` contiene formateadores puros y tipados para decimales, mediciones con unidades, contadores, duración, hora y JSON. Se usan como funciones en JSX, con el formato de presentación separado de la validación y del protocolo enviado por el ESP32.

```text
server/                  Receptor WebSocket, API, persistencia y servidor de la compilación
config/                  Hosts de Vite y política de ngrok
src/app/                 Proveedores, rutas y navegación
src/app/guards/          Disponibilidad de la configuración
src/pages/               Monitor, conexión y protocolo
src/features/gateway/    Panel de recepción y estado del emisor
src/features/telemetry/  Contrato de datos, adquisición y visualización
src/shared/              Componentes, contratos y utilidades comunes
src/shared/guards/       Protección de cambios pendientes
src/shared/pipes/        Formateadores tipados para la interfaz
src/styles/              Variables de diseño
tests/                   Pruebas unitarias, de servidor y navegador
```

Consulta [docs/arquitectura.md](docs/arquitectura.md) para ampliar la aplicación. La verificación con el ESP32 físico queda a cargo de conectar el firmware del emisor a la dirección que genera el panel.
