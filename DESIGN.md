# DESIGN — Patrones tomados de outbid.lol

Relevado con Firecrawl el 2026-08-21: screenshot renderizado (desktop 1440×1200 y mobile 390×900)
más lectura de su hoja de estilos para extraer valores exactos.

**Qué se tomó y qué no.** Se extrajeron *valores y patrones* (paleta, escala tipográfica, densidad,
jerarquía). No se copió ningún archivo CSS/JS, ningún asset, ni su marca. Las dos tipografías que
usan son gratuitas y las usamos directamente desde Google Fonts. El acento y varios detalles se
cambiaron a propósito: esto es el punto de partida, no el destino.

---

## 1. Paleta

Su tema por defecto es **claro, cálido** (crema, no blanco puro) con un tema oscuro disponible por
toggle. Valores exactos leídos de su CSS:

| Rol | Claro | Oscuro |
|---|---|---|
| `background` | `#fffdfa` | `#1a1512` |
| `card` / `popover` | `#fffdfa` (sidebar `#fbfaf7`) | `#231e1b` |
| `muted` / `secondary` / `accent` | `#f6f3ef` | `#2d2824` |
| `foreground` | `#282624` | `#f7f5f1` |
| `muted-foreground` | `#67625d` | `#aba39b` |
| `border` | `#e6e0da` | `#ffffff1a` (blanco 10%) |
| `input` | `#e6e0da` | `#ffffff26` (blanco 15%) |
| `primary` / `ring` | `#e57255` | `#e57255` |
| `primary-foreground` | `#ffffff` | `#ffffff` |
| `destructive` | `#e40014` | `#ff6568` |

**Lo importante no es el coral, es la temperatura.** Ningún gris es neutro: todos tienen
desplazamiento cálido. Un `#fafafa` genérico al lado de esto se ve azul y muerto. El acento es un
único color aplicado con disciplina — precio, rank, CTA, links — y nada más.

**Lo que cambiamos:** el acento. Ellos usan coral `#e57255`. Nosotros usamos un persimmon más
saturado y un dorado para el #1, más el sistema de color por chain que ellos no necesitan. La base
cálida se mantiene: es la "familia".

## 2. Tipografía

- Sans: **DM Sans** (Google Fonts, gratis) — la usamos igual.
- Mono: **Geist Mono** (open source, en Google Fonts) — la usamos igual, para toda cifra.
- Escala (rem): `xs .75` · `sm .875` · `base 1` · `lg 1.125` · `xl 1.25` · `2xl 1.5` · `4xl 2.25` · `6xl 3.75`
- Pesos en uso: 400 / 500 / 700. No hay pesos intermedios.

El precio del hero va en el peso más pesado disponible y es, por lejos, el elemento más grande de
la página. Todo lo demás es `sm` o `base`.

## 3. Layout y contenedor

- **Ancho del contenedor: `56rem` (896px)**, con `1rem` de padding lateral → contenido útil 864px.
  Centrado. En 1440px de viewport eso deja aire a los costados, pero el contenido *llena* su
  columna: filas de borde a borde, cards en grilla de 2.
- Unidad de espaciado base `0.25rem`.
- Radio: `0.875rem` (14px). Es un radio grande — todo se siente redondeado y blando, no técnico.

> **Esto resuelve nuestro problema de "columna angosta":** estábamos en `42rem` (672px). El salto a
> `56rem` más contenido que llena el ancho (grilla de 2 cards, filas anchas) es la diferencia.

## 4. Jerarquía del hero

De arriba a abajo, todo centrado:

1. **Píldora de estado** — `rounded-full`, fondo `muted`, texto `sm`: gente online · visitas
   acumuladas · link a stats. Con un punto verde. Es prueba social antes que nada.
2. **Título-precio** — `Claim #1 for $12664` en una sola línea, ~48px, peso 700. El monto va en
   `primary`; el resto en `foreground`. A los lados del monto, dos botones redondos chiquitos
   `−` / `+` para tantear montos.
