import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import AttachmentUploader from './AttachmentUploader';

export default function ProgressManager({ project, bpuLines, onUpdate }) {
  const [nouvellesQuantites, setNouvellesQuantites] = useState({});
  const [commentaires, setCommentaires] = useState({});
  const [history, setHistory] = useState({});
  const [totalMarche, setTotalMarche] = useState(0);
  const [cumulPrecedent, setCumulPrecedent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalMaterialExpenses, setTotalMaterialExpenses] = useState(0);
  const [expandedLine, setExpandedLine] = useState(null);

  useEffect(() => {
    let totalM = 0;
    let cumulP = 0;
    bpuLines.forEach(line => {
      totalM += line.qte_marche * line.prix_unitaire;
      cumulP += (line.qte_realisee || 0) * line.prix_unitaire;
    });
    setTotalMarche(totalM);
    setCumulPrecedent(cumulP);

    async function fetchData() {
      // Fetch expenses for consistency checks
      const { data: expData } = await supabase.from('expenses').select('*').eq('project_id', project.id).eq('categorie', 'Matériaux');
      if (expData) {
        const totalMat = expData.reduce((acc, ex) => acc + ex.montant_reel, 0);
        setTotalMaterialExpenses(totalMat);
      }

      // Fetch progress history
      const { data: histData } = await supabase.from('bpu_progress_history').select('*').eq('project_id', project.id).order('date_saisie', { ascending: false });
      if (histData) {
        const histMap = {};
        histData.forEach(h => {
          if (!histMap[h.bpu_line_id]) histMap[h.bpu_line_id] = [];
          histMap[h.bpu_line_id].push(h);
        });
        setHistory(histMap);
      }
    }
    fetchData();
  }, [bpuLines, project.id]);

  const handleInputChange = (lineId, val) => {
    setNouvellesQuantites({ ...nouvellesQuantites, [lineId]: parseFloat(val) || 0 });
  };

  const handleCommentChange = (lineId, val) => {
    setCommentaires({ ...commentaires, [lineId]: val });
  };

  // Calcul du nouveau cumul théorique basé sur la saisie
  const nouveauCumulHT = bpuLines.reduce((acc, line) => {
    const qte = nouvellesQuantites[line.id] !== undefined ? nouvellesQuantites[line.id] : (line.qte_realisee || 0);
    return acc + (qte * line.prix_unitaire);
  }, 0);

  async function handleValider() {
    // Algorithmic Consistency Checks
    let hasWarnings = false;
    let warningMessages = [];

    // 1. Check if quantity exceeds market quantity
    for (const line of bpuLines) {
      const newQte = nouvellesQuantites[line.id] !== undefined ? nouvellesQuantites[line.id] : (line.qte_realisee || 0);
      if (newQte > line.qte_marche) {
        hasWarnings = true;
        warningMessages.push(`La quantité saisie pour "${line.designation}" (${newQte}) dépasse la quantité du marché (${line.qte_marche}).`);
      }
    }

    // 2. Check if material expenses are consistent with realized progress (heuristic: materials should be at least 15% of progress)
    if (nouveauCumulHT > 0 && totalMaterialExpenses < (nouveauCumulHT * 0.15)) {
      hasWarnings = true;
      warningMessages.push(`Le montant des fournitures entrées sur chantier (${totalMaterialExpenses.toLocaleString()} DH) semble incohérent par rapport à l'avancement réalisé (${nouveauCumulHT.toLocaleString()} DH).`);
    }

    if (hasWarnings) {
      const confirmMsg = "Avertissements de Cohérence Algorithmique:\n\n" + warningMessages.join('\n') + "\n\nVoulez-vous quand même forcer la validation ?";
      if (!window.confirm(confirmMsg)) return;
    }

    setIsProcessing(true);

    try {
      let updatedCount = 0;
      for (const line of bpuLines) {
        const newQte = nouvellesQuantites[line.id];
        if (newQte !== undefined && newQte !== line.qte_realisee) {
          const delta = newQte - (line.qte_realisee || 0);
          const { data, error } = await supabase.from('bpu_lines').update({ qte_realisee: newQte }).eq('id', line.id).select();

          if (error) {
            console.error("Erreur de mise à jour:", error);
            throw new Error(error.message);
          }

          if (!data || data.length === 0) {
            console.warn(`Ligne ${line.id} non mise à jour (problème de droits RLS ou introuvable).`);
            throw new Error(`Permission refusée ou ligne introuvable pour ${line.designation}. Vérifiez les règles RLS (UPDATE) sur la table bpu_lines.`);
          }

          // Insert history
          await supabase.from('bpu_progress_history').insert([{
            bpu_line_id: line.id,
            project_id: project.id,
            ancienne_qte: line.qte_realisee || 0,
            nouvelle_qte: newQte,
            commentaire: commentaires[line.id] || ''
          }]);

          updatedCount++;
          await logSystemEvent(project.id, 'UPDATE_PROGRESS', 'bpu_lines', line.id, { qte_ajoutee: delta, qte_realisee_nouvelle: newQte });
        }
      }

      if (updatedCount > 0) {
        alert("Avancement et historique enregistrés avec succès.");
      } else {
        alert("Aucune modification n'a été détectée.");
      }
      setNouvellesQuantites({});
      setCommentaires({});
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la validation: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="bg-petrol text-white p-6 rounded-xl shadow-lg mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">📈 Avancement Global du Chantier</h2>
          <p className="text-slate-300 mt-1">Saisie des quantités globales cumulées réalisées sur le chantier</p>
        </div>
        <div className="bg-white/10 p-4 rounded-lg text-right flex gap-6">
          <div>
            <p className="text-sm text-slate-300">Avancement Théorique Actuel</p>
            <p className="text-xl font-bold text-emerald">{cumulPrecedent.toLocaleString()} DH</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Total Marché</p>
            <p className="text-xl font-bold">{totalMarche.toLocaleString()} DH</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b border-slate-200 w-10"></th>
              <th className="p-4 border-b border-slate-200">Code</th>
              <th className="p-4 border-b border-slate-200">Désignation</th>
              <th className="p-4 border-b border-slate-200">Qté Marché</th>
              <th className="p-4 border-b border-slate-200">Déjà Réalisé</th>
              <th className="p-4 border-b border-slate-200 bg-emerald/10 text-emerald rounded-t-lg">Nouv. Qté Cumulée</th>
              <th className="p-4 border-b border-slate-200">Commentaire</th>
              <th className="p-4 border-b border-slate-200 text-right">Nouveau Cumul (DH)</th>
            </tr>
          </thead>
          <tbody>
            {bpuLines.map(line => {
              const prev = line.qte_realisee || 0;
              const newQte = nouvellesQuantites[line.id] !== undefined ? nouvellesQuantites[line.id] : prev;
              const isExpanded = expandedLine === line.id;

              return (
                <React.Fragment key={line.id}>
                  <tr className="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td className="p-4">
                      <button onClick={() => setExpandedLine(isExpanded ? null : line.id)} className="text-slate-400 hover:text-petrol">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">{line.code_prix}</td>
                    <td className="p-4 text-slate-600">{line.designation}</td>
                    <td className="p-4 text-slate-500">{line.qte_marche} {line.unite}</td>
                    <td className="p-4 text-slate-400 font-medium">{prev} {line.unite}</td>
                    <td className="p-4 bg-emerald/5">
                      <input
                        type="number"
                        placeholder={prev.toString()}
                        value={nouvellesQuantites[line.id] !== undefined ? nouvellesQuantites[line.id] : ''}
                        onChange={(e) => handleInputChange(line.id, e.target.value)}
                        className="w-24 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald outline-none bg-white text-center font-bold"
                      />
                    </td>
                    <td className="p-4 bg-emerald/5">
                      <input
                        type="text"
                        placeholder="Ex: Coulage béton A"
                        value={commentaires[line.id] || ''}
                        onChange={(e) => handleCommentChange(line.id, e.target.value)}
                        className="w-32 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald outline-none bg-white"
                        disabled={newQte === prev}
                      />
                    </td>
                    <td className="p-4 text-right font-bold text-petrol">
                      {(newQte * line.prix_unitaire).toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan="8" className="p-6 border-b border-slate-200">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                              <span>⏳ Chronologie d'Avancement</span>
                            </h4>
                            {history[line.id] && history[line.id].length > 0 ? (
                              <div className="space-y-4">
                                {history[line.id].map(entry => (
                                  <div key={entry.id} className="border-l-2 border-emerald pl-4 ml-2 relative">
                                    <div className="absolute w-3 h-3 bg-emerald rounded-full -left-[7px] top-1"></div>
                                    <p className="text-sm font-bold text-slate-700">
                                      {new Date(entry.date_saisie).toLocaleDateString()} - Passage de {entry.ancienne_qte} à {entry.nouvelle_qte} {line.unite}
                                    </p>
                                    {entry.commentaire && <p className="text-sm text-slate-500 italic mt-1">"{entry.commentaire}"</p>}
                                    <AttachmentUploader entityType="bpu_progress" entityId={entry.id} projectId={project.id} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400 italic">Aucun historique d'avancement pour le moment.</p>
                            )}
                          </div>

                          {/* We can attach global docs directly to the line too if we wanted */}
                          <div className="w-1/3 bg-white p-4 rounded border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-700 mb-2 text-sm">📁 Documents de la tâche (Plans, fiches techniques)</h4>
                            <AttachmentUploader entityType="bpu_line" entityId={line.id} projectId={project.id} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-100 border border-slate-200 p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 uppercase tracking-wide">Validation de l'Avancement</h3>
        <div className="space-y-3 text-lg mb-6">
          <div className="flex justify-between">
            <span className="text-slate-600">Nouveau Cumul Réalisé :</span>
            <span className="font-bold text-emerald">{nouveauCumulHT.toLocaleString()} DH</span>
          </div>
        </div>

        <button
          onClick={handleValider}
          disabled={isProcessing}
          className="w-full bg-emerald text-white py-4 rounded-xl font-bold text-xl hover:bg-green-600 transition shadow-lg disabled:opacity-50"
        >
          {isProcessing ? 'Enregistrement en cours...' : 'Enregistrer les Quantités Réalisées'}
        </button>
      </div>
    </div>
  );
}
