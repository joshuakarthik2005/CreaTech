import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Pours from './pages/Pours'
import Kits from './pages/Kits'
import Inventory from './pages/Inventory'
import Optimization from './pages/Optimization'
import Analytics from './pages/Analytics'
import { api } from './api/client'

export const ProjectContext = createContext(null)
export const useProject = () => useContext(ProjectContext)

export default function App() {
  const [project, setProject] = useState(null)
  const [allProjects, setAllProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const loadProjects = () =>
    api.getProjects()
      .then(projects => {
        setAllProjects(projects)
        if (projects.length > 0) setProject(p => p ? projects.find(x => x.id === p.id) || projects[0] : projects[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))

  // Switch to a specific project (used after creation)
  const refreshProjects = async (switchTo) => {
    const projects = await api.getProjects()
    setAllProjects(projects)
    if (switchTo) {
      const found = projects.find(p => p.id === switchTo.id)
      setProject(found || projects[0])
    } else if (projects.length > 0) {
      setProject(projects[0])
    }
  }

  useEffect(() => { loadProjects() }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold gradient-text">FormKit Optimizer</h2>
          <p className="text-slate-500 mt-2 text-sm">Initializing system...</p>
        </div>
      </div>
    )
  }

  return (
    <ProjectContext.Provider value={{ project, setProject, allProjects, refreshProjects }}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pours" element={<Pours />} />
          <Route path="/kits" element={<Kits />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/optimization" element={<Optimization />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ProjectContext.Provider>
  )
}
