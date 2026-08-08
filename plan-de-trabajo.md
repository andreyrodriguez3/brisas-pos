# Plan de trabajo — Sistema de digitalización de pedidos
## Restaurante Mirador Brisas del Monte

| | |
|---|---|
| **Versión** | 1.1 |
| **Fecha** | 6 de agosto de 2026 |
| **Cliente** | Restaurante Mirador Brisas del Monte |
| **Desarrollador** | Andrey |
| **Monto** | ₡180.000 en 3 pagos mensuales de ₡60.000 |
| **Duración estimada** | 12 semanas (3 meses) |
| **Estado** | Borrador para revisión con la dueña |

> **Cambios de la versión 1.1** (tras la segunda conversación con la dueña):
>
> - **Envase confirmado a ₡200** por unidad, precio único.
> - **Los precios del menú ya incluyen IVA y servicio.** El sistema no calcula impuestos.
> - **Corrección importante en la separación contable:** la separación es **por cuenta**, no por línea. Que a un cliente del salón le sobre comida y pida llevársela solo dispara el cobro del envase — no convierte esa venta en "para llevar".
> - **El reparto no es en partes iguales.** Se hace por turnos, días y horas. Ver la sección 5.10, que se reescribió completa.

---

## 1. Resumen ejecutivo

Hoy el restaurante opera en papel: la mesera anota el pedido en una comanda, la lleva físicamente a la cocina, y al final la caja suma a mano. Eso genera tres problemas concretos: viajes innecesarios entre salón y cocina, errores de suma al cobrar, y cero trazabilidad de quién hizo qué.

Este proyecto reemplaza ese flujo con un sistema digital de tres pantallas conectadas en tiempo real por la red WiFi del propio restaurante:

1. **Celular de cada mesera** — toma el pedido y lo manda a cocina al instante.
2. **Tablet fija en cocina** — muestra los pedidos en orden de llegada; las cocineras los marcan "en preparación" y "listo".
3. **Computadora de caja** — muestra las cuentas abiertas, calcula totales, permite dividir la factura y cierra el día con las ventas atribuidas a cada mesera y las horas que trabajó.

Todo funciona **sin internet**. La computadora de caja hace de servidor dentro de la red local; si se cae el internet, el sistema sigue trabajando.

**Lo que este sistema NO hace** (y es importante que quede claro desde el día uno): no procesa cobros con datáfono ni SINPE, y no emite factura electrónica ante Hacienda. Calcula el monto; el cobro y la factura siguen exactamente como hoy, en paralelo.

---

## 2. Situación actual

| Paso | Cómo se hace hoy | Problema |
|---|---|---|
| Toma de pedido | Mesera anota en papel bajo el nombre del cliente (no usan número de mesa) | Letra ilegible, papel se pierde |
| Envío a cocina | Mesera camina y entrega la comanda | Tiempo perdido, la mesera abandona el salón |
| Preparación | Cocineras trabajan sobre el papel | No hay orden claro de llegada ni forma de avisar que está listo |
| Modificación | Se tacha o se agrega en la misma comanda | No queda claro quién cambió qué |
| Cobro | La caja suma a mano | Errores de suma, lento, difícil dividir cuentas |
| Cierre del día | Se cuenta y se reparte a ojo | Sin registro, difícil de auditar |
| Pedidos por teléfono | Se anotan aparte | Se mezclan con lo del salón y distorsionan el reparto |

---

## 3. Alcance

### 3.1 Dentro del alcance

- **App de mesera** (PWA en el celular personal de cada mesera): abrir cuenta a nombre del cliente, tomar y enviar pedidos, agregar ítems a cuentas ya abiertas, editar cuentas propias y ajenas con registro de auditoría.
- **Pantalla de cocina** (tablet fija, modo kiosco): cola de pedidos por orden de llegada con estados *Nuevo → En preparación → Listo*, diseñada para uso por varias cocineras sobre un único dispositivo y optimizada para baja alfabetización digital.
- **Módulo de caja** (computadora de escritorio): cuentas abiertas por nombre de cliente y mesera, cálculo de total, división de factura en tres modalidades, registro de forma de pago, cierre de día con horas trabajadas y ventas atribuidas por mesera.
- **Canal de pedidos para llevar / recoger**: cuentas de canal separado (llamada telefónica o cliente en mostrador), con cobro de envases a ₡200 y contabilidad independiente de la del salón.
- **Panel de administración**: gestión del menú (categorías, platillos, variantes, precios), gestión de usuarias, reportes de ventas y bitácora de auditoría.
- **Instalación y capacitación** en sitio, con manual corto en español y período de acompañamiento.

### 3.2 Fuera del alcance

| Excluido | Por qué |
|---|---|
| Reservaciones en línea o sitio web público | No es parte del problema operativo actual |
| Integración con datáfono / SINPE / efectivo | El sistema calcula el total; el cobro se procesa igual que hoy, en paralelo. Integrar medios de pago requiere convenios con adquirente y certificación. |
| Facturación electrónica ante Hacienda | Requiere un proveedor certificado y es un proyecto de cumplimiento tributario distinto. La facturación sigue en papel como hasta hoy. |
| Control de inventario / costeo de recetas | Fase futura, no cotizada |
| App nativa en App Store / Play Store | Se entrega como PWA instalable, sin costo ni fricción de tiendas |
| Acceso remoto desde fuera del restaurante | El sistema vive en la red local por diseño |
| Compra de tablet y computadora | Corre por cuenta del restaurante |

> **Nota para la conversación con la dueña:** los tres primeros puntos conviene repetirlos verbalmente y dejarlos firmados. Son la fuente más común de malentendidos en este tipo de proyecto ("pensé que ya me iba a facturar").

