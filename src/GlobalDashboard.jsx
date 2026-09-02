import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function GlobalDashboard() {
  const [data, setData] = useState({
    projects: [],
    bpuLines: [],
    expenses: [],
    labor: [],
    invoices: [],
    personnel: [],
    pendingDAs: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      const [projRes, bpuRes, expRes, labRes, invRes, persRes, daRes] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('bpu_lines').select('*'),
        supabase.from('expenses').select('*, projects(name)'),
        supabase.from('labor_logs').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('personnel').select('*'),
        supabase.from('procurement_orders').select('*, projects(name)').eq('status', 'DA_CREEE')
      ]);

      setData({
        projects: projRes.data || [],
        bpuLines: bpuRes.data || [],
        expenses: expRes.data || [],
        labor: labRes.data || [],
        invoices: invRes.data || [],
        personnel: persRes.data || [],
        pendingDAs: daRes.data || []
      });
      setLoading(false);
    }
    fetchAllData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Analyse financière globale en cours...</div>;
  }

  // Production & Market Stats
  const totalMarche = data.bpuLines.reduce((acc, l) => acc + (l.qte_marche * l.prix_unitaire), 0);
  const totalProduction = data.bpuLines.reduce((acc, l) => acc + ((l.qte_realisee || 0) * l.prix_unitaire), 0);

  // Real Costs
  const depensesTTC = data.expenses.reduce((acc, e) => acc + e.montant_reel, 0);
  const coutMainOeuvre = data.labor.reduce((acc, l) => acc + (l.nombre_heures * l.prix_heure), 0);
  const totalCoutsReels = depensesTTC + coutMainOeuvre;

  const margeNette = totalProduction - totalCoutsReels;
  const rentabiliteGlobale = totalProduction > 0 ? (margeNette / totalProduction) * 100 : 0;

  // Treasury (Real Cash Flow)
  const encaissementsClients = data.invoices.filter(i => i.type === 'CLIENT' && i.status === 'PAYEE').reduce((acc, i) => acc + Number(i.montant_ttc), 0);
  const decaissementsFournisseurs = data.invoices.filter(i => i.type === 'FOURNISSEUR' && i.status === 'PAYEE').reduce((acc, i) => acc + Number(i.montant_ttc), 0);
  const decaissementsExpenses = data.expenses.filter(e => e.paiement_status === 'PAYE').reduce((acc, e) => acc + Number(e.montant_reel), 0);

  const soldeCashReel = encaissementsClients - (decaissementsFournisseurs + decaissementsExpenses + coutMainOeuvre);

  // HR Stats
  const activeStaff = data.personnel.filter(p => p.statut === 'ACTIF').length;
  const staffOnSite = data.personnel.filter(p => p.current_project_id !== null).length;

  // Inbox Data
  const pendingExpenses = data.expenses.filter(e => e.status === 'EN_ATTENTE');
  const pendingDAs = data.pendingDAs;

  return (
    <div className="mb-12 flex flex-col gap-8">
      <div className="flex justify-between items-end border-b-2 border-slate-200 pb-4">
        <div>
           <h2 className="text-3xl font-black text-petrol">🌐 Cockpit Entreprise</h2>
           <p className="text-slate-500 font-medium">Vue d'ensemble de la performance et de la santé financière.</p>
        </div>
        <div className="text-right">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dernière mise à jour</div>
           <div className="text-sm font-bold text-petrol">{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* GLOBAL INBOX DIRECTION */}
      {(pendingExpenses.length > 0 || pendingDAs.length > 0) && (
        <div className="bg-amber/10 border-2 border-amber/30 p-6 rounded-2xl shadow-sm">
          <h3 className="font-black text-amber text-lg mb-4 flex items-center gap-2">📥 Inbox Direction (À Valider)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingExpenses.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber/20">
                <h4 className="font-bold text-slate-700 text-sm mb-2">💸 Dépenses en attente ({pendingExpenses.length})</h4>
                <ul className="text-xs space-y-2 max-h-32 overflow-y-auto">
                  {pendingExpenses.map(e => <li key={e.id} className="flex justify-between border-b pb-1"><span>{e.designation} <span className="text-slate-400">({e.projects?.name})</span></span> <span className="font-bold text-rose-600">{e.montant_reel} DH</span></li>)}
                </ul>
              </div>
            )}
            {pendingDAs.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber/20">
                <h4 className="font-bold text-slate-700 text-sm mb-2">🛒 Demandes d'Achat (DA) ({pendingDAs.length})</h4>
                <ul className="text-xs space-y-2 max-h-32 overflow-y-auto">
                  {pendingDAs.map(da => <li key={da.id} className="flex justify-between border-b pb-1"><span>{da.description} <span className="text-slate-400">({da.projects?.name})</span></span> <span className="font-bold text-petrol">{da.quantite} Unités</span></li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 1: PERFORMANCE COMMERCIALE & PROJET */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Carnet de Commandes</h3>
          <h2 className="text-2xl font-black text-slate-800">{totalMarche.toLocaleString()} <span className="text-xs font-normal text-slate-400">DH</span></h2>
          <p className="text-[10px] font-semibold text-emerald-500 mt-2">{data.projects.length} chantiers en cours</p>
        </div>

        <div className="bg-petrol text-white p-6 rounded-2xl shadow-lg">
          <h3 className="text-slate-300 font-bold uppercase text-[10px] tracking-widest mb-1">Production (Avancement)</h3>
          <h2 className="text-2xl font-black">{totalProduction.toLocaleString()} <span className="text-xs font-normal text-slate-300">DH</span></h2>
          <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
            <div style={{ width: `${Math.min((totalProduction/totalMarche)*100, 100)}%` }} className="bg-emerald h-full"></div>
          </div>
          <p className="text-[10px] font-semibold text-slate-300 mt-1">{((totalProduction/totalMarche)*100).toFixed(1)}% du carnet réalisé</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Sorties (Coûts Réels)</h3>
          <h2 className="text-2xl font-black text-rose-600">{totalCoutsReels.toLocaleString()} <span className="text-xs font-normal text-slate-400">DH</span></h2>
          <p className="text-[10px] font-semibold text-rose-400 mt-2">Dépenses + Salaires Terrain</p>
        </div>

        <div className={`p-6 rounded-2xl shadow-lg text-white ${margeNette >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <h3 className="font-bold uppercase text-[10px] tracking-widest mb-1 text-white/80">Marge Brute Estimée</h3>
          <h2 className="text-2xl font-black">{margeNette.toLocaleString()} <span className="text-xs font-normal text-white/80">DH</span></h2>
          <p className="text-[10px] font-bold text-white/90 mt-2">Rentabilité Moyenne : {rentabiliteGlobale.toFixed(1)}%</p>
        </div>
      </div>

      {/* SECTION 2: TRÉSORERIE & RH QUICK VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* TREASURY WIDGET */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-petrol uppercase text-xs tracking-wider">💰 Santé de la Trésorerie (Flux Réels)</h3>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${soldeCashReel >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {soldeCashReel >= 0 ? 'POSITIF' : 'CRITIQUE'}
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Encaissements</div>
              <div className="text-xl font-black text-emerald-600">+{encaissementsClients.toLocaleString()} DH</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Décaissements</div>
              <div className="text-xl font-black text-rose-600">-{(decaissementsFournisseurs + decaissementsExpenses + coutMainOeuvre).toLocaleString()} DH</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Solde Cash Net</div>
              <div className={`text-xl font-black ${soldeCashReel >= 0 ? 'text-blue-600' : 'text-rose-700'}`}>
                {soldeCashReel.toLocaleString()} DH
              </div>
            </div>
          </div>
          <div className="px-6 py-3 bg-blue-600 text-white text-[10px] font-bold flex justify-between items-center">
             <span>TOTAL À PAYER (DETTES FOURNISSEURS & FRAIS)</span>
             <span>{(data.expenses.filter(e => e.paiement_status !== 'PAYE').reduce((acc, e) => acc + e.montant_reel, 0) + data.invoices.filter(i => i.type === 'FOURNISSEUR' && i.status !== 'PAYEE').reduce((acc, i) => acc + Number(i.montant_ttc), 0)).toLocaleString()} DH</span>
          </div>
        </div>

        {/* HR WIDGET */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-black text-petrol uppercase text-xs tracking-wider">👷 Ressources Humaines</h3>
          </div>
          <div className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-medium text-slate-600">Effectif Actif</span>
              <span className="text-lg font-black text-petrol">{activeStaff}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-medium text-slate-600">Personnel sur Chantier</span>
              <span className="text-lg font-black text-blue-600">{staffOnSite}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-sm font-medium text-slate-600">Disponibles / Siège</span>
              <span className="text-lg font-black text-amber-600">{activeStaff - staffOnSite}</span>
            </div>
            <div className="pt-2">
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Répartition par Projet</div>
               <div className="flex flex-wrap gap-2">
                  {data.projects.map(p => {
                    const count = data.personnel.filter(pers => pers.current_project_id === p.id).length;
                    if (count === 0) return null;
                    return (
                      <div key={p.id} className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600 border border-slate-200">
                        {p.name}: <span className="text-petrol">{count}</span>
                      </div>
                    )
                  })}
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
