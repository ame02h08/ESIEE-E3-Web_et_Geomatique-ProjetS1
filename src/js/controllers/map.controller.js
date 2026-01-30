import { state } from "../app/state.js";
import * as Geo from "../models/geo.model.js";
import * as MapView from "../views/map.view.js";
import * as Panel from "../views/panel.view.js";
import { getTransportsServingZone } from "../models/accessibilite.model.js";
import { getFilteredStats, calculateCompatibilityScore } from "../models/filter.model.js";
import { checkComparisonMode, tryAddZone } from "./comparison.controller.js";

/**
 * Démarre l'application cartographique.
 * 
 * Charge la géométrie des départements d'Île-de-France et les affiche
 * sur la carte avec leurs statistiques (prix médian, nb ventes, etc.).
 * C'est le point de départ de la navigation multi-échelles.
 */
export async function startApp() {
  const geo = await Geo.loadDepartmentsGeo();

  state.layers.dept = MapView.renderDepartments(
    state.map,
    geo,
    state.data.statsDept,
    onDepartmentClick,
  );
}

/**
 * Gestion de la sélection d'un département.
 * 
 * Lorsque l'utilisateur clique sur un département, cette fonction :
 * - Récupère les données du département (ventes, transports, stats)
 * - Calcule les statistiques filtrées et le score de compatibilité
 * - Vérifie si le mode comparaison est actif
 * - Si mode normal : affiche le panneau et charge les communes du département
 * - Si mode comparaison : ajoute le département à la liste de comparaison
 * 
 * @param {GeoJSON.Feature} feature - Feature GeoJSON du département cliqué
 * @param {L.Layer} layer - Couche Leaflet correspondante
 */
async function onDepartmentClick(feature, layer) {
  const codeDept = feature.properties.code_insee;
  const nomDept = feature.properties.nom;
  const transports = getTransportsServingZone(feature) || [];
  const ventesRaw = state.data.ventesByDept?.get(codeDept);
  
  let statsToDisplay;
  let compatibility = null;
  
  // Calcul des statistiques filtrées si des ventes existent
  if (ventesRaw && ventesRaw.length > 0) {
    statsToDisplay = getFilteredStats(ventesRaw, transports);
    // Calcul du score de compatibilité (% de ventes correspondant aux filtres)
    compatibility = calculateCompatibilityScore(ventesRaw, transports);
  } else {
    // Utilisation des stats pré-calculées si pas de ventes disponibles
    statsToDisplay = state.data.statsDept[codeDept];
  }

  // Si le mode comparaison est actif, ajouter le département à la liste
  if (checkComparisonMode()) {
    tryAddZone({
      id: codeDept,
      name: nomDept,
      type: 'département',
      stats: statsToDisplay,
      transports: transports
    });
    return; // Arrêter ici, pas de navigation
  }

  // Comportement normal : navigation vers les communes
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [40, 40] });

  // Nettoyage des couches précédentes
  state.layers.commune = MapView.clearLayer(state.map, state.layers.commune);
  state.layers.section = MapView.clearLayer(state.map, state.layers.section);

  // Affichage du panneau latéral avec les infos du département
  Panel.showDeptPanel(nomDept, statsToDisplay, transports, compatibility);

  // Chargement et affichage des communes du département
  const geoCommunes = await Geo.loadCommunesGeo(codeDept);

  // Mise à jour de l'état global pour garder trace de la navigation
  state.currentDept = codeDept;
  state.currentDeptName = nomDept;
  state.currentScale = 'commune';

  // Affichage des communes sur la carte
  state.layers.commune = MapView.renderCommunes(
    state.map,
    geoCommunes,
    state.data.prixCommune,
    (f, l) => onCommuneClick(codeDept, f, l),
  );
}

/**
 * Gestion de la sélection d'une commune.
 * 
 * Lorsque l'utilisateur clique sur une commune, cette fonction :
 * - Récupère les ventes de la commune et calcule les stats filtrées
 * - Calcule le score de compatibilité avec les filtres actifs
 * - Vérifie si le mode comparaison est actif
 * - Si mode normal : affiche le panneau et charge les sections cadastrales
 * - Si mode comparaison : ajoute la commune à la liste de comparaison
 * 
 * @param {string} codeDept - Code INSEE du département parent
 * @param {GeoJSON.Feature} feature - Feature GeoJSON de la commune cliquée
 * @param {L.Layer} layer - Couche Leaflet correspondante
 */
