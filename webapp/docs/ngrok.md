# Recepción del ESP32 a través de ngrok

```text
ESP32 cliente → WSS de ngrok → receptor de la webapp → navegador
```

El ESP32 necesita acceso a Internet para usar una dirección pública WSS. En una red local puede conectarse por WS a la IP del equipo que ejecuta la webapp. No necesitas que la webapp conozca la IP del microcontrolador.

## Activar el acceso público

1. En una terminal ejecuta exactamente `ngrok http 5173`. También puedes usar `npm run tunnel` dentro del proyecto. El agente debe estar instalado y configurado con tu cuenta.
2. En `webapp/.env` establece `NGROK_URL=https://EL-DOMINIO-QUE-MUESTRE-NGROK`, sin rutas ni puerto local. Para una instalación nueva, copia `.env.example` a `.env` y reemplaza el dominio de ejemplo.
3. Inicia Voltio con `npm run dev` y abre localhost o la URL HTTPS de ngrok. Si ya estaba ejecutándose, reinícialo después de editar `.env`.
4. Entra en **Conexión**. El panel mostrará la dirección WSS para el ESP32 y el enlace público, generados desde `.env`, incluso si administras desde localhost.
5. Configura identificador, ruta y habilitación en el panel. Guarda si has cambiado algo.
6. Copia la dirección y compártela con la persona que programará el emisor.
7. El ESP32 se conecta a la dirección copiada y envía el JSON de temperatura, voltaje y corriente. El monitor se conecta automáticamente; no hace falta activar la recepción desde el navegador.

`NGROK_URL` es la fuente principal. Tiene prioridad sobre URLs guardadas previamente y sobre la detección automática; el campo del panel queda de solo lectura. Cuando cambie el túnel, modifica únicamente `.env`, reinicia el proceso y comparte el nuevo WebSocket del panel. Funciona en desarrollo, preview y producción sin recompilar React: la URL se entrega por la API del servidor, sin incrustarla en el JavaScript compilado.

Si prefieres la detección automática, deja `NGROK_URL=` vacío y borra la URL pública guardada en Conexión. En ese modo también puedes introducir una dirección manual para otro proxy o una instalación de ngrok cuya API local esté desactivada. La alternativa manual tiene prioridad sobre la detección y se admite como host de Vite al guardar, sin reiniciar. `.env` está excluido de Git; `.env.example` contiene la plantilla.

## Un túnel para toda la aplicación

El comando es:

```sh
ngrok http 5173
```

La misma conexión pública sirve la página, los recursos, la API de configuración, la entrada del ESP32 y los monitores. Por ejemplo:

```text
Web:          https://TU-DOMINIO/connection
ESP32/Python: wss://TU-DOMINIO/ws/esp32?device=esp32-01
Monitor web:  wss://TU-DOMINIO/ws/monitor
```

El navegador abre el socket del monitor automáticamente sobre el mismo origen. No hace falta un segundo túnel ni un puerto público para WebSocket. El puerto local es 5173; el público normalmente es 443. Conserva la ruta y el identificador de la dirección generada por el panel.

Puedes cambiar la ruta de entrada y el identificador desde **Conexión**. Los puertos se muestran en el panel: con una URL HTTPS pública, el cliente utiliza WSS y normalmente el puerto 443. Usa siempre los valores que genere tu instalación.

La webapp consulta la API local del agente en `http://127.0.0.1:4040`, usando `/api/endpoints` y, para agentes anteriores, `/api/tunnels`. Selecciona los endpoints HTTPS que apuntan al puerto de esta instancia. Los hosts descubiertos se adaptan antes de las comprobaciones de Vite, tanto para HTTP como para el upgrade de desarrollo. No se permiten automáticamente otros dominios de ngrok ni túneles hacia otros puertos.

La detección se actualiza cada segundo y tiene tiempo límite. Un fallo temporal conserva el último resultado hasta 5 segundos; si el agente deja de responder se retira la dirección pública y continúa la recepción local. Al iniciar o reiniciar ngrok, el panel vuelve a mostrar el endpoint actual. El ESP32 o Python debe utilizar la dirección actualizada si cambia el dominio.

Si cambiaste `web_addr` o desactivaste la API local de ngrok, utiliza `NGROK_URL` en `.env`. No necesitas duplicar el dominio en `NGROK_HOST`; esta última variable solo se conserva por compatibilidad con instalaciones anteriores y no genera direcciones.

## Aplicación compilada

```sh
npm run build
npm start
```

Con el servidor de desarrollo detenido, el servidor integrado sirve la web y recibe los WebSockets en el puerto 5173. Usa `npm run tunnel` para compartirlo. No basta con publicar únicamente `dist/`: el proceso receptor tiene que permanecer en ejecución.

La revisión con `npm run preview` usa el puerto 4173 y también incorpora el receptor. Comparte esa revisión con `npm run tunnel:preview`.

## Diagnóstico

- **La página carga, pero no hay valores:** comprueba en Conexión si aparece **ESP32 conectado** y revisa los contadores. El monitor utiliza automáticamente `/ws/monitor`; si lo pausaste en las opciones avanzadas, puedes reanudarlo allí.
- **La persona que envía no puede conectar:** comparte la dirección completa, incluido `?device=...`, y comprueba que el receptor esté habilitado.
- **Ha cambiado el dominio de ngrok:** actualiza `NGROK_URL` en `webapp/.env`, reinicia la aplicación y vuelve a compartir la dirección del panel con el ESP32 o Python.
- **Host no permitido:** verifica que `NGROK_URL` coincide con el dominio de ngrok y reinicia la aplicación. En modo automático, comprueba la API de ngrok en `127.0.0.1:4040` y que el túnel apunta a 5173.
- **Los mensajes se descartan:** cada trama de texto debe contener `temperature` entre −30 y 100 °C, `voltage` entre 0 y 12 V y `current` entre 0 y 50 A, como números JSON.
- **El emisor usa localhost:** comparte la dirección que genera el panel; localhost en el ESP32 apuntaría al propio microcontrolador.

## Comprobaciones

Las pruebas reproducen un túnel HTTPS que conserva Host, sin política de reescritura ni `NGROK_HOST`. Comprueban la detección desde localhost, retirada y recuperación de hosts, entrada de mediciones por WSS, configuración, actualización de desarrollo y preview. No abren un dominio público ni conectan hardware físico.

Referencias: [ngrok y WebSockets en un único endpoint](https://ngrok.com/docs/using-ngrok-with/websockets), [política de encabezados](https://ngrok.com/docs/gateway/traffic-policy/actions/add-headers), [opciones del servidor Vite](https://vite.dev/config/server-options).
