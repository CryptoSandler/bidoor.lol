# REFERENCIA — Análisis de outbid.lol

> Documento de referencia interno. Todo lo que sigue es **descripción y análisis en mis propias
> palabras** de la mecánica y el layout de outbid.lol y outbid.lol/rules. No se copia texto,
> markup ni código del sitio original. Nuestra implementación tiene diseño, copy e identidad propios.
>
> **Nota metodológica:** en esta sesión no había un MCP de Firecrawl conectado, así que el
> relevamiento se hizo con la herramienta de fetch/extracción de contenido disponible en el harness
> (`WebFetch`), sobre `outbid.lol`, `outbid.lol/rules` y `outbid.lol/about`. El resultado es
> equivalente para el propósito (leer el DOM renderizado y describirlo); queda anotado por
> transparencia.

---

## 1. Qué es

Un leaderboard de una sola columna donde **el ranking es literalmente el precio pagado**. No hay
algoritmo, ni engagement, ni votos: pagás más, subís. Es un juego de subasta pública permanente
sobre atención. Se autodescribe como un side project sin ads, sin API keys y sin revenue sharing.

La tesis de producto es la simplicidad brutal: una sola métrica visible (plata), un solo verbo
(pujar), un solo objetivo (el #1). Eso lo hace trivialmente entendible en 3 segundos y muy
screenshoteable — que es, en la práctica, su motor de distribución.

---

## 2. Layout y jerarquía visual

De arriba hacia abajo:

1. **Nav mínima** — tres destinos: leaderboard (home), about, rules. Nada más. No hay login
   visible, no hay dashboard, no hay perfil.
2. **Barra de prueba social en vivo** — contador de gente online ahora + visitas acumuladas desde
   el lanzamiento. Es lo primero que ve el usuario y responde la pregunta implícita "¿esto lo ve
   alguien?", que es la única objeción real antes de pagar.
3. **Hero con el precio del #1** — el número grande de la página no es el nombre del producto, es
   **cuánto sale ser el primero ahora mismo**. El hero es una etiqueta de precio.
4. **Aclaración de entrada barata** — junto al precio del #1 aclara que hay un piso muy bajo
   (arranca en unos pocos dólares) y que pagar menos que el #1 igual te ubica en el board, en el
   puesto que ese monto alcance. Es la línea que evita que el precio del #1 espante al usuario
   chico: convierte un "no me da" en "entro por abajo".
5. **CTA único** — un botón para pujar, con una nota al lado que explica el caso de top-up (si ya
   estás en la lista, volvés a entrar con la misma URL/handle y subís tu monto).
6. **Sección "trending"** — un bloque aparte con las entradas de mayor *velocidad de clicks*
   (clicks/hora), no de mayor monto. Es un segundo eje de ranking, deliberadamente pequeño.
7. **Leaderboard principal** — la lista rankeada, paginada de a 50, con varios cientos de entradas.
8. **Feed de actividad reciente** — barra lateral con las últimas pujas (puesto, monto, cuándo,
   link). Genera sensación de mercado vivo y de urgencia.
9. **Footer** — crédito del autor, stack, links a reglas y a estadísticas públicas.

### Qué está haciendo bien esa jerarquía

- El **precio del #1 arriba de todo** hace que el sitio se lea como un mercado, no como un
  directorio.
- **Trending por clicks separado del ranking por plata** resuelve una tensión real: el que paga
  quiere estar arriba, pero el que mira quiere ver lo interesante. En vez de mezclar las dos señales
  en un score compuesto (que sería opaco e imposible de explicar), las muestra en dos módulos
  distintos. El ranking sigue siendo 100% explicable.
- El **feed de actividad** es lo que convierte una lista estática en algo que da ganas de refrescar.

---

## 3. Anatomía de una fila

Cada fila del leaderboard muestra, en este orden de peso visual:

| Elemento | Rol |
|---|---|
| **Número de rank** (`#1`, `#2`, …) | El premio. Es lo que se compra. |
| **Avatar / iniciales** | Identidad visual barata; no requiere que el usuario suba un logo. |
| **Nombre de la entrada** (clickeable, va al link) | La identidad de cara al público. |
| **Monto pujado** en dólares | La justificación del puesto. Es la segunda cosa más grande de la fila. |
| **Descripción corta** | Una línea de copy libre del que puja. |
| **Antigüedad** ("hace 25 minutos") | Prueba de que la lista se mueve. |
| **Contador de clicks** | El ROI declarado: "esto es lo que te llevás por tu plata". |
| **Botón "reclamar este puesto por $X"** | **Clave.** Cada fila lleva su propio precio de ataque. |

### El detalle que más me importa

El botón de puja **por fila** es el mecanismo más inteligente del diseño. No hay un solo CTA
global "pujá": hay N CTAs, cada uno con un precio concreto y alcanzable. El usuario no tiene que
calcular nada ni elegir un monto en abstracto — mira la lista, encuentra el puesto que le cierra
por precio, y ese botón le dice exactamente cuánto cuesta. Convierte una decisión abierta (¿cuánto
pago?) en una decisión cerrada (¿pago esto sí o no?), que convierte muchísimo mejor.

Es, además, lo que hace que la lista larga tenga sentido comercial: la fila #300 no es relleno, es
un producto de entrada barato con su propio precio impreso.

---

## 4. Flujo de puja

1. El usuario toca el CTA global o el botón de una fila específica.
2. Ingresa el identificador de la entrada: una URL de producto o un handle de X.
3. Ingresa el monto (dólares enteros, con piso y techo, y granularidad de $1).
4. Paga. **El pago completado es lo que reclama el puesto** — no hay reserva, no hay "pendiente".
5. La entrada queda pública y los clicks van al destino que cargó, ya normalizado.

### Reglas de la mecánica

- **Piso bajo y techo alto**, montos en dólares enteros, incrementos de $1.
- Para tomar el **#1** hay que superar al líder por un margen mínimo (no alcanza con +$1); los
  demás puestos se toman con el incremento chico. Esto protege la cima de guerras de centavos y
  hace que la posición más valiosa tenga fricción propia.
- **Empates se resuelven por antigüedad**: el que llegó primero a ese monto conserva el puesto más
  alto. Regla necesaria y barata; sin esto, el orden entre iguales sería arbitrario y discutible.
- **Re-listar la misma entrada es un top-up**: se paga solo la diferencia hasta el monto nuevo, no
  el monto entero de nuevo. La entrada no se duplica.
- **Nadie puede robarte el puesto pagando solo tu diferencia**: quien viene de afuera paga el monto
  completo. Esta asimetría es deliberada y protege al que ya invirtió.

---

## 5. Las reglas de links — qué problema resuelve cada una

Esta es la parte más valiosa para nosotros, porque es todo cicatriz de abuso real. Cada regla es la
respuesta a un ataque concreto.

### 5.1 Dedupe / identidad de la entrada

**Regla:** una entrada se identifica por su destino normalizado. Volver a entrar con el mismo
destino suma al monto existente en vez de crear una fila nueva.

**Problema que resuelve:** sin esto, el leaderboard se llena de la misma marca repetida en 8
puestos, cada uno con un monto chico. Se rompe la legibilidad (la lista deja de ser un ranking de
proyectos y pasa a ser un ranking de pujas) y se rompe el incentivo económico: es más barato ocupar
los puestos #10 a #17 con montos chicos que pelear el #1. El dedupe fuerza a que la plata se
concentre y la competencia sea vertical.

**Sub-regla fina:** para plataformas que hostean muchas cosas distintas bajo un mismo dominio
(stores de apps, repos de código y similares), la clave incluye el **path**, no solo el host. Sin
eso, dos apps distintas del mismo store colisionarían en una sola entrada. Es el caso borde
correcto: el dedupe tiene que ser por *identidad del proyecto*, no por dominio.

### 5.2 Query params: se eliminan siempre

**Regla:** los parámetros de query se strippean del link. Los links de afiliado, referral y
tracking no funcionan.

**Problema que resuelve:** tres a la vez.
1. **Evasión del dedupe.** `sitio.com?a=1` y `sitio.com?a=2` son la misma página pero URLs
   distintas. Sin normalizar, el query param es el bypass trivial de la regla 5.1.
2. **Parasitismo de afiliados.** Sin esto, cualquiera puede pujar por un producto que no es suyo
   con su código de referido pegado y monetizar el tráfico del leaderboard.
3. **Fuga de datos / redirect chains.** Los params de tracking mandan información del visitante a
   terceros que el sitio no controla.

### 5.3 Acortadores: prohibidos, y se resuelven

**Regla:** no se aceptan URLs de acortadores. Si mandás una, se reemplaza por el destino final al
que redirige.

**Problema que resuelve:** un acortador es un **destino mutable**. Es el agujero de seguridad más
grande de un sistema como este: pagás la moderación una vez con un link limpio, y después el dueño
del shortlink lo repunta a un drainer, a porno o a malware, sin volver a pasar por ninguna
revisión. Además rompe el dedupe (infinitos shortlinks → un mismo destino) y esconde el destino del
usuario que clickea.

Que la política sea **resolver y reemplazar** en vez de simplemente rechazar es la decisión
correcta: no castiga al usuario honesto que pegó un link acortado sin pensar, y deja el sistema en
un estado donde lo que está guardado es siempre el destino real e inmutable.

### 5.4 Links de chat e invitaciones: prohibidos

**Regla:** nada de invitaciones a grupos de mensajería (Telegram, Discord, WhatsApp, Signal y
similares).

**Problema que resuelve:** una invitación a un grupo privado es **contenido no auditable**. El link
es limpio, el grupo del otro lado no. Es el vector estándar de scams, pump groups y reclutamiento;
y ni la moderación ni los usuarios pueden ver qué hay adentro antes de entrar. También es contenido
efímero (el invite se revoca o el grupo se recicla), lo cual choca con un ranking que es permanente
y pagado.

### 5.5 Contenido adulto: prohibido

**Regla:** nada de porno, NSFW ni plataformas adultas.

**Problema que resuelve:** menos moral que operativo. Es un leaderboard que se comparte por
screenshot y que vive de procesadores de pago; ambos canales (redes sociales y payment providers)
tienen políticas que hacen que una sola entrada adulta en el #1 pueda costar el sitio entero.

### 5.6 El pago es el que reclama el puesto

**Regla:** el rank se otorga con el pago **completado**, no con el intento.

**Problema que resuelve:** evita el squatting gratis. Sin esto, cualquiera reserva el #1, saca el
screenshot, y abandona el checkout. Es también la razón por la que no puede haber estado
"pendiente" visible en el board.

---

## 6. Lecturas para nuestro producto

Qué me llevo, y qué cambia por ser tokens y no productos:

1. **El precio del #1 arriba de todo.** Es el hero correcto.
2. **Botón de puja por fila con precio impreso.** Lo adoptamos: es lo que hace convertir a la cola
   larga de la lista.
3. **Identidad de la entrada = clave canónica, no nombre.** Ellos usan URL normalizada. Nosotros
   tenemos algo mucho mejor: el **contract address**. Es criptográficamente único, inmutable, y no
   tiene el problema de normalización de URLs. El dedupe por contract es más fuerte que cualquier
   dedupe por link — y encima resuelve el caso que ellos no pueden resolver: dos tokens con el mismo
   nombre son dos entradas distintas, y el mismo token con nombre cambiado sigue siendo una.
4. **Toda la familia de reglas de links sigue aplicando**, pero desplazada: en nuestro caso los
   links (launchpad y sociales) no son la identidad de la entrada, son **metadata verificable**. Eso
   nos permite ser más duros: podemos exigir que el dominio del launchpad sea coherente con la
   chain, cosa que ellos no tienen forma de chequear porque no tienen un dominio "esperado".
5. **La chain es un eje que ellos no tienen.** Decidimos no seccionar la lista por chain: una sola
   competencia global con badge de chain por fila. Seccionar mataría el efecto screenshot (el top 3
   dejaría de ser *el* top 3) y fragmentaría la puja en 8 subastas chicas en vez de una grande.
6. **Empate por antigüedad y top-up por diferencia**: los copiamos tal cual, son reglas correctas y
   baratas.
7. **Trending por clicks separado del ranking por plata.** Buena idea, pero no en el MVP: agrega un
   segundo eje antes de que exista tráfico real que medir.
