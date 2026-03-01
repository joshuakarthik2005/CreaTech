import { useState } from 'react'
import { X, Layers, Loader2, CheckCircle } from 'lucide-react'
import { api } from '../api/client'

const POUR_TYPES = ['WALL', 'SLAB', 'COLUMN', 'BEAM', 'SHEAR_WALL']
const SYSTEMS   = ['PERI_TRIO', 'PERI_GRIDFLEX', 'DOKA_FRAMI', 'DOKA_FRAMAX', 'MANUAL']
const GRADES    = ['M25', 'M30', 'M35', 'M40', 'M45', 'M50']

export default function AddPourModal({ projectId, onClose, onAdded }) {
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    tower_code: 'T1',
    floor_number: 1,
    zone_code: 'A',
    pour_type: 'WALL',
    planned_date: today,
    net_surface_area_m2: '',
    concrete_grade: 'M40',
    strip_cycle_hours: 12,
    assigned_system: 'PERI_TRIO',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [done, setDone]       = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.net_surface_area_m2 || parseFloat(form.net_surface_area_m2) <= 0) {
      setError('Surface area must be greater than 0.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        floor_number: parseInt(form.floor_number),
        net_surface_area_m2: parseFloat(form.net_surface_area_m2),
        strip_cycle_hours: parseInt(form.strip_cycle_hours),
      }
      const created = await api.createPour(projectId, payload)
      setDone(true)
      setTimeout(() => { onAdded(created); onClose() }, 800)
    } catch (err) {
      setError(err.message || 'Failed to add pour.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 glass-card border border-white/10 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Add Pour</h2>
              <p className="text-xs text-slate-500">Schedule a new concrete pour</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Tower / Floor / Zone */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tower</label>
              <input className="input-field w-full" value={form.tower_code}
                onChange={e => set('tower_code', e.target.value)} placeholder="T1" maxLength={10} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Floor <span className="text-rose-400">*</span></label>
              <input type="number" className="input-field w-full" value={form.floor_number} min={1} max={200}
                onChange={e => set('floor_number', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Zone <span className="text-rose-400">*</span></label>
              <input className="input-field w-full" value={form.zone_code}
                onChange={e => set('zone_code', e.target.value.toUpperCase())} placeholder="A" maxLength={10} required />
            </div>
          </div>

          {/* Row 2: Type / Planned Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Pour Type <span className="text-rose-400">*</span></label>
              <select className="input-field w-full" value={form.pour_type} onChange={e => set('pour_type', e.target.value)}>
                {POUR_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Planned Date <span className="text-rose-400">*</span></label>
              <input type="date" className="input-field w-full" value={form.planned_date}
                onChange={e => set('planned_date', e.target.value)} required />
            </div>
          </div>

          {/* Row 3: Area / Grade / Strip Hours */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Area (m²) <span className="text-rose-400">*</span></label>
              <input type="number" step="0.1" min="0.1" className="input-field w-full"
                value={form.net_surface_area_m2} placeholder="e.g. 42.5"
                onChange={e => set('net_surface_area_m2', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Grade</label>
              <select className="input-field w-full" value={form.concrete_grade} onChange={e => set('concrete_grade', e.target.value)}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Strip (hrs)</label>
              <input type="number" min="6" max="72" className="input-field w-full"
                value={form.strip_cycle_hours} onChange={e => set('strip_cycle_hours', e.target.value)} />
            </div>
          </div>

          {/* Row 4: Formwork System */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Formwork System</label>
            <select className="input-field w-full" value={form.assigned_system} onChange={e => set('assigned_system', e.target.value)}>
              {SYSTEMS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || done}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
              {done ? <><CheckCircle className="w-4 h-4" /> Added!</>
               : loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
               : 'Add Pour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
