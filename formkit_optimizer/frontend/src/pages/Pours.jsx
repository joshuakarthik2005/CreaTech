import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import { Layers, Calendar, ArrowUpRight, Filter, Search, Plus } from 'lucide-react'
import AddPourModal from '../components/AddPourModal'

const statusColors = {
  COMPLETED: 'badge-success',
  IN_PROGRESS: 'badge-warning',
  PLANNED: 'badge-info',
}

export default function Pours() {
  const { project } = useProject()
  const [pours, setPours] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ type: '', status: '', search: '' })
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!project) return
    setLoading(true)
    const params = {}
    if (filter.type) params.pour_type = filter.type
    if (filter.status) params.status = filter.status
    api.getPours(project.id, params)
      .then(setPours)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [project, filter.type, filter.status])

  const filtered = pours.filter(p =>
    !filter.search || p.pour_code.toLowerCase().includes(filter.search.toLowerCase())
  )

  // Group by floor
  const floors = {}
  filtered.forEach(p => {
    if (!floors[p.floor_number]) floors[p.floor_number] = []
    floors[p.floor_number].push(p)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-400" />
            Pour Schedule
          </h1>
          <p className="text-sm text-slate-400 mt-1">{pours.length} pours across {Object.keys(floors).length} floors</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          Add Pour
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search pours..."
            className="input-field pl-9 w-64"
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="input-field w-40"
          value={filter.type}
          onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="WALL">Wall</option>
          <option value="SLAB">Slab</option>
        </select>
        <select
          className="input-field w-40"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">All Status</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pour Code</th>
                <th>Floor</th>
                <th>Zone</th>
                <th>Type</th>
                <th>Planned Date</th>
                <th>Area (m²)</th>
                <th>System</th>
                <th>Status</th>
                <th>Kit Cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p, i) => (
                <tr key={p.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 20, 500)}ms` }}>
                  <td className="font-mono text-xs font-semibold text-slate-200">{p.pour_code}</td>
                  <td>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 text-xs font-bold">
                      {p.floor_number}
                    </span>
                  </td>
                  <td className="text-slate-400">{p.zone_code}</td>
                  <td>
                    <span className={p.pour_type === 'WALL' ? 'badge-info' : 'badge-neutral'}>
                      {p.pour_type}
                    </span>
                  </td>
                  <td className="text-xs text-slate-400 font-mono">{p.planned_date}</td>
                  <td className="tabular-nums">{p.net_surface_area_m2.toFixed(1)}</td>
                  <td className="text-xs text-slate-500 font-mono">{p.assigned_system}</td>
                  <td><span className={statusColors[p.status] || 'badge-neutral'}>{p.status}</span></td>
                  <td className="tabular-nums text-right font-mono text-sm">
                    {p.kit_cost ? `₹${p.kit_cost.toLocaleString('en-IN')}` : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="p-4 text-center text-xs text-slate-500">
              Showing 100 of {filtered.length} pours
            </div>
          )}
        </div>
      )}

      {showAdd && project && (
        <AddPourModal
          projectId={project.id}
          onClose={() => setShowAdd(false)}
          onAdded={(newPour) => {
            setPours(prev => [...prev, newPour])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}
