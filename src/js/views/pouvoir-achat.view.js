/**
 * Vue pour l'affichage des résultats de pouvoir d'achat
 * 
 * Ce module gère l'affichage du tableau montrant les 5 meilleures zones
 * où l'utilisateur peut acheter le plus de surface avec son budget.
 */

import { fmtEuro } from "../utils/utils.js";

/**
 * Affiche le tableau des résultats de pouvoir d'achat
 * 
 * Cette fonction prend les résultats de l'analyse et les affiche dans un tableau
 * sous la carte. Le tableau est contextualisé selon le niveau d'analyse :
 * - Vue globale : affiche les communes d'Île-de-France
 * - Vue département : affiche les communes du département
 * - Vue commune : affiche les sections de la commune
 * 
 * @param {Array} topCommunes - Liste des 5 meilleures zones (communes ou sections)
 * @param {number} budget - Budget utilisé pour l'analyse (en euros)
 * @param {string} analysisType - Type d'analyse: 'global', 'commune' ou 'section'
 */
export function renderPouvoirAchatResults(topCommunes, budget, analysisType = 'global') {
  // Récupération des éléments HTML nécessaires
  const container = document.getElementById('pouvoir-achat-results');
  const content = document.getElementById('pouvoir-achat-content');
  const budgetDisplay = document.getElementById('budget-display-value');

  // Affichage du budget au format monétaire (ex: "250 000 €")
  budgetDisplay.textContent = fmtEuro(budget);

  // Cas où aucun résultat n'est trouvé (budget trop faible, zone sans données, etc.)
  if (topCommunes.length === 0) {
    content.innerHTML = `
      <p style="text-align: center; color: #999; padding: 40px;">
        Aucune zone trouvée avec ce budget.
      </p>
    `;
    container.classList.remove('hidden');
    return;
  }

  // Titre universel simple pour tous les contextes
  const titleText = '💰 Top 5 des meilleurs endroits pour votre budget';

  // Adaptation du titre de la colonne selon le contexte
  // Si on analyse les sections d'une commune, on affiche "Section"
  // Sinon, on affiche "Commune" (pour département ou vue globale)
  let columnTitle = 'Commune';
  if (analysisType === 'section') {
    columnTitle = 'Section';
  }

  // Mise à jour du titre dans le header du tableau
  const titleElement = document.querySelector('.pouvoir-achat-header h2');
  if (titleElement) {
    titleElement.textContent = titleText;
  }

  // Construction du tableau HTML avec les résultats
  const tableHTML = buildPouvoirAchatTable(topCommunes, columnTitle);
  content.innerHTML = tableHTML;

  // Affichage du container (on retire la classe 'hidden')
  container.classList.remove('hidden');

  // Scroll automatique vers le tableau pour que l'utilisateur le voie
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Cache le tableau des résultats
 * 
 * Utilisé quand l'utilisateur clique sur "Fermer" ou réinitialise l'analyse.
 */
export function hidePouvoirAchatResults() {
  const container = document.getElementById('pouvoir-achat-results');
  container.classList.add('hidden');
}

/**
 * Construit le tableau HTML des résultats
 * 
 * Génère un tableau avec 3 colonnes :
 * - Rang (1-5) avec badge coloré (or, argent, bronze, bleu)
 * - Nom de la zone (commune ou section)
 * - Surface possible (en m²)
 * 
 * @param {Array} communes - Liste des zones à afficher (max 5)
 * @param {string} columnTitle - Titre de la 2ème colonne ("Commune" ou "Section")
 * @returns {string} - Code HTML du tableau complet
 */
function buildPouvoirAchatTable(communes, columnTitle = 'Commune') {
  // Construction des lignes du tableau (une par zone)
  const rows = communes.map((commune, index) => {
    const rank = index + 1; // Position dans le classement (1 à 5)
    const rankClass = `rank-${rank}`; // Classe CSS pour la couleur du badge
    
    return `
      <tr>
        <td>
          <div class="rank-badge ${rankClass}">${rank}</div>
        </td>
        <td>${commune.name}</td>
        <td>${commune.surfacePossible} m²</td>
      </tr>
    `;
  }).join('');

  // Retourne le tableau HTML complet avec en-têtes et lignes
  return `
    <table id="pouvoir-achat-table">
      <thead>
        <tr>
          <th>Rang</th>
          <th>${columnTitle}</th>
          <th>Surface possible</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}