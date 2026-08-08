# Prompt maestro para Claude Code

> **Cómo usarlo:** abrí una carpeta vacía en VS Code, poné `menu-seed.json` dentro, abrí Claude Code y pegá TODO el bloque de abajo (desde "Vas a crear" hasta el final). Es un prompt de scaffold: crea la estructura, el modelo de datos, la autenticación y los esqueletos de los tres frontends. Las features grandes (caja, división de factura, cocina en vivo) se piden después, una por una, con los prompts de seguimiento del final de este archivo.
>
> **Antes de pegar:** asegurate de que `menu-seed.json` esté en la raíz de la carpeta. El prompt lo referencia.

---

## ▼▼▼ COPIÁ DESDE AQUÍ ▼▼▼

Vas a crear desde cero el proyecto **Brisas POS**, un sistema de punto de venta para el restaurante Mirador Brisas del Monte (Costa Rica). Leé todo antes de escribir código.

---

## 1. Contexto del negocio

Restaurante familiar de montaña en Costa Rica. Hoy trabajan 100% en papel: la mesera anota la comanda, camina hasta la cocina a entregarla, y al final del día la caja suma a mano. Queremos reemplazar eso con un sistema en tiempo real.

Tres pantallas conectadas por la red WiFi local del restaurante:

1. **Celular de cada mesera** (PWA) — abre cuentas y manda pedidos a cocina.
2. **Tablet fija en cocina** (PWA en modo kiosco) — cola de comandas.
3. **Computadora de caja** (navegador) — cobra, divide facturas, cierra el día. **Esta misma PC es el servidor.**

**Sin internet, sin nube.** Todo corre en la LAN. Si se cae el ISP, el restaurante sigue trabajando.

### Fuera de alcance — NO lo implementes ni lo sugieras

- Procesamiento de pagos (datáfono, SINPE). El sistema **calcula** el total; el cobro se hace aparte, como hoy. La forma de pago se guarda solo como dato informativo.
- Facturación electrónica ante Hacienda. Sigue en papel.
- Reservaciones, sitio web público, delivery, inventario, app nativa.

---

## 2. Reglas de negocio — leé esto con atención, aquí está lo que hace especial a este proyecto

### 2.1 Cuentas por nombre, no por mesa

El restaurante **no usa números de mesa**. Cada cuenta se abre con el nombre del cliente ("Don Carlos", "María"). Texto libre obligatorio. Puede haber nombres repetidos en el mismo turno — el sistema los permite y los desambigua mostrando hora de apertura y color de mesera. Hay un campo opcional de referencia ("terraza", "4 personas").

### 2.2 Propiedad de cuenta y color por mesera

Cada usuaria tiene un `color_hex` asignado al crearla. Ese color identifica sus cuentas en las tres pantallas: franja lateral gruesa en la tarjeta, fondo tenue, y también en la comanda de cocina.

**El color NUNCA es la única señal.** Siempre va con el nombre de la mesera en texto legible. Daltonismo y sol directo en la terraza.

### 2.3 Edición cruzada — REQUISITO CENTRAL

Caso real: María abre la cuenta de Don Carlos. Don Carlos le pide a Ana que le cambie el pedido. **Ana debe poder hacerlo.**

- Cualquier mesera puede editar **cualquier** cuenta abierta. No hay bloqueo por propietaria.
- Al abrir una cuenta ajena, mostrar un aviso informativo (no un obstáculo): *"Esta cuenta es de María. Los cambios quedan registrados a tu nombre."* con [Continuar] / [Cancelar].
- **Toda** modificación escribe en la tabla `auditoria`: quién, qué acción, cuándo, JSON de antes y después.
- La cuenta muestra un indicador visible de que fue editada por alguien distinto a la responsable, con la lista de quién tocó qué.
- La responsable **no cambia** automáticamente. Existe una acción explícita y aparte, "Traspasar cuenta", que sí la cambia y también se audita.

### 2.4 Una cuenta contiene VARIOS pedidos

La cuenta es un contenedor. Cuenta "Don Carlos" → Pedido #1 (3 líneas) → Pedido #2 (2 cervezas más) → Pedido #3 (postre).

- Cada pedido entra a cocina como comanda **nueva e independiente**, con `es_agregado = true` si la cuenta ya tenía pedidos. Cocina lo muestra con una banda naranja que dice **AGREGADO**.
- El precio de cada línea se **congela** al enviarla a cocina (`precio_unit_snapshot`). Si la dueña sube un precio a media tarde, las cuentas ya abiertas no cambian. Esto es innegociable.

