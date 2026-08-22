/**
 * The BIDOOR wordmark: heavy geometric italic, chamfered corners, leaning 12°.
 * Drawn as paths rather than set in a typeface, so it is the same shape on
 * every machine and needs no font to load before the brand is legible.
 *
 * "DOOR" is the accent half, and it changes technique rather than colour
 * between themes, because slime type on cream is 1.17:1 and simply is not
 * there. On dark the letters are painted slime; on cream a slime slab sits
 * behind them and the letters go dark. Both states come from tokens, so the
 * component has no idea which theme it is in.
 */
const BI_D =
  "M0,0 L58,0 L74,16 L74,36 L64,50 L74,64 L74,84 L58,100 L0,100 Z M26,20 L48,20 L48,40 L26,40 Z M26,60 L48,60 L48,80 L26,80 Z M84,0 L110,0 L110,100 L84,100 Z";
const DOOR_D =
  "M0,0 L58,0 L76,20 L76,80 L58,100 L0,100 Z M26,22 L50,22 L50,78 L26,78 Z M104,0 L144,0 L162,20 L162,80 L144,100 L104,100 L86,80 L86,20 Z M112,24 L136,24 L136,76 L112,76 Z M190,0 L230,0 L248,20 L248,80 L230,100 L190,100 L172,80 L172,20 Z M198,24 L222,24 L222,76 L198,76 Z M258,0 L316,0 L334,18 L334,40 L316,56 L334,100 L306,100 L292,58 L284,58 L284,100 L258,100 Z M284,20 L308,20 L308,38 L284,38 Z";

const BI_W = 110;
const DOOR_W = 334;
const GAP = 16;
const SKEW = 12;
/** Room for the lean, so the leading edge is not clipped. */
const LEAN = 100 * Math.tan((SKEW * Math.PI) / 180);
const TOTAL = BI_W + GAP + DOOR_W;

export function Wordmark({ height = "1.5rem", className = "" }: { height?: string; className?: string }) {
  return (
    <svg
      viewBox={`${-LEAN - 4} -10 ${TOTAL + LEAN + 20} 120`}
      height={height}
      width={((TOTAL + LEAN + 20) / 120) * parseFloat(height) + "rem"}
      role="img"
      aria-label="BIDOOR"
      className={`block shrink-0 ${className}`}
      style={{ height, width: "auto" }}
    >
      <g transform={`skewX(-${SKEW})`}>
        {/* Transparent on dark, a slime slab on cream. */}
        <rect
          x={BI_W + GAP - 12}
          y={-12}
          width={DOOR_W + 26}
          height={124}
          fill="var(--bd-wordmark-slab)"
        />
        <path d={BI_D} fill="currentColor" fillRule="evenodd" />
        <g transform={`translate(${BI_W + GAP},0)`}>
          <path d={DOOR_D} fill="var(--bd-wordmark-door)" fillRule="evenodd" />
        </g>
      </g>
    </svg>
  );
}
