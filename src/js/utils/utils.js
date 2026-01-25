// ==========================
// Médiane
// ==========================
/**
 * Calcule la médiane d'un tableau de valeurs numériques.
 *
 * La médiane est utilisée plutôt que la moyenne pour limiter l'influence
 * des valeurs extrêmes dans les prix immobiliers (spécificité du marché).
 *
 * @param {number[]} values - Liste des valeurs numériques.
 * @returns {number|null} Médiane ou null si la liste est vide.
 */
export function median(values) {
  if (!values || values.length === 0) return null;
  // Tri croissant des valeurs
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Si effectif impair => valeur centrale
  // Si effectif pair => moyenne des deux valeurs centrales
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ==========================
// Arrondis
// ==========================
/**
 * Arrondit un nombre vers le bas à la centaine inférieure.
 * Exemple : 735 → 700
 *
 * @param {number} n - Valeur à arrondir.
 * @returns {number|null} Valeur arrondie ou null si n non valide.
 */
export function roundDown100(n) {
  if (n == null || isNaN(n)) return null;
  return Math.floor(n / 100) * 100;
}

/**
 * Arrondit un nombre vers le haut à la centaine supérieure.
 * Exemple : 735 → 800
 *
 * @param {number} n - Valeur à arrondir.
 * @returns {number|null} Valeur arrondie ou null si n non valide.
 */

export function roundUp100(n) {
  if (n == null || isNaN(n)) return null;
  return Math.ceil(n / 100) * 100;
}

// ===================================================
// Calcul des seuils de quantiles
// ===================================================
/**
 * Calcule des seuils de quantiles utilisés pour classer visuellement
 * les valeurs dans une palette de couleurs.
 *
 * Exemple : n=9 crée 9 quantiles → typique d'une carte en "échelle de chaleur".
 *
 * @param {number[]} values - Liste des valeurs numériques.
 * @param {number} [n=9] - Nombre de classes de quantiles.
 * @returns {number[]} Tableau des seuils de quantile.
 */
export function computeQuantiles(values, n = 9) {
  if (!values || values.length === 0) return [];
  // Tri croissant nécessaire pour découper en quantiles
  const sorted = [...values].sort((a, b) => a - b);
  const q = [];
  for (let i = 1; i < n; i++) {
    const pos = Math.floor((i / n) * sorted.length);
    q.push(sorted[pos]);
  }
  return q;
}

// ===================================================
// Palette
// ===================================================
/**
 * Retourne la palette de couleurs utilisée pour représenter
 * les prix immobiliers du plus faible (vert) au plus élevé (rouge).
 *
 * @returns {string[]} Liste de couleurs hexadécimales.
 */
export function heatPalette() {
  return [
    "#006400",
    "#1e8f3a",
    "#6cc04a",
    "#b6e43a",
    "#ffd700",
    "#ffb000",
    "#ff8c00",
    "#ff3b1f",
    "#8b0000",
  ];
}

// ===================================================
// Couleur par quantile
// ===================================================
/**
 * Associe une valeur à une couleur en fonction des quantiles calculés.
 *
 * Si la valeur n'est pas valide, une couleur neutre est appliquée.
 *
 * @param {number} value - Valeur numérique à classifier.
 * @param {number[]} quantiles - Seuils de quantiles.
 * @returns {string} Couleur hexadécimale correspondante.
 */
export function heatColorQuantile(value, quantiles) {
  if (value == null || isNaN(value)) return "#cccccc"; // couleur neutre
  const palette = heatPalette();
  // Première valeur ≤ quantile → couleur correspondante
  for (let i = 0; i < quantiles.length; i++) {
    if (value <= quantiles[i]) return palette[i];
  }
  // Sinon valeur supérieure au dernier quantile
  return palette[palette.length - 1];
}

// ==========================
// Format €
// ==========================
/**
 * Formate un nombre en euro pour affichage.
 *
 * Ex : 5321.4 → "5 321 €"
 *
 * @param {number} value - Valeur numérique.
 * @returns {string} Valeur formatée ou "—" si invalide.
 */
export function fmtEuro(value) {
  if (value == null || isNaN(value)) return "—";
  return `${Math.round(value).toLocaleString("fr-FR")} €`;
}

// ===================================================
// TRANSPORTS : modes présents dans un bounds Leaflet
// ===================================================
/**
 * Filtre les stations de transport situées à l'intérieur d'une zone affichée.
 *
 * @param {GeoJSON.FeatureCollection} featureCollection - Stations.
 * @param {L.LatLngBounds} bounds - Fenêtre géographique affichée par Leaflet.
 * @returns {Array<GeoJSON.Feature>} Stations visibles dans la zone.
 */
export function transportsInBounds(featureCollection, bounds) {
  if (!featureCollection?.features) return [];

  return featureCollection.features.filter((f) => {
    const coords = f.geometry?.coordinates;
    if (!coords) return false;
    // Test: au moins un point de la station est dans la zone
    return coords.some(([lng, lat]) => bounds.contains([lat, lng]));
  });
}

/**
 * Regroupe les lignes de transport par mode
 * afin d'afficher un résumé par territoire.
 *
 * Exemple de sortie :
 * {
 *   METRO: Map { "6" → "#008000", "1" → "#0033cc" },
 *   RER: Map   { "B" → "#003399" }
 * }
 *
 * @param {Array<GeoJSON.Feature>} features - Lignes desservantes.
 * @returns {Object<string, Map<string, string>>} Accessibilité par mode.
 */
export function extractAccessibility(features) {
  const byMode = {};

  for (const f of features) {
    const { mode, ligne, couleur } = f.properties;

    if (!mode || !ligne) continue;

    if (!byMode[mode]) byMode[mode] = new Map();
    // On associe la ligne à sa couleur
    byMode[mode].set(ligne, couleur);
  }

  return byMode;
}
