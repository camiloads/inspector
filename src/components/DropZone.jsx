import { useState, useCallback } from 'react'
import './DropZone.css'

export default function DropZone({ onFile, fileInputRef, loading }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
        onFile(file)
      }
    },
    [onFile]
  )

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {loading ? (
        <div className="dz-loading">
          <div className="spinner" />
          <p>Procesando datos…</p>
        </div>
      ) : (
        <div className="dz-content">
          <div className="dz-icon">
            {dragging ? '📂' : '📊'}
          </div>
          <p className="dz-main">
            {dragging ? 'Suelta el archivo aquí' : 'Arrastra tu CSV aquí'}
          </p>
          <p className="dz-sub">o haz clic para seleccionar un archivo</p>
          <div className="dz-badge">CSV</div>
        </div>
      )}
    </div>
  )
}
