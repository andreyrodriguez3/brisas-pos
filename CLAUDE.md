# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este proyecto se escribe en español: entidades, campos, mensajes de error y comentarios. El código es TypeScript. Escribí en español también los comentarios y los textos de interfaz — los leen la dueña, la caja y las meseras.

---

# ⚠️ LO PRIMERO: `cuenta.canal` vs `pedido_linea.para_llevar`

Es el error más fácil de cometer en este dominio y el que más caro sale. Leelo antes de tocar cualquier cosa que sume dinero.

> ## `cuenta.canal` **CLASIFICA INGRESOS**
> ## `pedido_linea.para_llevar` **SOLO COBRA EL ENVASE**

`canal` es `SALON` o `PARA_LLEVAR`. Se fija **al abrir la cuenta** y **no cambia nunca**. Es lo único que decide a qué totalizador va la comida.

`para_llevar` es una bandera de línea. Significa una sola cosa: *«a este cliente le sobró comida y pide llevársela, cobrale ₡200 de envase»*. **No reclasifica nada.**

Que a Don Carlos le sobre medio casado y se lo lleve **no** convierte esa venta en "para llevar": se vendió en el salón, se sirvió en el salón, y cuenta como venta de salón. Solo suma ₡200 a la bolsa de envases.

| Concepto | Totalizador |
|---|---|
| Cuenta con `canal = SALON`, **todo** su consumo | `total_salon` — atribuible a la mesera |
| Cuenta con `canal = PARA_LLEVAR`, **todo** su consumo | `total_para_llevar` — cuenta aparte de la dueña |
| Líneas de envase, de **cualquier** canal | `total_envases` — recuperación de empaque |

Tres totalizadores independientes. **Ninguna línea de comida cambia de totalizador jamás.**

La regla vive en **una sola función**, y su firma es la defensa:

```ts
// packages/shared/src/money/lineas.ts
totalizadorDeLinea(canalDeLaCuenta: CanalCuenta, esEnvase: boolean): Totalizador
```

Fijate que **no recibe `para_llevar`**. No es un olvido. Si te encontrás queriendo pasárselo, o escribiendo un `if (linea.para_llevar)` dentro de lógica contable, **pará**: lo que estás escribiendo está mal. Releé la sección 5.7 de `plan-de-trabajo.md`.

---

## El negocio en un párrafo

Restaurante familiar de montaña en Costa Rica que hoy trabaja 100 % en papel. El sistema reemplaza ese flujo con tres pantallas conectadas en tiempo real por el WiFi del propio restaurante: el **celular de cada mesera** (PWA) abre cuentas y manda pedidos, la **tablet de cocina** (PWA en kiosco) muestra la cola de comandas, y la **computadora de caja** cobra, divide facturas y cierra el día. **Esa misma PC es el servidor.** Todo corre en la LAN: sin internet, sin nube. Si se cae el ISP, el restaurante sigue trabajando.

Detalles que cambian cómo se escribe el código:

- **No hay números de mesa.** Cada cuenta se abre con el nombre del cliente ("Don Carlos"). Los nombres se pueden repetir en el mismo turno; se desambiguan con la hora de apertura y el color de la mesera.
- **Una cuenta contiene VARIOS pedidos.** Es un contenedor. Cada pedido entra a cocina como comanda nueva e independiente, con `es_agregado = true` si la cuenta ya tenía pedidos.
- **Edición cruzada, requisito central.** Cualquier mesera puede editar cualquier cuenta abierta. No hay bloqueo por propietaria. Se avisa, se audita, y la responsable **no cambia** — para eso existe la acción explícita y aparte "Traspasar cuenta".
- **El color de mesera NUNCA es la única señal.** Siempre va con el nombre en texto legible. Hay daltonismo y la terraza recibe sol directo.

### Fuera de alcance — no lo implementes ni lo sugieras

Procesamiento de pagos (datáfono, SINPE), facturación electrónica ante Hacienda, reservaciones, sitio web público, delivery, inventario, app nativa. El sistema **calcula** el total; el cobro y la factura siguen en paralelo como hoy. `forma_pago` se guarda solo como dato informativo.

---

## Los 8 invariantes

