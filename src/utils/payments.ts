import { db } from './database';
import { Eleve, FraisScolaire, Paiement, Echeance, Allocation } from '../types';

type ScheduleItem = { echeanceId: string; date: string; montant: number; paid: number; remaining: number };

export function computeScheduleForEleve(eleveId: string): ScheduleItem[] {
  const eleve = db.getById<Eleve>('eleves', eleveId);
  if (!eleve) throw new Error('Élève introuvable');
  const classe = db.getById('classes', eleve.classeId) as { niveau?: string; anneeScolaire?: string } | null;
  const ecole = db.getAll('ecole')[0] as { anneeScolaireActive?: string } | undefined;
  const niveau = classe?.niveau as string | undefined;
  const annee = classe?.anneeScolaire || eleve.anneeEntree || ecole?.anneeScolaireActive;
  if (!niveau || !annee) return [];
  const frais = db.getAll<FraisScolaire>('fraisScolaires').find(f => f.niveau === niveau && f.anneeScolaire === annee);
  if (!frais || !(frais.echeances && frais.echeances.length)) return [];

  return (frais.echeances || []).map((e: Echeance, idx: number) => ({
    echeanceId: e.id || `${frais.niveau}-${idx + 1}`,
    date: e.date,
    montant: Number(e.montant || 0),
    paid: 0,
    remaining: Number(e.montant || 0)
  }));
}

export function processPayment(eleveId: string, amount: number, date: string, meta: Record<string, unknown> = {}) {
  const schedule = computeScheduleForEleve(eleveId);
  let reste = Math.max(0, Number(amount));
  const allocations: Allocation[] = [];

  for (const s of schedule) {
    if (reste <= 0) break;
    if (s.remaining <= 0) continue;
    const take = Math.min(s.remaining, reste);
    s.paid += take;
    s.remaining -= take;
    reste -= take;
    allocations.push({ echeanceId: s.echeanceId, montant: take });
  }

  const paiementPayload: Omit<Paiement, 'id'> & Partial<Paiement> = {
    eleveId,
    montant: amount,
    datePaiement: date,
    createdAt: new Date().toISOString(),
    allocations,
    avance: reste,
    ...meta
  };

  const paiement = db.create<Paiement>('paiements', paiementPayload as Paiement);

  if (reste > 0) {
    const creditPayload = { eleveId, montant: reste, date: new Date().toISOString(), createdAt: new Date().toISOString() };
    db.create('credits', creditPayload as any);
  }

  return { paiement, allocations, avance: reste };
}

export default { computeScheduleForEleve, processPayment };