3. **Subtítulo** — dos líneas, `sm`, `muted-foreground`, centrado, con la primera frase
   ("New spots start at $5.") en `primary`.
4. **Fila de acción** — input grande `rounded-full` con ícono a la izquierda + botón `Outbid`
   `rounded-full` en `primary`. En desktop van lado a lado; en mobile el botón pasa abajo, full width.
5. **Nota auxiliar** — `xs`/`sm` en `muted-foreground`, centrada.

## 5. Densidad de filas

Dos tratamientos distintos, y esa distinción es el corazón del diseño:

**Top 3 — son cards, no filas.**
- Card con borde y fondo teñido de `primary` (~8% de opacidad), `rounded-[14px]`.
- Separadas entre sí por ~16px de gap.
- Alto ≈ 100–110px. Padding interno ~16–20px.
- Contenido: píldora de rank (`#1`, fondo `primary`, texto blanco) · logo 56px redondo · nombre
  (base, peso 700) · descripción de 2 líneas (`sm`, muted) · línea meta (`xs`: antigüedad · clicks) ·
  precio a la derecha (`lg`, peso 700, `primary`).

**Divisor `TOP 3`** — una píldora chiquita centrada con líneas horizontales a los lados.

**Resto — filas planas.**
- Sin fondo, sin card. Solo separador `border-bottom` de 1px.
- Alto ≈ 90px. Rank en `muted-foreground` sin píldora. Logo 48px.
- Mismo esqueleto de contenido, un escalón más apagado.

> El contraste card-vs-fila es lo que hace que el top 3 se lea como "el podio" en un screenshot sin
> necesidad de medallas ni oro.

## 6. Módulos secundarios

Dos cards lado a lado bajo el hero, grilla de 2 columnas en desktop, apiladas en mobile:
- **Trending right now** — top por clicks/hora. Segundo eje de ranking, deliberadamente chico.
- **Latest activity** — últimas pujas: quién, a qué puesto, cuánto, hace cuánto.

Filas internas de ~32px, separadas por líneas de 1px, con avatar 20px.

## 7. Mobile

- El contenedor pasa a full width con padding lateral de `1rem`.
- El hero baja a ~40px y mantiene precio y label en la misma línea.
- Input y botón se apilan; el botón va full width.
- Las dos cards secundarias se apilan y se **truncan con un botón "Show more"** en lugar de crecer.
- Las cards del top 3 mantienen su tratamiento; solo se aprieta el padding.

> **Divergencia deliberada nuestra:** en su mobile el top 1 arranca recién a ~770px, así que el top
> 3 **no** entra en una pantalla de teléfono. Para nosotros eso es un requisito (el producto se
> comparte por screenshot), así que nuestro hero es más compacto en mobile y los módulos
> secundarios van después del board, no antes. Es la única desviación grande de su estructura, y es
> a propósito.

## 8. Cómo se aplica esto en nuestro código

Todo lo de arriba vive en **`src/app/tokens.css`** y solo ahí: color, tipografía, espaciado, radios,
alturas de fila, ancho de contenedor. Los componentes no llevan ni un color ni un tamaño
hardcodeado — consumen `var(--…)` vía el mapeo `@theme` de Tailwind. Cambiar la identidad más
adelante es editar ese archivo, no recorrer componentes.

---

## 9. Duotono azul + verde (paleta actual)

Reemplaza el magenta sobre crema. **Dos familias y nada más**: no hay negro, gris, blanco ni crema
en ninguna parte. El rol de "oscuro" lo cumple el extremo profundo del azul y el de "claro" el
extremo pálido del verde, así que las dos rampas cargan también lo que normalmente hace un neutro
en silencio: bordes, texto secundario, fondos de card.

