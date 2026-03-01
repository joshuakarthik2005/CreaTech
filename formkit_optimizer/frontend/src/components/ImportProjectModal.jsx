import { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle, Loader2, FileUp } from 'lucide-react'

const API_BASE = '/api'

async function downloadTemplate() {
  const res = await fetch(`${API_BASE}/import/template`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'formkit_import_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportProjectModal({ onClose, onImported }) {
  const [file, setFile]         = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)   // success result
  const [error, setError]       = useState(null)
  const inputRef = useRef()

  const accept = (f) => {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError('Only .xlsx or .xls files are accepted.')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/import`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleDone = () => {
    if (result) onImported(result.project_id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-lg mx-4 glass-card border border-white/10 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-brand-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Import from Excel</h2>
              <p className="text-xs text-slate-500">Upload project, pours &amp; inventory in one file</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Success state */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">Import Successful</p>
                  <p className="text-xs text-slate-400 mt-0.5">{result.project_name} ({result.project_code})</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-brand-400">{result.pours_created}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pours Created</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{result.inventory_lines}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Inventory Lines</p>
                </div>
              </div>
              {result.warnings?.length > 0 && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400">{result.warnings.length} warning(s)</p>
                  </div>
                  {result.warnings.slice(0, 5).map((w, i) => (
                    <p key={i} className="text-xs text-slate-400 pl-5">{w}</p>
                  ))}
                </div>
              )}
              <button onClick={handleDone} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Open Project
              </button>
            </div>
          ) : (
            <>
              {/* Step 1: Download template */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-xs font-semibold text-white">Step 1 — Get the template</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">3 sheets: Project · Pours · Inventory</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-400 border border-brand-500/30 hover:bg-brand-500/10 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>

              {/* Step 2: Upload */}
              <div>
                <p className="text-xs font-semibold text-white mb-2">Step 2 — Fill &amp; upload</p>
                
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 text-center ${
                    dragging
                      ? 'border-brand-400 bg-brand-500/10'
                      : file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => accept(e.target.files[0])}
                  />
                  {file ? (
                    <>
                      <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-300">Drop your Excel file here</p>
                      <p className="text-xs text-slate-600 mt-1">or click to browse · .xlsx / .xls</p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </p>
              )}

              {/* Sheet guide */}
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                {[
                  { sheet: 'Project', fields: 'code · name · location · dates', color: 'text-brand-400' },
                  { sheet: 'Pours', fields: 'floor · zone · type · area · date', color: 'text-violet-400' },
                  { sheet: 'Inventory', fields: 'component code · qty available', color: 'text-cyan-400' },
                ].map(s => (
                  <div key={s.sheet} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2">
                    <p className={`font-bold ${s.color}`}>{s.sheet}</p>
                    <p className="text-slate-600 mt-0.5 leading-tight">{s.fields}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Import Project</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
