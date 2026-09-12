# Comparateur de caissons par dimensions — MVP (cotes sans prix)

Site **100 % statique** (Astro, aucun backend, aucune base) qui répond à **une** question :
« **existe-t-il un caisson (meuble de rangement) qui tient dans mes contraintes de largeur,
profondeur et hauteur ?** ». C'est un **filtre de faisabilité**, pas un catalogue.

Le filtrage, le tri et le comparateur tournent **entièrement dans le navigateur** sur un jeu de
données JSON versionné dans le dépôt. Aucune donnée ne quitte le poste du visiteur, aucun pistage.

> Spécification de référence : `G1_Comparateur-caissons_MVP-cotes_2026-09-13.md` (périmètre « b » :
> **le prix est hors périmètre**). Brief : `BRIEF-comparateur-caissons.md`.

---

## Démarrage

```bash
npm install          # (dépendances : astro, typescript, vitest)
npm run dev          # serveur de dev
npm run build        # génère le site statique dans dist/
npm run preview      # sert dist/ localement
npm test             # tests unitaires (normalisation/validation des dimensions)
```

> **Note d'environnement** : la première exécution d'`astro` tente d'écrire un fichier de
> télémétrie dans le dossier de préférences de l'OS. Si votre environnement l'interdit (bac à
> sable), lancez `astro telemetry disable` **ou** exportez `ASTRO_TELEMETRY_DISABLED=1`. C'est un
> réglage d'outillage, sans effet sur le site produit.

Rien n'est déployé par ce dépôt. Le déploiement (hôte statique : Cloudflare Pages / Vercel selon
arbitrage) appartient à Arnaud.

---

## Ce que fait le site (critères d'acceptation)

| # | Critère | Où |
|---|---|---|
| 1 | 3 doubles-sliders L / P / H, pas de 1 cm, **bornes calculées depuis les données** | `src/pages/index.astro` (bornes via `buildDataset`), `src/scripts/app.ts` |
| 2 | Filtres gamme / type / pièce / montage / matériau + **recherche texte** (nom, gamme) | `src/scripts/app.ts`, `src/lib/filter.ts` |
| 3 | Tri par chaque dimension et par nom | `src/lib/filter.ts` (`sortProducts`) |
| 4 | **Tableau dense par défaut** + vue cartes, **lien sortant** vers la page de gamme par résultat | `src/scripts/app.ts` |
| 5 | **Comparateur 2 à 4** côte à côte, **surlignage des écarts** | `src/scripts/app.ts` (`openCompare`) |
| 6 | **État des filtres dans l'URL** (querystring), restauré au chargement | `src/scripts/app.ts` (`stateToURL` / `applyURLToControls`) |
| 7 | **Responsive** : tableau → cartes empilées, sliders au doigt | `src/styles/global.css` |
| 8 | **Accessibilité AA** : clavier, contrastes, ARIA, skip-link, `noscript` de repli | markup + CSS |
| 9 | **Import sans code** (éditer le JSON) | voir ci-dessous |
| 10 | **Tests unitaires** sur la normalisation/validation | `src/lib/__tests__/` |

### La règle qui commande l'affichage

Le jeu de données contient **57 combinaisons vérifiées** et **32 non vérifiées**.
**Rien d'incertain n'est affiché comme certain.** Par défaut, **seules les 57 vérifiées sont
filtrables** ; les non vérifiées n'apparaissent qu'après avoir coché **« Inclure les combinaisons
non vérifiées »**, et portent alors un **badge « non vérifié »**. Cette règle est appliquée dans le
filtrage (`filter.ts`), pas en cachant les données — elle ne peut donc pas être contournée par un
simple oubli d'affichage.

---

## Ajouter une enseigne ou corriger une ligne **sans coder**

« Sans code » = sans écrire d'adapter ni de composant. L'opération reste **un commit git** (le site
est rebuild → redéployé). Deux cas :

### A. Corriger / promouvoir une ligne existante
1. Ouvrir `src/data/ikea.json`.
2. Corriger une cote, un `montage`, etc. — **en cm, ordre canonique L × P × H, structure nue**.
3. Pour **promouvoir une combinaison non vérifiée en vérifiée** : la déplacer de la liste
   `produits_incertains` vers `produits` en la complétant au format d'une ligne (ci-dessous), avec
   `"certitude":"confirmé"`.

### B. Ajouter une nouvelle enseigne
1. Créer `src/data/<enseigne>.json` **au même schéma** que `ikea.json` (clé `produits` = tableau
   plat, une entrée par **combinaison réelle**).
