// DOCTRINE D'EMPILEMENT par gamme — COUCHE DE MÉTADONNÉES (pas des données produit).
// Source : G1_Module-composition-murale_2026-09-14.md §1 (recherche à la source, 2026-09-14).
// ⚠️ Ces faits de SANCTION FABRICANT sont recopiés du G1, PAS réinventés ici.
//
// Rôle : permettre un avertissement CONTEXTUEL (exigence non négociable de god) — une
// combinaison qui empile deux gammes différentes OU une gamme non sanctionnée porte SUR
// ELLE-MÊME une marque disant que le fabricant ne prévoit pas cet empilement ; une
// combinaison entièrement sanctionnée (dans ses limites) ne porte pas le même message.
//
// Le module énonce un FAIT GÉOMÉTRIQUE (« ces caissons tiennent dans un mur L×H×P »),
// JAMAIS un montage. La fixation murale / anti-basculement est TOUJOURS renvoyée au
// fabricant (IKEA : « Secure it! » requis partout).

export type SanctionEmpilement = 'sanctionné' | 'non-documenté';

export interface DoctrineGamme {
  gamme: string;
  enseigne: string;
  /** Le fabricant documente-t-il l'empilement DANS la gamme (within-range) ? */
  sanction: SanctionEmpilement;
  /** Limite de hauteur totale de pile documentée (cm), ou null si non chiffrée. */
  maxHauteurPileCm?: number | null;
  /** Limite de nombre de modules empilés documentée, ou null. */
  maxModulesPile?: number | null;
  /** Seuil au-delà duquel un rail/renfort est exigé par le fabricant (cm), ou null. */
  seuilRailCm?: number | null;
  /** Limites documentées, texte affiché tel quel. */
  limites: string;
  /** Rappel fixation murale / anti-basculement (renvoi fabricant). */
  fixation: string;
}

// Clés = valeur EXACTE du champ `gamme` du dataset (les 11 gammes des 76 combinaisons).
export const DOCTRINE: Record<string, DoctrineGamme> = {
  EKET: {
    gamme: 'EKET', enseigne: 'IKEA', sanction: 'sanctionné',
    limites: 'Empilement au sol uniquement, avec la quincaillerie de liaison EKET.',
    fixation: 'Rails EKET requis ; fixation murale « Secure it! » requise.',
  },
  PLATSA: {
    gamme: 'PLATSA', enseigne: 'IKEA', sanction: 'sanctionné', seuilRailCm: 300,
    limites: 'Empilement par clips + pins ; au-delà de 3 m, rail LÄTTHET obligatoire.',
    fixation: 'Fixation murale requise (« Secure it! »).',
  },
  BILLY: {
    gamme: 'BILLY', enseigne: 'IKEA', sanction: 'sanctionné',
    limites: 'Extension verticale prévue via le surmeuble BILLY dédié (height-extension unit).',
    fixation: 'Risque de basculement : fixation murale obligatoire.',
  },
  Atomia: {
    gamme: 'Atomia', enseigne: 'Castorama', sanction: 'sanctionné',
    limites: 'Caissons conçus pour être empilés (grille 37,5 cm) ; supports et gabarit fournis.',
    fixation: 'Supports fournis pour assurer la stabilité ; fixation recommandée.',
  },
  Stacked: {
    gamme: 'Stacked', enseigne: 'Muuto', sanction: 'sanctionné',
    maxHauteurPileCm: 285, maxModulesPile: 6,
    limites: 'Système d’empilement : max 6 modules / 285 cm ; 25 kg par module ; clips obligatoires.',
    fixation: 'Clips obligatoires ; en mural, modules à dos seulement.',
  },
  KALLAX: {
    gamme: 'KALLAX', enseigne: 'IKEA', sanction: 'non-documenté',
    limites: 'Aucun empilement officiellement documenté ; ne doit pas être suspendu au mur.',
    fixation: 'Anti-basculement requis au sol.',
  },
  'BESTÅ': {
    gamme: 'BESTÅ', enseigne: 'IKEA', sanction: 'non-documenté',
    limites: 'Empilement caisson-sur-caisson non documenté par IKEA.',
    fixation: 'Fixation murale requise (« Secure it! »).',
  },
  DELINIA: {
    gamme: 'DELINIA', enseigne: 'Leroy Merlin', sanction: 'non-documenté',
    limites: 'Bas sur pieds / hauts muraux séparés ; empilement base-sur-base non prévu.',
    fixation: 'Anti-basculement standard fourni.',
  },
  'Colour Cabinet': {
    gamme: 'Colour Cabinet', enseigne: 'HAY', sanction: 'non-documenté',
    limites: 'Meubles autonomes ; empilement non prévu par le fabricant.',
    fixation: 'Anti-basculement à la charge du client.',
  },
  METOD: {
    gamme: 'METOD', enseigne: 'IKEA', sanction: 'non-documenté',
    limites: 'Système base / suspendu : pas d’empilement caisson-sur-caisson prévu.',
    fixation: 'Rail METOD requis.',
  },
  PAX: {
    gamme: 'PAX', enseigne: 'IKEA', sanction: 'non-documenté',
    limites: 'Cadres pleine hauteur : l’empilement ne s’applique pas.',
    fixation: 'Anti-basculement OBLIGATOIRE (fourni).',
  },
};