Valen en todo el código, sin excepciones.

1. **Dinero = enteros de colones. Nunca float.** Toda la aritmética pasa por `packages/shared/src/money/`. El colón no tiene subdivisión en uso, y los decimales binarios harían que el cierre no cuadre.
2. **Los precios se congelan.** `precio_unit_snapshot` y `precio_extra_snapshot` se copian al crear la línea. Los precios del menú **jamás** se leen para recalcular una cuenta existente. Si la dueña sube un precio a media tarde, las cuentas ya abiertas no cambian. Esto es innegociable.
3. **`pedido_linea.para_llevar` solo dispara el cargo del envase.** La clasificación contable la hace `cuenta.canal`, siempre, sin excepción. (Ver el bloque de arriba.)
4. **Nada se borra físicamente.** Usá `activo` / `anulada`.
5. **`auditoria` es append-only.** No creés endpoint ni servicio de update o delete sobre ella. No existe y no debe existir.
6. **Las horas las pone el servidor**, nunca el cliente. Un celular con la hora mal no puede desordenar la cola de cocina. (Única excepción: `hora_retiro`, que es una intención del cliente, no el registro de cuándo pasó algo.)
7. **Toda mutación de cuenta, pedido o línea pasa por el servicio de auditoría.** Sin excepciones. Es lo que hace posible la edición cruzada: queda registrado quién tocó qué, con el JSON de antes y después.
8. **No hay aritmética de impuestos.** Los precios del menú ya incluyen el IVA 13 % y el 10 % de servicio. El total de una cuenta es la **suma simple** de sus líneas. `PRECIOS_INCLUYEN_IMPUESTOS = true` existe por si algún día cambia; hoy no hay ni un cálculo de IVA en el sistema.

---

## Comandos

```bash
npm install                 # instala los tres workspaces

npm run dev                 # backend (:3000) + frontend (:5173) en paralelo
npm run build               # shared → backend → frontend, en ese orden
npm test                    # tests de shared y backend
npm run lint                # ESLint sobre packages/
npm run typecheck           # tsc --noEmit en los tres paquetes

npm run db:migrate          # prisma migrate dev
npm run db:seed             # carga menu-seed.json (idempotente)
npm run db:studio           # explorador de la base
npm run db:reset            # ⚠️ borra la base y vuelve a sembrar
```

Un solo test o un solo archivo:

```bash
npm run test -w @brisas/shared -- dividir           # por nombre de archivo
npm run test -w @brisas/shared -- -t "caso trampa"  # por nombre de test
npm run test:watch -w @brisas/shared                # watch
npm run test -w @brisas/shared -- --coverage        # cobertura de money/
```

Node 20+. Sin Docker: corre nativo en la PC de caja.

---

## Arquitectura

Monorepo con **npm workspaces** (nada de Nx, Turborepo ni Lerna).

```
packages/shared     tipos, enums, schemas Zod, paleta, y money/  ← el contrato único
packages/backend    NestJS + Prisma + SQLite (WAL) + Socket.IO
packages/frontend   React 18 + Vite + Tailwind + PWA, los 4 roles en una base
```

**El flujo del dinero es de una sola dirección:** `shared/money/` calcula → el backend guarda enteros → el frontend solo formatea con `formatearColones`. Ningún cálculo de dinero se escribe en el backend ni en el frontend; si hace falta uno nuevo, va a `shared/money/` **con sus tests**.

### `packages/shared` — leelo antes de escribir en los otros dos

Es el contrato único entre backend y frontend. Si un tipo, una validación o un cálculo se necesita en los dos lados, vive acá y en ningún otro lugar.

- `money/` — la parte más importante del repo. `dividirEnPartes`, `calcularTotalLinea`, `totalizadorDeLinea`, `repartirPorAtribucion`, `repartirPorHoras`, `repartirPartesIguales`. **Cobertura obligatoria.** Si el redondeo está mal, las meseras cobran mal.
- `types/enums.ts` — objetos `as const` + union type, no `enum` de TypeScript. Es la **única** fuente de valores válidos (ver la nota de Prisma abajo).
- `schemas/` — Zod. Los **mismos** schemas validan el formulario del frontend y el body del endpoint. Una sola verdad.
- `constants/paleta.ts` — los 10 colores de mesera, con contraste y separación perceptual verificados por test en cada corrida.

