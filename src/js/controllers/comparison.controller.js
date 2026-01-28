/**
 * Contrôleur pour la gestion du panneau de comparaison
 * 
 * Gère :
 * - Le repli/dépli du panneau
 * - L'activation/désactivation du mode comparaison
 * - L'ajout/suppression de zones dans la comparaison
 * - La validation et affichage du tableau
 */

import {
  getComparisonZones,
  getComparisonCount,
  canAddZone,
  isZoneInComparison,
  addZone,
  removeZone,
  clearComparison,
  getMaxZones,
  isComparisonModeActive,
  toggleComparisonMode
} from '../models/comparison.model.js';

import {
  renderComparisonPanel,
  renderComparisonTable,
  hideComparisonTable
} from '../views/comparison.view.js';

/**
 * Initialise le comportement de repli/dépli du panneau de comparaison
 */
export function initComparisonPanel() {
  const panel = document.getElementById('comparison-panel');
  const closeBtn = document.getElementById('close-comparison');
  const header = document.querySelector('.comparison-header');
  const validateBtn = document.getElementById('validate-comparison');
  const closeTableBtn = document.getElementById('close-comparison-table');

  // Initialement replié
  panel.classList.add('collapsed');

  // Fonction pour replier/déplier le panneau
  const togglePanel = (e) => {
    e.stopPropagation();
    panel.classList.toggle('collapsed');
  };

  // Clic sur le bouton × pour replier/déplier
  closeBtn?.addEventListener('click', togglePanel);
  
  // Clic sur le header entier pour replier/déplier
  header?.addEventListener('click', (e) => {
    if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
      togglePanel(e);
    }
  });

  // Clic sur le bouton "Valider la comparaison"
  validateBtn?.addEventListener('click', handleValidateComparison);

  // Clic sur le bouton "Fermer" du tableau
  closeTableBtn?.addEventListener('click', () => {
    hideComparisonTable();
  });

  // Affichage initial (vide)
  updateComparisonDisplay();
}

/**
 * Initialise le bouton "Mode Comparaison" dans le header
 */
export function initComparisonModeButton() {
  const btn = document.getElementById('toggle-comparison-mode');
  const statusSpan = document.getElementById('comparison-mode-status');

  btn?.addEventListener('click', () => {
    const isActive = toggleComparisonMode();
    
    // Mettre à jour l'apparence du bouton
    if (isActive) {
      btn.classList.add('active');
      statusSpan.textContent = 'ON';
    } else {
      btn.classList.remove('active');
      statusSpan.textContent = 'OFF';
    }

    console.log(`Mode Comparaison: ${isActive ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  });
}

/**
 * Tente d'ajouter une zone à la comparaison
 * (appelé depuis map.controller.js quand mode actif)
 * 
 * @param {Object} zoneData - Données de la zone
 * @returns {boolean} true si ajoutée avec succès
 */
export function tryAddZone(zoneData) {
  // Vérifier si on peut ajouter
  if (!canAddZone()) {
    alert(`⚠️ Vous ne pouvez pas ajouter plus de ${getMaxZones()} zones.\n\nSupprimez une zone pour continuer.`);
    return false;
  }

  // Vérifier si déjà présente
  if (isZoneInComparison(zoneData.id)) {
    alert(`ℹ️ Cette zone est déjà dans la comparaison.`);
    return false;
  }

  // Ajouter la zone
  const success = addZone(zoneData);
  
  if (success) {
    updateComparisonDisplay();
  }
  
  return success;
}

/**
 * Gère la suppression d'une zone
 * 
 * @param {string} zoneId - Identifiant de la zone à supprimer
 */
function handleRemoveZone(zoneId) {
  const success = removeZone(zoneId);
  
  if (success) {
    updateComparisonDisplay();
  }
}

/**
 * Gère la validation de la comparaison
 */
function handleValidateComparison() {
  const zones = getComparisonZones();
  const count = getComparisonCount();

  if (count < 2) {
    alert('⚠️ Vous devez sélectionner au moins 2 zones pour comparer.');
    return;
  }

  // Afficher le tableau de comparaison sous la carte
  renderComparisonTable(zones);
}

/**
 * Met à jour l'affichage du panneau de comparaison
 */
function updateComparisonDisplay() {
  const zones = getComparisonZones();
  const count = getComparisonCount();
  
  renderComparisonPanel(zones, count, handleRemoveZone);
}

/**
 * Vérifie si le mode comparaison est actif
 * 
 * @returns {boolean}
 */
export function checkComparisonMode() {
  return isComparisonModeActive();
}