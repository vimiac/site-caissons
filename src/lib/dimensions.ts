// Normalisation & validation des dimensions — LE point qui casse (§5, §13 du brief).
// Fonctions PURES, testées unitairement. Aucune dépendance framework/DOM.

export interface Triplet {
  largeur_cm: number;
  profondeur_cm: number;
  hauteur_cm: number;
}

/**
 * Coerce une valeur en nombre de cm STRICTEMENT positif, ou null si invalide.
 * Accepte number ou string ("60", "60 cm", "39,5" avec virgule décimale FR).
 */
export function toCm(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/cm|mm|"|pouces?|inches?/g, '')
      .replace(',', '.')
      .trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Parse un triplet de dimensions "L×P×H" dans l'ordre canonique.
 * Gère les séparateurs ×, x, X, *, les espaces, les décimales FR (virgule),
 * et un suffixe entre parenthèses ignoré (ex. "42×39×77 (1×2)").
 * Retourne null si on ne peut pas extraire exactement 3 cotes positives.
 */
export function parseDimensionTriplet(input: unknown): Triplet | null {
  if (typeof input !== 'string') return null;
  // Retirer un suffixe descriptif entre parenthèses (ex. grille KALLAX "(1×2)").
  const withoutSuffix = input.replace(/\([^)]*\)/g, ' ');
  // Découper sur les séparateurs de multiplication usuels.
  const parts = withoutSuffix
    .split(/[×xX*]/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length !== 3) return null;
  const largeur_cm = toCm(parts[0]);
  const profondeur_cm = toCm(parts[1]);
  const hauteur_cm = toCm(parts[2]);
  if (largeur_cm === null || profondeur_cm === null || hauteur_cm === null) return null;
  return { largeur_cm, profondeur_cm, hauteur_cm };
}

export interface RawProduct {
  [key: string]: unknown;
}

/**
 * Normalise un enregistrement brut vers le schéma canonique (ordre L×P×H, cm).
 * Ne fabrique aucune donnée : les champs absents restent absents/null.
 * Les cotes non coercibles restent null → seront rejetées par validate().
 */
export function normalizeProduct(raw: RawProduct): Record<string, unknown> {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' ? v.trim() : v == null ? undefined : String(v);
  return {
    id: str(raw.id),
    enseigne: str(raw.enseigne),
    gamme: str(raw.gamme),
    nom_produit: str(raw.nom_produit),
    type_meuble: str(raw.type_meuble),
    largeur_cm: toCm(raw.largeur_cm),
    profondeur_cm: toCm(raw.profondeur_cm),
    hauteur_cm: toCm(raw.hauteur_cm),
    hauteur_totale_cm: toCm(raw.hauteur_totale_cm),
    profondeur_hors_tout_cm: toCm(raw.profondeur_hors_tout_cm),
    montage: str(raw.montage),
    materiau: str(raw.materiau) ?? null,
    piece: Array.isArray(raw.piece) ? (raw.piece as unknown[]).map((x) => String(x)) : [],
    url_produit: str(raw.url_produit),
    source_type: str(raw.source_type),
    certitude: raw.certitude === 'incertain' ? 'incertain' : 'confirmé',
    source: str(raw.source),
    // Champs prix conservés mais vides au grain (b).
    prix: null,
    devise: null,
    date_maj_prix: null,
  };
}

/**
 * Valide un produit normalisé. Grain (1) : requis = id, gamme, cotes > 0, url_produit.
 * ⚠️ N'EXIGE PAS `reference` (piège n°1 : l'exiger mettrait les 57 lignes en quarantaine).
 * Retourne la liste des raisons ; vide = valide.
 */
export function validateProduct(p: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!p.id || typeof p.id !== 'string') errors.push('id manquant');
  if (!p.gamme || typeof p.gamme !== 'string') errors.push('gamme manquante');
  if (typeof p.largeur_cm !== 'number' || !(p.largeur_cm > 0)) errors.push('largeur_cm invalide (> 0 requis)');
  if (typeof p.profondeur_cm !== 'number' || !(p.profondeur_cm > 0)) errors.push('profondeur_cm invalide (> 0 requis)');
  if (typeof p.hauteur_cm !== 'number' || !(p.hauteur_cm > 0)) errors.push('hauteur_cm invalide (> 0 requis)');
  if (!p.url_produit || typeof p.url_produit !== 'string') errors.push('url_produit manquante');
  return errors;
}
