// MODULE « composition murale » — remplir un mur (L × H, profondeur ≤ Pmax) avec les
// 76 combinaisons EXISTANTES. Tourne 100 % dans le navigateur (aucune donnée nouvelle).
//
// Algorithme (tranché au G1 §2, appliqué tel quel) :
//   1) PAR RANGÉE : programmation dynamique bornée sur la largeur (style rendu-de-monnaie /
//      sac-à-dos borné), EXACTE → résidu horizontal minimal réel. O(largeur × nb largeurs).
//   2) EMPILEMENT : 2ᵉ passe qui compose les rangées (hauteurs) jusqu'à la hauteur cible.
//   Exhaustif et glouton écartés (motifs au G1).
//
// Arbitrages d'Arnaud appliqués :
//   • « remplir au mieux » = RÉSIDU HORIZONTAL MINIMAL ; départage = MOINS DE MEUBLES ;
//     TOP 3 alternatives. Hauteur = MAXIMUM à ne pas dépasser.
//   • Une rangée = une seule gamme, une seule hauteur (cohérence « même collection par ligne »).
//   • Mélanger les gammes ENTRE rangées est permis par défaut ; option `forcerGammeUnique`
//     pour imposer une gamme unique sur TOUTE la pile.
//   • Gammes non sanctionnées (KALLAX, BESTÅ, DELINIA, HAY…) AUTORISÉES quand même —
//     l'avertissement contextuel (doctrine) s'en charge, pas un blocage.
//
// L'avertissement de chaque composition est CONTEXTUEL (doctrine.ts), jamais générique.

import { classerPile, DOCTRINE, type Avertissement } from './doctrine';
import type { CaissonProduct } from './types';

// Échelle entière : cotes en millimètres pour indexer la DP (gère les décimaux Muuto 21,8 etc.).
const MM = 10;

export interface CaissonPiece {
  id: string;
  gamme: string;
  enseigne: string;
  nom: string;
  largeur: number; // cm
  hauteur: number; // cm
  profondeur: number; // cm
}

export interface ParamsMur {
  largeurCm: number; // largeur du mur (fixe)
  profondeurMaxCm: number; // profondeur maximale admise
  hauteurCm: number; // hauteur souhaitée = MAXIMUM à ne pas dépasser
  forcerGammeUnique?: boolean; // impose une gamme unique sur toute la pile
  gammeImposee?: string | null; // restreint à une gamme précise (optionnel)
  maxRangees?: number; // garde-fou de profondeur d'empilement (défaut 4)
  topN?: number; // nombre d'alternatives (défaut 3)
}

export interface PiecePosee {
  id: string;
  nom: string;
  largeur: number;
  profondeur: number;
}

export interface RangeeRemplie {
  gamme: string;
  enseigne: string;
  hauteur: number;
  largeurRemplie: number;
  residu: number;
  nbPieces: number;
  profondeurMax: number;
  pieces: PiecePosee[];
}

export interface Composition {
  rangees: RangeeRemplie[]; // bas → haut
  hauteurTotale: number;
  residuVertical: number;
  residuHorizontalTotal: number;
  nbMeubles: number;
  gammes: string[];
  avertissement: Avertissement;
}

export interface ResultatMur {
  compositions: Composition[]; // top N
  parametres: ParamsMur;
  nbBriquesEvaluees: number;
  aucuneSolution: boolean;
}

/** Convertit un produit du dataset en pièce pour le module. */
export function toPiece(p: CaissonProduct): CaissonPiece {
  return {
    id: p.id,
    gamme: p.gamme,
    enseigne: p.enseigne,
    nom: p.nom_produit,
    largeur: p.largeur_cm,
    hauteur: p.hauteur_cm,
    profondeur: p.profondeur_cm,
  };
}

