import React, { useState } from 'react';
import { generateExecutiveSummary, askChatbot } from './geminiService';
import ReactMarkdown from 'react-markdown';

export default function AIAssistant({ projectInfo, bpuLines, expenses, labor, invoices }) {
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // We only send high-level context to save tokens and keep it fast
  const buildContext = () => {
    return {
      projet: projectInfo.name,
      delai_jours: projectInfo.delai_execution_jours,
      total_marche_ht: bpuLines.reduce((acc, l) => acc + (l.qte_marche * l.prix_unitaire), 0),
      total_realise_ht: bpuLines.reduce((acc, l) => acc + ((l.qte_realisee || 0) * l.prix_unitaire), 0),
      total_depenses_officielles: expenses.filter(e => e.est_officiel).reduce((acc, e) => acc + e.montant_reel, 0),
      total_depenses_noir: expenses.filter(e => !e.est_officiel).reduce((acc, e) => acc + e.montant_reel, 0),
      depenses_en_attente: expenses.filter(e => e.status === 'EN_ATTENTE').map(e => ({ motif: e.designation, montant: e.montant_reel })),
      factures_impayees: invoices?.filter(i => i.status === 'EN_ATTENTE' || i.status === 'EN_RETARD').map(i => ({ ref: i.reference, montant: i.montant_ttc, statut: i.status })) || [],
      factures_payees: invoices?.filter(i => i.status === 'PAYEE').reduce((acc, i) => acc + i.montant_ttc, 0) || 0
    };
  };

  const handleGenerateSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await generateExecutiveSummary(projectInfo, buildContext());
      setSummary(res);
    } catch (e) {
      alert(e.message);
    }
    setLoadingSummary(false);
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = { role: 'user', content: question };
    setChat(prev => [...prev, userMsg]);
    setQuestion('');
    setLoadingChat(true);

    try {
      const res = await askChatbot(question, buildContext());
      setChat(prev => [...prev, { role: 'ai', content: res }]);
    } catch (e) {
      setChat(prev => [...prev, { role: 'ai', content: `❌ Erreur: ${e.message}` }]);
    }
    setLoadingChat(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6 mb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-petrol">🧠 Assistant Direction (IA)</h2>
          <p className="text-sm text-slate-500">Optionnel : Laissez l'IA analyser vos données en temps réel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Executive Summary */}
        <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 relative flex flex-col">
          <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">📑 Executive Summary</h3>
          <button
            onClick={handleGenerateSummary}
            disabled={loadingSummary}
            className="w-full bg-petrol text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition disabled:opacity-50 mb-6 shadow flex justify-center items-center gap-2"
          >
            {loadingSummary ? 'Génération en cours...' : 'Générer le rapport hebdomadaire'}
          </button>

          <div className="flex-1 prose prose-sm prose-slate max-w-none bg-white p-6 rounded-lg border border-slate-200 overflow-y-auto">
            {summary ? <ReactMarkdown>{summary}</ReactMarkdown> : <p className="text-slate-400 italic text-center mt-10">Cliquez sur le bouton pour analyser la santé du projet.</p>}
          </div>
        </div>

        {/* Chatbot */}
        <div className="border border-slate-200 rounded-xl p-6 flex flex-col bg-slate-50">
          <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">💬 Chat ERP Contextuel</h3>

          <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4 mb-4 overflow-y-auto min-h-[300px] max-h-[400px] flex flex-col gap-3">
            {chat.length === 0 && <p className="text-slate-400 italic text-center mt-10">Posez une question sur le projet (ex: "Combien d'argent avons-nous encaissé ?" ou "Quelles sont les alertes ?")</p>}
            {chat.map((msg, i) => (
              <div key={i} className={`p-3 rounded-xl max-w-[85%] ${msg.role === 'user' ? 'bg-petrol text-white self-end rounded-br-none' : 'bg-slate-100 text-slate-800 self-start rounded-bl-none'}`}>
                <span className="font-bold text-[10px] opacity-50 block mb-1 uppercase tracking-wider">{msg.role === 'user' ? 'Vous' : 'Gemini'}</span>
                <div className="text-sm prose prose-sm"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              </div>
            ))}
            {loadingChat && <div className="text-slate-500 text-sm self-start bg-slate-100 p-3 rounded-xl rounded-bl-none animate-pulse font-bold">L'IA réfléchit...</div>}
          </div>

          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Demandez quelque chose à l'ERP..."
              className="flex-1 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-petrol font-medium"
              disabled={loadingChat}
            />
            <button type="submit" disabled={loadingChat || !question.trim()} className="bg-emerald text-white px-6 font-bold rounded-lg hover:bg-green-600 transition shadow disabled:opacity-50">
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