### `packages/backend`

- `main.ts` escucha en **`0.0.0.0`**. ⚠️ Con `127.0.0.1` la PC se ve a sí misma y **ningún celular ni la tablet pueden conectarse** — es el error que deja el sistema "funcionando" en la demo y muerto el día de la instalación.
- En producción el backend **también sirve el frontend compilado** (`packages/frontend/dist`), así que todos los dispositivos entran a una sola dirección: `http://<IP-DE-CAJA>:3000`.
- `JwtGuard` y `RolesGuard` son **globales**. Todo endpoint pide token salvo los marcados con `@Publico()`. El rol se valida **siempre en el backend**: esconder botones en la interfaz no es seguridad, cualquiera en la LAN puede llamar la API con curl.
- SQLite en **WAL** (`PrismaService.onModuleInit`), para que leer no bloquee mientras la caja escribe. Los `PRAGMA` van por `$queryRawUnsafe`, no `$executeRawUnsafe`: devuelven filas y Prisma falla.
- **`connection_limit=1` no es negociable.** SQLite tiene un solo escritor; con varias conexiones se pelean por el lock, y peor: los `PRAGMA` se aplican **por conexión**, así que solo una quedaría con `busy_timeout` y el resto moriría de una. Con una sola conexión, Prisma hace la cola en su pool. La prueba de carga lo descubrió: 15 cuentas simultáneas dejaban 11 en error 500 y el p95 en 5,4 s; con el límite, 0 errores y p95 de 198 ms.
- Una sola instancia, siempre. SQLite es un archivo único: `exec_mode: fork` en PM2, nunca cluster.
- **El token de cocina se emite sin PIN** (`POST /auth/cocina` es `@Publico()`, la tablet arranca sola en kiosco) y dura un año, así que cualquiera en el WiFi puede pedirlo. Por eso el rol `COCINA` está acotado a leer la cola y mover el estado de una comanda: `cuentas`, `usuarios` y los demás endpoints de `pedidos` lo excluyen explícitamente. Si agregás un endpoint, preguntate si la tablet debería poder llamarlo — y si no, ponele `@Roles`.

### `packages/frontend`

- Cuatro roles en una sola base de código: `src/roles/{mesera,cocina,caja,admin}/`.
- **Cocina no pasa por el login.** Son varias cocineras frente a una sola tablet; pedirles login sería fricción pura y terminarían dejando abierta la sesión de una persona. La ruta `/cocina` pide su token sola contra `POST /api/auth/cocina`.
- El frontend importa `@brisas/shared` **desde la fuente** (alias en `vite.config.ts` + `paths` en `tsconfig.json`), no desde `dist/`. `shared` compila a CommonJS para NestJS, y ahí un `export *` se vuelve `__exportStar(...)`, que Rollup no puede analizar: el build falla con *"X is not exported by shared/dist/index.js"*.
- Los datos operativos llegan por **Socket.IO**, no por polling. React Query no refetchea al enfocar la ventana.
- Ninguna pantalla se queda en blanco al perder la señal: se muestra `BannerSinConexion` **y se mantiene en pantalla lo ya recibido**. En cocina, quedarse en blanco significaría perder la cola de comandas en plena hora pico.

---

## Convenciones

**Nombres de entidad en español, snake_case, idénticos al plan de trabajo.** `cuenta.canal`, `linea.precio_unit_snapshot`, `mesera_responsable_id`. El código se lee junto al negocio; no traduzcas al inglés ni pases a camelCase. Los modelos de Prisma van en PascalCase con `@@map` a la tabla snake_case.

**Prisma no tiene enums.** El conector SQLite de Prisma no los soporta, así que los campos enumerados son `String`. La lista de valores válidos vive en `packages/shared/src/types/enums.ts` y la hacen cumplir los schemas Zod en el `ZodValidationPipe` de cada endpoint. Al leer, casteá: `cuenta.canal as CanalCuenta`.

