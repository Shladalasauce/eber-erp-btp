import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AttachmentUploader({ entityType, entityId, projectId }) {
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    fetchAttachments();
  }, [entityId]);

  async function fetchAttachments() {
    if (!entityId) return;
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (data) setAttachments(data);
    if (error) console.error("Error fetching attachments:", error);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${projectId || 'GLOBAL'}/${entityType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('attachments').insert([{
        file_name: file.name,
        file_url: urlData.publicUrl,
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId
      }]);

      if (dbError) throw dbError;

      await fetchAttachments();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'upload du fichier: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  }

  const openPreview = (att, e) => {
    e.preventDefault();
    setPreviewFile(att);
  };

  const isImage = (url) => {
    return url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
  };

  const isPDF = (url) => {
    return url.match(/\.(pdf)$/i) != null;
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <label className={`cursor-pointer ${isUploading || !entityId ? 'bg-slate-100 text-slate-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} px-3 py-1 rounded text-sm font-medium transition inline-block`}>
          {isUploading ? 'Envoi...' : '📎 Joindre un fichier'}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading || !entityId} />
        </label>
      </div>
      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1 bg-white p-2 rounded border border-slate-100 shadow-sm">
          {attachments.map(att => (
            <li key={att.id} className="text-sm flex items-center justify-between group">
              <button onClick={(e) => openPreview(att, e)} className="text-petrol hover:text-emerald hover:underline flex items-center gap-1 text-left">
                <span className="truncate max-w-[200px] inline-block" title={att.file_name}>📄 {att.file_name}</span>
              </button>
              <a href={att.file_url} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition" title="Télécharger">
                ⬇️
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* In-App Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-petrol truncate max-w-lg" title={previewFile.file_name}>
                Visionneuse : {previewFile.file_name}
              </h3>
              <div className="flex gap-4">
                <a href={previewFile.file_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-emerald text-sm font-bold flex items-center gap-1">
                  Télécharger ⬇️
                </a>
                <button onClick={() => setPreviewFile(null)} className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded text-lg leading-none">
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-200 flex items-center justify-center p-4">
              {isImage(previewFile.file_name) ? (
                <img src={previewFile.file_url} alt={previewFile.file_name} className="max-w-full max-h-full object-contain shadow-lg" />
              ) : isPDF(previewFile.file_name) ? (
                <iframe src={previewFile.file_url} title={previewFile.file_name} className="w-full h-full shadow-lg" />
              ) : (
                <div className="text-center p-8">
                  <p className="text-slate-500 mb-4 text-lg">Format de fichier non supporté pour la prévisualisation.</p>
                  <a href={previewFile.file_url} target="_blank" rel="noreferrer" className="bg-petrol text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow inline-block">
                    Ouvrir dans un nouvel onglet
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
