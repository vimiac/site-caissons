import { describe, it, expect } from 'vitest';
import { composerMur, toPiece, type CaissonPiece } from '../mur';
import { buildDataset } from '../dataset';

const ds = buildDataset();
const PIECES = ds.confirmes.map(toPiece);

function piece(over: Partial<CaissonPiece>): CaissonPiece {
  return {
    id: over.id ?? 'x', gamme: over.gamme ?? 'G', enseigne: over.enseigne ?? 'E',
    nom: over.nom ?? 'n', largeur: over.largeur ?? 40, hauteur: over.hauteur ?? 40,
    profondeur: over.profondeur ?? 35, ...over,
  };
}

describe('DP par rangée — résidu minimal exact + moins de pièces + décimaux', () => {
  it('remplit exactement quand c’est possible (résidu 0)', () => {
    const r = composerMur([piece({ gamme: 'A', largeur: 60, hauteur: 40 })], { largeurCm: 240, profondeurMaxCm: 60, hauteurCm: 40 });
    expect(r.aucuneSolution).toBe(false);
    expect(r.compositions[0].residuHorizontalTotal).toBe(0);
    expect(r.compositions[0].rangees[0].nbPieces).toBe(4); // 4×60 = 240
  });

  it('choisit la solution à MOINS de meubles à remplissage égal', () => {
    // largeurs 40 et 80, mur 240 : 3×80 (3 pièces) préféré à 6×40 (6 pièces).
    const pcs = [piece({ gamme: 'A', largeur: 40, hauteur: 50 }), piece({ id: 'y', gamme: 'A', largeur: 80, hauteur: 50 })];
    const r = composerMur(pcs, { largeurCm: 240, profondeurMaxCm: 60, hauteurCm: 50 });
    expect(r.compositions[0].residuHorizontalTotal).toBe(0);
    expect(r.compositions[0].rangees[0].nbPieces).toBe(3);
  });

  it('gère les largeurs décimales (Muuto 21,8 / 43,6 / 65,4) sans arrondi', () => {
    // Mur 100 cm, Muuto uniquement : max ≤ 100 = 87,2 (65,4 + 21,8), résidu 12,8.
    const r = composerMur(PIECES, { largeurCm: 100, profondeurMaxCm: 36, hauteurCm: 50, gammeImposee: 'Stacked' });
    expect(r.aucuneSolution).toBe(false);
    expect(r.compositions[0].rangees[0].largeurRemplie).toBeCloseTo(87.2, 5);
    expect(r.compositions[0].residuHorizontalTotal).toBeCloseTo(12.8, 5);
  });
});

describe('composerMur — objectifs et contraintes (arbitrages d’Arnaud)', () => {
  it('un mur où rien ne tombe juste renvoie quand même le meilleur effort (résidu > 0)', () => {
    const r = composerMur(PIECES, { largeurCm: 100, profondeurMaxCm: 36, hauteurCm: 50, gammeImposee: 'Stacked' });
    expect(r.aucuneSolution).toBe(false);
    expect(r.compositions[0].residuHorizontalTotal).toBeGreaterThan(0);
  });

  it('respecte la hauteur MAXIMUM (aucune pile ne dépasse la hauteur souhaitée)', () => {
    const r = composerMur(PIECES, { largeurCm: 300, profondeurMaxCm: 60, hauteurCm: 160 });
    for (const c of r.compositions) expect(c.hauteurTotale).toBeLessThanOrEqual(160);
  });

  it('respecte la profondeur MAX (filtre strict amont)', () => {
    const r = composerMur(PIECES, { largeurCm: 300, profondeurMaxCm: 30, hauteurCm: 200 });
    for (const c of r.compositions)
      for (const row of c.rangees) expect(row.profondeurMax).toBeLessThanOrEqual(30);
  });

  it('renvoie au plus 3 alternatives (top 3) par défaut', () => {
    const r = composerMur(PIECES, { largeurCm: 300, profondeurMaxCm: 60, hauteurCm: 220 });
    expect(r.compositions.length).toBeLessThanOrEqual(3);
  });

  it('aucuneSolution quand aucune pièce ne passe le filtre profondeur', () => {
    const r = composerMur(PIECES, { largeurCm: 300, profondeurMaxCm: 10, hauteurCm: 200 });
    expect(r.aucuneSolution).toBe(true);
    expect(r.compositions.length).toBe(0);
  });
});

describe('option « forcer une gamme unique verticalement »', () => {
  it('SANS l’option, une pile inter-gamme est possible', () => {
    const r = composerMur(PIECES, { largeurCm: 100, profondeurMaxCm: 36, hauteurCm: 130, topN: 20 });
    const aInterGamme = r.compositions.some((c) => c.gammes.length > 1);
    expect(aInterGamme).toBe(true);
  });

  it('AVEC l’option, TOUTES les piles sont monogammes', () => {
    const r = composerMur(PIECES, { largeurCm: 100, profondeurMaxCm: 36, hauteurCm: 130, topN: 20, forcerGammeUnique: true });
    for (const c of r.compositions) expect(c.gammes.length).toBe(1);
  });
});

describe('avertissement contextuel porté par chaque composition', () => {
  it('pile EKET (sanctionnée) → pas de badge ; pile KALLAX empilée → badge', () => {
    const eket = composerMur(PIECES, { largeurCm: 140, profondeurMaxCm: 40, hauteurCm: 110, gammeImposee: 'EKET', topN: 20 });
    const pileEket = eket.compositions.find((c) => c.rangees.length >= 2);
    expect(pileEket?.avertissement.regime).toBe('sanctionné');
    expect(pileEket?.avertissement.contextuel).toBe(false);

    const kallax = composerMur(PIECES, { largeurCm: 300, profondeurMaxCm: 40, hauteurCm: 160, gammeImposee: 'KALLAX', forcerGammeUnique: true, topN: 20 });
    const pileKallax = kallax.compositions.find((c) => c.rangees.length >= 2);
    expect(pileKallax?.avertissement.regime).toBe('non-documenté');
    expect(pileKallax?.avertissement.contextuel).toBe(true);
  });
});
