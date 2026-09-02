import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import AttachmentUploader from './AttachmentUploader';
import { jsPDF } from "jspdf";

export default function ProcurementManager({ projectId, userRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ description: '', quantite: 1, urgence: 'NORMALE' });
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    fetchOrders();
  }, [projectId]);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('procurement_orders').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  async function createDA(e) {
    e.preventDefault();
    setIsProcessing(true);
    const payload = {
      project_id: projectId,
      reference: `DA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      description: formData.description,
      quantite: parseFloat(formData.quantite),
      urgence: formData.urgence,
      status: 'DA_CREEE',
      created_by: userRole
    };

    const { data, error } = await supabase.from('procurement_orders').insert([payload]).select();
    if (!error && data) {
      await logSystemEvent(projectId, 'CREATE', 'procurement_orders', data[0].id, payload);
      setFormData({ description: '', quantite: 1, urgence: 'NORMALE' });
      alert("Demande d'Achat (DA) envoyée au siège avec succès.");
      fetchOrders();
    } else {
      alert("Erreur: " + error?.message);
    }
    setIsProcessing(false);
  }

  async function validerBC(order) {
    const fournisseur = window.prompt("Nom du fournisseur retenu :");
    if (!fournisseur) return;
    const montant = window.prompt("Montant total négocié (DH) :");
    if (!montant) return;

    setIsProcessing(true);
    const { error } = await supabase.from('procurement_orders')
      .update({ status: 'BC_VALIDE', fournisseur: fournisseur, montant_estime: parseFloat(montant) })
      .eq('id', order.id);

    if (!error) {
      await logSystemEvent(projectId, 'UPDATE_STATUS', 'procurement_orders', order.id, { status: 'BC_VALIDE', fournisseur, montant });
      fetchOrders();
    }
    setIsProcessing(false);
  }

  const generateBC = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("BON DE COMMANDE (BC)", 105, 20, null, null, "center");
    doc.setFontSize(12);
    doc.text(`Référence : ${order.reference}`, 20, 40);
    doc.text(`Fournisseur : ${order.fournisseur || 'Non défini'}`, 20, 50);
    doc.text(`Désignation : ${order.description}`, 20, 70);
    doc.text(`Quantité commandée : ${order.quantite}`, 20, 80);
    doc.text(`Montant négocié : ${order.montant_estime || 0} DH`, 20, 90);
    doc.save(`BC_${order.reference}.pdf`);
  };

  async function validerLivraison(order) {
    const blNumber = window.prompt("Entrez le numéro du Bon de Livraison (BL) reçu avec la marchandise :");
    if (!blNumber) return;

    setIsProcessing(true);
    const { error } = await supabase.from('procurement_orders').update({ status: 'LIVRE', bl_number: blNumber }).eq('id', order.id);
    if (!error) {
      await logSystemEvent(projectId, 'UPDATE_STATUS', 'procurement_orders', order.id, { status: 'LIVRE', bl_number: blNumber });
      fetchOrders();
    }
    setIsProcessing(false);
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber">🛒 Achats & Logistique Chantier</h2>
          <p className="text-sm text-slate-500">Demandes d'Achats (DA), Bons de Commande (BC) et Livraisons (BL)</p>
        </div>
      </div>

      {!isAdmin && (
        <form onSubmit={createDA} className="bg-amber/10 border border-amber/30 p-6 rounded-xl shadow-sm mb-8 grid gap-4">
          <h3 className="font-bold text-amber mb-2">Nouvelle Demande d'Achat (Terrain)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              className="col-span-2 border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full"
              placeholder="Désignation du matériel (ex: 10T de Ciment CPJ45...)"
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required
            />
            <input
              type="number" step="any"
              className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none w-full"
              placeholder="Quantité"
              value={formData.quantite} onChange={e => setFormData({...formData, quantite: e.target.value})} required
            />
            <select
              className="border border-white/50 bg-white p-3 rounded focus:ring-2 focus:ring-amber outline-none"
              value={formData.urgence} onChange={e => setFormData({...formData, urgence: e.target.value})}>
              <option value="FAIBLE">Urgence: Faible</option>
              <option value="NORMALE">Urgence: Normale</option>
              <option value="HAUTE">Urgence: HAUTE</option>
            </select>
          </div>
          <button type="submit" disabled={isProcessing} className="bg-amber text-white py-3 rounded-lg font-bold hover:bg-orange-500 transition shadow mt-2 w-max px-6 disabled:opacity-50">
            Envoyer la Demande (DA)
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-4 border-b border-slate-200">Réf.</th>
              <th className="p-4 border-b border-slate-200">Désignation</th>
              <th className="p-4 border-b border-slate-200">Fournisseur & Coût</th>
              <th className="p-4 border-b border-slate-200 text-center">Statut (DA &rarr; BC &rarr; BL)</th>
              <th className="p-4 border-b border-slate-200">Documents</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50 border-b border-slate-100 transition">
                <td className="p-4 font-bold text-slate-600 text-sm">{order.reference}</td>
                <td className="p-4">
                  <div className="font-medium text-slate-800">{order.description}</div>
                  <div className="text-xs text-slate-500 mt-1">Qté demandée : <span className="font-bold">{order.quantite}</span> • Urgence : <span className={`${order.urgence === 'HAUTE' ? 'text-red-500' : 'text-slate-400'} font-bold`}>{order.urgence}</span></div>
                </td>
                <td className="p-4 text-sm">
                  {order.fournisseur ? (
                    <>
                      <div className="font-bold text-petrol">{order.fournisseur}</div>
                      {isAdmin && <div className="text-xs text-slate-500">{order.montant_estime?.toLocaleString()} DH</div>}
                    </>
                  ) : (
                    <span className="text-slate-400 italic text-xs">En attente de négociation...</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {order.status === 'DA_CREEE' && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded text-xs font-bold">DA EN ATTENTE</span>
                      {isAdmin && <button onClick={() => validerBC(order)} disabled={isProcessing} className="bg-petrol text-white text-[10px] px-2 py-1 rounded shadow hover:bg-slate-800">✅ Créer BC (Siège)</button>}
                    </div>
                  )}
                  {order.status === 'BC_VALIDE' && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="bg-amber/20 text-amber-700 px-2 py-1 rounded text-xs font-bold">BC ÉMIS (En transit)</span>
                      <div className="flex gap-1">
                        {isAdmin && <button onClick={() => generateBC(order)} className="bg-blue-500 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-blue-600">📄 PDF</button>}
                        {!isAdmin && <button onClick={() => validerLivraison(order)} disabled={isProcessing} className="bg-emerald text-white text-[10px] px-2 py-1 rounded shadow hover:bg-green-600">📦 Livré (BL)</button>}
                      </div>
                    </div>
                  )}
                  {order.status === 'LIVRE' && (
                    <span className="bg-emerald/20 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">📦 LIVRÉ (BL: {order.bl_number})</span>
                  )}
                </td>
                <td className="p-4">
                  <AttachmentUploader entityType="procurement" entityId={order.id} projectId={projectId} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Aucune commande logistique.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}