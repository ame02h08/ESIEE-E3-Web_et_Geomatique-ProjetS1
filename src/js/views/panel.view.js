import { fmtEuro } from "../utils/utils.js";
import { computeStats } from "../models/dvf.model.js";

/* =====================================================
   PANELS
===================================================== */

/**
 * Affiche le panneau latéral pour un **département**.
 *
 * - Affiche le nom du département
 * - Nombre total de ventes
 * - Prix médian au m²
 * - Répartition Appartements / Maisons
 * - Bloc d’accessibilité aux transports
 *
 * @param {string} nom - Nom du département.
 * @param {{ ventes?: number, prixMedian?: number, apparts?: number, maisons?: number }} stats
 *        Statistiques agrégées du département (peuvent être partielles ou nulles).
 * @param {Object|Array|null} transports - Données de transport à proximité (GeoJSON, tableau de features ou null).
 */
export function showDeptPanel(nom, stats, transports) {
  // Récupère l'élément du panneau latéral.
  const panel = document.getElementById("side-panel");

  // Construction du contenu HTML :
  // - On utilise l'opérateur `?.` pour éviter les erreurs si `stats` est null/undefined.
  // - On remplace les valeurs manquantes par un tiret cadratin "—".
  panel.innerHTML = `
    <h2>${nom}</h2>

    <p>Nombre total de ventes</p>
    <div class="big-number">${stats?.ventes ?? "—"}</div>

    <p>Prix médian au m²</p>
    <div class="big-number">${fmtEuro(stats?.prixMedian)}</div>

    <hr>

    <p>Appartements</p>
    <div>${stats?.apparts ?? "—"} ventes</div>

    <p>Maisons</p>
    <div>${stats?.maisons ?? "—"} ventes</div>

    ${renderAccessibility(transports)}
  `;
}

/**
 * Affiche le panneau latéral pour une **commune**.
 *
 * - Calcule les stats à partir de la liste brute des ventes.
 * - Affiche nombre de ventes, prix médian au m².
 * - Détail Appartements / Maisons (volume + prix au m²).
 * - Bloc d’accessibilité aux transports.
 *
 * @param {string} nom - Nom de la commune.
 * @param {Array<Object>} ventes - Liste des mutations DVF pour la commune.
 * @param {Object|Array|null} transports - Données de transport à proximité.
 */
export function showCommunePanel(nom, ventes, transports) {
  // On calcule les statistiques agrégées sur la base des ventes brutes.
  const stats = computeStats(ventes);

  // Récupération du panneau latéral.
  const panel = document.getElementById("side-panel");

  // Construction de l'HTML avec les statistiques calculées.
  panel.innerHTML = `
    <h2>${nom}</h2>

    <p>Nombre total de ventes</p>
    <div class="big-number">${stats.ventes}</div>

    <p>Prix médian au m²</p>
    <div class="big-number">${fmtEuro(stats.prixMedian)}</div>

    <hr>

    <p>Appartements</p>
    <div>${stats.apparts} ventes</div>
    <div>${fmtEuro(stats.prixApparts)} / m²</div>

    <p>Maisons</p>
    <div>${stats.maisons} ventes</div>
    <div>${fmtEuro(stats.prixMaisons)} / m²</div>

    ${renderAccessibility(transports)}
  `;
}

/**
 * Affiche le panneau latéral pour une **section cadastrale**.
 *
 * - Affiche le nom de la commune + code de section.
 * - Calcule et montre les stats sur les ventes de la section.
 * - Inclut l’accessibilité et le détail des ventes (tableau).
 *
 * @param {string} nomCommune - Nom de la commune.
 * @param {string} sectionCode - Code de la section (ex: "AB").
 * @param {Array<Object>} ventes - Liste des ventes dans la section.
 * @param {Object|Array|null} transports - Données de transport à proximité.
 */
export function showSectionPanel(nomCommune, sectionCode, ventes, transports) {
  // Sécurise le paramètre ventes (évite les erreurs si null/undefined).
  const stats = computeStats(ventes || []);

  // Récupération du panneau latéral.
  const panel = document.getElementById("side-panel");

  // Construction du contenu avec :
  // - un résumé (ventes / prix médian),
  // - le bloc transports,
  // - un tableau détaillé des ventes.
  panel.innerHTML = `
    <h2>${nomCommune}</h2>
    <h3>Section ${sectionCode}</h3>

    <p>Nombre de ventes</p>
    <div class="big-number">${stats.ventes}</div>

    <p>Prix médian au m²</p>
    <div class="big-number">${fmtEuro(stats.prixMedian)}</div>

    ${renderAccessibility(transports)}

    ${renderVentesDetails(ventes)}
  `;
}

