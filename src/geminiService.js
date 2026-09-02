import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

function handleGeminiError(error, context) {
  console.error(`Erreur Gemini ${context}:`, error);
  if (error.message && error.message.includes('Failed to fetch')) {
    throw new Error(`L'IA n'a pas pu être contactée (${context}). Veuillez DÉSACTIVER votre bloqueur de publicités (Brave Shields, uBlock, etc.) ou VPN qui bloque l'accès à l'API Google.`);
  }
  throw new Error(`L'IA a rencontré une erreur (${context}): ` + error.message);
}

export async function analyzeBPUFile(file) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Tu es un expert en BTP au Maroc.
Voici un document contenant le Bordereau des Prix Unitaire (BPU) d'un marché public.
Analyse ce document et extrais toutes les lignes de prix. Ignore les lignes de totaux, de TVA ou les en-têtes.
Retourne STRICTEMENT un JSON (sans markdown ni autre texte) avec ce format exact pour la liste:
[
  {
    "code_prix": "ex: 1.1",
    "designation": "Nom exact de la prestation",
    "unite": "ex: m3, ml, U, ENS",
    "qte_marche": <quantité prévue, nombre>,
    "prix_unitaire": <prix unitaire en DH, nombre>
  }
]
`;

    let contentParts = [];

    const isExcelOrCsv = file.name.match(/\.(xlsx|xls|csv)$/i);

    if (isExcelOrCsv) {
      // Extract data locally to text for better AI understanding of .xls/.xlsx
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const csvData = workbook.SheetNames.map(sheetName => {
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      }).join('\n\n--- SUIVANT ---\n\n');

      contentParts = [prompt + "\n\nContenu du fichier:\n" + csvData];
    } else {
      // PDF or other binary supported by Gemini
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'application/pdf';

      contentParts = [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ];
    }

    const result = await model.generateContent(contentParts);
    const responseText = result.response.text();
    const cleanJsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonString);

  } catch (error) {
    handleGeminiError(error, "BPU");
  }
}

export async function proposePlanningFromBPU(bpuLines, projectInfo, arretsReprises) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Tu es un expert en planification de projets BTP au Maroc.
Voici les lignes du bordereau des prix (BPU) d'un projet.
Délai global d'exécution en jours: ${projectInfo.delai_execution_jours || 90}.
Date de commencement des travaux: ${projectInfo.date_commencement || 'Non définie'}.

Historique des arrêts et reprises:
${JSON.stringify(arretsReprises || [])}

Analyse le BPU (qui contient les quantités) et ces informations de dates/arrêts pour proposer un planning cohérent et réaliste.
Si des arrêts/reprises existent, tiens-en compte pour allonger ou décaler certaines tâches en conséquence.

Retourne STRICTEMENT un JSON (sans markdown) avec ce format:
[
  {
    "name": "Nom de la tâche (basé sur le BPU)",
    "duree_jours": <durée estimée logique en jours>
  }
]
Fais en sorte que la somme des durées et des chevauchements soit cohérente avec les quantités et les contraintes d'arrêt.

BPU:
${JSON.stringify(bpuLines)}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonString);

  } catch (error) {
    handleGeminiError(error, "Planning");
  }
}

export async function generateExecutiveSummary(projectInfo, dataContext) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Tu es le Directeur Stratégique et Financier (CFO/COO) d'une entreprise de BTP.
Rédige un "Executive Summary" (Résumé Exécutif) clair, percutant et professionnel pour la direction concernant le projet "${projectInfo.name}".
Voici les données en temps réel :
${JSON.stringify(dataContext)}

Structure ton rapport en Markdown avec :
1. 📈 Santé Financière (Marge, Dépenses vs Facturation)
2. ⚠️ Alertes & Risques (Retards, incohérences de trésorerie, dépassements)
3. 🎯 Recommandations (Actions immédiates à prendre)

Sois synthétique et va à l'essentiel. Ne mentionne pas que tu as reçu un JSON.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    handleGeminiError(error, "Executive Summary");
  }
}

export async function askChatbot(question, dataContext) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Tu es l'assistant intelligent de l'ERP EBER-OS. Un utilisateur te pose une question sur les données du système.
Voici le contexte des données actuelles :
${JSON.stringify(dataContext)}

Question de l'utilisateur : "${question}"

Réponds de manière précise, courte et professionnelle. Si l'information n'est pas dans le contexte, dis-le.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    handleGeminiError(error, "Chatbot");
  }
}

export async function proposePlanningAdjustment(tasks, arretsReprises) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Tu es un expert en planification BTP.
Voici le planning actuel d'un chantier (avec dates et avancement), ainsi que l'historique des arrêts et reprises.
Un nouvel événement a pu être ajouté. Tu dois calculer les nouvelles dates de début et de fin pour toutes les tâches dont l'avancement (progress) est strictement inférieur à 100%, afin de refléter l'impact des arrêts et reprises (un arrêt suspend le délai jusqu'à la reprise correspondante).
Retourne STRICTEMENT un JSON (sans markdown) contenant le tableau des tâches mises à jour (même si non modifiées), avec CE format exact:
[
  {
    "id": <id original de la tâche>,
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  }
]

Planning actuel:
${JSON.stringify(tasks)}

Historique Arrêts/Reprises (trié par date):
${JSON.stringify(arretsReprises)}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonString);

  } catch (error) {
    handleGeminiError(error, "Ajustement Planning");
  }
}