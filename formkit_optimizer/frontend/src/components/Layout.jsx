import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useProject } from '../App'
import {
  LayoutDashboard, Layers, Box, Package, Zap, BarChart3,
  ChevronRight, Building2, MapPin, Activity, Plus, ChevronDown, Check, FileSpreadsheet,
} from 'lucide-react'
import NewProjectModal from './NewProjectModal'
import ImportProjectModal from './ImportProjectModal'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pours', icon: Layers, label: 'Pour Schedule' },
  { to: '/kits', icon: Box, label: 'Kit Manager' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/optimization', icon: Zap, label: 'Optimizer' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function Layout() {
  const { project, setProject, allProjects, refreshProjects } = useProject()
  const location = useLocation()
  const [showNewProject, setShowNewProject] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)

  const handleProjectCreated = async (newProject) => {
    if (refreshProjects) await refreshProjects(newProject)
    else setProject(newProject)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col bg-surface-900/50 border-r border-white/[0.06]">
        {/* Logo */}
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">FormKit</h1>
              <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-[0.2em]">Optimizer</p>
            </div>
          </div>
        </div>

        {/* Project selector */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          {/* Active project row — click to expand */}
          <button
            onClick={() => setProjectsOpen(o => !o)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active Project</p>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${projectsOpen ? 'rotate-180' : ''}`} />
            </div>
            {project && (
              <>
                <p className="text-sm font-semibold text-white truncate">{project.project_name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location || '—'}</span>
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{project.total_pours} pours</span>
                </div>
              </>
            )}
          </button>

          {/* Dropdown: all projects */}
          {projectsOpen && (
            <div className="mt-2 space-y-1">
              {(allProjects || []).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setProject(p); setProjectsOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    project?.id === p.id
                      ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                    {project?.id === p.id
                      ? <Check className="w-3 h-3 text-brand-400" />
                      : <Building2 className="w-3 h-3 text-slate-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.project_name}</p>
                    <p className="text-[10px] text-slate-600 font-mono">{p.project_code}</p>
                  </div>
                  <span className="ml-auto text-[10px] text-slate-600 flex-shrink-0">{p.total_pours}p</span>
                </button>
              ))}
              <button
                onClick={() => { setProjectsOpen(false); setShowNewProject(true) }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-400 hover:bg-brand-500/10 border border-dashed border-brand-500/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
              <button
                onClick={() => { setProjectsOpen(false); setShowImport(true) }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-violet-400 hover:bg-violet-500/10 border border-dashed border-violet-500/30 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import from Excel
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{item.label}</span>
              {location.pathname === item.to && (
                <ChevronRight className="w-4 h-4 text-brand-400" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>System Online</span>
            <span className="ml-auto font-mono text-slate-600">v2.0</span>
          </div>
        </div>
      </aside>

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={handleProjectCreated}
        />
      )}

      {/* Import Project Modal */}
      {showImport && (
        <ImportProjectModal
          onClose={() => setShowImport(false)}
          onImported={async (projectId) => {
            await refreshProjects({ id: projectId })
          }}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-grid-pattern">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
