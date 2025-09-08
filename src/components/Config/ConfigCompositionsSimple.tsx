import React, { useState, useEffect } from 'react';
import { db } from '../../utils/database';
import { CompositionConfig, Ecole } from '../../types';
import { useToast } from '../Layout/ToastProvider';
import { Save, Plus, Edit2, Trash2, BookOpen, X } from 'lucide-react';

export default function ConfigCompositionsSimple() {
  const { showToast } = useToast();
  const [ecole, setEcole] = useState<Ecole | null>(null);
  const [compositions, setCompositions] = useState<CompositionConfig[]>([]);
  const [editing, setEditing] = useState<CompositionConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    coefficient: 1
  });

  useEffect(() => {
    const ecoleData = db.getAll<Ecole>('ecole')[0];
    if (ecoleData) {
      setEcole(ecoleData);
      setCompositions(ecoleData.compositions || []);
    }
  }, []);

  const resetForm = () => {
    setFormData({ nom: '', coefficient: 1 });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (comp: CompositionConfig) => {
    setFormData({ nom: comp.nom, coefficient: comp.coefficient });
    setEditing(comp);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.nom.trim()) {
      showToast('Le nom est obligatoire', 'error');
      return;
    }

    if (compositions.some(c => c.nom.toLowerCase() === formData.nom.trim().toLowerCase() && c.id !== editing?.id)) {
      showToast('Ce nom existe déjà', 'error');
      return;
    }

    let newCompositions: CompositionConfig[];

    if (editing) {
      newCompositions = compositions.map(c => 
        c.id === editing.id 
          ? { ...c, nom: formData.nom.trim(), coefficient: formData.coefficient }
          : c
      );
    } else {
      const newComp: CompositionConfig = {
        id: Date.now().toString(),
        nom: formData.nom.trim(),
        coefficient: formData.coefficient
      };
      newCompositions = [...compositions, newComp];
    }

    setCompositions(newCompositions);
    if (ecole) {
      db.update<Ecole>('ecole', ecole.id, { compositions: newCompositions });
    }
    
    showToast(editing ? 'Composition mise à jour' : 'Composition ajoutée', 'success');
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer cette composition ?')) {
      const newCompositions = compositions.filter(c => c.id !== id);
      setCompositions(newCompositions);
      if (ecole) {
        db.update<Ecole>('ecole', ecole.id, { compositions: newCompositions });
      }
      showToast('Composition supprimée', 'success');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 p-4 rounded-xl">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Configuration des Compositions</h1>
              <p className="text-purple-100 mt-2">Gestion des périodes d'évaluation et coefficients</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-xl transition-all"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nouvelle Composition</span>
          </button>
        </div>
      </div>

      {/* Liste des compositions */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Compositions configurées</h2>
          <p className="text-gray-600 mt-1">{compositions.length} composition(s)</p>
        </div>

        <div className="p-8">
          {compositions.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune composition configurée</h3>
              <p className="text-gray-600 mb-6">Commencez par ajouter vos premières compositions</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              >
                Ajouter une composition
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {compositions.map(comp => (
                <div key={comp.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{comp.nom}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(comp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(comp.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {comp.coefficient}
                    </div>
                    <p className="text-gray-600 text-sm">Coefficient</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editing ? 'Modifier la composition' : 'Nouvelle composition'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Nom de la composition <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                  placeholder="Ex: 1ère Composition, Devoir de Noël..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Coefficient <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.coefficient}
                  onChange={(e) => setFormData(prev => ({ ...prev, coefficient: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Poids de cette composition dans le calcul de la moyenne (1-10)
                </p>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all"
                >
                  <Save className="h-5 w-5" />
                  <span>{editing ? 'Mettre à jour' : 'Enregistrer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}