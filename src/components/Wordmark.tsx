/**
 * The bidoor.lol wordmark: heavy geometric italic, chamfered corners, leaning
 * 12°. Drawn as paths rather than set in a typeface, so it is the same shape on
 * every machine and the brand is legible before any font loads.
 *
 * Lowercase and even: the name and the TLD are the same size, so it reads as
 * one word rather than a name with a label bolted on. Every letter is the
 * theme's own text colour and the only accent is the dot, a filled circle
 * rather than the square period the rest of the type would give it.
 *
 * The dot is decoration, not type — it carries no glyph, so it never has to
 * clear a contrast ratio. That is exactly why slime is allowed there on cream,
 * where slime letters would be 1.17:1 and invisible.
 */
const NAME_D =
  "M0.00,0 L26.00,0 L26.00,32 L58.00,32 L74.00,46 L74.00,86 L58.00,100 L0.00,100 Z M26.00,52 L50.00,52 L50.00,80 L26.00,80 Z M84.00,4 L110.00,4 L110.00,26 L84.00,26 Z M84.00,32 L110.00,32 L110.00,100 L84.00,100 Z  M168.00,0 L194.00,0 L194.00,100 L136.00,100 L120.00,86 L120.00,46 L136.00,32 L168.00,32 Z M144.00,52 L168.00,52 L168.00,80 L144.00,80 Z M220.00,32 L262.00,32 L278.00,46 L278.00,86 L262.00,100 L220.00,100 L204.00,86 L204.00,46 Z M228.00,52 L254.00,52 L254.00,80 L228.00,80 Z M304.00,32 L346.00,32 L362.00,46 L362.00,86 L346.00,100 L304.00,100 L288.00,86 L288.00,46 Z M312.00,52 L338.00,52 L338.00,80 L312.00,80 Z M372.00,32 L426.00,32 L426.00,56 L398.00,56 L398.00,100 L372.00,100 Z";
const TLD_D =
  "M0.00,0 L26.00,0 L26.00,100 L0.00,100 Z  M52.00,32 L94.00,32 L110.00,46 L110.00,86 L94.00,100 L52.00,100 L36.00,86 L36.00,46 Z M60.00,52 L86.00,52 L86.00,80 L60.00,80 Z M120.00,0 L146.00,0 L146.00,100 L120.00,100 Z";

const NAME_W = 426;
const TLD_W = 146;
const DOT_R = 13;
const DOT_CX = NAME_W + 22;
const DOT_CY = 100 - DOT_R;
const TLD_X = DOT_CX + DOT_R + 18;
const TOTAL = TLD_X + TLD_W;

const SKEW = 12;
const TAN = Math.tan((SKEW * Math.PI) / 180);
/** Room for the lean, so the leading edge is not clipped. */
const LEAN = 100 * TAN;

export function Wordmark({ height = "1.5rem", className = "" }: { height?: string; className?: string }) {
  return (
    <svg
      viewBox={`${-LEAN - 4} -10 ${TOTAL + LEAN + 20} 120`}
      role="img"
      aria-label="bidoor.lol"
      className={`block shrink-0 ${className}`}
      style={{ height, width: "auto" }}
    >
      <g transform={`skewX(-${SKEW})`} fill="currentColor" fillRule="evenodd">
        <path d={NAME_D} />
        <g transform={`translate(${TLD_X},0)`}>
          <path d={TLD_D} />
        </g>
      </g>
      {/* Outside the skew on purpose: a leaning circle is an ellipse, and the
          one round shape in a wordmark made of straight cuts should stay round.
          Light gets a thin ink ring because slime is 1.17 on cream; dark, where
          it is already 15.74 on the ground, gets none. */}
      <circle
        cx={DOT_CX - DOT_CY * TAN}
        cy={DOT_CY}
        r={DOT_R}
        fill="var(--bd-accent)"
        stroke="var(--bd-wordmark-dot-ring)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
