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

> **Recomendación:** antes de conectar pagos, un lookup contra un indexer/RPC por chain que
> confirme que la address es un token existente y traiga nombre, ticker, supply y logo. Convierte
> tres campos manuales en uno solo y elimina toda una clase de errores y de spam.

### 2.2 El allowlist de launchpads es la regla más frágil que tenemos

La regla "el dominio del launchpad tiene que ser coherente con la chain" es correcta y la
implementé, pero descansa en una lista que **envejece sola**. Sale un launchpad nuevo en Solana
todos los meses. Cada vez que eso pasa, el producto rechaza pujas legítimas y el que puja no
entiende por qué.

Peor: **Robinhood Chain no tiene un ecosistema de launchpads establecido.** Puse `robinhood.com`
como placeholder y lo marqué como provisional en el código. Hoy esa chain es, en la práctica,
imposible de usar. Hay que decidir qué hacemos ahí antes de lanzar.

> **Recomendación:** que el allowlist sea configuración editable por ops (no un deploy), con una
> vía de escape explícita: "¿lanzaste en otro lado? Mandanos el link" y revisión manual. Ya está el
> copy puesto en la página de reglas, pero no hay flujo detrás.

### 2.3 Nadie verifica que el que puja tenga algo que ver con el token

Cualquiera puede listar cualquier token. Es una decisión de producto legítima (outbid.lol tampoco
verifica) y además es parte de la gracia: alguien puede pujar por un token del que es holder. Pero
tiene consecuencias que hay que aceptar explícitamente:

- Un competidor puede listar tu token con links a un sitio que no controlás.
- Un scammer puede listar un token legítimo con su propio link de "sitio oficial".
- El top-up refresca la metadata (decisión #6), así que **el que paga último controla el nombre y
  los links de la entrada.** Es coherente pero es un vector: puedo pagar $1 sobre una entrada ajena
  y cambiarle el website.

**Esto último lo considero un bug de diseño, no una feature.** Ver §4.1.

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

**Secuestro de metadata por $1 (el más grave).** Como el top-up refresca nombre y links, y el
mínimo de top-up es $1, cualquiera puede pagar $1 sobre la entrada #1 y cambiarle el sitio oficial
a uno propio. El que pagó $8.000 pierde el control de su fila por un dólar.

> **Fix propuesto:** que el top-up sume al total siempre, pero que **solo pueda editar la metadata
> quien acumuló la mayoría del total** de esa entrada (o el que la creó). Alternativa más simple:
> la metadata se congela después de la primera puja y solo cambia por soporte. Hay que decidirlo
> antes de pagos.

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

- Truncación de un carácter en Solana (§2.1).
- Checksum EIP-55 y base58check de TRON.
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
3. **¿Quién controla la metadata de una entrada?** §4.1. Es la decisión más urgente.
4. **¿Bajamos entradas, y en qué casos?** Si bajamos un token que pagó $10.000 por rug, ¿devolvemos?
   Si no bajamos nada, hay que poder sostenerlo públicamente.
5. **¿El margen del #1 es fijo o porcentual?** §4.1.
6. **¿Prendemos decaimiento, y lo anunciamos desde el día uno?** Está construido para soportarlo,
   pero es una promesa que solo se puede hacer una vez.
7. **¿Qué pasa con Robinhood Chain?** §2.2. Hoy está listada pero es inusable.
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