### 2.5 Para llevar y envases — leé esto con cuidado, es fácil equivocarse

No hay delivery, pero sí pedidos telefónicos para recoger.

- La **cuenta** tiene `canal`: `SALON` | `PARA_LLEVAR`. Se define al abrirla y **no cambia después**.
- `PARA_LLEVAR` significa **exclusivamente** un pedido que desde el inicio es para recoger: alguien llamó o llegó al mostrador. No se sienta a comer. Estas cuentas piden teléfono y hora de retiro, y no requieren mesera responsable (normalmente las abre caja, que contesta el teléfono).

**El envase cuesta ₡200 por unidad, precio único.** Se cobra en dos casos:

1. Cuenta de canal `PARA_LLEVAR`: se agrega automáticamente, un envase por platillo.
2. Cliente del salón al que le sobró comida y pide llevársela: la mesera marca esas líneas con `pedido_linea.para_llevar = true` y el sistema agrega el envase.

**⚠️ EL ERROR QUE NO DEBÉS COMETER:**

`pedido_linea.para_llevar` es **únicamente un disparador del cargo del envase**. **NO clasifica ingresos.** Que a un cliente del salón le sobre medio casado y se lo lleve no convierte esa venta en "para llevar" — se vendió en el salón, se sirvió en el salón, y cuenta como venta de salón.

**La separación contable es POR CUENTA, según su `canal`. Nunca por línea.**

| Concepto | ¿A qué totalizador va? |
|---|---|
| Cuenta con `canal = SALON`, todo su consumo | `total_salon` — atribuible a la mesera |
| Cuenta con `canal = PARA_LLEVAR`, todo su consumo | `total_para_llevar` — cuenta aparte de la dueña |
| Líneas de envase, de cualquier canal | `total_envases` — recuperación de empaque |

Tres totalizadores independientes. Ninguna línea de comida cambia de totalizador jamás. Si te ves escribiendo lógica que reclasifica una línea de comida según `para_llevar`, pará: está mal.

### 2.6 Impuestos — no hay

**Los precios del menú YA INCLUYEN el IVA 13% y el 10% de servicio.** El total de una cuenta es la **suma simple** de sus líneas.

No escribas aritmética de impuestos en ninguna parte. Dejá la clave `PRECIOS_INCLUYEN_IMPUESTOS = true` en `configuracion` por si algún día cambia, pero hoy no hay cálculo de IVA ni de servicio en el sistema.

### 2.7 División de factura — tres modalidades

**A. Todo junto.** Un pago por el total. Caso por defecto, un solo botón.

**B. Partes iguales.** La caja indica en cuántas partes. **Manejá el redondeo explícitamente**: los colones sobrantes van a la primera parte y la pantalla muestra el desglose completo (₡8.334 / ₡8.333 / ₡8.333). Nadie debe tener que hacer cuentas mentales. Escribí tests para esto.

**C. Cada quien lo suyo.** Se crean "comensales" (Comensal 1, 2, 3… renombrables) y se asigna cada línea.
- Una línea de cantidad > 1 se reparte entre comensales (3 cervezas → 2 a Juan, 1 a Ana).
- Una línea puede quedar **compartida**: se divide en partes iguales entre los seleccionados. Por eso `linea_comensal` lleva un campo `fraccion`.
- No se puede cerrar el cobro con líneas sin asignar. Mostrá un contador de pendientes.

En las tres: forma de pago informativa (`EFECTIVO`/`TARJETA`/`SINPE`/`MIXTO`), pagos parciales permitidos (cuenta queda `EN_COBRO` con saldo visible), descuentos y cortesías con motivo obligatorio y auditados.

### 2.8 Turnos, horas y reparto

El reparto **no es en partes iguales**. La dueña lo hace **por días y horas trabajadas**. Su ejemplo textual: *"una mesera va un día de 11 a 5 y todo va a ser para ella"*.

- Caja **abre turno** indicando qué meseras entran **y a qué hora**. Se puede agregar o quitar una a mitad de turno; cada una guarda hora de entrada y salida en `turno_mesera`.
- Cada cuenta de salón se atribuye a la mesera que la abrió.

**No asumás una fórmula de reparto.** Con una sola mesera no hay ambigüedad; con varias, la regla todavía no está decidida por el negocio. Así que implementá **las tres** y dejá cuál manda en `configuracion.REGLA_REPARTO`:

| Valor | Cómo reparte |
|---|---|
| `ATRIBUCION` *(por defecto)* | Cada mesera se lleva el total de las cuentas que ella abrió |
| `HORAS` | El total del turno en proporción a las horas trabajadas por cada una |
| `PARTES_IGUALES` | El total del turno dividido entre las meseras que trabajaron |

El cierre **siempre calcula y muestra las tres**, aunque solo una esté activa. La dueña decide viendo números reales.

- `cierre_mesera` guarda **horas y ventas crudas** además de los tres montos. Si la regla cambia después, los cierres viejos se pueden recalcular.
- Al **cerrar turno**: total salón, total para llevar, total envases, descuentos, horas por mesera, ventas atribuidas por mesera, los tres repartos **con el desglose del cálculo** (no solo el número final — evita discusiones), desglose por forma de pago, y cuentas anuladas.
- El cierre es histórico e inmutable. No se puede cerrar dos veces el mismo turno.

**Prioridad:** lo importante de este proyecto es la **gestión de pedidos**, no el reparto. El reparto es un reporte sobre datos que el sistema ya tiene. No lo sobre-diseñes ni construyas un motor de nómina.

---

## 3. Stack — usá exactamente esto

- **Monorepo** con npm workspaces. Nada de Nx, Turborepo ni Lerna.
- **Backend:** NestJS + TypeScript. **Prisma** como ORM. **SQLite** con WAL activado. Socket.IO vía NestJS Gateway para tiempo real.
- **Frontend:** React 18 + Vite + TypeScript. React Router. TanStack Query. Zustand para estado local. Tailwind CSS. PWA con `vite-plugin-pwa`.
- **Compartido:** paquete `shared` con tipos y schemas Zod usados por back y front.
- **Auth:** JWT. PIN de 4 dígitos hasheado con argon2.
- **Tests:** Vitest. **Cobertura obligatoria en la lógica de dinero** (división de factura, redondeo, cálculo de reparto, separación salón/para-llevar).
- **Proceso:** PM2 con `ecosystem.config.js`, más instrucciones para NSSM en Windows.

Node 20+. Sin Docker — corre nativo en la PC de caja.

---

## 4. Estructura a crear

```
brisas-pos/
├── package.json                  (workspaces)
├── README.md
├── CLAUDE.md
├── .env.example
├── ecosystem.config.js           (PM2)
├── menu-seed.json                (YA EXISTE — leelo, no lo inventes)
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── types/            (entidades, enums)
│   │       ├── schemas/          (Zod, compartidos back/front)
│   │       ├── constants/        (PALETA_MESERAS, umbrales de cocina)
│   │       └── money/            (colones enteros, redondeo, división)
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts           (carga menu-seed.json)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── auth/             (PIN, JWT, guards, decorador @Roles)
│   │       ├── usuarios/
│   │       ├── menu/             (categorias, productos, variantes, opciones)
│   │       ├── cuentas/
│   │       ├── pedidos/
│   │       ├── cocina/
│   │       ├── caja/             (cobro, división, pagos)
│   │       ├── turnos/           (apertura, cierre, reparto)
│   │       ├── auditoria/        (servicio transversal + interceptor)
│   │       ├── reportes/
│   │       ├── config/
│   │       ├── realtime/         (Socket.IO gateway)
│   │       └── common/           (filtros, pipes, utilidades)
│   └── frontend/
│       └── src/
│           ├── main.tsx
│           ├── app/              (router, providers, guards por rol)
│           ├── shared/           (api client, socket, hooks, ui/)
│           ├── roles/
│           │   ├── mesera/
│           │   ├── cocina/
│           │   ├── caja/
│           │   └── admin/
│           └── styles/
└── scripts/
    ├── backup.sh / backup.ps1
    └── setup-red.md              (IP fija, firewall, kiosco en tablet)
```

---

## 5. Modelo de datos — implementalo tal cual en Prisma

Nombres en español, para que el código se lea junto al negocio. Todos los montos son **enteros de colones** — jamás uses float para dinero.

