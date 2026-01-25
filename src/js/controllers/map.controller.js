import { state } from "../app/state.js";
import * as Geo from "../models/geo.model.js";
import * as MapView from "../views/map.view.js";
import * as Panel from "../views/panel.view.js";
import { getTransportsServingZone } from "../models/accessibilite.model.js";

/**
 * Démarre l'application cartographique.
 *
 * - Charge les contours des départements
 * - Affiche la première échelle (départements) sur la carte
 * - Associe les informations immobilières à cette échelle
 *
 * Cette fonction constitue le point d'entrée de l'application et doit être appelée
 * une fois que la carte Leaflet (state.map) a été initialisée.
 *
 * @returns {Promise<void>}
 */
export async function startApp() {
  // Chargement des contours géographiques des départements (GeoJSON)
  const geo = await Geo.loadDepartmentsGeo();

  // Affichage des départements comme première couche interactive
  // Chaque département est cliquable et déclenche onDepartmentClick
  state.layers.dept = MapView.renderDepartments(
    state.map,
    geo,
    state.data.statsDept,
    onDepartmentClick,
  );
  console.log("aby : state.map", state.data.statsDept);
}

/**
 * Gestion de la sélection d’un département.
 *
 * - Recentre la carte sur le département sélectionné
 * - Nettoie les couches inférieures (communes + sections)
 * - Affiche les informations départementales dans le panneau
 * - Charge et affiche l’échelle suivante (communes)
 *
 * @param {GeoJSON.Feature} feature - Département sélectionné
 * @param {L.Layer} layer - Couche Leaflet associée au département cliqué
 * @returns {Promise<void>}
 */
async function onDepartmentClick(feature, layer) {
  // Recentre et zoome sur le département
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [40, 40] });

  // Nettoie les couches d'échelles inférieures
  state.layers.commune = MapView.clearLayer(state.map, state.layers.commune);
  state.layers.section = MapView.clearLayer(state.map, state.layers.section);

  // Récupération de la desserte en transport du département
  const transports = getTransportsServingZone(feature) || [];
  // Affichage des informations départementales dans le panneau latéral
  Panel.showDeptPanel(
    feature.properties.nom,
    state.data.statsDept[feature.properties.code_insee],
    transports,
  );
  // Chargement des contours des communes du département
  const geoCommunes = await Geo.loadCommunesGeo(feature.properties.code_insee);
  // Affichage de l’échelle suivante (communes)
  state.layers.commune = MapView.renderCommunes(
    state.map,
    geoCommunes,
    state.data.prixCommune,
    (f, l) => onCommuneClick(feature.properties.code_insee, f, l),
  );
}

/**
 * Gestion de la sélection d’une commune.
 *
 * - Recentre la carte sur la commune
 * - Nettoie l’échelle inférieure (sections)
 * - Affiche les informations immobilières et transports de la commune
 * - Charge et affiche les sections cadastrales associées
 *
 * @param {string} codeDept - Code du département auquel appartient la commune
 * @param {GeoJSON.Feature} feature - Commune sélectionnée
 * @param {L.Layer} layer - Couche Leaflet associée à la commune
 * @returns {Promise<void>}
 */
async function onCommuneClick(codeDept, feature, layer) {
  // Recentre la vue sur la commune sélectionnée
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [30, 30] });

  // Nettoyage de la couche section
  state.layers.section = MapView.clearLayer(state.map, state.layers.section);

  // Récupération des ventes DVF associées à la commune (échelle intermédiaire)
  const ventes = state.data.ventesByCommune.get(feature.properties.id) ?? [];

  // Récupération de la desserte en transport de la commune
  const transports = getTransportsServingZone(feature) || [];

  // Affichage des informations dans le panneau latéral
  Panel.showCommunePanel(feature.properties.nom, ventes, transports);

  // Chargement des contours des sections cadastrales
  const geoSections = await Geo.loadSectionsGeo(codeDept);

  // Filtrage pour ne conserver que les sections de la commune sélectionnée
  const sections = geoSections.features.filter(
    (f) => f.properties.commune === feature.properties.id,
  );

  // Affichage de la couche section (niveau le plus fin)
  state.layers.section = MapView.renderSections(
    state.map,
    sections,
    state.data.prixSection,
    (f, l) => onSectionClick(feature.properties.nom, f, l),
  );
}

/**
 * Gestion de la sélection d’une section cadastrale.
 *
 * - Recentre la carte sur la section
 * - Affiche les informations immobilières micro-locales
 * - Fin du parcours multi-échelle (pas d’échelle inférieure)
 *
 * @param {string} nomCommune - Nom de la commune à laquelle appartient la section
 * @param {GeoJSON.Feature} feature - Section cadastrale sélectionnée
 * @param {L.Layer} layer - Couche associée à la section
 */
function onSectionClick(nomCommune, feature, layer) {
  // Recentre la vue sur la section sélectionnée
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [20, 20] });

  // Récupération des ventes micro-locales
  const ventes = state.data.ventesBySection.get(feature.properties.id) ?? [];

  // Récupération de la desserte en transport micro-locale
  const transports = getTransportsServingZone(feature) || [];

  // Affichage dans le panneau latéral
  Panel.showSectionPanel(
    nomCommune,
    feature.properties.code,
    ventes,
    transports,
  );
}
