# Arquitectura de Voltio

## Flujo de datos

```text
ESP32 cliente WebSocket
    → server/gateway.ts: valida el mensaje y conserva la última lectura
    → WebSocket /ws/monitor: distribuye datos a los navegadores
    → almacén de telemetría: historial, mínimos, máximos y métricas
    → indicadores, gráfica y CSV
```

## Capas

- **`server/`** implementa el receptor, la API y su persistencia. `index.ts` sirve la compilación; `supervisor.ts` lo reinicia ante caídas o falta de respuesta. `vite-gateway.ts` lo integra en desarrollo y preview.
- **`app/`** compone proveedores y rutas. El proveedor de recepción consulta el estado del servidor; el de telemetría administra la sesión de visualización.
- **`pages/`** compone las vistas, incluidas en la carga inicial de la aplicación.
- **`features/gateway/`** presenta la configuración y la dirección para compartir con el emisor.
- **`features/telemetry/`** separa dominio, estado, transportes y visualización. Su validador se reutiliza en el servidor para comprobar cada medición y su rango.
- **`features/indicators/`** define las preferencias de presentación, su contrato validado y el editor con vista previa. El editor se incluye en la carga inicial y solo se monta al abrirlo. `IndicatorProvider` persiste las preferencias por variable y las comparte con las tarjetas y la gráfica, fuera del ciclo de adquisición.
- **`shared/contracts/`** define las rutas y los tipos que comparten servidor y navegador.
- **`shared/ui/`** contiene controles, paneles, iconos y avisos sin conocimiento del ESP32.

Las funcionalidades no importan módulos de `app/` ni de `pages/`. Los estilos se aíslan con CSS Modules; los colores, tamaños y Candara se centralizan en las variables de diseño.

`shared/contracts/measurements.ts` define las variables, claves del JSON, unidades, rangos, escalas y columnas CSV: temperatura de −30 a 100 °C, voltaje de 0 a 12 V y corriente de 0 a 50 A. El dominio, servidor y componentes utilizan estas definiciones. Los indicadores calculan su proporción desde el mínimo y máximo de cada canal; el historial separa las variables en bandas con sus unidades físicas y ejes propios.

## Configuración y persistencia

El panel modifica la recepción mediante `PUT /api/gateway/config`. El servidor valida ruta, identificador, URL pública y habilitación antes de aplicar los ajustes. La escritura en `.voltio/gateway.json` es atómica y las actualizaciones se serializan. `GET /api/gateway/status` informa de configuración, conexión, contadores y direcciones de red.

No se guardan credenciales Wi-Fi ni se configuran GPIO. Un cambio de ruta, identificador o habilitación desconecta al emisor anterior y elimina la última muestra de esa fuente. El código de recepción y la configuración no dependen del modelo de ESP32 ni de la versión del IDE.

## Conexiones y límites

El receptor acepta un emisor activo para los tres canales y varios monitores, hasta 32 conexiones totales. Cada mensaje admite hasta 4096 bytes. Ping/pong elimina conexiones que dejaron de responder; los lectores con exceso de datos pendientes se cierran para limitar el uso de memoria.

El emisor publica texto JSON con `temperature`, `voltage` y `current` cada 1000 ms. El servidor distribuye una envoltura interna versionada con antigüedad, identificador de proceso y secuencia. El transporte deduplica la última muestra reenviada durante una reconexión y acepta secuencias nuevas tras reiniciar el servidor. Los heartbeats y avisos viajan como mensajes de control y no cuentan como lecturas. El firmware sigue enviando únicamente sus tres números.

El servidor conserva la última muestra en memoria para los monitores que se conecten después. Su antigüedad se conserva en vez de simular una lectura nueva. El historial de cada navegador está limitado a 120 segundos / 1200 muestras, con actualización visual de hasta 10 Hz.

## Estado del navegador