---

## 4. Usuarios y roles

| Rol | Dispositivo | Cómo entra | Qué puede hacer |
|---|---|---|---|
| **Mesera** | Su propio celular | PIN de 4 dígitos, sesión persistente | Abrir cuentas, tomar pedidos, agregar ítems, editar (propias y ajenas), ver estado de cocina |
| **Cocina** | Tablet fija compartida | Sesión permanente, sin login por persona | Ver cola, marcar en preparación / listo, deshacer |
| **Caja** | Computadora de escritorio | Usuario + PIN | Todo lo de mesera + cobrar, dividir factura, anular, abrir/cerrar turno |
| **Administradora (dueña)** | Cualquier dispositivo | Usuario + PIN | Todo lo anterior + menú, usuarias, reportes, auditoría |

**Decisión de diseño:** las cocineras **no** se loguean individualmente. Son varias personas frente a una sola tablet; pedirles login sería fricción pura y terminarían dejando la sesión de una sola persona abierta. La tablet tiene una identidad de dispositivo ("Cocina") y punto.

---

## 5. Reglas de negocio

Esta es la sección que más importa. Cada regla aquí sale directamente de lo conversado con la dueña.

### 5.1 Cuentas identificadas por nombre, no por mesa

El restaurante no maneja números de mesa. Cada cuenta se abre con el **nombre del cliente** que da la mesera.

- El nombre es texto libre, obligatorio, mínimo 2 caracteres.
- Puede haber nombres repetidos en el mismo turno (dos "María"). El sistema los permite pero los muestra con un distintivo (hora de apertura y color de mesera) para que la caja no se confunda.
- Opcionalmente se puede anotar una referencia ("María — terraza", "Don Carlos — 4 personas"). Campo libre, no obligatorio.

### 5.2 Propiedad de la cuenta y código de color

- Al abrir una cuenta, queda asignada a la mesera que la abrió. Esa es su **mesera responsable**.
- Cada mesera tiene un **color asignado** al crear su usuario (paleta fija de colores bien diferenciados, con contraste verificado). El color aparece en:
  - la tarjeta de la cuenta en la lista (franja lateral gruesa + fondo tenue),
  - la ficha de la cuenta en caja,
  - la comanda en cocina (para que la cocinera sepa a quién avisar).
- En la pantalla de la mesera, sus cuentas aparecen **primero y a todo color**; las de las compañeras aparecen abajo, más apagadas, pero visibles y accesibles.

> El color nunca es la única señal. Siempre va acompañado del nombre de la mesera en texto. Un color solo excluye a quien tenga daltonismo y falla bajo el sol de la terraza.

### 5.3 Edición cruzada entre meseras

Escenario real: María abre la cuenta de "Don Carlos". Don Carlos le pide a Ana que le cambie el pedido. **Ana debe poder hacerlo.**

Reglas:

1. Cualquier mesera puede editar cualquier cuenta abierta. No hay bloqueo.
2. Al tocar una cuenta que no es suya, aparece un aviso claro, no un obstáculo:
   > *"Esta cuenta es de María. Los cambios quedan registrados a tu nombre."* — [Continuar] [Cancelar]
3. Toda modificación genera un **registro de auditoría** con: quién, qué, cuándo, valor anterior y valor nuevo.
4. La cuenta muestra un **indicador visible** de que fue editada por alguien distinto a la responsable, con la lista de quién tocó qué.
5. La **responsabilidad de la cuenta no cambia** automáticamente. La cuenta sigue siendo de María para efectos de reporte. Existe una acción explícita y separada de "Traspasar cuenta a otra mesera" que sí cambia la responsable, y que también queda auditada.

**Qué se audita** (evento, quién, cuándo, antes → después):

- Agregar línea a un pedido
- Cambiar cantidad
- Eliminar línea
- Cambiar nota / opción (ej.: papas → yuca)
- Enviar pedido a cocina
- Cambio de estado en cocina
- Traspasar cuenta
- Aplicar descuento o cortesía
- Anular cuenta
- Registrar pago

La bitácora es **inmutable**: solo se inserta, nunca se edita ni se borra. Es visible para caja y administración desde la ficha de la cuenta.

### 5.4 Agregar ítems a una cuenta abierta

Una cuenta no es un pedido único. Es un **contenedor de pedidos**.

- Cuenta "Don Carlos" → Pedido #1 (3 líneas) → Pedido #2 (2 cervezas más) → Pedido #3 (postre).
- Cada pedido entra a cocina como una comanda **nueva e independiente**, marcada visualmente como *"AGREGADO — Don Carlos"* para que la cocinera entienda que es adicional a algo que ya mandó.
- La cuenta acumula todos los pedidos y su total se recalcula solo.
- El precio de cada línea se **congela** al momento de enviarla a cocina. Si la dueña sube un precio en el panel a media tarde, las cuentas ya abiertas no cambian.

### 5.5 Estados

**Estados de cuenta:** `ABIERTA` → `EN_COBRO` → `COBRADA`, con salida lateral a `ANULADA`.

**Estados de pedido (comanda):** `ENVIADO` → `EN_PREPARACIÓN` → `LISTO` → `ENTREGADO`.

- Cocina controla `EN_PREPARACIÓN` y `LISTO`.
- La mesera controla `ENTREGADO` (o se marca automático a los X minutos de `LISTO`, configurable).
- Una cuenta no se puede cobrar si tiene pedidos sin entregar — la caja recibe una advertencia, pero puede forzarlo (auditado).

### 5.6 Canal para llevar / recoger