async function onCommuneClick(codeDept, feature, layer) {
  const ventes = state.data.ventesByCommune.get(feature.properties.id) ?? [];
  const transports = getTransportsServingZone(feature) || [];
  const statsFiltered = getFilteredStats(ventes, transports);
  // Calcul du score de compatibilité pour cette commune
  const compatibility = calculateCompatibilityScore(ventes, transports);

  // Si le mode comparaison est actif, ajouter la commune à la liste
  if (checkComparisonMode()) {
    tryAddZone({
      id: feature.properties.id,
      name: feature.properties.nom,
      type: 'commune',
      stats: {
        ventes: statsFiltered.ventes,
        maisons: statsFiltered.maisons,
        apparts: statsFiltered.apparts,
        prixMedian: statsFiltered.prixMedian
      },
      transports: transports
    });
    return; // Arrêter ici, pas de navigation
  }

  // Comportement normal : navigation vers les sections
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [30, 30] });

  // Nettoyage de la couche sections précédente
  state.layers.section = MapView.clearLayer(state.map, state.layers.section);

  // Affichage du panneau latéral avec les infos de la commune
  Panel.showCommunePanel(feature.properties.nom, statsFiltered.ventesFiltered, transports, compatibility);

  // Chargement des sections cadastrales du département
  const geoSections = await Geo.loadSectionsGeo(codeDept);

  // Filtrage pour ne garder que les sections de cette commune
  const sections = geoSections.features.filter(
    (f) => f.properties.commune === feature.properties.id,
  );

  // Mise à jour de l'état global
  state.currentCommune = feature.properties.id;
  state.currentCommuneName = feature.properties.nom;
  state.currentDept = codeDept;
  state.currentScale = 'section';
  state.currentSections = sections;

  // Affichage des sections sur la carte
  state.layers.section = MapView.renderSections(
    state.map,
    sections,
    state.data.prixSection,
    (f, l) => onSectionClick(feature.properties.nom, f, l),
  );
}

/**
 * Gestion de la sélection d'une section cadastrale.
 * 
 * Lorsque l'utilisateur clique sur une section, cette fonction :
 * - Récupère les ventes de la section et calcule les stats filtrées
 * - PAS DE CALCUL DE COMPATIBILITÉ (non pertinent à ce niveau de détail)
 * - Vérifie si le mode comparaison est actif
 * - Si mode normal : affiche le panneau avec le détail des ventes
 * - Si mode comparaison : ajoute la section à la liste de comparaison
 * 
 * C'est le niveau de détail maximal de la navigation.
 * 
 * @param {string} nomCommune - Nom de la commune parente
 * @param {GeoJSON.Feature} feature - Feature GeoJSON de la section cliquée
 * @param {L.Layer} layer - Couche Leaflet correspondante
 */
function onSectionClick(nomCommune, feature, layer) {
  const ventes = state.data.ventesBySection.get(feature.properties.id) ?? [];
  const transports = getTransportsServingZone(feature) || [];
  const statsFiltered = getFilteredStats(ventes, transports);
  
  // ===== PAS DE COMPATIBILITÉ POUR LES SECTIONS =====
  // Les sections sont trop granulaires pour que le score de compatibilité
  // soit pertinent pour l'utilisateur. On passe null au panneau.
  const compatibility = null;

  // Si le mode comparaison est actif, ajouter la section à la liste
  if (checkComparisonMode()) {
    const sectionName = `${nomCommune} - Section ${feature.properties.code}`;
    tryAddZone({
      id: feature.properties.id,
      name: sectionName,
      type: 'section',
      stats: {
        ventes: statsFiltered.ventes,
        maisons: statsFiltered.maisons,
        apparts: statsFiltered.apparts,
        prixMedian: statsFiltered.prixMedian
      },
      transports: transports
    });
    return; // Arrêter ici, pas de navigation supplémentaire
  }

  // Comportement normal : zoom sur la section
  const bounds = layer.getBounds();
  state.map.fitBounds(bounds, { padding: [20, 20] });

  // Affichage du panneau latéral avec le détail des ventes
  // ===== On passe null pour la compatibilité =====
  Panel.showSectionPanel(
    nomCommune,
    feature.properties.code,
    statsFiltered.ventesFiltered,
    transports,
    null // ici PAS DE SCORE DE COMPATIBILITÉ
  );
}

