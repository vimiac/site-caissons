import { describe, it, expect } from 'vitest';
import { filterProducts, sortProducts } from '../filter';
import type { CaissonProduct } from '../types';

function make(over: Partial<CaissonProduct>): CaissonProduct {
  return {
    id: over.id ?? 'id',
    enseigne: 'IKEA',
    gamme: over.gamme ?? 'BILLY',
    nom_produit: over.nom_produit ?? 'BILLY 80×28×202',
    type_meuble: over.type_meuble ?? 'bibliotheque',
    largeur_cm: over.largeur_cm ?? 80,
    profondeur_cm: over.profondeur_cm ?? 28,
    hauteur_cm: over.hauteur_cm ?? 202,
    montage: over.montage ?? 'pose',
    materiau: over.materiau ?? 'mélaminé',
    piece: over.piece ?? ['multi'],
    url_produit: 'gamme:BILLY',
    url_gamme_resolue: null,
    certitude: over.certitude ?? 'confirmé',
    ...over,
  };
}

const sample: CaissonProduct[] = [
  make({ id: 'a', gamme: 'BILLY', largeur_cm: 80, profondeur_cm: 28, hauteur_cm: 202, piece: ['multi'] }),
  make({ id: 'b', gamme: 'METOD', largeur_cm: 60, profondeur_cm: 60, hauteur_cm: 80, type_meuble: 'bas', piece: ['cuisine'], nom_produit: 'METOD 60×60×80' }),
  make({ id: 'c', gamme: 'PAX', largeur_cm: 100, profondeur_cm: 58, hauteur_cm: 236, type_meuble: 'dressing', piece: ['chambre'], nom_produit: 'PAX 100×58×236' }),
  make({ id: 'd', gamme: 'BILLY', largeur_cm: 60, profondeur_cm: 28, hauteur_cm: 202, certitude: 'incertain', nom_produit: 'BILLY 60×28×202' }),
];

describe('filterProducts — règle certitude', () => {
  it('exclut les incertains par défaut', () => {
    const r = filterProducts(sample, {});
    expect(r.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
  });
  it('inclut les incertains seulement si inclureIncertains=true', () => {
    const r = filterProducts(sample, { inclureIncertains: true });
    expect(r.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('filterProducts — dimensions', () => {
  it('filtre par plage de profondeur (contrainte de mur)', () => {
    const r = filterProducts(sample, { pMin: 35, pMax: 40 });
    expect(r.map((p) => p.id)).toEqual([]); // 28 et 58/60 hors [35,40]
  });
  it('filtre par plage de largeur', () => {
    const r = filterProducts(sample, { lMin: 60, lMax: 80 });
    expect(r.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
  it('combine dimensions + gamme', () => {
    const r = filterProducts(sample, { lMin: 50, lMax: 120, gammes: ['PAX'] });
    expect(r.map((p) => p.id)).toEqual(['c']);
  });
});

describe('filterProducts — facettes & texte', () => {
  it('filtre par pièce (multi-select, intersection)', () => {
    const r = filterProducts(sample, { pieces: ['cuisine'] });
    expect(r.map((p) => p.id)).toEqual(['b']);
  });
  it('filtre par type de meuble', () => {
    const r = filterProducts(sample, { types: ['dressing'] });
    expect(r.map((p) => p.id)).toEqual(['c']);
  });
  it('recherche texte sur nom/gamme insensible à la casse', () => {
    expect(filterProducts(sample, { q: 'pax' }).map((p) => p.id)).toEqual(['c']);
    expect(filterProducts(sample, { q: 'BILLY' }).map((p) => p.id)).toEqual(['a']);
  });
});

describe('sortProducts', () => {
  it('trie par hauteur ascendante', () => {
    const r = sortProducts(sample, 'hauteur_cm', 'asc');
    expect(r.map((p) => p.hauteur_cm)).toEqual([80, 202, 202, 236]);
  });
  it('trie par largeur descendante', () => {
    const r = sortProducts(sample, 'largeur_cm', 'desc');
    expect(r.map((p) => p.largeur_cm)).toEqual([100, 80, 60, 60]);
  });
  it('trie par nom (fr)', () => {
    const r = sortProducts(sample, 'nom', 'asc');
    expect(r[0].gamme).toBe('BILLY');
  });
});

describe('filtre par marque (enseigne) + cotes décimales', () => {
  const multi = [
    make({ id: 'ik', enseigne: 'IKEA', gamme: 'BILLY', largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106 }),
    make({ id: 'ca', enseigne: 'Castorama', gamme: 'Atomia', largeur_cm: 75, profondeur_cm: 35, hauteur_cm: 187.5 }),
    make({ id: 'mu', enseigne: 'Muuto', gamme: 'Stacked', largeur_cm: 21.8, profondeur_cm: 35, hauteur_cm: 43.6 }),
  ];

  it('filtre sur une marque', () => {
    expect(filterProducts(multi, { enseignes: ['Muuto'] }).map((p) => p.id)).toEqual(['mu']);
    expect(filterProducts(multi, { enseignes: ['IKEA', 'Castorama'] }).map((p) => p.id).sort()).toEqual(['ca', 'ik']);
  });

  it('les cotes en ,5 / ,x passent les filtres SANS arrondi', () => {
    // borne haute décimale : 187.5 inclus quand hMax >= 187.5, exclu à 187.4
    expect(filterProducts(multi, { hMax: 187.5 }).map((p) => p.id).sort()).toEqual(['ca', 'ik', 'mu']);
    expect(filterProducts(multi, { hMax: 187.4 }).map((p) => p.id).sort()).toEqual(['ik', 'mu']);
    // largeur décimale 21.8 : incluse à lMin 21.8, exclue à 21.9
    expect(filterProducts(multi, { lMin: 21.8 }).map((p) => p.id).sort()).toEqual(['ca', 'ik', 'mu']);
    expect(filterProducts(multi, { lMin: 21.9 }).map((p) => p.id).sort()).toEqual(['ca', 'ik']);
    // hauteur décimale 43.6 exactement
    expect(filterProducts(multi, { hMin: 43.6, hMax: 43.6 }).map((p) => p.id)).toEqual(['mu']);
  });
});
