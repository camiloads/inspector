import './KpiSelector.css'

export default function KpiSelector({ kpis, selected, onChange }) {
  return (
    <div className="kpi-selector">
      {kpis.map((kpi) => (
        <button
          key={kpi.key}
          className={`kpi-btn ${selected === kpi.key ? 'active' : ''}`}
          style={{ '--kpi-color': kpi.color }}
          onClick={() => onChange(kpi.key)}
        >
          <span className="kpi-dot" />
          {kpi.label}
        </button>
      ))}
    </div>
  )
}