/**
 * Rafraîchit l'affichage de la couche actuellement visualisée.
 * 
 * Cette fonction est appelée lorsque l'utilisateur applique ou réinitialise
 * les filtres. Elle réaffiche la couche active (département, commune ou section)
 * avec les nouveaux critères de filtrage, sans changer le niveau de zoom.
 */
export function rerenderCurrentLayer() {
  const currentScale = state.currentScale;

  if (currentScale === 'commune') {
    rerenderCommunes();
  } else if (currentScale === 'section') {
    rerenderSections();
  } else if (currentScale === 'department' && state.currentDept) {
    rerenderDepartment();
  }
}

/**
 * Réaffiche le panneau du département avec les nouvelles stats filtrées.
 * 
 * Utilisé lorsque l'utilisateur applique ou réinitialise les filtres
 * alors qu'il est au niveau département.
 */
function rerenderDepartment() {
  if (!state.currentDept || !state.currentDeptName) return;

  const ventesRaw = state.data.ventesByDept?.get(state.currentDept);
  const transports = [];

  let statsToDisplay;
  let compatibility = null;
  
  // Recalcul des stats avec les nouveaux filtres
  if (ventesRaw && ventesRaw.length > 0) {
    statsToDisplay = getFilteredStats(ventesRaw, transports);
    compatibility = calculateCompatibilityScore(ventesRaw, transports);
  } else {
    statsToDisplay = state.data.statsDept[state.currentDept];
  }

  // Mise à jour du panneau avec les nouvelles stats
  Panel.showDeptPanel(state.currentDeptName, statsToDisplay, transports, compatibility);
}

/**
 * Réaffiche les communes du département avec les nouvelles couleurs filtrées.
 * 
 * Utilisé lorsque l'utilisateur applique ou réinitialise les filtres
 * alors qu'il est au niveau commune. La carte est entièrement redessinée
 * avec un gradient de compatibilité si des filtres sont actifs.
 */
async function rerenderCommunes() {
  if (!state.currentDept || !state.currentDeptName) return;

  // Nettoyage de la couche actuelle
  state.layers.commune = MapView.clearLayer(state.map, state.layers.commune);

  // Rechargement des communes
  const geoCommunes = await Geo.loadCommunesGeo(state.currentDept);

  // Réaffichage avec les nouveaux filtres (gradient de compatibilité)
  state.layers.commune = MapView.renderCommunes(
    state.map,
    geoCommunes,
    state.data.prixCommune,
    (f, l) => onCommuneClick(state.currentDept, f, l),
  );

  // Mise à jour du panneau latéral
  const ventesRaw = state.data.ventesByDept?.get(state.currentDept);
  const transports = [];

  let statsToDisplay;
  let compatibility = null;
  
  if (ventesRaw && ventesRaw.length > 0) {
    statsToDisplay = getFilteredStats(ventesRaw, transports);
    compatibility = calculateCompatibilityScore(ventesRaw, transports);
  } else {
    statsToDisplay = state.data.statsDept[state.currentDept];
  }

  Panel.showDeptPanel(state.currentDeptName, statsToDisplay, transports, compatibility);
}

/**
 * Réaffiche les sections de la commune avec les nouvelles couleurs filtrées.
 * 
 * Utilisé lorsque l'utilisateur applique ou réinitialise les filtres
 * alors qu'il est au niveau section. La carte est entièrement redessinée
 * avec un gradient de compatibilité si des filtres sont actifs.
 */
function rerenderSections() {
  if (!state.currentSections || !state.currentCommuneName || !state.currentCommune) return;

  // Nettoyage de la couche actuelle
  state.layers.section = MapView.clearLayer(state.map, state.layers.section);

  // Réaffichage avec les nouveaux filtres (gradient de compatibilité)
  state.layers.section = MapView.renderSections(
    state.map,
    state.currentSections,
    state.data.prixSection,
    (f, l) => onSectionClick(state.currentCommuneName, f, l),
  );

  // Mise à jour du panneau latéral
  const ventes = state.data.ventesByCommune.get(state.currentCommune) ?? [];
  const transports = [];
  const statsFiltered = getFilteredStats(ventes, transports);
  const compatibility = calculateCompatibilityScore(ventes, transports);

  Panel.showCommunePanel(state.currentCommuneName, statsFiltered.ventesFiltered, transports, compatibility);
}