El restaurante **no hace delivery**, pero sí toma pedidos por teléfono para que el cliente pase a recoger.

- Cada cuenta tiene un campo **canal**: `SALÓN` o `PARA_LLEVAR`. Se define **al abrir la cuenta** y no cambia después.
- `PARA_LLEVAR` significa **exclusivamente** un pedido que desde el inicio es para recoger: alguien llamó por teléfono, o llegó al mostrador a pedir para llevar. No se sienta a comer.
- Estas cuentas piden además: nombre, **teléfono** y **hora estimada de retiro**. No tienen mesera responsable (normalmente las abre la caja, que es quien contesta el teléfono).
- En la cola de cocina se distinguen con un ícono y color propio, y se ordenan por **hora de retiro**, no por hora de entrada.

### 5.7 El envase — ₡200, y qué NO significa

El envase plástico se cobra a **₡200 por unidad**, precio único sin importar el tamaño.

Se cobra en dos situaciones distintas:

1. **Pedidos para llevar** (cuenta de canal `PARA_LLEVAR`): el sistema agrega el cargo automáticamente, un envase por platillo, y la caja puede ajustar la cantidad.
2. **Cliente del salón al que le sobró comida** y pide llevársela: la mesera marca esas líneas y el sistema agrega el envase.

> **Aquí está la corrección más importante respecto de la versión 1.0 de este documento.**
>
> El caso del cliente que come en el salón y se lleva lo que le sobró **solo afecta el cobro del envase**. No reclasifica nada. Esa comida se vendió en el salón, se sirvió en el salón y cuenta como venta de salón. La bandera `para_llevar` de la línea es **únicamente un disparador del cargo del envase**, no un clasificador de ingresos.
>
> En la versión anterior había modelado la separación contable a nivel de línea. Estaba de más y habría complicado el cierre sin razón.

### 5.8 Separación contable: salón vs. para llevar

La dueña fue explícita: lo de los pedidos para llevar va en **cuenta aparte**, para que ella lo revise y lleve su control. No se mezcla con lo del salón.

**La separación es por cuenta, según su canal. Punto.**

| Concepto | ¿A qué bolsa va? |
|---|---|
| Cuenta de canal `SALÓN` (todo su consumo) | **Salón** — atribuible a la mesera |
| Cuenta de canal `PARA_LLEVAR` (todo su consumo) | **Para llevar** — cuenta aparte de la dueña |
| Envases, de cualquier canal | **Envases** — tercer totalizador, recuperación de empaque |

Tres totalizadores independientes, y ninguna línea de comida cambia de bolsa. Que a Don Carlos le sobre medio casado y se lo lleve no mueve ₡1 de la bolsa de salón: solo suma ₡200 a la bolsa de envases.

El cierre del día muestra siempre los tres números por separado, y el reporte de la dueña los tiene desglosados por fecha.

### 5.9 Cobro y división de factura

**Los precios del menú ya incluyen el IVA del 13% y el 10% de servicio.** El sistema **no calcula impuestos**: el total de una cuenta es la suma simple de sus líneas. Esto queda fijado en la configuración (`PRECIOS_INCLUYEN_IMPUESTOS = true`) por si algún día cambia, pero hoy no hay aritmética de impuestos en ninguna parte del sistema.

Al cobrar, la caja escoge una de tres modalidades:

**A. Todo junto** — un solo pago por el total de la cuenta. Es el caso por defecto y el más rápido: un botón.

**B. Partes iguales** — la caja indica en cuántas partes se divide (2, 3, 4…). El sistema calcula el monto por persona y **maneja el redondeo explícitamente**: los colones sobrantes se cargan a la primera parte, y la pantalla muestra el desglose (ej.: ₡8.334 / ₡8.333 / ₡8.333) para que nadie tenga que hacer cuentas en la cabeza.

**C. Cada quien lo suyo** — cada línea de la cuenta se asigna a un comensal. La caja arma "comensales" (Comensal 1, 2, 3… renombrables) y arrastra o toca cada línea para asignarla. Reglas:

- Una línea de cantidad > 1 se puede repartir entre comensales (ej.: 3 cervezas → 2 a Juan, 1 a Ana).
- Una línea puede quedar **compartida** entre varios comensales: se divide en partes iguales entre los seleccionados.
- El sistema no deja cerrar el cobro hasta que **todas** las líneas estén asignadas, y muestra un contador de líneas pendientes.
- Cada subtotal se cobra por separado y puede tener forma de pago distinta.

En las tres modalidades:

- Se registra la forma de pago por parte (`EFECTIVO` / `TARJETA` / `SINPE` / `MIXTO`), **únicamente como dato informativo**. El sistema no procesa ningún cobro.
- Se permite pago parcial: la cuenta queda `EN_COBRO` con saldo pendiente visible hasta completarse.
- Se pueden aplicar descuentos y cortesías, siempre con motivo obligatorio y auditados.

### 5.10 Turnos, horas trabajadas y reparto

**Esta sección cambió por completo respecto de la versión 1.0.** El acuerdo inicial decía "repartir en partes iguales". La dueña aclaró que no es así: **el reparto va por días y horas trabajadas**. Su ejemplo textual fue *"una mesera va un día de 11 a 5 y todo va a ser para ella"*.

#### Cómo se registra el turno

- Caja **abre turno** indicando qué meseras entran y **a qué hora**.
- Se puede agregar o quitar una mesera a mitad de turno. Cada una tiene su **hora de entrada y su hora de salida** registradas.
- El sistema atribuye cada cuenta de salón a la mesera que la abrió, con su hora. Nada se pierde ni se mezcla.

