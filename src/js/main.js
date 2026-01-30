import { state } from "./app/state.js";
import { initMap } from "./views/map.view.js";
import { initLegend } from "./views/legend.view.js";
import {
  loadDVF,
  computeStatsByDept,
  aggregateMedianByKey,
  buildIndexes
} from "./models/dvf.model.js";
import { loadTransports, loadStops } from "./models/transport.model.js";
import { startApp } from "./controllers/map.controller.js";
import { initUI } from "./controllers/ui.controller.js";
import { initFilterControls } from "./controllers/filter.controller.js";
import { initComparisonPanel, initComparisonModeButton } from "./controllers/comparison.controller.js";
import { initPouvoirAchatButton, initPouvoirAchatModal } from "./controllers/pouvoir-achat.controller.js"; // 🆕 AJOUT

//async : point d'entrée de l'application.
(async () => {

  /* =====================================================
     1) INITIALISATION CARTE LEAFLET
  ====================================================== */

  // Création de la carte dans #map + configuration zoom.
  state.map = initMap();
  // Légende dynamique associée à la heatmap DVF.
  initLegend(state.map);

  /* =====================================================
     2) CHARGEMENT & PRÉPARATION DES DONNÉES DVF
  ====================================================== */

  // Chargement des mutations DVF brutes (tableau d'objets).
  state.data.dvf = await loadDVF();

  // Calcul de statistiques par département
  // (nb ventes, médian, typologie, etc.).
  state.data.statsDept = computeStatsByDept(state.data.dvf);
  // Calcul des prix médians pour chaque commune (heatmap).
  state.data.prixCommune = aggregateMedianByKey(state.data.dvf, "commune");
  // Calcul des prix médians pour chaque section cadastrale.
  state.data.prixSection = aggregateMedianByKey(state.data.dvf, "section");

  // Construction d'indexes utiles :
  // - ventesByDept["75"] = [... ventes ...] 
  // - ventesByCommune["75056"] = [... ventes ...]
  // - ventesBySection["75056-AB"] = [... ventes ...]
  const { ventesByDept, ventesByCommune, ventesBySection } = buildIndexes(state.data.dvf);

  state.data.ventesByDept = ventesByDept; 
  state.data.ventesByCommune = ventesByCommune;
  state.data.ventesBySection = ventesBySection;

  /* =====================================================
     3) CHARGEMENT DES DONNÉES TRANSPORTS
        (avant startApp car utilisé dans les panneaux)
  ====================================================== */

  // Chargement des lignes RER, Tram, Metro, etc.
  state.data.transports = await loadTransports();
  // Chargement des arrêts / stations / gares.
  state.data.stops = await loadStops();

  /* =====================================================
     4) INITIALISATION MÉTIER DE LA MAP
        (contrôleur de navigation multi-échelles)
  ====================================================== */

  // startApp configure :
  // - l'affichage départements
  // - les interactions clic/survol
  // - la descente commune → section
  await startApp();

  /* =====================================================
     5) INITIALISATION UI (BOUTONS, FILTRES, ETC.)
  ====================================================== */

  // Activation des boutons UI (toggle transport, zoom, reset, etc.).
  initUI();

  // Initialisation des contrôles de filtrage
  initFilterControls();

  // Initialisation du panneau de comparaison
  initComparisonPanel();

  // Initialisation du bouton Mode Comparaison
  initComparisonModeButton();

  //  Initialisation du bouton Pouvoir d'achat
  initPouvoirAchatButton();
  
  // Initialisation du modal Pouvoir d'achat
  initPouvoirAchatModal();

})();