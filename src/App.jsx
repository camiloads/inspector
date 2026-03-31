import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import CampaignChart from './components/CampaignChart.jsx'
import KpiSelector from './components/KpiSelector.jsx'
import DropZone from './components/DropZone.jsx'
import './App.css'

// ─── KPI definitions ────────────────────────────────────────────────────────
export const KPIS = [
  {
    key: 'cost',
    label: 'Coste',
    aliases: ['cost', 'coste', 'costo', 'spend', 'gasto', 'importe'],
    format: (v) => `$${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    color: '#e8ff47',
    unit: '$',
  },
  {
    key: 'impressions',
    label: 'Impresiones',
    aliases: ['impressions', 'impresiones', 'impr', 'impr.', 'views'],
    format: (v) => Number(v).toLocaleString('es-CO'),
    color: '#47c8ff',
    unit: '',
  },
  {
    key: 'clicks',
    label: 'Clics',
    aliases: ['clicks', 'clics', 'clics.', 'click'],
    format: (v) => Number(v).toLocaleString('es-CO'),
    color: '#ff7847',
    unit: '',
  },
  {
    key: 'conversions',
    label: 'Conversiones',
    aliases: ['conversions', 'conversiones', 'conv', 'conv.', 'results', 'resultados'],
    format: (v) => Number(v).toLocaleString('es-CO'),
    color: '#b847ff',
    unit: '',
  },
]

// ─── Column detection ─────────────────────────────────────────────────────
function detectColumns(headers) {
  const normalized = headers.map((h) => h.toLowerCase().trim())

  const findCol = (aliases) =>
    headers[normalized.findIndex((h) => aliases.some((a) => h.includes(a)))] || null

  const dateCol =
    headers[
      normalized.findIndex((h) =>
        ['date', 'fecha', 'day', 'día', 'dia', 'periodo', 'period'].some((a) => h.includes(a))
      )
    ] || null

  const campaignCol =
    headers[
      normalized.findIndex((h) =>
        ['campaign', 'campaña', 'campana', 'campaign name', 'nombre'].some((a) => h.includes(a))
      )
    ] || null

  const kpiCols = {}
  KPIS.forEach((kpi) => {
    kpiCols[kpi.key] = findCol(kpi.aliases)
  })

  return { dateCol, campaignCol, kpiCols }
}

// ─── Parse & group CSV data ───────────────────────────────────────────────
function processData(rows, { dateCol, campaignCol, kpiCols }) {
  // Get unique campaigns preserving order
  const campaignMap = new Map()

  rows.forEach((row) => {
    const campaign = row[campaignCol]?.trim()
    const date = row[dateCol]?.trim()
    if (!campaign || !date) return

    if (!campaignMap.has(campaign)) campaignMap.set(campaign, new Map())
    const dateMap = campaignMap.get(campaign)

    const entry = { date }
    KPIS.forEach((kpi) => {
      const col = kpiCols[kpi.key]
      if (col) {
        const raw = row[col]?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0'
        entry[kpi.key] = parseFloat(raw) || 0
      }
    })

    // Aggregate if same date appears twice for same campaign
    if (dateMap.has(date)) {
      const existing = dateMap.get(date)
      KPIS.forEach((kpi) => {
        if (kpiCols[kpi.key]) existing[kpi.key] = (existing[kpi.key] || 0) + (entry[kpi.key] || 0)
      })
    } else {
      dateMap.set(date, entry)
    }
  })

  // Convert to sorted array per campaign
  const campaigns = []
  campaignMap.forEach((dateMap, name) => {
    const data = Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date))
    campaigns.push({ name, data })
  })

  return campaigns
}

// ─── App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [campaigns, setCampaigns] = useState([])
  const [columns, setColumns] = useState(null)
  const [selectedKpi, setSelectedKpi] = useState('cost')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setError('')
    setLoading(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        if (headers.length === 0) {
          setError('El archivo CSV está vacío o no tiene encabezados reconocibles.')
          setLoading(false)
          return
        }

        const cols = detectColumns(headers)
        if (!cols.dateCol) {
          setError('No se encontró una columna de Fecha. Asegúrate de que el CSV tenga una columna con "Fecha" o "Date".')
          setLoading(false)
          return
        }
        if (!cols.campaignCol) {
          setError('No se encontró una columna de Campaña. Asegúrate de que tenga una columna con "Campaña" o "Campaign".')
          setLoading(false)
          return
        }

        const processed = processData(results.data, cols)
        setColumns(cols)
        setCampaigns(processed)
        setFileName(file.name)
        setLoading(false)
      },
      error: (err) => {
        setError(`Error al leer el archivo: ${err.message}`)
        setLoading(false)
      },
    })
  }, [])

  const handleReset = () => {
    setCampaigns([])
    setColumns(null)
    setFileName('')
    setError('')
  }

  const currentKpi = KPIS.find((k) => k.key === selectedKpi)
  const availableKpis = columns
    ? KPIS.filter((k) => columns.kpiCols[k.key] !== null)
    : KPIS

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">Campaign<em>Evolution</em></span>
          </div>
          {campaigns.length > 0 && (
            <div className="header-meta">
              <span className="file-badge">
                <span className="dot" />
                {fileName}
              </span>
              <span className="campaigns-count">{campaigns.length} campañas</span>
              <button className="btn-ghost" onClick={handleReset}>Cargar otro CSV</button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {/* ── Upload state ── */}
        {campaigns.length === 0 && (
          <div className="upload-section">
            <div className="upload-hero">
              <h1>Visualiza el evolutivo<br /><em>de tus campañas</em></h1>
              <p>Sube un archivo CSV con datos de campañas digitales y obtén gráficas de línea por KPI para cada campaña.</p>
            </div>

            <DropZone onFile={handleFile} fileInputRef={fileInputRef} loading={loading} />

            {error && (
              <div className="error-box">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}

            <div className="format-hint">
              <p className="hint-title">Formato esperado del CSV:</p>
              <div className="hint-table">
                <span>Fecha</span>
                <span>Campaña</span>
                <span>Coste</span>
                <span>Impr.</span>
                <span>Clics</span>
                <span>Conversiones</span>
              </div>
              <p className="hint-note">Los nombres de columna pueden estar en español o inglés. El separador puede ser coma o punto y coma.</p>
            </div>
          </div>
        )}

        {/* ── Charts state ── */}
        {campaigns.length > 0 && (
          <div className="charts-section">
            <div className="controls-bar">
              <div className="controls-left">
                <span className="controls-label">KPI visualizado:</span>
                <KpiSelector kpis={availableKpis} selected={selectedKpi} onChange={setSelectedKpi} />
              </div>
              <div className="controls-right">
                <span className="total-label">
                  Mostrando <strong>{campaigns.length}</strong> campañas
                </span>
              </div>
            </div>

            <div className="charts-grid">
              {campaigns.map((campaign, i) => (
                <CampaignChart
                  key={campaign.name}
                  campaign={campaign}
                  kpi={currentKpi}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>Campaign Evolution Viewer · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