#### Cómo se calcula el reparto

El caso que describió la dueña — una sola mesera en el turno, todo es para ella — es el **caso simple** de una regla más general: **cada mesera se lleva lo de sus propias cuentas**. Si está sola, sus cuentas son todas las cuentas, y por eso "todo va a ser para ella". Esa es la regla que el sistema aplica por defecto.

Ahora bien, **no está claro qué pasa cuando hay dos o más meseras al mismo tiempo**, y esa es una decisión del negocio, no de software. Así que el sistema no la asume: **registra los datos necesarios para cualquiera de las tres reglas posibles** y el cierre las muestra las tres, lado a lado.

| Regla | Cómo reparte | Cuándo tiene sentido |
|---|---|---|
| **A. Por atribución** *(por defecto)* | Cada mesera se lleva el total de las cuentas que ella abrió | Cada quien atiende sus propias mesas. Es el caso que describió la dueña. |
| **B. Por horas** | El total del turno se reparte en proporción a las horas que trabajó cada una | Se ayudan entre todas y no tiene sentido separar por mesa |
| **C. Partes iguales** | El total del turno dividido entre las meseras que trabajaron | Turnos parejos, todas entran y salen a la misma hora |

La regla activa se define en configuración (`REGLA_REPARTO`), se puede cambiar en cualquier momento sin tocar código, y el cierre **siempre muestra las tres cifras** para que la dueña vea la diferencia y decida con números en la mano en lugar de en abstracto.

> **Recomendación:** arrancar con la regla A. Es la que corresponde a lo que describió la dueña y la única que no requiere una decisión que todavía no está tomada. Si al ver los cierres reales prefiere otra, se cambia en la configuración.

#### Qué muestra el cierre de día

- Total vendido en **salón**
- Total vendido **para llevar** (cuenta aparte de la dueña)
- Total cobrado por **envases**
- Descuentos y cortesías aplicados
- **Horas trabajadas por cada mesera**, con entrada y salida
- **Ventas atribuidas a cada mesera**
- **El reparto según las tres reglas**, con el desglose completo del cálculo — no solo el número final
- Desglose por forma de pago, para cuadrar la caja física
- Cuentas anuladas y quién las anuló

El cierre queda guardado como registro histórico y es **reimprimible**. No se puede cerrar dos veces el mismo turno ni cerrar con cuentas abiertas sin resolver.

> **Advertencia:** el sistema calcula y muestra. La entrega del dinero la hace la caja a mano. El sistema no mueve plata.

#### Prioridad

Andrey fue claro en que **lo importante es la gestión de pedidos**, no el reparto. El diseño lo respeta: el reparto no es un motor de nómina, es un **reporte** sobre datos que el sistema ya tiene por otras razones. Si la regla cambia dentro de seis meses, se ajusta una fila de configuración y los cierres viejos siguen siendo válidos porque guardan los datos crudos, no solo el resultado.

---

## 6. Arquitectura técnica

### 6.1 Topología

```
                 Router WiFi del restaurante
                    (ya existente)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────┴─────┐      ┌──────┴──────┐     ┌──────┴──────┐
   │ Celulares│      │   Tablet    │     │  PC de CAJA │
   │ meseras  │      │   COCINA    │     │  (SERVIDOR) │
   │  (PWA)   │      │   (PWA,     │     │ NestJS +    │
   │          │      │   kiosco)   │     │ SQLite      │
   └──────────┘      └─────────────┘     │ + navegador │
                                          └─────────────┘
                                                 │
                                          Respaldo automático
                                          (carpeta local + USB)
```

**La PC de caja es el servidor.** Corre el backend NestJS, la base de datos SQLite y además se usa como estación de caja en su propio navegador. Los demás dispositivos entran a `http://192.168.1.50:3000` (IP a definir) como si fuera una página web interna.

**Sin internet, sin nube, sin hosting.** Ventaja: cero costo mensual, cero latencia, funciona aunque se caiga el ISP. Desventaja: si la PC se apaga, se cae todo el sistema — de ahí las medidas de la sección 6.3.

### 6.2 Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Backend | **NestJS** (Node.js + TypeScript) | Estructura modular clara, buen manejo de WebSockets nativo, TypeScript de punta a punta |
| Base de datos | **SQLite** (con WAL activado) | Un solo archivo, cero administración, sobra para este volumen (~200–400 líneas de pedido/día). Postgres sería mantenimiento innecesario. |
| ORM | **Prisma** o **TypeORM** | Migraciones versionadas y tipado |
| Tiempo real | **WebSocket** (Socket.IO sobre NestJS Gateway) | Cocina y caja se actualizan solas, sin recargar |
| Frontend | **React + Vite**, PWA | Instalable en el celular sin pasar por tiendas; una sola base de código para los tres roles |
| Estado / datos | **TanStack Query** + store ligero (Zustand) | Caché, reintentos y revalidación resueltos |
| UI | Tailwind + componentes propios | Control total del tamaño de tipografía y botones (crítico para cocina) |
| Proceso | **PM2** (o **NSSM** si es Windows) | Arranque automático al encender la PC, reinicio si el proceso muere |
| Respaldo | Script programado | Copia diaria del archivo `.sqlite` a carpeta local + USB |

### 6.3 Confiabilidad — el sistema tiene que aguantar un servicio de almuerzo

Estas no son opcionales:

1. **Arranque automático.** PM2 (Linux) o NSSM (Windows) registra el backend como servicio. Si se va la luz y la PC se reinicia, el sistema vuelve solo, sin que nadie tenga que abrir una terminal.
2. **IP fija.** Asignada desde la configuración de red de la propia PC, sin tocar el router (el router no es nuestro y puede que no tengamos la clave). Se documenta la IP en un papel pegado a la PC.
3. **Respaldo automático diario** del archivo SQLite, con retención de 30 días, a una carpeta local y a una llave USB permanentemente conectada. Se prueba la restauración durante la instalación — un respaldo que nunca se restauró no es un respaldo.
4. **UPS recomendada** para la PC de caja y el router. Es hardware del cliente, pero hay que insistir: sin UPS, un corte de luz a las 12:30 p.m. congela el restaurante.
5. **Cola offline en el celular de la mesera.** Si el WiFi falla un momento, la app guarda el pedido localmente y lo envía en cuanto vuelve la señal, con indicador visible de "pendiente de enviar". La mesera nunca pierde un pedido por señal.
6. **Modo degradado en cocina.** Si la tablet pierde conexión, mantiene en pantalla los pedidos que ya recibió y muestra un banner rojo grande de "SIN CONEXIÓN". Nunca se queda en blanco.
7. **Reloj compartido.** Todas las horas las pone el servidor, no los dispositivos. Un celular con la hora mal no puede desordenar la cola de cocina.

### 6.4 Seguridad razonable

Es una red local en un restaurante, no un banco. Pero:

- PIN de 4 dígitos por usuaria, hasheado (bcrypt/argon2), con bloqueo tras 5 intentos fallidos.
- Sesión con JWT de vida larga en el celular (la mesera no debe loguearse cada rato) y vida corta en caja.
- Permisos por rol validados **en el backend**, no solo escondiendo botones en la interfaz.
- Anulaciones y descuentos requieren rol caja o admin.
- La bitácora de auditoría no tiene endpoint de borrado. No existe.
- El archivo de base de datos vive en una ruta protegida, no en el escritorio.

---

## 7. Modelo de datos

Entidades principales (nombres en español para que el código sea legible junto al negocio):

```
usuario            id, nombre, pin_hash, rol, color_hex, activo
turno              id, fecha, abierto_en, abierto_por, cerrado_en, cerrado_por, estado
turno_mesera       turno_id, usuario_id, hora_entrada, hora_salida

categoria          id, nombre, orden, activo
producto           id, categoria_id, nombre_es, nombre_en, descripcion,
                   activo, orden, es_envase
variante           id, producto_id, etiqueta, precio_colones, orden, activo
grupo_opcion       id, nombre, obligatorio, min_sel, max_sel
opcion             id, grupo_opcion_id, nombre, precio_extra
producto_grupo     producto_id, grupo_opcion_id          (N:M)

cuenta             id, turno_id, canal(SALON|PARA_LLEVAR),
                   nombre_cliente, referencia, telefono, hora_retiro,
                   mesera_responsable_id, estado, abierta_en, cerrada_en
comensal           id, cuenta_id, etiqueta                (para división por consumo)

pedido             id, cuenta_id, consecutivo_dia, creado_por_id,
                   creado_en, estado, es_agregado(bool)
pedido_linea       id, pedido_id, producto_id, variante_id, cantidad,
                   precio_unit_snapshot, nota, para_llevar(bool),
                   estado_linea, anulada(bool)
linea_opcion       linea_id, opcion_id, precio_extra_snapshot
linea_comensal     linea_id, comensal_id, fraccion        (permite compartir)

auditoria          id, cuenta_id, pedido_id, linea_id, usuario_id,
                   accion, antes_json, despues_json, motivo, creado_en
descuento          id, cuenta_id, tipo, monto, motivo, autorizado_por_id
pago               id, cuenta_id, parte_num, monto, forma_pago,
                   registrado_por_id, creado_en
division           id, cuenta_id, modo(TOTAL|PARTES_IGUALES|POR_CONSUMO), n_partes

cierre_dia         id, turno_id, total_salon, total_para_llevar,
                   total_envases, total_descuentos, regla_aplicada,
                   n_meseras, desglose_json, generado_en
cierre_mesera      cierre_id, usuario_id, horas_trabajadas,
                   ventas_atribuidas, monto_regla_a,
                   monto_regla_b, monto_regla_c
configuracion      clave, valor
```

**Claves de configuración iniciales:**

| Clave | Valor | Qué controla |
|---|---|---|
| `PRECIOS_INCLUYEN_IMPUESTOS` | `true` | Los precios ya traen IVA y servicio. El sistema no calcula impuestos. |
| `REGLA_REPARTO` | `ATRIBUCION` | `ATRIBUCION` \| `HORAS` \| `PARTES_IGUALES` (sección 5.10) |
| `PRECIO_ENVASE` | `200` | Colones por envase |
| `MIN_ALERTA_COCINA` | `10` | Minutos para que la comanda pase a naranja |
| `MIN_URGENTE_COCINA` | `20` | Minutos para que pase a rojo |

**Decisiones deliberadas:**

- `precio_unit_snapshot` en la línea: el precio se congela. Cambiar el menú no reescribe la historia.
- `pedido_linea.para_llevar` es **solo un disparador del cargo del envase**. No clasifica ingresos — eso lo hace `cuenta.canal`. Ver la sección 5.7.
- `linea_comensal` con `fraccion`: permite que tres personas compartan una picada.
- `auditoria` con JSON de antes/después: flexible, no hay que crear una tabla por tipo de cambio.
- `cierre_mesera` guarda **horas y ventas crudas**, además de los tres montos calculados. Si mañana cambia la regla de reparto, los cierres viejos se pueden recalcular porque el dato de origen quedó guardado.
- `configuracion` como tabla clave-valor: la regla de reparto, el precio del envase y los tiempos se ajustan sin tocar código.
- Nada se borra físicamente. Todo tiene `activo` o `anulada`.

