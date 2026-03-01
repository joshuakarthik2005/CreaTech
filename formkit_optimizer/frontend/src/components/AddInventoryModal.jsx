import { useState, useEffect } from 'react'
import { X, Package, Loader2, CheckCircle } from 'lucide-react'
import { api } from '../api/client'

export default function AddInventoryModal({ projectId, onClose, onAdded }) {
  const [components, setComponents] = useState([])
  const [form, setForm] = useState({
    component_id: '',
    qty_available: '',
    qty_deployed: 0,
    qty_under_repair: 0,
  })
  const [loading, setLoading]   = useState(false)
  const [loadingComps, setLoadingComps] = useState(true)
  const [error, setError]       = useState(null)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    api.getComponents()
      .then(data => {
        setComponents(data)
        if (data.length > 0) setForm(f => ({ ...f, component_id: data[0].id }))
      })
      .catch(() => setError('Could not load components.'))
      .finally(() => setLoadingComps(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selected = components.find(c => c.id === form.component_id)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.component_id) { setError('Select a component.'); return }
    const qty = parseInt(form.qty_available)
    if (isNaN(qty) || qty < 0) { setError('Available quantity must be 0 or more.'); return }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        component_id: form.component_id,
        qty_available: qty,
        qty_deployed: parseInt(form.qty_deployed) || 0,
        qty_under_repair: parseInt(form.qty_under_repair) || 0,
      }
      const result = await api.upsertInventory(projectId, payload)
      setDone(true)
      setTimeout(() => { onAdded(result); onClose() }, 800)
    } catch (err) {
      setError(err.message || 'Failed to save inventory.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 glass-card border border-white/10 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Set Inventory</h2>
              <p className="text-xs text-slate-500">Add or update component stock levels</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Component selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Component <span className="text-rose-400">*</span>
            </label>
            {loadingComps ? (
              <div className="input-field text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading components...
              </div>
            ) : (
              <select className="input-field w-full" value={form.component_id}
                onChange={e => set('component_id', e.target.value)}>
                {components.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.component_code} — {c.description.slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected component info chip */}
          {selected && (
            <div className="flex items-center gap-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <span className="badge-info">{selected.system_code}</span>
              <span className="text-slate-400">{selected.component_type}</span>
              <span className="ml-auto text-slate-500 font-mono">
                ₹{selected.unit_cost_buy?.toLocaleString('en-IN') ?? '—'} buy
              </span>
            </div>
          )}

          {/* Quantity fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Available <span className="text-rose-400">*</span>
              </label>
              <input type="number" min="0" className="input-field w-full"
                value={form.qty_available} placeholder="0"
                onChange={e => set('qty_available', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Deployed</label>
              <input type="number" min="0" className="input-field w-full"
                value={form.qty_deployed} placeholder="0"
                onChange={e => set('qty_deployed', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Repair</label>
              <input type="number" min="0" className="input-field w-full"
                value={form.qty_under_repair} placeholder="0"
                onChange={e => set('qty_under_repair', e.target.value)} />
            </div>
          </div>

          {/* Total preview */}
          {(parseInt(form.qty_available) + parseInt(form.qty_deployed || 0) + parseInt(form.qty_under_repair || 0)) > 0 && (
            <p className="text-xs text-slate-500 text-right">
              Total stock:{' '}
              <span className="text-white font-semibold">
                {parseInt(form.qty_available || 0) + parseInt(form.qty_deployed || 0) + parseInt(form.qty_under_repair || 0)} units
              </span>
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || done || loadingComps}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
              {done ? <><CheckCircle className="w-4 h-4" /> Saved!</>
               : loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
               : 'Save Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
