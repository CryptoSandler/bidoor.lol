# DECISIONES — Lectura crítica del diseño

Documento en español, como acordamos. Todo el texto de la web está en inglés.

Esto no es un changelog: es mi lectura de qué construimos, qué decidí yo por mi cuenta, qué le
falta, y qué puede salir mal. Va ordenado por lo que más me preocupa.

---

## 1. Decisiones que tomé yo durante el build

Todas son reversibles y ninguna cambia las reglas que definiste. Las listo para que puedas
discutirlas una por una.

| # | Decisión | Por qué | Dónde |
|---|---|---|---|
| 1 | **Nombre de producto: BIDOOR** | Pediste identidad propia. "Tape" es jerga de trading para el feed de precios, y el producto es literalmente un ticker de plata. No arrastra la marca de ellos. | `src/app/layout.tsx` |
| 2 | **Botón de puja por fila, con el precio impreso** | Lo mejor del diseño original (ver REFERENCIA §3). Convierte "¿cuánto pago?" en "¿pago esto?". Es lo que le da valor comercial a la cola larga de la lista. | `src/components/BoardRow.tsx` |
| 3 | **El hero es el precio del #1, no un slogan** | El sitio tiene que leerse como un mercado en 2 segundos, sobre todo en screenshot. | `src/app/page.tsx` |
| 4 | ~~**Tomar el #1 cuesta +$5; cualquier otro puesto +$1**~~ **(revertida — ver §24)** | Sin margen extra, la posición más valiosa del board es la más barata de disputar y el #1 rota todo el día por un dólar. | `src/lib/config.ts` |
| 5 | **Empate resuelto por antigüedad** | Sin esto el orden entre iguales es arbitrario y un puesto que alguien pagó se movería solo. | `src/lib/ranking.ts` |
| 6 | **El top-up refresca la metadata** (nombre, ticker, links) | Un proyecto que rebrandea o que cargó un link roto no debería tener que crear una segunda entrada — que además la regla de dedupe le prohíbe. | `src/lib/store.ts` |
| 7 | **La clave de dedupe es `chain:address`, no `address`** | La misma address existe en varias EVM y son tokens distintos. Sin el scope, un token de Base y uno de BNB colisionarían. | `src/lib/validation.ts` |
| 8 | **TON bounceable (`EQ…`) y non-bounceable (`UQ…`) colapsan a una sola entrada** | Son la misma cuenta con distinto tag byte. Sin esto, TON es la única chain donde el dedupe se evade pegando la otra forma de tu propia address. Decodifico y uso `workchain:hash` como clave. | `src/lib/addresses.ts` |
| 9 | **Los links de chat se bloquean por campo, no globalmente** | `t.me` no vale como launchpad ni como website, pero sí en el campo Telegram. Prohibirlo global rompería los sociales legítimos. | `src/lib/links.ts` |
| 10 | **Bloqueé también link-in-bio** (linktr.ee, beacons.ai, bio.link) | Tienen exactamente el mismo problema que un acortador: destino mutable después de la revisión. No estaban en tu lista pero son el mismo ataque. | `src/lib/links.ts` |
| 11 | **Los acortadores se rechazan, no se resuelven** | Ellos resuelven y reemplazan. Resolver requiere que nuestro servidor haga un request saliente a una URL que controla un tercero — SSRF, y además nos convierte en su proxy. En un producto con pagos prefiero rechazar y explicar. Es más fricción y peor UX: vale la pena discutirlo. | `src/lib/links.ts` |
| 12 | **`/go/[id]` cuenta el click y redirige sin referrer** | Hace real la promesa de "los clicks van al destino sin parámetros". | `src/app/go/[id]/route.ts` |
| 13 | **Las bids se guardan como eventos con fecha, no como un total** | Es el requisito para poder prender decaimiento después. Un total acumulado tira la información y no se puede reconstruir. | `src/lib/types.ts` |
| 14 | **El monto del formulario NO viene precargado con el precio del #1** | Lo tenía así y quedaba como un muro de pago. Ahora solo se precarga si entraste tocando un puesto concreto. | `src/app/bid/page.tsx` |
| 15 | **Tests reales, no humo** | 60 tests unitarios más un chequeo de layout con browser que verifica el requisito del top 3. Ver §6. | `src/lib/__tests__/`, `scripts/` |
| 16 | **README en inglés** | Interpreté "todo lo visible de la web" como la UI. El README es cara pública del repo en un proyecto cripto global. Si preferís español, es un archivo. | `README.md` |

---

## 2. Lo que descubrí construyendo (y que cambia el diseño)

Tres cosas que no eran obvias desde el brief y que aparecieron al escribir la validación de verdad.

### 2.1 La validación de formato NO puede probar que el token existe

Este es el hallazgo importante. **Una address de Solana a la que le falta un solo carácter sigue
decodificando a 32 bytes válidos y pasa toda la validación.** Lo verifiqué: base58 es denso, y
`valor / 58` sigue entrando en 32 bytes. Hay un test que documenta exactamente esto
(`addresses.test.ts`, "cannot catch a single-character truncation").

Consecuencia directa: **hoy alguien puede pagar y rankear una address que no existe.** No es un
ataque, es un typo — y el que lo comete pagó. Cuando haya pagos reales esto es un reembolso
garantizado y un ticket de soporte.

Lo mismo, en menor grado: no verifico el checksum EIP-55 de las EVM (requiere keccak256, es una
dependencia) ni el base58check de TRON. Ambos son baratos de agregar; la truncación de Solana no se
arregla con nada que no sea consultar la chain.

> **RESUELTO.** Se implementó exactamente eso: `src/lib/dexscreener.ts` resuelve la address contra
> la API pública de DexScreener antes de aceptar la puja. Si ningún DEX la conoce, se rechaza con
> "Token not found on any DEX". El test que documentaba el límite sigue ahí a propósito, para dejar
> constancia de por qué la validación de formato **sola** nunca alcanzó.

### 2.2 El allowlist de launchpads es la regla más frágil que tenemos — SUPERADO en §10

La regla "el dominio del launchpad tiene que ser coherente con la chain" es correcta y la
implementé, pero descansa en una lista que **envejece sola**. Sale un launchpad nuevo en Solana
todos los meses. Cada vez que eso pasa, el producto rechaza pujas legítimas y el que puja no
entiende por qué.

Sobre **Robinhood Chain**: se verificaron los dominios candidatos uno por uno. `hood.fun` está vivo
y es un launchpad de memecoins real en esa chain — quedó en el allowlist. "RobinPad" **no** entró:
el nombre lo usan al menos tres productos distintos y ninguno tiene un dominio oficial verificable
(`robinpad.xyz` se autodescribe "demo software" con cero lanzamientos; `rpad.fun` no tiene contenido
verificable; `robinpad.fi` devuelve HTTP 402, probablemente parkeado). Los candidatos quedaron
documentados en `chains.ts` para que agregarlo sea una línea cuando producto confirme cuál es.

> Meter un dominio sin verificar en una lista que el producto presenta como "launchpads oficiales"
> es exactamente el daño que la regla existe para evitar.

> **Recomendación:** que el allowlist sea configuración editable por ops (no un deploy), con una
> vía de escape explícita: "¿lanzaste en otro lado? Mandanos el link" y revisión manual. Ya está el
> copy puesto en la página de reglas, pero no hay flujo detrás.

### 2.3 Nadie verifica que el que puja tenga algo que ver con el token

Cualquiera puede listar cualquier token. Es una decisión de producto legítima (outbid.lol tampoco
verifica) y además es parte de la gracia: alguien puede pujar por un token del que es holder. Pero
tiene consecuencias que hay que aceptar explícitamente:

- Un competidor puede listar tu token con links a un sitio que no controlás.
- Un scammer puede listar un token legítimo con su propio link de "sitio oficial".
- ~~El top-up refresca la metadata, así que el que paga último controla el nombre y los links.~~
  **Corregido:** la metadata ya no la escribe nadie que pague. Ver §4.1.

**Esto último era un bug de diseño, y está corregido.** Ver §4.1.

---

## 3. Qué le falta

En orden de importancia.

1. **Verificación on-chain de la address.** §2.1. Es lo primero.
2. **Un flujo de moderación.** Hoy no hay forma de bajar una entrada. Un token que se revela como
   rug queda en el board, pago, para siempre. Hace falta: estado `hidden`/`removed`, un motivo, una
   política de reembolso, y un log de quién lo hizo.
3. **Un mecanismo de reportes.** Sin un botón de "reportar", la moderación se entera por Twitter.
4. **Persistencia.** Hoy es un `Map` en memoria: se reinicia el proceso y desaparece el board. Es
   deliberado (pediste mock) pero es lo primero que hay que cambiar.
5. **Rate limiting y anti-bot en el POST.** El endpoint no tiene ninguno. Sin pagos es un
   defacement gratis del board.
6. **Paginación.** 17 entradas mock andan; 600 no. Ellos paginan de a 50.
7. **Feed de actividad reciente.** Es lo que hace que el board se sienta vivo y da ganas de volver.
   Barato de hacer, ya tenemos los eventos de bid con fecha.
