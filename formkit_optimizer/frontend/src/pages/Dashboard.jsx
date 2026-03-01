import { useState, useEffect } from 'react'
import { useProject } from '../App'
import { api } from '../api/client'
import StatCard from '../components/StatCard'
import AnimatedNumber from '../components/AnimatedNumber'
import {
  Layers, Box, TrendingDown, Package, Zap, BarChart3,
  Activity, Clock, CheckCircle2, AlertTriangle, ArrowUpRight,
  Building2, Target, ShieldCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts'

const COLORS = ['#3381ff', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">₹{Number(p.value).toLocaleString('en-IN')}</span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { project } = useProject()
  const [stats, setStats] = useState(null)
  const [costTimeline, setCostTimeline] = useState([])
  const [floorCosts, setFloorCosts] = useState([])
  const [compUsage, setCompUsage] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!project) return
    setLoading(true)
    Promise.all([
      api.getDashboard(project.id),
      api.getCostTimeline(project.id),
      api.getFloorCosts(project.id),
      api.getComponentUsage(project.id),
      api.getActivity(project.id),
    ])
      .then(([s, ct, fc, cu, act]) => {
        setStats(s)
        setCostTimeline(ct)
        setFloorCosts(fc)
        setCompUsage(cu)
        setActivity(act)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [project])

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">No project loaded</p>
      </div>
    )
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pieData = [
    { name: 'Completed', value: stats.pours_completed },
    { name: 'Planned', value: stats.pours_planned },
    { name: 'In Progress', value: stats.total_pours - stats.pours_completed - stats.pours_planned },
  ].filter(d => d.value > 0)

  const gaugeData = [{ name: 'Utilization', value: stats.inventory_utilization, fill: '#3381ff' }]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            {project.project_name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            FormKit Optimizer — Real-time formwork intelligence
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{project.location}</p>
          <p className="font-mono">{project.project_code}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Layers} label="Total Pours" color="brand" delay={0}
          value={<AnimatedNumber value={stats.total_pours} />}
          subtext={`${stats.pours_completed} completed · ${stats.pours_planned} planned`}
        />
        <StatCard
          icon={Box} label="Kits Generated" color="violet" delay={80}
          value={<AnimatedNumber value={stats.total_kits} />}
          subtext={`${stats.optimization_runs} optimization runs`}
        />
        <StatCard
          icon={TrendingDown} label="Cost Savings" color="emerald" delay={160}
          value={<AnimatedNumber value={stats.cost_savings_pct} suffix="%" decimals={1} />}
          subtext="vs. traditional BoQ estimation"
        />
        <StatCard
          icon={Package} label="Inventory Utilization" color="cyan" delay={240}
          value={<AnimatedNumber value={stats.inventory_utilization} suffix="%" decimals={1} />}
          subtext={`${stats.total_components} component types tracked`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Timeline */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Cost Comparison</h3>
              <p className="text-xs text-slate-500 mt-0.5">Optimized vs Traditional BoQ over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded-full bg-brand-500" />
                Optimized
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 rounded-full bg-rose-500/60" />
                Traditional
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={costTimeline}>
              <defs>
                <linearGradient id="colorOpt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3381ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3381ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="optimized_cost" name="Optimized" stroke="#3381ff" strokeWidth={2} fill="url(#colorOpt)" />
              <Area type="monotone" dataKey="traditional_cost" name="Traditional" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#colorTrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pour Progress Pie */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Pour Progress</h3>
          <p className="text-xs text-slate-500 mb-4">Schedule completion status</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={['#10b981', '#3381ff', '#f59e0b'][i]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="custom-tooltip">
                      <p className="text-xs font-semibold">{payload[0].name}: {payload[0].value}</p>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs mt-2">
            {pieData.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: ['#10b981', '#3381ff', '#f59e0b'][i] }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Cost Breakdown */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Cost by Floor</h3>
          <p className="text-xs text-slate-500 mb-4">Wall vs Slab formwork cost per floor</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={floorCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="floor" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `F${v}`} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="wall_cost" name="Wall" fill="#3381ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="slab_cost" name="Slab" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Recent Activity</h3>
          <p className="text-xs text-slate-500 mb-4">System event log</p>
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {activity.map((a, i) => (
              <div key={a.id || i} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="mt-1 flex-shrink-0">
                  <ActivityIcon action={a.action} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300 leading-relaxed">{a.description}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Component Utilization Bar */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Component Utilization</h3>
        <p className="text-xs text-slate-500 mb-4">Deployed vs Available across component types</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {compUsage.slice(0, 9).map((c, i) => (
            <div key={c.component} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-300 truncate font-mono">{c.component}</p>
                <div className="mt-1.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 transition-all duration-1000"
                    style={{ width: `${Math.min(c.utilization, 100)}%`, transitionDelay: `${i * 100}ms` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 tabular-nums w-10 text-right">
                {c.utilization.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityIcon({ action }) {
  const iconMap = {
    OPTIMIZATION_RUN: <Zap className="w-3.5 h-3.5 text-brand-400" />,
    KIT_APPROVED: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    KIT_OVERRIDE: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    SCHEDULE_IMPORTED: <Clock className="w-3.5 h-3.5 text-cyan-400" />,
    SCHEDULE_UPDATED: <Clock className="w-3.5 h-3.5 text-cyan-400" />,
    SAP_MATERIALS_SYNCED: <Package className="w-3.5 h-3.5 text-violet-400" />,
    INVENTORY_UPDATED: <Package className="w-3.5 h-3.5 text-violet-400" />,
    BACKTEST_COMPLETE: <Target className="w-3.5 h-3.5 text-emerald-400" />,
    PROJECT_CREATED: <Building2 className="w-3.5 h-3.5 text-brand-400" />,
  }
  return (
    <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center">
      {iconMap[action] || <Activity className="w-3.5 h-3.5 text-slate-500" />}
    </div>
  )
}
