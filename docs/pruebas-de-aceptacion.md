# Pruebas de aceptación antes del primer servicio

Ejecutá esto con **dos monitores, un teléfono de mesera, la pantalla de cocina, la PC de caja y la USB real**. La base debe ser `C:/BrisasPOS/data/aceptacion.sqlite`; verificá el valor de `DATABASE_URL` antes de empezar. Todos los nombres y pagos son ficticios. Al terminar se crea una base de producción nueva; no mezclar estas ventas con clientes reales.

En cada caso anotá fecha/hora, dispositivo, `APROBADO / FALLÓ / PENDIENTE`, captura o descripción del fallo, y si hizo falta recargar. Un caso que funciona solo tras recargar **no aprueba tiempo real**. No avances a producción mientras exista un `FALLÓ` crítico o un pendiente de seguridad, respaldo o red.

## 0. Preparar el ensayo

1. Confirmá `Get-Service BrisasPOS`, `http://localhost:3000/api/health` con `ok:true`, y que la PC muestre `/caja` y `/cocina` en perfiles de navegador **diferentes**. Revisá que ambos monitores estén en modo **Extender** y sigan así tras reiniciar. Si falta el cable del segundo monitor, dejá esta prueba pendiente.
2. Usá el menú de ensayo para crear dos productos fáciles de reconocer: **PRUEBA Plato** a ₡5.000 (`va_a_cocina=true`) y **PRUEBA Bebida** a ₡1.000 (`va_a_cocina=false`, si el editor lo permite). Comprobá que el producto de envase existente cuesta ₡200. Si no podés configurar esos valores, anotá los precios reales y recalculá todos los montos de abajo antes de cobrar. No modifiques productos reales en producción para esta prueba.
3. Crea una mesera de ensayo distinta de la administradora, otra mesera para la prueba cruzada y PIN separados. Abrí el turno y marcá horas de entrada. La tablet de cocina entra sola; caja y mesera inician con sus perfiles.
4. Anotá SSID, IP real de la PC y URL exacta que usan teléfonos. Probá desde el punto más lejano de cocina y terraza. Quitá datos móviles durante estas pruebas para no confundir una falla de WiFi con otro acceso.

## 1. Operación normal y dinero

