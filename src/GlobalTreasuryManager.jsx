import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AttachmentUploader from './AttachmentUploader';

export default function GlobalTreasuryManager() {
  const [invoices, setInvoices] = useState([]);
  const [globalExpenses, setGlobalExpenses] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expense form state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ designation: '', montant_reel: '', categorie: 'Frais Généraux', est_officiel: true, paiement_status: 'NON_PAYE' });

  // Recurring Expense form state
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ designation: '', montant: '', categorie: 'Frais Généraux', start_date: '', end_date: '', is_active: true });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [invRes, expRes, subRes, eqRes, recRes] = await Promise.all([
      supabase.from('invoices').select('*, projects(name)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, projects(name)').order('created_at', { ascending: false }),
      supabase.from('subcontractors').select('*, projects(name)').order('created_at', { ascending: false }),
      supabase.from('equipment').select('*, projects(name)').order('name', { ascending: true }),
      supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false })
    ]);

    if (invRes.data) setInvoices(invRes.data);
    if (expRes.data) setGlobalExpenses(expRes.data);
    if (subRes.data) setSubcontractors(subRes.data);
    if (eqRes.data) setEquipment(eqRes.data);
    if (recRes.data) setRecurringExpenses(recRes.data);
    setLoading(false);
  }

  const handleSaveRecurringExpense = async (e) => {
    e.preventDefault();
    const payload = {
      designation: recurringForm.designation,
      montant: parseFloat(recurringForm.montant) || 0,
      categorie: recurringForm.categorie,
      start_date: recurringForm.start_date || null,
      end_date: recurringForm.end_date || null,
      is_active: recurringForm.is_active
    };
    const { error } = await supabase.from('recurring_expenses').insert([payload]);
    if (error) alert("Erreur: " + error.message);
    else {
      setShowRecurringModal(false);
      setRecurringForm({ designation: '', montant: '', categorie: 'Frais Généraux', start_date: '', end_date: '', is_active: true });
      fetchData();
    }
  };

  const toggleRecurringActive = async (id, currentState) => {
    await supabase.from('recurring_expenses').update({ is_active: !currentState }).eq('id', id);
    fetchData();
  };

  const updateEquipmentProject = async (id, projectId) => {
    await supabase.from('equipment').update({ current_project_id: projectId || null }).eq('id', id);
    fetchData();
  };

  const updateInvoiceStatus = async (id, newStatus) => {
    await supabase.from('invoices').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  const updateExpensePaymentStatus = async (id, newStatus) => {
    await supabase.from('expenses').update({ paiement_status: newStatus }).eq('id', id);
    fetchData();
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const montant = parseFloat(expenseForm.montant_reel);
    const payload = {
      project_id: null, // Global expense
      designation: expenseForm.designation,
      montant_reel: montant,
      quantite: 1,
      prix_unitaire: montant,
      categorie: expenseForm.categorie,
      est_officiel: expenseForm.est_officiel,
      status: 'EN_ATTENTE',
      paiement_status: expenseForm.paiement_status
    };

    const { error } = await supabase.from('expenses').insert([payload]);
    if (error) alert("Erreur: " + error.message);
    else {
      setShowExpenseModal(false);
      setExpenseForm({ designation: '', montant_reel: '', categorie: 'Frais Généraux', est_officiel: true, paiement_status: 'NON_PAYE' });
      fetchData();
    }
  };

  const approveGlobalExpense = async (id) => {
    if (!window.confirm("Approuver cette dépense ?")) return;
    await supabase.from('expenses').update({ status: 'APPROUVEE' }).eq('id', id);
    fetchData();
  };

  // Financial KPIs
  const totalInvoicedIn = invoices.filter(i => i.type === 'CLIENT').reduce((acc, i) => acc + Number(i.montant_ttc), 0);
  const totalPaidIn = invoices.filter(i => i.type === 'CLIENT' && i.status === 'PAYEE').reduce((acc, i) => acc + Number(i.montant_ttc), 0);

  const totalInvoicedOut = invoices.filter(i => i.type === 'FOURNISSEUR').reduce((acc, i) => acc + Number(i.montant_ttc), 0);
  const totalPaidOutInvoices = invoices.filter(i => i.type === 'FOURNISSEUR' && i.status === 'PAYEE').reduce((acc, i) => acc + Number(i.montant_ttc), 0);

  const totalExpensesOut = globalExpenses.reduce((acc, e) => acc + Number(e.montant_reel), 0);
  const totalPaidOutExpenses = globalExpenses.filter(e => e.paiement_status === 'PAYE').reduce((acc, e) => acc + Number(e.montant_reel), 0);

  const pendingPayments = (totalInvoicedOut - totalPaidOutInvoices) + (totalExpensesOut - totalPaidOutExpenses);

  return (
    <div className="flex flex-col gap-8">
      {/* TREASURY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <div className="text-emerald-600 text-xs font-bold uppercase mb-1">Encaissements Réels</div>
          <div className="text-2xl font-black text-emerald-700">{totalPaidIn.toLocaleString()} DH</div>
          <div className="text-[10px] text-emerald-500 mt-1">Sur {totalInvoicedIn.toLocaleString()} DH facturés</div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
          <div className="text-rose-600 text-xs font-bold uppercase mb-1">Décaissements Réels</div>
          <div className="text-2xl font-black text-rose-700">{(totalPaidOutInvoices + totalPaidOutExpenses).toLocaleString()} DH</div>
          <div className="text-[10px] text-rose-500 mt-1">Factures + Dépenses payées</div>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 shadow-sm">
          <div className="text-amber-600 text-xs font-bold uppercase mb-1">Reste à Payer (Dettes)</div>
          <div className="text-2xl font-black text-amber-700">{pendingPayments.toLocaleString()} DH</div>
          <div className="text-[10px] text-amber-500 mt-1">Invoices + Dépenses en attente</div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
          <div className="text-blue-600 text-xs font-bold uppercase mb-1">Solde de Trésorerie</div>
          <div className="text-2xl font-black text-blue-700">{(totalPaidIn - (totalPaidOutInvoices + totalPaidOutExpenses)).toLocaleString()} DH</div>
          <div className="text-[10px] text-blue-500 mt-1">Cash In - Cash Out (Réel)</div>
        </div>
      </div>

      {/* GLOBAL INVOICES SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-petrol mb-4 flex items-center gap-2">
          <span>🧾 Facturation & Décomptes</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-normal">Clients & Fournisseurs</span>
        </h2>

        {loading ? <p>Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="p-3">Référence / Tiers</th>
                  <th className="p-3">Projet</th>
                  <th className="p-3 text-right">Montant TTC</th>
                  <th className="p-3">État de Paiement</th>
                  <th className="p-3">Doc</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-petrol text-sm">{inv.reference || 'SANS REF'}</div>
                      <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${inv.type === 'CLIENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {inv.type === 'CLIENT' ? 'CLIENT' : `FOURN: ${inv.fournisseur_nom || '?'}`}
                      </div>
                    </td>
                    <td className="p-3 text-xs font-bold text-slate-500">
                      {inv.projects?.name || <span className="italic">Général</span>}
                    </td>
                    <td className="p-3 text-right font-black text-petrol text-sm">
                      {Number(inv.montant_ttc).toLocaleString()} DH
                    </td>
                    <td className="p-3">
                      <select
                        value={inv.status}
                        onChange={(e) => updateInvoiceStatus(inv.id, e.target.value)}
                        className={`text-[10px] font-black px-2 py-1 rounded outline-none border-none cursor-pointer appearance-none text-center shadow-sm ${
                          inv.status === 'PAYEE' ? 'bg-emerald-500 text-white' :
                          inv.status === 'EN_RETARD' ? 'bg-rose-500 text-white' :
                          inv.status === 'EMISE' ? 'bg-blue-500 text-white' :
                          'bg-slate-200 text-slate-600'
                        }`}
                      >
                        <option value="BROUILLON">Brouillon</option>
                        <option value="EMISE">Emise / Envoyée</option>
                        <option value="EN_ATTENTE">En Attente</option>
                        <option value="PAYEE">PAYÉE (Soldée)</option>
                        <option value="EN_RETARD">En Retard</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <AttachmentUploader entityType="invoice" entityId={inv.id} projectId={inv.project_id} />
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Aucune facture.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GLOBAL EXPENSES SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-amber flex items-center gap-2">
            <span>💸 Toutes les Dépenses (Cash-Out)</span>
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-normal">Terrain & Siège</span>
          </h2>
          <button onClick={() => setShowExpenseModal(true)} className="bg-amber text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-orange-500 transition text-sm">
            ➕ Nouvelle Dépense Globale
          </button>
        </div>

        {loading ? <p>Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="p-3">Désignation / Projet</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Validation</th>
                  <th className="p-3 text-center">Paiement</th>
                  <th className="p-3">Doc</th>
                </tr>
              </thead>
              <tbody>
                {globalExpenses.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-700 text-sm">{ex.designation}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="font-bold text-amber">{ex.categorie}</span> •
                        <span>{ex.projects?.name || 'FRAIS GÉNÉRAUX'}</span>
                      </div>
                    </td>
                    <td className={`p-3 text-right font-black text-sm ${ex.est_officiel ? 'text-petrol' : 'text-amber'}`}>
                      {ex.montant_reel.toLocaleString()} DH
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        {ex.status === 'EN_ATTENTE' ? (
                          <button onClick={() => approveGlobalExpense(ex.id)} className="bg-slate-100 text-slate-500 hover:bg-emerald hover:text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all border border-slate-200 shadow-sm">
                            ⏳ Approuver ?
                          </button>
                        ) : (
                          <span className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter">✅ Validé</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => updateExpensePaymentStatus(ex.id, ex.paiement_status === 'PAYE' ? 'NON_PAYE' : 'PAYE')}
                          className={`text-[10px] font-black px-3 py-1 rounded-full transition-all border shadow-sm ${
                            ex.paiement_status === 'PAYE'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          {ex.paiement_status === 'PAYE' ? 'PAYÉ' : 'À PAYER'}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <AttachmentUploader entityType="expense" entityId={ex.id} projectId={ex.project_id} />
                    </td>
                  </tr>
                ))}
                {globalExpenses.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Aucune dépense enregistrée.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUBCONTRACTORS SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-indigo-500 mb-4 flex items-center gap-2">
          <span>🤝 Sous-Traitants (Global)</span>
        </h2>
        {loading ? <p>Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="p-3">Nom</th>
                  <th className="p-3">Projet</th>
                  <th className="p-3">Spécialité</th>
                  <th className="p-3">Doc</th>
                </tr>
              </thead>
              <tbody>
                {subcontractors.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-700">{sub.nom}</td>
                    <td className="p-3 text-xs font-bold text-slate-500">{sub.projects?.name || '-'}</td>
                    <td className="p-3 text-xs">{sub.specialite}</td>
                    <td className="p-3">
                      <AttachmentUploader entityType="subcontractor" entityId={sub.id} projectId={sub.project_id} />
                    </td>
                  </tr>
                ))}
                {subcontractors.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Aucun sous-traitant.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EQUIPMENT SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-600 mb-4 flex items-center gap-2">
          <span>🚜 Parc Engins & Affectations</span>
        </h2>
        {loading ? <p>Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="p-3">Engin</th>
                  <th className="p-3">Coût Journalier</th>
                  <th className="p-3">Affectation Actuelle</th>
                  <th className="p-3">Doc</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map(eq => (
                  <tr key={eq.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-700">{eq.name}</div>
                      <div className="text-[10px] text-slate-400">{eq.plate_number}</div>
                    </td>
                    <td className="p-3 text-sm font-black text-petrol">{Number(eq.daily_cost).toLocaleString()} DH</td>
                    <td className="p-3">
                      <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {eq.projects?.name || 'AUCUNE AFFECTATION'}
                      </span>
                    </td>
                    <td className="p-3">
                      <AttachmentUploader entityType="equipment" entityId={eq.id} projectId={eq.current_project_id} />
                    </td>
                  </tr>
                ))}
                {equipment.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Aucun engin dans le parc.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECURRING EXPENSES SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-rose-500 flex items-center gap-2">
            <span>🔄 Dépenses Récurrentes</span>
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-normal">Abonnements, Loyers</span>
          </h2>
          <button onClick={() => setShowRecurringModal(true)} className="bg-rose-500 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-rose-600 transition text-sm">
            ➕ Nouvel Abonnement
          </button>
        </div>

        {loading ? <p>Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                  <th className="p-3">Désignation</th>
                  <th className="p-3">Période</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3">Doc</th>
                </tr>
              </thead>
              <tbody>
                {recurringExpenses.map(rec => (
                  <tr key={rec.id} className={`hover:bg-slate-50 border-b border-slate-50 transition-colors ${!rec.is_active ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      <div className="font-bold text-slate-700">{rec.designation}</div>
                      <div className="text-[10px] font-bold text-rose-500">{rec.categorie}</div>
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-500">
                      {rec.start_date || '?'} ➡️ {rec.end_date || 'En cours'}
                    </td>
                    <td className="p-3 text-right font-black text-rose-600 text-sm">{Number(rec.montant).toLocaleString()} DH</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleRecurringActive(rec.id, rec.is_active)}
                        className={`text-[10px] font-black px-3 py-1 rounded-full transition-all border shadow-sm ${
                          rec.is_active ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-200 text-slate-500 border-slate-300'
                        }`}
                      >
                        {rec.is_active ? 'ACTIF' : 'INACTIF'}
                      </button>
                    </td>
                    <td className="p-3">
                      <AttachmentUploader entityType="recurring_expense" entityId={rec.id} projectId={null} />
                    </td>
                  </tr>
                ))}
                {recurringExpenses.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Aucune dépense récurrente.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
            <h3 className="font-black text-2xl text-amber mb-4">Nouvelle Dépense Générale</h3>
            <form onSubmit={handleSaveExpense} className="grid gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Désignation *</label>
                <input className="w-full border p-2 rounded" value={expenseForm.designation} onChange={e => setExpenseForm({...expenseForm, designation: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Montant TTC (DH) *</label>
                  <input type="number" step="any" className="w-full border p-2 rounded text-petrol font-bold" value={expenseForm.montant_reel} onChange={e => setExpenseForm({...expenseForm, montant_reel: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Catégorie</label>
                  <select className="w-full border p-2 rounded text-xs" value={expenseForm.categorie} onChange={e => setExpenseForm({...expenseForm, categorie: e.target.value})}>
                    <option>Frais Généraux</option>
                    <option>Loyer</option>
                    <option>Assurance</option>
                    <option>Salaires (Administratif)</option>
                    <option>Impôts & Taxes</option>
                    <option>Divers</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-2 bg-slate-50 p-2 rounded border cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-petrol" checked={expenseForm.est_officiel} onChange={e => setExpenseForm({...expenseForm, est_officiel: e.target.checked})} />
                  <span className="text-xs font-bold text-slate-700">Officiel</span>
                </label>
                <div className="flex-1">
                   <select
                    className={`w-full border p-2 rounded text-xs font-bold ${expenseForm.paiement_status === 'PAYE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                    value={expenseForm.paiement_status}
                    onChange={e => setExpenseForm({...expenseForm, paiement_status: e.target.value})}
                  >
                    <option value="NON_PAYE">À PAYER</option>
                    <option value="PAYE">DÉJÀ PAYÉ</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-4 border-t pt-4">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-amber text-white font-bold rounded-lg shadow hover:bg-orange-500">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecurringModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
            <h3 className="font-black text-2xl text-rose-500 mb-4">Nouvel Abonnement / Dépense Récurrente</h3>
            <form onSubmit={handleSaveRecurringExpense} className="grid gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Désignation *</label>
                <input className="w-full border p-2 rounded" value={recurringForm.designation} onChange={e => setRecurringForm({...recurringForm, designation: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Montant / Période *</label>
                  <input type="number" step="any" className="w-full border p-2 rounded text-rose-500 font-bold" value={recurringForm.montant} onChange={e => setRecurringForm({...recurringForm, montant: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Catégorie</label>
                  <select className="w-full border p-2 rounded text-xs" value={recurringForm.categorie} onChange={e => setRecurringForm({...recurringForm, categorie: e.target.value})}>
                    <option>Loyer</option>
                    <option>Abonnement Internet</option>
                    <option>Assurance</option>
                    <option>Logiciels</option>
                    <option>Frais Bancaires</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date de début</label>
                  <input type="date" className="w-full border p-2 rounded text-xs" value={recurringForm.start_date} onChange={e => setRecurringForm({...recurringForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date de fin</label>
                  <input type="date" className="w-full border p-2 rounded text-xs" value={recurringForm.end_date} onChange={e => setRecurringForm({...recurringForm, end_date: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-4 border-t pt-4">
                <button type="button" onClick={() => setShowRecurringModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg shadow hover:bg-rose-600">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