Los componentes de telemetría usan `useSyncExternalStore` con selectores estables. Solo se actualizan cuando cambia el dato seleccionado. Los proveedores viven por encima de React Router, por lo que el cambio de vista no cierra la sesión ni vuelve a abrir el WebSocket.

Al montar el proveedor, el monitor abre automáticamente `/ws/monitor` en el mismo origen, con WS o WSS según el protocolo de la página. La entrada del ESP32 pertenece al servidor y recibe con independencia de los navegadores. La pantalla principal muestra la dirección de envío del microcontrolador; las conexiones manuales a servidores externos se conservan en las opciones avanzadas.

La navegación móvil se encapsula en `MobileNavigation`, con un diálogo modal nativo, foco limitado al panel, cierre con Escape y restauración de foco y desplazamiento. El bloqueo del fondo se libera al cerrar o pasar al diseño de escritorio; el panel no desmonta los proveedores de adquisición. Los enlaces se generan desde la misma definición de rutas que utiliza la barra lateral.

Los mensajes de transportes anteriores se ignoran mediante una generación de conexión. Los valores inválidos conservan la última lectura válida. La simulación es explícita y sus exportaciones se identifican.

## Despliegue

`npm run dev` y `npm run preview` incluyen el receptor mediante el adaptador de Vite. `npm start` ejecuta el supervisor y sirve la compilación con Node.js y el mismo receptor. Ngrok o un proxy TLS publica el puerto de la aplicación y comparte HTTP/WebSocket en un único origen.

`server/ngrok-discovery.ts` consulta la API local del agente con límite de tiempo y admite endpoints actuales y túneles antiguos. Solo publica orígenes HTTPS dirigidos al puerto local de esa instancia. El estado de la API incluye `detectedPublicOrigin` sin persistirlo; los navegadores locales lo utilizan para generar la dirección del ESP32. En desarrollo, el adaptador normaliza el host confirmado antes de las comprobaciones HTTP y HMR de Vite. Los dominios de otros túneles conservan el rechazo de Vite. La detección sigue los cambios del agente y se retira tras un plazo acotado si deja de responder.

## Resiliencia

`shared/contracts/reliability.ts` centraliza la cadencia de 1 Hz y los tiempos de recuperación. El transporte cancela sockets y temporizadores anteriores, reintenta con espera progresiva limitada y variación aleatoria, detecta handshakes y conexiones silenciosas, y reacciona a la vuelta de la red y de la pestaña. Parar una sesión cancela los reintentos. El almacén conserva las lecturas durante los fallos y distingue antigüedad de conectividad.

El receptor mantiene ping/pong, controla el exceso de datos pendientes y aísla los errores de envío por cliente. Una conexión fantasma se elimina sin bloquear futuras conexiones del ESP32. Las consultas de estado tienen timeout y vuelven a ejecutarse; las ediciones locales permanecen disponibles cuando el receptor deja de responder. La configuración incorpora una copia de recuperación y avisos visibles si se necesitan ajustes iniciales.

El supervisor consulta `/api/gateway/health` cada segundo y reinicia un proceso que termine o acumule tres fallos de salud. El arranque tiene límite y la parada tiene un plazo de gracia antes de terminar un proceso bloqueado. SIGINT/SIGTERM detienen también al hijo y cancelan los reinicios. `start:once` permite delegar esta función en un gestor externo. Mantener el equipo, la red y ngrok disponibles corresponde al despliegue; el ESP32 debe reconectarse y puede necesitar su propia cola para las lecturas que genere durante un corte.

Publicar únicamente los archivos de `dist/` no proporciona el servidor de entrada. Los datos históricos permanentes y el acceso de varios dispositivos a la vez requerirían una extensión del modelo y de la persistencia; el contrato actual administra un emisor y tres valores.

## Rutas y guards

