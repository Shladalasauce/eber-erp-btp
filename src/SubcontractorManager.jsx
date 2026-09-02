import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';

export default function SubcontractorManager({ projectId, userRole }) {
  const [subcontractors, setSubcontractors] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [bpuLines, setBpuLines] = useState([]);

  const [newSub, setNewSub] = useState({ name: '', specialite: '' });
  const [newLine, setNewLine] = useState({ designation: '', unite: 'm2', qte_marche: '', prix_unitaire: '' });
  const [inputValues, setInputValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    fetchSubcontractors();
  }, [projectId]);

  useEffect(() => {
    if (selectedSub) fetchBpuLines(selectedSub.id);
  }, [selectedSub]);

  async function fetchSubcontractors() {
    const { data } = await supabase.from('subcontractors').select('*').eq('project_id', projectId);
    if (data) setSubcontractors(data);
  }

  async function fetchBpuLines(subId) {
    const { data } = await supabase.from('subcontractor_bpu').select('*').eq('subcontractor_id', subId).order('id');
    if (data) setBpuLines(data);
  }

  async function handleAddSub(e) {
    e.preventDefault();
    setIsProcessing(true);
    const payload = { project_id: projectId, name: newSub.name, specialite: newSub.specialite };
    const { data, error } = await supabase.from('subcontractors').insert([payload]).select();
    if (!error && data) {
      setSubcontractors([...subcontractors, data[0]]);
      setNewSub({ name: '', specialite: '' });
      setSelectedSub(data[0]);
    }
    setIsProcessing(false);
  }

  async function handleAddLine(e) {
    e.preventDefault();
    if (!selectedSub) return;
    setIsProcessing(true);
    const payload = {
      subcontractor_id: selectedSub.id,
      designation: newLine.designation,
      unite: newLine.unite,
      qte_marche: parseFloat(newLine.qte_marche),
      prix_unitaire: parseFloat(newLine.prix_unitaire)
    };
    const { data, error } = await supabase.from('subcontractor_bpu').insert([payload]).select();
    if (!error && data) {
      setBpuLines([...bpuLines, data[0]]);
      setNewLine({ designation: '', unite: 'm2', qte_marche: '', prix_unitaire: '' });
    }
    setIsProcessing(false);
  }

  async function updateQuantity(line, field) {
    const val = parseFloat(inputValues[`${line.id}_${field}`]);
    if (!val || val <= 0) return;

    const newVal = (line[field] || 0) + val;

    if (field === 'qte_facturee' && newVal > (line.qte_realisee || 0)) {
      return alert("Impossible de facturer plus que ce que le sous-traitant a réalisé sur le chantier !");
    }

    setIsProcessing(true);
    const { error } = await supabase.from('subcontractor_bpu').update({ [field]: newVal }).eq('id', line.id);
    if (!error) {
      await logSystemEvent(projectId, `UPDATE_SUB_${field.toUpperCase()}`, 'subcontractor_bpu', line.id, { added: val, total: newVal });
      fetchBpuLines(selectedSub.id);
      setInputValues({ ...inputValues, [`${line.id}_${field}`]: '' });
    }
    setIsProcessing(false);
  }

  const totalMarche = bpuLines.reduce((acc, l) => acc + (l.qte_marche * l.prix_unitaire), 0);
  const totalRealise = bpuLines.reduce((acc, l) => acc + ((l.qte_realisee || 0) * l.prix_unitaire), 0);
  const totalFacture = bpuLines.reduce((acc, l) => acc + ((l.qte_facturee || 0) * l.prix_unitaire), 0);

  return (
    <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
      {/* LEFT PANEL : SUBCONTRACTORS LIST */}
      <div className="w-full md:w-1/4 bg-white p-4 rounded-xl shadow-sm border border-slate-100 shrink-0">
        <h3 className="font-black text-indigo-600 mb-4 uppercase text-xs tracking-wider">Vos Sous-traitants</h3>
        <div className="flex flex-col gap-2 mb-6">
          {subcontractors.map(sub => (
            <button
              key={sub.id}
              onClick={() => setSelectedSub(sub)}
              className={`text-left p-3 rounded-lg border transition-all ${selectedSub?.id === sub.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
            >
              <div className="text-sm">{sub.name}</div>
              <div className="text-[10px] uppercase text-slate-400 font-bold">{sub.specialite}</div>
            </button>
          ))}
          {subcontractors.length === 0 && <p className="text-xs text-slate-400 italic p-2">Aucun sous-traitant</p>}
        </div>

        {isAdmin && (
          <form onSubmit={handleAddSub} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h4 className="text-xs font-bold text-slate-600 mb-2">Ajouter un sous-traitant</h4>
            <input className="w-full text-sm p-2 rounded border border-slate-200 mb-2 outline-none" placeholder="Nom d'entreprise" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} required />
            <input className="w-full text-sm p-2 rounded border border-slate-200 mb-2 outline-none" placeholder="Spécialité (ex: Plomberie)" value={newSub.specialite} onChange={e => setNewSub({...newSub, specialite: e.target.value})} />
            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-500 text-white text-xs font-bold py-2 rounded shadow hover:bg-indigo-600">Créer</button>
          </form>
        )}
      </div>

      {/* RIGHT PANEL : CONTRACT & PROGRESS */}
      <div className="w-full md:w-3/4 flex flex-col gap-6">
        {selectedSub ? (
          <>
            <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-black">{selectedSub.name}</h2>
                <p className="text-indigo-200 text-sm font-medium">{selectedSub.specialite} • Gestion du Contrat</p>
              </div>
              <div className="flex gap-6 text-right bg-black/20 p-3 rounded-lg">
                <div><div className="text-[10px] text-indigo-200 uppercase font-bold">Total Marché</div><div className="text-lg font-black">{totalMarche.toLocaleString()} DH</div></div>
                <div><div className="text-[10px] text-indigo-200 uppercase font-bold">Réalisé Chantier</div><div className="text-lg font-black text-amber-300">{totalRealise.toLocaleString()} DH</div></div>
                <div><div className="text-[10px] text-indigo-200 uppercase font-bold">Déjà Facturé</div><div className="text-lg font-black text-emerald-300">{totalFacture.toLocaleString()} DH</div></div>
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={handleAddLine} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-2">
                <input className="flex-1 border p-2 rounded text-sm" placeholder="Désignation (ex: Pose carrelage)" value={newLine.designation} onChange={e => setNewLine({...newLine, designation: e.target.value})} required />
                <input className="w-20 border p-2 rounded text-sm" placeholder="Unité" value={newLine.unite} onChange={e => setNewLine({...newLine, unite: e.target.value})} required />
                <input className="w-24 border p-2 rounded text-sm" type="number" step="any" placeholder="Qté" value={newLine.qte_marche} onChange={e => setNewLine({...newLine, qte_marche: e.target.value})} required />
                <input className="w-28 border p-2 rounded text-sm" type="number" step="any" placeholder="PU (DH)" value={newLine.prix_unitaire} onChange={e => setNewLine({...newLine, prix_unitaire: e.target.value})} required />
                <button type="submit" disabled={isProcessing} className="bg-petrol text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-800">Ajouter Ligne</button>
              </form>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b">Prestation</th>
                    <th className="p-3 border-b text-center">Marché</th>
                    <th className="p-3 border-b text-center text-amber-600 bg-amber-50/50">Avancement (Terrain)</th>
                    <th className="p-3 border-b text-center text-emerald-600 bg-emerald-50/50">Facturation (Siège)</th>
                  </tr>
                </thead>
                <tbody>
                  {bpuLines.map(line => (
                    <tr key={line.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-700">{line.designation} <div className="text-[10px] text-slate-400 font-normal">PU: {line.prix_unitaire.toLocaleString()} DH</div></td>
                      <td className="p-3 text-center font-medium text-slate-500">{line.qte_marche} {line.unite}</td>

                      <td className="p-3 bg-amber-50/20 border-l border-amber-100/50 text-center">
                        <div className="font-bold text-amber-600 mb-2">{(line.qte_realisee || 0)} {line.unite}</div>
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" placeholder="+ Qté" className="w-16 p-1 text-xs border rounded text-center outline-none focus:border-amber-400" value={inputValues[`${line.id}_qte_realisee`] || ''} onChange={e => setInputValues({...inputValues, [`${line.id}_qte_realisee`]: e.target.value})} />
                          <button onClick={() => updateQuantity(line, 'qte_realisee')} disabled={isProcessing} className="bg-amber text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm hover:bg-orange-500">Ajouter</button>
                        </div>
                      </td>

                      <td className="p-3 bg-emerald-50/20 border-l border-emerald-100/50 text-center">
                        <div className="font-bold text-emerald-600 mb-2">{(line.qte_facturee || 0)} {line.unite}</div>
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1">
                            <input type="number" placeholder="+ Qté" className="w-16 p-1 text-xs border rounded text-center outline-none focus:border-emerald-400" value={inputValues[`${line.id}_qte_facturee`] || ''} onChange={e => setInputValues({...inputValues, [`${line.id}_qte_facturee`]: e.target.value})} />
                            <button onClick={() => updateQuantity(line, 'qte_facturee')} disabled={isProcessing} className="bg-emerald text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm hover:bg-green-600">Facturer</button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Réservé direction</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-100 text-slate-400 font-medium">Sélectionnez un sous-traitant dans le menu pour voir son contrat.</div>
        )}
      </div>
    </div>
  );
}