import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AuditTrail({ projectId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [projectId]);

  async function fetchEvents() {
    setLoading(true);
    let query = supabase
      .from('system_events')
      .select('*, user_profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (data) {
      setEvents(data);
    }
    setLoading(false);
  }

  const formatAction = (action) => {
    switch(action) {
      case 'CREATE': return <span className="bg-emerald/10 text-emerald px-2 py-1 rounded text-xs font-bold">CRÉATION</span>;
      case 'UPDATE': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">MODIFICATION</span>;
      case 'DELETE': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">SUPPRESSION</span>;
      case 'UPDATE_PROGRESS': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">AVANCEMENT</span>;
      case 'GENERATE_ATTACHMENT': return <span className="bg-amber/10 text-amber px-2 py-1 rounded text-xs font-bold">FACTURE (ATT)</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{action}</span>;
    }
  }

  const formatDetails = (details) => {
    if (!details) return '-';
    try {
      return (
        <pre className="text-xs bg-slate-50 p-2 rounded max-w-md overflow-auto border border-slate-100">
          {JSON.stringify(details, null, 2)}
        </pre>
      );
    } catch {
      return String(details);
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-petrol">🕵️ Piste d'Audit (Time Machine)</h2>
          <p className="text-sm text-slate-500">Traçabilité complète des actions {projectId ? 'sur ce projet' : 'sur l\'ensemble du système'}.</p>
        </div>
        <button onClick={fetchEvents} className="bg-slate-100 text-slate-600 px-3 py-1 rounded hover:bg-slate-200 transition font-bold text-sm">
          🔄 Rafraîchir
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Chargement de l'historique...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-3 font-bold">Date & Heure</th>
                <th className="p-3 font-bold">Utilisateur</th>
                <th className="p-3 font-bold">Action</th>
                <th className="p-3 font-bold">Table / Entité</th>
                <th className="p-3 font-bold">Détails de la modification</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const user = ev.user_profiles ? `${ev.user_profiles.first_name || ''} ${ev.user_profiles.last_name || ''}`.trim() || ev.user_profiles.email : ev.user_id || 'Système';

                return (
                  <tr key={ev.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-slate-700">
                      {user}
                    </td>
                    <td className="p-3">
                      {formatAction(ev.action)}
                    </td>
                    <td className="p-3 font-mono text-xs text-petrol">
                      {ev.table_name} <br/>
                      <span className="text-[10px] text-slate-400">{ev.record_id}</span>
                    </td>
                    <td className="p-3">
                      {formatDetails(ev.details)}
                    </td>
                  </tr>
                )
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500">Aucun événement enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