**Validación con Zod, no con class-validator.** Cada endpoint que recibe body usa `@Body(new ZodValidationPipe(algúnSchema))` con un schema de `shared`.

**Auditar dentro de la transacción.** Las mutaciones llaman a `AuditoriaService.registrar(..., tx)` **dentro** del mismo `$transaction` que la escritura, con el antes y el después reales. Así lo hacen `MenuService` y `UsuariosService`, y así deben hacerlo cuenta, pedido y línea.

El `AuditoriaInterceptor` (`@Auditar(...)`) es solo una red de seguridad para mutaciones triviales, y tiene dos límites que hay que tener presentes: guarda **el body de la petición**, no el estado previo (inútil para responder "¿de cuánto a cuánto subió ese precio?"), y **guardaría secretos que vengan en el body** — por eso los endpoints de usuarias no lo usan: el PIN nunca puede entrar a `auditoria`, que es append-only y la leen caja y admin.

**Renombrar ≠ reemplazar.** Al editar variantes u opciones, mandá el `id` de las que ya existen. Con `id` se actualizan (y cambiar la etiqueta las **renombra**); sin `id` se buscan por etiqueta/nombre y si no existen se crean. Las que no vengan en la lista se **desactivan**, nunca se borran: hay líneas ya cobradas que las referencian. Esto importa de verdad — las etiquetas "Pequeño"/"Grande" de 18 productos son supuestas y hay que corregirlas con la dueña.

**Ante una ambigüedad:** elegí la opción más simple, dejá un comentario `// DECISIÓN:` explicando por qué, y seguí.

---

## Reglas de negocio con trampa

**División de factura — tres modalidades.** Todo junto · Partes iguales · Cada quien lo suyo. En "partes iguales" el redondeo se maneja **explícitamente**: los colones sobrantes van a la **primera** parte y la pantalla muestra el desglose completo (₡8.334 / ₡8.333 / ₡8.333). Nadie debe hacer cuentas mentales. En "cada quien lo suyo", una línea puede quedar compartida entre comensales — por eso `linea_comensal` lleva `fraccion` — y no se puede cerrar el cobro con líneas sin asignar.

`linea_comensal.fraccion` es un `Float` y **no es dinero**: al cobrar, el monto de la línea se reparte con `repartirPorPesos` sobre enteros, para que las partes sumen exactamente el total.

**Reparto entre meseras — no asumas una fórmula.** El reparto **no** es en partes iguales: la dueña lo hace por días y horas trabajadas. Con una sola mesera no hay ambigüedad; con varias, **la regla todavía no está decidida por el negocio**. Por eso están implementadas las tres (`ATRIBUCION` por defecto, `HORAS`, `PARTES_IGUALES`), cuál manda lo dice `configuracion.REGLA_REPARTO`, y **el cierre siempre calcula y muestra las tres** para que la dueña decida viendo números reales. `cierre_mesera` guarda **horas y ventas crudas** además de los tres montos, así que los cierres viejos se pueden recalcular si la regla cambia.

Lo importante de este proyecto es la **gestión de pedidos**, no el reparto. El reparto es un reporte sobre datos que el sistema ya tiene: no lo sobre-diseñes ni construyas un motor de nómina.

**Cocina — restricciones de UX que no son negociables.** Las usuarias son señoras con poca experiencia digital, compartiendo una sola tablet, con las manos ocupadas, en un ambiente caliente y con prisa. Sin login. Tres columnas fijas, sin menús ni pestañas ni scroll horizontal. La tarjeta entera es el botón, un toque avanza de estado. **Nada de diálogos de confirmación**: en su lugar un botón grande DESHACER que dura 30 segundos — confirmar antes cansa, deshacer después perdona. Escala `cocina`: cliente 28 px+, platillos 22 px+, **nada bajo 20 px**, botones de 72 px de alto. (Bajó un escalón desde el mínimo original de 32/24/80 cuando cocina pasó a trabajar por platillo en vez de por comanda — hay más tarjetas por columna que antes. El piso de 20 px sigue intocable.) Palabras en español ("EMPEZAR", "LISTO"), no íconos sueltos. Las notas del cliente ("SIN CEBOLLA") en mayúsculas y destacadas: es el dato que más se pasa por alto y el que más devoluciones causa.

