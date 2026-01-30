/**
 * Contrôleur pour l'analyse de pouvoir d'achat
 *
 * Ce contrôleur gère l'ensemble du workflow de l'analyse de pouvoir d'achat :
 * - Ouverture et fermeture du modal de saisie du budget
 * - Lancement de l'analyse contextuelle (selon le niveau de zoom)
 * - Coordination entre le modèle (calculs) et la vue (affichage)
 * - Gestion de l'état de l'analyse (budget, résultats)
 *
 * L'analyse s'adapte au contexte de navigation de l'utilisateur :
 * - Vue globale → analyse toute l'Île-de-France
 * - Vue département → analyse uniquement les communes du département
 * - Vue commune → analyse uniquement les sections de la commune
 */

import { state } from "../app/state.js";
import {
  analyserPouvoirAchat,
  getTopCommunes,
} from "../models/pouvoir-achat.model.js";
import {
  renderPouvoirAchatResults,
  hidePouvoirAchatResults,
} from "../views/pouvoir-achat.view.js";
import * as Geo from "../models/geo.model.js";
import * as MapView from "../views/map.view.js";

// Stockage du budget actuel de l'analyse
let currentBudget = null;

// Stockage des résultats complets de l'analyse
let currentResults = null;

/**
 * Initialise le bouton "Pouvoir d'achat" dans le header
 *
 * Ajoute un écouteur d'événement sur le bouton qui ouvre le modal
 * de saisie du budget lorsque l'utilisateur clique dessus.
 */
export function initPouvoirAchatButton() {
  const btn = document.getElementById("toggle-pouvoir-achat");

  btn?.addEventListener("click", () => {
    openPouvoirAchatModal();
  });
}

/**
 * Initialise le modal de saisie du budget
 *
 * Configure tous les écouteurs d'événements du modal :
 * - Bouton "Analyser" : lance l'analyse avec le budget saisi
 * - Bouton "Annuler" : ferme le modal sans lancer d'analyse
 * - Clic en dehors du modal : ferme le modal
 * - Touche Échap : ferme le modal
 * - Bouton "Fermer" des résultats : réinitialise l'analyse
 */
export function initPouvoirAchatModal() {
  const modal = document.getElementById("pouvoir-achat-modal");
  const analyserBtn = document.getElementById("analyser-pouvoir-achat");
  const cancelBtn = document.getElementById("cancel-pouvoir-achat");
  const budgetInput = document.getElementById("budget-pouvoir-achat");
  const closeResultsBtn = document.getElementById(
    "close-pouvoir-achat-results",
  );

  // Gestion du bouton "Analyser"
  analyserBtn?.addEventListener("click", () => {
    const budget = parseFloat(budgetInput.value);

    // Validation : le budget doit être un nombre positif
    if (!budget || budget <= 0) {
      alert("⚠️ Veuillez entrer un budget valide.");
      return;
    }

    // Lancer l'analyse avec le budget saisi
    analyserBudget(budget);

    // Fermer le modal
    closeModal();

    // Réinitialiser le champ de saisie
    budgetInput.value = "";
  });

  // Gestion du bouton "Annuler"
  cancelBtn?.addEventListener("click", () => {
    closeModal();
    budgetInput.value = "";
  });

  // Fermeture du modal si l'utilisateur clique en dehors
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
      budgetInput.value = "";
    }
  });

  // Fermeture du modal avec la touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
      budgetInput.value = "";
    }
  });

  // Gestion du bouton "Fermer" dans le tableau de résultats
  closeResultsBtn?.addEventListener("click", () => {
    resetPouvoirAchatAnalysis();
  });
}

/**
 * Ouvre le modal de saisie du budget
 *
 * Retire la classe 'hidden' du modal et place automatiquement
 * le focus sur le champ de saisie pour améliorer l'UX.
 */
function openPouvoirAchatModal() {
  const modal = document.getElementById("pouvoir-achat-modal");
  modal?.classList.remove("hidden");

  // Focus automatique sur le champ de saisie après un court délai
  const budgetInput = document.getElementById("budget-pouvoir-achat");
  setTimeout(() => budgetInput?.focus(), 100);
}

