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

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function updateStatus(msg, type = 'info') {
  const msgEl = document.getElementById('sap-status-text');
  const iconEl = document.getElementById('sap-status-icon');
  if (msgEl) msgEl.textContent = msg;
  if (iconEl) {
    iconEl.className = 'sap-status-icon ' + type;
    iconEl.textContent = (type === 'error') ? '!' : (type === 'warn' ? '!' : '✔');
  }
}

function showToast(msg, isError = false) {
  let toast = document.getElementById('sap-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sap-toast';
    toast.className = 'sap-toast';
    document.body.appendChild(toast);
  }
  toast.className = 'sap-toast' + (isError ? ' error' : '');
  toast.innerHTML = (isError ? '⚠️ ' : '💾 ') + msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// Fetch Cost Sheet from Backend (SAP Live / Mock)
async function fetchCostSheet(vbeln, posnr) {
  currentVbeln = vbeln || currentVbeln;
  currentPosnr = posnr || currentPosnr;

  updateStatus(`Reading Sales Order ${currentVbeln} / Item ${currentPosnr} from SAP...`, 'info');

  try {
    const res = await fetch(`api.php?vbeln=${encodeURIComponent(currentVbeln)}&posnr=${encodeURIComponent(currentPosnr)}`);
    const json = await res.json();

    if (json.success && json.data) {
      costData = json.data;
      const mainWin = document.getElementById('sap-window');
      if (mainWin) mainWin.style.display = 'flex';
      renderAll();
      const srcText = json.source === 'LIVE_SAP' ? 'SAP Connected (Live)' : (json.note || 'Snapshot loaded');
      updateStatus(`Costing Sheet loaded: SO ${costData.Vbeln} Item ${costData.Posnr} [${srcText}]`, 'info');
      showToast(`Loaded ${costData.Vbeln} - ${srcText}`);
      return true;
    } else {
      updateStatus(`Error: ${json.error || 'Failed to load Cost Sheet'}`, 'error');
      showToast(json.error || 'Failed to load Cost Sheet', true);
      return false;
    }
  } catch (err) {
    updateStatus(`Network Error: ${err.message}`, 'error');
    showToast(`Network Error: ${err.message}`, true);
    return false;
  }
}

// POST / Save Cost Sheet to SAP
async function saveCostSheet() {
  if (!costData) return;

  // Gather current inputs from UI
  collectHeaderInputs();
  recalculateAll();

  updateStatus(`Posting Costing Sheet ${costData.Vbeln} to SAP ZCOST_SRV...`, 'info');
  showToast('Posting to SAP ZCOST_SRV/ZCOSTHSet...');

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
  }
}

