import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import './CampaignChart.css'

// ─── Custom Tooltip ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, kpi }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="chart-tooltip">
      <p className="tt-date">{label}</p>
      <p className="tt-value" style={{ color: kpi.color }}>
        {kpi.format(val)}
      </p>
    </div>
  )
}

// ─── Format axis values compactly ─────────────────────────────────────────
function fmtAxis(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return val.toLocaleString('es-CO')
}

// ─── Format dates for axis (shorter) ──────────────────────────────────────
function fmtDate(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// ─── Compute summary stats ─────────────────────────────────────────────────
function stats(data, key) {
  const vals = data.map((d) => d[key] || 0)
  const total = vals.reduce((a, b) => a + b, 0)
  const avg = vals.length ? total / vals.length : 0
  const max = Math.max(...vals)
  return { total, avg, max }
}

// ─── Detect trailing zeros ─────────────────────────────────────────────────
// Devuelve true si los últimos días consecutivos del KPI son todos cero
// y la campaña SÍ tuvo datos en algún momento (no es simplemente una campaña sin datos)
function hasTrailingZeros(data, key, minDays = 2) {
  const vals = data.map((d) => d[key] || 0)
  const hadData = vals.some((v) => v > 0)
  if (!hadData) return false // nunca tuvo datos, no aplica

  // Contar cuántos días finales consecutivos son cero
  let trailingCount = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] === 0) trailingCount++
    else break
  }
  return trailingCount >= minDays
}

// ─── Component ────────────────────────────────────────────────────────────
export default function CampaignChart({ campaign, kpi, index }) {
  const { name, data } = campaign
  const s = stats(data, kpi.key)
  const hasData = data.some((d) => (d[kpi.key] || 0) > 0)

  // Detectar si la campaña tiene ceros al final (alerta)
  const isAlert = hasTrailingZeros(data, kpi.key, 2)
  const lineColor = isAlert ? '#ff3355' : kpi.color
  const alertLabel = isAlert ? '⚠ ¡Campaña con KPI muy irregular!' : null

  // Thin out x-axis labels if too many points
  const tickInterval = data.length > 30 ? Math.floor(data.length / 15) : data.length > 14 ? 1 : 0

  return (
    <div
      className={`campaign-card ${isAlert ? 'card-alert' : ''}`}
      style={{ animationDelay: `${Math.min(index * 40, 800)}ms` }}
    >
      {/* Card Header */}
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-index" style={{ color: lineColor }}>
            #{String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="card-title" title={name}>{name}</h3>
          {alertLabel && (
            <span className="alert-badge">{alertLabel}</span>
          )}
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

      {/* Chart */}
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
                tickFormatter={fmtAxis}
                tick={{ fill: '#666677', fontSize: 10, fontFamily: 'DM Mono' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />

              <Tooltip content={<CustomTooltip kpi={kpi} />} />

              <ReferenceLine
                y={s.avg}
                stroke={lineColor}
                strokeDasharray="4 4"
                strokeOpacity={0.3}
              />

              <Line
                type="monotone"
                dataKey={kpi.key}
                stroke={lineColor}
                strokeWidth={2}
                dot={data.length <= 14 ? { r: 3, fill: lineColor, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: lineColor, stroke: '#0a0a0f', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
