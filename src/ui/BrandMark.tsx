/** ARGUS' own mark (a ringed diamond). Not derived from any agency insignia (docs/PROJECT_RULES.md rule 5). */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--brand)" strokeWidth="1.5" />
      <path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" fill="var(--brand)" />
    </svg>
  );
}
