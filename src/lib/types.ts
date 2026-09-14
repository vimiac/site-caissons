// Types partagés (build + client). Sous-ensemble du schéma §4 du brief, grain (1) : pas de `reference`.

export type Certitude = 'confirmé' | 'incertain';

/** Produit canonique, ordre des cotes L × P × H, structure nue, en cm. */
export interface CaissonProduct {
  id: string;
  enseigne: string;
  gamme: string;
  nom_produit: string;
  type_meuble: string;
  largeur_cm: number;
  profondeur_cm: number;
  hauteur_cm: number;
  hauteur_totale_cm?: number | null;
  profondeur_hors_tout_cm?: number | null;
  montage: string;
  materiau?: string | null;
  piece?: string[];
  url_produit: string; // placeholder "gamme:<GAMME>" en entrée ; résolu au build
  url_gamme_resolue?: string | null; // URL publique de la page de gamme, ou null (lien désactivé)
  // Lien sortant final résolu au build : recherche préremplie > gamme explicite > site générique.
  lien?: { href: string; kind: 'recherche' | 'gamme' | 'site' } | null;
  source_type?: string;
  certitude: Certitude;
  source?: string;
  // Champs conservés du schéma mais VIDES au grain (b) — prix hors périmètre :
  prix?: number | null;
  devise?: string | null;
  date_maj_prix?: string | null;
}

/** Ligne mise en quarantaine au build (jamais rejetée silencieusement). */
export interface QuarantineEntry {
  id: string;
  raison: string;
  champ?: string;
  valeur?: unknown;
}

/** Bornes de sliders calculées au build à partir des données (jamais en dur). */
export interface DimensionBounds {
  largeur_cm: { min: number; max: number };
  profondeur_cm: { min: number; max: number };
  hauteur_cm: { min: number; max: number };
}

export interface Dataset {
  confirmes: CaissonProduct[];
  incertains: CaissonProduct[];
  quarantaine: QuarantineEntry[];
  bounds: DimensionBounds; // calculées sur confirmés ∪ incertains (pour couvrir les 2 modes)
  gammes: string[];
  enseignes: string[];
  types_meuble: string[];
  pieces: string[];
  montages: string[];
  materiaux: string[];
}

/** Critères de filtrage appliqués côté client. */
export interface FilterCriteria {
  lMin?: number;
  lMax?: number;
  pMin?: number;
  pMax?: number;
  hMin?: number;
  hMax?: number;
  gammes?: string[];
  types?: string[];
  pieces?: string[];
  montages?: string[];
  materiaux?: string[];
  q?: string; // recherche texte (nom, gamme)
  inclureIncertains?: boolean;
}

export type SortKey = 'nom' | 'largeur_cm' | 'profondeur_cm' | 'hauteur_cm';
export type SortDir = 'asc' | 'desc';
