import { useState, useMemo } from 'react';
import { db } from '../../utils/database';
import { Eleve, Classe, Matiere, Note } from '../../types';

export default function NotesList() {
  const eleves = db.getAll<Eleve>('eleves');
  const classes = db.getAll<Classe>('classes');
  const matieres = db.getAll<Matiere>('matieres');
  const notes = db.getAll<Note>('notes');

  const [selectedClasse, setSelectedClasse] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEleves = useMemo(() => {
    let filtered = eleves;
    if (selectedClasse) {
      filtered = filtered.filter(e => e.classeId === selectedClasse);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.nom.toLowerCase().includes(term) ||
        e.prenoms.toLowerCase().includes(term) ||
        e.matricule.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [eleves, selectedClasse, searchTerm]);

  const [noteValue, setNoteValue] = useState<number>(0);
  const [noteMatiere, setNoteMatiere] = useState('');
  const [noteEleve, setNoteEleve] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const getNotesForEleve = (eleveId: string) => {
    return notes.filter(n => n.eleveId === eleveId && (!selectedMatiere || n.matiereId === selectedMatiere));
  };

  // Ajout de note
  const handleAddNote = () => {
    if (!noteEleve || !noteMatiere || noteValue < 0 || noteValue > 20) {
      setMessage('Sélectionnez un élève, une matière et une note valide');
      return;
    }
    db.create('notes', {
      eleveId: noteEleve,
      matiereId: noteMatiere,
      valeur: noteValue,
      date: new Date().toISOString()
    });
    setMessage('Note ajoutée');
    setNoteValue(0);
    setNoteMatiere('');
    setNoteEleve(null);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold mb-4">Gestion des Notes</h2>
      <div className="flex space-x-4 mb-4">
        <select value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Toutes les classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.niveau} {c.section}</option>
          ))}
        </select>
        <select value={selectedMatiere} onChange={e => setSelectedMatiere(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Toutes les matières</option>
          {matieres.map(m => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
        <input type="text" placeholder="Recherche élève..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border rounded px-2 py-1" />
      </div>

      {/* Formulaire ajout note */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <h3 className="font-semibold mb-2">Ajouter une note</h3>
        <select value={noteEleve || ''} onChange={e => setNoteEleve(e.target.value)} className="border rounded px-2 py-1 mr-2">
          <option value="">Sélectionner un élève</option>
          {filteredEleves.map(e => (
            <option key={e.id} value={e.id}>{e.nom} {e.prenoms} ({e.matricule})</option>
          ))}
        </select>
        <select value={noteMatiere} onChange={e => setNoteMatiere(e.target.value)} className="border rounded px-2 py-1 mr-2">
          <option value="">Sélectionner une matière</option>
          {matieres.map(m => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
        <input type="number" min={0} max={20} value={noteValue} onChange={e => setNoteValue(Number(e.target.value))} placeholder="Note" className="border rounded px-2 py-1 mr-2" />
        <button onClick={handleAddNote} className="btn btn-primary">Ajouter</button>
        {message && <span className="ml-4 text-green-600">{message}</span>}
      </div>

      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-2 py-1">Matricule</th>
            <th className="border px-2 py-1">Nom</th>
            <th className="border px-2 py-1">Prénoms</th>
            <th className="border px-2 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {filteredEleves.map(eleve => (
            <tr key={eleve.id}>
              <td className="border px-2 py-1">{eleve.matricule}</td>
              <td className="border px-2 py-1">{eleve.nom}</td>
              <td className="border px-2 py-1">{eleve.prenoms}</td>
              <td className="border px-2 py-1">
                {getNotesForEleve(eleve.id).map(note => (
                  <span key={note.id} className="inline-block mr-2">{note.valeur} ({matieres.find(m => m.id === note.matiereId)?.nom})</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