/* =====================================================
   ACCESSIBILITÉ
===================================================== */

/**
 * Normalise les données de transports dans un format exploitable.
 *
 * Accepte :
 * - `null` / `undefined` → []
 * - tableau de features → renvoyé tel quel
 * - GeoJSON FeatureCollection → use `.features`
 *
 * @param {null|undefined|Array|Object} transports - Données brutes.
 * @returns {Array<Object>} Tableau de features de transport.
 */
function normalizeTransports(transports) {
  // Aucun transport fourni → liste vide.
  if (!transports) return [];

  // Si c'est déjà un tableau, on le renvoie tel quel.
  if (Array.isArray(transports)) return transports;

  // Si c'est un objet GeoJSON avec une propriété `features`,
  // on renvoie ce tableau.
  if (transports.features) return transports.features;

  // Fallback : on ne sait pas gérer ce format → liste vide.
  return [];
}

/**
 * Construit une structure par mode de transport à partir des features.
 *
 * - Regroupe par type de mode (METRO, RER, TRAMWAY, TRAIN).
 * - Pour chaque mode, stocke un Map(ligne → couleur).
 *
 * @param {Array<Object>} transports - Liste normalisée de features.
 * @returns {{ METRO: Map<string,string>, RER: Map<string,string>, TRAMWAY: Map<string,string>, TRAIN: Map<string,string> }}
 */
function buildAccessibility(transports) {
  // Initialisation d'un dictionnaire de Maps par mode de transport.
  const result = {
    METRO: new Map(),
    RER: new Map(),
    TRAMWAY: new Map(),
    TRAIN: new Map(),
  };

  // Parcours de tous les points de transport.
  for (const f of transports) {
    // Sécurisation de la lecture des propriétés.
    const p = f.properties || {};

    // Mode en majuscules (ex: "METRO", "RER", "TRAMWAY", "TRAIN").
    const mode = (p.mode || "").toUpperCase();

    // Numéro / nom de la ligne (ex: "1", "A", "T3a"...).
    const ligne = p.ligne;

    // Couleur associée à la ligne (utilisée dans le badge).
    const couleur = p.couleur || "#999999";

    // Si le mode n'est pas géré ou que la ligne est absente, on saute.
    if (!result[mode] || !ligne) continue;

    // On ajoute la ligne dans la Map du mode si elle n'est pas déjà présente.
    if (!result[mode].has(ligne)) {
      result[mode].set(ligne, couleur);
    }
  }

  return result;
}

/**
 * Génère le HTML pour un bloc "mode de transport" (ex: Métro, RER…).
 *
 * @param {string} title - Titre affiché (ex: "🚇 Métro").
 * @param {Map<string,string>} map - Map(ligne → couleur).
 * @param {string} cssClass - Classe CSS pour styler les badges (ex: "metro", "rer", "tram").
 * @returns {string} HTML du bloc ou chaîne vide si aucune ligne.
 */
function renderMode(title, map, cssClass) {
  // Si aucune ligne pour ce mode, on ne rend rien.
  if (!map || map.size === 0) return "";

  // On convertit la Map en tableau [ligne, couleur] et on trie par numéro/nom de ligne.
  const items = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr", { numeric: true }))
    .map(
      ([ligne, couleur]) => `
      <span class="transport-badge ${cssClass}" style="--c:${couleur}">
        ${cssClass === "tram" ? "T" : ""}${ligne}
      </span>
    `,
    )
    .join("");

  // On regroupe le tout dans un bloc de type :
  // <div class="access-block">
  //   <h4> Métro</h4>
  //   <div class="access-list">[badges]</div>
  // </div>
  return `
    <div class="access-block">
      <h4>${title}</h4>
      <div class="access-list">${items}</div>
    </div>
  `;
}

/**
 * Construit le bloc "Accessibilité" complet pour le panneau.
 *
 * - Normalise les données de transport.
 * - Regroupe par mode.
 * - Génére un bloc HTML pour chaque mode (Métro, RER, Tramway, Train).
 * - Si aucun transport → message "Aucun transport à proximité".
 *
 * @param {null|undefined|Array|Object} transports - Données brutes.
 * @returns {string} HTML du bloc accessibilité.
 */