8. **Página de detalle por token.** Hoy la fila linkea al launchpad. Una página propia con el
   historial de pujas es contenido indexable y una razón para compartir un token puntual.
9. **Open Graph images.** El producto se comparte por link en X y Telegram. Que la preview muestre
   el top 3 renderizado es, probablemente, el mayor multiplicador de distribución que hay acá — y no
   está hecho.
10. **Logos de verdad.** Hay campo `logoUrl` pero se cargan a mano por URL. Con el lookup on-chain
    (§2.1) vienen gratis. Además hoy un logo es un `<img>` a un dominio arbitrario: hay que
    proxearlo o se convierte en un beacon de tracking sobre nuestros visitantes.

## Qué sacaría

- **El campo Discord.** Es el link social que menos se usa en tokens y suma una regla más que
  mantener. X y Telegram cubren el 95%.
- **El campo logo por URL,** cuando exista el lookup on-chain. Es un vector de tracking a cambio de
  poco.
- **El contador de clicks en la fila, si no lo vamos a defender.** Es la métrica de ROI del que
  paga, así que va a ser inflada con bots el día uno. O lo hacemos serio (dedupe por IP, filtro de
  bots) o lo sacamos: un número de ROI que todos saben que es mentira es peor que ningún número.

---

## 4. Riesgos

### 4.1 Abuso de la mecánica de puja

**Secuestro de metadata por $1 — RESUELTO.** Era el riesgo más grave: como el top-up refrescaba
nombre y links y el mínimo era $1, cualquiera podía pagar un dólar sobre la entrada #1 y cambiarle
el sitio oficial.

El fix no fue el que había propuesto (permisos por participación), sino uno mejor: **sacarle el
campo al pagador**. Nombre, ticker, logo y sociales se leen de DexScreener por contract address y se
refrescan de esa misma fuente en cada top-up. No hay nada que secuestrar porque no hay nada que
escribir. Como efecto lateral, un rebrand del token sigue a la entrada solo.

El único campo que el pagador aporta es el **link de launchpad**, y se congela con la primera puja:
los top-ups no lo tocan. Hay test que lo prueba (`store.test.ts`, "freezes the launchpad link").

**El riesgo que queda, desplazado un nivel.** DexScreener refleja lo que está on-chain, y cualquiera
puede deployar un token con el nombre y el logo que quiera. Sacamos el control de manos del
*pujador*, no del *deployer*. Un token puede llamarse igual que otro y usar su logo — el dedupe por
contrato hace que sean filas distintas, pero visualmente se puede suplantar. Es el mismo problema
que tiene cualquier DEX y no lo resuelve nadie sin una lista curada de tokens verificados.

**Guerra de centavos en el #1.** Mitigado con el margen de $5, pero $5 sobre un board de $10.000 no
es margen. Debería ser **porcentual** (ej. +2% del líder, con piso de $5), no un monto fijo.

**Sniping del último segundo.** No aplica hoy porque el ranking es permanente y no hay cierre. Si
alguna vez agregamos "top 3 de la semana", aparece.

**El decaimiento cambia el trato a posteriori.** Está diseñado y apagado a propósito. Prenderlo
después de que la gente pagó es cambiar las reglas del juego con plata adentro. Si lo vamos a
prender, se anuncia antes y se aplica solo a bids nuevas, o se anuncia desde el día uno.

**Wash bidding.** Con pagos reales, alguien puede pujar por su propio token para simular tracción.
Es caro y va a nuestro favor económicamente, así que lo dejaría — pero hay que saber que el board
mide plata, no interés.

### 4.2 Scams y responsabilidad

Este es el riesgo real del producto, y es cualitativamente distinto al de outbid.lol: **ellos
rankean productos, nosotros rankeamos tokens.** Un token en el #1 de un leaderboard tiene una
lectura implícita de legitimidad que un SaaS no tiene, y el daño de equivocarse es que alguien
pierde plata.

- Un rug puede comprar el #1 el día del lanzamiento. Es, de hecho, el mejor uso posible del
  producto desde la óptica del scammer: el gasto es marketing y lo recupera.
- La página de reglas ya dice explícitamente que un rank es prueba de pago y nada más, y el footer
  lo repite. Es necesario pero no suficiente.
- **Riesgo de plataforma:** los procesadores de pago tienen apetito muy bajo por "promoción pagada
  de tokens cripto". Esto puede terminar el producto de un día para el otro. Hay que validarlo con
  el procesador **antes** de construir el checkout, no después.

### 4.3 Spam y calidad del board

- Sin verificación on-chain, listar basura cuesta $5 y un typo.
- El piso de $5 es el único filtro anti-spam que tenemos. Es razonable, pero significa que la cola
  del board va a ser mayormente ruido. Habría que decidir si el board muestra todo o corta en el
  top N.

### 4.4 Edge cases que ya están cubiertos (con test)

- Address que no existe en ningún DEX → rechazada, no se crea entrada.
- DexScreener caído → la puja falla explícita; nunca se crea una fila sin nombre.
- Top-up que intenta repuntar el link de launchpad → ignorado, se conserva el original.
- Token consultado que aparece solo como `quoteToken` → rechazado en vez de listar el token errado.

- Address EVM enviada como Solana, y al revés → rechazado.
- La misma address en dos chains → dos entradas distintas.
- Misma address EVM en distinto casing → una sola entrada.
- TON `EQ…` y `UQ…` → una sola entrada.
- pump.fun declarado en BNB → rechazado, nombrando los launchpads válidos.
- Acortador apuntando a un launchpad válido → rechazado.
- Query params de tracking → strippeados, y la UI te dice cuáles sacó.
- `twitter.com/x` y `x.com/x` → una sola identidad.
- Puja con nombre distinto sobre un contrato ya listado → suma, no duplica.
- Montos fraccionarios o negativos → rechazados.

### 4.5 Edge cases NO cubiertos

- ~~Truncación de un carácter en Solana~~ — ya no importa: si la address no existe, DexScreener no
  la conoce y la puja se rechaza. La verificación de existencia dejó obsoleto el problema.
- Checksum EIP-55 y base58check de TRON (siguen sin verificarse, y siguen sin importar por lo mismo).
- **Nuevo, encontrado construyendo:** DexScreener devuelve *pares*, y el token consultado no siempre
  es el `baseToken` del par. Consultando WHYPE, el par que vuelve tiene USDC como base. Leer
  `baseToken` a ciegas listaba el token equivocado con nombre y logo ajenos. Se filtra por chain
  **y** por coincidencia de `baseToken.address`. Hay test.
- **Nuevo:** el chain id de DexScreener no es el nuestro. Hyperliquid es `hyperevm` y BNB es `bsc`.
  Equivocarse ahí no da error: devuelve vacío para siempre. Hay test que lo fija.
- **Nuevo:** los `imageUrl` del CDN de DexScreener *necesitan* su query string (traen el sizing), así
  que el logo no puede pasar por el normalizador que strippea params. Va por una validación aparte
  que además solo acepta el CDN de DexScreener, para no servirle a nuestros visitantes una imagen
  desde un dominio de un tercero.
- Homoglyphs / Unicode en el nombre del token (se puede escribir un nombre que se ve idéntico a
  otro). El dedupe por contrato lo hace menos grave, pero visualmente se puede suplantar.
- Nombres con RTL override o zero-width chars.
- Un token que hace migración de contrato: es una entrada nueva y pierde todo lo pagado. No hay
  flujo de "merge".
- Concurrencia: dos pujas simultáneas sobre la misma entrada. En memoria no pasa nada; con una base
  de datos hay que hacerlo transaccional o se pierde una.

---

## 5. Preguntas de producto a responder antes de conectar pagos

Las que bloquean.

1. **¿Fiat o cripto?** Cambia todo: el procesador, el KYC, la exposición regulatoria, y si podemos
   reembolsar. Cripto es lo natural para la audiencia y evita el riesgo de §4.2, pero los
   reembolsos dejan de ser automáticos.
2. **¿Hay reembolsos?** Caso concreto y garantizado: alguien paga con un typo en la address (§2.1).
   ¿Devolvemos? ¿Damos crédito? ¿Nada? Tiene que estar escrito en las reglas antes del primer pago.
3. ~~**¿Quién controla la metadata de una entrada?**~~ **Respondida:** nadie que pague. La fuente es
   DexScreener. Queda una pregunta más chica detrás: ¿qué hacemos si DexScreener tiene mal el
   nombre de un token, o si un proyecto pide corregirlo? Hoy no hay override manual.
4. **¿Bajamos entradas, y en qué casos?** Si bajamos un token que pagó $10.000 por rug, ¿devolvemos?
   Si no bajamos nada, hay que poder sostenerlo públicamente.
5. **¿El margen del #1 es fijo o porcentual?** §4.1.
6. **¿Prendemos decaimiento, y lo anunciamos desde el día uno?** Está construido para soportarlo,
   pero es una promesa que solo se puede hacer una vez.
7. ~~**¿Qué pasa con Robinhood Chain?**~~ **Resuelta parcialmente:** soportada con `hood.fun`.
   Falta decidir si "RobinPad" entra y con qué dominio (§2.2).
