import * as XLSX from 'xlsx';
import { Eleve } from '../types';

// Importer les élèves depuis un fichier Excel

export async function importerElevesDepuisExcel(file: File, mapping?: {
  matricule?: string;
  nom?: string;
  prenoms?: string;
  nomPrenoms?: string;
  moyenne?: string;
}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const [headerRaw, ...body] = rows;
      const header: string[] = Array.isArray(headerRaw) ? headerRaw.map(h => String(h)) : [];

      // Si pas de mapping fourni, retourner les colonnes pour affichage et sélection
      if (!mapping) {
        resolve({ columns: header, preview: body.slice(0, 5) });
        return;
      }

      // Trouver les index selon le mapping
      const matriculeIdx = mapping.matricule ? header.findIndex(h => h === mapping.matricule) : -1;
      const nomIdx = mapping.nom ? header.findIndex(h => h === mapping.nom) : -1;
      const prenomsIdx = mapping.prenoms ? header.findIndex(h => h === mapping.prenoms) : -1;
      const nomPrenomsIdx = mapping.nomPrenoms ? header.findIndex(h => h === mapping.nomPrenoms) : -1;
      const moyenneIdx = mapping.moyenne ? header.findIndex(h => h === mapping.moyenne) : -1;

      if (matriculeIdx === -1) {
        reject('Colonne "Matricule" non trouvée.');
        return;
      }

    const eleves: Eleve[] = body.map((row: any) => {
        let nom = '';
        let prenoms = '';
        if (nomPrenomsIdx !== -1) {
          // Séparer automatiquement : premier mot = nom, le reste = prénoms
          const full = String(row[nomPrenomsIdx] || '').trim();
          const parts = full.split(' ');
          nom = parts[0] || '';
          prenoms = parts.slice(1).join(' ');
        } else {
          nom = nomIdx !== -1 ? String(row[nomIdx] || '').trim() : '';
          prenoms = prenomsIdx !== -1 ? String(row[prenomsIdx] || '').trim() : '';
        }
        return {
      // Note: l'id/matricule est généré plus tard lors de la création en base
      id: '',
          matricule: String(row[matriculeIdx] || '').trim(),
          nom,
          prenoms,
          sexe: 'M',
          dateNaissance: '',
          lieuNaissance: '',
          classeId: '',
          anneeEntree: new Date().getFullYear().toString(),
          statut: 'Actif',
          pereTuteur: '',
          mereTutrice: '',
          telephone: '',
          adresse: '',
          photo: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    // Ne pas persister ici : laisser le composant appelant décider du moment et
    // des champs à fournir (ex: classeId). Cela évite la création double.
    resolve(eleves);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Exporter les élèves au format Excel
export function exporterElevesEnExcel(eleves: Eleve[]) {
  const data = [
    ['Matricule', 'Nom && Prénoms', 'Moyenne'],
    ...eleves.map(e => [e.matricule, `${e.nom} ${e.prenoms}`, ''])
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Élèves');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
