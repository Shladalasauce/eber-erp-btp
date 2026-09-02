import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import AttachmentUploader from './AttachmentUploader';

export default function InvoicingManager({ projectId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit State
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [formData, setFormData] = useState({
    type: 'CLIENT', // CLIENT or FOURNISSEUR
    reference: '',
    fournisseur_nom: '',
    date_emission: new Date().toISOString().split('T')[0],
    date_echeance: '',
  });

  const [invoiceLines, setInvoiceLines] = useState([]);
  const [newLine, setNewLine] = useState({ designation: '', quantite: 1, prix_unitaire: 0, tva_taux: 20 });

  useEffect(() => {
    fetchInvoices();
  }, [projectId]);

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*), payments(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error) {
      setInvoices(data || []);
    }
    setLoading(false);
  }

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!formData.reference) return alert("Référence requise");

    let savedInvoiceId;

    if (editingInvoice) {
      // Update
      const { data, error } = await supabase
        .from('invoices')
        .update(formData)
        .eq('id', editingInvoice.id)
        .select();
      if (error) return alert("Erreur: " + error.message);
      savedInvoiceId = data[0].id;
      await logSystemEvent(projectId, 'UPDATE', 'invoices', savedInvoiceId, formData);
    } else {
      // Insert
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...formData, project_id: projectId }])
        .select();
      if (error) return alert("Erreur: " + error.message);
      savedInvoiceId = data[0].id;
      await logSystemEvent(projectId, 'CREATE', 'invoices', savedInvoiceId, formData);
    }

    // Save lines if any new lines
    if (invoiceLines.length > 0 && !editingInvoice) {
      const linesToInsert = invoiceLines.map(l => ({ ...l, invoice_id: savedInvoiceId }));
      await supabase.from('invoice_lines').insert(linesToInsert);

      // Update totals
      await updateInvoiceTotals(savedInvoiceId, invoiceLines);
    } else if (editingInvoice) {
        await updateInvoiceTotals(savedInvoiceId, invoiceLines);
    }

    setShowModal(false);
    fetchInvoices();
  };

  const updateInvoiceTotals = async (id, lines) => {
    let ht = 0;
    let tvaAmount = 0;
    lines.forEach(l => {
      const lineHT = l.quantite * l.prix_unitaire;
      ht += lineHT;
      tvaAmount += lineHT * (l.tva_taux / 100);
    });
    await supabase.from('invoices').update({ montant_ht: ht, tva: tvaAmount, montant_ttc: ht + tvaAmount }).eq('id', id);
  }

  const addLine = () => {
    if (!newLine.designation || newLine.prix_unitaire <= 0) return;
    setInvoiceLines([...invoiceLines, newLine]);
    setNewLine({ designation: '', quantite: 1, prix_unitaire: 0, tva_taux: 20 });
  };

  const removeLine = async (index, lineId) => {
    if (lineId) {
      await supabase.from('invoice_lines').delete().eq('id', lineId);
    }
    const updated = [...invoiceLines];
    updated.splice(index, 1);
    setInvoiceLines(updated);
  };

  const openNewModal = () => {
    setEditingInvoice(null);
    setFormData({
      type: 'CLIENT',
      reference: '',
      fournisseur_nom: '',
      date_emission: new Date().toISOString().split('T')[0],
      date_echeance: '',
    });
    setInvoiceLines([]);
    setShowModal(true);
  };

  const openEditModal = (inv) => {
    setEditingInvoice(inv);
    setFormData({
      type: inv.type,
      reference: inv.reference,
      fournisseur_nom: inv.fournisseur_nom || '',
      date_emission: inv.date_emission,
      date_echeance: inv.date_echeance || '',
      status: inv.status
    });
    setInvoiceLines(inv.invoice_lines || []);
    setShowModal(true);
  };

  const updateStatus = async (id, newStatus) => {
    await supabase.from('invoices').update({ status: newStatus }).eq('id', id);
    await logSystemEvent(projectId, 'UPDATE_STATUS', 'invoices', id, { status: newStatus });
    fetchInvoices();
  };

  const totalClientTTC = invoices.filter(i => i.type === 'CLIENT' && i.status !== 'BROUILLON').reduce((sum, i) => sum + Number(i.montant_ttc), 0);
  const totalFournisseurTTC = invoices.filter(i => i.type === 'FOURNISSEUR' && i.status !== 'BROUILLON').reduce((sum, i) => sum + Number(i.montant_ttc), 0);
  const encaissements = invoices.filter(i => i.type === 'CLIENT' && i.status === 'PAYEE').reduce((sum, i) => sum + Number(i.montant_ttc), 0);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-petrol">Trésorerie & Facturation</h2>
          <p className="text-sm text-slate-500">Gérez les factures clients, fournisseurs et suivez les flux.</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-emerald text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-600 transition"
        >
          ➕ Nouvelle Facture
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-sm font-bold text-slate-500">Facturation Client (TTC)</div>
          <div className="text-2xl font-black text-petrol">{totalClientTTC.toLocaleString()} DH</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-sm font-bold text-slate-500">Facturation Fournisseur (TTC)</div>
          <div className="text-2xl font-black text-amber">{totalFournisseurTTC.toLocaleString()} DH</div>
        </div>
        <div className="bg-emerald/10 p-4 rounded-xl border border-emerald/20">
          <div className="text-sm font-bold text-emerald">Encaissements Clients</div>
          <div className="text-2xl font-black text-emerald">{encaissements.toLocaleString()} DH</div>
        </div>
      </div>

      {loading ? (
        <p>Chargement des factures...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-3 font-bold">Réf / Type</th>
                <th className="p-3 font-bold">Date Emission</th>
                <th className="p-3 font-bold">Montant HT</th>
                <th className="p-3 font-bold">Montant TTC</th>
                <th className="p-3 font-bold">Statut</th>
                <th className="p-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-petrol">{inv.reference}</div>
                    <div className="text-xs font-bold px-2 py-1 rounded inline-block mt-1 bg-slate-200">
                      {inv.type} {inv.type === 'FOURNISSEUR' && `- ${inv.fournisseur_nom}`}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-600">{inv.date_emission}</td>
                  <td className="p-3 font-bold text-slate-700">{Number(inv.montant_ht).toLocaleString()} DH</td>
                  <td className="p-3 font-black text-petrol">{Number(inv.montant_ttc).toLocaleString()} DH</td>
                  <td className="p-3">
                    <select
                      value={inv.status}
                      onChange={(e) => updateStatus(inv.id, e.target.value)}
                      className={`text-xs font-bold px-2 py-1 rounded outline-none border-none cursor-pointer ${
                        inv.status === 'PAYEE' ? 'bg-green-100 text-green-700' :
                        inv.status === 'EN_RETARD' ? 'bg-red-100 text-red-700' :
                        inv.status === 'EMISE' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <option value="BROUILLON">Brouillon</option>
                      <option value="EMISE">Emise</option>
                      <option value="EN_ATTENTE">En Attente</option>
                      <option value="PAYEE">Payée</option>
                      <option value="EN_RETARD">En Retard</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <button onClick={() => openEditModal(inv)} className="text-blue-500 hover:underline font-bold text-sm">
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">Aucune facture trouvée.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-2xl text-petrol mb-4">
              {editingInvoice ? 'Modifier la facture' : 'Nouvelle Facture'}
            </h3>

            <form onSubmit={handleSaveInvoice}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Type *</label>
                  <select
                    className="w-full border border-slate-300 p-2 rounded-lg"
                    value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="CLIENT">Client</option>
                    <option value="FOURNISSEUR">Fournisseur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Référence *</label>
                  <input
                    className="w-full border border-slate-300 p-2 rounded-lg"
                    value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})}
                    placeholder="Ex: FAC-2026-001" required
                  />
                </div>
                {formData.type === 'FOURNISSEUR' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nom du Fournisseur</label>
                    <input
                      className="w-full border border-slate-300 p-2 rounded-lg"
                      value={formData.fournisseur_nom} onChange={e => setFormData({...formData, fournisseur_nom: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date d'émission *</label>
                  <input
                    type="date" className="w-full border border-slate-300 p-2 rounded-lg"
                    value={formData.date_emission} onChange={e => setFormData({...formData, date_emission: e.target.value})} required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date d'échéance</label>
                  <input
                    type="date" className="w-full border border-slate-300 p-2 rounded-lg"
                    value={formData.date_echeance} onChange={e => setFormData({...formData, date_echeance: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <h4 className="font-bold text-lg mb-2">Lignes de la facture</h4>
                <div className="bg-slate-50 p-3 rounded-lg flex gap-2 items-end mb-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500">Désignation</label>
                    <input className="w-full border p-2 rounded" value={newLine.designation} onChange={e => setNewLine({...newLine, designation: e.target.value})} />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500">Qté</label>
                    <input type="number" className="w-full border p-2 rounded" value={newLine.quantite} onChange={e => setNewLine({...newLine, quantite: Number(e.target.value)})} />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-bold text-slate-500">P.U HT</label>
                    <input type="number" className="w-full border p-2 rounded" value={newLine.prix_unitaire} onChange={e => setNewLine({...newLine, prix_unitaire: Number(e.target.value)})} />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500">TVA %</label>
                    <input type="number" className="w-full border p-2 rounded" value={newLine.tva_taux} onChange={e => setNewLine({...newLine, tva_taux: Number(e.target.value)})} />
                  </div>
                  <button type="button" onClick={addLine} className="bg-petrol text-white px-4 py-2 rounded font-bold hover:bg-slate-800">Ajouter</button>
                </div>

                <ul className="space-y-2 mb-4">
                  {invoiceLines.map((line, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-white p-2 rounded border">
                      <div>
                        <span className="font-bold">{line.designation}</span>
                        <span className="text-sm text-slate-500 ml-2">({line.quantite} x {line.prix_unitaire} DH) - TVA {line.tva_taux}%</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-petrol">{(line.quantite * line.prix_unitaire).toLocaleString()} DH HT</span>
                        <button type="button" onClick={() => removeLine(idx, line.id)} className="text-red-500 font-bold">X</button>
                      </div>
                    </li>
                  ))}
                  {invoiceLines.length === 0 && <p className="text-sm text-slate-500 text-center py-2">Aucune ligne.</p>}
                </ul>
              </div>

              <div className="flex justify-end gap-4 mt-6 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-emerald text-white font-bold rounded-lg shadow hover:bg-green-600">
                  Enregistrer
                </button>
              </div>
            </form>

            {editingInvoice && (
              <div className="mt-8 border-t pt-4">
                <h4 className="font-bold text-lg text-petrol mb-2">Pièces Jointes (Justificatifs)</h4>
                <p className="text-sm text-slate-500 mb-2">Attachez la facture scannée, le devis, ou tout autre document justificatif.</p>
                <AttachmentUploader entityType="invoice" entityId={editingInvoice.id} projectId={projectId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
