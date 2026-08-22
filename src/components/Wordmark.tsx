/**
 * The BIDOOR.LOL wordmark: heavy geometric italic, chamfered corners, leaning
 * 12°. Drawn as paths rather than set in a typeface, so it is the same shape on
 * every machine and the brand is legible before any font loads.
 *
 * Every letter is one colour — the theme's own text colour. The single piece of
 * accent is the dot between the name and the TLD, and it is a filled circle
 * rather than the square period the rest of the type would give it.
 *
 * That dot is decoration, not type: it carries no glyph, so it never has to
 * clear a contrast ratio, which is exactly why slime is allowed to be there on
 * cream where slime letters would be 1.17:1 and invisible.
 */
const BI_D =
  "M0,0 L58,0 L74,16 L74,36 L64,50 L74,64 L74,84 L58,100 L0,100 Z M26,20 L48,20 L48,40 L26,40 Z M26,60 L48,60 L48,80 L26,80 Z M84,0 L110,0 L110,100 L84,100 Z";
const DOOR_D =
  "M0,0 L58,0 L76,20 L76,80 L58,100 L0,100 Z M26,22 L50,22 L50,78 L26,78 Z M104,0 L144,0 L162,20 L162,80 L144,100 L104,100 L86,80 L86,20 Z M112,24 L136,24 L136,76 L112,76 Z M190,0 L230,0 L248,20 L248,80 L230,100 L190,100 L172,80 L172,20 Z M198,24 L222,24 L222,76 L198,76 Z M258,0 L316,0 L334,18 L334,40 L316,56 L334,100 L306,100 L292,58 L284,58 L284,100 L258,100 Z M284,20 L308,20 L308,38 L284,38 Z";
const LOL_D =
  "M0,0 L26,0 L26,74 L62,74 L62,100 L0,100 Z M90,0 L130,0 L148,20 L148,80 L130,100 L90,100 L72,80 L72,20 Z M98,24 L122,24 L122,76 L98,76 Z M158,0 L184,0 L184,74 L220,74 L220,100 L158,100 Z";

const BI_W = 110;
const DOOR_W = 334;
const LOL_W = 220;
const GAP = 16;

/** The suffix sits smaller on the shared baseline: at full size it matches the
 *  name stroke for stroke and the whole thing reads as one long word. */
const LOL_SCALE = 0.62;
const DOT_R = 13;
const DOT_CX = BI_W + GAP + DOOR_W + 20;
const DOT_CY = 100 - DOT_R;
const LOL_X = DOT_CX + DOT_R + 16;
const LOL_Y = (1 - LOL_SCALE) * 100;

const SKEW = 12;
/** Room for the lean, so the leading edge is not clipped. */
const LEAN = 100 * Math.tan((SKEW * Math.PI) / 180);
const TOTAL = LOL_X + LOL_W * LOL_SCALE;

export function Wordmark({ height = "1.5rem", className = "" }: { height?: string; className?: string }) {
  return (
    <svg
      viewBox={`${-LEAN - 4} -10 ${TOTAL + LEAN + 20} 120`}
      role="img"
      aria-label="BIDOOR.LOL"
      className={`block shrink-0 ${className}`}
      style={{ height, width: "auto" }}
    >
      <g transform={`skewX(-${SKEW})`} fill="currentColor" fillRule="evenodd">
        <path d={BI_D} />
        <g transform={`translate(${BI_W + GAP},0)`}>
          <path d={DOOR_D} />
        </g>
        <g transform={`translate(${LOL_X},${LOL_Y}) scale(${LOL_SCALE})`}>
          <path d={LOL_D} />
        </g>
      </g>
      {/* Outside the skew on purpose: a leaning circle is an ellipse, and the
          one round shape in a wordmark made of straight cuts should stay round. */}
      <circle
        cx={DOT_CX - DOT_CY * Math.tan((SKEW * Math.PI) / 180)}
        cy={DOT_CY}
        r={DOT_R}
        fill="var(--bd-accent)"
        // On cream, slime sits at 1.17:1 against the page. The dot is
        // decoration and needs no ratio, but as the wordmark's only accent it
        // should not go soft either, so light gets a thin ink ring and dark —
        // where slime is already 15.7 against the ground — gets none.
        stroke="var(--bd-wordmark-dot-ring)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
