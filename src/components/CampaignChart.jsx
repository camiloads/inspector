import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import './CampaignChart.css'

function CustomTooltip({ active, payload, label, kpi, showCost }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tt-date">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="tt-value" style={{ color: entry.stroke }}>
          {entry.dataKey === 'cost'
            ? `Coste: €${Number(entry.value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${kpi.label}: ${kpi.format(entry.value)}`}
        </p>
      ))}
    </div>
  )
}

function fmtAxis(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return val.toLocaleString('es-CO')
}

function fmtDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function stats(data, key) {
  const vals = data.map((d) => d[key] || 0)
  const total = vals.reduce((a, b) => a + b, 0)
  const avg = vals.length ? total / vals.length : 0
  const max = Math.max(...vals)
  return { total, avg, max }
}

function hasTrailingZeros(data, key, minDays = 2) {
  const vals = data.map((d) => d[key] || 0)
  if (!vals.some((v) => v > 0)) return false
  let count = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] === 0) count++
    else break
  }
  return count >= minDays
}

function hasImpressionsAlert(data) {
  const vals = data.map((d) => d['impressions'] || 0)
  if (!vals.some((v) => v > 0)) return false
  let trailingZeros = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] === 0) trailingZeros++
    else break
  }
  if (trailingZeros >= 4) return true
  const lowDays = vals.filter((v) => v < 10).length
  return lowDays / vals.length >= 0.3
}

export default function CampaignChart({ campaign, kpi, index }) {
  const { name, data } = campaign
  const s = stats(data, kpi.key)
  const hasData = data.some((d) => (d[kpi.key] || 0) > 0)

  // Mostrar línea de coste punteada cuando el KPI seleccionado NO es coste
  const showCostLine = kpi.key !== 'cost'

  const isImpressions = kpi.key === 'impressions'
  const isAlert = isImpressions
    ? hasImpressionsAlert(data)
    : hasTrailingZeros(data, kpi.key, 2)

  const alertMessage = isImpressions
    ? '¡Impresiones bajas o irregulares!'
    : '¡Campaña con KPI crítico!'

  const lineColor = isAlert ? '#ff3355' : kpi.color
  const costColor = '#e8ff47'
  const tickInterval = data.length > 30 ? Math.floor(data.length / 15) : data.length > 14 ? 1 : 0

  return (
    <div
      className={`campaign-card ${isAlert ? 'card-alert' : ''}`}
      style={{ animationDelay: `${Math.min(index * 40, 800)}ms` }}
    >
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-index" style={{ color: lineColor }}>
            #{String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="card-title" title={name}>{name}</h3>
          {isAlert && <span className="alert-badge">{alertMessage}</span>}
        </div>

        {hasData && (
          <div className="card-stats">
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value" style={{ color: lineColor }}>
                {kpi.format(s.total)}
              </span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-label">Prom/día</span>
              <span className="stat-value">{kpi.format(s.avg)}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-label">Máx</span>
              <span className="stat-value">{kpi.format(s.max)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card-chart">
        {!hasData ? (
          <div className="no-data">Sin datos para {kpi.label} en esta campaña</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: '#666677', fontSize: 10, fontFamily: 'DM Mono' }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />

              <YAxis
                yAxisId="kpi"
                tickFormatter={fmtAxis}
                tick={{ fill: '#666677', fontSize: 10, fontFamily: 'DM Mono' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />

              {showCostLine && (
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tickFormatter={fmtAxis}
                  tick={{ fill: '#666677', fontSize: 10, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
              )}

              <Tooltip content={<CustomTooltip kpi={kpi} showCost={showCostLine} />} />

              <ReferenceLine
                yAxisId="kpi"
                y={s.avg}
                stroke={lineColor}
                strokeDasharray="4 4"
                strokeOpacity={0.3}
              />

              {/* Línea principal del KPI seleccionado */}
              <Line
                yAxisId="kpi"
                type="monotone"
                dataKey={kpi.key}
                stroke={lineColor}
                strokeWidth={2}
                dot={data.length <= 14 ? { r: 3, fill: lineColor, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: lineColor, stroke: '#0a0a0f', strokeWidth: 2 }}
              />

              {/* Línea de Coste punteada (solo cuando el KPI activo no es Coste) */}
              {showCostLine && (
                <Line
                  yAxisId="cost"
                  type="monotone"
                  dataKey="cost"
                  stroke={costColor}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, fill: costColor, stroke: '#0a0a0f', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Leyenda mini debajo de la gráfica */}
      {showCostLine && hasData && (
        <div className="chart-legend">
          <span className="legend-item" style={{ color: lineColor }}>
            <span className="legend-line solid" style={{ background: lineColor }} />
            {kpi.label}
          </span>
          <span className="legend-item" style={{ color: costColor }}>
            <span className="legend-line dashed" style={{ borderColor: costColor }} />
            Coste
          </span>
        </div>
      )}
    </div>
  )
}