| ID | Acción a ejecutar | Resultado exacto para aprobar |
|---|---|---|
| O1 | Mesera A abre **PRUEBA Salón A**, canal salón, pide Plato + Bebida, nota `SIN CEBOLLA`. | Aparece enseguida en caja; cocina muestra el Plato y la nota en grande, **no muestra bebida ni envase** si `va_a_cocina=false`. Subtotal ₡6.000. |
| O2 | Mesera B abre la cuenta de A y agrega un segundo pedido; luego se traspasa explícitamente a B y se consulta bitácora. | El agregado llega como comanda nueva; solo el traspaso cambia la responsable. Bitácora muestra autora, cambio y motivo. Para mantener el total calculado, anulá el agregado de ensayo antes de cerrar y verificá que no cuente. |
| O3 | Cocina toca un Plato: NUEVOS → EN PREPARACIÓN → LISTOS; usa DESHACER en menos de 30 s, repite y finalmente ENTREGADO. | Movimiento inmediato sin doble salto; mesera responsable recibe aviso visible al quedar LISTO. No se necesita recargar. |
| O4 | En Salón A marcá que el Plato sobrante se va en envase. | Se agrega exactamente **un envase de ₡200**: total ₡6.200. La comida sigue clasificada como salón; solo ₡200 va a envases. |
| O5 | Caja registra pago parcial ₡2.000 y después ₡4.200 en Salón A, con formas distintas. | Saldo pasa ₡6.200 → ₡4.200 → ₡0; estado termina COBRADA. Repetir pago o registrar ₡1 extra devuelve error y no duplica cobro. |
| O6 | Caja abre **PRUEBA Retiro B** por teléfono con Plato + Bebida. | Canal PARA_LLEVAR, subtotal comida ₡6.000 y **dos envases** ₡400 según la regla actual; total ₡6.400. Cocina recibe solo el Plato. Tras entregar, cobrar ₡6.400. |
| O7 | Salón C: un Plato ₡5.000, dividir en tres partes iguales. | Desglose **₡1.668 + ₡1.666 + ₡1.666 = ₡5.000**. Registrar las tres partes; no queda saldo. |
| O8 | Salón D: Plato + Bebida, modo “cada quien lo suyo”, dos comensales. Intentar cobrar sin asignar la bebida; luego asignar Plato a uno y Bebida al otro. | El primer cobro se bloquea. Después partes ₡5.000 y ₡1.000; total ₡6.000 y cierre al completar pagos. |
| O9 | Salón E: Plato ₡5.000, aplicar descuento fijo ₡1.000 con motivo y después cobrar ₡4.000. | Bitácora muestra autorización y motivo; total ₡4.000. Intentar nuevo descuento tras primer pago debe fallar. |
| O10 | Salón F: Plato ₡5.000, cortesía total con motivo; usar “cerrar sin saldo”. | Total ₡0; cuenta COBRADA sin registrar pago, cortesía visible en bitácora/cierre. |
| O11 | Abrir Salón G con Plato y anular con motivo antes de cobrar. Intentar cerrar/cobrar la cuenta anulada. | Desaparece de trabajo normal/cocina, figura como anulada en cierre y no se puede cobrar ni cerrar como cobrada. |
| O12 | Cambiar precio de Plato en menú después de crear una cuenta abierta con ese pedido. | La cuenta existente conserva **₡5.000** por el Plato; una línea nueva toma el precio nuevo. Anulá esa línea de ensayo y revertí el precio antes de seguir con los totales. |
| O13 | Intentar seleccionar más opciones de las permitidas o quitar una opción obligatoria de un producto de ensayo. | El servidor rechaza la selección; el producto y la cuenta no quedan inconsistentes. |
| O14 | Vista previa de cierre del turno, después de resolver A–G; comparar efectivo/tarjeta/SINPE con lo registrado. | Para las cuentas exactamente descritas y sin agregar otras: bruto salón **₡27.000**, bruto para llevar **₡6.000**, envases **₡600**, descuentos/cortesía **₡6.000** y total neto cobrado **₡27.600**. Salón G anulado no suma. Si O2 agregó y luego anuló líneas, confirmar que su monto es cero. |
| O15 | Cerrar el turno y abrir el cierre guardado. | No quedan cuentas pendientes; el segundo cierre se rechaza; el cierre histórico conserva valores aunque luego cambie el menú. |

Si O14 no coincide, no ajustes el dinero físico para “hacer cuadrar” la pantalla. Guardá capturas de ficha, vista previa, bitácora y formas de pago y marcá `FALLÓ`.

## 2. Señal, desconexión y permisos

| ID | Acción a ejecutar | Resultado para aprobar |
|---|---|---|
| R1 | Enviá una comanda desde el punto más lejano del salón/terraza. | Cocina la muestra y suena la campana en **menos de 2 s**, con pantalla desbloqueada y volumen probado. Repetir 5 veces. |
| R2 | En el teléfono, desactivá WiFi después de preparar un pedido para una cuenta **ya abierta**; pulsá Enviar una vez. Volvé a activar WiFi. | Ve “pendiente de enviar”; al reconectar llega **una sola comanda**. No desaparece de la cola antes de confirmación. Abrir cuenta nueva sin conexión debe fallar de forma clara. |
| R2b | Encolar sin WiFi un pedido de un producto de ensayo; mientras está offline, marcarlo agotado desde admin/caja y reconectar. | La comanda **no se pierde**: queda aviso rojo con nombre de cuenta y motivo, sin reintentos automáticos. La mesera consulta caja, corrige/reintenta o la descarta explícitamente tras confirmar. |
| R3 | Desconectá solo WiFi de cocina mientras tiene comandas visibles; reconectá. | Banner SIN CONEXIÓN y comandas existentes permanecen; al volver, recibe novedades y desaparece el banner. |
| R4 | Cortá solo la **salida a internet**, manteniendo el WiFi local, si el sitio lo permite; probá abrir el sistema y enviar una comanda. | La operación LAN debe continuar según el objetivo del proyecto. Si se usó un túnel/HTTPS de tercero para los teléfonos, esta prueba es obligatoria: si falló, **no se puede prometer continuidad sin internet**. |
| R5 | Reiniciá router/AP y PC por separado, con el servicio NSSM configurado. | Servicio vuelve sin terminal; anotá IP antes/después, URL y conexión de cada teléfono, caja/cocina y USB. Si un marcador dejó de abrir, dirección estable `PENDIENTE`. No desenchufes bruscamente una PC con ventas reales para probar esto. |
| S1 | Mesera intenta abrir una URL de administración/cobro; cocina intenta entrar a cuentas/caja. | Respuesta 403/401; no se revelan datos ni se ejecuta la acción. La pantalla tampoco debe ofrecer esos botones. |
| S2 | Cambiá el rol o desactivá una usuaria de ensayo con sesión abierta en otro dispositivo. | La siguiente solicitud protegida falla y el socket viejo se desconecta. Inicio de sesión con PIN viejo/no activo falla. |
| S3 | Desde un dispositivo del **mismo WiFi de clientes**, sin PIN, solicitar sesión de cocina y abrir la URL HTTP. | **Resultado actual esperado: se puede entrar a cocina**, por diseño actual. Registralo como `FALLÓ` para seguridad; no tratar la contraseña compartida del WiFi como protección. Tras la solución de control de cocina y HTTPS, repetir y exigir denegación a dispositivo no autorizado. |
| S4 | En un teléfono real abrí consola del navegador si es posible: `window.isSecureContext` y `navigator.serviceWorker?.controller`; probá “Instalar app”, cerrar navegador, cortar señal y reabrir. | Para PWA instalable y shell offline se requiere HTTPS confiable. Sobre `http://<IP privada>` el resultado puede ser `false`/sin service worker; anotá el comportamiento real de Android e iPhone. No prometer instalación/offline si no pasó. |