8. **¿Hay cuentas?** Hoy no hay login. Sin identidad no hay "mis entradas", ni recuperación, ni
   forma de resolver una disputa de propiedad. Con login, hay fricción antes de pagar.
9. **¿Cuál es el precio piso real?** $5 es lo que copiamos de ellos, pensado para productos. Para
   tokens, con un CAC de atención mucho más alto, quizás el piso correcto es otro.
10. **¿El board muestra todo o corta?** §4.3.

---

## 6. Estado de la verificación

No es una lista de intenciones: esto corre.

- **60 tests unitarios** (`npm test`) sobre base58, validación de address por chain, higiene de
  links, reglas de puja, dedupe/top-up, integridad del seed y el modelo de decaimiento.
  Incluye un test que documenta el límite de §2.1 en vez de esconderlo.
- **Chequeo de layout con browser real** (`npm run check:layout`): verifica en iPhone SE, iPhone 14
  y Pixel 7 que el top 3 entra completo sin scroll y que no hay overflow horizontal. Pasa en las
  tres con 237px de sobra en el caso más chico.
- **Flujo end-to-end probado en browser** durante el build: rechazo de pump.fun en BNB, rechazo de
  address EVM bajo Solana, aviso en vivo de "ya está listado", top-up que suma sin duplicar fila,
  strippeo de `utm_source` y `ref` reportado al usuario, y alta nueva al piso de $5.
- `npm run build` y `npm run lint` limpios.

**Dos bugs que encontré y arreglé durante la verificación**, ambos solo visibles corriéndolo:
el recibo decía "Moved up from #1" cuando el líder hacía top-up y no se movía; y el formulario
venía precargado con el precio del #1 aunque entraras por el CTA genérico, lo que lo hacía leer
como un muro de pago.

---

## 7. Tanda 2 — metadata canónica y rediseño

Decisiones nuevas, mismo criterio que la tabla de §1.

| # | Decisión | Por qué |
|---|---|---|
| 17 | **Endpoint chain-scoped de DexScreener primero, cross-chain como fallback** | El cross-chain mezcla chains (PEPE devuelve pares de Ethereum y PulseChain juntos) y no sirve para probar en qué chain vive el token. El scoped sí, pero devuelve un solo par y a veces con nuestro token del lado quote — de ahí el fallback. |
| 18 | **Los sociales de DexScreener igual pasan por nuestras reglas de links** | DexScreener es fuente confiable de *cuáles* links son de un token, no de si son links que aceptamos. Un social que falla se descarta; nunca tumba la puja. |
| 19 | **El logo solo se acepta del CDN de DexScreener** | Un `<img>` a un dominio arbitrario es un beacon de tracking sobre todos nuestros visitantes. Si el logo viene de otro lado, se cae al fallback de iniciales. |
| 20 | **Cache de 60s, y los errores transitorios no se cachean** | Un timeout no debe quedar recordado como "este token no existe". |
| 21 | **El seed usa addresses reales con snapshot capturado** | El board arranca sin red pero muestra metadata real. `scripts/generate-seed.mts` lo regenera con el mismo resolver que usa el path de puja en vivo. Los montos y clicks son inventados y está dicho en el archivo. |
| 22 | **Tema claro cálido por defecto** | Es lo que usa la referencia, y era la mitad de la distancia visual. La paleta no tiene un solo gris neutro. |
| 23 | **DM Sans + Geist Mono** | Son las dos que usa la referencia y **las dos son gratis** (Google Fonts). No hizo falta buscar sustituto. |
| 24 | **Acento propio: persimmon `#e8502d`, no su coral `#e57255`** | Misma familia cálida, marca distinta. Más el dorado del #1 y el sistema de color por chain, que ellos no tienen porque no tienen chains. |
| 25 | **Un solo archivo de tokens (`src/app/tokens.css`)** | Ningún color ni tamaño hardcodeado en componentes, ni siquiera las densidades de fila o el ancho del contenedor. El re-skin futuro es editar ese archivo. |
| 26 | **Clase `.money` en sans, separada de `.num` en mono** | Geist Mono pone la coma en un avance tan ancho que `$8,750` se lee `$8 , 750`. Las cifras de dinero van en DM Sans con `tabular-nums`: alinean igual, sin el bache. |

### Bugs encontrados y corregidos en esta tanda

1. **Badge de chain ausente** — `ChainBadge` devolvía `null` cuando la chain no estaba en el
   registro, así que la fila quedaba sin badge. Ahora siempre renderiza, cayendo al id crudo, y hay
   un test que exige que toda entrada del seed pertenezca a una chain ofrecida.
2. **Contenedor angosto** — estábamos en `42rem`; la referencia usa `56rem`. Era el "espacio muerto
   a los costados".
3. **Hero ilegible** — el precio iba en mono y la coma se abría. Corregido con `.money`.
4. **Nombres truncados a una letra en mobile** — el badge de chain competía por el ancho en la línea
   del nombre. Se movió a la línea de metadata.
5. **Top 3 fuera de pantalla en iPhone SE** tras el rediseño: el hero nuevo es más alto. Se compactó
   con tokens de densidad específicos para pantallas chicas. Vuelve a pasar el chequeo.

### Lo que sigue abierto

- **No hay override manual de metadata.** Si DexScreener tiene mal un nombre, no tenemos cómo
  corregirlo.
- **Suplantación por deployer** (§4.1). Necesita lista curada para resolverse de verdad.
- **Rate limit de DexScreener.** Hay cache de 60s, pero no hay backoff ni cola. Con tráfico real
  hace falta.
- **"RobinPad"** sigue sin dominio verificado (§2.2).

---

## 8. Tanda 3 — pagos onchain

Reemplaza el mock. Un rank ahora solo existe si hay una transferencia confirmada en Solana.

### Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 27 | **`node:sqlite` en vez de una dependencia** | Node 26 lo trae incorporado. Cero dependencias nativas que compilar, y la constraint UNIQUE es real (verificado con un test que la fuerza saltándose el helper). |
| 28 | **La firma se reclama ANTES de tocar el board** | Si el orden fuera al revés, dos requests con la misma firma podrían aplicar dos veces antes de que la constraint decida. Reclamar primero hace que la base sea el árbitro. |
| 29 | **Verificar por deltas de token balance, no por instrucciones** | Una transferencia puede llegar como `transfer`, `transferChecked`, por CPI o mezclada con otras instrucciones. El delta sobre nuestra cuenta es el mismo en todos los casos y no se puede falsear con la forma de la instrucción. |
| 30 | **El mint de USDC está hardcodeado** | Es lo único que no puede ser configurable: el punto de chequear el mint es que cualquiera puede deployar un token llamado "USDC". Un env var ahí movería el ataque un nivel afuera. |
| 31 | **`PAYMENT_WALLET` sin default** | Un fallback significa que un deploy mal configurado cobra en silencio a la dirección de otro. Sin la env var, la app dice que los pagos no están configurados y no deja pujar. |
| 32 | **Se resuelve la metadata ANTES de mandar a pagar** | Fallar antes no cuesta nada; fallar después de que mandaron USDC les cuesta plata. Se vuelve a resolver al liquidar, para que el board refleje el token como está ahora y no como estaba 30 minutos antes. |
| 33 | **Una puja fallida NO se muere: se puede reintentar** | Pegar mal la firma es el error más común. Mientras la ventana siga abierta, se muestra el motivo y se puede pegar otra. |
| 34 | **La expiración se evalúa al leer, no con un job** | No hay scheduler acá, y una puja que nadie mira no necesita haber expirado todavía. |
| 35 | **Las pujas pagadas se persisten y se reaplican al arrancar** | El board sigue siendo un seed de demo, pero un pago liquidado no puede desaparecer en un restart. El seed es descartable; el pago no. |
| 36 | **Se distingue "token equivocado" de "destino equivocado"** | Al que acaba de gastar plata hay que decirle **cuál** de los dos errores cometió, no un "no se pudo verificar". |

### Lo que este diseño NO resuelve (y hay que saberlo antes de cobrarle a alguien)

1. ~~**No hay atribución del pagador.**~~ **RESUELTO** con centavos únicos. Ver §9.
2. **El RPC público es frágil.** `api.mainnet-beta.solana.com` tiene rate limits agresivos y no
   siempre sirve transacciones históricas. Con tráfico real hace falta un proveedor dedicado.
   Hay `SOLANA_RPC_URL` para eso, pero no hay reintentos ni fallback a un segundo nodo.
3. **`confirmed`, no `finalized`.** Elegimos `confirmed` porque `finalized` tarda ~13 segundos y la
   espera arruina el flujo. Es la elección correcta para este monto, pero es una elección: en teoría
   un bloque `confirmed` puede revertirse.
4. ~~**Sobrepago no se acredita ni se devuelve.**~~ Cambió: ahora el sobrepago **falla** la
   verificación en vez de acreditarse. Ver §9.
5. **No hay reconciliación.** Si el pago se confirma y DexScreener se cae justo en ese momento, el
   pago queda registrado pero la entrada no se aplica. El mensaje le dice al usuario que recargue,
   pero no hay un job que lo repare solo.
6. **No hay rate limiting** en `/api/bid` ni en el endpoint de verificación. Crear pujas pendientes
   es gratis y sin límite.

