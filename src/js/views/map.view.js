import {
  computeQuantiles,
  heatColorQuantile,
  fmtEuro,
} from "../utils/utils.js";
import { updateLegend } from "./legend.view.js";

/**
 * Initialise la carte Leaflet dans l’élément #map.
 *
 * - crée une instance de carte Leaflet
 * - fixe un zoom minimum et maximum
 * - centre la vue sur l’Île-de-France (Paris approximativement)
 * - ajoute un fond OpenStreetMap
 *
 * @returns {L.Map} Instance de carte Leaflet initialisée.
 */
export function initMap() {
  // Création de la carte dans l'élément HTML ayant l'id "map".
  // On impose un niveau de zoom minimal (9) et maximal (16)
  // pour éviter que l'utilisateur ne dézoome trop ou ne zoome à l'infini.
  const map = L.map("map", { minZoom: 9, maxZoom: 16 }).setView(
    // Coordonnées approximatives du centre de l'Île-de-France (Paris)
    [48.85, 2.35],
    // Niveau de zoom initial
    9,
  );
  // Ajout d'un fond de carte
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // On retourne l'instance de carte pour qu'elle puisse être
  // stockée dans un state global ou utilisée ailleurs.
  return map;
}
/**
 * Supprime proprement une couche cartographique Leaflet si elle est présente.
 *
 * Utilisée pour :
 * - éviter d'empiler des couches lorsqu'on change d'échelle (département → commune → section)
 * - garder la carte lisible
 *
 * Exemple :
 * - l’utilisateur clique un département → les communes s’affichent
 * - l’utilisateur clique un autre département → les anciennes communes disparaissent,
 *   les nouvelles communes sont affichées
 *
 * @param {L.Map} map - Instance de la carte Leaflet.
 * @param {L.Layer|null} layer - Couche précédente à retirer, si elle existe.
 * @returns {null} Toujours `null`, permettant de réinitialiser la référence dans le state
 */
export function clearLayer(map, layer) {
  // Si une couche est fournie on la retire explicitement de la carte.
  if (layer) map.removeLayer(layer);
  // On retourne null pour pouvoir faire par exemple :
  //   state.layers.communes = clearLayer(map, state.layers.communes);
  // ce qui remet la référence à null après suppression.
  return null;
}

/**
 * Affiche les **départements** sur la carte.
 *
 * - Chaque département est dessiné avec un style simple (contour noir, léger remplissage).
 * - Un tooltip affiche le nom du département + le prix médian au m² (si disponible).
 * - Au clic sur un département, `onDeptClick` est appelée pour gérer
 *   la navigation vers l'échelle suivante (communes).
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} geo - GeoJSON contenant les départements.
 * @param {Object.<string, { prixMedian: number }>} statsDept - Stats par code INSEE de département.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onDeptClick - Callback au clic sur un département.
 * @returns {L.GeoJSON} Couche Leaflet GeoJSON ajoutée à la carte.
 */
export function renderDepartments(map, geo, statsDept, onDeptClick) {
  // Création de la couche GeoJSON à partir des géométries de départements
  const layer = L.geoJSON(geo, {
    // Style appliqué à chaque polygone de département :
    // - contour noir (color)
    // - épaisseur de contour = 2
    // - remplissage très léger (fillOpacity)
    style: { color: "#000", weight: 2, fillOpacity: 0.12 },
    // onEachFeature est appelée pour chaque feature (département)
    // et permet d'attacher des événements, des tooltips, etc.
    onEachFeature: (f, l) => {
      // Récupération du code INSEE pour retrouver les stats associées.
      const code = f.properties.code_insee;
      // Construction du contenu du tooltip : Nom du département + Prix médian si dispo.
      l.bindTooltip(
        `<b>${f.properties.nom}</b><br>${fmtEuro(statsDept[code]?.prixMedian)} / m²`,
        // On passe la feature GeoJSON ainsi que la couche Leaflet correspondante.
        { sticky: true },
      );
      // Au clic sur le département, on passe la feature GeoJSON ainsi que la couche Leaflet correspondante.
      l.on("click", () => onDeptClick(f, l));
    },
  }).addTo(map); // Ajout de la couche à la carte

  // Ajuste la vue de la carte pour englober l'ensemble des départements affichés.
  map.fitBounds(layer.getBounds());
  return layer;
}