## 3. Respaldo, recuperación y acceso remoto

| ID | Acción a ejecutar | Resultado para aprobar |
|---|---|---|
| B1 | Con USB `BRISAS_BACKUP` conectada, ejecutar `backup.ps1 -UnidadUsb E: -ExigirUsb` y leer resultado. | Código 0; archivo nuevo local y USB de igual SHA-256, integridad SQLite `ok`. Verificá que las cuentas de ensayo recientes están en **ese** archivo, no en otra base. |
| B2 | Desconectar USB; ejecutar el mismo comando. | Se crea solo copia local y sale con código **2**. Volver a conectar; no dejar programada una tarea que siempre falla. |
| B3 | Ejecutar manualmente la **tarea programada**, cerrar sesión Windows/reiniciar y ejecutarla otra vez. | `Último resultado 0` y archivos nuevos también en USB. Esto valida permisos, letra y desbloqueo BitLocker bajo la cuenta real de la tarea. |
| B4 | En la **base de ensayo**, respaldar, guardar un dato visible, restaurar el respaldo anterior con `restaurar.ps1 -MasReciente`; comprobar estado y `health`. | Vuelve exactamente el estado del respaldo; servicio se reinicia y los archivos anteriores `.sqlite`, `-wal` y `-shm` quedan apartados para recuperación. No hacer esta prueba con la base real. |
| B5 | Tras pasar a producción, respaldar inicialmente local + USB y consultar integridad de ambos. | Confirmar fecha, tamaño y custodia de clave USB. Los archivos de ensayo deben quedar archivados en carpetas separadas: el nombre `brisas_*.sqlite` no indica cuál base contiene. |
| A1 | Preparar acceso remoto desde casa y probar desde otra conexión de internet antes de mover la PC. | Conexión funciona tras reinicio sin usuario local conectado. Si Windows es Home, anotar que **RDP nativo no aplica** y probar alternativa. |
| A2 | Con alguien mirando caja y cocina, iniciar sesión remota brevemente. | Registrar si ambos monitores quedan en pantalla de bloqueo o siguen utilizables. Si se bloquean, solo usar RDP fuera de servicio. Cerrar remoto, volver a operación local y confirmar que `health` nunca cayó. |

## Acta corta de salida

- Versión/paquete instalado y versión Node: `__________`
- Windows Home/Pro/etc., monitores probados y cable definitivo: `__________`
- SSID del personal/compartido, IP y método estable de dirección: `__________`
- URL de caja, cocina y teléfono; HTTPS confiable verificado: `__________`
- Acceso no autorizado a cocina bloqueado: `__________`
- Internet caído pero LAN operativa: `__________`
- Respaldo USB por tarea tras reinicio y prueba de restauración: `__________`
- RDP o alternativa y efecto sobre consola: `__________`
- O14 y O15 con totales correctos: `__________`
- Pendientes y responsable/fecha: `__________`

Solo firmar “listo para ventas reales” cuando estos puntos estén aprobados en la **PC y red reales**.
