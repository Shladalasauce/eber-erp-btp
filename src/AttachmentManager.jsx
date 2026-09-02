import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { generateSituationPDF } from './Invoicing';
import { logSystemEvent } from './auditLogger';

export default function AttachmentManager({ project, bpuLines, onUpdate }) {
  const [quantitesAttachement, setQuantitesAttachement] = useState({});
  const [totalMarche, setTotalMarche] = useState(0);
  const [cumulFacturePrecedent, setCumulFacturePrecedent] = useState(0);
  const [cumulRealiseHT, setCumulRealiseHT] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let totalM = 0;
    let cumulF = 0;
    let cumulR = 0;
    bpuLines.forEach(line => {
      totalM += line.qte_marche * line.prix_unitaire;
      cumulF += (line.qte_facturee || 0) * line.prix_unitaire;
      cumulR += (line.qte_realisee || 0) * line.prix_unitaire;
    });
    setTotalMarche(totalM);
    setCumulFacturePrecedent(cumulF);
    setCumulRealiseHT(cumulR);
  }, [bpuLines]);

  const handleInputChange = (lineId, val) => {
    setQuantitesAttachement({ ...quantitesAttachement, [lineId]: parseFloat(val) || 0 });
  };

  // Montant à attacher ce mois-ci
  const montantDiffHT = bpuLines.reduce((acc, line) => {
    const qteAtt = quantitesAttachement[line.id] || 0;
    return acc + (qteAtt * line.prix_unitaire);
  }, 0);

  const nouveauCumulFactureHT = cumulFacturePrecedent + montantDiffHT;

  // Plafond RG = 7% du marché total
  const plafondRG = totalMarche * 0.07;

  // RG théorique cumulée = 10% du nouveau cumul facturé
  const nouvelleRGCumulee = Math.min(nouveauCumulFactureHT * 0.10, plafondRG);

  // Ancienne RG cumulée = 10% de l'ancien cumul facturé
  const ancienneRGCumulee = Math.min(cumulFacturePrecedent * 0.10, plafondRG);

  // RG applicable à ce paiement
  const rgMois = nouvelleRGCumulee - ancienneRGCumulee;

  const netAPayerMois = montantDiffHT - rgMois;

  async function handleValider() {
    if (montantDiffHT <= 0) return alert("Saisissez des quantités pour cet attachement.");

    // Validation logique
    for (const line of bpuLines) {
      const qteAtt = quantitesAttachement[line.id] || 0;
      const dejaFacture = line.qte_facturee || 0;
      const realise = line.qte_realisee || 0;

      if (dejaFacture + qteAtt > realise) {
        return alert(`Erreur: La quantité totale facturée pour "${line.designation}" (${dejaFacture + qteAtt}) ne peut pas dépasser la quantité réalisée sur le chantier (${realise}).`);
      }
    }

    setIsProcessing(true);

    try {
      let updatedCount = 0;
      const avancementsPourPDF = {};
      for (const line of bpuLines) {
        const qteAtt = quantitesAttachement[line.id];
        if (qteAtt && qteAtt > 0) {
          avancementsPourPDF[line.id] = qteAtt;
          const newQteFacturee = (line.qte_facturee || 0) + qteAtt;

          // Sauvegarder dans la DB (si la colonne qte_facturee existe)
          const { data, error } = await supabase.from('bpu_lines').update({ qte_facturee: newQteFacturee }).eq('id', line.id).select();

          if (error) throw new Error(error.message);

          if (!data || data.length === 0) {
            throw new Error(`Permission refusée pour mettre à jour la quantité facturée de ${line.designation}. Vérifiez les règles RLS (UPDATE) sur la table bpu_lines.`);
          }

          updatedCount++;
          await logSystemEvent(project.id, 'GENERATE_ATTACHMENT', 'bpu_lines', line.id, { qte_facturee_ajoutee: qteAtt, qte_facturee_totale: newQteFacturee });
        }
      }

      if (updatedCount > 0) {
        generateSituationPDF(project, bpuLines, avancementsPourPDF, montantDiffHT, rgMois, netAPayerMois);
        alert("Attachement généré et montants facturés mis à jour avec succès.");
      } else {
        alert("Aucune quantité à facturer n'a été trouvée.");
      }
      setQuantitesAttachement({});
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la génération de l'attachement: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="bg-petrol text-white p-6 rounded-xl shadow-lg mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">📑 Génération de l'Attachement (Facturation)</h2>
          <p className="text-slate-300 mt-1">Saisie des quantités à facturer pour ce décompte (inférieures ou égales au réalisé)</p>
        </div>
        <div className="bg-white/10 p-4 rounded-lg text-right flex gap-6">
          <div>
            <p className="text-sm text-slate-300">Total Réalisé (Chantier)</p>
            <p className="text-xl font-bold text-amber">{cumulRealiseHT.toLocaleString()} DH</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Total Déjà Facturé</p>
            <p className="text-xl font-bold text-emerald">{cumulFacturePrecedent.toLocaleString()} DH</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b border-slate-200">Désignation</th>
              <th className="p-4 border-b border-slate-200">Réalisé Chantier</th>
              <th className="p-4 border-b border-slate-200">Déjà Facturé</th>
              <th className="p-4 border-b border-slate-200">Reste à Facturer</th>
              <th className="p-4 border-b border-slate-200 bg-petrol/10 text-petrol rounded-t-lg">Qté Cet Attachement</th>
              <th className="p-4 border-b border-slate-200 text-right">Montant Attachement (DH)</th>
            </tr>
          </thead>
          <tbody>
            {bpuLines.map(line => {
              const realise = line.qte_realisee || 0;
              const facture = line.qte_facturee || 0;
              const reste = Math.max(realise - facture, 0);
              const attachement = quantitesAttachement[line.id] || 0;

              return (
                <tr key={line.id} className="hover:bg-slate-50 border-b border-slate-100 transition">
                  <td className="p-4 text-slate-600 font-semibold">{line.designation} <span className="text-xs text-slate-400">({line.code_prix})</span></td>
                  <td className="p-4 text-amber font-bold">{realise} {line.unite}</td>
                  <td className="p-4 text-emerald font-bold">{facture} {line.unite}</td>
                  <td className="p-4 text-slate-500 font-bold">{reste} {line.unite}</td>
                  <td className="p-4 bg-petrol/5">
                    <input
                      type="number"
                      placeholder="0"
                      max={reste}
                      min="0"
                      value={quantitesAttachement[line.id] || ''}
                      onChange={(e) => handleInputChange(line.id, e.target.value)}
                      className={`w-24 p-2 border ${attachement > reste ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'} rounded focus:ring-2 focus:ring-petrol outline-none text-center font-bold`}
                    />
                  </td>
                  <td className="p-4 text-right font-bold text-petrol">
                    {(attachement * line.prix_unitaire).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-100 border border-slate-200 p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 uppercase tracking-wide">Décompte Financier</h3>
        <div className="space-y-3 text-lg">
          <div className="flex justify-between">
            <span className="text-slate-600">Montant de cet attachement :</span>
            <span className="font-bold">{montantDiffHT.toLocaleString()} DH</span>
          </div>
          <div className="flex justify-between text-amber">
            <span>Retenue de Garantie (10% plafonnée) :</span>
            <span className="font-bold">- {rgMois.toLocaleString()} DH</span>
          </div>
          <div className="border-t border-slate-300 my-4 pt-4 flex justify-between text-2xl text-emerald">
            <span className="font-extrabold">Net à payer HT :</span>
            <span className="font-extrabold">{netAPayerMois.toLocaleString()} DH</span>
          </div>
        </div>

        <button
          onClick={handleValider}
          disabled={isProcessing || montantDiffHT <= 0}
          className="mt-8 w-full bg-petrol text-white py-4 rounded-xl font-bold text-xl hover:bg-slate-800 transition shadow-lg disabled:opacity-50"
        >
          {isProcessing ? 'Génération en cours...' : 'Valider et Générer le PDF'}
        </button>
      </div>
    </div>
  );
}
