import React, { useState, useMemo } from 'react';
import { useToast } from '../Layout/ToastProvider';
import { Search, Plus, Edit2, Trash2, Users, BookOpen } from 'lucide-react';
import { db } from '../../utils/database';
import { Classe, Enseignant, Eleve } from '../../types';
import EnteteFiche from '../EnteteFiche';
import { openPrintPreviewFromElementId } from '../../utils/printPreview';

interface ClassesListProps {
  onClasseSelect: (classe: Classe | null) => void;
  onNewClasse: () => void;
}

export default function ClassesList({ onClasseSelect, onNewClasse }: ClassesListProps) {
  // Fonction d'aperçu et impression
  const handlePrint = () => openPrintPreviewFromElementId('classes-print-area', 'Liste des classes');
  const { showToast } = useToast();
  const classes = db.getAll<Classe>('classes');
  const [isLoading, setIsLoading] = useState(false);
  const [localClasses, setLocalClasses] = useState(classes);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNiveau, setFilterNiveau] = useState('');
  const niveaux = [
    'Petite Section',
    'Moyenne Section',
    'Grande Section',
    'CP1',
    'CP2',
    'CE1',
    'CE2',
    'CM1',
    'CM2',
  ];
  const enseignants = db.getAll<Enseignant>('enseignants');
  const eleves = db.getAll<Eleve>('eleves');

  const filteredClasses = useMemo(() => {
  let filtered = [...localClasses];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(classe =>
        classe.niveau.toLowerCase().includes(term) ||
        classe.section.toLowerCase().includes(term) ||
        classe.enseignantPrincipal.toLowerCase().includes(term) ||
        classe.salle.toLowerCase().includes(term)
      );
    }

    if (filterNiveau) {
      filtered = filtered.filter(classe => classe.niveau === filterNiveau);
    }

    const niveauOrder = [
      'Petite Section',
      'Moyenne Section',
      'Grande Section',
      'CP1',
      'CP2',
      'CE1',
      'CE2',
      'CM1',
      'CM2',
    ];
    return filtered.sort((a, b) => {
      const aIndex = niveauOrder.indexOf(a.niveau);
      const bIndex = niveauOrder.indexOf(b.niveau);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.section.localeCompare(b.section);
    });
  }, [classes, searchTerm, filterNiveau]);

  const handleDelete = (classe: Classe) => {
    setIsLoading(true);
    const elevesInClasse = eleves.filter(e => e.classeId === classe.id);
    if (elevesInClasse.length > 0) {
      showToast(`Impossible de supprimer cette classe car elle contient ${elevesInClasse.length} élève(s).`, 'error');
      setIsLoading(false);
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la classe ${classe.niveau} ${classe.section} ?`)) {
      db.delete('classes', classe.id);
      setLocalClasses(localClasses.filter(c => c.id !== classe.id));
      showToast('Classe supprimée avec succès', 'success');
    }
    setIsLoading(false);
  };

  const getEffectifActuel = (classeId: string) => {
    return eleves.filter(e => e.classeId === classeId && e.statut === 'Actif').length;
  };

  const getEnseignantNom = (nom: string) => {
    const enseignant = enseignants.find(e => `${e.prenoms} ${e.nom}` === nom);
    return enseignant ? `${enseignant.prenoms} ${enseignant.nom}` : nom;
  };

  return (
    <div className="p-6 space-y-6 relative">
      <div className="flex justify-end mb-2">
        <button
          className="bg-teal-600 text-white px-4 py-2 rounded shadow hover:bg-teal-700 transition"
          onClick={handlePrint}
        >
          Aperçu & Impression
        </button>
      </div>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-teal-600 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-white text-lg font-semibold">Chargement...</span>
          </div>
        </div>
      )}
      {/* En-tête */}
  {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Classes</h1>
          <p className="text-gray-600">{filteredClasses.length} classe(s) trouvée(s)</p>
        </div>
        <button 
          onClick={onNewClasse}
          className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle Classe</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une classe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterNiveau}
            onChange={(e) => setFilterNiveau(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Tous les niveaux</option>
            <option value="Petite Section">Petite Section</option>
            <option value="Moyenne Section">Moyenne Section</option>
            <option value="Grande Section">Grande Section</option>
            <option value="CP1">CP1</option>
            <option value="CP2">CP2</option>
            <option value="CE1">CE1</option>
            <option value="CE2">CE2</option>
            <option value="CM1">CM1</option>
            <option value="CM2">CM2</option>
          </select>
        </div>
      </div>

      {/* Grille des classes */}
      {/* Zone imprimable */}
      <div id="print-area" className="hidden print:block bg-white p-4 mb-4 print-compact">
        <EnteteFiche type="eleves" libelle="Liste des classes" />
        {/* Header hors-table sous forme de table pour alignement précis */}
        <div className="mb-2 overflow-x-auto">
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px', tableLayout: 'fixed'}}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="border px-2 py-1">N°</th>
                <th className="border px-2 py-1">Niveau</th>
                <th className="border px-2 py-1">Section</th>
                <th className="border px-2 py-1">Année scolaire</th>
                <th className="border px-2 py-1">Enseignant principal</th>
                <th className="border px-2 py-1">Effectif max</th>
                <th className="border px-2 py-1">Effectif actuel</th>
              </tr>
            </thead>
          </table>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px', tableLayout: 'fixed'}}>
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <tbody>
            {filteredClasses.map((classe, idx) => (
              <tr key={classe.id}>
                <td>{idx + 1}</td>
                <td>{classe.niveau}</td>
                <td>{classe.section}</td>
                <td>{classe.anneeScolaire}</td>
                <td>{getEnseignantNom(classe.enseignantPrincipal)}</td>
                <td>{classe.effectifMax}</td>
                <td>{getEffectifActuel(classe.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((classe) => {
          const effectifActuel = getEffectifActuel(classe.id);
          const tauxRemplissage = (effectifActuel / classe.effectifMax) * 100;
          
          return (
            <div key={classe.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              {/* En-tête de la carte */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {classe.niveau} {classe.section}
                  </h3>
                  <p className="text-sm text-gray-500">{classe.anneeScolaire}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onClasseSelect(classe)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                    title="Modifier"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(classe)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Informations */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Enseignant: {getEnseignantNom(classe.enseignantPrincipal)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Salle: {classe.salle}
                  </span>
                </div>

                {/* Effectif */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Effectif</span>
                    <span className="text-sm font-medium text-gray-900">
                      {effectifActuel}/{classe.effectifMax}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        tauxRemplissage >= 90 ? 'bg-red-500' :
                        tauxRemplissage >= 75 ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tauxRemplissage.toFixed(0)}% de remplissage
                  </p>
                </div>

                {/* Matières */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    {classe.matieres.length} matière(s)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {classe.matieres.slice(0, 3).map((matiere) => (
                      <span 
                        key={matiere.id}
                        className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded"
                      >
                        {matiere.nom}
                      </span>
                    ))}
                    {classe.matieres.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{classe.matieres.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClasses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucune classe trouvée</p>
        </div>
      )}
    </div>
  );
}