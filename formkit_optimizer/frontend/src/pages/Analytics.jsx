import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Activity,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Cell,
} from 'recharts'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color || p.stroke }}>
          {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { project } = useProject()
  const [costTimeline, setCostTimeline] = useState([])
  const [floorCosts, setFloorCosts] = useState([])
  const [compUsage, setCompUsage] = useState([])
  const [pourTimeline, setPourTimeline] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!project) return
    setLoading(true)
    Promise.all([
      api.getCostTimeline(project.id),
      api.getFloorCosts(project.id),
      api.getComponentUsage(project.id),
      api.getPourTimeline(project.id),
      api.getDashboard(project.id),
    ])
      .then(([ct, fc, cu, pt, s]) => {
        setCostTimeline(ct)
        setFloorCosts(fc)
        setCompUsage(cu)
        setPourTimeline(pt)
        setStats(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [project])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Radar data for system health
  const radarData = stats ? [
    { metric: 'Schedule', value: stats.schedule_adherence },
    { metric: 'Coverage', value: (stats.avg_coverage || 0) * 100 },
    { metric: 'Savings', value: stats.cost_savings_pct * 5 },
    { metric: 'Utilization', value: stats.inventory_utilization },
    { metric: 'Reuse', value: Math.min(100, (stats.avg_reuse_factor || 0.5) * 100) },
    { metric: 'Optimization', value: Math.min(100, (stats.optimization_runs || 0) * 20) },
  ] : []

  // Scatter: area vs cost
  const scatterData = pourTimeline
    .filter(p => p.cost != null)
    .map(p => ({ name: p.pour_code, cost: p.cost, floor: p.floor }))

  // Reuse trend from floor costs
  const reuseTrend = floorCosts.map(f => ({
    floor: `F${f.floor}`,
    reuse: f.reuse_pct,
    cost_per_m2: f.total_cost > 0 ? Math.round(f.total_cost / (f.floor * 6)) : 0, // rough estimate
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-400" />
          Advanced Analytics
        </h1>
        <p className="text-sm text-slate-400 mt-1">Deep insights into formwork operations and optimization performance</p>
      </div>

      {/* Row 1: Cost Savings & Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Cumulative Cost — Optimized vs Traditional</h3>
          <p className="text-xs text-slate-500 mb-4">Running total shows growing savings over project lifecycle</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={costTimeline}>
              <defs>
                <linearGradient id="aOpt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3381ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3381ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aTrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="traditional_cost" name="Traditional" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#aTrad)" />
              <Area type="monotone" dataKey="optimized_cost" name="Optimized" stroke="#3381ff" strokeWidth={2} fill="url(#aOpt)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">System Health Radar</h3>
          <p className="text-xs text-slate-500 mb-4">Multi-dimensional performance profile</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Performance" dataKey="value" stroke="#3381ff" fill="#3381ff" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Floor Analysis & Reuse Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Cost by Floor — Wall vs Slab</h3>
          <p className="text-xs text-slate-500 mb-4">Stacked cost breakdown per floor level</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={floorCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="floor" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `F${v}`} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="wall_cost" name="Wall" fill="#3381ff" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="slab_cost" name="Slab" fill="#06b6d4" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Reuse Efficiency Trend</h3>
          <p className="text-xs text-slate-500 mb-4">Component reuse % improves as project progresses</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={reuseTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="floor" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[50, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="reuse" name="Reuse %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Scatter & Component Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Floor vs Kit Cost Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Each point represents an optimized kit assignment</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" dataKey="floor" name="Floor" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Floor', position: 'bottom', fontSize: 10, fill: '#64748b' }} />
              <YAxis type="number" dataKey="cost" name="Cost" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${v}`} />
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="custom-tooltip">
                    <p className="text-xs font-bold text-white">{payload[0]?.payload?.name}</p>
                    <p className="text-xs text-slate-400">Floor {payload[0]?.value} · ₹{payload[1]?.value?.toLocaleString('en-IN')}</p>
                  </div>
                ) : null
              } />
              <Scatter data={scatterData} fill="#8b5cf6" fillOpacity={0.7}>
                {scatterData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${250 + i * 3}, 70%, 65%)`} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Component Utilization Rankings</h3>
          <p className="text-xs text-slate-500 mb-4">Top components by deployment rate</p>
          <div className="space-y-3">
            {compUsage.slice(0, 10).map((c, i) => (
              <div key={c.component} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-5 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-300 font-mono">{c.component}</span>
                    <span className="text-xs text-slate-400">{c.used}/{c.used + c.available}</span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${c.utilization}%`,
                        background: `linear-gradient(90deg, #3381ff, ${c.utilization > 60 ? '#10b981' : '#f59e0b'})`,
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums w-10 text-right text-white">
                  {c.utilization.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
