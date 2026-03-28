export default function Ticker() {
  const items = [
    'DeWare', '◈', 'Autonomous Warehouse', '◈', 'ERC-8004 Identity', '◈',
    'x402 Machine Payments', '◈', 'Multi-Agent AI', '◈',
    'On-Chain Reputation', '◈', 'Base Sepolia', '◈',
    'No Master Node', '◈',
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
