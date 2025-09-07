import React, { useState, useEffect } from 'react';
import { db } from '../../utils/database';
import { CompositionConfig, Ecole } from '../../types';
import { FraisScolaire } from '../../types';
import ConfigBackup from './ConfigBackup';
import HistoriqueList from './HistoriqueList';
import { calculerMoyenneAnnuelle } from '../../utils/bilan';
import { X } from 'lucide-react';

export default function ConfigCompositions() {
  // Aperçu DFA avant passage d'année
  const [showDfaPreview, setShowDfaPreview] = useState(false);
  const [dfaPreview, setDfaPreview] = useState<{ eleve: import('../../types').Eleve, moyenne: number, admis: boolean }[]>([]);
  const handlePreviewDfa = () => {
    const eleves = db.getAll<import('../../types').Eleve>('eleves');
    const preview = eleves.map(eleve => {
      const moyenne = calculerMoyenneAnnuelle(eleve, anneeActive);
      return {
        eleve,
        moyenne,
        admis: moyenne >= seuilAdmission
      };
    });
    setDfaPreview(preview);
    setShowDfaPreview(true);
  };
  const handleValiderPassage = () => {
    import('../../utils/passageAnnee').then(mod => {
      const dfa = Object.fromEntries(dfaPreview.map(p => [p.eleve.id, p.moyenne]));
      mod.passageAnneeScolaire({ dfa, seuilAdmission, nouvelleAnnee: anneeInput || anneeActive });
      setShowDfaPreview(false);
      window.location.reload();
    });
  };
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear() + '-' + (new Date().getFullYear() + 1));
  const [anneeInput, setAnneeInput] = useState('');
  const niveaux = ['Petite Section', 'Moyenne Section', 'Grande Section', 'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
  // On autorise un champ echeances optionnel pour l'affichage
  const [fraisScolaires, setFraisScolaires] = useState<(FraisScolaire & { echeances?: { date: string; montant: number }[] })[]>(
    db.getAll<FraisScolaire>('fraisScolaires').map(f => ({ ...f, echeances: (f as any).echeances || [] }))
  );
  // const [editingFrais, setEditingFrais] = useState<FraisScolaire | null>(null); // supprimé car inutilisé
  const [niveauFrais, setNiveauFrais] = useState('CP1');
  const [anneeFrais, setAnneeFrais] = useState(new Date().getFullYear() + '-' + (new Date().getFullYear() + 1));
  const [montantFrais, setMontantFrais] = useState(0);
  const [echeances, setEcheances] = useState<{ date: string; montant: number }[]>([]);
  const [editingFraisId, setEditingFraisId] = useState<string | null>(null);
  const [echeanceDate, setEcheanceDate] = useState('');
  const [echeanceMontant, setEcheanceMontant] = useState(0);
  const [errorFrais, setErrorFrais] = useState('');
  const [ecole, setEcole] = useState<Ecole | null>(null);
  const [compositions, setCompositions] = useState<CompositionConfig[]>([]);
  const [editing, setEditing] = useState<CompositionConfig | null>(null);
  const [nom, setNom] = useState('');
  const [coefficient, setCoefficient] = useState(1);
  const [error, setError] = useState('');
  const [showBackup, setShowBackup] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [seuilAdmission, setSeuilAdmission] = useState(10);

  // Clôture d'année scolaire
  const handleClotureAnnee = () => {
    if (!window.confirm("Clôturer l'année ? Cette opération est irréversible. Les moyennes seront calculées, les admis promus, les autres redoublent, et les données sensibles seront archivées puis remises à zéro.")) return;
    const niveaux = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
    const eleves = db.getAll('eleves');
    const classes = db.getAll('classes');
    let nbPromus = 0, nbRedoublants = 0;
    eleves.forEach((eleve) => {
      if (eleve.statut === 'Actif') {
        const moyenne = calculerMoyenneAnnuelle(eleve, '');
        const classe = classes.find((c) => c.id === eleve.classeId);
        if (!classe) return;
        const idx = niveaux.indexOf(classe.niveau);
        if (idx >= 0 && idx < niveaux.length - 1 && moyenne >= seuilAdmission) {
          // Promotion
          const nextNiveau = niveaux[idx + 1];
          const nextClasse = classes.find((c) => c.niveau === nextNiveau && c.section === classe.section);
          if (nextClasse) {
            db.update('eleves', eleve.id, { classeId: nextClasse.id });
            nbPromus++;
          }
        } else if (idx === niveaux.length - 1 && moyenne >= seuilAdmission) {
          // Dernier niveau, admis sortant
          db.update('eleves', eleve.id, { statut: 'Inactif' });
          nbPromus++;
        } else {
          // Redoublement
          nbRedoublants++;
        }
      }
    });
    // Archivage (sauvegarde JSON)
    const archive = {
      date: new Date().toISOString(),
      eleves,
      notes: db.getAll('notes'),
      paiements: db.getAll('paiements'),
      compositions: db.getAll('compositions'),
      fraisScolaires: db.getAll('fraisScolaires'),
      type: 'archive_annuelle'
    };
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive_annee_${new Date().getFullYear()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    // Reset des données sensibles
    db.resetData();
    db.addHistorique({
      type: 'autre',
      cible: 'Élève',
      description: `Clôture d'année : ${nbPromus} promus, ${nbRedoublants} redoublants. Données archivées et réinitialisées.`,
      utilisateur: 'ADMIN',
    });
    window.location.reload();
  };

  // Passage à l'année supérieure
  const handlePassageAnnee = () => {
    if (!window.confirm("Confirmer le passage à l'année supérieure ? Cette action est irréversible.")) return;
    const niveaux = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
    const eleves = db.getAll('eleves');
    const classes = db.getAll('classes');
    let nbPromus = 0;
    eleves.forEach((eleve) => {
      if (eleve.statut === 'Actif') {
        const classe = classes.find((c) => c.id === eleve.classeId);
        if (!classe) return;
        const idx = niveaux.indexOf(classe.niveau);
        if (idx >= 0 && idx < niveaux.length - 1) {
          // Passage à la classe supérieure
          const nextNiveau = niveaux[idx + 1];
          const nextClasse = classes.find((c) => c.niveau === nextNiveau && c.section === classe.section);
          if (nextClasse) {
            db.update('eleves', eleve.id, { classeId: nextClasse.id });
            nbPromus++;
          }
        } else if (idx === niveaux.length - 1) {
          // Dernier niveau, marquer comme Inactif
          db.update('eleves', eleve.id, { statut: 'Inactif' });
        }
      }
    });
    db.addHistorique({
      type: 'autre',
      cible: 'Élève',
      description: `Passage à l'année supérieure effectué. ${nbPromus} élève(s) promu(s).`,
      utilisateur: 'ADMIN',
    });
    window.location.reload();
  };

  useEffect(() => {
    const ecoleData = db.getAll<Ecole>('ecole')[0];
    if (ecoleData) {
      setEcole(ecoleData);
      setCompositions(ecoleData.compositions || []);
      if (ecoleData.anneeScolaireActive) {
        setAnneeActive(ecoleData.anneeScolaireActive);
      }
    }
  }, []);

  // Lorsqu'on change de niveau ou d'année, préremplir le formulaire avec le frais correspondant (si présent)
  useEffect(() => {
    if (editingFraisId) return; // en mode édition manuel, ne pas écraser
    const found = fraisScolaires.find(f => f.niveau === niveauFrais && f.anneeScolaire === anneeFrais);
    if (found) {
      setMontantFrais(Number(found.fraisInscription || 0));
      setEcheances((found as any).echeances ? (found as any).echeances.map((e: any) => ({ date: e.date || '', montant: Number(e.montant || 0) })) : []);
    } else {
      setMontantFrais(0);
      setEcheances([]);
    }
  }, [niveauFrais, anneeFrais, editingFraisId, fraisScolaires]);

  // Si on est en train d'éditer une ligne, propager les changements en live vers la liste affichée
  useEffect(() => {
    if (!editingFraisId) return;
    setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, fraisInscription: montantFrais, echeances }) : f));
  }, [editingFraisId, montantFrais, echeances]);

  const handleAdd = () => {
    if (!nom.trim()) {
      setError('Le nom est obligatoire');
      return;
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Seuil d'admission :</label>
          <input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={seuilAdmission}
            onChange={e => setSeuilAdmission(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20"
          />
        </div>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 transition"
          onClick={handleClotureAnnee}
        >
          Clôturer l'année
        </button>
        <button
          className="px-4 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700 transition"
          onClick={handlePassageAnnee}
        >
          Passage à l'année supérieure
        </button>
        <button
          className="px-4 py-2 bg-teal-600 text-white rounded shadow hover:bg-teal-700 transition"
          onClick={() => setShowBackup((v) => !v)}
        >
          {showBackup ? 'Fermer la sauvegarde' : 'Sauvegarde & Restauration'}
        </button>
        <button
          className="px-4 py-2 bg-gray-700 text-white rounded shadow hover:bg-gray-800 transition"
          onClick={() => setShowHistorique((v) => !v)}
        >
          {showHistorique ? 'Fermer l\'historique' : 'Historique'}
        </button>
  </div>
  {/* Affichage conditionnel des composants */}
  {showBackup ? <ConfigBackup /> : null}
  {showHistorique ? <HistoriqueList /> : null}
    }
    if (compositions.some(c => c.nom.toLowerCase() === nom.trim().toLowerCase())) {
      setError('Ce nom existe déjà');
      return;
    }
    const newComp: CompositionConfig = {
      id: Date.now().toString(),
      nom: nom.trim(),
      coefficient: coefficient
    };
    const newList = [...compositions, newComp];
    setCompositions(newList);
    setNom('');
    setCoefficient(1);
    setError('');
    saveToDb(newList);
  };

  const handleEdit = (comp: CompositionConfig) => {
    setEditing(comp);
    setNom(comp.nom);
    setCoefficient(comp.coefficient);
    setError('');
  };

  const handleUpdate = () => {
    if (!editing) return;
    if (!nom.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    if (compositions.some(c => c.nom.toLowerCase() === nom.trim().toLowerCase() && c.id !== editing.id)) {
      setError('Ce nom existe déjà');
      return;
    }
    const newList = compositions.map(c => c.id === editing.id ? { ...c, nom, coefficient } : c);
    setCompositions(newList);
    setEditing(null);
    setNom('');
    setCoefficient(1);
    setError('');
    saveToDb(newList);
  };

  const handleDelete = (id: string) => {
    const newList = compositions.filter(c => c.id !== id);
    setCompositions(newList);
    if (editing && editing.id === id) {
      setEditing(null);
      setNom('');
      setCoefficient(1);
    }
    saveToDb(newList);
  };

  const saveToDb = (comps: CompositionConfig[]) => {
    if (!ecole) return;
    db.update<Ecole>('ecole', ecole.id, { compositions: comps });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      {/* Aperçu DFA & passage d'année */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="font-semibold">Niveau :</label>
            <select value={niveauFrais} onChange={e => setNiveauFrais(e.target.value)} className="border rounded px-2 py-1">
              {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold">Année scolaire :</label>
            <input type="text" value={anneeFrais} onChange={e => setAnneeFrais(e.target.value)} className="border rounded px-2 py-1 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold">Frais d'inscription :</label>
            <input type="number" min={0} value={montantFrais} onChange={e => {
              const v = Number(e.target.value || 0);
              setMontantFrais(v);
              if (editingFraisId) {
                setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, fraisInscription: v, echeances }) : f));
              }
            }} className="border rounded px-2 py-1 w-36" />
            <div className="ml-4">
              <label className="font-semibold">Total calculé :</label>
              <div className="text-right font-medium">{
                (() => {
                  const sumE = Array.isArray(echeances) ? echeances.reduce((s, x) => s + Number(x.montant || 0), 0) : 0;
                  return (Number(montantFrais || 0) + sumE).toLocaleString() + ' FCFA';
                })()
              }</div>
            </div>
          </div>

          {/* Liste des échéances actuelles (éditables) */}
          <div className="mt-3 mb-2">
            <div className="text-sm font-semibold mb-2">Échéances</div>
            {echeances.length === 0 ? (
              <div className="text-gray-500 text-xs">Aucune échéance. Ajoute une échéance ci‑dessous.</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-auto">
                {echeances.map((e, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="date" value={e.date || ''} onChange={ev => {
                      const newE = [...echeances];
                      newE[idx] = { ...newE[idx], date: ev.target.value };
                      setEcheances(newE);
                      if (editingFraisId) setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, echeances: newE }) : f));
                    }} className="border rounded px-2 py-1 w-40" />
                    <input type="number" min={0} value={Number(e.montant || 0)} onChange={ev => {
                      const v = Number(ev.target.value || 0);
                      const newE = [...echeances];
                      newE[idx] = { ...newE[idx], montant: v };
                      setEcheances(newE);
                      if (editingFraisId) setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, echeances: newE }) : f));
                    }} className="border rounded px-2 py-1 w-32" />
                    <button className="px-2 py-1 text-red-600" onClick={() => {
                      const newE = echeances.filter((_, i) => i !== idx);
                      setEcheances(newE);
                      if (editingFraisId) setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, echeances: newE }) : f));
                    }}>Supprimer</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold">Nouvelle échéance (date) :</label>
            <input type="date" value={echeanceDate} onChange={e => setEcheanceDate(e.target.value)} className="border rounded px-2 py-1" />
            <label className="font-semibold">Montant :</label>
            <input type="number" min={0} value={echeanceMontant} onChange={e => setEcheanceMontant(Number(e.target.value))} className="border rounded px-2 py-1 w-20" />
            <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={() => {
              if (!echeanceDate || echeanceMontant <= 0) return;
              const newE = [...echeances, { date: echeanceDate, montant: echeanceMontant }];
              setEcheances(newE);
              if (editingFraisId) setFraisScolaires(prev => prev.map(f => f.id === editingFraisId ? ({ ...f, echeances: newE }) : f));
              setEcheanceDate('');
              setEcheanceMontant(0);
            }}>Ajouter échéance</button>
          </div>
          <button className="px-4 py-2 bg-teal-600 text-white rounded shadow hover:bg-teal-700 transition" onClick={() => {
            if (!niveauFrais || !anneeFrais || montantFrais <= 0) {
              setErrorFrais('Veuillez remplir tous les champs');
              return;
            }
            const newFrais: any = {
              id: Date.now().toString(),
              niveau: niveauFrais,
              anneeScolaire: anneeFrais,
              fraisInscription: montantFrais,
              fraisScolarite: 0,
              fraisCantine: 0,
              fraisTransport: 0,
              fraisFournitures: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              echeances: echeances
            };
            setFraisScolaires([...fraisScolaires, newFrais]);
            setMontantFrais(0);
            setEcheances([]);
            setErrorFrais('');
            db.update('fraisScolaires', newFrais.id, newFrais);
          }}>Ajouter</button>
        </div>
        <div className="flex items-center space-x-4">
          <span className="font-semibold text-teal-700">{anneeActive}</span>
          <input
            type="text"
            value={anneeInput}
            onChange={e => setAnneeInput(e.target.value)}
            className="border rounded px-2 py-1 w-32"
            placeholder="Ex: 2025-2026"
          />
          <button
            className="bg-teal-600 text-white px-3 py-1 rounded"
            onClick={() => {
              if (!anneeInput.trim()) return;
              setAnneeActive(anneeInput.trim());
              setAnneeInput('');
              if (ecole) db.update<Ecole>('ecole', ecole.id, { anneeScolaireActive: anneeInput.trim() });
            }}
          >Changer</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">L'année scolaire active sera utilisée pour toutes les nouvelles saisies (élèves, classes, frais...)</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Configuration des compositions</h2>
        {/* ...composition config UI inchangé... */}
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Nom de la composition"
              className="border rounded px-2 py-1 flex-1"
              value={nom}
              onChange={e => setNom(e.target.value)}
            />
            <input
              type="number"
              min={1}
              max={10}
              className="border rounded px-2 py-1 w-24"
              value={coefficient}
              onChange={e => setCoefficient(Number(e.target.value))}
            />
            {editing ? (
              <button className="bg-teal-600 text-white px-3 py-1 rounded" onClick={handleUpdate}>Modifier</button>
            ) : (
              <button className="bg-teal-600 text-white px-3 py-1 rounded" onClick={handleAdd}>Ajouter</button>
            )}
            {editing && (
              <button className="ml-2 text-gray-400 hover:text-gray-600" onClick={() => { setEditing(null); setNom(''); setCoefficient(1); }}><X className="h-5 w-5" /></button>
            )}
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <div className="mt-6">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1">Nom</th>
                <th className="border px-2 py-1">Coefficient</th>
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {compositions.map(comp => (
                <tr key={comp.id}>
                  <td className="border px-2 py-1">{comp.nom}</td>
                  <td className="border px-2 py-1">{comp.coefficient}</td>
                  <td className="border px-2 py-1 space-x-2">
                    <button className="text-blue-600 hover:underline" onClick={() => handleEdit(comp)}>Éditer</button>
                    <button className="text-red-600 hover:underline" onClick={() => handleDelete(comp.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {compositions.length === 0 && (
                <tr><td colSpan={3} className="text-center text-gray-400 py-4">Aucune composition configurée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4">Frais scolaires par niveau</h2>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <select
              value={niveauFrais}
              onChange={e => setNiveauFrais(e.target.value)}
              className="border rounded px-2 py-1"
            >
              {niveaux.map(niv => (
                <option key={niv} value={niv}>{niv}</option>
              ))}
            </select>
            <input
              type="text"
              value={anneeFrais}
              onChange={e => setAnneeFrais(e.target.value)}
              className="border rounded px-2 py-1 w-32"
              placeholder="Année scolaire"
            />
            <input
              type="number"
              min={0}
              value={montantFrais}
              onChange={e => setMontantFrais(Number(e.target.value))}
              className="border rounded px-2 py-1 w-32"
              placeholder="Montant total (FCFA)"
            />
            <div className="flex items-center gap-2">
              <button
                className="bg-teal-600 text-white px-3 py-1 rounded"
                onClick={() => {
                  if (!niveauFrais || !anneeFrais || montantFrais < 0) {
                    setErrorFrais('Tous les champs sont obligatoires et le montant doit être >= 0');
                    return;
                  }
                  if (editingFraisId) {
                    // update existing frais
                    const exist = fraisScolaires.find(f => f.id === editingFraisId);
                    if (exist) {
                      const updated: any = {
                        ...exist,
                        niveau: niveauFrais,
                        anneeScolaire: anneeFrais,
                        fraisInscription: montantFrais,
                        echeances: echeances,
                        updatedAt: new Date().toISOString()
                      };
                      db.update('fraisScolaires', editingFraisId, updated);
                      setFraisScolaires(fraisScolaires.map(f => f.id === editingFraisId ? updated : f));
                    }
                    setEditingFraisId(null);
                  } else {
                    const exists = fraisScolaires.find(f => f.niveau === niveauFrais && f.anneeScolaire === anneeFrais);
                    if (exists) {
                      setErrorFrais('Un frais pour ce niveau et cette année existe déjà');
                      return;
                    }
                    const newFrais: any = {
                      id: Date.now().toString(),
                      niveau: niveauFrais,
                      anneeScolaire: anneeFrais,
                      fraisInscription: montantFrais,
                      fraisScolarite: 0,
                      fraisCantine: 0,
                      fraisTransport: 0,
                      fraisFournitures: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      echeances: echeances
                    };
                    db.create('fraisScolaires', newFrais);
                    setFraisScolaires([...fraisScolaires, newFrais]);
                  }
                  setMontantFrais(0);
                  setEcheances([]);
                  setErrorFrais('');
                }}
              >{editingFraisId ? 'Enregistrer' : 'Ajouter'}</button>
              {editingFraisId && (
                <button className="px-3 py-1 border rounded" onClick={() => {
                  setEditingFraisId(null);
                  setMontantFrais(0);
                  setEcheances([]);
                  setErrorFrais('');
                }}>Annuler</button>
              )}
            </div>
          </div>
          {errorFrais && <div className="text-red-500 text-sm">{errorFrais}</div>}
        </div>
        <div className="mt-6">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                  <th className="border px-2 py-1">Niveau</th>
                  <th className="border px-2 py-1">Année scolaire</th>
                  <th className="border px-2 py-1 w-32 text-right">Montant (FCFA)</th>
                  <th className="border px-2 py-1 w-64">Échéances</th>
                  <th className="border px-2 py-1 w-36">Actions</th>
                </tr>
            </thead>
            <tbody>
              {fraisScolaires.map(frais => (
                <tr key={frais.id}>
                  <td className="border px-2 py-1">{frais.niveau}</td>
                  <td className="border px-2 py-1">{frais.anneeScolaire}</td>
                  <td className="border px-2 py-1 text-right font-medium"> 
                    {(() => {
                      const sumE = Array.isArray(frais.echeances) ? frais.echeances.reduce((s: number, x: any) => s + Number(x.montant || 0), 0) : 0;
                      const ins = Number(frais.fraisInscription || 0);
                      return (ins + sumE).toLocaleString() + ' FCFA';
                    })()}
                  </td>
                  <td className="border px-2 py-1">
                    {Array.isArray(frais.echeances) && frais.echeances.length > 0 ? (
                      <div className="max-h-36 overflow-auto text-xs space-y-1 pl-3">
                        {frais.echeances.map((e, idx) => (
                          <div key={idx} className="truncate">{e.date} : {e.montant.toLocaleString ? e.montant.toLocaleString() : e.montant} FCFA</div>
                        ))}
                      </div>
                    ) : <span className="text-gray-400">Aucune</span>}
                  </td>
                  <td className="border px-2 py-1 space-x-2">
                    <button className="px-2 py-1 bg-yellow-500 text-white rounded" onClick={() => {
                      // prefill form for editing
                      setNiveauFrais(frais.niveau);
                      setAnneeFrais(frais.anneeScolaire);
                      setMontantFrais(Number(frais.fraisInscription || 0));
                      setEcheances((frais.echeances || []).map((e: any) => ({ date: e.date || '', montant: Number(e.montant || 0) })));
                      setEditingFraisId(frais.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>Éditer</button>
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => {
                      setFraisScolaires(fraisScolaires.filter(f => f.id !== frais.id));
                      db.delete('fraisScolaires', frais.id);
                      if (editingFraisId === frais.id) {
                        setEditingFraisId(null);
                        setMontantFrais(0);
                        setEcheances([]);
                      }
                    }}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {fraisScolaires.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-4">Aucun frais configuré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
