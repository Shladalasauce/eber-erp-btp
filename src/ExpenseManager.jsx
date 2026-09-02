import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import AttachmentUploader from './AttachmentUploader';

export default function ExpenseManager({ projectId }) {
  const [expenses, setExpenses] = useState([]);
  const [bpuLines, setBpuLines] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [formData, setFormData] = useState({
    designation: '', montant_reel: '', quantite: 1, prix_unitaire: '', categorie: 'Matériaux', est_officiel: false, paiement_status: 'NON_PAYE', bpu_line_id: '', equipment_id: ''
  });

  useEffect(() => {
    fetchExpenses();
    fetchDependencies();
  }, [projectId]);

  async function fetchExpenses() {
    const { data } = await supabase.from('expenses').select('*, bpu_lines(designation), equipment(name)').eq('project_id', projectId).order('id', { ascending: false });
    if (data) setExpenses(data);
  }
  async function fetchDependencies() {
    const [bpu, eq] = await Promise.all([supabase.from('bpu_lines').select('*').eq('project_id', projectId), supabase.from('equipment').select('*').eq('status', 'ACTIF')]);
    if (bpu.data) setBpuLines(bpu.data);
    if (eq.data) setEquipments(eq.data);
  }

  // Handle dynamic updates between Total, Qty and Unit Price
  const handleAmountChange = (field, value) => {
    const val = parseFloat(value) || 0;
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'quantite' || field === 'prix_unitaire') {
        const q = field === 'quantite' ? val : parseFloat(prev.quantite) || 0;
        const pu = field === 'prix_unitaire' ? val : parseFloat(prev.prix_unitaire) || 0;
        if (q > 0 && pu > 0) updated.montant_reel = (q * pu).toFixed(2);
      }
      if (field === 'montant_reel') {
        const q = parseFloat(prev.quantite) || 1;
        if (q > 0) updated.prix_unitaire = (val / q).toFixed(2);
      }
      return updated;
    });
  };

  async function addExpense(e) {
    e.preventDefault();
    const montant = parseFloat(formData.montant_reel);
    const payload = {
      ...formData,
      project_id: projectId,
      montant_reel: montant,
      quantite: parseFloat(formData.quantite),
      prix_unitaire: parseFloat(formData.prix_unitaire),
      status: 'EN_ATTENTE',
      bpu_line_id: formData.bpu_line_id || null,
      equipment_id: formData.equipment_id || null
    };
    const { data, error } = await supabase.from('expenses').insert([payload]).select();
    if (!error && data) {
      alert("Dépense enregistrée et en attente de validation par la direction.");
      await logSystemEvent(projectId, 'CREATE', 'expenses', data[0].id, payload);
      setFormData({ designation: '', montant_reel: '', quantite: 1, prix_unitaire: '', categorie: 'Matériaux', est_officiel: false, paiement_status: 'NON_PAYE', bpu_line_id: '', equipment_id: '' });
      fetchExpenses();
    } else {
      alert("Erreur lors de l'enregistrement: " + (error?.message || ""));
    }
  }

  async function approveExpense(id) {
    if (!window.confirm("Approuver cette dépense ?")) return;
    const { error } = await supabase.from('expenses').update({ status: 'APPROUVEE' }).eq('id', id);
    if (!error) {
      await logSystemEvent(projectId, 'UPDATE_STATUS', 'expenses', id, { status: 'APPROUVEE' });
      fetchExpenses();
    } else {
      alert("Erreur: " + error.message);
    }
  }

  async function togglePaymentStatus(id, current) {
    const next = current === 'PAYE' ? 'NON_PAYE' : 'PAYE';
    const { error } = await supabase.from('expenses').update({ paiement_status: next }).eq('id', id);
    if (!error) fetchExpenses();
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-amber">💸 Saisie des Dépenses</h2>
      </div>

      <form onSubmit={addExpense} className="bg-amber/10 border border-amber/30 p-6 rounded-xl shadow-sm mb-8 grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full"
            placeholder="Désignation (ex: Achat Sable, Prime Chef...)"
            value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} required
          />
          <select
            className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none"
            value={formData.categorie} onChange={e => setFormData({...formData, categorie: e.target.value})}>
            <option>Matériaux</option>
            <option>Transport</option>
            <option>Gasoil</option>
            <option>Frais de mission</option>
            <option>Divers</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Quantité</label>
            <input
              className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full"
              type="number" step="any" placeholder="Qté"
              value={formData.quantite} onChange={e => handleAmountChange('quantite', e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Prix Unitaire (DH)</label>
            <input
              className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full"
              type="number" step="any" placeholder="P.U"
              value={formData.prix_unitaire} onChange={e => handleAmountChange('prix_unitaire', e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-amber mb-1">Montant Total TTC (DH)</label>
            <input
              className="border border-amber/50 bg-amber/5 p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full font-bold text-petrol"
              type="number" step="any" placeholder="Total"
              value={formData.montant_reel} onChange={e => handleAmountChange('montant_reel', e.target.value)} required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <select className="border border-white/50 bg-white p-3 rounded outline-none text-xs text-slate-500" value={formData.bpu_line_id} onChange={e => setFormData({...formData, bpu_line_id: e.target.value})}>
            <option value="">Lier à une ligne du BPU (Optionnel)</option>
            {bpuLines.map(l => <option key={l.id} value={l.id}>{l.code_prix} - {l.designation}</option>)}
          </select>
          <select className="border border-white/50 bg-white p-3 rounded outline-none text-xs text-slate-500" value={formData.equipment_id} onChange={e => setFormData({...formData, equipment_id: e.target.value})}>
            <option value="">Affecter à un Engin/Véhicule (Optionnel)</option>
            {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.plate_number})</option>)}
          </select>
        </div>

        <label className="flex items-center gap-3 bg-white p-4 rounded-lg border border-amber/20 cursor-pointer w-max shadow-sm mt-2">
          <input
            type="checkbox"
            className="w-5 h-5 text-amber rounded focus:ring-amber accent-amber"
            checked={formData.est_officiel} onChange={e => setFormData({...formData, est_officiel: e.target.checked})}
          />
          <span className="font-semibold text-slate-700">Dépense Officielle (Facturée / Comptabilité)</span>
        </label>

        <button type="submit" className="bg-amber text-white py-3 rounded-lg font-bold hover:bg-orange-500 transition shadow mt-2">
          Enregistrer la dépense
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-4 border-b border-slate-200">Désignation</th>
              <th className="p-4 border-b border-slate-200">Détails (Qté x PU)</th>
              <th className="p-4 border-b border-slate-200">Total</th>
              <th className="p-4 border-b border-slate-200 text-center">Approbation</th>
              <th className="p-4 border-b border-slate-200 text-center">Paiement</th>
              <th className="p-4 border-b border-slate-200">Type</th>
              <th className="p-4 border-b border-slate-200">Doc</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(ex => (
              <tr key={ex.id} className="hover:bg-slate-50 border-b border-slate-100 transition">
                <td className="p-4">
                  <div className="font-medium text-slate-700 text-sm">{ex.designation}</div>
                  <div className="text-slate-400 text-[10px] mt-1 uppercase font-bold">{ex.categorie}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {ex.bpu_lines && <span className="bg-slate-100 px-1 rounded border mr-1">Tâche: {ex.bpu_lines.designation}</span>}
                    {ex.equipment && <span className="bg-blue-50 text-blue-600 px-1 rounded border">🚜 {ex.equipment.name}</span>}
                  </div>
                </td>
                <td className="p-4 text-slate-600 text-xs">
                  {ex.quantite || 1} x {(ex.prix_unitaire || ex.montant_reel).toLocaleString()} DH
                </td>
                <td className={`p-4 font-bold text-sm ${ex.est_officiel ? 'text-petrol' : 'text-amber'}`}>
                  {ex.montant_reel.toLocaleString()} DH
                </td>
                <td className="p-4">
                  <div className="flex justify-center">
                    {ex.status === 'EN_ATTENTE' ? (
                      <div className="flex flex-col gap-1 items-center">
                        <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">⏳ ATTENTE</span>
                        <button onClick={() => approveExpense(ex.id)} className="bg-emerald text-white text-[9px] px-2 py-0.5 rounded shadow hover:bg-green-600 font-bold">
                          Approuver
                        </button>
                      </div>
                    ) : (
                      <span className="text-emerald-500 text-[10px] font-black">✅ VALIDÉ</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => togglePaymentStatus(ex.id, ex.paiement_status)}
                    className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                      ex.paiement_status === 'PAYE'
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-white text-rose-500 border-rose-200'
                    }`}
                  >
                    {ex.paiement_status === 'PAYE' ? 'PAYÉ' : 'À PAYER'}
                  </button>
                </td>
                <td className="p-4 text-center">
                  {ex.est_officiel ? (
                    <span className="bg-petrol/10 text-petrol px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Officiel</span>
                  ) : (
                    <span className="bg-amber/10 text-amber px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Noir</span>
                  )}
                </td>
                <td className="p-4">
                  <AttachmentUploader entityType="expense" entityId={ex.id} projectId={projectId} />
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400 font-medium">Aucune dépense enregistrée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
