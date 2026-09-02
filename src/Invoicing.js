import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSituationPDF = (project, bpuLines, avancements, montantMois, rgAAppliquer, netAPayer) => {
  const doc = new jsPDF();

  doc.setFontSize(26);
  doc.setTextColor(44, 62, 80); // #2c3e50 (Petrol)
  doc.setFont("helvetica", "bold");
  doc.text('EBER - OS', 14, 25);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text('Travaux VRD & Marchés Publics', 14, 32);

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Décompte / Situation de Travaux', 14, 50);

  doc.setFontSize(12);
  doc.text(`Projet : ${project.name || 'N/A'}`, 14, 60);
  doc.text(`Client : ${project.client || 'N/A'}`, 14, 67);
  doc.text(`Date d'émission : ${new Date().toLocaleDateString()}`, 14, 74);

  const tableData = bpuLines.filter(line => avancements[line.id] > 0).map(line => {
    const qteMois = avancements[line.id] || 0;
    const montantTotal = qteMois * line.prix_unitaire;
    return [
      line.code_prix,
      line.designation,
      line.unite,
      line.qte_marche,
      line.prix_unitaire.toLocaleString() + ' DH',
      qteMois,
      montantTotal.toLocaleString() + ' DH'
    ];
  });

  autoTable(doc, {
    startY: 85,
    head: [['Code', 'Désignation', 'Unité', 'Qté Marché', 'P.U.', 'Réalisé Mois', 'Montant HT']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
    styles: { fontSize: 9 },
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 100;

  const tva = montantMois * 0.20;
  const montantTTC = montantMois + tva;
  const netAPayerTTC = montantTTC - rgAAppliquer;

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.text(`Montant Travaux HT du mois : ${montantMois.toLocaleString()} DH`, 14, finalY);

  doc.text(`TVA (20%) : ${tva.toLocaleString()} DH`, 14, finalY + 8);
  doc.text(`Montant TTC : ${montantTTC.toLocaleString()} DH`, 14, finalY + 16);

  doc.setTextColor(243, 156, 18); // #f39c12 (Amber)
  doc.text(`Retenue de Garantie (Plafonnée à 7%) : - ${rgAAppliquer.toLocaleString()} DH`, 14, finalY + 26);

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, finalY + 32, 100, finalY + 32);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(39, 174, 96); // #27ae60 (Emerald)
  doc.text(`Net à payer TTC : ${netAPayerTTC.toLocaleString()} DH`, 14, finalY + 42);

  doc.save(`Situation_${project.name?.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
};