```
usuario            id, nombre, pin_hash, rol(MESERA|COCINA|CAJA|ADMIN),
                   color_hex, activo, creado_en
turno              id, fecha, abierto_en, abierto_por_id, cerrado_en,
                   cerrado_por_id, estado(ABIERTO|CERRADO)
turno_mesera       turno_id, usuario_id, hora_entrada, hora_salida

categoria          id, codigo, nombre, orden, activo
producto           id, categoria_id, nombre_es, nombre_en, descripcion,
                   activo, agotado, orden, es_envase
variante           id, producto_id, etiqueta, precio_colones, orden, activo
grupo_opcion       id, codigo, nombre, obligatorio, min_sel, max_sel
opcion             id, grupo_opcion_id, nombre, precio_extra, activo
producto_grupo     producto_id, grupo_opcion_id                (N:M)

cuenta             id, turno_id, canal(SALON|PARA_LLEVAR), nombre_cliente,
                   referencia, telefono, hora_retiro, mesera_responsable_id,
                   estado(ABIERTA|EN_COBRO|COBRADA|ANULADA),
                   abierta_en, cerrada_en, abierta_por_id
comensal           id, cuenta_id, etiqueta, orden

pedido             id, cuenta_id, consecutivo_dia, creado_por_id, creado_en,
                   estado(ENVIADO|EN_PREPARACION|LISTO|ENTREGADO), es_agregado
pedido_linea       id, pedido_id, producto_id, variante_id, cantidad,
                   precio_unit_snapshot, nota, para_llevar, anulada,
                   estado_linea
linea_opcion       id, linea_id, opcion_id, nombre_snapshot, precio_extra_snapshot
linea_comensal     id, linea_id, comensal_id, fraccion

auditoria          id, cuenta_id?, pedido_id?, linea_id?, usuario_id,
                   accion, antes_json, despues_json, motivo, creado_en
descuento          id, cuenta_id, tipo(MONTO|PORCENTAJE|CORTESIA), valor,
                   motivo, autorizado_por_id, creado_en
division           id, cuenta_id, modo(TOTAL|PARTES_IGUALES|POR_CONSUMO), n_partes
pago               id, cuenta_id, division_id?, parte_num, monto,
                   forma_pago, registrado_por_id, creado_en
cierre_dia         id, turno_id, total_salon, total_para_llevar, total_envases,
                   total_descuentos, regla_aplicada, n_meseras,
                   desglose_json, generado_en
cierre_mesera      id, cierre_id, usuario_id, horas_trabajadas,
                   ventas_atribuidas, monto_atribucion, monto_horas,
                   monto_partes_iguales
configuracion      clave (PK), valor, descripcion
```

**Claves de `configuracion` que el seed debe crear:**

| Clave | Valor inicial | Qué controla |
|---|---|---|
| `PRECIOS_INCLUYEN_IMPUESTOS` | `true` | No calcular IVA ni servicio |
| `REGLA_REPARTO` | `ATRIBUCION` | `ATRIBUCION` \| `HORAS` \| `PARTES_IGUALES` |
| `PRECIO_ENVASE` | `200` | Colones por envase |
| `MIN_ALERTA_COCINA` | `10` | Minutos para pasar la comanda a naranja |
| `MIN_URGENTE_COCINA` | `20` | Minutos para pasarla a rojo |

**Invariantes que tenés que respetar en todo el código:**

1. Dinero = enteros de colones. Nunca float.
2. `precio_unit_snapshot` y `precio_extra_snapshot` se copian al crear la línea. Los precios del menú **jamás** se leen para recalcular una cuenta existente.
3. `pedido_linea.para_llevar` **solo dispara el cargo del envase**. La clasificación contable la hace `cuenta.canal`, siempre, sin excepción.
4. Nada se borra físicamente. Usá `activo` / `anulada`.
5. `auditoria` es **append-only**. No creés endpoint ni servicio de update/delete sobre ella.
6. Las horas las pone **el servidor**, nunca el cliente.
7. Toda mutación de cuenta, pedido o línea pasa por el servicio de auditoría. Sin excepciones.
8. No hay aritmética de impuestos. El total es la suma de las líneas.

---

## 6. Qué construir en ESTE paso (el scaffold)

Hacé esto y nada más. No implementes las features grandes todavía.

1. **Monorepo** con workspaces, tsconfig base, ESLint + Prettier, scripts raíz (`dev`, `build`, `test`, `db:migrate`, `db:seed`).
2. **`packages/shared`** completo: todos los tipos y enums, schemas Zod, la paleta de 10 colores para meseras (contraste verificado, bien diferenciados entre sí), y el **módulo `money/`** con:
   - `dividirEnPartes(total, n)` → array de enteros que suman exactamente `total`, sobrante a la primera parte.
   - `calcularTotalLinea(linea)`.
   - `repartirPorAtribucion(ventasPorMesera)` → cada una se lleva lo suyo.
   - `repartirPorHoras(total, horasPorMesera)` → proporcional a las horas, sumando exactamente `total`.
   - `repartirPartesIguales(total, nMeseras)`.
   - **Tests Vitest completos para las cinco funciones**, incluyendo casos de borde: total 0, n=1, totales no divisibles, una sola mesera se lleva todo, dos meseras con horas desiguales, y montos grandes. En todos, la suma de las partes debe dar **exactamente** el total.
