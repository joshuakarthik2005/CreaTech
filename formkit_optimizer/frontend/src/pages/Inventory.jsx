import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import { Package, AlertCircle, ArrowUp, ArrowDown, Minus, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import AddInventoryModal from '../components/AddInventoryModal'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="custom-tooltip">
      <p className="text-xs font-bold text-white mb-1">{d.component_code}</p>
      <p className="text-xs text-slate-400">{d.description}</p>
      <div className="mt-1 space-y-0.5 text-xs">
        <p className="text-emerald-400">Available: {d.qty_available}</p>
        <p className="text-amber-400">Deployed: {d.qty_deployed}</p>
        <p className="text-rose-400">Under Repair: {d.qty_under_repair}</p>
        <p className="text-slate-300">Cycles Left: {d.avg_remaining_cycles.toFixed(0)}</p>
      </div>
    </div>
  )
}

export default function Inventory() {
  const { project } = useProject()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const reload = () => {
    if (!project) return
    api.getInventory(project.id).then(setItems).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!project) return
    reload()
  }, [project])

  const totalItems = items.reduce((s, i) => s + i.qty_total, 0)
  const totalDeployed = items.reduce((s, i) => s + i.qty_deployed, 0)
  const totalAvailable = items.reduce((s, i) => s + i.qty_available, 0)
  const avgUtil = items.length ? items.reduce((s, i) => s + i.utilization_pct, 0) / items.length : 0

  const chartData = items.map(i => ({
    ...i,
    name: i.component_code,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            Inventory Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">Real-time formwork component tracking</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          Set Stock
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Items', value: totalItems, color: 'text-white' },
          { label: 'Available', value: totalAvailable, color: 'text-emerald-400' },
          { label: 'Deployed', value: totalDeployed, color: 'text-amber-400' },
          { label: 'Avg Utilization', value: `${avgUtil.toFixed(1)}%`, color: 'text-cyan-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
          </div>
        ))}
      </div>

      {/* Utilization Chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Component Stock Levels</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="qty_available" name="Available" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="qty_deployed" name="Deployed" fill="#f59e0b" stackId="a" />
            <Bar dataKey="qty_under_repair" name="Repair" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>System</th>
                <th>Type</th>
                <th className="text-right">Available</th>
                <th className="text-right">Deployed</th>
                <th className="text-right">Repair</th>
                <th className="text-right">Total</th>
                <th>Utilization</th>
                <th className="text-right">Cycles Left</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className="font-mono text-xs font-semibold text-slate-200">{item.component_code}</span>
                    <p className="text-[10px] text-slate-500 max-w-[200px] truncate">{item.description}</p>
                  </td>
                  <td className="text-xs text-slate-400 font-mono">{item.system_code}</td>
                  <td><span className="badge-neutral text-[10px]">{item.component_type}</span></td>
                  <td className="text-right tabular-nums text-emerald-400 font-semibold">{item.qty_available}</td>
                  <td className="text-right tabular-nums text-amber-400">{item.qty_deployed}</td>
                  <td className="text-right tabular-nums text-rose-400">{item.qty_under_repair}</td>
                  <td className="text-right tabular-nums font-semibold">{item.qty_total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.utilization_pct > 70 ? 'bg-emerald-500' : item.utilization_pct > 30 ? 'bg-amber-500' : 'bg-slate-500'}`}
                          style={{ width: `${item.utilization_pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-10">{item.utilization_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums text-xs">
                    <span className={item.avg_remaining_cycles < 50 ? 'text-rose-400' : 'text-slate-400'}>
                      {item.avg_remaining_cycles.toFixed(0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Set Stock Modal */}
      {showAdd && project && (
        <AddInventoryModal
          projectId={project.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => { reload(); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
