import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import { Box, CheckCircle2, ChevronDown, ChevronRight, Shield, AlertTriangle } from 'lucide-react'

export default function Kits() {
  const { project } = useProject()
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedKit, setExpandedKit] = useState(null)
  const [approving, setApproving] = useState(null)

  useEffect(() => {
    if (!project) return
    loadKits()
  }, [project])

  function loadKits() {
    setLoading(true)
    api.getKits(project.id)
      .then(setKits)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleApprove(kitId) {
    setApproving(kitId)
    try {
      await api.approveKit(kitId)
      loadKits()
    } catch (e) {
      console.error(e)
    } finally {
      setApproving(null)
    }
  }

  const statusIcon = {
    STRIPPED: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    DEPLOYED: <Shield className="w-4 h-4 text-amber-400" />,
    CONFIRMED: <CheckCircle2 className="w-4 h-4 text-brand-400" />,
    PLANNED: <AlertTriangle className="w-4 h-4 text-slate-400" />,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Box className="w-6 h-6 text-violet-400" />
          Kit Manager
        </h1>
        <p className="text-sm text-slate-400 mt-1">{kits.length} kits generated — review, approve, or override</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {kits.map((kit, i) => (
            <div
              key={kit.id}
              className="glass-card-hover overflow-hidden animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'both' }}
            >
              {/* Kit Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedKit(expandedKit === kit.id ? null : kit.id)}
              >
                {statusIcon[kit.status]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-white">{kit.pour_code || kit.config_name}</span>
                    <span className={kit.status === 'STRIPPED' ? 'badge-success' : kit.status === 'DEPLOYED' ? 'badge-warning' : kit.status === 'CONFIRMED' ? 'badge-info' : 'badge-neutral'}>
                      {kit.status}
                    </span>
                    {kit.planner_approved && (
                      <span className="badge-success">Approved</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{kit.explanation}</p>
                </div>
                <div className="text-right mr-2">
                  <p className="text-sm font-bold text-white tabular-nums">₹{kit.total_cost.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500">{(kit.coverage_ratio * 100).toFixed(1)}% coverage</p>
                </div>
                {expandedKit === kit.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>

              {/* Expanded Detail */}
              {expandedKit === kit.id && (
                <div className="px-4 pb-4 border-t border-white/[0.04]">
                  <div className="mt-3">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-500">Strategy</p>
                        <p className="text-sm font-semibold text-slate-200">{kit.config_strategy}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Panel Area</p>
                        <p className="text-sm font-semibold text-slate-200">{kit.total_panel_area_m2.toFixed(1)} m²</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Components</p>
                        <p className="text-sm font-semibold text-slate-200">{kit.line_items.length} types</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Pieces</p>
                        <p className="text-sm font-semibold text-slate-200">
                          {kit.line_items.reduce((s, li) => s + li.quantity, 0)}
                        </p>
                      </div>
                    </div>

                    {/* Component Table */}
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Source</th>
                          <th className="text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kit.line_items.map(li => (
                          <tr key={li.id}>
                            <td>
                              <span className="font-mono text-xs text-slate-200">{li.component_code}</span>
                              <p className="text-[10px] text-slate-500">{li.description}</p>
                            </td>
                            <td><span className="badge-neutral text-[10px]">{li.component_type}</span></td>
                            <td className="tabular-nums font-semibold">{li.quantity}</td>
                            <td><span className="badge-info text-[10px]">{li.source}</span></td>
                            <td className="text-right tabular-nums font-mono text-xs">₹{li.cost_contribution.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Actions */}
                    {!kit.planner_approved && (
                      <div className="mt-4 flex gap-2">
                        <button
                          className="btn-primary text-xs"
                          disabled={approving === kit.id}
                          onClick={() => handleApprove(kit.id)}
                        >
                          {approving === kit.id ? 'Approving...' : 'Approve Kit'}
                        </button>
                        <button className="btn-secondary text-xs">Override</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {kits.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <Box className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p>No kits generated yet. Run the optimizer to generate kits.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