3. **`prisma/schema.prisma`** con el modelo completo de la sección 5, migración inicial y **`seed.ts` que lee `menu-seed.json`** y carga categorías, productos, variantes y grupos de opción. El seed debe ser idempotente. Creá también 4 usuarias de prueba (una por rol) con PIN `1234` y colores distintos, y las claves de `configuracion` con valores por defecto.
4. **Backend**: `main.ts` escuchando en `0.0.0.0` (crítico — si escucha en localhost los celulares no lo ven), CORS abierto a la LAN, módulo de auth por PIN funcionando con JWT y guard de roles, módulo de menú con CRUD completo, gateway de Socket.IO con las salas `cocina`, `caja` y `meseras`, servicio de auditoría con su interceptor, filtro global de excepciones y healthcheck en `/api/health`.
5. **Frontend**: app Vite + React + Tailwind + PWA configurada, router con guards por rol, pantalla de login con **teclado numérico grande en pantalla** (no el teclado del sistema), cliente API tipado, hook de socket, y **shells vacíos pero navegables** de los cuatro roles con su layout propio.
6. **Sistema de diseño en Tailwind** con dos escalas de tamaño configuradas en `tailwind.config`:
   - Escala `cocina`: texto base 24 px, títulos 32 px+, altura mínima de botón 80 px, área táctil mínima 64 px.
   - Escala normal para mesera, caja y admin.
   Definí también las clases de estado: `nuevo` (ámbar), `preparacion` (azul), `listo` (verde), `agregado` (naranja).
7. **`CLAUDE.md`** en la raíz con: el contexto del negocio resumido, los 8 invariantes de la sección 5, las convenciones de nombres (entidades en español, código en TypeScript), la regla de dinero entero, la obligación de auditar toda mutación, la advertencia de que los precios se congelan, y **en letra bien grande la distinción entre `cuenta.canal` (clasifica ingresos) y `pedido_linea.para_llevar` (solo cobra el envase)** — es el error más fácil de cometer en este dominio.
8. **`README.md`** con instalación, cómo levantar en desarrollo, y una sección de **despliegue en la PC de caja**: IP fija, PM2/NSSM, firewall, respaldo, y cómo poner la tablet en modo kiosco.
9. **`scripts/backup.sh` y `backup.ps1`**: copia del `.sqlite` con timestamp, retención de 30 días, destino carpeta local + unidad USB.

---

## 7. Cómo quiero que trabajés

- **Empezá por `shared/money/` y sus tests.** Toda la aplicación depende de esa aritmética. Si el redondeo está mal, las meseras cobran mal.
- Después Prisma + seed. Corré el seed y confirmá que cargó los 86 productos.
- Después el backend. Después el frontend.
- **Corré los tests y el build al terminar cada paquete.** No me entregués algo que no compila.
- Si algo de este prompt es ambiguo, **elegí la opción más simple, dejá un comentario `// DECISIÓN:` explicando por qué, y seguí.** No te frenes a preguntar cosas menores.
- Al final, dame un resumen corto de lo que quedó hecho y una lista de lo que falta.

**No hagás todavía:** pantallas de mesera, cocina o caja completas; la lógica de cobro y división; el cierre de día; los reportes. Eso viene en los prompts siguientes. Ahora solo el esqueleto sólido.

## ▲▲▲ COPIÁ HASTA AQUÍ ▲▲▲

---

# Prompts de seguimiento

Ejecutalos en orden, uno por sesión, después de que el scaffold esté verde.

### Prompt 2 — Menú y administración

> Implementá el CRUD completo del menú en el panel admin: categorías, productos, variantes, grupos de opción y opciones. Con activar/desactivar (nunca borrar), marcar "agotado hoy", y reordenar por arrastre. Más el CRUD de usuarias con selector de color desde la paleta de `shared/constants`, validando que no se repita un color entre meseras activas. Recordá: cambiar un precio **no** afecta cuentas ya abiertas.

### Prompt 3 — App de mesera