function renderAccessibility(transports) {
  // Normalisation en tableau de features.
  const list = normalizeTransports(transports);

  // Construction de la structure par mode de transport.
  const acc = buildAccessibility(list);

  // Concaténation des blocs par mode (certains pourront être vides).
  const html =
    renderMode("Métro", acc.METRO, "metro") +
    renderMode("RER", acc.RER, "rer") +
    renderMode("Tramway", acc.TRAMWAY, "tram") +
    renderMode("Train", acc.TRAIN, "rer");

  // Si après concaténation il ne reste rien (pas de transports),
  // on affiche un message par défaut.
  if (!html.trim()) {
    return `
      <section class="accessibility">
        <h3>Accessibilité</h3>
        <p class="muted">Aucun transport à proximité</p>
      </section>
    `;
  }

  // Sinon, on insère les blocs modes dans une section Accessibilité.
  return `
    <section class="accessibility">
      <h3>Accessibilité</h3>
      ${html}
    </section>
  `;
}

/* =====================================================
   DÉTAIL DES VENTES (SECTION)
===================================================== */

/**
 * Génère le HTML détaillé des ventes pour une section cadastrale.
 *
 * - Si aucune vente → message "Aucune vente".
 * - Sinon, tableau listant :
 *   - type de bien (Maison / Appartement / Bien)
 *   - surface
 *   - nombre de pièces
 *   - prix
 *   - date
 *
 * @param {Array<Object>} ventes - Liste brute des mutations DVF pour la section.
 * @returns {string} HTML du bloc "Détail des ventes".
 */
function renderVentesDetails(ventes) {
  // Cas sans ventes : on affiche simplement un message informatif.
  if (!ventes || ventes.length === 0) {
    return `
      <section class="sales-details">
        <h3>Détail des ventes</h3>
        <p class="muted">Aucune vente dans cette section</p>
      </section>
    `;
  }

  // Construction des lignes du tableau.
  const list = ventes
    .map((v, idx) => {
      /* ---------- Type de bien : Maison / Appartement / fallback ---------- */

      // Valeur par défaut
      let bien = "Bien";

      // On essaie différents champs possibles :
      // - code_type_local (1 = maison, 2 = appart)
      // - type_local (texte)
      // - type (éventuel champ déjà préparé en amont)
      const tl = v.code_type_local ?? v.type_local ?? v.type ?? null;

      if (tl !== null && tl !== undefined) {
        // Cas DVF standard avec codes numériques 1 / 2.
        if (tl == 1 || tl === "1") {
          bien = "Maison";
        } else if (tl == 2 || tl === "2") {
          bien = "Appartement";
        }
        // Cas champ texte (ex: "Appartement", "Maison", "Dépendance", etc.)
        else if (typeof tl === "string") {
          const t = tl.toLowerCase();
          if (t.includes("appart")) bien = "Appartement";
          else if (t.includes("mais")) bien = "Maison";
          else bien = tl; // on affiche tel quel si autre type
        }
      }

      /* ---------- Surface ---------- */

      // On tente plusieurs champs potentiels pour la surface bâtie.
      const surface = v.surface_reelle_bati || v.surface || v.surf || null;

      /* ---------- Prix ---------- */

      // Valeur foncière DVF ou équivalent interne.
      const prix = v.valeur_fonciere ?? v.prix ?? null;

      /* ---------- Date ---------- */

      // Date de mutation officielle ou fallback.
      const date = v.date_mutation || v.date || "";

      /* ---------- Nombre de pièces ---------- */

      const pieces = v.nombre_pieces_principales ?? v.nb_pieces ?? null;

      /* ---------- Construction de la ligne HTML ---------- */

      return `
      <tr>
        <td class="col-index">${idx + 1}</td>
        <td class="col-type">${bien}</td>
        <td class="col-surface">${surface ? surface + " m²" : "—"}</td>
        <td class="col-pieces">${pieces ?? "—"}</td>
        <td class="col-prix">${prix != null ? fmtEuro(prix) : "—"}</td>
        <td class="col-date">${date}</td>
      </tr>
    `;
    })
    .join("");

  // Intégration des lignes dans un tableau complet avec en-têtes.
  return `
    <section class="sales-details">
      <h3>Détail des ventes (${ventes.length})</h3>
      <table class="sales-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Bien</th>
            <th>Surface</th>
            <th>Pièces</th>
            <th>Prix</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${list}</tbody>
      </table>
    </section>
  `;
}