El toque avanza **de forma optimista**: la tarjeta se mueve en el acto y después se confirma contra el servidor. No es una optimización — si la tarjeta se quedara quieta esperando la respuesta, la cocinera pensaría que no registró y volvería a tocar, y ese segundo toque se llevaría la comanda dos estados adelante. Mientras el cambio va en camino la tarjeta no acepta otro toque. Por lo mismo `PATCH /pedidos/:id/estado` **acepta retroceder**: deshacer es exactamente eso, y queda auditado igual que el avance.

**La cola de cocina la arma `GET /pedidos/cocina`, y no lleva ni un precio.** Devuelve las comandas del día en juego (ENVIADO, EN_PREPARACION, LISTO; las ENTREGADO y las de cuentas anuladas salen), más los umbrales de `configuracion` y la **hora del servidor** — el temporizador se mide contra esa hora, no contra el reloj de la tablet (INVARIANTE 6). Dos exclusiones deliberadas: los precios, que a la cocina no le sirven y le robarían lugar al nombre del cliente; y las **líneas de envase**, que no se cocinan — el cargo de ₡200 ya está en la cuenta y lo ve caja.

**El semáforo de cocina hace dos preguntas distintas.** En una cuenta de salón mide *cuánto lleva esperando el cliente* (naranja a los 10 min, rojo a los 20). En una PARA_LLEVAR mide *cuánto falta para el retiro*: un pedido tomado a las 3 para las 6 lleva tres horas "esperando" y no tiene nada de urgente. Lo mismo vale para el orden de la cola — `ordenarCola` de `shared` usa `hora_retiro ?? creado_en`, así que ese pedido no ocupa el primer lugar toda la tarde y sube solo cuando se acerca la hora. Está en `shared/src/cocina/cola.ts` con sus tests: es regla de negocio, no diseño de pantalla.

**El cobro entero lo calcula `GET /cuentas/:id/cobro`.** Devuelve subtotal, descuentos, total, pagado, saldo, las partes a cobrar y los totales por comensal, todo con las funciones de `shared/money` — las mismas que corren en la pantalla. El saldo que ve la cajera es exactamente el que el servidor usa para decidir si la cuenta quedó saldada; dos aritméticas serían dos verdades sobre la plata. Registrar un pago que completa el saldo **cierra la cuenta sola**; `POST .../cobro/cerrar` existe solo para la cortesía, donde el total queda en cero y no hay ningún pago que registrar.

**Dos reglas que se parecen y no lo son:** las comandas que cocina no entregó **avisan pero no bloquean** — la caja marca la casilla de confirmación y el forzado queda auditado con su motivo. Las líneas **sin asignar** en "cada quien lo suyo" **sí bloquean**, en el servidor y no solo en la pantalla: cobrar así deja comida sin cobrarle a nadie y no se nota hasta el cierre del día.

**Los descuentos se encadenan.** Cada uno se calcula sobre lo que quedaba después del anterior, no sobre el total original — dos del 60 % sobre el original darían 120 % y la cuenta quedaría en negativo. Una cortesía se lleva el remanente. Y aunque `linea_comensal.fraccion` sea un `Float`, **el cliente nunca manda fracciones**: manda partes enteras ("2 cervezas para Juan, 1 para Ana") y el servidor divide. Tres pantallas mandando 0,33 no sumarían 1.

**Configuración, no constantes.** `REGLA_REPARTO`, `PRECIO_ENVASE`, `MIN_ALERTA_COCINA` y `MIN_URGENTE_COCINA` se leen de la tabla `configuracion` vía `ConfiguracionService`. Las constantes de `shared` son solo el respaldo si la tabla no responde. Nunca hardcodees ₡200 ni los 10/20 minutos en una pantalla.

**El turno se abre solo si hace falta.** `TurnosService.turnoAbierto()` devuelve el abierto y lo crea si no existe, porque toda cuenta necesita uno y frenar a la mesera con un *«pedile a caja que abra el turno»* termina en pedidos anotados en papel. La apertura explícita desde caja le agrega las meseras con sus horas, y de paso limpia los «agotado hoy» del día anterior.