> Implementá la app de mesera completa: lista de cuentas abiertas (las propias arriba a todo color, las ajenas abajo apagadas pero accesibles), crear cuenta por nombre, navegar el menú por categorías, hoja de opciones al tocar un platillo (variante, grupos de opción, cantidad, nota, marcar para llevar), carrito con subtotal siempre visible, y enviar a cocina. Incluí la **edición cruzada** con el aviso de la sección 2.3 y su registro de auditoría, agregar pedidos a cuentas ya abiertas (`es_agregado`), el cargo automático del envase de ₡200 al marcar una línea para llevar — que **solo cobra el envase y no reclasifica la venta**, ver sección 2.5 — y la **cola offline**: si no hay señal, el pedido se guarda local con indicador visible de "pendiente de enviar" y se manda solo al volver la conexión.

### Prompt 4 — Pantalla de cocina

> Implementá la pantalla de cocina con las restricciones de UX que siguen, que **no son negociables** — las usuarias son señoras con poca experiencia digital compartiendo una sola tablet:
>
> - Sin login. La tablet arranca directo en la app.
> - Tres columnas fijas: NUEVOS (ámbar) · EN PREPARACIÓN (azul) · LISTOS (verde). Sin menús, sin pestañas, sin scroll horizontal.
> - La tarjeta entera es el botón. Un toque avanza de estado.
> - Nada de diálogos de confirmación. En su lugar, un botón grande **DESHACER** que dura 30 segundos.
> - Escala tipográfica `cocina`: nombre del cliente 32 px+, platillos 24 px+, nada bajo 20 px. Botones de 80 px de alto mínimo.
> - Campana suave + parpadeo al entrar un pedido nuevo. Volumen ajustable.
> - Temporizador por tarjeta: minutos transcurridos, naranja a los 10 min, rojo a los 20 (leer umbrales de `configuracion`).
> - Orden automático, el más viejo arriba. Nadie debe buscar nada.
> - Botones con **palabras en español** ("EMPEZAR", "LISTO"), no íconos sueltos.
> - Las notas del cliente ("SIN CEBOLLA") en mayúsculas y destacadas — es lo que más se pasa por alto.
> - Los pedidos agregados llevan banda naranja con la palabra AGREGADO y el nombre del cliente.
> - Los de para llevar se distinguen y se ordenan por hora de retiro.
> - Si se cae la conexión: banner rojo grande "SIN CONEXIÓN" y se mantienen en pantalla los pedidos ya recibidos. Nunca pantalla en blanco.
>
> Todo en tiempo real por Socket.IO, sin recargar.

### Prompt 5 — Caja y división de factura

> Implementá el módulo de caja: tablero de cuentas abiertas en cuadrícula coloreada por mesera con filtros por canal y buscador; ficha de cuenta con líneas agrupadas por pedido, totales y bitácora de auditoría desplegable; y el flujo de cobro con las tres modalidades (todo junto / partes iguales con desglose de redondeo visible / cada quien lo suyo con pantalla de dos paneles y asignación por toque, soportando líneas compartidas y contador de pendientes). Más pagos parciales, descuentos y cortesías con motivo obligatorio, anulaciones con rol caja o admin, y el formulario rápido de pedido telefónico para llevar. Todo auditado.

### Prompt 6 — Turnos, cierre de día y reportes

> Implementá apertura de turno marcando qué meseras entran **y a qué hora** (con alta y baja a mitad de turno), y el cierre de día que produce: total salón, total para llevar, total envases, descuentos, **horas trabajadas y ventas atribuidas por mesera**, los **tres repartos** (`ATRIBUCION`, `HORAS`, `PARTES_IGUALES`) con el desglose completo del cálculo, desglose por forma de pago y cuentas anuladas. Guardá horas y ventas crudas en `cierre_mesera` para poder recalcular si cambia la regla. Respetá la separación **por canal de cuenta** de la sección 2.5 — y escribí un test explícito del caso trampa: *una cuenta de salón con una línea marcada `para_llevar` debe sumar toda su comida a `total_salon` y solo ₡200 a `total_envases`*. El cierre es inmutable y reimprimible. Sumá los reportes de admin: ventas por día, por mesera, por platillo, salón vs. para llevar, y el visor de auditoría filtrable.

### Prompt 7 — Endurecimiento y despliegue

> Preparalo para producción en la PC de caja: `ecosystem.config.js` de PM2 e instrucciones de NSSM para Windows, script de respaldo probado con su restauración documentada, health check con reintento automático, logs con rotación, prueba de carga simulando 15 cuentas simultáneas y 3 dispositivos, revisión de que todo endpoint valide rol en el backend, y el manual de usuario en español por rol — corto, con capturas, escrito para alguien que nunca usó un sistema así.
