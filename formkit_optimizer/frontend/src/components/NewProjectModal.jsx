import { useState } from 'react'
import { X, Building2, Loader2, CheckCircle } from 'lucide-react'
import { api } from '../api/client'

export default function NewProjectModal({ onClose, onCreated }) {
  const today = new Date().toISOString().slice(0, 10)
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

  const [form, setForm] = useState({
    project_code: '',
    project_name: '',
    location: '',
    sap_wbs_root: '',
    start_date: today,
    planned_end: nextYear,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.project_code.trim() || !form.project_name.trim()) {
      setError('Project Code and Name are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const created = await api.createProject(form)
      setDone(true)
      setTimeout(() => {
        onCreated(created)
        onClose()
      }, 900)
    } catch (err) {
      setError(err.message || 'Failed to create project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 glass-card border border-white/10 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">New Project</h2>
              <p className="text-xs text-slate-500">Create a formwork optimization project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Project Code <span className="text-rose-400">*</span>
              </label>
              <input
                className="input-field w-full"
                placeholder="e.g. SHT-002"
                value={form.project_code}
                onChange={e => set('project_code', e.target.value)}
                maxLength={20}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                SAP WBS
              </label>
              <input
                className="input-field w-full"
                placeholder="e.g. P-2026-002"
                value={form.sap_wbs_root}
                onChange={e => set('sap_wbs_root', e.target.value)}
                maxLength={30}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              className="input-field w-full"
              placeholder="e.g. Grand Avenue Tower Block B"
              value={form.project_name}
              onChange={e => set('project_name', e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Location / Site
            </label>
            <input
              className="input-field w-full"
              placeholder="e.g. Powai, Mumbai"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                className="input-field w-full"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Planned End
              </label>
              <input
                type="date"
                className="input-field w-full"
                value={form.planned_end}
                onChange={e => set('planned_end', e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || done}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {done ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Created!
                </>
              ) : loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