2. Déclarer son import dans `src/lib/dataset.ts` (une ligne `import`) **ou** — pour rester
   strictement « sans code » — fusionner les entrées dans un fichier déjà importé.
   *(MVP : seul `ikea.json` est câblé ; le format ci-dessous est le contrat d'ajout.)*
3. Renseigner les URLs de pages de gamme dans `src/data/gamme-urls.json` (voir plus bas).
4. `git commit` → rebuild.

### Format d'une ligne (contrat de données, grain « combinaison réelle »)

```json
{
  "id": "ikea-billy-80x28x202",
  "enseigne": "IKEA",
  "gamme": "BILLY",
  "nom_produit": "BILLY 80×28×202",
  "type_meuble": "bibliotheque",
  "largeur_cm": 80,
  "profondeur_cm": 28,
  "hauteur_cm": 202,
  "montage": "pose",
  "materiau": "mélaminé",
  "piece": ["multi"],
  "url_produit": "gamme:BILLY",
  "certitude": "confirmé",
  "source": "dimensions.com"
}
```

- **Requis** : `id`, `gamme`, `largeur_cm`/`profondeur_cm`/`hauteur_cm` (> 0, ordre L × P × H),
  `url_produit`. Une ligne à qui il manque un requis (ou avec une cote ≤ 0) est **mise en
  quarantaine au build** (journalisée dans la sortie de build), **jamais rejetée silencieusement**.
- **Pas de champ `reference` / SKU** (grain 1 : combinaisons de gamme, pas d'articles).
- **Pas de prix / image / libellé marketing** : `nom_produit` est un **libellé construit** par nous
  (gamme + cotes). Les champs `prix`/`devise`/`date_maj_prix` restent présents mais **vides** (V2).
- **Combinaisons non vérifiées** : à mettre dans `produits_incertains`
  (`{ "gamme", "combinaisons": ["L×P×H", …], "raison", "source" }`). Elles sont dépliées au build en
  héritant des métadonnées de la gamme et marquées `incertain`.

### Liens vers les pages de gamme — `src/data/gamme-urls.json`

`url_produit` vaut le placeholder `"gamme:<GAMME>"`. Le build le résout via `gamme-urls.json` :

- Valeur `null` (défaut) → **le lien est laissé DÉSACTIVÉ** dans l'UI (« Lien gamme indisponible »).
- Renseigner l'**URL publique vérifiée** de la page de gamme → le lien s'active
  (« Voir la gamme … ↗ », `rel="noopener nofollow"`).

> **Choix assumé (MVP)** : les 8 URLs de pages de gamme sont livrées à `null` — elles ne sont
> **pas inventées** (consigne : une URL fabriquée de mémoire est un défaut). À compléter par Arnaud
> avec les URLs publiques réelles, sans moissonnage.

---

## Choix de simplicité signalés (le doc dit : trancher au plus simple, signaler ici)

- **Island vanilla TypeScript** (pas de Preact/React) : réduit les dépendances (proche du standard,
  moins à maintenir). La logique testable (normalisation, filtrage) est isolée dans `src/lib/`.
- **Une seule enseigne câblée** (`ikea.json`) au MVP ; l'ajout d'une 2ᵉ enseigne est **documenté**
  (format + point d'import) plutôt que démontré avec des données inventées.
- **Facettes en cases à cocher** (plutôt que `<select multiple>`) : meilleur au clavier et au doigt.
- **`site` dans `astro.config.mjs`** = `https://caissons.vimiac.fr` (placeholder) — à ajuster au vrai
  domaine avant déploiement.
- **Lien « Signaler un problème »** (doctrine : feedback GitHub Issues) : dépôt privé, URL inconnue
  au build → laissée **désactivée**, à renseigner (`ISSUES_URL` dans `index.astro`).

---

## Frontière légale / éthique (rappel)

Aucun moissonnage. Aucun prix, aucune image, aucune référence article, aucun libellé marketing.
Dimensions établies à partir de **sources publiques variées** (voir la note de provenance des
données). Marques citées à titre **descriptif** ; ce comparateur n'est ni le vendeur ni affilié.
Données **indicatives**, à vérifier auprès de l'enseigne.

## Structure

```
src/
  data/ikea.json          # données (copiées verbatim de la livraison, non modifiées)
  data/gamme-urls.json    # mapping gamme → URL publique (null = lien désactivé)
  lib/dimensions.ts       # normalisation/validation PURES (testées)
  lib/filter.ts           # filtrage/tri PURS (testés)
  lib/dataset.ts          # chargement build : validation, quarantaine, bornes, dépliage incertains
  lib/__tests__/          # tests vitest
  pages/index.astro       # page (build-time data + contrôles accessibles + repli noscript)
  scripts/app.ts          # island client (filtres, URL, vues, comparateur)
  styles/global.css
docs/RAPPORT-build.md     # journal de build
```