| Rol | Valor | Contraste sobre el fondo |
|---|---|---|
| fondo | `#002B66` | — |
| card | `#003D80` | — |
| texto | `#E8FFA8` verde pálido | 12.55 |
| muted | `#7FDCF7` | 8.77 |
| faint | `#41C6F0` | 6.87 |
| **slime** (plata y acción) | `#C6FF00` | 11.52 · 8.95 sobre card |
| **celeste** (estructura y navegación) | `#00A8F0` | 5.11 |
| tinta sobre slime | `#002B66` | 11.52 |

La división es estricta: **slime sólo para dinero y acción** (montos, el CTA, los pills de rank, la
fila del #1) y **celeste sólo para estructura y navegación** (links, el "OOR" del wordmark, los dots
de los paneles, marcas de verificado, estado secundario). Nunca los dos en el mismo elemento.

### Un solo tema, a propósito

Se eliminó el tema claro. La paleta prohíbe el crema, así que no hay de qué hacerlo — un segundo
tema tendría que romper justamente la regla que la paleta existe para sostener. `tokens.css` ya no
tiene bloques de `prefers-color-scheme` ni de `data-theme`.

### Dos excepciones documentadas

1. **El rojo de error se queda.** No pertenece a ninguna familia, y aun así se queda: una pantalla
   de pago donde el mensaje de fallo tiene el mismo color que todo lo demás es una pantalla donde la
   gente no ve el fallo. Es semántica, no paleta. `#FF8A95`, 6.06 sobre el fondo.
2. **Los chips de chain conservan su color.** El chip codifica en qué chain está el token, que es
   información que un screenshot no puede recuperar de otro modo.

   Acá hubo que rehacerlos, y el número lo mostró: los tintes por chain estaban construidos para el
   marrón cálido anterior y contra el azul quedaban en **1.09–1.24**, o sea que cada chip se disolvía
   en la página. Ahora el tinte es uniforme (`#001A40`, un paso más profundo que el fondo, así el
   chip se lee hundido) y **la identidad de la chain vive en la tinta**, que va de 5.65 a 11.41.

---

## 10. Base neutra + dos temas (paleta actual)

Reemplaza el duotono. Las dos rondas duotono fracasaron por la misma razón de
fondo: **cuando el acento carga toda la página, no le queda nada contra qué
destacarse.** Acá el suelo y la tipografía vuelven a ser neutros y los dos
acentos se gastan a propósito.

| | Oscuro (default) | Claro |
|---|---|---|
| fondo | `#0F1316` pizarra fría | `#FFFDFA` crema |
| card | `#2C353F` (**1.50** del fondo) | `#E9E3D9` (1.26 + borde + sombra) |
| lift | `#43505F` (1.51) | `#DBD3C5` |
| texto | `#F1F5F8` — 17.03 / 11.35 | `#1A1714` — 17.58 / 13.98 |
| muted | `#C8D1D8` — 12.06 / 8.04 | `#4E4740` — 9.00 / 7.16 |
| faint | `#AAB6BE` — 9.02 / 6.01 | `#6B6359` — 5.82 / 4.63 |
| celeste | `#00A8F0` — 6.99 / 4.66 | `#00658F` — 6.35 / 5.05 |
| slime | `#C6FF00`, relleno, tinta `#141210` a 15.76 | idéntico |

Los ratios son *página / card*. Todo se mide contra las dos: chequear sólo la
página fue lo que dejó los chips de chain en 1.1:1 en la ronda anterior.

### Cómo se le permite aparecer al slime

El slime da **1.17:1 sobre crema**. Eso no es un contraste para ajustar, es un
color que no está — bajarlo a AA da `#637F00`, un verde oliva que ya no es
slime. Así que el slime **nunca es color de letra**: aparece como relleno con
tinta oscura encima, y sólo en tres lugares.

1. La cifra del título.
2. La acción primaria (todos los `bg-accent` van con `text-accent-ink`).
3. La fila del #1 — pill de rank, monto, y una barra de 5px al costado.