/**
 * Ferme le modal de saisie du budget
 *
 * Ajoute la classe 'hidden' pour masquer le modal.
 */
function closeModal() {
  const modal = document.getElementById("pouvoir-achat-modal");
  modal?.classList.add("hidden");
}

/**
 * Lance l'analyse de pouvoir d'achat de manière contextuelle
 *
 * Cette fonction adapte automatiquement l'analyse selon le niveau de zoom :
 * - Si l'utilisateur est en vue "section" : analyse les sections de la commune
 * - Si l'utilisateur est en vue "commune" : analyse les communes du département
 * - Sinon : analyse toutes les communes d'Île-de-France
 *
 * Pour chaque zone analysée, calcule la surface maximale qu'on peut acheter
 * avec le budget donné (surface = budget / prix_au_m2).
 *
 * @param {number} budget - Budget de l'utilisateur en euros
 */
async function analyserBudget(budget) {
  // Sauvegarde du budget pour référence ultérieure
  currentBudget = budget;

  // Récupération du niveau de zoom actuel et des données de prix
  const currentScale = state.currentScale;
  const prixCommune = state.data.prixCommune;
  const prixSection = state.data.prixSection;

  let results = [];
  let analysisType = "global";

  // Cas 1 : Analyse au niveau section (zoom maximal)
  if (currentScale === "section" && state.currentCommune) {
    analysisType = "section";

    // Parcours de toutes les sections de la commune actuelle
    const sections = state.currentSections || [];
    for (const section of sections) {
      const sectionId = section.properties.id;
      const sectionCode = section.properties.code;
      const prixM2 = prixSection[sectionId];

      // Calcul de la surface possible : budget divisé par prix au m²
      if (prixM2 && prixM2 > 0) {
        const surfacePossible = Math.floor(budget / prixM2);
        results.push({
          id: sectionId,
          name: `Section ${sectionCode}`,
          prixM2: prixM2,
          surfacePossible: surfacePossible,
        });
      }
    }
  } else if (currentScale === "commune" && state.currentDept) {
    // Cas 2 : Analyse au niveau département
    analysisType = "commune";
    // Chargement des données géographiques du département
    const geoCommunes = await Geo.loadCommunesGeo(state.currentDept);
    // Utilisation de la fonction du modèle pour analyser les communes
    results = analyserPouvoirAchat(budget, prixCommune, geoCommunes);
  } else {
    // Cas 3 : Analyse au niveau global (toute l'Île-de-France)
    analysisType = "global";
    // Liste des codes départements de l'Île-de-France
    const depts = ["75", "77", "78", "91", "92", "93", "94", "95"];
    let allCommunes = { type: "FeatureCollection", features: [] };

    // Chargement des données de tous les départements
    for (const dept of depts) {
      const geoCommunes = await Geo.loadCommunesGeo(dept);
      allCommunes.features.push(...geoCommunes.features);
    }

    // Analyse de toutes les communes d'Île-de-France
    results = analyserPouvoirAchat(budget, prixCommune, allCommunes);
  }

  // Tri des résultats par surface décroissante (du plus grand au plus petit)
  results.sort((a, b) => b.surfacePossible - a.surfacePossible);
  currentResults = results;

  // Extraction des 5 meilleurs résultats
  const top5 = getTopCommunes(results, 5);

  // Affichage des résultats via la vue
  renderPouvoirAchatResults(top5, budget, analysisType);
}

/**
 * Réinitialise l'analyse de pouvoir d'achat
 *
 * Efface le budget et les résultats stockés, puis masque le tableau
 * de résultats. Utilisé quand l'utilisateur clique sur "Fermer".
 */
function resetPouvoirAchatAnalysis() {
  currentBudget = null;
  currentResults = null;
  // Masquage du tableau de résultats
  hidePouvoirAchatResults();
}

/**
 * Récupère le budget actuellement utilisé pour l'analyse
 *
 * @returns {number|null} - Budget en euros ou null si aucune analyse en cours
 */
export function getCurrentBudget() {
  return currentBudget;
}

/**
 * Récupère les résultats complets de l'analyse en cours
 *
 * @returns {Array|null} - Tableau des résultats ou null si aucune analyse en cours
 */
export function getCurrentResults() {
  return currentResults;
}
