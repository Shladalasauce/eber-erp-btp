import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logSystemEvent } from './auditLogger';
import { proposePlanningFromBPU, proposePlanningAdjustment } from './geminiService';

export default function PlanningManager({ projectId, bpuLines, project }) {
  const [tasks, setTasks] = useState([]);
  const [arretsReprises, setArretsReprises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [dateCommencement, setDateCommencement] = useState(project?.date_commencement || '');

  const [formData, setFormData] = useState({
    name: '', start_date: '', end_date: '', progress: 0
  });
  const [arretFormData, setArretFormData] = useState({
    type: 'ARRET', date_event: '', motif: ''
  });
  const [arretFile, setArretFile] = useState(null);
  const [viewMode, setViewMode] = useState('gantt'); // 'table' ou 'gantt'

  // Modals for AI proposals
  const [planningProposal, setPlanningProposal] = useState(null);
  const [adjustmentProposal, setAdjustmentProposal] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchArretsReprises();
    if (project?.date_commencement) {
      setDateCommencement(project.date_commencement);
    }
  }, [projectId, project]);

  async function handleUpdateDateCommencement() {
    if (!dateCommencement) return;
    setIsAiProcessing(true);
    const { error } = await supabase.from('projects').update({ date_commencement: dateCommencement }).eq('id', projectId);
    if (!error) {
      alert("Date de commencement mise à jour.");
    } else {
      alert("Erreur lors de la mise à jour: " + error.message);
    }
    setIsAiProcessing(false);
  }

  async function handleUploadMissingDocument(arretId, file) {
    if (!file) return;
    setIsAiProcessing(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${projectId}/arrets/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const document_url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('arrets_reprises').update({ document_url }).eq('id', arretId);
      if (!updateError) {
        alert("Document ajouté avec succès.");
        fetchArretsReprises();
      } else {
        alert("Erreur de mise à jour: " + updateError.message);
      }
    } else {
      alert("Erreur d'upload: " + uploadError.message);
    }
    setIsAiProcessing(false);
  }

  async function fetchTasks() {
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('start_date', { ascending: true });
    if (data) setTasks(data);
    setLoading(false);
  }

  async function fetchArretsReprises() {
    const { data } = await supabase.from('arrets_reprises').select('*').eq('project_id', projectId).order('date_event', { ascending: true });
    if (data) setArretsReprises(data);
  }

  async function handleAddTask(e) {
    e.preventDefault();
    const payload = { ...formData, project_id: projectId, progress: parseInt(formData.progress) };
    const { data, error } = await supabase.from('tasks').insert([payload]).select();
    if (!error && data) {
      await logSystemEvent(projectId, 'CREATE', 'tasks', data[0].id, payload);
      setFormData({ name: '', start_date: '', end_date: '', progress: 0 });
      fetchTasks();
    } else {
      alert("Erreur lors de l'enregistrement de la tâche.");
    }
  }

  async function updateProgress(taskId, newProgress) {
    const { error } = await supabase.from('tasks').update({ progress: parseInt(newProgress) }).eq('id', taskId);
    if (!error) {
      await logSystemEvent(projectId, 'UPDATE_PROGRESS', 'tasks', taskId, { progress: parseInt(newProgress) });
      fetchTasks();
    }
  }

  async function handleAddArretReprise(e) {
    e.preventDefault();
    setIsAiProcessing(true);

    let document_url = null;
    if (arretFile) {
      const fileExt = arretFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/arrets/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, arretFile);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        document_url = publicUrlData.publicUrl;
      } else {
        alert("Erreur lors de l'upload de l'OS: " + uploadError.message);
      }
    }

    const payload = { ...arretFormData, project_id: projectId, document_url };
    const { data, error } = await supabase.from('arrets_reprises').insert([payload]).select();

    if (!error && data) {
      await logSystemEvent(projectId, 'CREATE', 'arrets_reprises', data[0].id, payload);
      setArretFormData({ type: 'ARRET', date_event: '', motif: '' });
      setArretFile(null);
      await fetchArretsReprises();

      const updatedArrets = [...arretsReprises, payload];
      await handleProposeAdjustment(tasks, updatedArrets);
    } else {
      alert("Erreur lors de l'enregistrement: " + error.message);
    }
    setIsAiProcessing(false);
  }

  async function handleProposePlanning() {
    if (!bpuLines || bpuLines.length === 0) {
      return alert("Le BPU est vide. Veuillez d'abord remplir le BPU.");
    }
    setIsAiProcessing(true);
    try {
      const projectInfo = {
        delai_execution_jours: project?.delai_execution_jours || 90,
        date_commencement: dateCommencement || project?.date_commencement
      };

      const proposedTasks = await proposePlanningFromBPU(bpuLines, projectInfo, arretsReprises);

      // Calculate specific dates for preview based on current date
      let currentDate = new Date();
      if (projectInfo.date_commencement) {
        const parsedDate = new Date(projectInfo.date_commencement);
        if (!isNaN(parsedDate.getTime())) {
          currentDate = parsedDate;
        }
      }

      const previewTasks = proposedTasks.map(p => {
          const start = new Date(currentDate);
          const end = new Date(currentDate);
          end.setDate(end.getDate() + (p.duree_jours || 1));
          currentDate = end;
          return {
            name: p.name,
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            progress: 0
          };
      });

      setPlanningProposal(previewTasks);
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleConfirmPlanningProposal() {
    setIsAiProcessing(true);
    try {
      const tasksToInsert = planningProposal.map(p => ({ ...p, project_id: projectId }));
      await supabase.from('tasks').insert(tasksToInsert);
      alert("Planning initialisé avec succès.");
      setPlanningProposal(null);
      fetchTasks();
    } catch (err) {
      alert("Erreur d'insertion: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleProposeAdjustment(currentTasks, historyArrets) {
    setIsAiProcessing(true);
    try {
      const proposedAdjustment = await proposePlanningAdjustment(currentTasks, historyArrets);
      // Map back to task details for the preview
      const previewAdjustments = proposedAdjustment.map(adj => {
        const originalTask = currentTasks.find(t => t.id === adj.id);
        return {
          ...originalTask,
          new_start_date: adj.start_date,
          new_end_date: adj.end_date
        };
      }).filter(t => t.start_date !== t.new_start_date || t.end_date !== t.new_end_date);

      if (previewAdjustments.length > 0) {
        setAdjustmentProposal(previewAdjustments);
      } else {
        alert("L'IA indique qu'aucun ajustement du planning n'est nécessaire (ou toutes les tâches affectées sont terminées).");
      }
    } catch (err) {
      alert("Erreur Ajustement IA: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleConfirmAdjustment() {
    setIsAiProcessing(true);
    try {
      for (const adj of adjustmentProposal) {
        await supabase.from('tasks').update({
          start_date: adj.new_start_date,
          end_date: adj.new_end_date
        }).eq('id', adj.id);
      }
      alert("Planning ajusté avec succès.");
      setAdjustmentProposal(null);
      fetchTasks();
    } catch (err) {
      alert("Erreur lors de la mise à jour: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  }

  const isChantierArrete = arretsReprises.length > 0 && arretsReprises[arretsReprises.length - 1].type === 'ARRET';

  const renderGantt = () => {
    if (tasks.length === 0) return <div className="p-8 text-center text-slate-400 border border-slate-100 bg-white rounded-xl shadow-sm">Aucune tâche pour le Diagramme de Gantt.</div>;

    const minDate = new Date(Math.min(...tasks.map(t => new Date(t.start_date))));
    let maxDate = new Date(Math.max(...tasks.map(t => new Date(t.end_date))));

    // Calculate stop periods
    const stopPeriods = [];
    let currentStop = null;

    [...arretsReprises].sort((a, b) => new Date(a.date_event) - new Date(b.date_event)).forEach(ar => {
      if (ar.type === 'ARRET' && !currentStop) {
        currentStop = new Date(ar.date_event);
      } else if (ar.type === 'REPRISE' && currentStop) {
        stopPeriods.push({ start: currentStop, end: new Date(ar.date_event) });
        currentStop = null;
      }
    });
    if (currentStop) {
      // Chantier is currently stopped
      const today = new Date();
      stopPeriods.push({ start: currentStop, end: maxDate > today ? maxDate : today });
      if (today > maxDate) maxDate = today;
    }

    const totalMs = maxDate - minDate || 1;

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto border border-slate-100">
        <div className="min-w-[600px] relative">
          <div className="flex justify-between text-xs text-slate-400 mb-4 font-bold border-b border-slate-100 pb-2 pl-40 pr-[4.5rem]">
            <span>Début: {minDate.toLocaleDateString()}</span>
            <span>Fin prévue: {maxDate.toLocaleDateString()}</span>
          </div>

          <div className="relative">
            {/* Overlay stop periods over the timeline */}
            <div className="absolute top-0 bottom-0 left-40 right-[4.5rem] pointer-events-none">
               {stopPeriods.map((period, idx) => {
                  const s = Math.max(period.start, minDate);
                  const e = Math.min(period.end, maxDate);
                  if (s >= e) return null;

                  const startMs = s - minDate;
                  const durationMs = e - s;
                  const left = (startMs / totalMs) * 100;
                  const width = (durationMs / totalMs) * 100;

                  return (
                    <div key={idx} className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.15)_10px,rgba(239,68,68,0.15)_20px)] border-x border-red-300/50 z-0" style={{ left: `${left}%`, width: `${width}%` }} title={`Arrêt du ${new Date(s).toLocaleDateString()} au ${new Date(e).toLocaleDateString()}`}></div>
                  );
               })}
            </div>

            <div className="space-y-3 relative z-10">
              {tasks.map(task => {
                const startMs = new Date(task.start_date) - minDate;
                const durationMs = new Date(task.end_date) - new Date(task.start_date);
                const left = (startMs / totalMs) * 100;
                const width = Math.max((durationMs / totalMs) * 100, 1);
                const isLate = new Date(task.end_date) < new Date() && task.progress < 100;

                return (
                  <div key={task.id} className="flex items-center gap-4 group">
                    <div className="w-36 truncate text-xs font-bold text-slate-600 flex-shrink-0" title={task.name}>{task.name} {isLate && '⚠️'}</div>
                    <div className="flex-1 relative h-6 bg-slate-50/50 rounded-full overflow-hidden border border-slate-200">
                      <div className={`absolute top-0 bottom-0 rounded-full shadow-sm flex items-center px-2 text-[10px] font-bold text-white transition-all opacity-95 hover:opacity-100 ${isLate ? 'bg-red-500' : 'bg-petrol'}`} style={{ left: `${left}%`, width: `${width}%` }}>
                        <div className="absolute left-0 top-0 bottom-0 bg-white/20" style={{ width: `${task.progress}%` }}></div>
                        <span className="relative z-10 truncate">{task.progress}%</span>
                      </div>
                    </div>
                    <div className="w-16 text-xs text-slate-400 text-right flex-shrink-0">{Math.ceil(durationMs / (1000 * 60 * 60 * 24))} j</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-petrol">📅 Suivi du Planning & Événements</h2>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 items-center">
            <label className="text-xs font-bold text-slate-500">Commencement:</label>
            <input
              type="date"
              className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-petrol outline-none text-slate-600 text-sm"
              value={dateCommencement}
              onChange={e => setDateCommencement(e.target.value)}
            />
            <button
              onClick={handleUpdateDateCommencement}
              disabled={isAiProcessing || dateCommencement === project?.date_commencement}
              className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 disabled:opacity-50 transition"
            >
              Sauver Date
            </button>
          </div>

          <button
            onClick={handleProposePlanning}
            disabled={isAiProcessing || tasks.length > 0}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isAiProcessing ? '⏳ Analyse...' : '🤖 Proposer Planning IA (via BPU)'}
          </button>

          {isChantierArrete ? (
            <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg animate-pulse">
              ⚠️ CHANTIER EN ARRÊT
            </div>
          ) : (
            <div className="bg-emerald text-white px-4 py-2 rounded-lg font-bold shadow-lg">
              ✅ CHANTIER EN COURS
            </div>
          )}
        </div>
      </div>

      {/* Modal Planning Initial IA */}
      {planningProposal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-2xl text-petrol mb-4">🤖 Proposition de Planning (IA)</h3>
            <p className="text-slate-500 mb-6">Voici les tâches déduites de votre BPU. Vous pourrez les modifier manuellement par la suite.</p>
            <div className="space-y-2 mb-6">
              {planningProposal.map((t, i) => (
                <div key={i} className="flex justify-between border-b py-2 text-sm">
                  <span className="font-bold text-slate-700">{t.name}</span>
                  <span className="text-slate-500">{t.start_date} au {t.end_date}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4">
              <button onClick={() => setPlanningProposal(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={handleConfirmPlanningProposal} disabled={isAiProcessing} className="px-4 py-2 bg-emerald text-white font-bold rounded-lg hover:bg-green-600">Valider ce planning</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustement IA */}
      {adjustmentProposal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-2xl text-amber mb-4">🤖 Ajustement du Planning (IA)</h3>
            <p className="text-slate-500 mb-6">Suite à un événement, l'IA propose ces décalages de dates. Veuillez les valider.</p>
            <div className="space-y-4 mb-6">
              {adjustmentProposal.map((t, i) => (
                <div key={i} className="border p-3 rounded-lg bg-amber/5 border-amber/20">
                  <div className="font-bold text-slate-700 mb-2">{t.name}</div>
                  <div className="flex justify-between text-sm">
                    <div className="text-slate-500 line-through">Ancien: {t.start_date} / {t.end_date}</div>
                    <div className="text-amber font-bold">Nouveau: {t.new_start_date} / {t.new_end_date}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4">
              <button onClick={() => setAdjustmentProposal(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Refuser (Garder tel quel)</button>
              <button onClick={handleConfirmAdjustment} disabled={isAiProcessing} className="px-4 py-2 bg-emerald text-white font-bold rounded-lg hover:bg-green-600">Accepter le décalage</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Colonne Tâches */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">Progression & Planning des Tâches</h3>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('gantt')} className={`px-3 py-1.5 rounded text-xs font-bold ${viewMode === 'gantt' ? 'bg-white shadow text-petrol' : 'text-slate-400 hover:text-slate-600'}`}>Gantt</button>
                <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded text-xs font-bold ${viewMode === 'table' ? 'bg-white shadow text-petrol' : 'text-slate-400 hover:text-slate-600'}`}>Tableau</button>
              </div>
            </div>

            <form onSubmit={handleAddTask} className="grid gap-4 mb-6 border-b border-slate-100 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input className="col-span-2 border border-slate-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none" placeholder="Nom de la tâche (ex: Terrassement...)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <input type="date" className="border border-slate-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none text-slate-600" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
              <input type="date" className="border border-slate-300 p-3 rounded focus:ring-2 focus:ring-petrol outline-none text-slate-600" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required />
            </div>
            <button type="submit" className="bg-petrol text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow mt-2">
              Ajouter au planning
            </button>
          </form>

          {viewMode === 'table' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 border-b border-slate-200">Tâche / Jalon</th>
                  <th className="p-4 border-b border-slate-200">Période</th>
                  <th className="p-4 border-b border-slate-200 w-1/3">Avancement</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const isLate = new Date(task.end_date) < new Date() && task.progress < 100;
                  return (
                    <tr key={task.id} className={`hover:bg-slate-50 border-b border-slate-100 transition ${isLate ? 'bg-red-50/50' : ''}`}>
                      <td className="p-4">
                        <div className={`font-bold ${isLate ? 'text-red-700' : 'text-slate-700'}`}>{task.name} {isLate && '⚠️'}</div>
                        {isLate && <div className="text-xs text-red-500 mt-1">Retard détecté</div>}
                      </td>
                      <td className="p-4 text-slate-500 text-sm">
                        Du {new Date(task.start_date).toLocaleDateString()}<br/>Au {new Date(task.end_date).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0" max="100"
                            value={task.progress}
                            onChange={(e) => updateProgress(task.id, e.target.value)}
                            className={`w-full ${isLate ? 'accent-red-500' : 'accent-emerald'}`}
                          />
                          <span className={`font-bold min-w-[3rem] text-right ${isLate ? 'text-red-500' : 'text-emerald'}`}>{task.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-slate-400">Aucune tâche planifiée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : (
            renderGantt()
          )}
          </div>
        </div>

        {/* Colonne Arrêts et Reprises */}
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 h-max">
          <h3 className="font-bold text-slate-700 mb-4 text-lg">⚠️ Arrêts & Reprises</h3>
          <p className="text-xs text-slate-500 mb-4">Ajoutez un ordre pour permettre à l'IA de proposer un ajustement du planning.</p>

          <form onSubmit={handleAddArretReprise} className="grid gap-3 mb-6">
            <select className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-petrol outline-none w-full font-bold" value={arretFormData.type} onChange={e => setArretFormData({...arretFormData, type: e.target.value})}>
              <option value="ARRET" disabled={isChantierArrete}>Signaler un Ordre d'Arrêt</option>
              <option value="REPRISE" disabled={!isChantierArrete}>Signaler un Ordre de Reprise</option>
            </select>
            <input type="date" className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-petrol outline-none text-slate-600 w-full" value={arretFormData.date_event} onChange={e => setArretFormData({...arretFormData, date_event: e.target.value})} required />
            <input className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-petrol outline-none w-full" placeholder="Motif (ex: Intempéries, Refus...)" value={arretFormData.motif} onChange={e => setArretFormData({...arretFormData, motif: e.target.value})} required />
            <div className="bg-white p-2 rounded border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 mb-1">Pièce Jointe / OS (PDF/Image)</label>
              <input type="file" key={arretFile ? arretFile.name : 'empty'} onChange={e => setArretFile(e.target.files[0])} className="block w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-petrol/10 file:text-petrol hover:file:bg-petrol/20 cursor-pointer" />
            </div>
            <button type="submit" disabled={isAiProcessing} className={`${arretFormData.type === 'ARRET' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald hover:bg-green-600'} text-white py-2 rounded-lg font-bold transition shadow mt-2 disabled:opacity-50`}>
              {isAiProcessing ? 'Upload & Analyse...' : "Enregistrer & Ajuster via IA"}
            </button>
          </form>

          <div className="space-y-3">
            {arretsReprises.map(ar => (
              <div key={ar.id} className={`p-3 rounded-lg border text-sm ${ar.type === 'ARRET' ? 'bg-red-50 border-red-200' : 'bg-emerald/10 border-emerald/20'}`}>
                <div className="flex justify-between font-bold mb-1">
                  <span className={ar.type === 'ARRET' ? 'text-red-700' : 'text-emerald'}>{ar.type === 'ARRET' ? '🛑 ARRÊT' : '▶️ REPRISE'}</span>
                  <span className="text-slate-500">{new Date(ar.date_event).toLocaleDateString()}</span>
                </div>
                <div className="text-slate-600">{ar.motif}</div>
                {ar.document_url ? (
                  <a href={ar.document_url} target="_blank" rel="noreferrer" className="text-xs text-petrol font-bold underline mt-2 inline-block">📄 Consulter l'OS</a>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="bg-amber/10 border border-amber/30 text-amber px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 uppercase tracking-wider w-max">
                      ⚠️ Document Justificatif Manquant
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={e => handleUploadMissingDocument(ar.id, e.target.files[0])}
                        className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-amber/20 file:text-amber-700 hover:file:bg-amber/30 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}