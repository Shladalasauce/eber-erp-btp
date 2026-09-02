import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import BPUManager from './BPUManager'
import ProgressManager from './ProgressManager'
import AttachmentManager from './AttachmentManager'
import ExpenseManager from './ExpenseManager'
import LaborManager from './LaborManager'
import ProjectDashboard from './ProjectDashboard'
import GlobalDashboard from './GlobalDashboard'
import DocumentManager from './DocumentManager'
import PlanningManager from './PlanningManager'
import InvoicingManager from './InvoicingManager'
import AuditTrail from './AuditTrail'
import GlobalTreasuryManager from './GlobalTreasuryManager'
import GlobalHRManager from './GlobalHRManager'
import ProcurementManager from './ProcurementManager'
import SubcontractorManager from './SubcontractorManager'

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(null)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  const [bpuLines, setBpuLines] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [globalTab, setGlobalTab] = useState('dashboard')

  const [userRole, setUserRole] = useState(null) // Simulated or Real RBAC
  const [realUserRole, setRealUserRole] = useState(null) // Actual DB Role
  const isAdmin = userRole === 'ADMIN' || userRole === 'DIRECTION'

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', client: '', appel_offre_num: '', marche_num: '', delai_execution_jours: 0, date_commencement: '' })
  const [isCreating, setIsCreating] = useState(false)

  async function fetchUserProfile(userId) {
    try {
      const { data, error } = await supabase.from('user_profiles').select('role').eq('id', userId).single()
      if (error) throw error
      if (data) {
        setUserRole(data.role)
        setRealUserRole(data.role)
      }
    } catch (error) {
      console.error("Erreur récupération profil:", error)
      setUserRole('CHEF_CHANTIER') // Fallback pour limiter les accès en cas d'erreur
      setRealUserRole('CHEF_CHANTIER')
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
      } else {
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
      } else {
        setUserRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchProjects()
    }
  }, [session])

  useEffect(() => {
    if (selectedProject) {
      fetchBpuLines(selectedProject.id)
    }
  }, [selectedProject])

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setLoginError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError(error.message)
    }
    setAuthLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSelectedProject(null)
  }

  async function fetchProjects() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('projects').select('*').order('id', { ascending: false })
      if (error) throw error
      setProjects(data)
    } catch (error) {
      alert("Erreur projets : " + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBpuLines(projectId) {
    const { data, error } = await supabase.from('bpu_lines').select('*').eq('project_id', projectId).order('code_prix', { ascending: true })
    if (!error) setBpuLines(data || [])
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    if (!newProject.name || !newProject.appel_offre_num) {
      alert("Le nom et le numéro d'appel d'offre sont obligatoires.")
      return
    }
    setIsCreating(true)
    const { data, error } = await supabase.from('projects').insert([{
      ...newProject,
      delai_execution_jours: parseInt(newProject.delai_execution_jours) || 0
    }]).select()
    if (!error && data) {
      setProjects([data[0], ...projects])
      setShowCreateModal(false)
      setNewProject({ name: '', client: '', appel_offre_num: '', marche_num: '', delai_execution_jours: 0, date_commencement: '' })
    } else {
      alert("Erreur: " + error?.message)
    }
    setIsCreating(false)
  }

  async function handleDeleteProject(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce projet et toutes ses données associées ? Cette action est irréversible.")) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) {
      setProjects(projects.filter(p => p.id !== id))
      setSelectedProject(null)
    } else {
      alert("Erreur lors de la suppression: " + error.message)
    }
  }

  async function handleUpdateProject(field, value) {
    const updated = { ...selectedProject, [field]: value }
    setSelectedProject(updated)
    const { data, error } = await supabase.from('projects').update({ [field]: value }).eq('id', selectedProject.id).select()

    if (error) {
      alert("Erreur lors de la mise à jour: " + error.message)
      return
    }

    if (!data || data.length === 0) {
      alert("La mise à jour a été refusée par la base de données. Vérifiez vos permissions de sécurité (RLS) sur la table projects.")
      return
    }

    setProjects(projects.map(p => p.id === selectedProject.id ? updated : p))
  }

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">Chargement...</div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-petrol tracking-tighter">EBER-OS</h1>
            <p className="text-sm text-slate-500 font-medium mt-2">Accès sécurisé réservé à la direction</p>
          </div>
          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-semibold border border-red-100 text-center">
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin} className="grid gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                required
              />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-petrol text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow mt-2">
              Se connecter
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (selectedProject) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
        <header className="bg-petrol text-white py-4 px-6 shadow-md flex justify-between items-center sticky top-0 z-50">
          <div>
            <h1 className="text-xl font-black tracking-widest">EBER-OS</h1>
            <p className="text-xs text-slate-300">Haute Intégrité Financière</p>
          </div>
          <div className="flex items-center gap-4">
            {(realUserRole === 'ADMIN' || realUserRole === 'DIRECTION') ? (
              <select
                value={userRole}
                onChange={e => setUserRole(e.target.value)}
                className="text-sm font-bold text-petrol bg-white px-3 py-1.5 rounded-lg outline-none cursor-pointer shadow-sm border border-slate-200"
              >
                <option value={realUserRole}>👁️ Voir comme : Direction</option>
                <option value="CHEF_CHANTIER">👁️ Voir comme : Chef de Chantier</option>
                <option value="CONDUCTEUR_TRAVAUX">👁️ Voir comme : Conducteur Tx</option>
              </select>
            ) : (
              <span className="text-sm font-bold bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
                {userRole === 'ADMIN' || userRole === 'DIRECTION' ? '👨‍💼 Direction' : '👷 Terrain'}
              </span>
            )}
            <button
              onClick={() => setSelectedProject(null)}
              className="text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"
            >
              ← Retour
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-bold bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-4xl font-extrabold text-petrol mb-2">
                {selectedProject.marche_num ? `Marché: ${selectedProject.marche_num}` : selectedProject.name}
              </h1>
              <p className="text-lg text-slate-500 font-medium">Nom :
                <input
                  className="ml-2 bg-transparent font-bold text-slate-700 outline-none border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.name}
                  onChange={(e) => handleUpdateProject('name', e.target.value)}
                  placeholder="Nom du projet (Obligatoire)"
                  required
                />
              </p>
              <p className="text-sm text-slate-500 font-medium">Client :
                <input
                  className="ml-2 bg-transparent font-bold text-slate-700 outline-none border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.client || ''}
                  onChange={(e) => handleUpdateProject('client', e.target.value)}
                  placeholder="Client"
                />
              </p>
            </div>

            <div className="flex gap-4 text-sm w-full md:w-auto">
              <div className="bg-slate-50 p-3 rounded-lg border border-red-200 flex-1 relative">
                <label className="block text-xs font-bold text-red-500 uppercase tracking-widest mb-1">N° Appel d'Offre *</label>
                <input
                  className="bg-transparent font-bold text-slate-700 outline-none w-full border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.appel_offre_num || ''}
                  onChange={(e) => handleUpdateProject('appel_offre_num', e.target.value)}
                  placeholder="Ex: AO 12/2023"
                  required
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">N° Marché</label>
                <input
                  className="bg-transparent font-bold text-slate-700 outline-none w-full border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.marche_num || ''}
                  onChange={(e) => handleUpdateProject('marche_num', e.target.value)}
                  placeholder="Ex: M 45/2024"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Délai (Jours)</label>
                <input
                  type="number"
                  className="bg-transparent font-bold text-slate-700 outline-none w-full border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.delai_execution_jours || ''}
                  onChange={(e) => handleUpdateProject('delai_execution_jours', parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date Commencement</label>
                <input
                  type="date"
                  className="bg-transparent font-bold text-slate-700 outline-none w-full border-b border-transparent focus:border-petrol transition"
                  value={selectedProject.date_commencement || ''}
                  onChange={(e) => handleUpdateProject('date_commencement', e.target.value)}
                />
              </div>
              <button
                onClick={() => handleDeleteProject(selectedProject.id)}
                className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-lg font-bold transition flex items-center justify-center border border-red-200"
                title="Supprimer le projet"
              >
                🗑️
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 border-b-2 border-slate-200 scrollbar-hide">
            {[
              { id: 'dashboard', label: '📊 Cockpit', color: 'petrol' },
              isAdmin && { id: 'config', label: '⚙️ BPU', color: 'petrol' },
              { id: 'achats', label: '🛒 Achats & Log', color: 'amber' },
              { id: 'subcontractors', label: '🤝 Sous-traitants', color: 'indigo-500' },
              { id: 'progress', label: '📈 Avancement', color: 'emerald' },
              isAdmin && { id: 'attachment', label: '📑 Attachements', color: 'emerald' },
              isAdmin && { id: 'depenses', label: '💸 Dépenses', color: 'amber' },
              { id: 'labor', label: '👷 Main d\'œuvre', color: 'slate-600' },
              { id: 'planning', label: '📅 Planning', color: 'indigo-600' },
              { id: 'documents', label: '📁 Documents', color: 'slate-700' }
            ].filter(Boolean).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-5 py-3 rounded-t-xl font-bold transition-all ${
                  activeTab === tab.id
                    ? `bg-white text-${tab.color} border-t-4 border-${tab.color} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]`
                    : 'bg-transparent text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeTab === 'dashboard' && <ProjectDashboard projectId={selectedProject.id} bpuLines={bpuLines} userRole={userRole} />}
            {activeTab === 'config' && isAdmin && <BPUManager projectId={selectedProject.id} onUpdate={() => fetchBpuLines(selectedProject.id)} />}
            {activeTab === 'achats' && <ProcurementManager projectId={selectedProject.id} userRole={userRole} />}
            {activeTab === 'subcontractors' && <SubcontractorManager projectId={selectedProject.id} userRole={userRole} />}
            {activeTab === 'progress' && <ProgressManager project={selectedProject} bpuLines={bpuLines} onUpdate={() => fetchBpuLines(selectedProject.id)} />}
            {activeTab === 'facturation' && <InvoicingManager projectId={selectedProject.id} />}
            {activeTab === 'attachment' && isAdmin && <AttachmentManager project={selectedProject} bpuLines={bpuLines} onUpdate={() => fetchBpuLines(selectedProject.id)} />}
            {activeTab === 'depenses' && isAdmin && <ExpenseManager projectId={selectedProject.id} />}
            {activeTab === 'labor' && <LaborManager projectId={selectedProject.id} />}
            {activeTab === 'planning' && <PlanningManager projectId={selectedProject.id} bpuLines={bpuLines} project={selectedProject} />}
            {activeTab === 'documents' && <DocumentManager projectId={selectedProject.id} />}
            {activeTab === 'audit' && <AuditTrail projectId={selectedProject.id} />}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-petrol text-white py-4 px-6 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black tracking-widest">EBER-OS</h1>
          <p className="text-xs text-slate-300">Siège Social</p>
        </div>
        <div className="flex items-center gap-4">
          {(realUserRole === 'ADMIN' || realUserRole === 'DIRECTION') ? (
            <select
              value={userRole}
              onChange={e => {setUserRole(e.target.value); setGlobalTab('dashboard');}}
              className="text-sm font-bold text-petrol bg-white px-3 py-1.5 rounded-lg outline-none cursor-pointer shadow-sm border border-slate-200"
            >
              <option value={realUserRole}>👁️ Voir comme : Direction</option>
              <option value="CHEF_CHANTIER">👁️ Voir comme : Chef de Chantier</option>
              <option value="CONDUCTEUR_TRAVAUX">👁️ Voir comme : Conducteur Tx</option>
            </select>
          ) : (
            <span className="text-sm font-bold bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
              {userRole === 'ADMIN' || userRole === 'DIRECTION' ? '👨‍💼 Direction' : '👷 Terrain'}
            </span>
          )}
        <button
          onClick={handleLogout}
          className="text-sm font-bold bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition"
        >
          Déconnexion
        </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">

        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setGlobalTab('dashboard')}
            className={`px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
              globalTab === 'dashboard' ? 'bg-petrol text-white' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            📊 Vue Entreprise
          </button>
          {isAdmin && <button
            onClick={() => setGlobalTab('treasury')}
            className={`px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
              globalTab === 'treasury' ? 'bg-amber text-white' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            💰 Trésorerie
          </button>}
          {isAdmin && <button
            onClick={() => setGlobalTab('hr')}
            className={`px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
              globalTab === 'hr' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            👷 RH & Personnel
          </button>}
          <button
            onClick={() => setGlobalTab('documents')}
            className={`px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
              globalTab === 'documents' ? 'bg-petrol text-white' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            📁 GED Entreprise
          </button>
        </div>

        {globalTab === 'dashboard' && (
          <>
            <GlobalDashboard />
            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-200 pb-2">
              <h2 className="text-2xl font-black text-petrol">🏗️ Mes Chantiers ({projects.length})</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow transition flex items-center gap-2"
              >
                <span>➕</span> Nouveau Projet
              </button>
            </div>

            {showCreateModal && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                  <h3 className="font-black text-2xl text-petrol mb-4">Créer un Nouveau Projet</h3>
                  <form onSubmit={handleCreateProject} className="grid gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nom du Projet *</label>
                      <input
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Numéro Appel d'Offre (AO) *</label>
                      <input
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.appel_offre_num} onChange={e => setNewProject({...newProject, appel_offre_num: e.target.value})} required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Numéro de Marché (Optionnel)</label>
                      <input
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.marche_num} onChange={e => setNewProject({...newProject, marche_num: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Délai d'exécution (Jours)</label>
                      <input
                        type="number"
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.delai_execution_jours || ''} onChange={e => setNewProject({...newProject, delai_execution_jours: e.target.value})}
                        placeholder="Ex: 90"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Date de commencement des travaux</label>
                      <input
                        type="date"
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.date_commencement || ''} onChange={e => setNewProject({...newProject, date_commencement: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Client (Optionnel)</label>
                      <input
                        className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-petrol outline-none"
                        value={newProject.client} onChange={e => setNewProject({...newProject, client: e.target.value})}
                      />
                    </div>
                    <div className="flex justify-end gap-4 mt-4 border-t border-slate-100 pt-4">
                      <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                      <button type="submit" disabled={isCreating} className="px-4 py-2 bg-petrol text-white font-bold rounded-lg hover:bg-slate-800 shadow disabled:opacity-50">
                        {isCreating ? 'Création...' : 'Créer le projet'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => { setSelectedProject(project); setActiveTab('dashboard'); }}
                  className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer border border-slate-100 group"
                >
                  <h3 className="text-2xl font-bold text-petrol mb-2 group-hover:text-emerald transition-colors">
                    {project.marche_num ? `Marché: ${project.marche_num}` : project.name}
                  </h3>
                  <div className="text-sm text-slate-500 font-medium mb-1">Nom : <span className="text-slate-800">{project.name}</span></div>
                  <div className="text-sm text-slate-500 font-medium">AO : <span className="text-slate-800">{project.appel_offre_num || 'N/A'}</span></div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-emerald">
                    <span>Accéder au Cockpit</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
              {projects.length === 0 && !loading && (
                <p className="col-span-full text-center py-12 text-slate-400 font-medium">Aucun projet trouvé. Cliquez sur "Nouveau Projet" pour commencer.</p>
              )}
            </div>
          </>
        )}

        {globalTab === 'documents' && <DocumentManager projectId={null} />}
        {globalTab === 'treasury' && <GlobalTreasuryManager />}
        {globalTab === 'hr' && <GlobalHRManager />}
      </main>
    </div>
  )
}

export default App
