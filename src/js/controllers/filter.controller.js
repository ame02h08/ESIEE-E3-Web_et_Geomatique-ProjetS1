import { setFilters, resetFilters } from '../models/filter.model.js';
import { rerenderCurrentLayer } from './map.controller.js';

/**
 * Initialise les écouteurs pour les filtres
 */
export function initFilterControls() {
  const applyBtn = document.getElementById('apply-filters');
  const resetBtn = document.getElementById('reset-filters');
  
  // Appliquer les filtres
  applyBtn?.addEventListener('click', () => {
    
    const budget = document.getElementById('filter-budget').value;
    const surface = document.getElementById('filter-surface').value;
    const type = document.getElementById('filter-type').value;
    const transport = document.getElementById('filter-transport').checked;
    
    setFilters({
      budget: budget ? parseFloat(budget) : null,
      surface: surface ? parseFloat(surface) : null,
      type: type || null,
      transport: transport
    });
    
    // Rafraîchir l'affichage de la carte
    rerenderCurrentLayer();
  });
  
  // Réinitialiser les filtres
  resetBtn?.addEventListener('click', () => {
    
    resetFilters();
    
    // Réinitialiser les inputs
    document.getElementById('filter-budget').value = '';
    document.getElementById('filter-surface').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-transport').checked = false;
    
    // Rafraîchir l'affichage
    rerenderCurrentLayer();
  });
}