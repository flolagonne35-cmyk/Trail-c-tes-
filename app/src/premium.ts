// Offre payante « Trail-côtes+ ». Le paiement n'est pas encore branché : il passera par les achats
// intégrés d'Apple et de Google (obligatoires pour un abonnement vendu dans une appli des stores) et
// par un paiement web pour la version en ligne. D'ici là, rien n'est payant et l'offre est annoncée.

/** Vrai quand le coureur a un abonnement actif (toujours faux tant que le paiement n'est pas branché). */
export const estPremium = (): boolean => false;

export const AVANTAGES_PREMIUM: [string, string][] = [
  ["Coach en ligne", "Une IA qui connaît ton programme répond à toutes tes questions, à toute heure."],
  ["Programme qui s'adapte", "Séance manquée, fatigue, semaine chargée : le plan se recale tout seul."],
  ["Carte hors ligne complète", "Côtes, parcours et fond de carte gardés sur ton téléphone pour la montagne."],
];