// Render All Screens & Tables
function renderAll() {
  if (!costData) return;

  // Ensure arrays exist
  if (!costData.to_Fabric) costData.to_Fabric = { results: [] };
  if (!costData.to_Trim) costData.to_Trim = { results: [] };
  if (!costData.to_Packing) costData.to_Packing = { results: [] };
  if (!costData.to_Special) costData.to_Special = { results: [] };

  renderHeader();
  renderTable('fabric', costData.to_Fabric.results);
  renderTable('trim', costData.to_Trim.results);
  renderTable('packing', costData.to_Packing.results);
  renderBottomForm();
  recalculateAll();

  // Sync Stage Tab Badge Counts
  const fabCount = costData.to_Fabric?.results?.length || 0;
  const trimCount = costData.to_Trim?.results?.length || 0;
  const packCount = costData.to_Packing?.results?.length || 0;
  const allCount = fabCount + trimCount + packCount;

  const elAll = document.getElementById('badge-all-count');
  if (elAll) elAll.textContent = allCount;
  const elFab = document.getElementById('badge-fabric-count');
  if (elFab) elFab.textContent = fabCount;
  const elTrim = document.getElementById('badge-trim-count');
  if (elTrim) elTrim.textContent = trimCount;
  const elPack = document.getElementById('badge-packing-count');
  if (elPack) elPack.textContent = packCount;
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
    screenTitle.textContent = titleText;
    screenTitle.className = 'sap-screen-title ' + (isApproved ? 'approved' : 'not-approved');
  }

  // Approve button text
  const btnApprove = document.getElementById('btn-approve');
  if (btnApprove) {
    btnApprove.innerHTML = isApproved 
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Un-Approve</span>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Approve</span>`;
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
    const section = r.Zsection || (type === 'fabric' ? 'FABRIC' : (type === 'trim' ? 'TRIM' : 'PACKING'));
    const item = r.Item || (r.Maktx ? r.Maktx.split(' ')[0] : '');
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
      <tr data-type="${type}" data-idx="${idx}" style="animation-delay: ${idx * 0.02}s;">
        <td class="col-center sl-col">${sl}</td>
        <td>
          <input type="text" class="sap-table-cell-input" value="${escapeHtml(section)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Zsection', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="cell-coral">
          <div class="cell-dropdown-wrap">
            <span class="cell-arrow">▼</span>
            <input type="text" class="sap-table-cell-input cell-coral" value="${escapeHtml(item)}" 
                   onchange="updateRowField('${type}', ${idx}, 'Item', this.value)" ${!isEditMode ? 'readonly' : ''}>
          </div>
        </td>
        <td>
          <input type="text" class="sap-table-cell-input cell-coral" value="${escapeHtml(maktx)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Maktx', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td>
          <input type="text" class="sap-table-cell-input col-center cell-amber" value="${escapeHtml(width)}" 
                 onchange="updateRowField('${type}', ${idx}, 'WidSiz', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-coral" value="${num(net, 4)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Net', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-coral" value="${num(waste, 2)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Wste', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num cell-cyan" id="cell-gross-${type}-${idx}">${num(gross, 4)}</td>
        <td class="col-center">
          <input type="text" class="sap-table-cell-input col-center cell-curr-badge" style="width:48px;" value="${escapeHtml(curr)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Curunit', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" style="width:50px;" value="${num(convr, 2)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Convr', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(purp, 4)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Purp', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(freight, 2)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Fright', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num" value="${num(duty, 2)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Duty', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-blue" value="${num(cost, 4)}" 
                 onchange="updateRowField('${type}', ${idx}, 'Rate', this.value)" ${!isEditMode ? 'readonly' : ''}>
        </td>
        <td class="col-num cell-dark" id="cell-totalinr-${type}-${idx}">${num(totalinr, 4)}</td>
        <td class="col-num cell-blue" id="cell-totalfr-${type}-${idx}">${num(totalfr, 4)}</td>
        <td class="col-num">
          <input type="text" class="sap-table-cell-input col-num cell-fin" value="${num(fincost, 2)}" 
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
    row[field] = parseNum(rawValue).toFixed(4);
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
    sellPriceFrLabel.textContent = `SELL-PRICE-${costData.Cnv || 'EUR'}`;
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
  const cnv = document.getElementById('hdr-cnv')?.value.trim() || 'EUR';
  const cnvf = parseNum(document.getElementById('hdr-cnvf')?.value) || 1.0;
  const zzall = document.getElementById('hdr-zzall')?.checked ? 'X' : '';

  if (vbeln) costData.Vbeln = vbeln;
  if (posnr) costData.Posnr = posnr;
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

  // Special Category Sums
  let specialInr = 0;
  (costData.to_Special.results || []).forEach(r => {
    specialInr += parseNum(r.Totalinr);
  });

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

  // Update Executive Studio Top Bento KPI cards
  const kpiSellInr = document.getElementById('kpi-sellprice');
  if (kpiSellInr) kpiSellInr.textContent = '₹ ' + num(sellingPrice, 2);

  const kpiSellFr = document.getElementById('kpi-sellprice-fr');
  if (kpiSellFr) kpiSellFr.textContent = (costData.Cnv || 'EUR') + ' ' + num(sellPriceFr, 2);

  const kpiQuotaVal = document.getElementById('kpi-quota-val');
  if (kpiQuotaVal) kpiQuotaVal.textContent = 'Quote: ' + num(costData.Quota || 10, 3);

  const kpiSubtot = document.getElementById('kpi-subtot');
  if (kpiSubtot) kpiSubtot.textContent = '₹ ' + num(calculatedSubtot, 2);

  const kpiFabric = document.getElementById('kpi-fabric-tot');
  if (kpiFabric) kpiFabric.textContent = '₹ ' + num(fabricInr, 2);

  const kpiTrim = document.getElementById('kpi-trim-tot');
  if (kpiTrim) kpiTrim.textContent = '₹ ' + num(trimInr, 2);

  const kpiPacking = document.getElementById('kpi-packing-tot');
  if (kpiPacking) kpiPacking.textContent = '₹ ' + num(packingInr, 2);

  const kpiOps = document.getElementById('kpi-ops-tot');
  if (kpiOps) kpiOps.textContent = '₹ ' + num(making + overhead, 2);

  const kpiMargin = document.getElementById('kpi-margin-tot');
  if (kpiMargin) kpiMargin.textContent = num(markupP, 1) + '% / ' + num(commP, 1) + '%';

  const kpiSam = document.getElementById('kpi-sam-tot');
  if (kpiSam) kpiSam.textContent = num(costData.Sam || 10, 2) + ' min';

  const kpiMach = document.getElementById('kpi-mach-tot');
  if (kpiMach) kpiMach.textContent = costData.Nmachreq || 101;

  const kpiPcs = document.getElementById('kpi-pcs-tot');
  if (kpiPcs) kpiPcs.textContent = costData.Npeicbnd || 20;

  // Update tab badge counts
  const countFabric = document.getElementById('count-fabric');
  if (countFabric) countFabric.textContent = (costData.to_Fabric.results || []).length;

  const countTrim = document.getElementById('count-trim');
  if (countTrim) countTrim.textContent = (costData.to_Trim.results || []).length;

  const countPacking = document.getElementById('count-packing');
  if (countPacking) countPacking.textContent = (costData.to_Packing.results || []).length;
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
    btnChange.innerHTML = isEditMode
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Display Mode</span>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit Mode</span>`;
    btnChange.classList.toggle('active', isEditMode);
  }

  // Update input states
  document.querySelectorAll('.sap-table-cell-input').forEach(inp => {
    inp.readOnly = !isEditMode;
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

// Add Row to Table
function addRow(type) {
  if (!costData) return;
  const list = getRowList(type);
  if (!list) return;

  const newRow = {
    Vbeln: costData.Vbeln,
    Posnr: costData.Posnr,
    Zline: String(list.length + 1).padStart(6, '0'),
    Item: 'NEW ITEM',
    Maktx: 'Description',
    WidSiz: '52',
    Net: '1.0000',
    Wste: '5.000',
    Gross: '1.0500',
    Curunit: 'INR',
    Rate: '10.0000',
    Totalinr: '10.5000',
    Totalfr: (10.5 / (parseNum(costData.Cnvf) || 90)).toFixed(4),
    Totalper: '0.0000',
    Convr: '1.000',
    Fright: '0.000',
    Purp: '10.0000',
    Duty: '0.000',
    Fincost: '0.000',
    Slno: list.length + 1,
    Zsection: type.toUpperCase(),
    Zdeli: '',
    Uname: '',
    Udate: null,
    Utime: 'PT00H00M00S'
  };

  list.push(newRow);
  renderTable(type, list);
  recalculateAll();
  showToast(`Added row to ${type.toUpperCase()}`);
}

// Delete Row from Table
function deleteRow(type) {
  if (!costData) return;
  const list = getRowList(type);
  if (!list || list.length === 0) return;

  list.pop();
  renderTable(type, list);
  recalculateAll();
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

  const headers = ['SL', 'Section', 'Item', 'Material desc', 'Width', 'Net', 'Waste', 'Gross', 'Curr', 'E.curr', 'P.Price', 'Freight', 'Duty', 'Cost', 'Total in INR', `TT in-${costData.Cnv || 'EUR'}`, 'Fin'];
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
    fetchCostSheet(cmd, '000010');
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
  const searchInput = document.getElementById('landing-search-input');
  if (searchInput) searchInput.value = vbeln;
  handleLandingSearchSubmit();
}

function selectPresetQuotation(vbeln) {
  quickSelectQuotation(vbeln);
}

async function handleLandingSearchSubmit() {
  const searchInput = document.getElementById('landing-search-input');
  const submitBtn = document.getElementById('landing-submit-btn');
  const errorBanner = document.getElementById('landing-error-banner');

  const vbeln = (searchInput?.value || '').trim();
  const posnr = '000010';

  if (!vbeln) {
    if (errorBanner) {
      errorBanner.textContent = 'Please enter a sales order or quotation number.';
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

    // Update URL query parameters cleanly without reload
    try {
      const newUrl = `${window.location.pathname}?vbeln=${encodeURIComponent(vbeln)}&posnr=${encodeURIComponent(posnr)}`;
      window.history.pushState({ vbeln, posnr }, '', newUrl);
    } catch (e) {}
  } else {
    if (errorBanner) {
      errorBanner.textContent = `Could not load quotation "${vbeln}". Please check the number or try preset 3000008.`;
      errorBanner.classList.add('active');
    }
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