### Preguntas que esto agrega

- ~~**¿Cómo atamos un pago a un pagador?**~~ **Respondida** en §9.
- **¿Qué hacemos con un pago que llega tarde**, después de que la puja expiró? Hoy: nada, y la plata
  quedó. Es defendible pero hay que decidirlo explícitamente.
- **¿Y si mandan el monto correcto pero la puja ya la ganó otro?** El precio del puesto pudo cambiar
  en esos 30 minutos. Hoy la puja se acredita por su monto y cae donde caiga.

---

## 9. Tanda 4 — atribución por monto único

Cierra el agujero de §8.1: una transferencia que llega a nuestra wallet no dice **de quién** es.

### Cómo funciona

Cada puja pendiente recibe un monto propio: la puja más una fracción aleatoria de cuatro decimales.
Una puja de $50 se paga como `$50.0041`, y esa fracción es la identidad del pago. USDC tiene seis
decimales, así que cuatro dejan dos de margen y el número sigue siendo corto para leer y tipear.
La fracción nunca es cero — un monto redondo es justamente el único que no se puede atribuir.

El ranking sigue usando el monto redondo. La fracción es plomería y está dicho en la pantalla y en
las reglas: *"your rank is still counted as $50"*.

### Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 37 | **Índice UNIQUE parcial sobre `payment_micros WHERE status='pending'`** | La unicidad la garantiza la base, no un chequeo en código. Es parcial porque el monto solo está reservado mientras la puja está viva: pagada o expirada, se libera. |
| 38 | **Se sortea y se ofrece a la base, con reintento** | En vez de "buscar uno libre y usarlo" (que pierde contra dos requests simultáneos), se inserta y si el índice lo rechaza se sortea de nuevo. La base decide. Tope de 40 intentos para no colgarse. |
| 39 | **Barrido de expiradas antes de asignar** | El índice solo cubre `pending`, así que las pujas abandonadas retendrían su fracción para siempre. Se barren primero. |
| 40 | **La unicidad es sobre el total, no sobre la fracción** | `$50.0041` y `$100.0041` son montos distintos y ambos atribuibles. Restringir la fracción sola desperdiciaría el espacio sin ganar nada. |
| 41 | **Monto EXACTO, no `>=`** | Aceptar de más rompe lo único que ata la transferencia al pujador: `$50.0042` es la puja de otro. El sobrepago pasó de "gratis para nosotros" a error. |
| 42 | **La firma NO se consume en un pago que no matchea** | La plata es real. Consumir la firma bloquearía además el reintento legítimo. Va a `unmatched_payments`, que es la cola desde la que trabaja soporte. |
| 43 | **La firma sigue siendo UNIQUE, como candado anti-replay** | La atribución ahora es por monto + destino; la firma queda para que una transferencia no pague dos pujas. Son dos garantías distintas y las dos hacen falta. |

### Lo que esto NO resuelve

- **9.999 pujas pendientes del mismo monto base** agotan el espacio de fracciones y la creación
  falla con `PaymentAmountUnavailable`. Es un límite teórico holgado, pero es un vector de DoS
  barato: sin rate limiting, alguien puede crear pujas pendientes de $5 hasta llenar ese espacio y
  bloquear las pujas legítimas de $5. **El rate limiting pasa de "falta" a "necesario".**
- **Sigue sin haber reconciliación automática.** `unmatched_payments` se llena solo; aplicarlo es
  manual y no hay pantalla de soporte para hacerlo.
- **Un pago con el monto exacto pero mandado por un tercero** sigue siendo atribuible a esa puja. El
  monto único resuelve "¿de qué puja es este pago?", no "¿esta persona es la que pagó?". Para el
  caso de uso (comprar un puesto en un ranking) es suficiente; para un producto con cuentas, no.
- **El usuario tiene que tipear un monto raro.** Es fricción real, y la pantalla la compensa con
  copy explícito, pero un botón de copiar al portapapeles o un deep link de pago lo haría mucho
  mejor. No está.

---

## 10. Tanda 5 — el launchpad deja de ser un gate

Revierte la regla original ("el dominio del launchpad debe ser coherente con la chain") a la luz de
lo que aprendimos en §2.2: esa lista envejece sola y cada launchpad nuevo la convierte en un
rechazo de listados legítimos.

**Ahora DexScreener es el único gate de existencia.** Cualquier token que DexScreener conozca en la
chain declarada se puede listar. El link de launchpad sigue siendo obligatorio y sigue pasando por
la higiene de siempre (https, sin acortadores, sin link-in-bio, sin invitaciones de chat, params
strippeados), pero el dominio ya no decide si entrás: decide si tu fila muestra un ✓.

| # | Decisión | Por qué |
|---|---|---|
| 44 | **La lista pasa de gate a señal visual** | Rechazar por dominio desconocido no enseñaba nada: un token que lanzó en un launchpad nuevo es igual de real. El costo del falso negativo (listado legítimo bloqueado) es mucho mayor que el del falso positivo (fila sin ✓). |
| 45 | **`launchpadVerified` se congela con el link, en la primera puja** | Si se recalculara en cada top-up, agregar un dominio a la lista le daría el ✓ retroactivo a filas que no lo tenían — y, peor, un top-up podría negociarlo. Va con el link, que ya estaba congelado. |
| 46 | **El ✓ dice exactamente una cosa** | "Este link apunta a un launchpad que conocemos para esta chain". No es una review del token, y las reglas lo dicen con esas palabras. Un ✓ que la gente lea como "token seguro" sería peor que no tenerlo. |
| 47 | **Se exige https, ya no se acepta http** | El link se sirve a todos los visitantes. Con la lista fuera del camino, la higiene del link es lo único que queda, así que se endureció. |
| 48 | **Un subdominio de un launchpad conocido marca; un lookalike no** | `www.pump.fun` sí, `pump.fun.evil.com` no. Hay test — es exactamente el error que haría al ✓ peligroso. |
| 49 | **pump.fun en BNB ya no se rechaza** | Antes era el ejemplo insignia de la regla. Ahora entra sin ✓. Es coherente: el token existe en BNB según DexScreener, y el link raro es información para el que mira, no motivo de rechazo. |

### Lo que esto cambia en el balance de riesgo

- **Baja la fricción y sube el spam.** El piso de $5 y la existencia en DexScreener pasan a ser los
  únicos filtros. Cualquier token con un par en cualquier DEX puede entrar. Es la decisión correcta
  para un producto que vive de listados, pero hay que asumir que la cola del board va a ser más
  ruidosa.
- **El ✓ es ahora una superficie de confianza, y por lo tanto un objetivo.** Si alguien nos convence
  de agregar un dominio suyo a la lista, compra credibilidad barata. Agregar dominios tiene que
  tener el mismo cuidado que tuvo no agregar "RobinPad" (§2.2).
- **Queda desalineado un supuesto viejo:** el link de launchpad ya no es evidencia de nada
  verificable en el caso general. Sigue siendo el destino de los clicks de la fila, así que su
  higiene importa igual — pero llamarlo "official launchpad link" en la UI es ahora un poco
  generoso. Lo dejé como "Official launchpad link" por continuidad; vale discutir renombrarlo.

---

## 11. Tanda 6 — endurecimiento pre-lanzamiento

### Rate limiting

Crear una puja pendiente es gratis y **reserva un monto**, lo que la convertía en lo más barato de
abusar del sitio. Tres techos, todos en `RATE_LIMITS` (`payments/config.ts`), ninguno hardcodeado en
el call site:

| Límite | Valor | Por qué ese número |
|---|---|---|
| Pendientes vivas por IP | 5 | Un usuario real casi nunca tiene más de una o dos abiertas. 5 deja margen para equivocarse sin dar volumen a un atacante. |
| Creaciones por IP por ventana | 20 / 60 min | Cubre el caso legítimo de tantear montos y abandonar, y corta el goteo automatizado. |
| Pendientes vivas por monto base | 500 | 5% de las 9.999 fracciones. No es racionamiento: cerca de la saturación el sorteo empieza a colisionar y la creación se pone lenta **antes** de volverse imposible. El techo mantiene la asignación lejos de ese borde. |

Decisiones que vale marcar:

| # | Decisión | Por qué |
|---|---|---|
| 50 | **El barrido de expiradas corre dentro del chequeo, antes de contar** | Es lo que hace que un atacante que llenó un límite no lo retenga más allá de la expiración. Corre en el camino de aceptación **y** en el de rechazo — hay un test específico para eso. Sin cron, sin job: el que está bloqueado se desbloquea esperando. |
| 51 | **El límite se chequea ANTES del lookup a DexScreener** | Si no, alguien pasado de límite igual nos hace hacer trabajo saliente en cada request. |
| 52 | **No se guarda la IP cruda, solo un hash salado** | Es un contador, no un registro de visitantes. Con `RATE_LIMIT_SALT` sin setear el hash de una IPv4 es reversible por fuerza bruta (son 4 mil millones), y está dicho en el código y en `.env.example`. |
| 53 | **Sin cabeceras de proxy caemos a un bucket compartido `unknown`** | Es deliberadamente estricto en vez de permisivo: preferimos limitar de más a que un deploy mal configurado deje el límite sin efecto. |
| 54 | **El techo por monto responde "probá otro monto"** | Saturar $50 no puede ser una caída global. El mensaje empuja a un monto libre y el test verifica que $51 sigue funcionando. |
| 55 | **429 con `Retry-After` y un mensaje con cuándo reintentar** | El `retryAt` se calcula de datos reales — la expiración más próxima, o cuándo sale la puja más vieja de la ventana — no de una constante. |

