import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import CampaignChart from './components/CampaignChart.jsx'
import KpiSelector from './components/KpiSelector.jsx'
import DropZone from './components/DropZone.jsx'
import './App.css'

export const KPIS = [
  {
    key: 'cost',
    label: 'Coste',
    aliases: ['coste', 'cost', 'costo', 'spend', 'gasto', 'importe'],
    format: (v) => `€${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    color: '#e8ff47',
  },
  {
    key: 'impressions',
    label: 'Impresiones',
    aliases: ['impr', 'impressions', 'impresiones'],
    format: (v) => Number(v).toLocaleString('es-ES'),
    color: '#47c8ff',
  },
  {
    key: 'clicks',
    label: 'Clics',
    aliases: ['clics', 'clicks', 'clic', 'click'],
    format: (v) => Number(v).toLocaleString('es-ES'),
    color: '#ff7847',
  },
  {
    key: 'conversions',
    label: 'Conversiones',
    aliases: ['conversiones', 'conversions', 'conv'],
    format: (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    color: '#b847ff',
  },
  {
    key: 'cpa',
    label: 'CPA',
    aliases: ['coste/conv', 'cost/conv', 'cpa', 'coste por conv'],
    format: (v) => `€${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    color: '#ff47a0',
  },
]

function norm(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function findCol(headers, aliases) {
  return headers.find((h) => aliases.some((a) => norm(h).includes(norm(a)))) || null
}

function detectColumns(headers) {
  const dateCol = findCol(headers, ['dia', 'day', 'date', 'fecha'])
  const campaignCol = findCol(headers, ['campana', 'campaign'])
  const kpiCols = {}
  KPIS.forEach((kpi) => {
    kpiCols[kpi.key] = findCol(headers, kpi.aliases)
  })
  return { dateCol, campaignCol, kpiCols }
}

function parseNum(raw) {
  if (!raw) return 0
  const s = String(raw).trim()
  if (!s || s === '-') return 0
  if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0
  if (/\.\d{3}$/.test(s)) return parseFloat(s.replace('.', '')) || 0
  return parseFloat(s) || 0
}

function cleanStr(str) {
  return (str || '').replace(/^\uFEFF/, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()
}

function processData(rows, { dateCol, campaignCol, kpiCols }) {
  const campaignMap = new Map()

  rows.forEach((row) => {
    const campaign = cleanStr(row[campaignCol])
    const date = cleanStr(row[dateCol])
    if (!campaign || !date || !/\d/.test(date)) return

    if (!campaignMap.has(campaign)) campaignMap.set(campaign, new Map())
    const dateMap = campaignMap.get(campaign)

    const entry = { date }
    KPIS.forEach((kpi) => {
      const col = kpiCols[kpi.key]
      entry[kpi.key] = col ? parseNum(row[col]) : 0
    })

    if (dateMap.has(date)) {
      const existing = dateMap.get(date)
      KPIS.forEach((kpi) => {
        existing[kpi.key] = (existing[kpi.key] || 0) + (entry[kpi.key] || 0)
      })
    } else {
      dateMap.set(date, entry)
    }
  })

  const campaigns = []
  campaignMap.forEach((dateMap, name) => {
    const data = Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date))
    campaigns.push({ name, data })
  })
  return campaigns
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      if (text.charCodeAt(1) === 0 || (text.length > 10 && text.charCodeAt(2) === 0)) {
        const r2 = new FileReader()
        r2.onload = (e2) => resolve(e2.target.result)
        r2.onerror = reject
        r2.readAsText(file, 'UTF-16')
      } else {
        resolve(text)
      }
    }
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

export default function App() {
  const [campaigns, setCampaigns] = useState([])
  const [columns, setColumns] = useState(null)
  const [selectedKpi, setSelectedKpi] = useState('cost')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const text = await readFileAsText(file)
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: '',
        transformHeader: (h) => cleanStr(h),
        complete: (results) => {
          const headers = results.meta.fields || []
          if (!headers.length) {
            setError('El archivo CSV está vacío.')
            setLoading(false)
            return
          }
          const cols = detectColumns(headers)
          if (!cols.dateCol) {
            setError(`No se encontró columna de Fecha/Día. Columnas: ${headers.slice(0, 6).join(' | ')}`)
            setLoading(false)
            return
          }
          if (!cols.campaignCol) {
            setError(`No se encontró columna de Campaña. Columnas: ${headers.slice(0, 6).join(' | ')}`)
            setLoading(false)
            return
          }
          const rows = results.data.filter((row) => {
            const d = cleanStr(row[cols.dateCol])
            return d && /\d/.test(d)
          })
          if (!rows.length) {
            setError('El archivo no contiene filas de datos válidas.')
            setLoading(false)
            return
          }
          const processed = processData(rows, cols)
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
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false)
    }
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
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">Campaign<em>Evolution</em></span>
          </div>
          {campaigns.length > 0 && (
            <div className="header-meta">
              <span className="file-badge"><span className="dot" />{fileName}</span>
              <span className="campaigns-count">{campaigns.length} campañas</span>
              <button className="btn-ghost" onClick={handleReset}>Cargar otro CSV</button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {campaigns.length === 0 && (
          <div className="upload-section">
            <div className="upload-hero">
              <h1>Visualiza el evolutivo<br /><em>de tus campañas</em></h1>
              <p>Sube un archivo CSV exportado de Google Ads y obtén gráficas de línea por KPI para cada campaña.</p>
            </div>
            <DropZone onFile={handleFile} fileInputRef={fileInputRef} loading={loading} />
            {error && (
              <div className="error-box">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}
            <div className="format-hint">
              <p className="hint-title">Columnas que detecta automáticamente:</p>
              <div className="hint-table">
                <span>Día</span>
                <span>Campaña</span>
                <span>Coste</span>
                <span>Impr.</span>
                <span>Clics</span>
                <span>Conversiones</span>
                <span>Coste/conv.</span>
              </div>
              <p className="hint-note">Compatible con exportaciones de Google Ads · UTF-8 y UTF-16</p>
            </div>
          </div>
        )}

        {campaigns.length > 0 && (
          <div className="charts-section">
            <div className="controls-bar">
              <div className="controls-left">
                <span className="controls-label">KPI visualizado:</span>
                <KpiSelector kpis={availableKpis} selected={selectedKpi} onChange={setSelectedKpi} />
              </div>
              <div className="controls-right">
                <span className="total-label">Mostrando <strong>{campaigns.length}</strong> campañas</span>
              </div>
            </div>
            <div className="charts-grid">
              {campaigns.map((campaign, i) => (
                <CampaignChart key={campaign.name} campaign={campaign} kpi={currentKpi} index={i} />
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
