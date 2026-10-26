/**
 * SAP ZCOST Interactive Frontend Application
 */

// State
let costData = window.INITIAL_COST_DATA || null;
let currentTab = 'fabric';

// Formatters
function fmtNum(val, dec = 2) {
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(sapDate) {
  if (!sapDate) return '-';
  // Remove the leading /Date( and the trailing )/
  // SAP format /Date(1684281600000)/
  const match = /\/Date\((\d+)\)\//.exec(sapDate);
  if (match) {
    const d = new Date(parseInt(match[1], 10));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return sapDate;
}

function fmtTime(sapTime) {
  if (!sapTime) return '-';
  // SAP PT18H14M51S
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(sapTime);
  if (match) {
    const h = (match[1] || '0').padStart(2, '0');
    const m = (match[2] || '0').padStart(2, '0');
    const s = (match[3] || '0').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  return sapTime;
}

// Toast helper
function showToast(msg, duration = 3000) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Switch Tabs
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = (pane.id === `pane-${tabId}`) ? 'block' : 'none';
  });

  // Clear table filter input when switching
  const filterInput = document.getElementById('table-filter');
  if (filterInput) filterInput.value = '';
  filterCurrentTable('');
}

// Filter Active Table
function filterCurrentTable(query) {
  const q = query.toLowerCase().trim();
  const activePane = document.getElementById(`pane-${currentTab}`);
  if (!activePane) return;

  const rows = activePane.querySelectorAll('tbody tr:not(.total-row)');
  let visibleCount = 0;

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    const match = !q || text.includes(q);
    row.style.display = match ? '' : 'none';
    if (match) visibleCount++;
  });
} 

// Export Table to CSV
function exportTableToCSV(filename = 'sap_cost_sheet.csv') {
  const activePane = document.getElementById(`pane-${currentTab}`);
  if (!activePane) return;
  const table = activePane.querySelector('table');
  if (!table) {
    showToast('No table data to export');
    return;
  }

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    if (tr.style.display === 'none') return;
    const row = [];
    tr.querySelectorAll('th, td').forEach(td => {
      let cellText = td.innerText.replace(/"/g, '""').trim();
      row.push(`"${cellText}"`);
    });
    rows.push(row.join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(rows.join('\r\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `${currentTab}_${filename}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${currentTab} to CSV`);
}

// Copy JSON to Clipboard
function copyJson() {
  if (!costData) return;
  navigator.clipboard.writeText(JSON.stringify(costData, null, 2))
    .then(() => showToast('Raw JSON copied to clipboard!'))
    .catch(() => showToast('Failed to copy JSON'));
}

// Download JSON file
function downloadJson() {
  if (!costData) return;
  const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(costData, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', jsonStr);
  link.setAttribute('download', `ZCOST_${costData.Vbeln || 'export'}_${costData.Posnr || 'item'}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('zcost_theme', newTheme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerHTML = newTheme === 'dark' ? '🌙' : '☀️';
  }
}

// Initialize Theme
(function initTheme() {
  const saved = localStorage.getItem('zcost_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// Attach Listeners on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Table Filter
  const filterInput = document.getElementById('table-filter');
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      filterCurrentTable(e.target.value);
    });
  }

  // Initial tab setup
  switchTab('fabric');
});