---

## 8. Diseño de interfaz por rol

### 8.1 Cocina — la pantalla más crítica del proyecto

Las usuarias son señoras con poca experiencia en tecnología, compartiendo una sola tablet, con las manos ocupadas y probablemente sucias, en un ambiente caliente y con prisa. Si esta pantalla falla, el proyecto falla.

**Principios innegociables:**

| Principio | Implementación concreta |
|---|---|
| Nada de login | La tablet arranca sola en la app, en modo kiosco. Nunca pide contraseña. |
| Texto grande | Nombre del cliente ≥ 32 px. Platillos ≥ 24 px. Nada por debajo de 20 px. |
| Botones grandes | Mínimo 80 px de alto, con separación de 16 px. Imposible errarle. |
| Un vistazo basta | Tres columnas fijas: **NUEVOS** (amarillo) · **EN PREPARACIÓN** (azul) · **LISTOS** (verde). Sin menús, sin pestañas, sin scroll horizontal. |
| Un toque por acción | La tarjeta entera es el botón. Tocar un pedido nuevo → pasa a preparación. Tocar uno en preparación → pasa a listo. Eso es todo. |
| Sin diálogos de confirmación | En lugar de "¿Está segura?", un botón grande de **DESHACER** que dura 30 segundos. Confirmar antes cansa; deshacer después perdona. |
| Aviso sonoro | Campana suave al entrar un pedido nuevo, más parpadeo de la tarjeta. Volumen ajustable, porque la cocina es ruidosa. |
| El tiempo se ve | Cada tarjeta muestra los minutos transcurridos. Pasa a naranja a los 10 min y a rojo a los 20 (configurable). |
| Orden automático | Los pedidos se ordenan solos, el más viejo arriba. Nadie tiene que buscar. |
| Palabras, no íconos | Los botones dicen "EMPEZAR" y "LISTO", en español, no un símbolo abstracto. |
| Distinción visual de agregados | Los pedidos que se suman a una cuenta existente llevan una banda naranja con la palabra **AGREGADO** y el nombre del cliente. |

**Anatomía de una tarjeta de pedido:**

```
┌──────────────────────────────────────────┐
│ ▌ DON CARLOS              🕐 6 min       │  ← franja del color de la mesera
│ ▌ Mesera: María                          │
├──────────────────────────────────────────┤
│  2 ×  Casado                             │
│         → con papas · SIN CEBOLLA        │
│  1 ×  Pescado entero                     │
│         → con patacón                    │
│  3 ×  Batido de mora (en leche)          │
├──────────────────────────────────────────┤
│        [      E M P E Z A R      ]       │
└──────────────────────────────────────────┘
```

Las notas del cliente ("sin cebolla") van en **mayúsculas y destacadas**. Es el dato que más se pasa por alto y el que más devoluciones causa.

### 8.2 Mesera — celular

- **Entrada:** teclado numérico grande, PIN de 4 dígitos. La sesión queda abierta todo el turno.
- **Pantalla principal:** lista de cuentas abiertas en tarjetas. Arriba las propias, a todo color. Abajo las de las compañeras, apagadas. Botón flotante grande: **+ NUEVA CUENTA**.
- **Nueva cuenta:** nombre del cliente (obligatorio), referencia (opcional), canal. Listo.
- **Tomar pedido:** categorías en pestañas horizontales → lista de platillos → tocar uno abre la hoja de opciones (variante, acompañamiento, cantidad, nota, ¿para llevar?) → **Agregar**. El carrito se acumula abajo con el subtotal siempre visible.
- **Enviar a cocina:** un botón grande. Confirmación breve y visual. Si no hay señal, queda en cola y lo dice claramente.
- **Estado en vivo:** cada cuenta muestra si sus pedidos están en preparación o listos. Cuando algo pasa a *LISTO*, el celular de la mesera responsable vibra y avisa.
- **Editar cuenta ajena:** el aviso de la sección 5.3, y adelante.

### 8.3 Caja — computadora de escritorio

Es la pantalla con más funciones, y la que usa la persona con más soltura técnica. Aquí sí se puede densificar la información.

- **Tablero:** todas las cuentas abiertas en cuadrícula, coloreadas por mesera, con filtros por canal (salón / para llevar) y buscador por nombre.
- **Ficha de cuenta:** líneas agrupadas por pedido con su hora, totales, la bitácora de auditoría desplegable, y botones de acción.
- **Cobro:** modal con las tres modalidades de la sección 5.9. La modalidad C (por consumo) es una pantalla de dos paneles — líneas a la izquierda, comensales a la derecha — con asignación por toque y contador de líneas pendientes.
- **Pedidos para llevar:** formulario rápido para tomar el pedido telefónico, con teléfono y hora de retiro, y cargo de envase automático a ₡200.
- **Turno:** abrir turno marcando quiénes trabajan **y a qué hora entran**, y cerrar turno con el resumen completo, las horas de cada una y el reparto según las tres reglas.

### 8.4 Administración

- CRUD de menú: categorías, productos, variantes, grupos de opción, precios. Con activar/desactivar (nunca borrar) y agotado del día.
- CRUD de usuarias: nombre, rol, PIN, **color**.
- Reportes: ventas por día, por mesera, por platillo, salón vs. para llevar, envases.
- Bitácora de auditoría filtrable por fecha, usuaria y tipo de acción.
- Configuración: porcentaje de reparto, umbrales de tiempo en cocina, datos del restaurante.

---

