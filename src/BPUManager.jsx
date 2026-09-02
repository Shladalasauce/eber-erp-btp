import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import { analyzeBPUFile } from './geminiService';

export default function BPUManager({ projectId, onUpdate }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [totalMarche, setTotalMarche] = useState(0);
  const [aiProposal, setAiProposal] = useState(null);

  const [formData, setFormData] = useState({
    code_prix: '', designation: '', unite: '', qte_marche: '', prix_unitaire: '', qte_realisee: 0
  });

  useEffect(() => {
    fetchBPULines();
  }, [projectId]);

  useEffect(() => {
    const total = lines.reduce((acc, l) => acc + (l.qte_marche * l.prix_unitaire), 0);
    setTotalMarche(total);
  }, [lines]);

  async function fetchBPULines() {
    const { data, error } = await supabase.from('bpu_lines').select('*').eq('project_id', projectId).order('code_prix', { ascending: true });
    if (!error) setLines(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      project_id: projectId,
      qte_marche: parseFloat(formData.qte_marche),
      prix_unitaire: parseFloat(formData.prix_unitaire)
    };

    const { data, error } = await supabase.from('bpu_lines').insert([payload]).select();

    if (error) {
      alert("Erreur lors de l'ajout: " + error.message);
    } else if (data && data.length > 0) {
      await logSystemEvent(projectId, 'CREATE', 'bpu_lines', data[0].id, payload);
      setFormData({ code_prix: '', designation: '', unite: '', qte_marche: '', prix_unitaire: '', qte_realisee: 0 });
      fetchBPULines();
      if(onUpdate) onUpdate();
    }
    setLoading(false);
  }

  async function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const parsedLines = await analyzeBPUFile(file);
      if (Array.isArray(parsedLines) && parsedLines.length > 0) {
        setAiProposal(parsedLines);
      } else {
        alert("L'IA n'a trouvé aucune ligne valide.");
      }
    } catch (err) {
      alert("Erreur lors de l'analyse : " + err.message);
    } finally {
      setIsScanning(false);
      e.target.value = null;
    }
  }

  async function handleConfirmAIProposal() {
    setLoading(true);
    try {
      const payload = aiProposal.map(line => ({
        project_id: projectId,
        code_prix: line.code_prix || '',
        designation: line.designation || '',
        unite: line.unite || 'U',
        qte_marche: parseFloat(line.qte_marche) || 0,
        prix_unitaire: parseFloat(line.prix_unitaire) || 0,
        qte_realisee: 0
      }));

      const { data, error } = await supabase.from('bpu_lines').insert(payload).select();

      if (error) throw error;

      if (data) {
        for (const item of data) {
          await logSystemEvent(projectId, 'CREATE', 'bpu_lines', item.id, item);
        }
      }

      alert(`${aiProposal.length} lignes importées avec succès.`);
      setAiProposal(null);
      fetchBPULines();
      if(onUpdate) onUpdate();
    } catch (err) {
      alert("Erreur lors de l'import : " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-petrol">⚙️ Configuration BPU</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/pdf"
              onChange={handleFileSelection}
              disabled={isScanning}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
              title="Importer un fichier Excel/CSV/PDF"
            />
            <button
              disabled={isScanning}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {isScanning ? '⏳ Analyse IA en cours...' : '🤖 Importer BPU via IA (Excel/PDF)'}
            </button>
          </div>
          <div className="bg-emerald text-white px-4 py-2 rounded-lg shadow font-semibold">
            Montant Marché: {totalMarche.toLocaleString()} DH
          </div>
        </div>
      </div>

      {aiProposal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-2xl text-petrol mb-4">🤖 Validation de l'Import BPU</h3>
            <p className="text-slate-500 mb-6">L'IA a extrait les {aiProposal.length} lignes suivantes. Veuillez vérifier avant validation.</p>
            <div className="bg-slate-50 rounded-xl overflow-hidden mb-6 border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase tracking-wider">
                    <th className="p-3 border-b">Code</th>
                    <th className="p-3 border-b">Désignation</th>
                    <th className="p-3 border-b">Unité</th>
                    <th className="p-3 border-b text-right">Qté</th>
                    <th className="p-3 border-b text-right">P.U (DH)</th>
                  </tr>
                </thead>
                <tbody>
                  {aiProposal.map((line, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-white">
                      <td className="p-3 font-semibold text-slate-700">{line.code_prix}</td>
                      <td className="p-3 text-slate-600">{line.designation}</td>
                      <td className="p-3 text-slate-500">{line.unite}</td>
                      <td className="p-3 font-medium text-right">{line.qte_marche}</td>
                      <td className="p-3 font-medium text-right">{line.prix_unitaire}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-4">
              <button onClick={() => setAiProposal(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={handleConfirmAIProposal} disabled={loading} className="px-4 py-2 bg-emerald text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-50">Valider et Importer</button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md mb-8 grid gap-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border border-gray-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none" placeholder="Code Prix (ex: 1.1)" value={formData.code_prix} onChange={e => setFormData({...formData, code_prix: e.target.value})} required />
          <input className="border border-gray-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none" placeholder="Unité (ex: m3, ml)" value={formData.unite} onChange={e => setFormData({...formData, unite: e.target.value})} required />
        </div>
        <input className="border border-gray-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none w-full" placeholder="Désignation des travaux" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border border-gray-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none" type="number" step="any" placeholder="Quantité Marché" value={formData.qte_marche} onChange={e => setFormData({...formData, qte_marche: e.target.value})} required />
          <input className="border border-gray-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none" type="number" step="any" placeholder="Prix Unitaire (DH)" value={formData.prix_unitaire} onChange={e => setFormData({...formData, prix_unitaire: e.target.value})} required />
        </div>
        <button type="submit" disabled={loading} className="bg-petrol text-white py-3 rounded-lg font-bold hover:bg-slate-700 transition shadow disabled:opacity-50">
          {loading ? 'Enregistrement...' : 'Ajouter la ligne au BPU'}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-petrol text-white">
              <th className="p-4 border-b border-slate-600">Code</th>
              <th className="p-4 border-b border-slate-600">Désignation</th>
              <th className="p-4 border-b border-slate-600">Unité</th>
              <th className="p-4 border-b border-slate-600">Qté Marché</th>
              <th className="p-4 border-b border-slate-600">P.U (DH)</th>
              <th className="p-4 border-b border-slate-600 text-right">Total (DH)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.id} className="hover:bg-slate-50 border-b border-slate-100 transition">
                <td className="p-4 font-semibold text-slate-700">{line.code_prix}</td>
                <td className="p-4 text-slate-600">{line.designation}</td>
                <td className="p-4 text-slate-500">{line.unite}</td>
                <td className="p-4 font-medium">{line.qte_marche}</td>
                <td className="p-4 font-medium">{line.prix_unitaire?.toLocaleString()}</td>
                <td className="p-4 font-bold text-petrol text-right">
                  {(line.qte_marche * line.prix_unitaire).toLocaleString()}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-400">Aucune ligne saisie pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
