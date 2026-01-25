/**
 * Charge les contours géographiques des départements d'Île-de-France.
 *
 * Les données sont fournies au format GeoJSON et utilisées pour afficher
 * le premier niveau de l'exploration multi-échelle.
 *
 * @returns {Promise<GeoJSON.FeatureCollection>} Contours départementaux.
 */
export async function loadDepartmentsGeo() {
  // Récupération du fichier GeoJSON local contenant les départements d'IDF
  return fetch("data/idf.geojson").then((r) => r.json());
}

/**
 * Charge les contours géographiques des communes d'un département.
 *
 * Les communes ne sont chargées qu'au clic sur un département afin
 * de limiter la quantité de données chargées initialement et améliorer
 * les performances d'affichage.
 *
 * @param {string} codeDept - Code INSEE du département (ex : "75", "92", "93").
 * @returns {Promise<GeoJSON.FeatureCollection>} Communes du département.
 */
export async function loadCommunesGeo(codeDept) {
  // Chemin dynamique : données organisées par département dans /data/<code>/
  return fetch(`data/${codeDept}/communes-${codeDept}.geojson`).then((r) =>
    r.json(),
  );
}

/**
 * Charge les sections cadastrales d'un département.
 *
 * Les sections sont le niveau le plus fin de détail dans l'application.
 * Elles ne sont chargées qu'au clic sur une commune et filtrées ensuite
 * pour ne garder que celles correspondant à la commune sélectionnée.
 *
 * @param {string} codeDept - Code INSEE du département.
 * @returns {Promise<GeoJSON.FeatureCollection>} Sections cadastrales du département.
 */
export async function loadSectionsGeo(codeDept) {
  return fetch(`data/${codeDept}/sections-${codeDept}.geojson`).then((r) =>
    r.json(),
  );
}
