import { useState } from 'react'
import { KPIS } from '../App.jsx'
import './AlertsView.css'

// ─── Funciones de detección ───────────────────────────────────────────────
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

function hasNoData(data, key) {
  return !data.some((d) => (d[key] || 0) > 0)
}

function lastDayWithData(data, key) {
  for (let i = data.length - 1; i >= 0; i--) {
    if ((data[i][key] || 0) > 0) return data[i].date
  }
  return '—'
}

function totalPeriod(data, key) {
  return data.reduce((a, d) => a + (d[key] || 0), 0)
}

function avgDaily(data, key) {
  const vals = data.map((d) => d[key] || 0)
  return vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
}

function fmtKpi(key, val, forceRound = false) {
  const kpi = KPIS.find((k) => k.key === key)
  if (!kpi) return val.toLocaleString('es-ES')
  // Impresiones y Clics: siempre entero, sin decimales
  if (forceRound || key === 'impressions' || key === 'clicks') {
    return Math.round(val).toLocaleString('es-ES')
  }
  return kpi.format(val)
}

// ─── Construir grupos de alertas ──────────────────────────────────────────
function buildAlertGroups(campaigns) {
  const groups = [
    { id: 'imp-alert',  title: 'Impresiones bajas o irregulares', kpiKey: 'impressions', color: '#47c8ff', type: 'alert',  campaigns: [] },
    { id: 'conv-alert', title: 'Conversiones — KPI crítico',       kpiKey: 'conversions', color: '#b847ff', type: 'alert',  campaigns: [] },
    { id: 'cost-zero',  title: 'Sin datos de Coste',               kpiKey: 'cost',        color: '#e8ff47', type: 'nodata', campaigns: [] },
    { id: 'imp-zero',   title: 'Sin datos de Impresiones',         kpiKey: 'impressions', color: '#47c8ff', type: 'nodata', campaigns: [] },
    { id: 'conv-zero',  title: 'Sin datos de Conversiones',        kpiKey: 'conversions', color: '#b847ff', type: 'nodata', campaigns: [] },
  ]

  campaigns.forEach(({ name, data }) => {
    if (hasImpressionsAlert(data))              groups[0].campaigns.push({ name, data })
    if (hasTrailingZeros(data, 'conversions', 4)) groups[1].campaigns.push({ name, data })
    if (hasNoData(data, 'cost'))               groups[2].campaigns.push({ name, data })
    if (hasNoData(data, 'impressions'))        groups[3].campaigns.push({ name, data })
    if (hasNoData(data, 'conversions'))        groups[4].campaigns.push({ name, data })
  })

  return groups.filter((g) => g.campaigns.length > 0)
}

// ─── Exportar a CSV compatible con Excel ─────────────────────────────────
function exportToExcel(groups) {
  const rows = [['Grupo de Alerta', 'Nombre de Campaña', 'KPI', 'Total del Período', 'Último día con dato > 0', 'Promedio Diario', 'Coste Total']]
  groups.forEach((group) => {
    group.campaigns.forEach(({ name, data }) => {
      const key = group.kpiKey
      rows.push([
        group.title,
        name,
        KPIS.find((k) => k.key === key)?.label || key,
        fmtKpi(key, totalPeriod(data, key)),
        lastDayWithData(data, key),
        fmtKpi(key, avgDaily(data, key)),
        fmtKpi('cost', totalPeriod(data, 'cost')),
      ])
    })
  })
  const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alertas_campañas_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Grupo con ordenamiento ───────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'name',   label: 'Campaña' },
  { key: 'total',  label: 'Total' },
  { key: 'last',   label: 'Último dato' },
  { key: 'avg',    label: 'Promedio' },
]

function AlertGroup({ group }) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const isAlert = group.type === 'alert'
  const kpiKey = group.kpiKey

  // Enriquecer campañas con valores calculados para poder ordenar
  const enriched = group.campaigns.map(({ name, data }) => ({
    name,
    data,
    total: totalPeriod(data, kpiKey),
    costTotal: totalPeriod(data, "cost"),
    last:  lastDayWithData(data, kpiKey),
    avg:   avgDaily(data, kpiKey),
  }))

  const sorted = [...enriched].sort((a, b) => {
    let va = a[sortKey]
    let vb = b[sortKey]
    if (sortKey === 'name' || sortKey === 'last') {
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const arrow = (key) => {
    if (sortKey !== key) return <span className="sort-arrow inactive">↕</span>
    return <span className="sort-arrow active">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className={`alert-group ${isAlert ? 'group-alert' : 'group-nodata'}`}>
      <div className="alert-group-header">
        <span className="alert-group-dot" style={{ background: isAlert ? '#ff3355' : '#555566' }} />
        <h3 className="alert-group-title">{group.title}</h3>
        <span className="alert-group-count">{group.campaigns.length} campaña{group.campaigns.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="alert-table">
        {/* Cabecera ordenable */}
        <div className="alert-table-head">
          <button className="sort-btn" onClick={() => toggleSort('name')}>
            Campaña {arrow('name')}
          </button>
          <button className="sort-btn" onClick={() => toggleSort('total')}>
            Total período {arrow('total')}
          </button>
          <button className="sort-btn" onClick={() => toggleSort('last')}>
            Último dato {arrow('last')}
          </button>
          <button className="sort-btn" onClick={() => toggleSort('avg')}>
            Prom. diario {arrow('avg')}
          </button>
          <button className="sort-btn" onClick={() => toggleSort('costTotal')}>
            Coste total {arrow('costTotal')}
          </button>
        </div>

        {sorted.map(({ name, total, last, avg, costTotal }) => (
          <div key={name} className="alert-row">
            <span className="alert-row-name" title={name}>{name}</span>
            <span className="alert-row-stat">{fmtKpi(kpiKey, total)}</span>
            <span className="alert-row-stat">{last}</span>
            <span className="alert-row-stat">{fmtKpi(kpiKey, avg)}</span>
            <span className="alert-row-stat">{fmtKpi('cost', costTotal)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────
export default function AlertsView({ campaigns }) {
  const groups = buildAlertGroups(campaigns)
  const totalAlerts = groups.reduce((a, g) => a + g.campaigns.length, 0)

  if (groups.length === 0) {
    return (
      <div className="alerts-empty">
        <span className="alerts-empty-icon">✓</span>
        <p>No se detectaron alertas en ninguna campaña.</p>
      </div>
    )
  }

  return (
    <div className="alerts-view">
      <div className="alerts-header">
        <div>
          <h2 className="alerts-title">Panel de Alertas</h2>
          <p className="alerts-subtitle">{totalAlerts} incidencia{totalAlerts !== 1 ? 's' : ''} detectada{totalAlerts !== 1 ? 's' : ''} en {groups.length} grupo{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-export" onClick={() => exportToExcel(groups)}>
          ↓ Exportar Excel
        </button>
      </div>

      <div className="alerts-groups">
        {groups.map((group) => (
          <AlertGroup key={group.id} group={group} />
        ))}
      </div>
    </div>
  )
}
