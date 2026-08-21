# AUDITORÍA DE SEGURIDAD — BIDOOR

**Fecha:** 2026-08-21 · **Commit auditado:** `5a05cbb` · **Alcance:** todo `src/`, esquema SQLite,
configuración de entorno.

> **Estado de remediación (2026-08-21).** Se corrigieron **C-1, C-2, A-1, A-4 y M-5**, cada uno con
> tests. El estado de cada hallazgo está marcado en su título. Lo pendiente está resumido en
> §"Estado de remediación" al final, junto con una tanda de deploy que sigue **bloqueante**.

**Modelo de amenaza asumido:** adversario activo, con incentivo económico, capacidad de leer la
cadena (nuestra wallet de cobro es pública y toda transferencia entrante es observable), rotar IPs a
bajo costo, y desplegar tokens arbitrarios con la metadata que quiera. **No** se asume acceso al
servidor, a las variables de entorno ni a la base.

Este es un informe de análisis. **No se modificó código.**

---

## Resumen

| Severidad | Cantidad |
|---|---|
| Crítico | 2 |
| Alto | 4 |
| Medio | 6 |
| Bajo | 4 |

El hallazgo dominante es **C-1**: una transacción no está atada en el tiempo a la puja que paga, lo
que convierte a toda transferencia entrante en un instrumento al portador. Eso, combinado con la
decisión deliberada de **no** consumir la firma de un pago no coincidente (§8, decisión #42), crea
un camino directo para que un tercero se apropie del dinero de otro.

Varias áreas están genuinamente bien resueltas y se listan al final (§"Lo que está sólido"). No las
infle: son controles reales, verificados leyendo el código, no supuestos.

---

# CRÍTICO

## C-1 · ✅ CORREGIDO · Una transacción no está atada en el tiempo a la puja: toda transferencia entrante es un instrumento al portador

**Archivos:** `src/lib/payments/solana.ts:51-58` (el tipo `SolanaTransaction` ni siquiera pide
`blockTime`), `src/lib/payments/solana.ts:145-187`, `src/app/api/bid/[id]/verify/route.ts:52-56`.

**Qué es.** `verifyPayment` acepta *cualquier* transacción confirmada que haya movido exactamente
`expectedBaseUnits` de USDC a nuestra wallet. No hay ninguna comprobación de **cuándo** ocurrió. No
se pide `blockTime` al RPC, no se compara contra `bid.createdAt`, y no hay ventana de validez.

La atribución descansa enteramente en que el monto sea único — pero el monto **solo es único entre
pujas `pending`** (índice parcial en `db.ts:63`). Una vez que una puja se paga o expira, su monto
vuelve al pool y puede reasignarse a otra puja meses después.

**Cómo se explota, paso a paso:**

1. El atacante enumera las transferencias USDC entrantes a nuestra wallet de cobro (pública, visible
   en cualquier explorer). Anota montos y firmas.
2. Busca las que **no fueron consumidas**. La cosecha más rica son los pagos no coincidentes: por
   diseño (§8 #42) su firma queda libre en `unmatched_payments`, no en `payments`. Alguien que pagó
   `$50.0050` en vez de `$50.0041` dejó ahí `$50.0050` sin gastar.
3. El atacante crea pujas con monto base `$50` hasta que el sorteo le asigne la fracción `0050`.
   El espacio es de 9.999 fracciones → ~5.000 intentos esperados. Con el rate limit actual
   (20/hora/IP) y ~100 IPs rotadas, son unas **2,5 horas**.
4. Pega la firma de la víctima. El verificador comprueba: confirmada ✓, mint USDC real ✓, destino
   nuestra wallet ✓, monto exacto ✓, firma nunca usada ✓. **Pasa.**
5. El atacante obtiene un puesto pago de $50 con la plata de otro. La firma de la víctima queda
   consumida, así que soporte ya no puede aplicarla, y el registro dice que se gastó legítimamente.

El mismo ataque funciona sin pagos no coincidentes: cualquier transferencia abandonada (alguien pagó
y cerró la pestaña antes de pegar la firma) queda claimeable para siempre.

**Por qué es crítico y no alto:** roba dinero de un tercero, es repetible, no requiere ninguna
condición de carrera, y la víctima no tiene forma de notarlo hasta que reclama a soporte.

**Fix propuesto.** Tres capas, la primera sola ya mata el ataque:

1. **Pedir `blockTime` y exigir `blockTime >= bid.createdAt`** (con un margen de reloj de, digamos,
   120 s). Una transferencia anterior a la creación de la puja no puede pagarla. Como los montos son
   únicos *entre pujas vivas*, y la ventana es de 30 minutos, esto cierra el camino por completo:
   el atacante tendría que conseguir que llegue una transferencia con su fracción aleatoria exacta
   dentro de su propia ventana de 30 minutos.
2. **Reservar la firma en el momento en que se la ve**, aunque el monto no coincida: una tabla
   `seen_signatures` (o marcar la fila de `unmatched_payments` como ligada a un `bid_id` y solo
   aplicable por un operador). Hoy la firma queda libre a propósito; debería quedar *reservada*, que
   no es lo mismo.
3. **Registrar el remitente** (`preTokenBalances`/`postTokenBalances` del lado que paga, o el fee
   payer) para poder resolver disputas.

---

## C-2 · ✅ CORREGIDO · El rate limiting es evadible con una cabecera falsa, y con eso cae también la defensa de C-1

**Archivo:** `src/lib/payments/limits.ts:31-38`.

```ts
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();   // <-- el valor MÁS a la izquierda
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
```

**Qué es.** Se toma el elemento **más a la izquierda** de `x-forwarded-for`, que es exactamente la
parte que el cliente controla. Los proxies **agregan** a la derecha; el valor confiable es el
último hop, no el primero.

**Cómo se explota:**

1. `curl -H 'x-forwarded-for: 1.2.3.4' https://bidoor/api/bid ...`
2. Cambiar el valor en cada request. Cada uno cae en un bucket de rate limit distinto.
3. Los tres techos (`livePendingPerIp`, `createdPerIpPerWindow`, y el propio `hashIp`) quedan sin
   efecto: **el rate limiting es cosmético**.

**Consecuencia compuesta:** el paso 3 de C-1 dejaba de tardar 2,5 horas y pasa a tardar minutos.
Además habilita A-2 (agotamiento del espacio de fracciones) a costo cero.

**Fix propuesto.** Leer la IP de la cabecera que pone la plataforma y que el cliente no puede
falsificar (`x-vercel-forwarded-for`, `cf-connecting-ip`, `fly-client-ip`, según el host), o
configurar un número conocido de proxies confiables y tomar el N-ésimo desde la derecha. Nunca el
primero de la izquierda. Si no hay proxy identificable, fallar cerrado y no limitar por IP en
absoluto (usar otro mecanismo), en vez de simular que se limita.

---

# ALTO

## A-1 · ✅ CORREGIDO · El destino del click es mutable por el dueño del token — reintroduce exactamente el problema que la regla de acortadores existía para evitar

**Archivos:** `src/app/go/[id]/route.ts:15-20`, `src/components/BoardRow.tsx:51-53`,
`src/lib/dexscreener.ts:112-137`, `src/lib/store.ts` (top-up refresca `links` desde DexScreener).

**Qué es.** El destino del click es `entry.launchpadUrl ?? entry.links.website`. Desde que el launch
link es opcional (§13), muchas filas van a caer al segundo. Y `links.website` **se relee de
DexScreener en cada top-up**, es decir, lo controla el deployer del token, que puede cambiarlo cuando
quiera.

`REFERENCIA.md §5.3` y `DECISIONES.md #11` rechazan acortadores con este argumento textual: *"un
acortador es un destino mutable… pagás la moderación una vez con un link limpio, y después el dueño
lo repunta a un drainer"*. **Ese es exactamente el comportamiento actual vía DexScreener.**

**Cómo se explota:**

1. El atacante despliega un token real y barato, con par en cualquier DEX.
2. Lo lista pagando el mínimo ($1) con un `website` limpio en DexScreener. Si además pasa un link de
   `pump.fun`, la fila muestra el ✓ de launchpad verificado.
3. Deja pasar el tiempo, acumula clicks y credibilidad.
4. Cambia el `website` en DexScreener a un drainer de wallets.
5. `bidoor.tld/go/<id>` empieza a redirigir ahí. El dominio que aparece en el screenshot que la
   gente comparte sigue siendo el nuestro, y la fila sigue con su ✓.

**Fix propuesto.** Congelar el destino del click igual que se congela `launchpadUrl` (snapshot en la
primera puja, revisable solo por un operador), **o** no usar nunca `links.website` como destino y
dejar la fila sin link cuando no hay launch link. Adicionalmente: interstitial de salida mostrando el
dominio destino antes de redirigir, que es barato y corta el uso del dominio como blanqueador de
reputación.

## A-2 · ⚠️ ABIERTO · El techo por monto es un recurso compartido: 500 pujas bloquean a todo el mundo en el monto más popular

**Archivos:** `src/lib/payments/config.ts:68` (`livePendingPerAmount: 500`),
`src/lib/payments/limits.ts:106-120`.

**Qué es.** El límite de 500 pendientes por monto base no tiene sub-límite por atacante. Es un
recurso global, y el rechazo (`amount_saturated`) le llega a cualquiera que pida ese monto.

**Cómo se explota:**

1. El piso de puja ahora es **$1** (§13), así que es de lejos el monto más usado.
2. El atacante crea 500 pujas pendientes de $1. Con C-2 esto es gratis e instantáneo; incluso sin
   C-2, son 100 IPs × 5 pendientes vivas.
3. Durante 30 minutos, **toda puja legítima de $1 recibe "Too many bids of exactly $1 are waiting"**.
4. Repetir cada 30 minutos. Costo: cero dólares.

**Fix propuesto.** Que el techo por monto cuente **callers distintos**, no filas: p. ej. máximo 2
pendientes por (monto, caller) y un techo global mucho más alto. Alternativa complementaria: si el
monto está saturado, asignar automáticamente un monto base contiguo (`$1` → `$1` con otra fracción,
y si se agota, ofrecer `$2`) en vez de rechazar. Y subir el espacio de fracciones a 6 decimales
(USDC lo soporta) elimina la escasez de raíz.

## A-3 · 🟡 MITIGADO PARCIAL · La cola de pagos no coincidentes es escribible por cualquiera y sirve para engañar al operador

**Archivos:** `src/app/api/bid/[id]/verify/route.ts:62-70`,
`src/lib/payments/pending.ts:281-320`, `src/app/admin/AdminActions.tsx` (render de la cola).

**Qué es.** Cualquiera puede pegar **cualquier** firma contra **su propia** puja. Si esa transacción
realmente mandó USDC a nuestra wallet (aunque sea de otra persona y por otro monto), se registra en
`unmatched_payments` con `bid_id` = la puja **del atacante**.

**Cómo se explota:**

1. El atacante ve en la cadena que Alice transfirió `$120.5000` a nuestra wallet.
2. Crea una puja propia y pega la firma de Alice en `/api/bid/<su-id>/verify`.
3. Falla por monto, pero queda archivada como pago no coincidente **ligado a la puja del atacante**.
4. En `/admin`, el operador ve "recibido $120.50" y una lista de pujas candidatas. La del atacante
   figura ahí (es la más cercana si eligió bien el monto base).
5. Un click en "Apply" y la plata de Alice paga el puesto del atacante. La consola no muestra en
   ningún lado que ese `bid_id` fue elegido por quien pegó la firma, ni quién es el remitente real.

También sirve como **inundación de la cola**: pegar todas las firmas entrantes de la wallet llena
`unmatched_payments` de ruido hasta volverla inoperable.

**Fix propuesto.** (a) Mostrar el **remitente on-chain** de la transacción en la consola y exigir que
el operador lo coteje; (b) marcar visualmente que `bid_id` es un dato aportado por quien pegó la
firma, no una atribución del sistema; (c) exigir doble confirmación con el monto tipeado a mano;
(d) rate-limitar `/api/bid/[id]/verify` (ver A-4) para cortar la inundación.

## A-4 · 🟡 CORREGIDO EN PARTE · `/api/bid/[id]/verify` y `/api/token` no tienen ningún límite: quema de cuota de RPC y de DexScreener a pedido

**Archivos:** `src/app/api/bid/[id]/verify/route.ts` (sin `checkBidCreationLimits`),
`src/app/api/token/route.ts` (sin auth ni límite), `src/lib/payments/solana.ts:204-222`.

**Qué es.** La **creación** de pujas está limitada; la **verificación** no. Con un único `bid_id`
propio, un atacante puede llamar a verify sin tope. Cada llamada dispara hasta 4 peticiones al RPC
de Solana, con backoff (`400+800+1600 ms`), es decir **~2,8 segundos de conexión retenida por
request**.

**Cómo se explota:**

1. Crear una puja (una sola, dentro del límite).
2. Lanzar N peticiones concurrentes a `/api/bid/<id>/verify` con firmas bien formadas al azar.
3. Cada una consume 4 llamadas al RPC → la cuota del endpoint público se agota o nos banean la IP.
   **Con el RPC caído, ningún pago legítimo se puede verificar.** Denegación de servicio sobre el
   camino que genera ingresos.
4. En paralelo, `/api/token?chain=&address=` hace lo mismo contra DexScreener, que además es el
   único gate de existencia del producto.

**Fix propuesto.** Rate limit por caller **y** por `bid_id` en verify (p. ej. 10 intentos por puja,
1 cada 5 s), y un límite global de concurrencia hacia el RPC. `/api/token` debe limitarse por caller
y apoyarse más en la caché (hoy TTL 60 s, `dexscreener.ts:38`), o cachear también los negativos por
más tiempo.

---

# MEDIO

## M-1 · ⚠️ ABIERTO · La cookie de admin **es** el secreto maestro, y `secure` es condicional

**Archivos:** `src/app/api/admin/session/route.ts:20-29`, `src/lib/admin.ts:23-27`.

La cookie guarda el `ADMIN_TOKEN` **en crudo**. Es `httpOnly` ✓ y `sameSite: "strict"` ✓, pero:

- `secure: process.env.NODE_ENV === "production"` — en cualquier despliegue que no tenga
  `NODE_ENV=production` (staging, preview, un contenedor mal armado) el secreto maestro viaja por
  HTTP plano.
- `path: "/"` lo envía en **todas** las peticiones al origen.
- No es revocable: no hay sesión que invalidar, solo cambiar la env var y redeployar.
- El mismo valor sirve para `/api/reconcile`, así que filtrarlo entrega también el endpoint de cron.

**Fix.** Emitir un identificador de sesión aleatorio (o un HMAC firmado con el token, con expiración
embebida) en vez del token; `secure: true` siempre salvo en `localhost`; `path` acotado a `/admin` y
`/api/admin`; tabla de sesiones revocables.

## M-2 · ⚠️ ABIERTO · Sin límite ni registro de intentos en el login de admin

**Archivos:** `src/app/api/admin/session/route.ts`, `src/app/api/reconcile/route.ts`.

`POST /api/reconcile` con `x-admin-token` devuelve 401 vs 200: es un oráculo de fuerza bruta perfecto,
sin límite de intentos, sin bloqueo y sin log. Si `ADMIN_TOKEN` es una frase corta, se rompe.
`.env.example` tampoco exige entropía mínima.

**Fix.** Rate limit agresivo + backoff en cualquier ruta que valide el token; registrar los fallos;
documentar en `.env.example` que debe ser ≥32 bytes aleatorios; considerar restringir `/admin` por IP.

## M-3 · ⚠️ ABIERTO · `checkToken` filtra la longitud del token por timing

**Archivo:** `src/lib/admin.ts:11-20`.

```ts
if (a.length !== b.length) return false;   // retorno temprano
return timingSafeEqual(a, b);
```

La comparación del contenido es constante, pero el retorno por longitud no. Un atacante puede
distinguir "longitud incorrecta" de "longitud correcta, contenido incorrecto" y reducir el espacio de
búsqueda. Menor por sí solo; relevante junto con M-2.

**Fix.** `timingSafeEqual(sha256(candidate), sha256(expected))` — digests de longitud fija, sin
retorno temprano.

## M-4 · ⚠️ ABIERTO · La metadata de DexScreener se renderiza sin normalizar Unicode ni acotar longitud

**Archivo:** `src/lib/dexscreener.ts:185-201` (solo `.trim()` y `.toUpperCase()`).

No hay XSS — React escapa y no hay `dangerouslySetInnerHTML` (verificado). Pero el nombre y el ticker
los controla el deployer del token y se muestran tal cual en el board, en el formulario **y en la
consola de admin**:

- **Bidi override (U+202E)** reordena visualmente la fila y puede hacer que un nombre se lea como
  otro, incluido dentro de `/admin` donde el operador toma decisiones.
- **Homoglyphs** (`ВONK` con В cirílica) suplantan tokens conocidos. El dedupe por contrato hace que
  sean filas distintas, pero visualmente son idénticas.
- **Zero-width** permite tokens con nombres indistinguibles entre sí.
- Sin tope de longitud: `truncate` salva el layout, no la ambigüedad.

**Fix.** Normalizar a NFKC, eliminar controles bidi y zero-width, acotar a ~32/12 caracteres y marcar
las filas cuyo nombre haya sido alterado por el saneamiento.

## M-5 · ✅ CORREGIDO · Una puja puede liquidarse dos veces en carrera: falta `UNIQUE` sobre `payments.bid_id`

**Archivos:** `src/lib/payments/db.ts:66-74`, `src/app/api/bid/[id]/verify/route.ts:42-50, 89-97`.

`payments.signature` es `UNIQUE`, pero `bid_id` no. El chequeo `bid.status === 'paid'`
(`route.ts:42`) es un *check-then-act*: dos peticiones concurrentes con **firmas distintas** para la
**misma puja** lo pasan las dos, ambas insertan en `payments`, ambas llaman a `placeBid` y ambas
escriben en `accepted_bids`. La puja se aplica al board dos veces.

Económicamente no es robo (pagaron dos veces), pero es una inconsistencia de integridad en el
componente que lleva la cuenta del dinero, y el mismo patrón se repite en la ruta de admin.

**Fix.** `UNIQUE` sobre `payments.bid_id`, o envolver verificación + claim + aplicación en una única
transacción con `UPDATE pending_bids SET status='paid' WHERE id=? AND status<>'paid'` y comprobar
`changes === 1`.

## M-6 · ⚠️ ABIERTO · El salt del hash de IP tiene default vacío

**Archivo:** `src/lib/payments/config.ts:79`.

`RATE_LIMIT_SALT ?? ""` — sin salt, el hash SHA-256 de una IPv4 es reversible por fuerza bruta
(2³² preimágenes, minutos en una GPU). El comentario lo dice honestamente, pero el default inseguro
es lo que va a correr en producción salvo que alguien se acuerde. La base pasa a contener, en la
práctica, un registro de las IPs de los visitantes.

**Fix.** Generar un salt aleatorio al inicializar la base y persistirlo, o fallar el arranque si no
está seteado en producción. Considerar además truncar el hash y expirar `ip_hash` a los 30 días.

---

# BAJO

## B-1 · ✅ CORREGIDO · `.env.example` no está versionado

**Archivo:** `.gitignore:32` — el patrón `.env*` también matchea `.env.example`
(`git check-ignore` lo confirma; `git ls-files` devuelve 0 resultados).

Toda la documentación de secretos obligatorios (`PAYMENT_WALLET` sin default, `ADMIN_TOKEN`,
`RATE_LIMIT_SALT`) **nunca llega a quien despliega**. Es una causa clásica de despliegue mal
configurado, y aquí un `PAYMENT_WALLET` ausente frena los pagos pero un `RATE_LIMIT_SALT` ausente
pasa desapercibido.

**Fix.** `!.env.example` en `.gitignore` y commitearlo.

## B-2 · ✅ CORREGIDO DE HECHO · Enumeración de transferencias mediante los mensajes de error

**Archivo:** `src/lib/payments/solana.ts:179-183`.

El mensaje devuelve `formatUsdc(received)` — el monto exacto que movió una transacción arbitraria.
Convierte al endpoint en un oráculo: "¿esta firma mandó USDC a su wallet, y cuánto?". La información
ya es pública en la cadena, así que el impacto es bajo, pero acelera el reconocimiento para C-1.

**Fix.** Devolver el monto solo cuando la firma corresponda a una transacción posterior a la creación
de la puja (que es el fix de C-1 de todos modos).

## B-3 · ⚠️ ABIERTO · La frontera cliente/servidor depende de un `import type` sin verificación

**Archivo:** `src/app/bid/[id]/PaymentPanel.tsx:6`.

`import type { PendingStatus } from "@/lib/payments/pending"` funciona porque los tipos se borran.
Cambiarlo por un import de valor arrastraría `node:sqlite` y la capa de pagos al grafo del cliente.
Hoy el bundle está limpio (verificado: ni `ADMIN_TOKEN` ni el salt aparecen en `.next/static`), pero
nada lo impide en el futuro.

**Fix.** Mover los tipos compartidos a un módulo sin dependencias de servidor, o añadir un
`server-only` guard en `payments/*`.

## B-4 · ⚠️ ABIERTO · Código muerto en la ruta de pagos

**Archivo:** `src/lib/payments/pending.ts:178` — `reopen()` no se llama desde ningún lado.

Una función exportada que reabre pujas fallidas, sin usar y sin tests de seguridad alrededor, es una
puerta que alguien puede cablear más adelante sin revisar sus implicancias.

**Fix.** Borrarla, o usarla y testearla.

---

# Los 5 que arreglaría ANTES de tocar plata real

Por orden. Los dos primeros son innegociables.

1. **C-1 — exigir `blockTime >= bid.createdAt` y reservar las firmas vistas.** Es el único hallazgo
   que permite quedarse con el dinero de otro. Sin esto, cada pago no coincidente que archivemos es
   un premio esperando a que alguien lo coseche. El fix mínimo (pedir `blockTime` y compararlo) son
   unas 10 líneas.
2. **C-2 — dejar de confiar en el `x-forwarded-for` de la izquierda.** Mientras siga así, el rate
   limiting no existe, y todo lo que depende de él (el costo de C-1, A-2, A-4) se derrumba.
3. **A-1 — congelar el destino del click.** Es la superficie que convierte nuestro dominio en
   infraestructura de phishing, con el agravante de que ya escribimos en las reglas por qué los
   destinos mutables son inaceptables.
4. **A-4 — rate limit en verify y en `/api/token`.** Un atacante puede dejar sin servicio el camino
   de cobro por unos centavos de tráfico.
5. **M-5 — `UNIQUE` sobre `payments.bid_id` (o liquidación transaccional).** Es barato y elimina una
   inconsistencia en el componente que lleva la cuenta de la plata.

A-3 y M-1/M-2 los pondría inmediatamente después, antes de darle la consola a un operador que no sea
uno de nosotros.

---

# Lo que está sólido

No es relleno: son controles que verifiqué leyendo el código y que resisten el modelo de amenaza.

- **SQL: sin inyección.** Las 22 sentencias preparadas de `payments/*.ts` pasan todos los valores por
  binding. No hay una sola interpolación de string dentro de una consulta, ni siquiera en `ORDER BY`
  o `LIMIT`, que es donde suele colarse.

- **Sin SSRF.** Ninguna URL controlada por el usuario se busca desde el servidor. Los únicos fetches
  salientes son DexScreener (host fijo, address con `encodeURIComponent`) y el RPC de Solana
  (endpoint de configuración). La decisión de **rechazar** acortadores en lugar de resolverlos
  (`DECISIONES.md #11`) fue la correcta y es precisamente lo que evita el SSRF aquí.

- **Sin XSS.** No hay `dangerouslySetInnerHTML` ni `innerHTML` en todo `src/`. React escapa por
  defecto. El único `<img>` con origen remoto tiene el host restringido al CDN de DexScreener
  (`dexscreener.ts:95-103`), y el chequeo de sufijo está bien hecho: `evil-dexscreener.com` no pasa
  porque exige el punto separador. El mismo patrón correcto está en `hostMatches` y tiene un test que
  cubre `pump.fun.evil.com`.

- **El núcleo del verificador de pagos es correcto en lo que sí comprueba.** Leer *deltas de balance*
  en vez de instrucciones es la decisión técnica acertada y responde bien las preguntas del encargo:
  múltiples transfers en una tx se netean correctamente; una CPI anidada produce el mismo delta que
  un transfer directo; una tx que nos manda fondos y se los lleva en otra instrucción da delta 0 y
  falla; y como `err !== null` rechaza la transacción entera, no existe el caso de "instrucción
  parcialmente cancelada" (en Solana una tx fallida no aplica ningún cambio de estado). El mint de
  USDC está hardcodeado a propósito (`config.ts`) y la wallet se compara por igualdad exacta de
  string, así que **una wallet parecida no matchea**.

- **Unicidad de firma garantizada por la base.** `payments.signature UNIQUE` con el claim ejecutado
  **antes** de tocar el board. Hay un test que fuerza el insert duplicado saltándose el helper para
  probar que la garantía es del motor y no del código. Un operador tampoco puede gastar una firma dos
  veces: la ruta de admin pasa por el mismo `recordPayment`.

- **CSRF razonablemente cubierto.** `sameSite: "strict"` impide que una petición cross-site lleve la
  cookie de admin, y las acciones son POST con JSON. No hay token CSRF ni chequeo de `Origin`, así
  que la protección descansa enteramente en el navegador — aceptable hoy, pero es una sola capa.

- **Secretos fuera del bundle.** Verificado empíricamente: compilando con `ADMIN_TOKEN` y
  `RATE_LIMIT_SALT` conocidos, ninguno aparece en `.next/static`. Ningún componente `"use client"`
  importa `payments/config`, `admin`, `db`, `store` ni `dexscreener`. Los `.env` no están versionados
  (aunque ver B-1).

- **La identidad de una entrada no la escribe quien paga.** Nombre, ticker, logo y sociales vienen de
  DexScreener; `launchpadUrl`, `launchpadHost` y `launchpadVerified` se congelan en la primera puja y
  el top-up no los toca, con test que lo cubre. **No encontré ningún camino para que un top-up robe
  la metadata de una entrada ajena** — la pregunta del encargo tiene respuesta negativa. El riesgo
  residual está desplazado al deployer del token (A-1, M-4), no al pujador.

- **No hay forma de manipular el ranking sin pagar.** `placeBid` solo se invoca desde la ruta de
  verificación, la de admin y el reconcile; las tres exigen un pago liquidado o el token de admin.
  Crear una puja pendiente no toca el board (verificado end-to-end).

- **El delist no revive totales viejos.** El rebuild descarta las pujas con `createdAt <=
  delistedAt`, así que un relisting arranca de cero sin borrar el historial. Con test.

---

## Nota final sobre alcance

No se auditó: dependencias de terceros (`npm audit`), configuración del hosting (cabeceras de
seguridad, HSTS, CSP — **no hay ninguna configurada**, lo cual amerita su propia revisión), backups y
cifrado en reposo de `data/bidoor.db` (contiene `ip_hash` y el historial completo de pagos), ni el
manejo operativo de la wallet de cobro, que por diseño vive fuera de este proyecto.

---

# Estado de remediación

Aplicado en la tanda posterior a esta auditoría. Todo lo de abajo tiene tests, y los dos críticos
tienen tests que se verificó que **fallan sin el fix**.

## Corregido

**C-1 — La transacción ahora está atada a la ventana de la puja, y la firma se quema al evaluarse.**
`SolanaTransaction` incorpora `blockTime` y `verifyPayment` recibe `createdAtMs`/`expiresAtMs`
(`solana.ts`). Una transacción fuera de esa ventana se rechaza con `outside_bid_window`, y una sin
`blockTime` con `no_block_time` — no se adivina a favor del que paga, que es justo el agujero.
Tolerancia de 120 s por desfase de reloj entre nuestro servidor y el clúster.

Además se revirtió la decisión #42: `claimSignature` (`pending.ts`) inserta en
`consumed_signatures` (PK sobre la firma) **antes** de actuar sobre el resultado, coincida o no. Un
pago no coincidente se sigue archivando para soporte, pero su firma queda gastada, así que deja de
ser un instrumento al portador.

Dos caminos NO queman la firma, deliberadamente: RPC inalcanzable y transacción aún no confirmada.
No son veredictos, y quemar ahí dejaría que un nodo lento destruya un pago real. Está testeado.

*Tests:* `signature-binding.test.ts` — 16 casos. Verificado que con la ventana desactivada fallan
3 (`REJECTS a transfer made before the bid existed`, la variante de cosecha a 90 días, y la
posterior a la expiración), y que con el quemado en modo viejo falla `burns the signature on a
MISMATCH too`.

**C-2 — La IP se lee desde la derecha, y se falla cerrado.** `clientIp` (`limits.ts`) devuelve ahora
un `ClientIdentity`, prefiere cabeceras que pone la plataforma (`cf-connecting-ip`, `true-client-ip`,
`x-vercel-forwarded-for`, `fly-client-ip`) y, si no, toma de `x-forwarded-for` la entrada que agregó
nuestro propio proxy, contando desde la derecha según `TRUSTED_PROXY_HOPS` (default 1, que es lo de
Vercel y Cloudflare).

Sin cabecera confiable **se falla cerrado**: la creación de pujas devuelve 503 en lugar de caer a un
bucket compartido, porque un bucket compartido para todos los anónimos es o una barra libre o una
caída autoinfligida. `ALLOW_UNTRUSTED_CLIENT_IP=true` es la salida explícita para desarrollo local.
Se dejó de leer `x-real-ip`, que el cliente también puede poner.

*Tests:* `limits.test.ts` — incluye el ataque concreto: tres requests con `x-forwarded-for`
falsificado distinto deben caer todas en **un solo** bucket. Verificado que vuelve a fallar si se
lee por izquierda.

**A-1 — El destino del click se congela al crear la entrada.** `Entry.clickUrl` se fija una vez, en
la primera puja, y ni un top-up ni un cambio del deployer en DexScreener lo mueven. Una entrada
creada sin destino no adopta un `website` que aparezca después. `/go/[id]` y `BoardRow` leen solo ese
campo.

*Tests:* `hardening.test.ts` — el caso central es el deployer que cambia su website por un drainer y
paga $1 para forzar el refresco: los links mostrados se actualizan, el destino del click no.

**A-4 (parcial) — Rate limit en `/verify`.** `checkVerificationLimits` acota por puja (10 por
ventana de 10 min), por caller (30) y con un intervalo mínimo de 3 s entre intentos sobre la misma
puja, registrado en `verification_attempts`. Se chequea **antes** de cualquier trabajo saliente. El
backoff del RPC pasó a 3 intentos con techo de 1,2 s por paso, así que un request no puede retener un
worker mucho tiempo; los reintentos son secuenciales y nunca multiplicaron conexiones concurrentes.

**M-5 — `UNIQUE` sobre `payments.bid_id`.** El check de `status === 'paid'` era un check-then-act y
perdía contra un request concurrente; la constraint no. `recordPayment` distingue ahora
`bid_already_paid` de `signature_used`.

**B-1 — `.env.example` se versiona.** `!.env.example` en `.gitignore`. Se documentaron además
`TRUSTED_PROXY_HOPS` y `ALLOW_UNTRUSTED_CLIENT_IP`.

**B-2 — Resuelto de hecho.** El oráculo de montos requería que el verificador llegara a evaluar el
balance; ahora una transacción fuera de la ventana se rechaza antes, así que ya no se puede consultar
una transacción arbitraria.

## Cambio de comportamiento a comunicar

El quemado de firma en el camino de mismatch **cambia el trato**: antes se le decía al usuario que
podía reintentar con la misma firma. Ahora no puede — la firma queda gastada y la recuperación pasa
sí o sí por soporte. El copy de la pantalla de pago y de Rules debería reflejarlo antes de lanzar; es
más seguro pero es más áspero, y prometer un reintento que ya no existe sería peor que ambas cosas.

## Sigue abierto

Por orden de lo que pesa: **A-2** (500 pujas pendientes bloquean el monto de $1 para todos),
**A-3** (la cola de unmatched no muestra el remitente on-chain, así que un operador puede ser
inducido a aplicar plata ajena — mitigado en parte porque la firma ya está quemada y el atacante no
puede además reclamarla él), **M-1/M-2/M-3** (la cookie de admin **es** el secreto maestro, sin
límite de intentos ni registro, y con fuga de longitud por timing), **M-4** (metadata de DexScreener
sin normalizar Unicode ni acotar longitud), **M-6** (salt de IP con default vacío), **B-3** y **B-4**.

## Tanda aparte — BLOQUEANTE DE DEPLOY, no implementada

Estas dos no se tocaron en esta remediación y **no deberían pasar a producción sin resolverse**:

1. **Cabeceras de seguridad.** Hoy no hay **ninguna** configurada. Faltan como mínimo:
   `Content-Security-Policy` (el sitio carga imágenes de un CDN externo y no tiene CSP, así que
   cualquier inyección futura no tiene contención), `Strict-Transport-Security`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy` a nivel documento y `Permissions-Policy`.
   Se configuran en `next.config.ts` con `headers()`.
2. **Cifrado en reposo de `data/bidoor.db`.** La base contiene el historial completo de pagos, las
   firmas consumidas y los `ip_hash` de los visitantes (con M-6 abierto, esos hashes son
   efectivamente IPs). Hoy es un archivo en disco sin cifrar y sin política de backup ni de
   retención. Definir: dónde vive, quién puede leerlo, cada cuánto se respalda, cómo se restaura y
   cuánto tiempo se guardan los `ip_hash`.

