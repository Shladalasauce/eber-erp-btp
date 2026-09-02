import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';

export default function DocumentManager({ projectId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal for setting validity date on upload
  const [uploadModal, setUploadModal] = useState({ isOpen: false, file: null, reqDocName: null, validityDate: '' });

  // Listes de documents dynamiques
  const chantierDocs = [
    { type: 'Caution', name: 'Caution Définitive (3%)' },
    { type: 'Assurance', name: 'Assurance Responsabilité Civile (RC)' },
    { type: 'Assurance', name: 'Assurance Tous Risques Chantier (TRC)' },
    { type: 'Administratif', name: 'Déclaration d\'ouverture de chantier' },
    { type: 'Technique', name: 'CPS signé et légalisé' },
    { type: 'Technique', name: 'Ordre de Service (OS) de commencement' },
  ];

  const entrepriseDocs = [
    { type: 'Administratif', name: 'Registre de Commerce (RC)', hasValidity: false },
    { type: 'Administratif', name: 'Statuts de la société', hasValidity: false },
    { type: 'Fiscal', name: 'Attestation Fiscale', hasValidity: true },
    { type: 'Social', name: 'Attestation CNSS', hasValidity: true },
    { type: 'Technique', name: 'Certificat de Qualification et Classification', hasValidity: true },
    { type: 'Assurance', name: 'Assurance Décennale Globale', hasValidity: true },
    { type: 'Administratif', name: 'Pièce d\'identité du Gérant', hasValidity: true },
  ];

  const requiredDocs = projectId ? chantierDocs : entrepriseDocs;

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  async function fetchDocuments() {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').eq('project_id', projectId || 'GLOBAL');
    if (data) setDocuments(data);
    setLoading(false);
  }

  function handleFileSelection(e, reqDocName) {
    const file = e.target.files[0];
    if (!file) return;

    // Check if the document requires a validity date
    const docSpec = requiredDocs.find(d => d.name === reqDocName);
    if (docSpec && docSpec.hasValidity) {
      setUploadModal({ isOpen: true, file, reqDocName, validityDate: '' });
      e.target.value = null;
      return;
    }

    // Direct Upload Mock
    finalizeUpload(file, reqDocName, null);
    e.target.value = null;
  }

  async function finalizeUpload(file, reqDocName, validityDate) {
    setUploadModal({ isOpen: false, file: null, reqDocName: null, validityDate: '' });
    setLoading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId || 'GLOBAL'}/${uniqueName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const payload = {
        project_id: projectId || 'GLOBAL',
        name: reqDocName || file.name,
        file_name: file.name,
        url: publicUrlData.publicUrl,
        type: reqDocName ? 'Required' : 'Autre',
        validity_date: validityDate || null
      };

      const { error: dbError } = await supabase.from('documents').insert([payload]);

      if (dbError) {
        throw dbError;
      }

      alert(`Document ${file.name} uploadé avec succès !`);
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Erreur lors de l'upload : ${error.message}`);
    } finally {
      setLoading(false);
    }
  }
  const getDocStatus = (docName) => {
    return documents.find(d => d.name === docName) || null;
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const isExpiringSoon = (dateString) => {
    if (!dateString) return false;
    const daysLeft = (new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30; // Moins de 30 jours
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-700">
          {projectId ? '📁 Documents du Chantier' : '🏛️ Documentation Centrale de l\'Entreprise'}
        </h2>
      </div>

      {uploadModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-96">
            <h3 className="font-bold text-petrol mb-4">Date de validité requise</h3>
            <p className="text-sm text-slate-500 mb-4">Veuillez indiquer la date d'expiration pour : <strong>{uploadModal.reqDocName}</strong></p>
            <input type="date" className="w-full border p-3 rounded mb-6 outline-none focus:border-petrol" value={uploadModal.validityDate} onChange={e => setUploadModal({...uploadModal, validityDate: e.target.value})} required />
            <div className="flex gap-4 justify-end">
              <button onClick={() => setUploadModal({isOpen: false})} className="px-4 py-2 text-slate-500 font-bold">Annuler</button>
              <button onClick={() => finalizeUpload(uploadModal.file, uploadModal.reqDocName, uploadModal.validityDate)} className="px-4 py-2 bg-petrol text-white rounded font-bold">Confirmer l'upload</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-bold text-petrol mb-4">Documents Réglementaires</h3>
        <p className="text-sm text-slate-500 mb-6">Un suivi rigoureux des expirations est vital pour l'éligibilité aux marchés publics.</p>

        <div className="grid gap-4">
          {requiredDocs.map((reqDoc, idx) => {
            const uploadedDoc = getDocStatus(reqDoc.name);
            const expired = uploadedDoc ? isExpired(uploadedDoc.validity_date) : false;
            const warning = uploadedDoc ? isExpiringSoon(uploadedDoc.validity_date) : false;

            let statusColor = 'bg-red-50 border-red-200';
            let iconColor = 'bg-red-100 text-red-500';
            let icon = '❌';

            if (uploadedDoc) {
              if (expired) { statusColor = 'bg-red-50 border-red-300'; iconColor = 'bg-red-500 text-white'; icon = '⚠️'; }
              else if (warning) { statusColor = 'bg-amber/10 border-amber/30'; iconColor = 'bg-amber text-white'; icon = '⏳'; }
              else { statusColor = 'bg-emerald/5 border-emerald/20'; iconColor = 'bg-emerald text-white'; icon = '✓'; }
            }

            return (
              <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${statusColor}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${iconColor}`}>
                    {icon}
                  </div>
                  <div>
                    <h4 className={`font-bold ${!uploadedDoc || expired ? 'text-red-700' : warning ? 'text-amber' : 'text-emerald'}`}>{reqDoc.name}</h4>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reqDoc.type}</span>
                      {uploadedDoc && uploadedDoc.validity_date && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${expired ? 'bg-red-200 text-red-800' : warning ? 'bg-amber/20 text-amber' : 'bg-slate-200 text-slate-600'}`}>
                          Exp: {new Date(uploadedDoc.validity_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {uploadedDoc && !expired ? (
                    <div className="flex gap-3 items-center">
                      <a href={uploadedDoc.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-petrol hover:underline">Consulter</a>
                      {warning && (
                        <div className="relative">
                          <input type="file" onChange={(e) => handleFileSelection(e, reqDoc.name)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <button className="bg-amber text-white text-xs font-bold px-3 py-1 rounded shadow-sm">Renouveler</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="file" accept={reqDoc.name.includes('CPS') ? "application/pdf" : "*"} onChange={(e) => handleFileSelection(e, reqDoc.name)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <button className={`${expired ? 'bg-red-600' : 'bg-red-500'} hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition flex gap-2`}>
                        {expired ? 'Mettre à jour (Expiré)' : 'Uploader'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