**Lo que el rate limiting NO cubre:** es por IP, así que no frena a alguien con IPs rotativas. Para
eso hace falta prueba de trabajo, captcha o cuentas, y ninguna está. También: el bucket `unknown`
es compartido, así que en un deploy sin proxy headers **todos los usuarios comparten un límite de
5** — hay que confirmar que el hosting manda `x-forwarded-for` antes de lanzar.

### Renombre del link

`"Official launchpad link"` → **`"Where it launched"`**, con helper *"Any https link. Known
launchpads get a verified badge."* El label viejo prometía oficialidad que la regla nueva (§10) ya no
sostiene. Las reglas ahora dicen además que **la ausencia del badge no es una advertencia**, que era
la lectura peligrosa que quedaba.

---

## 12. Bloqueantes que siguen abiertos

Revisión del board pedida en esta tanda. Esto **no** está implementado; es la lista para decidir.

### Bloqueantes de verdad (pagos ya están conectados, así que estos ya están corriendo)

1. **No hay política de reembolso escrita** (§5.2). Las reglas dicen "final and non-refundable", que
   es una política — pero no cubre el caso que *nosotros* generamos: un pago confirmado que queda en
   `unmatched_payments` porque el monto no coincidió. Ahí hay plata de alguien, la UI le promete que
   "support can apply it", y **no existe ni el proceso ni la pantalla de soporte**. Es la promesa más
   riesgosa que hace el producto hoy.
2. **No hay moderación.** No hay forma de bajar una entrada. Un token que resulta ser un rug queda
   en el board, pago, para siempre. Sin esto, la primera vez que pase es una crisis sin herramienta.
3. **No hay reconciliación automática.** Si el pago se confirma y DexScreener se cae en ese instante,
   el pago queda registrado y la entrada no se aplica. El mensaje pide recargar; nada lo repara solo.
4. **No hay cuentas ni disputa de propiedad** (§5.8). Sin identidad no hay "mis entradas" ni forma de
   resolver quién controla una fila.

### Decisiones de producto todavía sin responder

5. **¿El margen del #1 es fijo o porcentual?** Hoy $5 fijo, que sobre un board de $10.000 no es
   margen (§4.1).
6. **¿Prendemos decaimiento?** Construido y apagado. Solo se puede anunciar una vez (§ranking).
7. **¿El board muestra todo o corta en el top N?** Con el gate de launchpad afuera (§10) la cola va a
   ser más ruidosa, así que esto pesa más que antes.
8. **¿Cuál es el precio piso real?** $5 se heredó de un producto de SaaS, no de tokens.
9. **¿Override manual de metadata?** Si DexScreener tiene mal un nombre, hoy no hay cómo corregirlo.
10. **¿"RobinPad" entra al allowlist, y con qué dominio?** (§2.2).

### Deuda técnica que ya no es opcional

11. **Paginación.** 16 filas andan; 600 no.
12. **Rate limiting por algo que no sea IP** (§11).
13. **RPC dedicado de Solana.** El público tiene rate limits agresivos y no siempre sirve
    transacciones históricas. Hay `SOLANA_RPC_URL` pero no hay reintentos ni fallback.
14. **Open Graph images.** El producto se comparte por link; hoy la preview no muestra nada.

---

## 13. Tanda 7 — operación mínima y decisiones de producto

Cierra las promesas que el producto ya hacía y aplica las decisiones que tomaste.

### Operación

| # | Decisión | Por qué |
|---|---|---|
| 56 | **`/admin` con token en cookie httpOnly, no en la URL** | El token no queda en el historial ni en el referrer. Comparación timing-safe. Sin `ADMIN_TOKEN` la consola directamente no existe. |
| 57 | **Aplicar un pago suelto pasa por el MISMO claim de firma** | Un operador no puede gastar una transferencia en dos pujas por ir por la consola: la constraint UNIQUE sigue siendo el árbitro incluso para nosotros. |
| 58 | **Descartar exige motivo** | Es plata de alguien. Si la damos por perdida, tiene que quedar escrito por qué. |
| 59 | **Deslistar no borra nada** | El board es un registro de plata cobrada. Borrar la evidencia de un deslistado es lo único que lo volvería inauditable. |
| 60 | **El deslistado se aplica por timestamp, no por flag** | El rebuild ignora las pujas anteriores al deslistado. Por eso un relisting arranca de cero sin necesidad de borrar el historial: el total viejo no se borra, deja de contar. |
| 61 | **Reconciliación derivada del estado, no de una cola** | La lista de trabajo es "pagos liquidados sin fila en `accepted_bids`". Lo ya aplicado es invisible para la corrida siguiente, así que la idempotencia es estructural y no depende de marcar nada. Hay test de correrlo dos veces. |
| 62 | **`recordAcceptedBid` se escribe DESPUÉS de tocar el board** | Si se cae en el medio, la puja queda huérfana y reintentable, en vez de marcada como hecha sin estarlo. |
| 63 | **El copy de pago no coincidente apunta a una persona** | Antes decía "support can apply it", que sonaba automático. Ahora nombra el contacto de `SUPPORT_CONTACT` y las reglas dicen que hay que esperar a que alguien lo haga a mano. |
| 64 | **Reintentos de RPC con backoff y rotación de endpoints** | Un nodo con rate limit y una transacción inexistente se ven igual desde afuera ("sin resultado"). Sin reintentos, le decimos al que pagó que su transacción no existe. |

### Decisiones de producto aplicadas

1. **Piso de puja: $1.** Baja la fricción al mínimo. Nota: el piso era el único filtro anti-spam que
   quedaba después de sacar el gate de launchpad (§10), así que ahora **los únicos filtros son
   "existe en DexScreener" y el rate limiting**. Vale tenerlo presente.
2. **Decaimiento: NO se implementa.** Ranking por total histórico, revisable si el top se fosiliza.
   *Dejé el código de decaimiento donde estaba —está escrito, testeado y apagado— en vez de
   borrarlo, porque dijiste "revisable" y prenderlo es una línea. Si preferís que no exista, se
   borra `DecayConfig`/`scoreEntry` y su test.*
3. **Board: top 50, después "Show more" paginado.** Server-rendered vía `?show=`, así que anda sin
   JavaScript y un link compartido a `?show=100` muestra lo que dice.
4. **"Where it launched" es OPCIONAL.** Para listar alcanza contract address + chain + que
   DexScreener lo conozca. Con link conocido, ✓; sin link, la fila no muestra nada de launch link.
   Efecto lateral que resolví: una entrada puede no tener a dónde mandar el click, así que el nombre
   cae a la web del token y, si tampoco hay, se renderiza como texto plano en vez de un link a
   ninguna parte.
5. **"RobinPad" sigue afuera** hasta tener dominio verificable (§2.2).

### Sin cuentas — aceptado para el lanzamiento

**Decisión explícita:** salimos sin login. Consecuencias asumidas, no olvidadas:

- No hay "mis entradas": si perdés el link de tu puja pendiente, no hay forma de recuperarla más que
  escribir a soporte.
- No hay forma de resolver una disputa de propiedad de una fila. Como la metadata la manda
  DexScreener (§4.1) y el launch link se congela, la superficie es chica — pero no es cero.
- La atribución de un pago es por monto único (§9), que responde "¿de qué puja es este pago?" y no
  "¿esta persona es la que pagó?". Sin cuentas eso no se puede cerrar del todo.

Se acepta porque el login mete fricción justo antes de pagar, que es exactamente donde menos se la
banca un producto de compra impulsiva. **Se revisa** si aparecen disputas reales o si alguna vez
guardamos algo que valga más que un puesto en un ranking.

---

## 14. Tanda 8 — rebrand a BIDOOR

El producto se llama **BIDOOR** (bidoor.lol). "-oor" es jerga de Crypto Twitter para "el que hace X",
así que el usuario **es** un bidoor. La línea de realeza queda anulada: un bidoor participa, no reina.