## 9. Plan de fases y cronograma

Estimación en semanas de trabajo. Asume desarrollo a tiempo parcial.

| Fase | Semanas | Entregable | Cómo se sabe que está lista |
|---|---|---|---|
| **0. Descubrimiento y arranque** | 1 | Menú definitivo cargado, respuestas a las preguntas abiertas, repositorio y CI local, documento de decisiones firmado | Todas las preguntas de la sección 12 tienen respuesta escrita |
| **1. Núcleo** | 2–3 | Modelo de datos, migraciones, autenticación por PIN, roles, CRUD de menú, seed cargado | Se puede crear una usuaria, entrar y ver el menú completo |
| **2. App de mesera** | 4–5 | Abrir cuenta, tomar pedido, enviar a cocina, agregar a cuenta abierta, edición cruzada con auditoría, colores, cola offline | Una mesera toma un pedido completo de punta a punta desde su celular |
| **3. Pantalla de cocina** | 6 | Cola en tiempo real, tres estados, deshacer, sonido, temporizadores, modo kiosco | El pedido de la fase 2 aparece en la tablet en menos de 2 segundos y se puede llevar a *LISTO* |
| **4. Caja y división de factura** | 7–8 | Tablero, ficha de cuenta, cobro total / partes iguales / por consumo, descuentos, pagos parciales | Se cobra una cuenta de 3 personas en las tres modalidades sin errores de redondeo |
| **5. Para llevar, envases y cierre** | 9 | Canal para llevar, cargo automático de envase a ₡200, separación por canal, apertura y cierre de turno con horas, reparto según las tres reglas | El cierre del día cuadra a mano contra los tickets de una jornada simulada |
| **6. Administración y reportes** | 10 | Panel de menú y usuarias, reportes, visor de auditoría | La dueña agrega un platillo nuevo sola, sin ayuda |
| **7. Endurecimiento e instalación** | 11 | PM2/NSSM, IP fija, respaldos con prueba de restauración, prueba de carga, ajustes de red en sitio | Se apaga la PC y al encenderla el sistema vuelve solo |
| **8. Capacitación y piloto** | 12 | Capacitación por rol, manual corto ilustrado, una semana de operación en paralelo con el papel | Un servicio completo de almuerzo sin recurrir al papel |

### 9.1 Operación en paralelo — no se apaga el papel de golpe

Durante la **semana 12**, el restaurante trabaja con el sistema **y** con las comandas de papel al mismo tiempo. Es tedioso, y es la única forma responsable de hacerlo. Al final de la semana se comparan los totales; si cuadran tres días seguidos, se retira el papel.

### 9.2 Relación entre pagos y entregables

| Pago | Monto | Cuándo | Contra qué |
|---|---|---|---|
| 1 | ₡60.000 | Al iniciar | Arranque de la fase 0 |
| 2 | ₡60.000 | Al mes | Fin de la fase 3 — mesera y cocina funcionando en demo |
| 3 | ₡60.000 | A los dos meses | Fin de la fase 5 — caja, reparto y para llevar funcionando |

Las fases 6 a 8 quedan cubiertas por el tercer pago y cierran la entrega. Conviene dejarlo escrito así: el cliente ve resultados tangibles antes de cada desembolso.

---

## 10. Hardware requerido (por cuenta del restaurante)

| Equipo | Especificación mínima recomendada | Nota |
|---|---|---|
| **PC de caja / servidor** | 8 GB RAM, SSD 256 GB, procesador moderno, Windows 11 o Linux | Es el corazón del sistema. No escatimar aquí. |
| **Monitor** | 21" o más | La pantalla de división de factura agradece el espacio |
| **Tablet de cocina** | 10" o más, Android reciente, buen brillo | Va montada en pared o soporte fijo, **conectada al cargador de forma permanente** |
| **UPS** | 600 VA o más | Para PC y router. Fuertemente recomendada. |
| **Llave USB** | 32 GB | Queda conectada permanentemente para respaldos |
| **Celulares de meseras** | Los propios, Android o iOS con navegador moderno | No requiere equipo nuevo |
| **Router** | El existente | Verificar cobertura en cocina y salón antes de instalar |

**Pendiente de verificar en sitio:** cobertura real del WiFi en la cocina y en toda el área de mesas. Si la señal es débil en algún punto, la solución es un repetidor o un punto de acceso adicional — costo bajo, pero hay que detectarlo antes, no el día de la instalación.

---

## 11. Riesgos y mitigación

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|
| Se apaga la PC de caja en pleno servicio | Alto — se cae todo | Media | UPS + arranque automático + celulares con cola offline |
| WiFi con zonas muertas | Alto | Media | Medición de cobertura en fase 0; repetidor si hace falta |
| Las cocineras rechazan la tablet | **Alto — mata el proyecto** | Media | Diseño extremo de simplicidad, capacitación con ellas presentes, semana en paralelo con papel, y ajustes basados en lo que digan |
| El menú definitivo llega tarde | Medio | **Alta** | Ya se cargó el seed provisional desde las fotos; el sistema funciona y solo hay que corregir precios |
| La dueña espera facturación electrónica | Alto — conflicto comercial | Media | Está por escrito en la sección 3.2 y debe repetirse verbalmente antes de firmar |
| Se pierde la base de datos | Muy alto | Baja | Respaldo diario automático + USB + prueba de restauración documentada |
| Aparecen requisitos nuevos a media obra | Medio | Alta | Este documento es la línea base; todo lo demás se cotiza aparte |
| Rotación de meseras | Bajo | Alta | Alta de usuaria en menos de un minuto desde el panel |
| Discusión por el reparto entre meseras | Medio | Media | El cierre muestra las horas de cada una, sus ventas atribuidas y las tres reglas de reparto lado a lado, con el desglose del cálculo |
| La regla de reparto cambia después de entregado | Bajo | Media | Es una fila de configuración. Los cierres guardan horas y ventas crudas, así que se pueden recalcular |