**`hora_entrada` y `hora_salida` son la segunda excepción al INVARIANTE 6**, junto con `hora_retiro`. No registran cuándo pasó algo en el sistema: son lo que la caja **afirma sobre el mundo real** (*«María entró a las 11, aunque yo abro el turno a las 11:30»*). Si no se mandan las pone el servidor, y cuando se mandan queda auditado que se escribieron a mano.

**El cierre calcula los tres repartos, siempre.** `shared/money/cierre.ts` los produce juntos y la tabla los muestra lado a lado con la regla activa resaltada — la dueña todavía no decidió cuál usar con dos o más meseras, y eso se decide mejor viendo números reales. Lo que se reparte es el **total de salón**: para llevar es la cuenta aparte de la dueña y los envases son empaque, no venta de nadie. `cierre_mesera` guarda **horas y ventas crudas** además de los tres montos, así que un cierre viejo se puede recalcular si la regla cambia. El cierre es **inmutable**: no se puede cerrar dos veces el mismo turno, y `GET /cierres/:id` devuelve el `desglose_json` **tal como se guardó**, no un recálculo — mañana los precios pueden ser otros y el cierre de hoy tiene que verse igual.

**`LineaDeCierre` no tiene `para_llevar`, y es a propósito.** Es la misma defensa que en `totalizadorDeLinea`: el cierre no puede ni mirar esa bandera. Hay un test explícito del caso trampa en `cierre.test.ts` — Don Carlos come en el salón, se lleva lo que le sobró, y el resultado es `{ salon: 5800, para_llevar: 0, envases: 200 }`.

**La cola offline se apoya en `idempotencia_key`.** El celular genera la clave, guarda el pedido en localStorage y recién después intenta mandarlo. Si reintenta, el servidor reconoce la clave y devuelve la comanda que ya creó — cocina nunca recibe el pedido dos veces. Un error de red deja el pedido en la cola; un rechazo del servidor (producto agotado, cuenta en cobro) lo saca, porque reintentarlo fallaría igual y la mesera vería un "pendiente" eterno.

---

## Estado del proyecto

Va por prompts, uno por sesión (ver `prompt-claude-code.md`):

| | |
|---|---|
| ✅ Scaffold | monorepo, `shared` completo con tests, Prisma + seed, auth por PIN, gateway de Socket.IO, auditoría, shells navegables de los 4 roles |
| ✅ Prompt 2 | CRUD de menú (categorías, productos, variantes, grupos de opción) y de usuarias con selector de color, ambos en el panel de admin |
| ✅ Prompt 3 | app de mesera completa: cuentas, toma de pedido, edición cruzada, envase automático y cola offline. Backend de cuentas, pedidos y turno mínimo |
| ✅ Prompt 4 | pantalla de cocina en vivo: tres columnas, temporizador con semáforo, campana, DESHACER de 30 s y `GET /pedidos/cocina` |
| ✅ Prompt 5 | caja: tablero, ficha con bitácora, las tres modalidades de cobro, pagos parciales, descuentos y pedido telefónico |
| ✅ Prompt 6 | turnos con horas por mesera, cierre de día con los tres repartos, reportes y visor de auditoría filtrable |
| ✅ Prompt 7 | endurecimiento: permisos por rol verificados, respaldo con restauración probada, vigilante, prueba de carga y manuales por rol |

**Datos del menú:** `menu-seed.json` trae **84 productos** (no 86) transcritos de las fotos del menú de Google Maps. 11 bebidas entran **desactivadas por no tener precio** — el sistema no permite venderlas hasta que se les cargue uno — y "Salchipapas" entra desactivada porque está pendiente confirmar si se sigue vendiendo. 18 productos tienen rango de precio modelado como dos variantes con etiquetas **supuestas** ("Pequeño"/"Grande"), a confirmar con la dueña. Todo eso se corrige en la fase 0 con el menú oficial; ver la sección 12.2 de `plan-de-trabajo.md` para las preguntas abiertas.

**Usuarias de prueba** (solo desarrollo): María (MESERA), Cocina (COCINA), Caja (CAJA), Dueña (ADMIN). PIN `1234` para todas.
