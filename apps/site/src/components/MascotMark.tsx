export function MascotMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 120" aria-hidden="true" className={className}>
      <circle cx="80" cy="48" r="38" fill="#ef3b24" />
      <g transform="translate(14 26) scale(0.46)">
        <path
          d="M0 100C0 43 40 0 100 0C160 0 200 43 200 100V198C189.333 184.667 178.333 184.667 167 198C155.667 184.667 144.333 184.667 133 198C121.667 184.667 110.667 184.667 100 198C88.6667 184.667 77.6667 184.667 67 198C55.6667 184.667 44.3333 184.667 33 198C21.6667 184.667 10.6667 184.667 0 198V100Z"
          fill="#000000"
        />
        <ellipse cx="76" cy="105" rx="15" ry="19" fill="#f5f0e4" />
        <ellipse cx="124" cy="105" rx="15" ry="19" fill="#f5f0e4" />
        <ellipse cx="79" cy="109" rx="5.5" ry="9" fill="#000000" />
        <ellipse cx="127" cy="109" rx="5.5" ry="9" fill="#000000" />
      </g>
    </svg>
  );
}