| # | Decisión | Por qué |
|---|---|---|
| 65 | **CTA del hero: "Become the top bidoor"** | Consideré tres: *"Outbid the board"* (más preciso como acción, pero "outbid" es el verbo de la referencia y no deja caer la marca), *"Take #1"* (más corto pero redundante con el precio que está justo arriba), y la elegida. Gana porque el precio de 60px sigue siendo el protagonista y el botón es el momento donde la marca tiene que aterrizar. |
| 66 | **Acento magenta `#c4006a` / `#ff5fae`** | Contra el crema cálido es fuerte y se parece más a cómo se ve Crypto Twitter que un coral suave. Y pasa AA en todos los usos, cosa que **el persimmon no hacía**: 3.68 como texto bold de 16px sobre el fondo. |
| 67 | **Verde ácido descartado pese a ser el más "degen"** | El verde ya significa "positivo" en esta paleta. Un acento que colisiona con un color de estado hace que los dos signifiquen menos. |
| 68 | **Se eliminó el dorado del #1: un solo acento de verdad** | Sobre una card teñida de magenta, cualquier dorado que pase AA se va a oliva y se lee como un error. El líder se marca por **tamaño** (`text-xl` contra `text-lg`), que además es una señal más fuerte que el tono. Los tokens `--bd-gold*` se borraron en vez de quedar sin usar. |
| 69 | **Favicon: un chevron subiendo desde una barra** | La barra es el precio a superar, el chevron sos vos superándolo — "up only", que es el producto entero en un glifo. Dos formas, así que sigue leyéndose a 16px. SVG propio, nada de corona. |

### Dos fallos de accesibilidad preexistentes que aparecieron al medir

No los causó el rebrand; los encontré calculando contrastes y los arreglé:

1. **El texto de los botones de acento no era el color de tinta.** `button { color: inherit }` estaba
   **fuera de capa** en `globals.css`, y el CSS sin capa le gana a la capa de utilidades de Tailwind.
   Resultado: desde la tanda de diseño, el CTA y el pill "Bid" servían texto `#282624` sobre el
   acento — **2.55:1**. Movido a `@layer base`; ahora es 5.91:1.
2. **Dorado y verde positivo fallaban en tema claro** (3.21 y 4.04 sobre el fondo). El dorado
   desapareció con la decisión #68; el positivo se oscureció a `#157a4c` (5.28).

---

## 15. Tanda 9 — migración a Postgres

**Corrección de premisa.** La tanda venía planteada como "hoy la persistencia es en memoria y un
reinicio borra las firmas consumidas". No era así: desde la tanda de pagos había SQLite en
`data/bidoor.db` con siete tablas, y las firmas sobrevivían un reinicio. El argumento real para
migrar es otro, y alcanza solo: **con un archivo por máquina, las constraints UNIQUE son por
instancia.** Dos servidores aceptarían cada uno la misma firma, y el candado anti-replay valdría
cero. En Postgres son globales, que es la única versión de esa promesa que vale la pena hacer.

| # | Decisión | Por qué |
|---|---|---|
| 70 | **`pg`, no Drizzle ni un ORM** | El SQL de este proyecto se leyó línea por línea en la auditoría; pasarlo a un query builder reescribe cada sentencia y tira esa revisión a la basura. El binding parametrizado quedó idéntico. |
| 71 | **El board es una tabla real (`entries` + `entry_bids`)** | Decisión de producto tuya. `accepted_bids` y `payments` pasan a ser historial y entrada de reconciliación, no la fuente de la que se deriva el board. Reconstruirlo al arrancar estaba bien cuando era un fixture y estaba mal desde el momento en que un reinicio podía cambiar lo que alguien pagó. |
| 72 | **El deslistado es un borrado lógico con índice único parcial** | `entries_contract_key_live` cubre solo `delisted_at IS NULL`. Así la fila deslistada conserva su historial, el token se puede relistar, y el relisting arranca de cero porque el total viejo pertenece a la fila vieja. Reemplaza la comparación por timestamp de la tanda 7, que tenía un empate de 1 ms. |
| 73 | **`TEST_DATABASE_URL` separado de `DATABASE_URL`** | La suite trunca todas las tablas. Que los tests leyeran `DATABASE_URL` sería a una mala variable de entorno de distancia de vaciar producción. Además se rechaza arrancar si son iguales. |
| 74 | **El seed de demo se carga en `instrumentation.ts`, con doble guarda** | Nunca bajo `NODE_ENV=production`, y `LOAD_DEMO_SEED=false` lo apaga en cualquier lado. Una fila de demo en un board que dice mostrar lo que la gente pagó es una mentira sobre plata. |
| 75 | **Ranking sigue en la función pura, no en SQL** | Las reglas de desempate y el hook de decaimiento viven ahí; tener dos implementaciones de "quién es #1" es como se desincronizan. Limita el tamaño del board — con miles de filas hay que pasar a una query con ventana, y está anotado en el código. |

### Un bug que apareció migrando

El seed generaba `contract_key` con `.toLowerCase()`. La clave canónica solo baja a minúsculas las
direcciones **EVM** — en Solana, TON y TRON el case es significativo. Con SQLite el lookup
compensaba probando ambas formas; con Postgres el match es exacto, así que un top-up sobre un token
sembrado **creaba una segunda entrada en vez de sumar**. El seed ahora usa `contractKeyFor`, la
misma función que el validador, y se eliminó el doble lookup.

---

## 16. Tanda 10 — endurecimiento de admin y mitigación de A-2

| # | Decisión | Por qué |
|---|---|---|
| 76 | **La cookie lleva un id de sesión, no el token** | Era el secreto maestro viajando en cada request al origen y sin forma de revocarlo salvo rotar la env var en todos los deploys. Ahora una cookie filtrada es una fila para revocar. Expira a las 8 h. |
| 77 | **`secure` se decide por protocolo, no por `NODE_ENV`** | Un staging que se olvidó de setear `NODE_ENV=production` mandaba la sesión en claro. Ahora depende de si la request llegó por https. |
| 78 | **Lockout también en el camino del header `x-admin-token`** | `/api/reconcile` respondía "¿es este el token?" en un request sin efectos secundarios: era el oráculo de fuerza bruta más cómodo del sistema. Poner el límite solo en el formulario no servía de nada. |
| 79 | **La racha de fallos se corta con un éxito** | Si no, un operador legítimo que se equivoca cuatro veces queda a un error de bloquearse a sí mismo para siempre. |
| 80 | **Comparación sobre digests SHA-256** | El retorno temprano por longitud distinta filtraba el largo del secreto. Con digests los dos lados miden siempre 32 bytes. Además se comparan **todos** los tokens configurados aunque uno haya matcheado, para no revelar cuál por tiempo. |
| 81 | **Log de auditoría append-only forzado por un trigger de Postgres** | Un log que la aplicación puede reescribir en silencio no es un log. El trigger rechaza UPDATE, DELETE y TRUNCATE; hay tres tests que lo prueban contra la base real. `truncateAll` lo levanta por una sentencia y lo repone, y solo corre fuera de producción. |
| 82 | **`ADMIN_TOKENS` con pares `label:secret`** | Para que el trail pueda decir *quién* actuó. `ADMIN_TOKEN` sigue siendo la forma de un solo operador. |
| 83 | **Segundo factor opcional, no obligatorio** | `ADMIN_STEP_UP_SECRET` protege aplicar pago y deslistar **si está seteado**. Forzarlo metía fricción en un setup de un solo operador sin ganar nada. |

### A-2 — seis decimales y sub-límite por caller

| | Antes | Ahora |
|---|---|---|
| Espacio de fracciones por monto | 9.999 | 999.999 |
| Techo global por monto | 500 | 50.000 |
| Callers distintos para acapararlo | ~100 | **25.000** |

Dos cambios que se necesitan mutuamente. Ampliar el espacio solo no alcanzaba: el techo global es un
recurso compartido y un atacante podía tomarlo entero. El sub-límite por caller (2 pujas impagas por
monto) es lo que convierte el techo en un costo repartido.

**El trade-off es legibilidad.** El monto pasó de `$50.0041` a `$50.328991`. Se aceptó porque el
monto se copia, no se memoriza — y la UI ahora lo acompaña: monospace, botón de copiar al lado, y
copy explícito de que hay que mandar el monto exacto **sin redondear**, con los seis decimales.

### Lo que sigue abierto

**A-3** sin cambios: la cola de pagos no coincidentes todavía no muestra el remitente on-chain, así
que un operador puede ser inducido a aplicar plata ajena. Mitigado en parte desde la tanda 6 —la
firma ya está quemada, así que el atacante no puede además reclamarla— y ahora también por el log de
auditoría, que deja rastro de quién aplicó qué. Sigue faltando mostrar el remitente.

**M-6** (salt de IP con default vacío) y **B-3/B-4** siguen abiertos. Y la tanda de infra —cabeceras
de seguridad y cifrado en reposo— sigue siendo **bloqueante de deploy**.

---

## 17. Tanda 11 — infraestructura: cabeceras, A-3 y Neon

### Cabeceras de seguridad

No había **ninguna**. Ahora `next.config.ts` sirve CSP, HSTS (2 años, subdominios, preload),
`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` y
`Cross-Origin-Opener-Policy` en toda respuesta, más `no-store` y `noindex` en `/admin` y `/api/*`.
`poweredByHeader` apagado.

| # | Decisión | Por qué |
|---|---|---|
| 84 | **`img-src` restringido al CDN de DexScreener** | Es el mismo allowlist que ya aplica el resolver de metadata, repetido donde lo puede aplicar el navegador. Defensa en profundidad barata. |
| 85 | **`connect-src 'self'`** | El RPC de Solana y DexScreener se llaman desde el servidor. Si algún día aparecen en una petición del navegador, es porque algo se rompió o alguien inyectó código. |
| 86 | **`frame-ancestors 'none'` + `X-Frame-Options: DENY`** | Redundantes a propósito: el segundo cubre navegadores que no aplican el primero. |
| 87 | **`'unsafe-inline'` en `script-src` — y está anotado como deuda** | Next inyecta scripts inline de bootstrap. Sacarlo necesita nonces por request, que es un cambio propio. Prefiero dejarlo dicho acá que poner un comentario diciendo que está bien. |

