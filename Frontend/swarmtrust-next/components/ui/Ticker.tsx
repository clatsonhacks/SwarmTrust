export default function Ticker() {
  const items = [
    'SwarmTrust 2026', '◈', '48 Hours', '◈', 'Distributed Trust', '◈',
    'Zero-Knowledge Proofs', '◈', 'Multi-Agent AI', '◈',
    'ERC-8004 Identity', '◈', 'Machine Payments', '◈',
    'No Single Point of Failure', '◈',
  ]
  const doubled = [...items, ...items]

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span key={i} className={`ti ${item === '◈' ? 'ti-a' : ''}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
