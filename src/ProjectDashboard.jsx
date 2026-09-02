import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AIAssistant from './AIAssistant';

export default function ProjectDashboard({ projectId, bpuLines, userRole }) {
  const [expenses, setExpenses] = useState([]);
  const [labor, setLabor] = useState([]);
  const [invoices, setInvoices] = useState([]);

  async function fetchData() {
    const { data: exp } = await supabase.from('expenses').select('*').eq('project_id', projectId);
    const { data: lab } = await supabase.from('labor_logs').select('*').eq('project_id', projectId);
    const { data: inv } = await supabase.from('invoices').select('*').eq('project_id', projectId);
    if (exp) setExpenses(exp);
    if (lab) setLabor(lab);
    if (inv) setInvoices(inv);
  }

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const totalMarche = bpuLines.reduce((acc, l) => acc + (l.qte_marche * l.prix_unitaire), 0);
  const totalProduit = bpuLines.reduce((acc, l) => acc + ((l.qte_realisee || 0) * l.prix_unitaire), 0);
  const totalFacture = bpuLines.reduce((acc, l) => acc + ((l.qte_facturee || 0) * l.prix_unitaire), 0);

  const depensesOfficielles = expenses.filter(e => e.est_officiel).reduce((acc, e) => acc + e.montant_reel, 0);
  const depensesNoir = expenses.filter(e => !e.est_officiel).reduce((acc, e) => acc + e.montant_reel, 0);

  const coutMainOeuvre = labor.reduce((acc, l) => acc + (l.nombre_heures * l.prix_heure), 0);

  const totalDepensesReelles = depensesOfficielles + depensesNoir + coutMainOeuvre;
  const margeNette = totalProduit - totalDepensesReelles;
  const tauxMarge = totalProduit > 0 ? (margeNette / totalProduit) * 100 : 0;

  const widthOfficiel = totalDepensesReelles > 0 ? `${(depensesOfficielles/totalDepensesReelles)*100}%` : '0%';
  const widthNoir = totalDepensesReelles > 0 ? `${(depensesNoir/totalDepensesReelles)*100}%` : '0%';
  const widthLabor = totalDepensesReelles > 0 ? `${(coutMainOeuvre/totalDepensesReelles)*100}%` : '0%';

  if (userRole === 'CHEF_CHANTIER') {
    return (
      <div className="mt-6">
        <h2 className="text-3xl font-extrabold text-petrol mb-8">🏗️ Tableau de Bord Chantier</h2>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm mb-6">
           <h3 className="text-emerald-700 font-bold text-lg mb-2">Avancement Physique & Matériaux</h3>
           <p className="text-slate-600 mb-4">Enregistrez les avancements journaliers dans l'onglet <strong>"Avancement"</strong>. Gérez vos demandes de matériel dans <strong>"Achats & Logistique"</strong>.</p>
           <div className="text-2xl font-black text-emerald-600">{bpuLines.filter(l => (l.qte_realisee || 0) > 0).length} / {bpuLines.length} <span className="text-sm font-medium">Tâches entamées</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-3xl font-extrabold text-petrol mb-8">📊 Cockpit Direction</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-blue-100 font-medium uppercase tracking-wider mb-4 border-b border-blue-400/30 pb-2">État des Prestations</h3>
            <div className="mb-4">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block mb-1">Avancement Réalisé (Chantier)</span>
              <h2 className="text-2xl font-black">{totalProduit.toLocaleString()} DH</h2>
            </div>
            <div>
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block mb-1">Avancement Facturé (Attachements)</span>
              <h2 className="text-2xl font-black text-emerald-300">{totalFacture.toLocaleString()} DH</h2>
            </div>
          </div>
          <p className="text-sm text-blue-200 mt-6 border-t border-blue-400/30 pt-3 font-bold">Total Marché : {totalMarche.toLocaleString()} DH</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-6 rounded-2xl shadow-lg">
          <h3 className="text-red-100 font-medium uppercase tracking-wider mb-2">Coûts Totaux Réels</h3>
          <h2 className="text-4xl font-black mb-1">{totalDepensesReelles.toLocaleString()} DH</h2>
          <p className="text-sm text-red-200">Dépenses + Main d'œuvre</p>
        </div>

        <div className={`p-6 rounded-2xl shadow-lg text-white bg-gradient-to-br ${margeNette >= 0 ? 'from-emerald to-green-700' : 'from-orange-500 to-red-600'}`}>
          <h3 className="text-white/80 font-medium uppercase tracking-wider mb-2">Marge Nette (Vérité)</h3>
          <h2 className="text-4xl font-black mb-1">{margeNette.toLocaleString()} DH</h2>
          <p className="text-sm text-white/90 font-bold">Rentabilité : {tauxMarge.toFixed(1)} %</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100">
        <h3 className="text-xl font-bold text-slate-700 mb-6 uppercase tracking-wide">🔍 Répartition des Coûts</h3>

        <div className="w-full h-8 bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
            <div style={{ width: widthOfficiel }} className="bg-petrol transition-all duration-500"></div>
            <div style={{ width: widthLabor }} className="bg-slate-500 transition-all duration-500"></div>
            <div style={{ width: widthNoir }} className="bg-amber transition-all duration-500"></div>
        </div>

        <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-petrol inline-block"></span>
              <span className="font-semibold text-slate-600">Achats Officiels: {depensesOfficielles.toLocaleString()} DH</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-500 inline-block"></span>
              <span className="font-semibold text-slate-600">Main d'œuvre: {coutMainOeuvre.toLocaleString()} DH</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-amber inline-block"></span>
              <span className="font-semibold text-slate-600">Achats Noir: {depensesNoir.toLocaleString()} DH</span>
            </div>
        </div>
      </div>

      {/* AI Assistant Section */}
      <AIAssistant
        projectInfo={{ name: 'Projet', delai_execution_jours: 90 }} // In a real app we pass the full selectedProject object
        bpuLines={bpuLines}
        expenses={expenses}
        labor={labor}
        invoices={invoices}
      />
    </div>
  );
}
