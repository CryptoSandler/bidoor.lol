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
| 1 | **Nombre de producto: BIDTAPE** | Pediste identidad propia. "Tape" es jerga de trading para el feed de precios, y el producto es literalmente un ticker de plata. No arrastra la marca de ellos. | `src/app/layout.tsx` |
| 2 | **Botón de puja por fila, con el precio impreso** | Lo mejor del diseño original (ver REFERENCIA §3). Convierte "¿cuánto pago?" en "¿pago esto?". Es lo que le da valor comercial a la cola larga de la lista. | `src/components/BoardRow.tsx` |
| 3 | **El hero es el precio del #1, no un slogan** | El sitio tiene que leerse como un mercado en 2 segundos, sobre todo en screenshot. | `src/app/page.tsx` |
| 4 | **Tomar el #1 cuesta +$5; cualquier otro puesto +$1** | Sin margen extra, la posición más valiosa del board es la más barata de disputar y el #1 rota todo el día por un dólar. | `src/lib/config.ts` |
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

