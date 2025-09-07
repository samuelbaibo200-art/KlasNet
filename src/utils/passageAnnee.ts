import { db } from './database';
import { Eleve, Classe, HistoriqueAction, Ecole } from '../types';
// try to import ensureDefaultFrais helper if present
let ensureDefaultFrais: ((annee: string) => void) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ensureDefaultFrais = require('./defaultFraisScolaires').ensureDefaultFrais;
} catch (e) {
  ensureDefaultFrais = undefined;
}

export type PassageOptions = {
  useDFA?: boolean;
  dfa?: Record<string, number>;
  seuilAdmission?: number;
  nouvelleAnnee: string;
  fallbackToReset?: boolean; // si DFA demandé mais pas de notes
  preserveEleves?: boolean; // si true, ne supprime pas les élèves, on les désaffecte
  resetFinances?: boolean; // si true, supprime/archives paiements
};

export function passageAnneeScolaire(opts: PassageOptions) {
  const {
    useDFA = false,
    dfa = {},
    seuilAdmission = 10,
    nouvelleAnnee,
    fallbackToReset = true,
    preserveEleves = true,
    resetFinances = true
  } = opts as PassageOptions;

  const eleves = db.getAll<Eleve>('eleves');
  const classes = db.getAll<Classe>('classes');
  const notes = db.getAll('notes');
  const paiements = db.getAll('paiements');

  // 1) Archive complète (JSON) et téléchargement
  const archive = {
    date: new Date().toISOString(),
    eleves,
    classes,
    notes,
    paiements,
    compositions: db.getAll('compositions'),
    fraisScolaires: db.getAll('fraisScolaires'),
    type: 'archive_pre_passage_annee'
  };
  try {
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive_pre_passage_${new Date().getFullYear()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    // environnement sans DOM (tests) : on log
    // console.warn('Impossible de proposer le téléchargement de l\'archive en environnement non DOM');
  }

  db.addHistorique({
    type: 'autre',
    cible: 'Système',
    description: `Passage d'année déclenché (${useDFA ? 'DFA' : 'Reset simple'}) vers ${nouvelleAnnee}`,
    utilisateur: 'ADMIN'
  } as Omit<HistoriqueAction, 'id' | 'date'>);

  let promoted = 0;
  let heldBack = 0;


  if (useDFA) {
    if (notes.length === 0 && !fallbackToReset) {
      throw new Error('Aucune note disponible pour calculer la DFA');
    }
    if (notes.length === 0 && fallbackToReset) {
      // fallback to reset simple
      return simpleReset();
    }

    // calculer les moyennes (dfa peut être fourni)
    const computedDfa: Record<string, number> = Object.keys(dfa).length ? dfa : (function computeDfa() {
      const map: Record<string, number> = {};
      const eleveNotes = db.getAll<any>('notes');
      const byEleve: Record<string, number[]> = {};
      eleveNotes.forEach((n) => { byEleve[n.eleveId] = byEleve[n.eleveId] || []; byEleve[n.eleveId].push(Number(n.valeur || 0)); });
      Object.keys(byEleve).forEach(id => { const arr = byEleve[id]; map[id] = Math.round((arr.reduce((s,a)=>s+a,0)/arr.length) * 100) / 100; });
      return map;
    })();

    const niveaux = ['Petite Section','Moyenne Section','Grande Section','CP1','CP2','CE1','CE2','CM1','CM2'];

  eleves.forEach(eleve => {
      const moyenne = computedDfa[eleve.id] ?? 0;
      const classeActuelle = classes.find(c => c.id === eleve.classeId);
      if (!classeActuelle) return;
      const idx = niveaux.indexOf(classeActuelle.niveau as string);
      if (moyenne >= seuilAdmission) {
        // promotion si possible
        if (idx >= 0 && idx < niveaux.length - 1) {
          const niveauSuivant = niveaux[idx + 1];
          const nouvelleClasse = classes.find(c => c.niveau === niveauSuivant && c.section === classeActuelle.section && c.anneeScolaire === nouvelleAnnee);
          if (nouvelleClasse) {
            db.update<Eleve>('eleves', eleve.id, { classeId: nouvelleClasse.id, anneeEntree: nouvelleAnnee });
            promoted++;
          }
        } else {
          // dernier niveau -> marquer Inactif
          db.update<Eleve>('eleves', eleve.id, { statut: 'Inactif' });
          promoted++;
        }
      } else {
        // redoublement -> on garde la même classe mais on peut mettre anneeEntree
  db.update<Eleve>('eleves', eleve.id, { anneeEntree: nouvelleAnnee });
        heldBack++;
      }
    });

  } else {
    // Reset simple sans DFA
    return simpleReset();
  }

  // Mettre à jour l'année scolaire des classes et ecole
  classes.forEach(classe => { db.update<Classe>('classes', classe.id, { anneeScolaire: nouvelleAnnee }); });
  const ecole = db.getAll<Ecole>('ecole')[0]; if (ecole) db.update<Ecole>('ecole', ecole.id, { anneeScolaireActive: nouvelleAnnee });

  if (resetFinances) {
    // archiver puis supprimer paiements
    // déjà archivé au début
  db.getAll('paiements').forEach((p: any) => db.delete('paiements', p.id));
  }

  return { promoted, heldBack };

  // fonction interne pour reset simple
  function simpleReset() {
    if (preserveEleves) {
      const elevesToUpdate = db.getAll<Eleve>('eleves');
      elevesToUpdate.forEach((e) => {
          db.update<Eleve>('eleves', e.id, { classeId: '', anneeEntree: nouvelleAnnee });
        });
    } else {
      // optionnel: marquer Inactif
      const elevesToUpdate = db.getAll<Eleve>('eleves');
      elevesToUpdate.forEach((e) => { db.update<Eleve>('eleves', e.id, { statut: 'Inactif' }); });
    }

    // Réinitialiser frais scolaires pour la nouvelle année
    try { if (ensureDefaultFrais) ensureDefaultFrais(nouvelleAnnee); } catch (e) { /* ignore */ }

    // Archiver et vider paiements si demandé
    if (resetFinances) db.getAll('paiements').forEach((p: any) => db.delete('paiements', p.id));

    // Mettre à jour classes et ecole
  classes.forEach(classe => { db.update<Classe>('classes', classe.id, { anneeScolaire: nouvelleAnnee }); });
  const ecoleLocal = db.getAll<Ecole>('ecole')[0]; if (ecoleLocal) db.update<Ecole>('ecole', ecoleLocal.id, { anneeScolaireActive: nouvelleAnnee });

    db.addHistorique({ type: 'autre', cible: 'Système', description: `Reset simple appliqué pour année ${nouvelleAnnee}`, utilisateur: 'ADMIN' } as Omit<HistoriqueAction, 'id' | 'date'>);

    return { promoted: 0, heldBack: 0 };
  }
}
