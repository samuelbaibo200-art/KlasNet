import React, { useState, useMemo } from 'react';
import { db } from '../../utils/database';
import { Eleve, Classe, Matiere, Note, CompositionConfig } from '../../types';
import { useToast } from '../Layout/ToastProvider';
import { Save, Plus, BookOpen, Users, Calculator } from 'lucide-react';

export default function NotesParClasse() {
  const { showToast } = useToast();
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [selectedComposition, setSelectedComposition] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [notes, setNotes] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const classes = db.getAll<Classe>('classes');
  const matieres = db.getAll<Matiere>('matieres');
  const compositions = db.getAll<CompositionConfig>('compositions');
  const allNotes = db.getAll<Note>('notes');

  const selectedClasse = classes.find(c => c.id === selectedClasseId);
  const elevesClasse = db.getAll<Eleve>('eleves').filter(e => 
    e.classeId === selectedClasseId && e.statut === 'Actif'
  );

  // Matières de la classe sélectionnée
  const matieresClasse = useMemo(() => {
    if (!selectedClasse) return [];
    return selectedClasse.matieres || [];
  }, [selectedClasse]);

  // Charger les notes existantes quand on change de composition/matière
  useEffect(() => {
    if (!selectedComposition || !selectedMatiere) return;
    
    const notesExistantes: Record<string, number> = {};
    elevesClasse.forEach(eleve => {
      const note = allNotes.find(n => 
        n.eleveId === eleve.id && 
        n.matiereId === selectedMatiere && 
        n.compositionId === selectedComposition
      );
      if (note) {
        notesExistantes[eleve.id] = note.valeur;
      }
    });
    setNotes(notesExistantes);
  }, [selectedComposition, selectedMatiere, elevesClasse, allNotes]);

  const handleNoteChange = (eleveId: string, valeur: number) => {
    setNotes(prev => ({ ...prev, [eleveId]: valeur }));
  };

  const handleSaveNotes = async () => {
    if (!selectedComposition || !selectedMatiere) {
      showToast('Sélectionnez une composition et une matière', 'error');
      return;
    }

    setIsSaving(true);
    try {
      Object.entries(notes).forEach(([eleveId, valeur]) => {
        if (valeur >= 0 && valeur <= 20) {
          const existingNote = allNotes.find(n => 
            n.eleveId === eleveId && 
            n.matiereId === selectedMatiere && 
            n.compositionId === selectedComposition
          );

          if (existingNote) {
            db.update('notes', existingNote.id, { valeur });
          } else {
            db.create('notes', {
              eleveId,
              matiereId: selectedMatiere,
              compositionId: selectedComposition,
              valeur,
              date: new Date().toISOString()
            });
          }
        }
      });
      
      showToast('Notes enregistrées avec succès', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'enregistrement des notes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const calculerMoyenneEleve = (eleveId: string) => {
    const notesEleve = allNotes.filter(n => n.eleveId === eleveId);
    if (notesEleve.length === 0) return 0;
    
    const total = notesEleve.reduce((sum, note) => sum + note.valeur, 0);
    return Math.round((total / notesEleve.length) * 100) / 100;
  };

  const getBaremeNote = (matiere: Matiere) => {
    // Logique pour déterminer le barème selon le niveau et la matière
    if (!selectedClasse) return 20;
    
    const niveau = selectedClasse.niveau;
    
    // CE1 à CM2 : barèmes spéciaux
    if (['CE1', 'CE2', 'CM1', 'CM2'].includes(niveau)) {
      if (matiere.nom.toLowerCase().includes('math')) return 50;
      if (matiere.nom.toLowerCase().includes('éveil')) return 50;
      if (matiere.nom.toLowerCase().includes('exploitation') || matiere.nom.toLowerCase().includes('texte')) return 50;
      if (matiere.nom.toLowerCase().includes('orthographe')) return 20;
    }
    
    // CP1, CP2 et maternelles : /20 par défaut
    return 20;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-2xl shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="bg-white bg-opacity-20 p-4 rounded-xl">
            <BookOpen className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Gestion des Notes par Classe</h1>
            <p className="text-indigo-100 mt-2">Saisie et suivi des évaluations par classe</p>
          </div>
        </div>
      </div>

      {/* Sélection de classe */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
          <span className="bg-blue-100 p-2 rounded-lg mr-3">🏫</span>
          Sélection de la classe
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Classe</label>
            <select
              value={selectedClasseId}
              onChange={(e) => {
                setSelectedClasseId(e.target.value);
                setSelectedMatiere('');
                setSelectedComposition('');
                setNotes({});
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(classe => (
                <option key={classe.id} value={classe.id}>
                  {classe.niveau} {classe.section} ({elevesClasse.length} élèves)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Composition</label>
            <select
              value={selectedComposition}
              onChange={(e) => {
                setSelectedComposition(e.target.value);
                setNotes({});
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
              disabled={!selectedClasseId}
            >
              <option value="">Sélectionner une composition</option>
              {compositions.map(comp => (
                <option key={comp.id} value={comp.id}>
                  {comp.nom} (coeff. {comp.coefficient})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Matière</label>
            <select
              value={selectedMatiere}
              onChange={(e) => {
                setSelectedMatiere(e.target.value);
                setNotes({});
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
              disabled={!selectedClasseId}
            >
              <option value="">Sélectionner une matière</option>
              {matieresClasse.map(matiere => {
                const bareme = getBaremeNote(matiere);
                return (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom} (/{bareme})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Saisie des notes */}
      {selectedClasseId && selectedComposition && selectedMatiere && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Saisie des notes - {selectedClasse?.niveau} {selectedClasse?.section}
                </h3>
                <p className="text-gray-600 text-sm">
                  {matieresClasse.find(m => m.id === selectedMatiere)?.nom} - 
                  {compositions.find(c => c.id === selectedComposition)?.nom}
                  (/{getBaremeNote(matieresClasse.find(m => m.id === selectedMatiere)!)})
                </p>
              </div>
              <button
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? 'Sauvegarde...' : 'Enregistrer les notes'}</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              {elevesClasse.map((eleve, index) => {
                const bareme = getBaremeNote(matieresClasse.find(m => m.id === selectedMatiere)!);
                const moyenne = calculerMoyenneEleve(eleve.id);
                
                return (
                  <div key={eleve.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                      </div>
                      {eleve.photo && (
                        <img 
                          src={eleve.photo} 
                          alt={`${eleve.prenoms} ${eleve.nom}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">
                          {eleve.prenoms} {eleve.nom}
                        </div>
                        <div className="text-sm text-gray-600">
                          {eleve.matricule} • Moyenne: {moyenne}/20
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Note /{bareme}</div>
                        <input
                          type="number"
                          min="0"
                          max={bareme}
                          step="0.5"
                          value={notes[eleve.id] || ''}
                          onChange={(e) => handleNoteChange(eleve.id, Number(e.target.value))}
                          className="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-center font-bold"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {elevesClasse.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucun élève dans cette classe</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistiques de la classe */}
      {selectedClasseId && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <span className="bg-green-100 p-2 rounded-lg mr-3">📊</span>
            Statistiques de la classe
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{elevesClasse.length}</div>
              <p className="text-blue-800 font-medium">Élèves actifs</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">{matieresClasse.length}</div>
              <p className="text-purple-800 font-medium">Matières</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">{compositions.length}</div>
              <p className="text-green-800 font-medium">Compositions</p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <div className="text-2xl font-bold text-orange-600">
                {elevesClasse.filter(e => calculerMoyenneEleve(e.id) >= 10).length}
              </div>
              <p className="text-orange-800 font-medium">Admissibles</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}