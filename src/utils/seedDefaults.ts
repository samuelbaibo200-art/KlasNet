import React, { useState, useEffect } from 'react';
import { useToast } from '../Layout/ToastProvider';
import { Save, X } from 'lucide-react';
import { db } from '../../utils/database';
import { Matiere } from '../../types';

interface MatiereFormProps {
  matiere?: Matiere | null;
  onSave: (matiere: Matiere) => void;
  onCancel: () => void;
}

export default function MatiereForm({ matiere, onSave, onCancel }: MatiereFormProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    nom: '',
    coefficient: 1,
    type: 'Fondamentale' as 'Fondamentale' | 'Éveil' | 'Expression',
    obligatoire: true,
    classeIds: [] as string[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (matiere) {
      setFormData({
        nom: matiere.nom,
        coefficient: matiere.coefficient,
        type: matiere.type,
        obligatoire: matiere.obligatoire,
        classeIds: matiere.classeIds || []
      });
    }
  }, [matiere]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nom.trim()) newErrors.nom = 'Le nom de la matière est obligatoire';
    if (formData.coefficient < 1 || formData.coefficient > 10) newErrors.coefficient = 'Le coefficient doit être entre 1 et 10';

    const matieres = db.getAll<Matiere>('matieres');
    const existingMatiere = matieres.find(m => 
      m.nom.toLowerCase() === formData.nom.toLowerCase() && 
      m.id !== matiere?.id
    );
    if (existingMatiere) {
      newErrors.nom = 'Une matière avec ce nom existe déjà';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      if (matiere) {
        const updatedMatiere = db.update<Matiere>('matieres', matiere.id, formData);
        if (updatedMatiere) {
          showToast('Matière mise à jour avec succès', 'success');
          onSave(updatedMatiere);
        }
      } else {
        const newMatiere = db.create<Matiere>('matieres', formData);
        showToast('Matière ajoutée avec succès', 'success');
        onSave(newMatiere);
      }
    } catch {
      showToast('Erreur lors de la sauvegarde de la matière', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* En-tête moderne */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 p-4 rounded-xl">
                <span className="text-3xl">📚</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {matiere ? 'Modifier la matière' : 'Nouvelle matière'}
                </h1>
                <p className="text-orange-100 mt-1">
                  {matiere ? 'Modifiez les informations de la matière' : 'Créez une nouvelle matière'}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white hover:bg-opacity-20 p-3 rounded-xl transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Informations de base */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="bg-blue-100 p-2 rounded-lg mr-3">📖</span>
              Informations de base
            </h3>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Nom de la matière <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => handleInputChange('nom', e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:ring-orange-100 transition-all ${
                  errors.nom ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-orange-500'
                }`}
                placeholder="Ex: Mathématiques, Français, Sciences..."
              />
              {errors.nom && <p className="mt-2 text-sm text-red-600 flex items-center"><span className="mr-1">⚠️</span>{errors.nom}</p>}
            </div>
          </div>

          {/* Configuration avancée */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="bg-purple-100 p-2 rounded-lg mr-3">⚙️</span>
              Configuration avancée
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                