/**
 * DP bornée sur la largeur : remplit `largeurMurCm` avec des pièces (largeurs discrètes,
 * répétables) en MAXIMISANT la largeur remplie ≤ mur, puis en MINIMISANT le nombre de pièces.
 * Renvoie la meilleure rangée pour un groupe HOMOGÈNE (même gamme, même hauteur).
 */
function meilleureRangee(pieces: CaissonPiece[], largeurMurCm: number): RangeeRemplie | null {
  if (pieces.length === 0) return null;
  const W = Math.round(largeurMurCm * MM);
  if (W <= 0) return null;

  // dp[w] = meilleur remplissage ≤ w. `pose` = index de pièce ajoutée pour atteindre w
  // (ou -1 = « on ne pose rien de plus qu'à w-1 » : le pas de saut garde la monotonie).
  // `prev` = capacité d'où l'on vient (reconstruction en suivant prev jusqu'à 0).
  type Cell = { rempli: number; nb: number; pose: number; prev: number };
  const dp: Cell[] = new Array(W + 1);
  dp[0] = { rempli: 0, nb: 0, pose: -1, prev: 0 };

  for (let w = 1; w <= W; w++) {
    // Option « saut » : hériter de w-1 sans poser de pièce (rempli et nb identiques).
    let best: Cell = { rempli: dp[w - 1].rempli, nb: dp[w - 1].nb, pose: -1, prev: w - 1 };
    for (let i = 0; i < pieces.length; i++) {
      const pw = Math.round(pieces[i].largeur * MM);
      if (pw <= 0 || pw > w) continue;
      const from = dp[w - pw];
      const cand: Cell = { rempli: from.rempli + pw, nb: from.nb + 1, pose: i, prev: w - pw };
      if (cand.rempli > best.rempli || (cand.rempli === best.rempli && cand.nb < best.nb)) {
        best = cand;
      }
    }
    dp[w] = best;
  }

  const final = dp[W];
  if (final.rempli <= 0) return null;

  // Reconstruction : on descend la capacité via `prev`, en n'ajoutant une pièce que si `pose` ≥ 0.
  const posees: PiecePosee[] = [];
  let w = W;
  while (w > 0) {
    const cell = dp[w];
    if (cell.pose >= 0) {
      const p = pieces[cell.pose];
      posees.push({ id: p.id, nom: p.nom, largeur: p.largeur, profondeur: p.profondeur });
    }
    if (cell.prev === w) break; // garde anti-boucle
    w = cell.prev;
  }
  posees.reverse();

  const largeurRemplie = final.rempli / MM;
  const profondeurMax = posees.reduce((m, p) => Math.max(m, p.profondeur), 0);
  return {
    gamme: pieces[0].gamme,
    enseigne: pieces[0].enseigne,
    hauteur: pieces[0].hauteur,
    largeurRemplie: Math.round(largeurRemplie * 100) / 100,
    residu: Math.round((largeurMurCm - largeurRemplie) * 100) / 100,
    nbPieces: posees.length,
    profondeurMax,
    pieces: posees,
  };
}

