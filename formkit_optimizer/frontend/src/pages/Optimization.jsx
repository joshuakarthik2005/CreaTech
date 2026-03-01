import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import AnimatedNumber from '../components/AnimatedNumber'
import {
  Zap, Play, CheckCircle2, Clock, TrendingDown, AlertTriangle,
  BarChart3, Database,
} from 'lucide-react'

export default function Optimization() {
  const { project } = useProject()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [latestResult, setLatestResult] = useState(null)

  useEffect(() => {
    if (!project) return
    loadRuns()
  }, [project])

  function loadRuns() {
    setLoading(true)
    api.getOptimizationRuns(project.id)
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleOptimize() {
    setRunning(true)
    setLatestResult(null)
    try {
      const result = await api.runOptimization({
        project_id: project.id,
        objective: 'MIN_COST',
        max_solve_time_seconds: 60,
      })
      setLatestResult(result)
      loadRuns()
    } catch (e) {
      alert(`Optimization failed: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  const statusBadge = {
    OPTIMAL: 'badge-success',
    FEASIBLE: 'badge-warning',
    RUNNING: 'badge-info',
    INFEASIBLE: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20',
    TIMEOUT: 'badge-warning',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Optimization Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">CP-SAT formwork optimizer — minimize cost, maximize reuse</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleOptimize}
          disabled={running}
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Solving...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Optimization
            </>
          )}
        </button>
      </div>

      {/* Live Result Card */}
      {running && (
        <div className="glass-card p-6 glow-brand animate-pulse-slow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Optimization in Progress</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Google OR-Tools CP-SAT solver exploring solution space...
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {['Building model...', 'Presolving...', 'Searching...'].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {latestResult && (
        <div className="glass-card p-6 border-emerald-500/20 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Latest Run Result</h3>
            <span className={`badge ${statusBadge[latestResult.status]}`}>{latestResult.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">Objective Value</p>
              <p className="text-xl font-bold text-white">₹<AnimatedNumber value={latestResult.objective_value} /></p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Solve Time</p>
              <p className="text-xl font-bold text-white"><AnimatedNumber value={latestResult.solve_time_seconds} decimals={2} />s</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pours Optimized</p>
              <p className="text-xl font-bold text-white"><AnimatedNumber value={latestResult.pours_optimized} /></p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Kits Generated</p>
              <p className="text-xl font-bold text-white"><AnimatedNumber value={latestResult.kits_generated} /></p>
            </div>
          </div>
          {latestResult.cost_breakdown && Object.keys(latestResult.cost_breakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-slate-500 mb-2">Cost Breakdown</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(latestResult.cost_breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03]">
                    <span className="text-xs text-slate-400 capitalize">{k.replace('_', ' ')}</span>
                    <span className="text-xs font-semibold text-white tabular-nums">₹{Number(v).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Runs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Optimization History</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run, i) => (
              <div key={run.id} className="glass-card-hover p-4 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Run #{runs.length - i}</span>
                      <span className={`badge ${statusBadge[run.status] || 'badge-neutral'}`}>{run.status}</span>
                      <span className="badge-neutral">{run.objective}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {run.pours_optimized} pours · {run.kits_generated} kits · {run.procurement_actions} procurement actions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white tabular-nums">₹{run.objective_value.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-500">{run.solve_time_seconds.toFixed(2)}s</p>
                  </div>
                  <div className="text-xs text-slate-500 w-28 text-right font-mono">
                    {run.created_at ? new Date(run.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p>No optimization runs yet. Click "Run Optimization" to start.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