Los montos comunes son tipografía neutra con peso. Un acento gastado en las
cincuenta filas deja de ser un acento, y sobre crema encima sería ilegible.

### El celeste tenía el mismo problema, menos evidente

`#00A8F0` sobre crema da **2.63**. La diferencia con el slime es que **el
celeste sobrevive a oscurecerse y el slime no**, así que en claro pasa a
`#00658F` y sigue siendo letra. El valor se ajustó desde el `#007DB3` de la
exploración: ése estaba medido contra la página y sobre card caía a 3.59.

### Un tema, una declaración

`light-dark()` mantiene los dos valores en la misma línea, así los temas no
pueden separarse como se separan dos bloques duplicados. `color-scheme` lista
`dark` primero: sin señal, renderiza oscuro. `data-theme` fuerza cualquiera de
los dos.

### Profundidad

En oscuro las capas van a **1.50**, la lección de la ronda A: una card es un
escalón, no un tinte. La crema no puede igualarlo y no debería fingirlo — ya
está en 0.98 de luminancia, no hay lugar por arriba, y una card 1.45 por debajo
cae en `#D9D4CA` y lee sucia. En claro la separación es 1.26 más borde y sombra
proyectada. Es una diferencia deliberada.

### Las dos excepciones siguen

El rojo de error (`#FF8A95` / `#945056`) y los chips de chain. Los chips ahora
necesitan **dos juegos de tinta**: los brillantes dan 1.26 sobre un chip claro,
así que la crema tiene el suyo oscurecido. Oscuro pasa 6.74 en el peor caso,
claro 5.01.

### 10.1 Un solo acento (simplificación posterior)

El celeste sale. **El slime `#C6FF00` es el único acento de la marca.**

Todo lo que era celeste se resuelve ahora sin color de acento: los links son
tipografía base que se subraya al hover, el nav es texto neutro, los dots de los
paneles son `muted` y `faint`, los estados de "verificado" y "pago confirmado"
son texto con peso. **Nada de lo que perdió el celeste recibió slime como
consuelo** — si un elemento no califica para relleno slime, va neutro.

La regla del slime no cambió: relleno con tinta oscura encima, sólo en el título,
el CTA y la fila del #1. En la home aparece cuatro veces y ninguna más.

**Wordmark:** "BIDOOR" entero en un color. Se probó "OOR" en slime-relleno y el
bloque queda más grande y más a la izquierda que el CTA, así que se lee primero
y le roba el trabajo — en la misma fila, dos slimes compiten. Capturas en
`design-compare/wordmark-A-un-color.png` y `-B-oor-slime.png`.

**Corrección de contraste que salió de esta tanda.** Las tintas estaban medidas
contra la página y la card, pero no contra `surface-2`, que es un fondo real —
pills, la preview de token, los paneles del admin. Sobre esa tercera capa
`faint` daba 3.98 y `danger` 3.65: fallaban. Es la misma clase de error que dejó
los chips en 1.1:1, una capa más abajo. Ahora las tres capas se miden siempre.

| tinta | claro (page/card/lift) | oscuro (page/card/lift) |
|---|---|---|
| texto `#1A1714` / `#F1F5F8` | 17.58 / 13.98 / 12.01 | 17.03 / 11.35 / 7.51 |
| muted `#4E4740` / `#C8D1D8` | 9.00 / 7.16 / 6.15 | 12.06 / 8.04 / 5.32 |
| faint `#605950` / `#B7C4CD` | 6.80 / 5.41 / 4.65 | 10.48 / 6.98 / 4.62 |
| danger `#86484E` / `#FFB0B8` | 6.78 / 5.39 / 4.63 | 10.80 / 7.20 / 4.76 |

Chips de chain: 5.01 mínimo en claro, 6.74 en oscuro. Tinta sobre slime: 15.76.