Verificado sirviendo de verdad: las siete cabeceras presentes, y la página carga con **16 filas, 29
de 29 logos del CDN y cero violaciones de CSP** en un browser real.

### A-3 — el remitente on-chain en la cola de unmatched

Era el último hallazgo alto abierto. La cola mostraba un pago suelto al lado de un `bid_id` que
**eligió quien pegó la firma**, así que aplicarlo era confiar en esa asociación — el camino limpio
para que a un operador lo convenzan de pagar el puesto de un atacante con plata ajena.

El verificador ahora extrae el remitente de los mismos deltas de balance de los que sale el monto:
qué wallets vieron bajar su USDC, y quién pagó el fee. Se persiste en `unmatched_payments` y la
consola lo muestra arriba de las pujas candidatas, con el texto de que el bid al que se archivó lo
eligió quien mandó la firma, no nosotros.

| # | Decisión | Por qué |
|---|---|---|
| 88 | **Se listan TODOS los wallets debitados, no uno** | Una transferencia ruteada por un agregador tiene más de uno. Mostrar el primero en silencio sería peor que mostrarlos todos. Si hay más de uno, la UI lo dice explícitamente. |
| 89 | **Un pago sin remitente conocido se marca en rojo** | Las filas anteriores a esta migración no lo tienen. Decir "verificalo en un explorer antes de aplicar" es mejor que un campo vacío que parece normal. |

### Neon

Las dos bases conectan (Postgres 18.6) y quedaron migradas. Dos cosas que aparecieron:

1. **`.env.local` tenía cada variable duplicada**, con una `DATABASE_URL=` vacía en el medio.
   Resolvía bien de casualidad (dotenv se queda con la última), pero ambigüedad sobre a qué base se
   conecta la app no es algo para dejar pasar. Deduplicado.
2. **`sslmode=require` pasó a `sslmode=verify-full`.** `pg` avisa que hoy los trata igual pero que
   va a cambiar, y que después `require` va a ser el más débil. Hacerlo explícito no cambia nada hoy
   y evita una degradación silenciosa en una actualización futura.

**La suite contra Neon expuso un problema real de diseño de tests:** cada `beforeEach` recargaba el
fixture con una query por fila — 46 round-trips. Contra Docker local eso es invisible; contra una
base remota hacía timeout **todos** los tests. El seed pasó a dos INSERT multi-fila y el truncate a
una sola sentencia. De timeout total a 16/16 en un archivo. Sigue siendo mucho más lento que local,
que es esperable y está dicho en el README: local para iterar, Neon para verificar.

---

## 18. Tanda 12 — M-6 y el cierre del ítem de cifrado

| # | Decisión | Por qué |
|---|---|---|
| 90 | **`RATE_LIMIT_SALT` falla cerrado en producción** | Un hash sin salt de una IPv4 es reversible por fuerza bruta. El default vacío no era una anonimización a medias: era una IP guardada con un disfraz, que es peor que no hashear porque parece protección. Fuera de producción cae a un valor fijo para no tener que configurar nada localmente. |
| 91 | **Los identificadores se anulan, las filas se quedan** | Un registro de pago, un intento de login y un deslistado son todos cosas que hay que conservar. Lo que caduca es el `ip_hash`, que existe para contar requests en una ventana de minutos y deja de servir para eso mucho antes de dejar de ser dato personal. |
| 92 | **La limpieza va en el cron que ya existe** | `/api/reconcile` ya es "tareas que el camino del request no puede hacer". Un segundo scheduler para esto sería una pieza más de infraestructura que mantener. |
| 93 | **Validación de entorno al arranque, con la consecuencia escrita** | `MISSING_ENV_VAR` a las 3 de la mañana no es un mensaje de error. Cada variable dice qué se rompe sin ella. Y falla el deploy, no la primera puja de un usuario. |
| 94 | **`pgcrypto` a nivel columna: evaluado y descartado** | Cifrar `consumed_signatures` o `ip_hash` rompería los índices UNIQUE que **son** la seguridad del sistema. Las firmas además son públicas en la cadena. |
| 95 | **IP allowlist diferido, no descartado** | Es plan Scale ($0.222/CU-hora contra $0.106 de Launch). Protege sobre todo contra credencial filtrada, y a volumen cero duplicar el costo de cómputo por esa capa no se justifica. Se revisa con dinero real en el board o con un segundo operador. |

**Corrección de mi propia auditoría.** Había marcado "cifrado en reposo" como bloqueante de deploy.
Estaba mal planteado: Neon ya cifra todo con AES-256 en todos los planes. El problema real de datos
era la **minimización**, no el cifrado, y es lo que resuelve M-6. Lo dejé escrito en el informe en
vez de corregirlo en silencio.

**Un guard que se probó solo:** el primer test de retención stubbea `NODE_ENV=production`, y el
`beforeEach` siguiente llamaba a `truncateAll()` antes de deshacer el stub. Falló con
*"truncateAll must never run in production"* — exactamente lo que tiene que pasar. Se invirtió el
orden en el test; el guard queda como está.

---

## 19. Tanda 13 — el fixture llegó a producción

**Fue un error mío, no un fallo del producto**, y vale escribirlo con precisión porque el arreglo
que salió es mejor que el guard original.

Probando el workflow de reconcile levanté `next dev` **sin `DATABASE_URL` inline**. Next tomó
entonces el de `.env.local`, que desde la migración a Neon apunta a **producción**. Y `next dev`
fuerza `NODE_ENV=development`, así que `demoSeedEnabled()` devolvió `true` y `instrumentation.ts`
sembró las 16 filas del fixture en la base de producción, a las ~16:03 UTC del 2026-08-22. Los
timestamps del seed lo confirman: son todos `now - offset` contra ese momento.

**El guard estaba mal planteado, no mal implementado.** Miraba `NODE_ENV`, que describe el
*proceso*. Lo que importa es la *base*. Un proceso de desarrollo apuntado a la base de producción
pasaba limpio por los dos checks que había.

| # | Decisión | Por qué |
|---|---|---|
| 96 | **Tercer guard: la base tiene que ser local** | `targetsLocalDatabase()` mira el host de `DATABASE_URL`. Es el único de los tres que describe lo que realmente está en riesgo. |
| 97 | **`LOAD_DEMO_SEED=force` como única salida** | La suite de tests corre contra una base remota descartable por contrato, y es el único caso legítimo. Se setea en `vitest.config.mts` y en ningún otro lado. |
| 98 | **El script de limpieza sólo puede borrar filas impagas** | `purge-demo-entries.mts` es dry-run por defecto y su query excluye toda entrada con un pago o un `accepted_bid` detrás. Una fila que alguien pagó es intocable desde ahí, pase lo que pase. No toca el esquema. |

**Un test se rompió y señalaba algo real:** un caso hacía `delete process.env.LOAD_DEMO_SEED` en su
`finally` en vez de restaurar el valor previo, y con el guard nuevo eso dejaba al test siguiente sin
poder sembrar. Pasó a `vi.stubEnv` + `vi.unstubAllEnvs`, que restaura en vez de borrar.

---

## 20. Tanda 14 — paleta duotono

Elegida la variante A de la exploración: fondo azul profundo, texto verde pálido, slime para dinero
y acción. Los detalles de color están en `DESIGN.md` §9; acá van las decisiones.

| # | Decisión | Por qué |
|---|---|---|
| 99 | **Se elimina el tema claro** | La paleta prohíbe el crema, así que no hay material para un segundo tema. Mantener uno obligaría a romper la regla que la paleta existe para sostener. |
| 100 | **`positive` deja de ser verde y pasa a celeste** | El verde ya es dinero. Un color de estado que colisiona con el acento hace que los dos signifiquen menos — el mismo razonamiento por el que se descartó el verde ácido cuando el acento era magenta. |
| 101 | **El rojo de error sobrevive al duotono** | Es la única excepción por seguridad: si el mensaje de fallo en la pantalla de pago se ve igual que el resto, la gente no lo ve. Documentado como semántica, no como paleta. |
| 102 | **Los chips de chain se rehicieron, no sólo se conservaron** | Conservar sus tintes anteriores los habría dejado en 1.09–1.24 de contraste contra el azul: invisibles. Tinte uniforme del ramp azul, identidad en la tinta. |
| 103 | **"OOR" en celeste, "BID" en verde pálido** | En la variante original el wordmark quedaba flojo porque las dos mitades eran verdes. El celeste lo parte de verdad y respeta la regla: el wordmark es identidad/navegación, no dinero. |

**Reasignaciones concretas** para que la regla se sostenga en los componentes, no sólo en los
tokens: los títulos de sección de Rules, el nombre de acción en el log de auditoría, los dots de
los paneles y el hover del nombre de token pasaron de acento a celeste. Los montos, el CTA, los
pills de rank y el hover del botón "Take #N" siguen en slime.

