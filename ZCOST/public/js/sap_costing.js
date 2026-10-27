/**
 * SAP ZCOST Sales Costing Sheet Application
 * Authentic SAP GUI ALV Grid Experience & Real-Time Calculation Engine
*/

let costData = null;
let isEditMode = false;
let currentVbeln = '3000008';
let currentPosnr = '000010';

// Format Helpers
function num(val, dec = 2) {
  if (val === null || val === undefined || val === '') return '-';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Parse Number Helper
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Section Dropdown Options (aligned with SAP standard domain)
const SECTION_OPTIONS = [
  'Washing',
  'Embroidery',
  'Others',
  'Packing',
  'Zips',
  'Tags',
  'Threads',
  'Fabric',
  'Button',
  'Label',
  'Trim Fabric',
  'Interlining'
];

// Get Defalut Section Type Function
function getDefaultSection(type) {
  if (type === 'fabric') return 'Fabric';
  if (type === 'trim') return 'Trim Fabric';
  if (type === 'packing') return 'Packing';
  if (type === 'special') return 'Others';
  return 'Fabric';
}

function normalizeSection(val, type) {
  if (!val || String(val).trim() === '') {
    return getDefaultSection(type);
  }
  const str = String(val).trim();
  const matched = SECTION_OPTIONS.find(opt => opt.toLowerCase() === str.toLowerCase());
  if (matched) return matched;
  if (str.toUpperCase() === 'TRIM') return 'Trim Fabric';
  if (str.toUpperCase() === 'FABRIC' || str.toUpperCase() === 'FAB') return 'Fabric';
  if (str.toUpperCase() === 'PACKING' || str.toUpperCase() === 'PACK') return 'Packing';
  return str;
}

let loaderStarted = 0;

function showLoader(msg) {
  loaderStarted = Date.now();
  const el = document.getElementById('load-overlay');
  const text = document.getElementById('load-overlay-text');
  if (text) text.textContent = msg || 'Loading costing sheet';
  if (el) el.hidden = false;
}

async function hideLoader() {
  const wait = 500 - (Date.now() - loaderStarted);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const el = document.getElementById('load-overlay');
  if (el) el.hidden = true;
}

function updateStatus(msg, type = 'info') {
  const msgEl = document.getElementById('sap-status-text');
  const iconEl = document.getElementById('sap-status-icon');
  if (msgEl) msgEl.textContent = msg;
  if (iconEl) {
    iconEl.className = 'studio-status-icon ' + type;
    iconEl.textContent = (type === 'error') ? '!' : (type === 'warn' ? '!' : '✔');
  }
}

// Header-Side Colorful Notification Modal / Toast System
function showToast(msg, type = null) {
  let toastType = 'info';
  let title = 'Information';

  // Determine type
  if (typeof type === 'boolean') {
    toastType = type ? 'error' : 'info';
  } else if (typeof type === 'string' && type) {
    toastType = type.toLowerCase();
  } else {
    // Smart deduction from message content
    const lower = String(msg).toLowerCase();
    if (lower.includes('error') || lower.includes('fail') || lower.includes('rejected') || lower.includes('aborted') || lower.includes('cannot') || lower.includes('limit of')) {
      toastType = 'error';
    } else if (lower.includes('success') || lower.includes('saved') || lower.includes('approved') || lower.includes('created') || lower.includes('loaded')) {
      toastType = 'success';
    } else if (lower.includes('search') || lower.includes('warn') || lower.includes('please') || lower.includes('not found') || lower.includes('required') || lower.includes('must be')) {
      toastType = 'warning';
    } else {
      toastType = 'info';
    }
  }

  // Titles
  if (toastType === 'success') title = 'Success';
  else if (toastType === 'error') title = 'Validation Error';
  else if (toastType === 'warning' || toastType === 'warn') { toastType = 'warning'; title = 'Notice'; }
  else { toastType = 'info'; title = 'Information'; }

  // Header-Side Toast Container
  let container = document.getElementById('sap-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sap-toast-container';
    container.className = 'sap-toast-container';
    document.body.appendChild(container);
  }

  // Clear existing toasts if stack grows beyond 3
  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }

  // Choose Icon SVG
  let iconSvg = '';
  if (toastType === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (toastType === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (toastType === 'warning') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  const toastCard = document.createElement('div');
  toastCard.className = `sap-toast-card sap-toast-${toastType}`;
  toastCard.innerHTML = `
    <div class="sap-toast-icon-badge">${iconSvg}</div>
    <div class="sap-toast-content">
      <div class="sap-toast-title">${escapeHtml(title)}</div>
      <div class="sap-toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button type="button" class="sap-toast-close" title="Dismiss" aria-label="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const dismiss = () => {
    toastCard.classList.remove('show');
    setTimeout(() => {
      if (toastCard.parentElement) toastCard.remove();
    }, 250);
  };

  const closeBtn = toastCard.querySelector('.sap-toast-close');
  if (closeBtn) closeBtn.addEventListener('click', dismiss);

  container.appendChild(toastCard);

  requestAnimationFrame(() => {
    toastCard.classList.add('show');
  });

  setTimeout(dismiss, 4200);
}

let pendingNotFoundQuotation = null;

// Fetch Cost Sheet from Backend (SAP Live / Database / Auto-Generated Master)
async function fetchCostSheet(vbeln, posnr) {
  currentVbeln = vbeln || currentVbeln;
  currentPosnr = posnr || currentPosnr;

  updateStatus(`Reading Quotation ${currentVbeln} / Item ${currentPosnr}...`, 'info');
  showLoader('Loading costing sheet');

  try {
    const res = await fetch(`api.php?vbeln=${encodeURIComponent(currentVbeln)}&posnr=${encodeURIComponent(currentPosnr)}`);
    const json = await res.json();

    if (json.success && json.data) {
      hideNotFoundModal();
      costData = json.data;
      const mainWin = document.getElementById('sap-window');
      if (mainWin) mainWin.style.display = 'flex';
      const landing = document.getElementById('evolv-landing-page');
      if (landing) landing.classList.add('hidden');
      renderAll();
      const srcText = json.is_new
        ? 'New Quotation Master Created'
        : (json.source === 'LIVE_SAP' ? 'SAP Connected (Live)' : (json.note || 'Snapshot loaded'));
      updateStatus(`Costing Sheet loaded: SO ${costData.Vbeln} Item ${costData.Posnr} [${srcText}]`, 'info');
      showToast(json.is_new ? `Created new quotation master for ${costData.Vbeln}` : `Loaded ${costData.Vbeln} - ${srcText}`);
      return true;
    } else if (json.not_found) {
      // Prompt user with Yes / No dialog: "Do you want to create new quotation master?"
      pendingNotFoundQuotation = { vbeln: currentVbeln, posnr: currentPosnr };
      showNotFoundModal(currentVbeln, currentPosnr);
      updateStatus(`Quotation ${currentVbeln} (Item ${currentPosnr}) not found. Please confirm creation.`, 'warn');
      return false;
    } else {
      updateStatus(`Error: ${json.error || 'Failed to load Cost Sheet'}`, 'error');
      showToast(json.error || 'Quotation not found', true);
      return false;
    }
  } catch (err) {
    updateStatus(`Network Error: ${err.message}`, 'error');
    return false;
  } finally {
    await hideLoader();
  }
}

// Validation Engine for SAP Fields (DDIC ZCOSTH, zcosti, ZCOSTIP from ZCost.xlsx)
function validateField(inputEl, type, extra) {
  if (!inputEl) return true;
  let val = inputEl.value;
  let isValid = true;
  let message = '';

  switch (type) {
    case 'char4': // wid_siz (CHAR4) - strictly limit to 4 characters
      if (val && val.length > 4) {
        inputEl.value = val.slice(0, 4);
        val = inputEl.value;
      }
      if (val && val.length > 4) {
        isValid = false;
        message = 'Max 4 characters allowed (SAP CHAR4)';
      }
      break;

    case 'matnr': // item (CHAR40)
    case 'maktx': // maktx (CHAR40)
      if (val && val.length > 40) {
        inputEl.value = val.slice(0, 40);
        val = inputEl.value;
      }
      if (val && val.length > 40) {
        isValid = false;
        message = 'Max 40 characters allowed (SAP CHAR40)';
      }
      break;

    case 'vbeln': // Sales Order (CHAR10)
      if (val && val.length > 10) {
        inputEl.value = val.slice(0, 10);
        val = inputEl.value;
      }
      if (!val || val.trim() === '') {
        isValid = false;
        message = 'Sales Order Number is required (SAP CHAR10)';
      }
      break;

    case 'numc6': // Item/Posnr (NUMC6)
      if (!/^\d*$/.test(val)) {
        inputEl.value = val.replace(/\D/g, '').slice(0, 6);
        val = inputEl.value;
      }
      if (val && val.length > 6) {
        inputEl.value = val.slice(0, 6);
      }
      if (!val || val.length === 0) {
        isValid = false;
        message = 'Item number required (6 digits NUMC)';
      }
      break;

    case 'waers': // Currency code (WAERS CHAR5)
      val = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
      inputEl.value = val;
      if (val.length < 2 || val.length > 5) {
        isValid = false;
        message = 'Currency must be 2-5 uppercase letters (e.g. USD, EUR, INR)';
      }
      break;

    case 'int': { // Integer with max limit (e.g. 255 for INT1, 32767 for INT2)
      const numVal = parseInt(val, 10);
      const maxLimit = typeof extra === 'number' ? extra : 32767;
      if (isNaN(numVal) || numVal < 0 || numVal > maxLimit) {
        isValid = false;
        message = `Must be an integer between 0 and ${maxLimit}`;
      }
      break;
    }

    case 'percent': { // Percentage 0 - 100
      const numVal = parseFloat(val);
      if (isNaN(numVal) || numVal < 0 || numVal > 100) {
        isValid = false;
        message = 'Percentage must be between 0.00% and 100.00%';
      }
      break;
    }

    case 'decimal': { // Non-negative decimal number
      const numVal = parseFloat(val);
      if (isNaN(numVal) || numVal < 0) {
        isValid = false;
        message = 'Must be a valid positive number';
      }
      break;
    }

    default:
      break;
  }

  if (!isValid) {
    inputEl.classList.add('is-invalid');
    inputEl.setAttribute('title', message);
  } else {
    inputEl.classList.remove('is-invalid');
    inputEl.removeAttribute('title');
  }

  return isValid;
}

// Validate entire costing sheet before sending to SAP
function validateCostSheet() {
  // 1. Check all current DOM inputs with is-invalid
  const invalidEls = document.querySelectorAll('.is-invalid');
  if (invalidEls.length > 0) {
    const firstInvalid = invalidEls[0];
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const msg = firstInvalid.getAttribute('title') || 'Please fix highlighted validation errors.';
    showToast(`Validation error: ${msg}`, true);
    return false;
  }

  // 2. Validate Header Fields
  if (!costData.Vbeln || costData.Vbeln.trim().length === 0 || costData.Vbeln.length > 10) {
    showToast('Validation Error: Sales Order (VBELN) must be 1 to 10 characters', true);
    document.getElementById('hdr-vbeln')?.focus();
    return false;
  }
  if (!costData.Posnr || !/^\d{1,6}$/.test(costData.Posnr.trim())) {
    showToast('Validation Error: Item (POSNR) must be numeric up to 6 digits', true);
    document.getElementById('hdr-posnr')?.focus();
    return false;
  }
  if (!costData.Cnv || costData.Cnv.trim().length < 2 || costData.Cnv.length > 5) {
    showToast('Validation Error: Currency (CNV) must be 2 to 5 letters', true);
    document.getElementById('hdr-cnv')?.focus();
    return false;
  }
  if (parseNum(costData.Cnvf) <= 0) {
    showToast('Validation Error: Currency Rate (CNVF) must be greater than 0', true);
    document.getElementById('hdr-cnvf')?.focus();
    return false;
  }

  // 3. Validate Commercial Parameters
  if (parseInt(costData.Nmachreq, 10) < 0 || parseInt(costData.Nmachreq, 10) > 255) {
    showToast('Validation Error: No Of Machines Req must be between 0 and 255 (SAP INT1)', true);
    document.getElementById('form-nmachreq')?.focus();
    return false;
  }
  if (parseInt(costData.Npeicbnd, 10) < 0 || parseInt(costData.Npeicbnd, 10) > 32767) {
    showToast('Validation Error: No Of Pieces per Band must be between 0 and 32767 (SAP INT2)', true);
    document.getElementById('form-npeicbnd')?.focus();
    return false;
  }

  // 4. Validate Line Items (Fabric, Trim, Packing)
  const categories = [
    { type: 'fabric', label: 'Fabric', items: costData.to_Fabric?.results || [] },
    { type: 'trim', label: 'Trim', items: costData.to_Trim?.results || [] },
    { type: 'packing', label: 'Packing', items: costData.to_Packing?.results || [] }
  ];

  for (const cat of categories) {
    for (let i = 0; i < cat.items.length; i++) {
      const row = cat.items[i];
      const sl = row.Slno || (i + 1);

      // Width / Size (WidSiz) strict max 4 chars
      if (row.WidSiz && String(row.WidSiz).length > 4) {
        showToast(`${cat.label} Row ${sl}: Width/Size "${row.WidSiz}" exceeds SAP limit of 4 characters (CHAR4)`, true);
        return false;
      }
      // Material Description max 40 chars
      if (row.Maktx && String(row.Maktx).length > 40) {
        showToast(`${cat.label} Row ${sl}: Material description exceeds 40 characters (CHAR40)`, true);
        return false;
      }
      // Waste % 0 - 100
      const waste = parseNum(row.Wste);
      if (waste < 0 || waste > 100) {
        showToast(`${cat.label} Row ${sl}: Waste% must be between 0 and 100%`, true);
        return false;
      }
      // Freight % 0 - 100
      const fright = parseNum(row.Fright);
      if (fright < 0 || fright > 100) {
        showToast(`${cat.label} Row ${sl}: Freight% must be between 0 and 100%`, true);
        return false;
      }
      // Duty % 0 - 100
      const duty = parseNum(row.Duty);
      if (duty < 0 || duty > 100) {
        showToast(`${cat.label} Row ${sl}: Duty% must be between 0 and 100%`, true);
        return false;
      }
      // Net must be non-negative
      if (parseNum(row.Net) < 0) {
        showToast(`${cat.label} Row ${sl}: Net consumption cannot be negative`, true);
        return false;
      }
    }
  }

  return true;
}

// POST / Save Cost Sheet to SAP
async function saveCostSheet() {
  if (!costData) return;

  // Gather current inputs from UI
  collectHeaderInputs();
  recalculateAll();

  // Validate before sending to SAP
  if (!validateCostSheet()) {
    updateStatus('Save aborted: please resolve validation errors.', 'warn');
    return;
  }

  updateStatus(`Posting Costing Sheet ${costData.Vbeln} to SAP ZCOST_SRV...`, 'info');
  showToast('Posting to SAP ZCOST_SRV/ZCOSTHSet...');
  showLoader('Saving costing sheet');

  try {
    const res = await fetch('api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', data: costData })
    });
    const json = await res.json();

    if (json.success) {
      if (json.source === 'LIVE_SAP') {
        costData = json.data || costData;
        renderAll();
        updateStatus(`Saved successfully to live SAP! (HTTP ${json.http_code})`, 'info');
        showToast('Successfully posted and updated in SAP!');
      } else {
        updateStatus(json.message || 'Saved in local session.', 'warn');
        showToast(json.message || 'Saved locally in active session');
      }
    } else {
      updateStatus(`Save error: ${json.error || 'SAP rejected save request'}`, 'error');
      showToast(`Save error: ${json.error || 'Rejected'}`, true);
    }
  } catch (err) {
    updateStatus(`Save request failed: ${err.message}`, 'error');
    showToast(`Error: ${err.message}`, true);
  } finally {
    await hideLoader();
  }
}

// Render All Screens & Tables
function renderAll() {
  if (!costData) return;

  // Ensure arrays exist
  if (!costData.to_Fabric || !Array.isArray(costData.to_Fabric.results)) costData.to_Fabric = { results: [] };
  if (!costData.to_Trim || !Array.isArray(costData.to_Trim.results)) costData.to_Trim = { results: [] };
  if (!costData.to_Packing || !Array.isArray(costData.to_Packing.results)) costData.to_Packing = { results: [] };
  if (!costData.to_Special || !Array.isArray(costData.to_Special.results)) costData.to_Special = { results: [] };


  renderHeader();
  renderTable('fabric', costData.to_Fabric.results);
  renderTable('trim', costData.to_Trim.results);
  renderTable('packing', costData.to_Packing.results);
  renderTable('special', costData.to_Special.results);
  renderBottomForm();
  recalculateAll();

  // Sync Stage Tab Badge Counts
  const fabCount = costData.to_Fabric?.results?.length || 0;
  const trimCount = costData.to_Trim?.results?.length || 0;
  const packCount = costData.to_Packing?.results?.length || 0;
  const specialCount = costData.to_Special?.results?.length || 0;
  const allCount = fabCount + trimCount + packCount + specialCount;

  const elAll = document.getElementById('badge-all-count');
  if (elAll) elAll.textContent = allCount;
  const elFab = document.getElementById('badge-fabric-count');
  if (elFab) elFab.textContent = fabCount;
  const elTrim = document.getElementById('badge-trim-count');
  if (elTrim) elTrim.textContent = trimCount;
  const elPack = document.getElementById('badge-packing-count');
  if (elPack) elPack.textContent = packCount;
  const elSpecial = document.getElementById('badge-special-count');
  if (elSpecial) elSpecial.textContent = specialCount;
}

// Render Window Header & Controls
function renderHeader() {
  const isApproved = (costData.Approve === 'X' || costData.Approve === 'x');
  const titleText = isApproved ? 'Sales Costing Sheet : APPROVED' : 'Sales Costing Sheet : NOT APPROVED';

  // Window titlebar
  const winTitle = document.getElementById('sap-window-title');
  if (winTitle) winTitle.textContent = titleText;

  // Screen header title
  const screenTitle = document.getElementById('sap-screen-title');
  if (screenTitle) {
    screenTitle.textContent = isApproved ? '• APPROVED' : '• NOT APPROVED';
    screenTitle.className = 'sap-screen-title ' + (isApproved ? 'approved' : 'not-approved');
  }

  // Approve button text
  const btnApprove = document.getElementById('btn-approve');
  if (btnApprove) {
    const approveIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
    btnApprove.innerHTML = isApproved 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg><span>Un-Approve</span>' 
      : approveIcon + '<span>Approve</span>';
    btnApprove.className = 'studio-btn ' + (isApproved ? 'studio-btn-outline' : 'studio-btn-approve');
  }

  // Studio header SO badge sync
  const studioSo = document.getElementById('studio-so-num');
  if (studioSo) studioSo.textContent = costData.Vbeln || currentVbeln;

  const studioPos = document.getElementById('studio-posnr-num');
  if (studioPos) studioPos.textContent = costData.Posnr || currentPosnr;

  // Header input values
  const vbelnInput = document.getElementById('hdr-vbeln');
  if (vbelnInput) vbelnInput.value = costData.Vbeln || currentVbeln;

  const navSearch = document.getElementById('nav-search-input');
  if (navSearch && (costData.Vbeln || currentVbeln)) navSearch.value = costData.Vbeln || currentVbeln;

  const posnrInput = document.getElementById('hdr-posnr');
  if (posnrInput) posnrInput.value = costData.Posnr || currentPosnr;

  const zzallCheckbox = document.getElementById('hdr-zzall');
  if (zzallCheckbox) zzallCheckbox.checked = (costData.Zzall === 'X' || costData.Zzall === 'x');

  const matnrInput = document.getElementById('hdr-matnr');
  if (matnrInput) matnrInput.value = costData.Matnr || costData.Style || '';

  const maktxInput = document.getElementById('hdr-maktx');
  if (maktxInput) maktxInput.value = costData.Maktxh || costData.StyleName || costData.MaktxHdr || '';

  const kwmengInput = document.getElementById('hdr-kwmeng');
  if (kwmengInput) kwmengInput.value = num(costData.Kwmeng ?? costData.Menge ?? costData.Qty ?? 0, 3);

  const cnvInput = document.getElementById('hdr-cnv');
  if (cnvInput) cnvInput.value = costData.Cnv || 'EUR';

  const cnvfInput = document.getElementById('hdr-cnvf');
  if (cnvfInput) cnvfInput.value = num(costData.Cnvf, 2);

  const cmdInput = document.getElementById('sap-cmd-input');
  if (cmdInput && !cmdInput.value) cmdInput.value = costData.Vbeln || '';
}

// Render ALV Table
function renderTable(type, rows) {
  const tbody = document.getElementById(`tbody-${type}`);
  if (!tbody) return;

  const cnv = costData.Cnv || 'EUR';
  // Update header column label
  const colCnvHeader = document.getElementById(`th-ttcnv-${type}`);
  if (colCnvHeader) colCnvHeader.textContent = `TT in-${cnv}`;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; color:#888; padding:12px;">No ${type} line items recorded</td></tr>`;
    return;
  }

  let html = '';
  rows.forEach((r, idx) => {
    const sl = r.Slno ? r.Slno : (idx + 1);
    const section = normalizeSection(r.Zsection, type);
    if (!r.Zsection) {
      r.Zsection = section;
    }
    const item = r.Item || '';
    const maktx = r.Maktx || '';
    const width = r.WidSiz || '';
    const net = parseNum(r.Net);
    const waste = parseNum(r.Wste);
    const gross = parseNum(r.Gross) || (net * (1 + waste / 100));
    const curr = r.Curunit || 'INR';
    const convr = parseNum(r.Convr) || 1.0;
    const purp = parseNum(r.Purp);
    const freight = parseNum(r.Fright);
    const duty = parseNum(r.Duty);
    const cost = parseNum(r.Rate);
    const fincost = parseNum(r.Fincost);
    const totalinr = parseNum(r.Totalinr) || (gross * cost);
    const totalfr = parseNum(r.Totalfr) || (totalinr / (parseNum(costData.Cnvf) || 1));

    html += `
      <tr class="${r._isNew ? 'row-enter' : ''}" data-type="${type}" data-idx="${idx}">
        <td class="col-center sl-col">${sl}</td>
        <td class="col-text cell-section-col">
          <select class="sap-table-cell-select cell-section-select" title="${escapeHtml(section)}"
                  onchange="updateRowField('${type}', ${idx}, 'Zsection', this.value)" ${!isEditMode ? 'disabled' : ''}>
            ${SECTION_OPTIONS.map(opt => `
              <option value="${escapeHtml(opt)}" ${opt.toLowerCase() === section.toLowerCase() ? 'selected' : ''}>${escapeHtml(opt)}</option>
            `).join('')}
            ${section && !SECTION_OPTIONS.some(o => o.toLowerCase() === section.toLowerCase()) ? `
              <option value="${escapeHtml(section)}" selected>${escapeHtml(section)}</option>
            ` : ''}
          </select>
        </td>
        <td class="cell-coral col-text">
          <div class="cell-dropdown-wrap">
            <span class="cell-arrow">▼</span>
            <input type="text" class="sap-table-cell-input cell-coral cell-text" title="${escapeHtml(item)}" value="${escapeHtml(item)}"
                   maxlength="40"
                   style="min-width:${Math.max(String(item).length, 4)}ch"
                   oninput="validateField(this, 'matnr')"
                   onchange="updateRowField('${type}', ${idx}, 'Item', this.value)" ${!isEditMode ? 'readonly' : ''}>
          </div>
        </td>
        <td class="col-desc">
          <input type="text" class="sap-table-cell-input cell-coral cell-text" title="${escapeHtml(maktx)}" value="${escapeHtml(maktx)}"
                   maxlength="40"
                   style="min-width:${Math.max(String(maktx).length, 12)}ch"
                   oninput="validateField(this, 'maktx')"
                   onchange="updateRowField('${type}', ${idx}, 'Maktx', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-text">
          <input type="text" class="sap-table-cell-input col-center cell-amber cell-text" title="WA_ZCOST_S-WID_SIZ" value="${escapeHtml(width)}"
                 maxlength="4" placeholder="W/S"
                 style="min-width:${Math.max(String(width).length, 4)}ch"
                 oninput="validateField(this, 'char4')"
                 onchange="updateRowField('${type}', ${idx}, 'WidSiz', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-coral" title="WA_ZCOST_S-NET" value="${num(net, 4)}" 
                 oninput="validateField(this, 'decimal', 4)"
                 onchange="updateRowField('${type}', ${idx}, 'Net', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-coral" title="WA_ZCOST_S-WSTE" value="${num(waste, 2)}" 
                 oninput="validateField(this, 'percent')"
                 onchange="updateRowField('${type}', ${idx}, 'Wste', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num cell-cyan" id="cell-gross-${type}-${idx}">${num(gross, 4)}</td>
        <td class="col-center">
          <input type="text" class="sap-table-cell-input col-center cell-curr-badge" style="width:48px; text-transform:uppercase;" value="${escapeHtml(curr)}" 
                 maxlength="5"
                 oninput="this.value = this.value.toUpperCase(); validateField(this, 'waers')"
                 onchange="updateRowField('${type}', ${idx}, 'Curunit', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" style="width:50px;" value="${num(convr, 2)}" 
                 oninput="validateField(this, 'decimal', 2)"
                 onchange="updateRowField('${type}', ${idx}, 'Convr', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(purp, 4)}" 
                 oninput="validateField(this, 'decimal', 4)"
                 onchange="updateRowField('${type}', ${idx}, 'Purp', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(freight, 2)}" 
                 oninput="validateField(this, 'percent')"
                 onchange="updateRowField('${type}', ${idx}, 'Fright', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(duty, 2)}" 
                 oninput="validateField(this, 'percent')"
                 onchange="updateRowField('${type}', ${idx}, 'Duty', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-blue" value="${num(cost, 4)}" 
                 oninput="validateField(this, 'decimal', 4)"
                 onchange="updateRowField('${type}', ${idx}, 'Rate', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num cell-dark" id="cell-totalinr-${type}-${idx}">${num(totalinr, 4)}</td>
        <td class="col-num cell-blue" id="cell-totalfr-${type}-${idx}">${num(totalfr, 4)}</td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-fin" value="${num(fincost, 2)}" 
                 oninput="validateField(this, 'decimal', 2)"
                 onchange="updateRowField('${type}', ${idx}, 'Fincost', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Update Single Row Field and Recalculate
function updateRowField(type, idx, field, rawValue) {
  const list = getRowList(type);
  if (!list || !list[idx]) return;

  const row = list[idx];
  const numFields = ['Net', 'Wste', 'Gross', 'Convr', 'Purp', 'Fright', 'Duty', 'Rate', 'Totalinr', 'Totalfr', 'Fincost'];
  if (numFields.includes(field)) {
    let n = parseNum(rawValue);
    if (['Wste', 'Fright', 'Duty'].includes(field)) {
      if (n < 0) n = 0;
      if (n > 100) n = 100;
    } else {
      if (n < 0) n = 0;
    }
    row[field] = n.toFixed(4);
  } else if (field === 'WidSiz') {
    row[field] = String(rawValue || '').slice(0, 4);
  } else if (field === 'Item' || field === 'Maktx') {
    row[field] = String(rawValue || '').slice(0, 40);
  } else if (field === 'Curunit') {
    row[field] = String(rawValue || 'INR').toUpperCase().slice(0, 5);
  } else {
    row[field] = rawValue;
  }

  // Auto-calculate Gross if Net or Waste changed
  if (field === 'Net' || field === 'Wste') {
    const net = parseNum(row.Net);
    const waste = parseNum(row.Wste);
    const gross = net * (1 + waste / 100);
    row.Gross = gross.toFixed(4);
    const cellGross = document.getElementById(`cell-gross-${type}-${idx}`);
    if (cellGross) cellGross.textContent = num(gross, 4);
  }

  // Auto-calculate Rate/Cost if Purp, Freight, Duty, Fincost, Convr changed
  if (['Purp', 'Convr', 'Fright', 'Duty', 'Fincost'].includes(field)) {
    const purp = parseNum(row.Purp);
    const convr = parseNum(row.Convr) || 1.0;
    const freight = parseNum(row.Fright);
    const duty = parseNum(row.Duty);
    const fincost = parseNum(row.Fincost);

    // Cost formula: (Purp * Convr) * (1 + (Freight + Duty + Fincost)/100) or similar
    const freightAmt = (purp * convr) * (freight / 100);
    const dutyAmt = (purp * convr) * (duty / 100);
    const calculatedRate = (purp * convr) + freightAmt + dutyAmt + fincost;
    if (calculatedRate > 0) {
      row.Rate = calculatedRate.toFixed(4);
    }
  }

  // Recalculate Total INR and Total FR for row
  const gross = parseNum(row.Gross) || parseNum(row.Net);
  const rate = parseNum(row.Rate);
  const totalinr = gross * rate;
  row.Totalinr = totalinr.toFixed(4);

  const cnvf = parseNum(costData.Cnvf) || 1.0;
  const totalfr = cnvf > 0 ? (totalinr / cnvf) : 0;
  row.Totalfr = totalfr.toFixed(4);

  // Update DOM cells
  const cellTotalInr = document.getElementById(`cell-totalinr-${type}-${idx}`);
  if (cellTotalInr) cellTotalInr.textContent = num(totalinr, 4);

  const cellTotalFr = document.getElementById(`cell-totalfr-${type}-${idx}`);
  if (cellTotalFr) cellTotalFr.textContent = num(totalfr, 4);

  recalculateAll();
}

function getRowList(type) {
  if (!costData) return null;
  if (type === 'fabric') return costData.to_Fabric.results;
  if (type === 'trim') return costData.to_Trim.results;
  if (type === 'packing') return costData.to_Packing.results;
  if (type === 'special') return costData.to_Special.results;
  return null;
}

// Render Bottom 4-Column Form Grid
function renderBottomForm() {
  if (!costData) return;

  // Column 1
  setInputValue('form-nmachreq', costData.Nmachreq || 0);
  setInputValue('form-npeicbnd', costData.Npeicbnd || 0);
  setInputValue('form-sam', num(costData.Sam, 2));

  // Column 2
  setInputValue('form-making', num(costData.Making, 3));
  setInputValue('form-overhead', num(costData.Overhead, 3));
  setInputValue('form-zwast', num(costData.Zwast, 3));

  // Column 3
  setInputValue('form-subtot', num(costData.Subtot, 4));
  setInputValue('form-markupp', num(costData.MarkupP, 3));
  setInputValue('form-markup', num(costData.Markup, 2));
  setInputValue('form-commision', num(costData.Commision, 3));
  setInputValue('form-commval', num(costData.CommVal, 2));

  // Column 4
  setInputValue('form-addcost', num(costData.AddCost, 3));
  setInputValue('form-discount', num(costData.Discount, 3));
  setInputValue('form-sellprice', num(costData.Sellprice, 2));

  const cnvRate = parseNum(costData.Cnvf) || 1.0;
  const sellPriceFr = parseNum(costData.Sellprice) / cnvRate;
  setInputValue('form-sellprice-fr', num(sellPriceFr, 2));
  setInputValue('form-quota', num(costData.Quota, 3));

  // Currency label for column 4
  const sellPriceFrLabel = document.getElementById('label-sellprice-fr');
  if (sellPriceFrLabel) {
    sellPriceFrLabel.innerHTML = `QOUC ${costData.Cnv || 'EUR'}<small>QOUC</small>`;
  }
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// Collect input values from header
function collectHeaderInputs() {
  if (!costData) return;
  const vbeln = document.getElementById('hdr-vbeln')?.value.trim();
  const posnr = document.getElementById('hdr-posnr')?.value.trim();
  const matnr = document.getElementById('hdr-matnr')?.value.trim() || '';
  const maktxh = document.getElementById('hdr-maktx')?.value.trim() || '';
  const kwmeng = parseNum(document.getElementById('hdr-kwmeng')?.value);
  const cnv = document.getElementById('hdr-cnv')?.value.trim() || 'EUR';
  const cnvf = parseNum(document.getElementById('hdr-cnvf')?.value) || 1.0;
  const zzall = document.getElementById('hdr-zzall')?.checked ? 'X' : '';

  if (vbeln) costData.Vbeln = vbeln;
  if (posnr) costData.Posnr = posnr;
  costData.Matnr = matnr;
  costData.Maktxh = maktxh;
  costData.Kwmeng = kwmeng.toFixed(3);
  costData.Cnv = cnv;
  costData.Cnvf = cnvf.toFixed(3);
  costData.Zzall = zzall;

  // Bottom form fields
  costData.Nmachreq = parseInt(document.getElementById('form-nmachreq')?.value || 0, 10);
  costData.Npeicbnd = parseInt(document.getElementById('form-npeicbnd')?.value || 0, 10);
  costData.Sam = parseNum(document.getElementById('form-sam')?.value).toFixed(2);

  costData.Making = parseNum(document.getElementById('form-making')?.value).toFixed(3);
  costData.Overhead = parseNum(document.getElementById('form-overhead')?.value).toFixed(3);
  costData.Zwast = parseNum(document.getElementById('form-zwast')?.value).toFixed(3);

  costData.MarkupP = parseNum(document.getElementById('form-markupp')?.value).toFixed(3);
  costData.Commision = parseNum(document.getElementById('form-commision')?.value).toFixed(3);
  costData.AddCost = parseNum(document.getElementById('form-addcost')?.value).toFixed(3);
  costData.Discount = parseNum(document.getElementById('form-discount')?.value).toFixed(3);
}

// Full Recalculation Engine
function recalculateAll() {
  if (!costData) return;

  const cnvf = parseNum(costData.Cnvf) || 1.0;

  // 1. Fabric Category Sums
  let fabricInr = 0, fabricFr = 0, fabricCostSum = 0, fabricFinSum = 0;
  (costData.to_Fabric.results || []).forEach(r => {
    fabricInr += parseNum(r.Totalinr);
    fabricFr += parseNum(r.Totalfr);
    fabricCostSum += parseNum(r.Rate);
    fabricFinSum += parseNum(r.Fincost);
  });
  setTableTotals('fabric', fabricCostSum, fabricInr, fabricFr, fabricFinSum);

  // 2. Trim Category Sums
  let trimInr = 0, trimFr = 0, trimCostSum = 0, trimFinSum = 0;
  (costData.to_Trim.results || []).forEach(r => {
    trimInr += parseNum(r.Totalinr);
    trimFr += parseNum(r.Totalfr);
    trimCostSum += parseNum(r.Rate);
    trimFinSum += parseNum(r.Fincost);
  });
  setTableTotals('trim', trimCostSum, trimInr, trimFr, trimFinSum);

  // 3. Packing & Services Category Sums
  let packingInr = 0, packingFr = 0, packingCostSum = 0, packingFinSum = 0;
  (costData.to_Packing.results || []).forEach(r => {
    packingInr += parseNum(r.Totalinr);
    packingFr += parseNum(r.Totalfr);
    packingCostSum += parseNum(r.Rate);
    packingFinSum += parseNum(r.Fincost);
  });
  setTableTotals('packing', packingCostSum, packingInr, packingFr, packingFinSum);

  // Special / Others Category Sums
  let specialInr = 0, specialFr = 0, specialCostSum = 0, specialFinSum = 0;
  (costData.to_Special.results || []).forEach(r => {
    specialInr += parseNum(r.Totalinr);
    specialFr += parseNum(r.Totalfr);
    specialCostSum += parseNum(r.Rate);
    specialFinSum += parseNum(r.Fincost);
  });
  setTableTotals('special', specialCostSum, specialInr, specialFr, specialFinSum);

  // Intermediate sub-total
  const calculatedSubtot = fabricInr + trimInr + packingInr + specialInr;
  costData.Subtot = calculatedSubtot.toFixed(4);
  setInputValue('form-subtot', num(calculatedSubtot, 4));

  // Markup calculation
  const markupP = parseNum(costData.MarkupP);
  const markupVal = calculatedSubtot * (markupP / 100);
  costData.Markup = markupVal.toFixed(2);
  setInputValue('form-markup', num(markupVal, 2));

  // Commission calculation
  const commP = parseNum(costData.Commision);
  const commVal = (calculatedSubtot + markupVal) * (commP / 100);
  costData.CommVal = commVal.toFixed(2);
  setInputValue('form-commval', num(commVal, 2));

  // Selling Price Calculation
  const making = parseNum(costData.Making);
  const overhead = parseNum(costData.Overhead);
  const addCost = parseNum(costData.AddCost);
  const discountP = parseNum(costData.Discount);
  const discountVal = calculatedSubtot * (discountP / 100);

  // Selling Price = Subtot + Making + Overhead + Markup + Commission + AddCost - Discount
  let sellingPrice = calculatedSubtot + making + overhead + markupVal + commVal + addCost - discountVal;
  if (sellingPrice < 0) sellingPrice = 0;

  // If user previously had a fixed Sellprice and everything else was 0, keep or respect Sellprice
  if (calculatedSubtot === 0 && parseNum(costData.Sellprice) > 0) {
    sellingPrice = parseNum(costData.Sellprice);
  }

  costData.Sellprice = sellingPrice.toFixed(3);
  setInputValue('form-sellprice', num(sellingPrice, 2));

  // Sell Price in foreign currency
  const sellPriceFr = cnvf > 0 ? (sellingPrice / cnvf) : 0;
  setInputValue('form-sellprice-fr', num(sellPriceFr, 2));

  paintKpi('kpi-sellprice', '₹ ' + num(sellingPrice, 2));
  paintKpi('kpi-sellprice-fr', (costData.Cnv || 'EUR') + ' ' + num(sellPriceFr, 2));
  paintKpi('kpi-quota-val', 'Quote: ' + num(costData.Quota || 0, 3));
  paintKpi('kpi-subtot', '₹ ' + num(calculatedSubtot, 2));
  paintKpi('kpi-fabric-tot', '₹ ' + num(fabricInr, 2));
  paintKpi('kpi-trim-tot', '₹ ' + num(trimInr, 2));
  paintKpi('kpi-packing-tot', '₹ ' + num(packingInr, 2));
  paintKpi('kpi-ops-tot', '₹ ' + num(making + overhead, 2));
  paintKpi('kpi-margin-tot', num(markupP, 1) + '% / ' + num(commP, 1) + '%');
  paintKpi('kpi-sam-tot', num(costData.Sam || 0, 2) + ' min');
  paintKpi('kpi-mach-tot', String(costData.Nmachreq || 0));
  paintKpi('kpi-pcs-tot', String(costData.Npeicbnd || 0));

  // Update tab badge counts
  const countFabric = document.getElementById('count-fabric');
  if (countFabric) countFabric.textContent = (costData.to_Fabric.results || []).length;

  const countTrim = document.getElementById('count-trim');
  if (countTrim) countTrim.textContent = (costData.to_Trim.results || []).length;

  const countPacking = document.getElementById('count-packing');
  if (countPacking) countPacking.textContent = (costData.to_Packing.results || []).length;

  const countSpecial = document.getElementById('count-special');
  if (countSpecial) countSpecial.textContent = (costData.to_Special.results || []).length;
}

function setTableTotals(type, costSum, inrSum, frSum, finSum) {
  const elCost = document.getElementById(`tot-cost-${type}`);
  if (elCost) elCost.textContent = num(costSum, 4);

  const elInr = document.getElementById(`tot-inr-${type}`);
  if (elInr) elInr.textContent = num(inrSum, 4);

  const elFr = document.getElementById(`tot-fr-${type}`);
  if (elFr) elFr.textContent = num(frSum, 4);

  const elFin = document.getElementById(`tot-fin-${type}`);
  if (elFin) elFin.textContent = num(finSum, 2);
}

// Toggle Approval Status
function toggleApprove() {
  if (!costData) return;
  const currentApprove = costData.Approve;
  if (currentApprove === 'X' || currentApprove === 'x') {
    costData.Approve = '';
    costData.Approvedby = '';
    showToast('Status changed to NOT APPROVED');
  } else {
    costData.Approve = 'X';
    costData.Approvedby = 'URAMPUR';
    showToast('Status changed to APPROVED by URAMPUR');
  }
  renderHeader();
  saveCostSheet();
}

// Toggle Edit / Change Mode
function toggleChangeMode() {
  isEditMode = !isEditMode;
  const btnChange = document.getElementById('btn-change');
  if (btnChange) {
    const changeIcon = isEditMode
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    btnChange.innerHTML = changeIcon + (isEditMode ? '<span>Display</span>' : '<span>Change</span>');
    btnChange.className = 'studio-btn studio-btn-edit' + (isEditMode ? ' active' : '');
  }
  document.body.classList.toggle('is-editing', isEditMode);

  // Update input states
  document.querySelectorAll('.sap-table-cell-input').forEach(inp => {
    inp.readOnly = !isEditMode;
  });
  document.querySelectorAll('.sap-table-cell-select').forEach(sel => {
    sel.disabled = !isEditMode;
  });

  const inputsToToggle = ['form-nmachreq', 'form-npeicbnd', 'form-sam', 'form-making', 'form-overhead', 
                          'form-zwast', 'form-markupp', 'form-commision', 'form-addcost', 'form-discount'];
  inputsToToggle.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.readOnly = !isEditMode;
  });

  updateStatus(isEditMode ? 'Changed to EDIT mode. Inputs are now editable.' : 'Changed to DISPLAY mode.', 'info');
  showToast(isEditMode ? 'Edit Mode Activated' : 'Display Mode Active');
}

function ensureBlankSheet() {
  if (costData) {
    ['to_Fabric', 'to_Trim', 'to_Packing', 'to_Special'].forEach(key => {
      if (!costData[key]) costData[key] = { results: [] };
      if (!Array.isArray(costData[key].results)) costData[key].results = [];
    });
    return;
  }
  costData = {
    Vbeln: document.getElementById('hdr-vbeln')?.value.trim() || '',
    Posnr: document.getElementById('hdr-posnr')?.value.trim() || '000010',
    Matnr: document.getElementById('hdr-matnr')?.value.trim() || '',
    Maktxh: document.getElementById('hdr-maktx')?.value.trim() || '',
    Kwmeng: document.getElementById('hdr-kwmeng')?.value || '0.000',
    Cnv: document.getElementById('hdr-cnv')?.value.trim() || 'EUR',
    Cnvf: document.getElementById('hdr-cnvf')?.value || '90.00',
    Approve: '',
    Sellprice: '0',
    Quota: '0',
    to_Fabric: { results: [] },
    to_Trim: { results: [] },
    to_Packing: { results: [] },
    to_Special: { results: [] }
  };
}

function paintKpi(id, text) {
  const el = document.getElementById(id);
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('kpi-pop');
  void el.offsetWidth;
  el.classList.add('kpi-pop');
}

// Add an empty line the user can fill in
function addRow(type) {
  ensureBlankSheet();
  if (!isEditMode) toggleChangeMode();
  const list = getRowList(type);
  if (!list) return;

  const newRow = {
    Vbeln: costData.Vbeln || '',
    Posnr: costData.Posnr || '000010',
    Zline: String(list.length + 1).padStart(6, '0'),
    Item: '',
    Maktx: '',
    WidSiz: '',
    Net: '0',
    Wste: '0',
    Gross: '0',
    Curunit: 'INR',
    Rate: '0',
    Totalinr: '0',
    Totalfr: '0',
    Totalper: '0',
    Convr: '1',
    Fright: '0',
    Purp: '0',
    Duty: '0',
    Fincost: '0',
    Slno: list.length + 1,
    Zsection: getDefaultSection(type),
    Zdeli: '',
    Uname: '',
    Udate: null,
    Utime: 'PT00H00M00S',
    _isNew: true
  };

  list.push(newRow);
  renderTable(type, list);
  delete newRow._isNew;
  recalculateAll();

  const badge = document.getElementById(`badge-${type}-count`);
  if (badge) badge.textContent = String(list.length);
  const allBadge = document.getElementById('badge-all-count');
  if (allBadge && costData) {
    const n = (costData.to_Fabric?.results?.length || 0)
      + (costData.to_Trim?.results?.length || 0)
      + (costData.to_Packing?.results?.length || 0)
      + (costData.to_Special?.results?.length || 0);
    allBadge.textContent = String(n);
  }

  const entered = document.querySelector(`#tbody-${type} tr.row-enter`);
  if (entered) {
    entered.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const focusEl = entered.querySelector('input, select');
    if (focusEl) focusEl.focus();
  }
  showToast(`Empty ${type} row added`);
}

// Delete Row from Table
function deleteRow(type) {
  if (!costData) return;
  const list = getRowList(type);
  if (!list || list.length === 0) return;

  list.pop();
  renderTable(type, list);
  recalculateAll();
  const badge = document.getElementById(`badge-${type}-count`);
  if (badge) badge.textContent = String(list.length);
  showToast(`Removed last row from ${type.toUpperCase()}`);
}

// Export Table to CSV
function exportTableToCSV(type) {
  if (!costData) return;
  const list = getRowList(type);
  if (!list || list.length === 0) {
    showToast('No data to export', true);
    return;
  }

  const headers = ['SL', 'Section', 'ITEM', 'MAKTX', 'WID_SIZ', 'NET', 'WSTE', 'GROSS', 'CURUNIT', 'CONVR', 'PURP', 'FRIGHT', 'DUTY', 'RATE', 'TOTALINR', 'TOTALFR', 'FINCOST'];
  const rows = list.map((r, i) => [
    r.Slno || (i + 1),
    `"${(r.Zsection || '').replace(/"/g, '""')}"`,
    `"${(r.Item || '').replace(/"/g, '""')}"`,
    `"${(r.Maktx || '').replace(/"/g, '""')}"`,
    r.WidSiz || '',
    r.Net || 0,
    r.Wste || 0,
    r.Gross || 0,
    r.Curunit || '',
    r.Convr || 1,
    r.Purp || 0,
    r.Fright || 0,
    r.Duty || 0,
    r.Rate || 0,
    r.Totalinr || 0,
    r.Totalfr || 0,
    r.Fincost || 0
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ZCOST_${costData.Vbeln}_${type}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${type.toUpperCase()} to CSV`);
}

// Command Box Handler
function handleCommand(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeCommand();
  }
}

function executeCommand() {
  const cmd = document.getElementById('sap-cmd-input')?.value.trim();
  if (!cmd) return;

  if (cmd.startsWith('/n') || cmd.startsWith('/N')) {
    const sub = cmd.substring(2).trim();
    if (sub.toUpperCase() === 'ZCOST') {
      fetchCostSheet(currentVbeln, currentPosnr);
      return;
    }
  }

  // If user entered a number, query that Sales Order
  if (isNumeric(cmd)) {
    fetchCostSheet(cmd, '');
  } else {
    showToast(`Command ${cmd} not recognized. Querying SO...`);
    fetchCostSheet(currentVbeln, currentPosnr);
  }
}

function isNumeric(val) {
  return /^\d+$/.test(val);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// EVOLV Landing Search Controller (Matching Image 2)
function showLandingSearch() {
  const landing = document.getElementById('evolv-landing-page');
  const mainWin = document.getElementById('sap-window');
  const searchInput = document.getElementById('landing-search-input');
  const errorBanner = document.getElementById('landing-error-banner');

  if (mainWin) mainWin.style.display = 'none';
  if (landing) landing.classList.remove('hidden');
  if (errorBanner) {
    errorBanner.classList.remove('active');
    errorBanner.textContent = '';
  }
  if (searchInput) {
    if (costData && costData.Vbeln) {
      searchInput.value = costData.Vbeln;
    }
    setTimeout(() => searchInput.focus(), 100);
  }
}

// Aliases for toolbar buttons
function openSearchModal() {
  showLandingSearch();
}

function closeSearchModal() {
  const landing = document.getElementById('evolv-landing-page');
  const mainWin = document.getElementById('sap-window');
  if (costData && landing && mainWin) {
    landing.classList.add('hidden');
    mainWin.style.display = 'flex';
  }
}

function quickSelectQuotation(vbeln) {
  const cleanVbeln = (vbeln || '').trim();
  const searchInput = document.getElementById('landing-search-input');
  if (searchInput) searchInput.value = cleanVbeln;
  const navSearch = document.getElementById('nav-search-input');
  if (navSearch) navSearch.value = cleanVbeln;
  handleLandingSearchSubmit();
}

function selectPresetQuotation(vbeln) {
  quickSelectQuotation(vbeln);
}

// Show "Quotation Master Not Found" Confirmation Modal (Yes / No)
function showNotFoundModal(vbeln, posnr) {
  const modal = document.getElementById('modal-not-found');
  const vbelnEl = document.getElementById('modal-nf-vbeln');
  const posnrEl = document.getElementById('modal-nf-posnr');

  if (vbelnEl) vbelnEl.textContent = vbeln;
  if (posnrEl) posnrEl.textContent = posnr;
  if (modal) modal.hidden = false;
}

function hideNotFoundModal() {
  const modal = document.getElementById('modal-not-found');
  if (modal) modal.hidden = true;
}

// User clicked "Yes, Create Master"
async function handleConfirmCreateMaster() {
  hideNotFoundModal();
  if (!pendingNotFoundQuotation) return;

  const { vbeln, posnr } = pendingNotFoundQuotation;
  showLoader('Creating new quotation master...');

  try {
    const res = await fetch(`api.php?vbeln=${encodeURIComponent(vbeln)}&posnr=${encodeURIComponent(posnr)}&action=create`);
    const json = await res.json();
    if (json.success && json.data) {
      costData = json.data;
    } else {
      createBlankQuotationMaster(vbeln, posnr);
    }
  } catch (err) {
    createBlankQuotationMaster(vbeln, posnr);
  } finally {
    await hideLoader();
  }

  // Auto enable edit mode so user can immediately add rows
  isEditMode = true;
  const btnEdit = document.getElementById('btn-change');
  if (btnEdit) {
    btnEdit.classList.add('studio-btn-active');
    btnEdit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg><span>Lock Mode</span>';
  }

  const landing = document.getElementById('evolv-landing-page');
  const mainWin = document.getElementById('sap-window');
  if (landing) landing.classList.add('hidden');
  if (mainWin) mainWin.style.display = 'flex';

  // Keep nav search bar in sync
  const navSearch = document.getElementById('nav-search-input');
  if (navSearch) navSearch.value = vbeln;

  renderAll();
  updateStatus(`New Quotation Master created for ${vbeln} [Item ${posnr}]`, 'info');
  showToast(`Created new quotation master for ${vbeln}`);

  // Update browser URL
  try {
    const newUrl = `${window.location.pathname}?vbeln=${encodeURIComponent(vbeln)}&posnr=${encodeURIComponent(posnr)}`;
    window.history.pushState({ vbeln, posnr }, '', newUrl);
  } catch (e) {}

  pendingNotFoundQuotation = null;
}

// User clicked "No, Search Again"
function handleCancelSearchAgain() {
  hideNotFoundModal();
  pendingNotFoundQuotation = null;

  // Make sure Landing Search Page is visible and costing sheet is hidden
  const landing = document.getElementById('evolv-landing-page');
  const mainWin = document.getElementById('sap-window');
  if (landing) landing.classList.remove('hidden');
  if (mainWin) mainWin.style.display = 'none';

  // Clear search input and focus
  const searchInput = document.getElementById('landing-search-input');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 150);
  }

  // Clear URL query parameters
  try {
    window.history.pushState({}, '', window.location.pathname);
  } catch (e) {}

  showToast('Search again. Please enter a quotation number.');
}

// Client-side fallback to create a fresh quotation master template
function createBlankQuotationMaster(vbeln, posnr = '000010') {
  costData = {
    _is_user_created: true,
    Vbeln: vbeln,
    Posnr: posnr,
    Matnr: '',
    Maktxh: '',
    Kwmeng: '0.000',
    Approve: '',
    Zzall: 'X',
    Cnv: 'USD',
    Cnvf: '87.000',
    Nmachreq: 0,
    Npeicbnd: 0,
    Sam: '0.00',
    Making: '0.000',
    Overhead: '0.000',
    Zwast: '3.000',
    Subtot: '0.0000',
    MarkupP: '20.000',
    Markup: '0.00',
    Commision: '0.000',
    CommVal: '0.00',
    AddCost: '0.000',
    Discount: '0.000',
    Sellprice: '0.000',
    Quota: '0.000',
    to_Fabric: { results: [] },
    to_Trim: { results: [] },
    to_Packing: { results: [] },
    to_Special: { results: [] }
  };
  currentVbeln = vbeln;
  currentPosnr = posnr;
}

async function handleLandingSearchSubmit() {
  const searchInput = document.getElementById('landing-search-input');
  const submitBtn = document.getElementById('landing-submit-btn');
  const errorBanner = document.getElementById('landing-error-banner');

  const vbeln = (searchInput?.value || '').trim();
  const posnr = '000010';

  if (!vbeln) {
    if (errorBanner) {
      errorBanner.textContent = 'Please enter a quotation number.';
      errorBanner.classList.add('active');
    }
    searchInput?.focus();
    return;
  }

  if (errorBanner) {
    errorBanner.classList.remove('active');
    errorBanner.textContent = '';
  }
  if (submitBtn) {
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
  }

  // Attempt fetch from backend
  const success = await fetchCostSheet(vbeln, posnr);

  if (submitBtn) {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }

  if (success) {
    const landing = document.getElementById('evolv-landing-page');
    const mainWin = document.getElementById('sap-window');
    if (landing) landing.classList.add('hidden');
    if (mainWin) mainWin.style.display = 'flex';

    // Keep nav search bar in sync
    const navSearch = document.getElementById('nav-search-input');
    if (navSearch) navSearch.value = vbeln;

    // Update URL query parameters cleanly without reload
    try {
      const newUrl = `${window.location.pathname}?vbeln=${encodeURIComponent(vbeln)}&posnr=${encodeURIComponent(posnr)}`;
      window.history.pushState({ vbeln, posnr }, '', newUrl);
    } catch (e) {}
  }
}



// Studio Section / Stage Tab Navigator
function switchStudioTab(tabId) {
  // Update active tab buttons
  document.querySelectorAll('.stage-nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  const sections = document.querySelectorAll('.studio-content-section');
  if (tabId === 'all') {
    sections.forEach(sec => {
      sec.style.display = 'block';
    });
  } else {
    sections.forEach(sec => {
      if (sec.id === `section-${tabId}`) {
        sec.style.display = 'block';
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        sec.style.display = 'none';
      }
    });
  }
}

// User Profile Dropdown Toggle
function toggleUserDropdown(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  // Toggle in studio or landing header
  const target = e?.currentTarget;
  const container = target ? target.closest('.evolv-user-menu-container') : null;
  const dd = container ? container.querySelector('.evolv-user-dropdown') : (document.getElementById('evolv-user-dropdown-studio') || document.getElementById('evolv-user-dropdown'));
  if (dd) {
    dd.classList.toggle('show');
  }
}

// Close user dropdown when clicking anywhere outside
document.addEventListener('click', (e) => {
  document.querySelectorAll('.evolv-user-dropdown.show').forEach(dd => {
    const container = dd.closest('.evolv-user-menu-container');
    if (!container || !container.contains(e.target)) {
      dd.classList.remove('show');
    }
  });
});

// Switch view to Landing Search Page
function showLandingSearch() {
  const landing = document.getElementById('evolv-landing-page');
  const mainWin = document.getElementById('sap-window');
  if (landing) landing.classList.remove('hidden');
  if (mainWin) mainWin.style.display = 'none';
  const searchInput = document.getElementById('landing-search-input');
  if (searchInput) setTimeout(() => searchInput.focus(), 150);
}

function openSearchModal() {
  showLandingSearch();
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const vbeln = urlParams.get('vbeln');
  const posnr = urlParams.get('posnr') || '000010';

  if (vbeln) {
    // If quotation was passed in URL, load it directly
    const landing = document.getElementById('evolv-landing-page');
    if (landing) landing.classList.add('hidden');
    fetchCostSheet(vbeln, posnr);
  } else {
    // VERY FIRST TIME: Show ONLY the quotation order search option like Image 2!
    const mainWin = document.getElementById('sap-window');
    if (mainWin) mainWin.style.display = 'none';
    const landing = document.getElementById('evolv-landing-page');
    if (landing) landing.classList.remove('hidden');
    const searchInput = document.getElementById('landing-search-input');
    if (searchInput) setTimeout(() => searchInput.focus(), 150);
  }
});


