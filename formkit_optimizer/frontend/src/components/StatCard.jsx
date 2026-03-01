import clsx from 'clsx'

export default function StatCard({ icon: Icon, label, value, subtext, color = 'brand', delay = 0 }) {
  const colorMap = {
    brand: 'from-brand-500 to-brand-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    violet: 'from-violet-500 to-violet-600',
    cyan: 'from-cyan-500 to-cyan-600',
    rose: 'from-rose-500 to-rose-600',
  }
  const glowMap = {
    brand: 'shadow-brand-500/10',
    emerald: 'shadow-emerald-500/10',
    amber: 'shadow-amber-500/10',
    violet: 'shadow-violet-500/10',
    cyan: 'shadow-cyan-500/10',
    rose: 'shadow-rose-500/10',
  }
  const textMap = {
    brand: 'text-brand-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    rose: 'text-rose-400',
  }

  return (
    <div
      className={clsx('stat-card animate-slide-up', `shadow-lg ${glowMap[color]}`)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
          <div className="text-2xl font-bold text-white mb-1">{value}</div>
          {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={clsx(
          'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg',
          colorMap[color], glowMap[color]
        )}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}