---

## 21. Tanda 15 — base neutra y dos temas

Elegido: oscuro B (pizarra fría) como default, más el claro crema. Los colores
están en `DESIGN.md` §10; acá van las decisiones.

| # | Decisión | Por qué |
|---|---|---|
| 104 | **La base vuelve a ser neutra** | Dos rondas duotono fallaron por lo mismo: un acento que carga la página entera no tiene contra qué destacarse. |
| 105 | **El slime es relleno, nunca letra — en los dos temas** | Sobre crema da 1.17. Podría haber sido letra sólo en oscuro, pero una regla que cambia según el tema se rompe sola en el primer componente nuevo. Una sola regla, los dos temas. |
| 106 | **Relleno slime sólo en título, CTA y fila del #1** | Los montos comunes van con peso. Es la corrección pedida sobre el preview: cincuenta chips de resaltador leen como documento subrayado, no como board. |
| 107 | **El celeste del claro se ajustó a `#00658F`, no `#007DB3`** | El `#007DB3` de la exploración estaba medido contra la página; sobre card cae a 3.59 y falla. El valor nuevo aguanta las dos. |
| 108 | **Un solo `light-dark()` por token en vez de dos bloques** | Dos bloques duplicados se separan con el tiempo. Esto hace imposible tocar un tema y olvidar el otro. |
| 109 | **La crema no cumple el 1.45 de separación de capas, a propósito** | No hay lugar por arriba de 0.98 de luminancia, y una card 1.45 por debajo lee sucia. En claro la profundidad la cargan el borde y la sombra. |
| 110 | **`positive` pasa a ser el celeste fuerte** | El verde es plata. Un color de estado que colisiona con el acento hace que los dos signifiquen menos. |
| 111 | **Los chips de chain llevan dos juegos de tinta** | Los brillantes dan 1.26 sobre un chip claro. La identidad de chain es la excepción semántica que sobrevive a cada rediseño, pero tiene que sobrevivir *legible*. |

**Reasignaciones a celeste** para que la regla se sostenga en los componentes:
hover de "Take #N" y "Show more", hover de Copy, chain seleccionada en el
formulario, el aviso de "ya está en el board", el bloque de "Paid by" del admin
y el punto del hero.

**Un desvío del pedido, explícito.** El pedido decía "acentos idénticos en los
dos temas". El slime lo cumple: mismo hex, mismo rol de relleno. El celeste no
puede — `#00A8F0` sobre crema es 2.63 — así que cambia de valor pero no de rol.
La alternativa era dejarlo fallando AA, y ésa no es una opción disponible.

---

## 22. Tanda 16 — un solo acento

| # | Decisión | Por qué |
|---|---|---|
| 112 | **El celeste se elimina como acento** | Un color reservado para "info" compite con el único que tiene que significar "pagá". El producto necesita que grite una sola cosa. |
| 113 | **Nada recibe slime en reemplazo del celeste** | Era el riesgo obvio de la tanda: repintar de verde lo que era celeste habría dado el mismo problema con otro color. Lo que no califica para relleno, va neutro. |
| 114 | **Los links se afirman con subrayado, no con color** | Es la señal que no gasta paleta. Funciona igual en los dos temas y no compite con nada. |
| 115 | **`--bd-positive` se elimina en vez de volverse neutro** | Un token llamado "positive" que es el color del texto miente sobre lo que hace. Los estados pasan a texto con peso, explícito en el componente. |
| 116 | **Wordmark en un color** | Con "OOR" en slime, el bloque del wordmark es más grande y está más a la izquierda que el CTA: se lee primero y le roba el trabajo. |
| 117 | **`faint` y `danger` se corrigieron: fallaban sobre `surface-2`** | Estaban medidos contra la página y la card. Sobre la tercera capa daban 3.98 y 3.65. La regla ahora es medir las tres capas siempre, no dos. |

El borde fuerte `#6A7F97` tiene cast azulado y un chequeo automático de restos de
celeste lo marcó. **Se deja:** está sobre el mismo rayo cromático que `bg`,
`card` y `lift` — es la propia rampa fría del tema, no un acento sobreviviente.

---

## 23. Tanda 17 — marca y podio verde

| # | Decisión | Por qué |
|---|---|---|
| 118 | **Marca: arco + chevron (opción B)** | Es la única de las cuatro donde la puerta y el "up only" son la misma forma en vez de dos ideas superpuestas, y la que menos pierde al achicarse. |
| 119 | **La marca es slime sola, y neutra en el header** | El header ya gasta su slime en el botón. Un mark verde al lado del wordmark recrea exactamente el problema que resolvió el wordmark de un color. |
| 120 | **Los montos del podio son relleno, no letra slime** | La regla de contraste no se levantó: slime como texto sobre crema es 1.17. Se extendió *dónde* aparece el slime, no *cómo*. |
| 121 | **El borde slime del podio se acepta sabiendo que da 1.08 en claro** | Es decoración con redundancia: el podio ya es card con sombra contra filas planas. Si fuera la única señal del ranking, no sería aceptable. |

**Se frenó la tanda para preguntar.** El pedido llegó con `[A/B/C/D]` sin
completar. Elegir el logo en su lugar habría significado rehacer cuatro artefactos
si acertaba mal, así que se preguntó antes de tocar nada y se avanzó con el
resto recién con la respuesta.

---

## 24. Tanda 18 — se revierte el recargo del #1

| # | Decisión | Por qué |
|---|---|---|
| 122 | **`topSpotGapUsd` se elimina: el #1 se toma por total + $1, igual que cualquier otro rank** | Revierte a propósito la decisión §1 #4. Aquella leía el flip barato del #1 como el problema; es el producto. Cada cambio de mano arriba es drama público, y el recargo de $5 estaba comprando silencio. |
| 123 | **El recargo se veía peor justo donde más importa** | Con el líder en $1 el hero pedía $6 — un salto de 6× en el lanzamiento. Sobre un líder de $100 el mismo recargo es +5%. El precio ahora es el mismo múltiplo en todos los tamaños. |
| 124 | **`priceToClaimRank` pierde el parámetro `rank`** | Ya no cambia nada. Dejarlo habría sido una firma que insinúa una regla que no existe. |

Lo que se acepta con esto: el #1 rota por un dólar. Es la consecuencia buscada, no un
efecto lateral — si más adelante molesta, lo que vuelve no es el recargo plano sino un
gap porcentual con piso de $1, que conserva la propiedad anti-flip sin el peaje de
lanzamiento.

---

## 25. Tanda 19 — la ficha del token vive en la fila

| # | Decisión | Por qué |
|---|---|---|
| 125 | **Nada de expandir/colapsar: dirección, chart y sociales están siempre a la vista** | Un control de apertura cuesta un click en cada una de las 50 filas para mostrar datos que ya están cargados. Un link que nadie ve es un link que nadie clickea. |
| 126 | **El banner ocupa el hueco muerto del medio, entre el bloque de nombre y el monto** | Es el único espacio de la fila que no era de nadie. Nunca queda texto nuestro encima de la imagen. |
| 127 | **Enmascarado a transparente en los dos bordes laterales** | Cada banner trae los colores que quiere y no los controlamos. El fade los disuelve contra la card en vez de estrellarlos contra el nombre de un lado y el total del otro. |
| 128 | **El monto queda siempre sobre el fondo de la card, nunca sobre la imagen** | Resuelve el contraste eliminando el problema en vez de tapándolo con un overlay: medido en las cuatro combinaciones, el borde derecho del banner nunca llega al monto. |
| 129 | **El banner se hotlinkea a `cdn.dexscreener.com`, no se proxea** | La CSP ya permite ese host para los logos. Proxearlo sería servir la imagen de cada token desde nosotros sin ganar nada: mismo host, misma política. |
| 130 | **En móvil no hay banner, y la línea secundaria pierde fecha y clicks** | Abajo de `sm` el hueco del medio no existe. Queda chain + dirección copiable + DexScreener, que es el mínimo que se pidió; los clicks son la baja, y es una pérdida real. |
| 131 | **El link a DexScreener se construye con chain + address, no se guarda** | Así toda fila lo tiene, incluso un token sin nada cargado. Un token que se pudo listar acá ya existía allá. |
| 132 | **`banner_url` es columna nueva, nullable, sin backfill en la migración** | La mayoría de los tokens no tienen banner. Un NULL es el caso normal, no uno roto. El backfill es un script aparte porque tiene que salir a la red. |
| 133 | **El backfill sólo escribe `banner_url`** | Nombre, ticker, logo y links se refrescan en el top-up y en ningún otro lado. Un script que los reescribiera sería un segundo camino invisible para cambiar lo que dice una entrada. |
| 134 | **La ficha no hace un solo fetch** | Todo sale de lo que ya está persistido en la entrada desde que se pagó la puja. |

La fila no crece de alto en desktop: medido con y sin lo que agrega esta tanda, 79px
en los dos casos. Verificado con The Black Bull en prod (banner + X + Telegram, sin
website) y con SHIBA INU en la rama de test (sin links ni banner: queda la dirección,
el botón de copiar y DexScreener, sin huecos).
