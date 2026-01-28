/**
 * Vue pour le panneau de comparaison
 * 
 * Gère l'affichage des étiquettes et du tableau de comparaison
 */

import { fmtEuro } from "../utils/utils.js";

/**
 * Met à jour l'affichage du panneau de comparaison (étiquettes)
 * 
 * @param {Array} zones - Liste des zones à comparer
 * @param {number} count - Nombre de zones en comparaison
 * @param {Function} onRemove - Callback appelé lors de la suppression d'une zone
 */
export function renderComparisonPanel(zones, count, onRemove) {
  const countElement = document.getElementById('comparison-count');
  const tagsElement = document.getElementById('comparison-tags');
  const validateBtn = document.getElementById('validate-comparison');
  const panel = document.getElementById('comparison-panel');

  // Mettre à jour le compteur
  countElement.textContent = count;

  // Mettre à jour le bouton de validation (activé si 2 ou 3 zones)
  validateBtn.disabled = count < 2;

  // Si aucune zone, vider les étiquettes
  if (zones.length === 0) {
    tagsElement.innerHTML = '';
    return;
  }

  // Déplier automatiquement le panneau quand on ajoute une zone
  panel.classList.remove('collapsed');

  // Construire les étiquettes
  const tagsHTML = zones.map(zone => `
    <div class="comparison-tag">
      <div class="tag-info">
        <span class="tag-name">${zone.name}</span>
        <span class="tag-type">${zone.type}</span>
      </div>
      <button class="tag-remove" data-zone-id="${zone.id}" title="Supprimer">×</button>
    </div>
  `).join('');

  tagsElement.innerHTML = tagsHTML;

  // Attacher les événements de suppression
  tagsElement.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const zoneId = e.target.dataset.zoneId;
      onRemove(zoneId);
    });
  });
}

/**
 * Affiche le tableau de comparaison sous la carte
 * 
 * @param {Array} zones - Liste des zones à comparer
 */
export function renderComparisonTable(zones) {
  const container = document.getElementById('comparison-table-container');
  const content = document.getElementById('comparison-table-content');

  if (zones.length === 0) {
    container.classList.add('hidden');
    return;
  }

  // Construire le tableau de comparaison
  const tableHTML = buildComparisonTable(zones);
  content.innerHTML = tableHTML;

  // Afficher le container
  container.classList.remove('hidden');

  // Scroll vers le tableau
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Cache le tableau de comparaison
 */
export function hideComparisonTable() {
  const container = document.getElementById('comparison-table-container');
  container.classList.add('hidden');
}

/**
 * Construit le tableau HTML de comparaison
 * 
 * @param {Array} zones - Liste des zones à comparer
 * @returns {string} HTML du tableau
 */
function buildComparisonTable(zones) {
  // En-têtes des colonnes (noms des zones)
  const headers = zones.map(zone => `
    <th>${zone.name}</th>
  `).join('');

  // Lignes du tableau
  const rows = [
    buildRow('Type', zones, z => z.type),
    buildRow('Ventes totales', zones, z => z.stats.ventes || z.stats.nbVentes || '—'),
    buildRow('Prix médian / m²', zones, z => fmtEuro(z.stats.prixMedian)),
    buildRow('Maisons', zones, z => `${z.stats.maisons || z.stats.nbMaisons || 0} ventes`),
    buildRow('Appartements', zones, z => `${z.stats.apparts || z.stats.nbApparts || 0} ventes`),
    buildTransportRow('Métro', zones, 'METRO'),
    buildTransportRow('RER', zones, 'RER'),
    buildTransportRow('Tramway', zones, 'TRAMWAY'),
    buildTransportRow('Train', zones, 'TRAIN'),
  ].join('');

  return `
    <table id="comparison-result-table">
      <thead>
        <tr>
          <th>Critère</th>
          ${headers}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Construit une ligne du tableau
 * 
 * @param {string} label - Label de la ligne
 * @param {Array} zones - Liste des zones
 * @param {Function} getValue - Fonction pour extraire la valeur
 * @returns {string} HTML de la ligne
 */
function buildRow(label, zones, getValue) {
  const cells = zones.map(zone => {
    const value = getValue(zone);
    return `<td>${value}</td>`;
  }).join('');

  return `
    <tr>
      <td>${label}</td>
      ${cells}
    </tr>
  `;
}

/**
 * Construit une ligne pour les transports
 * 
 * @param {string} label - Label du mode de transport
 * @param {Array} zones - Liste des zones
 * @param {string} mode - Mode de transport (METRO, RER, TRAMWAY, TRAIN)
 * @returns {string} HTML de la ligne
 */
function buildTransportRow(label, zones, mode) {
  const cells = zones.map(zone => {
    const transports = zone.transports || [];
    const lines = extractTransportLines(transports, mode);
    
    if (lines.length === 0) {
      return '<td>—</td>';
    }

    // Créer des badges pour chaque ligne
    const badges = lines.map(line => {
      const cssClass = mode.toLowerCase() === 'tramway' ? 'tram' : mode.toLowerCase();
      const couleur = line.couleur || getDefaultColor(mode);
      return `<span class="transport-badge-small ${cssClass}" style="--c:${couleur}">${line.ligne}</span>`;
    }).join(' ');

    return `<td><div class="transport-badges">${badges}</div></td>`;
  }).join('');

  return `
    <tr>
      <td>${label}</td>
      ${cells}
    </tr>
  `;
}

/**
 * Extrait les lignes d'un mode de transport
 * 
 * @param {Array} transports - Liste des transports
 * @param {string} mode - Mode recherché
 * @returns {Array} Liste des lignes
 */
function extractTransportLines(transports, mode) {
  const lines = new Map();

  for (const t of transports) {
    const props = t.properties || {};
    const tMode = (props.mode || '').toUpperCase();
    
    if (tMode === mode && props.ligne) {
      if (!lines.has(props.ligne)) {
        lines.set(props.ligne, {
          ligne: props.ligne,
          couleur: props.couleur || getDefaultColor(mode)
        });
      }
    }
  }

  return Array.from(lines.values()).sort((a, b) => 
    a.ligne.localeCompare(b.ligne, 'fr', { numeric: true })
  );
}

/**
 * Retourne une couleur par défaut selon le mode de transport
 * 
 * @param {string} mode - Mode de transport
 * @returns {string} Code couleur hexadécimal
 */
function getDefaultColor(mode) {
  const colors = {
    METRO: '#1e88e5',
    RER: '#f44336',
    TRAMWAY: '#4caf50',
    TRAIN: '#9c27b0'
  };
  return colors[mode] || '#999999';
}