`shared/contracts/navigation.ts` centraliza las direcciones. `app/routes.ts` define metadatos, guard y componente para cada vista; `app/router.tsx` compone el árbol con `createBrowserRouter`. `AppShell` presenta los enlaces y un `Outlet`. Las vistas y la personalización se importan estáticamente: después de abrir la aplicación, navegar no depende de nuevas descargas de JavaScript o CSS. Esto elimina los rechazos persistentes de `React.lazy` cuando una descarga falla durante un corte de red o tras reanudar una pestaña móvil. Los errores de renderizado se registran en consola y conservan una pantalla de recuperación.

`GatewayGuard` espera a obtener un estado válido antes de montar la vista de configuración. Si el receptor falla inicialmente, presenta un estado recuperable; cuando vuelve a responder permite continuar. No bloquea el monitor porque el ESP32 esté desconectado ni impide habilitar un receptor pausado.

`UnsavedChangesGuard` utiliza `useBlocker` y un diálogo nativo accesible para proteger las ediciones al navegar, además de `beforeunload` para recargar o cerrar la pestaña. Revertir una edición al valor guardado elimina el bloqueo.

Las rutas `/monitor`, `/connection` y `/protocol` admiten entrada directa y recarga. El servidor integrado entrega `index.html` para las rutas de la aplicación; conserva los 404 de archivos, API y WebSockets inexistentes. Las rutas desconocidas de documento redirigen al monitor principal con HTTP 302; dentro de la aplicación, la ruta comodín utiliza `Navigate` con `replace` para evitar conservar la dirección inválida en el historial. Los enlaces anteriores por fragmentos siguen funcionando mediante redirección.

## Pipes de presentación

Las preferencias de indicadores se almacenan como un documento versionado en `voltio.indicators.v1`. La lectura valida cada variable de forma independiente y recupera sus valores iniciales si está dañada. Los eventos `storage` sincronizan pestañas; un fallo de escritura conserva la configuración en memoria y presenta un aviso. El formulario mantiene un borrador hasta guardar, admite restauración individual o total y utiliza un diálogo con foco contenido. Los avisos se evalúan contra los valores físicos originales y solo resaltan lecturas recientes; el redondeo y el estilo nunca modifican el contrato, los extremos ni el CSV.

`shared/pipes/` ofrece funciones puras `decimalPipe`, `voltagePipe`, `integerPipe`, `durationPipe`, `timePipe` y `jsonPipe`, utilizadas desde JSX. El formato de números, ausencias, sesiones y horas se comparte entre indicadores, gráfica y métricas. La validación de datos, el JSON recibido por WebSocket y el CSV conservan sus propios contratos y no dependen del formato visual.

## Ampliación y pruebas

`tsconfig.base.json` centraliza las reglas estrictas de TypeScript. Los proyectos de aplicación, Node.js y pruebas heredan esa configuración; los scripts también son TypeScript. Los tipos se infieren cuando es suficiente y los límites externos se reciben como `unknown` y se validan. Los canales utilizan índices limitados a `0 | 1 | 2` para acceder a las tres lecturas sin aserciones no nulas.

`.oxlintrc.json` configura Oxlint con análisis de tipos, reglas de React y rechazo de operaciones inseguras con `any`, promesas sin manejar y aserciones no nulas. `npm run check` ejecuta el compilador y el lint; `npm run build` exige ambas comprobaciones antes de compilar.

Para añadir otra vista, crea su módulo en `pages/` y su ruta en `app/routes.ts`. Para añadir canales, modifica explícitamente el contrato, el firmware emisor y las pruebas. Para añadir almacenamiento permanente, implementa una capa de registros independiente de la visualización.

Las pruebas cubren contratos, configuración, persistencia tras reinicio, recepción real desde clientes de prueba, varios monitores, valores rechazados, lecturas antiguas, reconexión y CSV. La matriz visual comprueba 320–1440 píxeles, orientación horizontal y texto al 200 % en Chromium, Firefox y WebKit. La prueba HTTPS/WSS comprueba el flujo emisor → servidor → navegador con un túnel local; la verificación del ESP32 físico sigue siendo independiente.