/** Régime d'une pile, du plus sûr au plus risqué. */
export type RegimePile =
  | 'aucun-empilement' // une seule rangée : pas d'empilement
  | 'sanctionné' // pile monogamme, gamme sanctionnée, dans les limites documentées
  | 'hors-limites' // pile monogamme sanctionnée MAIS au-delà des limites documentées
  | 'non-documenté' // pile monogamme d'une gamme non sanctionnée
  | 'inter-gamme'; // pile mélangeant des gammes différentes (personne ne sanctionne)

export type NiveauAvertissement = 'ok' | 'attention' | 'fort';

export interface Avertissement {
  regime: RegimePile;
  /** true => l'avertissement se porte SUR la combinaison (badge), pas en pied de page. */
  contextuel: boolean;
  niveau: NiveauAvertissement;
  message: string;
  /** Limites documentées de la gamme concernée (pour les régimes monogamme). */
  detailLimites?: string;
}

export interface RangeePourDoctrine {
  gamme: string;
  hauteur: number;
}

const FAIT_GEOMETRIQUE =
  'Ajustement dimensionnel : ces caissons tiennent dans l’espace. Ce n’est pas une recommandation de montage.';

/**
 * Classe une pile (rangées, bas → haut) selon la doctrine et renvoie l'avertissement
 * CONTEXTUEL. Aucune donnée réinventée : uniquement la sanction/limites du G1 (DOCTRINE).
 */
export function classerPile(rangees: RangeePourDoctrine[]): Avertissement {
  if (rangees.length <= 1) {
    return {
      regime: 'aucun-empilement',
      contextuel: false,
      niveau: 'ok',
      message: 'Une seule rangée : pas d’empilement.',
    };
  }

  const gammes = Array.from(new Set(rangees.map((r) => r.gamme)));

  if (gammes.length > 1) {
    return {
      regime: 'inter-gamme',
      contextuel: true,
      niveau: 'fort',
      message:
        'Empile des gammes différentes : aucun fabricant ne prévoit cet assemblage. ' +
        FAIT_GEOMETRIQUE,
    };
  }

  const g = gammes[0];
  const d = DOCTRINE[g];

  // Gamme inconnue de la doctrine : prudence maximale (traitée comme non documentée).
  if (!d || d.sanction === 'non-documenté') {
    return {
      regime: 'non-documenté',
      contextuel: true,
      niveau: 'attention',
      message:
        'Le fabricant ne prévoit pas l’empilement de cette gamme. ' + FAIT_GEOMETRIQUE,
      detailLimites: d?.limites,
    };
  }

  // Gamme sanctionnée : vérifier les limites documentées (« dans leurs limites »).
  const hauteurTotale = rangees.reduce((s, r) => s + r.hauteur, 0);
  const nbModules = rangees.length;
  const depasseHauteur = d.maxHauteurPileCm != null && hauteurTotale > d.maxHauteurPileCm;
  const depasseModules = d.maxModulesPile != null && nbModules > d.maxModulesPile;

  if (depasseHauteur || depasseModules) {
    return {
      regime: 'hors-limites',
      contextuel: true,
      niveau: 'attention',
      message:
        'Empilement prévu par le fabricant, mais AU-DELÀ des limites documentées. ' +
        FAIT_GEOMETRIQUE,
      detailLimites: d.limites,
    };
  }

  return {
    regime: 'sanctionné',
    contextuel: false,
    niveau: 'ok',
    message: 'Empilement prévu par le fabricant, dans ses limites documentées.',
    detailLimites: d.limites,
  };
}