---

## 12. Preguntas abiertas para la dueña

### 12.1 Ya resueltas ✅

| Pregunta | Respuesta de la dueña |
|---|---|
| ¿Cuánto se cobra por envase? | **₡200 por unidad**, precio único |
| ¿Los precios incluyen IVA y servicio? | **Sí, ya lo traen todo.** El sistema no calcula impuestos |
| ¿Cómo se reparte entre meseras? | **Por días y horas trabajadas**, no en partes iguales |
| Si un cliente del salón pide llevarse lo que le sobró, ¿es venta "para llevar"? | **No.** Solo se le cobra el envase. Sigue siendo venta de salón |

### 12.2 Pendientes

La primera es la única que todavía afecta el diseño de la caja. Las demás son datos que se pueden ir llenando durante el desarrollo.

1. **⚠️ Cuando hay dos o más meseras trabajando al mismo tiempo, ¿cada una se queda con lo de sus propias mesas, o se junta todo y se divide?** Esta es la pregunta que quedó abierta de la conversación. Con una sola mesera no hay ambigüedad: todo es de ella. Con varias sí. El sistema arranca con "cada quien lo suyo" y muestra las tres opciones en el cierre, así que **no bloquea el desarrollo** — pero conviene preguntarlo con un cierre real en la mano, que es cuando se entiende mejor.
2. ¿Cuántas meseras hay por turno? ¿Hay turnos partidos o solo uno corrido? ¿A qué hora abre y cierra el restaurante?
3. ¿Se necesita **impresora térmica**? Para comanda de cocina de respaldo o para el recibo al cliente. No está cotizada; si se quiere, se agrega al alcance y al presupuesto.
4. ¿Quién opera la caja — la dueña, una cajera fija, o rota entre las meseras?
5. ¿Qué se hace hoy con **anulaciones, cortesías y descuentos**? ¿Quién los autoriza?
6. ¿Los rangos de precio del menú (ej.: "3500-4500") son tamaños, media/entera, o algo distinto? Hay **18 platillos** con este formato — es la duda más repetida de toda la transcripción.
7. ¿Los batidos "1300 / 1800" son en agua y en leche respectivamente?
8. Las **cervezas, vinos y refrescos no tienen precio** en las fotos. Se necesita la lista.
9. ¿Se siguen vendiendo las salchipapas para adultos? Aparecen en el menú viejo pero no en el nuevo.
10. ¿Marca y modelo del router? ¿Hay acceso administrativo? ¿Qué tan buena es la señal en cocina?
11. ¿Cuántas cuentas simultáneas se manejan en la hora pico? (Para dimensionar la interfaz de caja.)

---

## 13. Términos comerciales

| Concepto | Detalle |
|---|---|
| **Monto total** | ₡180.000 |
| **Forma de pago** | 3 pagos mensuales de ₡60.000. El primero al iniciar el desarrollo. |
| **Incluye** | Desarrollo completo del alcance de la sección 3.1, instalación en sitio, capacitación por rol, manual de usuario y una semana de acompañamiento en piloto |
| **No incluye** | Tablet, computadora de escritorio, UPS, router o repetidores, impresora térmica |
| **Garantía** | 30 días de corrección de errores sin costo, contados desde la entrega final |
| **Soporte posterior** | A convenir aparte. Se recomienda un esquema mensual de mantenimiento. |
| **Cambios de alcance** | Cualquier funcionalidad no listada en la sección 3.1 se cotiza por separado |
| **Propiedad del código** | A definir con el cliente |

---

## 14. Anexo A — Menú provisional cargado

Se transcribieron **7 fotografías del menú publicadas en Google Maps** y se convirtieron en datos de carga inicial (archivo `menu-seed.json`), listos para poblar la base de datos desde el primer día de desarrollo.

**Resumen de lo transcrito:**

| Categoría | Productos |
|---|---|
| Bocas | 16 |
| Platos fuertes | 14 |
| Arroces | 4 |
| Comidas rápidas | 8 |
| Fuentes | 3 |
| Menú infantil | 6 |
| Bebidas calientes | 7 |
| Batidos | 7 |
| Refrescos, cervezas y vinos | 11 (sin precio) |
| Extras | 5 |
| Dulce | 2 |
| Envases | 1 (₡200, confirmado) |
| **Total** | **84 productos** |

**Advertencias sobre estos datos:**

- Las fotos muestran **dos versiones distintas del menú** (marzo 2025 y agosto 2026). Se cargaron los precios de la versión nueva; los viejos quedaron guardados solo como referencia histórica. Los aumentos van del 8% al 40% según el platillo.
- Los **18** productos con rango de precio del tipo "3500-4500" se modelaron como dos variantes con etiquetas supuestas.
- Las 11 bebidas alcohólicas y refrescos entran **desactivados** por no tener precio: el sistema no permite venderlos hasta que se les cargue uno.
- El envase **no aparece en el menú fotografiado**; se creó como producto propio a **₡200**, ya confirmado por la dueña.

Todo lo marcado como provisional se corrige en la fase 0 con el menú oficial. Sirve para que el desarrollo arranque hoy en lugar de esperar.

---

*Documento preparado el 6 de agosto de 2026. Sujeto a revisión conjunta con la dueña del restaurante antes de iniciar el desarrollo.*
