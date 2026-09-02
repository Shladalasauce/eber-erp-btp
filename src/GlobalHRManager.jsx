import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function GlobalHRManager() {
  const [personnel, setPersonnel] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    type_contrat: 'CDI',
    type_emploi: 'TEMPS_PLEIN',
    role: '',
    cout_horaire_moyen: 0,
    statut: 'ACTIF',
    date_embauche: '',
    current_project_id: null
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [personnelRes, projectsRes] = await Promise.all([
      supabase.from('personnel').select('*, projects(name)').order('nom', { ascending: true }),
      supabase.from('projects').select('id, name').order('name', { ascending: true })
    ]);

    if (personnelRes.data) setPersonnel(personnelRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  }

  const openNewModal = () => {
    setEditingPerson(null);
    setFormData({
      matricule: '',
      nom: '',
      prenom: '',
      type_contrat: 'CDI',
      type_emploi: 'TEMPS_PLEIN',
      role: '',
      cout_horaire_moyen: 0,
      statut: 'ACTIF',
      date_embauche: '',
      current_project_id: null
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingPerson(p);
    setFormData({
      matricule: p.matricule || '',
      nom: p.nom,
      prenom: p.prenom,
      type_contrat: p.type_contrat || 'CDI',
      type_emploi: p.type_emploi || 'TEMPS_PLEIN',
      role: p.role || '',
      cout_horaire_moyen: p.cout_horaire_moyen || 0,
      statut: p.statut || 'ACTIF',
      date_embauche: p.date_embauche || '',
      current_project_id: p.current_project_id || null
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingPerson) {
      const { error } = await supabase.from('personnel').update(formData).eq('id', editingPerson.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('personnel').insert([formData]);
      if (error) alert(error.message);
    }
    setShowModal(false);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet employé ?")) return;
    const { error } = await supabase.from('personnel').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
  };

  // Stats
  const activeCount = personnel.filter(p => p.statut === 'ACTIF').length;
  const assignedCount = personnel.filter(p => p.current_project_id !== null).length;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Effectif</div>
          <div className="text-2xl font-black text-petrol">{personnel.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-emerald-500 text-xs font-bold uppercase mb-1">Actifs</div>
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-blue-500 text-xs font-bold uppercase mb-1">Sur Chantier</div>
          <div className="text-2xl font-black text-blue-600">{assignedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="text-amber-500 text-xs font-bold uppercase mb-1">Disponibles / Siège</div>
          <div className="text-2xl font-black text-amber-600">{activeCount - assignedCount}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-petrol">👷 Registre du Personnel & Affectations</h2>
            <p className="text-sm text-slate-500">Gérez l'ensemble des employés et leurs chantiers actuels.</p>
          </div>
          <button onClick={openNewModal} className="bg-emerald text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-600 transition">
            ➕ Ajouter Employé
          </button>
        </div>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-3 font-bold">Personnel</th>
                  <th className="p-3 font-bold">Contrat & Type</th>
                  <th className="p-3 font-bold">Affectation Actuelle</th>
                  <th className="p-3 font-bold">Coût Horaire</th>
                  <th className="p-3 font-bold">Statut</th>
                  <th className="p-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                    <td className="p-3">
                      <div className="font-bold text-petrol">{p.nom} {p.prenom}</div>
                      <div className="text-[10px] font-mono text-slate-400">{p.matricule || 'Sans matricule'} • {p.role || 'Pas de rôle'}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold w-max">{p.type_contrat}</span>
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold w-max">{p.type_emploi?.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {p.current_project_id ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald rounded-full animate-pulse"></span>
                          <span className="font-bold text-slate-700">{p.projects?.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Non affecté (Disponible)</span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-amber">{Number(p.cout_horaire_moyen).toLocaleString()} DH/h</td>
                    <td className="p-3">
                      {p.statut === 'ACTIF' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">✅ ACTIF</span>}
                      {p.statut === 'CONGE' && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">🏖️ CONGÉ</span>}
                      {p.statut === 'INACTIF' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">❌ INACTIF</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEditModal(p)} className="text-blue-500 hover:text-blue-700 font-bold">Modifier</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 font-bold">Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {personnel.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-400">Aucun personnel enregistré.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg">
            <h3 className="font-black text-2xl text-petrol mb-4">
              {editingPerson ? 'Modifier Employé' : 'Nouvel Employé'}
            </h3>

            <form onSubmit={handleSave} className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nom *</label>
                  <input className="w-full border p-2 rounded" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Prénom *</label>
                  <input className="w-full border p-2 rounded" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Type de Contrat</label>
                  <select className="w-full border p-2 rounded" value={formData.type_contrat} onChange={e => setFormData({...formData, type_contrat: e.target.value})}>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="INTERIM">Intérim</option>
                    <option value="SOUS_TRAITANT">Sous-traitant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Type d'Emploi</label>
                  <select className="w-full border p-2 rounded" value={formData.type_emploi} onChange={e => setFormData({...formData, type_emploi: e.target.value})}>
                    <option value="TEMPS_PLEIN">Temps Plein</option>
                    <option value="TEMPS_PARTIEL">Temps Partiel</option>
                    <option value="CONTRACTUEL">Contractuel</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Affectation Chantier</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={formData.current_project_id || ''}
                    onChange={e => setFormData({...formData, current_project_id: e.target.value || null})}
                  >
                    <option value="">Aucun (Disponible / Siège)</option>
                    {projects.map(pj => (
                      <option key={pj.id} value={pj.id}>{pj.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Coût Horaire (DH)</label>
                  <input type="number" step="any" className="w-full border p-2 rounded" value={formData.cout_horaire_moyen} onChange={e => setFormData({...formData, cout_horaire_moyen: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rôle / Poste</label>
                  <input className="w-full border p-2 rounded" placeholder="Ex: Chef de chantier" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Matricule</label>
                  <input className="w-full border p-2 rounded" value={formData.matricule} onChange={e => setFormData({...formData, matricule: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                  <select className="w-full border p-2 rounded" value={formData.statut} onChange={e => setFormData({...formData, statut: e.target.value})}>
                    <option value="ACTIF">Actif</option>
                    <option value="CONGE">En congé</option>
                    <option value="INACTIF">Inactif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date d'embauche</label>
                  <input type="date" className="w-full border p-2 rounded" value={formData.date_embauche} onChange={e => setFormData({...formData, date_embauche: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-4 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-emerald text-white font-bold rounded-lg shadow hover:bg-green-600">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
