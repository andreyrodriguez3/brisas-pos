# Manual de administración

Para la dueña. Se entra desde cualquier dispositivo con tu usuario y PIN.

---

## Menú

Acá se cambia lo que se vende y a cuánto.

### Cambiar un precio

Productos → tocá el producto → cambiá el precio → **Guardar**.

> **Las cuentas que ya están abiertas no cambian.** El precio se congela cuando la mesera manda el pedido. Si subís un precio a las 3 de la tarde, la mesa que está comiendo paga el de antes. Es a propósito.

### Un producto que se acabó hoy

Marcá **Agotado**. Desaparece de los celulares al instante, pero **no se borra**. Al abrir el turno del día siguiente vuelve solo.

### Un producto que ya no se vende

**Desactivar**. Tampoco se borra: las cuentas viejas que lo tienen se siguen viendo bien.

### Los tamaños

18 platillos tienen dos precios (por ejemplo 3.500 y 4.500). Están cargados como **"Pequeño"** y **"Grande"**, pero esos nombres **los inventamos nosotros** leyendo las fotos del menú.

Hay que corregirlos con los nombres de verdad. Si cambiás la etiqueta de una que ya existe, se **renombra** y las cuentas viejas siguen bien.

### Bebidas sin precio

11 bebidas están desactivadas porque en las fotos del menú no tenían precio. **No se pueden vender hasta que les cargues uno.** Poneles el precio y activalas.

---

## Usuarias

Alta de una mesera nueva: nombre, rol, PIN de 4 dígitos y **color**.

El color es el que la identifica en todo el sistema. **No se puede repetir entre meseras activas** — el sistema no te deja.

Cuando alguien se va: **Desactivar**. No se borra, para que sus ventas de meses anteriores sigan estando.

---

## Reportes

Elegí el rango: hoy, últimos 7 días, últimos 30, o las fechas que quieras.

| Reporte | Para qué |
|---|---|
| **Salón / Para llevar / Envases** | Las tres bolsas por separado. La de para llevar es tu cuenta aparte |
| **Por día** | Cómo viene la semana |
| **Por mesera** | Solo ventas de salón, que es lo atribuible |
| **Por platillo** | Qué se vende de verdad y qué no. Sirve para decidir qué sacar del menú |
| **Por forma de pago** | Para cuadrar contra el datáfono |

Todo sale de las cuentas **ya cobradas**.

### Las tres bolsas

Son independientes y nunca se mezclan:

- **Salón** — todo lo de las cuentas que se sentaron a comer. Es lo que se le atribuye a las meseras.
- **Para llevar** — todo lo de las cuentas que desde el inicio eran para recoger. Tu cuenta aparte.
- **Envases** — los ₡200 de plástico, vengan de donde vengan. Recuperación de empaque.

> Si un cliente del salón se lleva lo que le sobró, esa comida **sigue siendo venta de salón**. Solo se suman ₡200 a envases. La comida no cambia de bolsa nunca.

---

## Bitácora de auditoría

Todo lo que pasó en el sistema, con quién lo hizo y cuándo. Filtrable por usuaria, tipo de acción y fechas.

Sirve para responder preguntas concretas: quién anuló esa cuenta, quién dio ese descuento, quién cambió ese precio.

**No se puede editar ni borrar nada.** Ni vos. Es a propósito: una bitácora que se puede tocar no sirve para resolver una discusión.

---

## Configuración

| Clave | Qué controla |
|---|---|
| `REGLA_REPARTO` | Cuál de los tres repartos manda |
| `PRECIO_ENVASE` | Los ₡200 del plástico |
| `MIN_ALERTA_COCINA` | A los cuántos minutos la comanda se pone naranja |
| `MIN_URGENTE_COCINA` | A los cuántos se pone roja |
| `PRECIOS_INCLUYEN_IMPUESTOS` | Los precios ya traen IVA y servicio. Hoy el sistema no calcula impuestos |

### Sobre el reparto entre meseras

Quedó una pregunta sin responder: **cuando hay dos o más meseras al mismo tiempo, ¿cada una se queda con lo de sus mesas, o se junta todo y se divide?**

Con una sola mesera no hay duda: todo es de ella.

El sistema arranca con **"cada quien lo suyo"** (`ATRIBUCION`), pero **el cierre te muestra las tres opciones lado a lado, todos los días**. Mirá unos cierres reales y decidí viendo números. Cambiar de regla es tocar esta fila, y los cierres viejos siguen siendo válidos porque guardan las horas y las ventas crudas.

---

## Lo que el sistema NO hace

Conviene tenerlo claro:

- **No cobra.** Calcula el monto; el datáfono y el SINPE siguen igual que siempre.
- **No factura a Hacienda.** La facturación sigue como hasta hoy.
- No maneja inventario ni recetas.
- No tiene reservaciones ni sitio web.
- No funciona desde fuera del restaurante. Vive en la red de aquí, por diseño.

---

## Cuidados

1. **La computadora de la caja no se apaga durante el servicio.** Es el corazón del sistema.
2. **La llave USB se queda conectada.** Ahí van los respaldos.
3. **El respaldo corre solo cada noche.** Si cambiás de computadora, hay que volver a programarlo.
4. Si se va la luz seguido, una **UPS** para la computadora y el router evita perder el servicio a media hora de almuerzo.
