// "What the customer sees" — a faithful 2x20 rendering of the pole display.
// Register computes (line1, line2) once and feeds the SAME strings here and to
// the hardware, so this preview can never drift from what the device shows.
// For stores without the physical unit, this doubles as the customer display
// itself (point a second screen at /demo and it's live).
export default function PoleDisplayPreview({
  line1,
  line2,
  live,
}: {
  line1: string
  line2: string
  live: boolean
}) {
  return (
    <div className="pole-preview" aria-live="polite">
      <div className="pole-screen">
        <div className="pole-line">{line1.padEnd(20, ' ')}</div>
        <div className="pole-line">{line2.padEnd(20, ' ')}</div>
      </div>
      <div className="pole-status">
        <span className={'pole-dot' + (live ? ' live' : '')} />
        {live ? 'Customer display · live' : 'Customer display · on-screen preview'}
      </div>
    </div>
  )
}
