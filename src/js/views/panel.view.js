import { fmtEuro } from "../utils/utils.js";
import { computeStats } from "../models/dvf.model.js";

/* =====================================================
   PANELS
===================================================== */

/**
 * Affiche le panneau latéral pour un **département**.
 *
 * Avec indicateur de compatibilité si des filtres sont actifs
 *
 * @param {string} nom - Nom du département.
 * @param {{ ventes?: number, prixMedian?: number, apparts?: number, maisons?: number }} stats
 * @param {Object|Array|null} transports - Données de transport à proximité.
 * @param {Object|null} compatibility - Score de compatibilité { score, ventesCorrespondantes, ventesTotal }
 */
export function showDeptPanel(nom, stats, transports, compatibility = null) {
  const panel = document.getElementById("side-panel");

  // Bloc de compatibilité
  const compatibilityHTML = renderCompatibilityIndicator(compatibility);

  panel.innerHTML = `
    <h2>${nom}</h2>

    ${compatibilityHTML}

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
 * Avec indicateur de compatibilité si des filtres sont actifs
 *
 * @param {string} nom - Nom de la commune.
 * @param {Array<Object>} ventes - Liste des mutations DVF pour la commune.
 * @param {Object|Array|null} transports - Données de transport à proximité.
 * @param {Object|null} compatibility - Score de compatibilité
 */
export function showCommunePanel(nom, ventes, transports, compatibility = null) {
  const stats = computeStats(ventes);
  const panel = document.getElementById("side-panel");

  // Bloc de compatibilité
  const compatibilityHTML = renderCompatibilityIndicator(compatibility);

  panel.innerHTML = `
    <h2>${nom}</h2>

    ${compatibilityHTML}

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
 * Avec indicateur de compatibilité si des filtres sont actifs
 *
 * @param {string} nomCommune - Nom de la commune.
 * @param {string} sectionCode - Code de la section (ex: "AB").
 * @param {Array<Object>} ventes - Liste des ventes dans la section.
 * @param {Object|Array|null} transports - Données de transport à proximité.
 * @param {Object|null} compatibility - Score de compatibilité
 */
export function showSectionPanel(nomCommune, sectionCode, ventes, transports, compatibility = null) {
  const stats = computeStats(ventes || []);
  const panel = document.getElementById("side-panel");

  // Bloc de compatibilité
  const compatibilityHTML = renderCompatibilityIndicator(compatibility);

  panel.innerHTML = `
    <h2>${nomCommune}</h2>
    <h3>Section ${sectionCode}</h3>

    ${compatibilityHTML}

    <p>Nombre de ventes</p>
    <div class="big-number">${stats.ventes}</div>

    <p>Prix médian au m²</p>
    <div class="big-number">${fmtEuro(stats.prixMedian)}</div>

    ${renderAccessibility(transports)}

    ${renderVentesDetails(ventes)}
  `;
}

/* =====================================================
    INDICATEUR DE COMPATIBILITÉ
===================================================== */

/**
 * Génère le HTML de l'indicateur de compatibilité
 * 
 * @param {Object|null} compatibility - { score, ventesCorrespondantes, ventesTotal }
 * @returns {string} HTML de l'indicateur ou chaîne vide
 */
function renderCompatibilityIndicator(compatibility) {
  // Si pas de données de compatibilité, ne rien afficher
  if (!compatibility || compatibility.score === null || compatibility.score === undefined) {
    return '';
  }

  const { score, ventesCorrespondantes, ventesTotal } = compatibility;

  // Si score = 100%, ne pas afficher (tous les biens correspondent)
  if (score === 100) {
    return '';
  }

  // Déterminer la classe CSS selon le score
  let badgeClass = 'compat-none';
  let icon = '✗';
  let label = 'Aucune correspondance';

  if (score === 0) {
    badgeClass = 'compat-none';
    icon = '✗';
    label = 'Aucune correspondance';
  } else if (score <= 30) {
    badgeClass = 'compat-low';
    icon = '~';
    label = 'Faible compatibilité';
  } else if (score <= 60) {
    badgeClass = 'compat-medium';
    icon = '✓';
    label = 'Compatibilité moyenne';
  } else if (score <= 80) {
    badgeClass = 'compat-good';
    icon = '✓';
    label = 'Bonne compatibilité';
  } else {
    badgeClass = 'compat-high';
    icon = '✓✓';
    label = 'Excellente compatibilité';
  }

  return `
    <div class="compatibility-indicator ${badgeClass}">
      <div class="compat-header">
        <span class="compat-icon">${icon}</span>
        <span class="compat-label">${label}</span>
      </div>
      <div class="compat-score">${score}%</div>
      <div class="compat-detail">${ventesCorrespondantes} / ${ventesTotal} ventes</div>
    </div>
  `;
}

/* =====================================================
   ACCESSIBILITÉ
===================================================== */

/**
 * Normalise les données de transports dans un format exploitable.
 *
 * @param {null|undefined|Array|Object} transports - Données brutes.
 * @returns {Array<Object>} Tableau de features de transport.
 */
function normalizeTransports(transports) {
  if (!transports) return [];
  if (Array.isArray(transports)) return transports;
  if (transports.features) return transports.features;
  return [];
}

/**
 * Construit une structure par mode de transport à partir des features.
 *
 * @param {Array<Object>} transports - Liste normalisée de features.
 * @returns {{ METRO: Map<string,string>, RER: Map<string,string>, TRAMWAY: Map<string,string>, TRAIN: Map<string,string> }}
 */
function buildAccessibility(transports) {
  const result = {
    METRO: new Map(),
    RER: new Map(),
    TRAMWAY: new Map(),
    TRAIN: new Map(),
  };

  for (const f of transports) {
    const p = f.properties || {};
    const mode = (p.mode || "").toUpperCase();
    const ligne = p.ligne;
    const couleur = p.couleur || "#999999";

    if (!result[mode] || !ligne) continue;

    if (!result[mode].has(ligne)) {
      result[mode].set(ligne, couleur);
    }
  }

  return result;
}

/**
 * Génère le HTML pour un bloc "mode de transport".
 *
 * @param {string} title - Titre affiché (ex: "🚇 Métro").
 * @param {Map<string,string>} map - Map(ligne → couleur).
 * @param {string} cssClass - Classe CSS pour styler les badges.
 * @returns {string} HTML du bloc ou chaîne vide si aucune ligne.
 */
function renderMode(title, map, cssClass) {
  if (!map || map.size === 0) return "";

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
 * @param {null|undefined|Array|Object} transports - Données brutes.
 * @returns {string} HTML du bloc accessibilité.
 */
function renderAccessibility(transports) {
  const list = normalizeTransports(transports);
  const acc = buildAccessibility(list);

  const html =
    renderMode("Métro", acc.METRO, "metro") +
    renderMode("RER", acc.RER, "rer") +
    renderMode("Tramway", acc.TRAMWAY, "tram") +
    renderMode("Train", acc.TRAIN, "rer");

  if (!html.trim()) {
    return `
      <section class="accessibility">
        <h3>Accessibilité</h3>
        <p class="muted">Aucun transport à proximité</p>
      </section>
    `;
  }

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
 * @param {Array<Object>} ventes - Liste brute des mutations DVF pour la section.
 * @returns {string} HTML du bloc "Détail des ventes".
 */
function renderVentesDetails(ventes) {
  if (!ventes || ventes.length === 0) {
    return `
      <section class="sales-details">
        <h3>Détail des ventes</h3>
        <p class="muted">Aucune vente dans cette section</p>
      </section>
    `;
  }

  const list = ventes
    .map((v, idx) => {
      let bien = "Bien";
      const tl = v.code_type_local ?? v.type_local ?? v.type ?? null;

      if (tl !== null && tl !== undefined) {
        if (tl == 1 || tl === "1") {
          bien = "Maison";
        } else if (tl == 2 || tl === "2") {
          bien = "Appartement";
        } else if (typeof tl === "string") {
          const t = tl.toLowerCase();
          if (t.includes("appart")) bien = "Appartement";
          else if (t.includes("mais")) bien = "Maison";
          else bien = tl;
        }
      }

      const surface = v.surface_reelle_bati || v.surface || v.surf || null;
      const prix = v.valeur_fonciere ?? v.prix ?? null;
      const date = v.date_mutation || v.date || "";
      const pieces = v.nombre_pieces_principales ?? v.nb_pieces ?? null;

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