/** Regroupe les pièces par (gamme, hauteur) — une « brique » de rangée homogène. */
function grouperBriques(pieces: CaissonPiece[]): Map<string, CaissonPiece[]> {
  const m = new Map<string, CaissonPiece[]>();
  for (const p of pieces) {
    const k = `${p.gamme}@@${p.hauteur}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(p);
  }
  return m;
}

function signature(c: Composition): string {
  return c.rangees.map((r) => `${r.gamme}:${r.hauteur}:${r.pieces.map((p) => p.id).sort().join('+')}`).join('|');
}

/**
 * Compose un mur. Renvoie les `topN` meilleures compositions, classées par
 * résidu horizontal total croissant, puis nombre de meubles, puis hauteur remplie décroissante.
 */
export function composerMur(pieces: CaissonPiece[], params: ParamsMur): ResultatMur {
  const topN = params.topN ?? 3;
  const maxRangees = params.maxRangees ?? 4;

  // Filtre amont : profondeur ≤ Pmax, et gamme imposée éventuelle.
  const eligibles = pieces.filter(
    (p) =>
      p.profondeur <= params.profondeurMaxCm &&
      p.hauteur <= params.hauteurCm &&
      (!params.gammeImposee || p.gamme === params.gammeImposee),
  );

  // Une brique = meilleure rangée pour chaque groupe (gamme, hauteur).
  const briques: RangeeRemplie[] = [];
  for (const grp of grouperBriques(eligibles).values()) {
    const r = meilleureRangee(grp, params.largeurCm);
    if (r) briques.push(r);
  }

  if (briques.length === 0) {
    return { compositions: [], parametres: params, nbBriquesEvaluees: 0, aucuneSolution: true };
  }

  // 2ᵉ passe : empilement. On construit des piles (bas → haut) par exploration bornée :
  //   - budget de hauteur ≤ hauteurCm ; profondeur (nb rangées) ≤ maxRangees ;
  //   - imbrication géométrique : chaque rangée du dessus ≤ largeur ET ≤ profondeur de celle du dessous ;
  //   - si forcerGammeUnique : toute la pile partage la gamme de la rangée du bas.
  const compositions: Composition[] = [];

  const pushComposition = (rangees: RangeeRemplie[]) => {
    const hauteurTotale = Math.round(rangees.reduce((s, r) => s + r.hauteur, 0) * 100) / 100;
    const residuHorizontalTotal =
      Math.round(rangees.reduce((s, r) => s + r.residu, 0) * 100) / 100;
    const nbMeubles = rangees.reduce((s, r) => s + r.nbPieces, 0);
    const gammes = Array.from(new Set(rangees.map((r) => r.gamme)));
    compositions.push({
      rangees,
      hauteurTotale,
      residuVertical: Math.round((params.hauteurCm - hauteurTotale) * 100) / 100,
      residuHorizontalTotal,
      nbMeubles,
      gammes,
      avertissement: classerPile(rangees.map((r) => ({ gamme: r.gamme, hauteur: r.hauteur }))),
    });
  };

  const explorer = (pile: RangeeRemplie[], hauteurCumul: number) => {
    if (pile.length >= 1) pushComposition([...pile]);
    if (pile.length >= maxRangees) return;
    const bas = pile[pile.length - 1];
    for (const b of briques) {
      if (hauteurCumul + b.hauteur > params.hauteurCm) continue;
      if (bas) {
        // Imbrication : le dessus ne déborde ni en largeur ni en profondeur du dessous.
        if (b.largeurRemplie > bas.largeurRemplie + 1e-9) continue;
        if (b.profondeurMax > bas.profondeurMax + 1e-9) continue;
        if (params.forcerGammeUnique && b.gamme !== bas.gamme) continue;
      }
      explorer([...pile, b], Math.round((hauteurCumul + b.hauteur) * 100) / 100);
    }
  };
  explorer([], 0);

  // Classement : résidu horizontal ↑, nb meubles ↑, hauteur remplie ↓, signature (déterministe).
  compositions.sort((a, b) => {
    if (a.residuHorizontalTotal !== b.residuHorizontalTotal)
      return a.residuHorizontalTotal - b.residuHorizontalTotal;
    if (a.nbMeubles !== b.nbMeubles) return a.nbMeubles - b.nbMeubles;
    if (a.hauteurTotale !== b.hauteurTotale) return b.hauteurTotale - a.hauteurTotale;
    return signature(a).localeCompare(signature(b));
  });

  // Dédoublonnage + top N.
  const vues = new Set<string>();
  const top: Composition[] = [];
  for (const c of compositions) {
    const s = signature(c);
    if (vues.has(s)) continue;
    vues.add(s);
    top.push(c);
    if (top.length >= topN) break;
  }

  return {
    compositions: top,
    parametres: params,
    nbBriquesEvaluees: briques.length,
    aucuneSolution: top.length === 0,
  };
}

export { DOCTRINE };
