// Sélection des liens fournisseur d'une composition murale — logique PURE et testable.
// Ne touche NI au moteur DP (mur.ts) NI aux avertissements (doctrine.ts) : elle lit une
// composition et renvoie UN lien par caisson DISTINCT, dans l'ordre de première apparition.
// Le lien lui-même vient de liens.ts (déjà résolu au build, porté par le produit).
import type { CaissonProduct } from './types';

export interface LienModele {
  id: string;
  nom: string;
  enseigne: string;
  gamme: string;
  lien: CaissonProduct['lien'];
}

interface CompositionLike {
  rangees: { pieces: { id: string }[] }[];
}

/**
 * Un lien par modèle DISTINCT de la composition (un modèle répété n'apparaît qu'une fois),
 * dans l'ordre de première apparition. Une pile inter-gamme produit donc plusieurs liens.
 */
export function liensDistincts(
  compo: CompositionLike,
  byId: Map<string, CaissonProduct>,
): LienModele[] {
  const vus = new Set<string>();
  const out: LienModele[] = [];
  for (const r of compo.rangees) {
    for (const p of r.pieces) {
      if (vus.has(p.id)) continue;
      vus.add(p.id);
      const prod = byId.get(p.id);
      if (!prod) continue;
      out.push({
        id: prod.id,
        nom: prod.nom_produit,
        enseigne: prod.enseigne,
        gamme: prod.gamme,
        lien: prod.lien ?? null,
      });
    }
  }
  return out;
}
