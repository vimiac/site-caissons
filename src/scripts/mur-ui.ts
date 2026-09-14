// UI du module « composition murale » — 100 % navigateur, sur le dataset embarqué.
// Lit les 76 combinaisons confirmées, appelle composerMur, rend les 3 meilleures piles
// avec un avertissement CONTEXTUEL porté par chaque combinaison (jamais un pied de page).
// Aucune image, aucune requête réseau.
import { composerMur, toPiece, type ParamsMur, type Composition } from '../lib/mur';
import { liensDistincts } from '../lib/liens-mur';
import type { CaissonProduct } from '../lib/types';

const dataEl = document.getElementById('dataset-json');
const form = document.getElementById('mur-form') as HTMLFormElement | null;
const out = document.getElementById('mur-results');
if (dataEl && form && out) {
  const payload = JSON.parse(dataEl.textContent || '{}') as { produits: CaissonProduct[] };
  const PIECES = payload.produits.filter((p) => p.certitude === 'confirmé').map(toPiece);
  // Index id → produit : on réutilise le lien DÉJÀ résolu au build par liens.ts / marque-recherche.json
  // (mêmes paramètres constatés « verifie_2026_09_14 »). Aucune duplication de logique de lien.
  const byId = new Map(payload.produits.map((p) => [p.id, p]));

  const val = (id: string) => Number((document.getElementById(id) as HTMLInputElement)?.value);
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  // Lien fournisseur d'un modèle, exactement comme le tableau de résultats : chaîne de priorité
  // recherche préremplie > gamme > site > rien. rel="noopener nofollow", aucune requête au chargement.
  function lienModele(p: CaissonProduct): string {
    const l = p.lien;
    if (!l) return `<span class="lien-gamme disabled">Lien indisponible</span>`;
    const label =
      l.kind === 'recherche'
        ? `Rechercher sur ${esc(p.enseigne)} ↗`
        : l.kind === 'gamme'
          ? `Voir la gamme ${esc(p.gamme)} ↗`
          : `Voir sur ${esc(p.enseigne)} ↗`;
    return `<a class="lien-gamme" href="${esc(l.href)}" target="_blank" rel="noopener nofollow">${label}</a>`;
  }

  // Un lien par caisson DISTINCT de la proposition (dédoublonnage pur dans liens-mur.ts).
  function liensProposition(c: Composition): string {
    const items = liensDistincts(c, byId).map(
      (m) => `<li><span class="mur-lien-nom">${esc(m.nom)}</span> ${lienModele(byId.get(m.id)!)}</li>`,
    );
    if (items.length === 0) return '';
    return `<div class="mur-liens"><span class="mur-liens-tete">Chez la marque :</span><ul>${items.join('')}</ul></div>`;
  }

  // Une barre CSS (pas d'image) qui montre le taux de remplissage horizontal d'une rangée.
  function barre(largeurMur: number, rempli: number): string {
    const pct = Math.max(0, Math.min(100, (rempli / largeurMur) * 100));
    return `<span class="mur-bar" aria-hidden="true"><span class="mur-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>`;
  }

  function badge(c: Composition): string {
    const a = c.avertissement;
    if (!a.contextuel) {
      // Combinaison sanctionnée ou rangée simple : message neutre, pas d'alerte visible forte.
      return `<p class="mur-note mur-note-ok">${esc(a.message)}</p>`;
    }
    const cls = a.niveau === 'fort' ? 'mur-note-fort' : 'mur-note-attention';
    const detail = a.detailLimites ? ` <span class="mur-limites">(${esc(a.detailLimites)})</span>` : '';
    return `<p class="mur-note ${cls}" role="note">⚠️ ${esc(a.message)}${detail}</p>`;
  }

  function rendre(res: ReturnType<typeof composerMur>, largeurMur: number): string {
    if (res.aucuneSolution) {
      return `<p class="mur-vide">Aucune combinaison ne tient dans ces contraintes. Élargissez la profondeur ou la hauteur, ou réduisez la largeur du mur.</p>`;
    }
    return res.compositions
      .map((c, i) => {
        const rangs = c.rangees
          .slice()
          .reverse() // affichage haut → bas
          .map((r) => {
            const items = r.pieces.map((p) => `${esc(p.nom)}`).join(' + ');
            return `<div class="mur-rangee">
              <div class="mur-rangee-tete"><strong>${esc(r.gamme)}</strong> · h ${r.hauteur} cm · rempli ${r.largeurRemplie}/${largeurMur} cm (résidu ${r.residu} cm)</div>
              ${barre(largeurMur, r.largeurRemplie)}
              <div class="mur-pieces">${items}</div>
            </div>`;
          })
          .join('');
        return `<article class="mur-compo">
          <header class="mur-compo-head">
            <h3>Proposition ${i + 1}</h3>
            <span class="mur-stats">${c.rangees.length} rangée(s) · ${c.nbMeubles} meuble(s) · hauteur ${c.hauteurTotale} cm · résidu horizontal ${c.residuHorizontalTotal} cm</span>
          </header>
          ${rangs}
          ${liensProposition(c)}
          ${badge(c)}
        </article>`;
      })
      .join('');
  }

  function composer() {
    const gammeSel = (document.getElementById('mur-gamme') as HTMLSelectElement)?.value || '';
    const params: ParamsMur = {
      largeurCm: val('mur-largeur'),
      profondeurMaxCm: val('mur-profondeur'),
      hauteurCm: val('mur-hauteur'),
      forcerGammeUnique: (document.getElementById('mur-force') as HTMLInputElement)?.checked,
      gammeImposee: gammeSel || null,
    };
    if (!(params.largeurCm > 0) || !(params.hauteurCm > 0) || !(params.profondeurMaxCm > 0)) {
      out!.innerHTML = `<p class="mur-vide">Renseignez largeur, profondeur max et hauteur (valeurs &gt; 0).</p>`;
      return;
    }
    const t0 = performance.now();
    const res = composerMur(PIECES, params);
    const dt = performance.now() - t0;
    out!.dataset.ms = dt.toFixed(2);
    out!.innerHTML = rendre(res, params.largeurCm);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    composer();
  });
}