/**
 * Affiche les **communes** d’un département sur la carte.
 *
 * - Calcule les quantiles à partir des prix par commune.
 * - Met à jour la légende avec min / max et les quantiles.
 * - Colorie chaque commune en fonction de son prix médian (heatmap).
 * - Affiche un tooltip : nom de la commune + prix au m².
 * - Au clic, exécute `onCommuneClick` pour descendre à l’échelle section.
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} geo - GeoJSON des communes du département sélectionné.
 * @param {Object.<string, number>} prixCommune - Prix médian au m² par id de commune.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onCommuneClick - Callback au clic sur une commune.
 * @returns {L.GeoJSON} Couche des communes ajoutée à la carte.
 */
export function renderCommunes(map, geo, prixCommune, onCommuneClick) {
  // On extrait les valeurs de prix à partir des features GeoJSON :
  // - on prend l'id de la commune (f.properties.id)
  // - on regarde dans l'objet prixCommune
  const values = geo.features
    .map((f) => prixCommune[f.properties.id])
    // On ne garde que les valeurs numériques finies (évite NaN/undefined)
    .filter((v) => isFinite(v));

  // Calcul des quantiles pour construire une échelle de couleurs.
  const quantiles = computeQuantiles(values);

  // Si on a au moins une valeur, on met à jour la légende.
  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    // updateLegend va se servir de min, max et quantiles pour afficher une légende cohérente.
    updateLegend(min, max, quantiles);
  }

  // Création de la couche GeoJSON représentant les communes.
  const layer = L.geoJSON(geo, {
    // Style dynamique appliqué à chaque commune.
    style: (f) => {
      // Récupération du prix de la commune courante.
      const prix = prixCommune[f.properties.id];
      // Détermination de la couleur de remplissage à partir des quantiles.
      const fill = heatColorQuantile(prix, quantiles);
      return {
        fillOpacity: 0.85,
        weight: 1,
        color: "#333",
        fillColor: fill,
      };
    },
    // Pour chaque commune, on attache un tooltip et un handler de clic.
    onEachFeature: (f, l) => {
      const prix = prixCommune[f.properties.id];
      // Tooltip affichant le nom de la commune + le prix formaté.
      l.bindTooltip(`<b>${f.properties.nom}</b><br>${fmtEuro(prix)} / m²`, {
        sticky: true,
      });
      // Au clic sur la commune on charge et affiche les sections cadastrales correspondantes.
      l.on("click", () => onCommuneClick(f, l));
    },
  }).addTo(map);
  // On retourne la couche pour éventuellement la retirer plus tard.
  return layer;
}

/**
 * Affiche les **sections cadastrales** d’une commune.
 *
 * - Récupère les valeurs de prix par section.
 * - Calcule les quantiles pour la colorisation.
 * - Met à jour la légende (min, max, quantiles).
 * - Colorie chaque section selon son prix.
 * - Affiche un tooltip indiquant le code de la section.
 * - Au clic, déclenche `onSectionClick` pour remonter les infos au contrôleur.
 *
 * @param {L.Map} map - Carte Leaflet.
 * @param {GeoJSON.FeatureCollection} features - GeoJSON des sections.
 * @param {Object.<string, number>} prixSection - Prix par id de section.
 * @param {(feature: GeoJSON.Feature, layer: L.Layer) => void} onSectionClick - Callback au clic.
 * @returns {L.GeoJSON} Couche des sections.
 */
export function renderSections(map, features, prixSection, onSectionClick) {
  // Extraction de la liste des prix à partir des sections.
  const values = features
    .map((f) => prixSection[f.properties.id])
    .filter((v) => isFinite(v));

  // Calcul des quantiles pour les sections.
  const quantiles = computeQuantiles(values);

  // Mise à jour de la légende si on a au moins une valeur.
  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    updateLegend(min, max, quantiles);
  }

  // Création de la couche GeoJSON représentant les sections cadastrales.
  const layer = L.geoJSON(features, {
    // Style appliqué à chaque section.
    style: (f) => {
      const prix = prixSection[f.properties.id];
      const fill = heatColorQuantile(prix, quantiles);
      return {
        fillOpacity: 0.9,
        weight: 1,
        color: "#111",
        fillColor: fill,
      };
    },

    // Pour chaque section, on définit un tooltip et un handler de clic.
    onEachFeature: (f, l) => {
      const prix = prixSection[f.properties.id];
      // Tooltip simple avec le code de la section (ex: "Section AB").
      l.bindTooltip(`<b>Section ${f.properties.code}</b><br>${fmtEuro(prix)} / m²`, {
        sticky: true, // le tooltip suit le curseur tant qu'on reste sur le polygone
        direction: "auto",
      });
      l.on("click", () => onSectionClick(f, l));
    },
  }).addTo(map);

  // Retour de la couche pour gestion ultérieure (suppression, etc.).
  return layer;
}
