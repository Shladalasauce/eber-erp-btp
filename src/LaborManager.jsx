import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';

export default function LaborManager({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [formData, setFormData] = useState({
    personnel_id: '', nom_ouvrier: '', nombre_heures: '', prix_heure: '', hour_type: 'NORMALE', is_advance: false
  });

  useEffect(() => {
    fetchLogs();
    fetchPersonnel();
  }, [projectId]);

  async function fetchLogs() {
    const { data } = await supabase.from('labor_logs').select('*, personnel(nom, prenom)').eq('project_id', projectId).order('created_at', { ascending: false });
    if (data) setLogs(data);
  }

  async function fetchPersonnel() {
    const { data } = await supabase.from('personnel').select('*').eq('statut', 'ACTIF');
    if (data) setPersonnelList(data);
  }

  const handlePersonnelSelect = (e) => {
    const pid = e.target.value;
    if (!pid) {
      setFormData({...formData, personnel_id: '', nom_ouvrier: '', prix_heure: ''});
      return;
    }
    const person = personnelList.find(p => p.id === pid);
    setFormData({
      ...formData,
      personnel_id: pid,
      nom_ouvrier: `${person.nom} ${person.prenom}`,
      prix_heure: person.cout_horaire_moyen || ''
    });
  };

  async function addLog(e) {
    e.preventDefault();
    const payload = {
      project_id: projectId,
      personnel_id: formData.personnel_id || null,
      nom_ouvrier: formData.nom_ouvrier,
      nombre_heures: parseFloat(formData.nombre_heures),
      prix_heure: parseFloat(formData.prix_heure),
      hour_type: formData.hour_type,
      is_advance: formData.is_advance
    };

    const { data, error } = await supabase.from('labor_logs').insert([payload]).select();
    if (!error && data) {
      await logSystemEvent(projectId, 'CREATE', 'labor_logs', data[0].id, payload);
      setFormData({ personnel_id: '', nom_ouvrier: '', nombre_heures: '', prix_heure: '', hour_type: 'NORMALE', is_advance: false });
      fetchLogs();
    } else {
      alert("Erreur: " + (error?.message || ""));
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-bold text-slate-600 mb-6">👷 Pointage Main d'Œuvre</h2>

      <form onSubmit={addLog} className="bg-slate-100 border border-slate-200 p-6 rounded-xl shadow-sm mb-8 grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 flex gap-2">
            <select
              value={formData.personnel_id}
              onChange={handlePersonnelSelect}
              className="border border-white p-3 rounded focus:ring-2 focus:ring-slate-400 outline-none flex-1 bg-white shadow-sm"
            >
              <option value="">Sélectionner un employé (ou saisir un nom)</option>
              {personnelList.map(p => (
                <option key={p.id} value={p.id}>{p.nom} {p.prenom} ({p.role || p.type_contrat})</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Nom libre..."
              value={formData.nom_ouvrier}
              onChange={e => setFormData({...formData, nom_ouvrier: e.target.value, personnel_id: ''})}
              required
              className="border border-white p-3 rounded focus:ring-2 focus:ring-slate-400 outline-none w-1/3 bg-white shadow-sm"
            />
          </div>
          <input
            type="number" step="any"
            placeholder="Nb d'heures"
            value={formData.nombre_heures}
            onChange={e => setFormData({...formData, nombre_heures: e.target.value})}
            required
            className="border border-white p-3 rounded focus:ring-2 focus:ring-slate-400 outline-none w-full bg-white shadow-sm"
          />
          <input
            type="number" step="any"
            placeholder="Prix/h (DH)"
            value={formData.prix_heure}
            onChange={e => setFormData({...formData, prix_heure: e.target.value})}
            required
            className="border border-white p-3 rounded focus:ring-2 focus:ring-slate-400 outline-none w-full bg-white shadow-sm"
          />
        </div>
        <div className="flex gap-4 items-center">
          <select className="border p-3 rounded text-sm outline-none" value={formData.hour_type} onChange={e => setFormData({...formData, hour_type: e.target.value})}>
            <option value="NORMALE">Heure Normale</option>
            <option value="SUP">Heure Supplémentaire</option>
            <option value="PLUIE">Jour d'Intempérie/Pluie</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded border">
            <input type="checkbox" className="w-4 h-4" checked={formData.is_advance} onChange={e => setFormData({...formData, is_advance: e.target.checked})} />
            <span className="text-sm font-bold text-slate-600">Avance (Quinzaine)</span>
          </label>
        </div>
        <button type="submit" className="bg-slate-700 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow mt-2">
          Pointer la journée
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-200 text-slate-700 text-sm uppercase tracking-wider">
              <th className="p-4 border-b border-slate-300">Ouvrier / Employé</th>
              <th className="p-4 border-b border-slate-300">Heures</th>
              <th className="p-4 border-b border-slate-300">Prix / Heure</th>
              <th className="p-4 border-b border-slate-300 text-center">Type</th>
              <th className="p-4 border-b border-slate-300 text-right">Total Journalier</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-100 transition">
                <td className="p-4 font-bold text-slate-800">
                  {log.personnel ? `${log.personnel.nom} ${log.personnel.prenom}` : log.nom_ouvrier}
                  {log.personnel && <span className="ml-2 bg-slate-200 text-[10px] px-2 py-0.5 rounded text-slate-600">ENREGISTRÉ</span>}
                </td>
                <td className="p-4 text-slate-600">{log.nombre_heures} h</td>
                <td className="p-4 text-slate-600">{log.prix_heure?.toLocaleString()} DH</td>
                <td className="p-4 text-center">
                  <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded mr-1">{log.hour_type}</span>
                  {log.is_advance && <span className="text-[10px] font-bold px-2 py-1 bg-amber/20 text-amber-700 rounded">AVANCE</span>}
                </td>
                <td className="p-4 text-right font-bold text-amber">
                  {(log.nombre_heures * log.prix_heure).toLocaleString()} DH
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-400">Aucun pointage.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
