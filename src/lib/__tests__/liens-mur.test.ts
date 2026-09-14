import { describe, it, expect } from 'vitest';
import { liensDistincts } from '../liens-mur';
import type { CaissonProduct } from '../types';

function prod(over: Partial<CaissonProduct>): CaissonProduct {
  return {
    id: over.id ?? 'id', enseigne: over.enseigne ?? 'IKEA', gamme: over.gamme ?? 'BILLY',
    nom_produit: over.nom_produit ?? 'x', type_meuble: 'cube',
    largeur_cm: 40, profondeur_cm: 28, hauteur_cm: 106, montage: 'pose',
    url_produit: 'gamme:BILLY', certitude: 'confirmé', ...over,
  };
}

const P_A = prod({ id: 'ikea-kallax-42', enseigne: 'IKEA', gamme: 'KALLAX', nom_produit: 'KALLAX 42', lien: { href: 'https://www.ikea.com/fr/fr/search/?q=KALLAX', kind: 'recherche' } });
const P_B = prod({ id: 'muuto-stacked-654', enseigne: 'Muuto', gamme: 'Stacked', nom_produit: 'Stacked 65,4', lien: { href: 'https://www.muuto.com/search?q=Stacked', kind: 'recherche' } });
const P_HAY = prod({ id: 'hay-cc-120', enseigne: 'HAY', gamme: 'Colour Cabinet', nom_produit: 'Colour Cabinet 120', lien: { href: 'https://www.hay.com/', kind: 'site' } });

const byId = new Map<string, CaissonProduct>([P_A, P_B, P_HAY].map((p) => [p.id, p]));

describe('liensDistincts — un lien par caisson distinct de la proposition', () => {
  it('un modèle RÉPÉTÉ (même id) ne produit qu’un seul lien', () => {
    const compo = { rangees: [{ pieces: [{ id: 'ikea-kallax-42' }, { id: 'ikea-kallax-42' }, { id: 'ikea-kallax-42' }] }] };
    const res = liensDistincts(compo, byId);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('ikea-kallax-42');
    expect(res[0].lien?.href).toContain('ikea.com');
  });

  it('une pile INTER-GAMME produit un lien PAR gamme (deux liens, ordre d’apparition)', () => {
    const compo = { rangees: [{ pieces: [{ id: 'muuto-stacked-654' }] }, { pieces: [{ id: 'ikea-kallax-42' }] }] };
    const res = liensDistincts(compo, byId);
    expect(res.map((r) => r.id)).toEqual(['muuto-stacked-654', 'ikea-kallax-42']);
    expect(res[0].lien?.href).toContain('muuto.com');
    expect(res[1].lien?.href).toContain('ikea.com');
  });

  it('HAY conserve le repli site (chaîne de priorité, non recodée)', () => {
    const compo = { rangees: [{ pieces: [{ id: 'hay-cc-120' }] }] };
    const res = liensDistincts(compo, byId);
    expect(res[0].lien).toEqual({ href: 'https://www.hay.com/', kind: 'site' });
  });

  it('dédoublonne à travers les rangées (même modèle en bas et en haut → un lien)', () => {
    const compo = { rangees: [{ pieces: [{ id: 'ikea-kallax-42' }] }, { pieces: [{ id: 'ikea-kallax-42' }] }] };
    expect(liensDistincts(compo, byId)).toHaveLength(1);
  });
});
