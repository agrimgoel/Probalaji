// PROBALAJI AI - Main Application Controller

// CONFIGURATION: Admin WhatsApp Number (Without country code prefix). Easily editable in future.
const ADMIN_WHATSAPP = "9045651385";

// 1. DATABASE INITIALIZATION & MOCK SEEDING
// ═══════════════════════════════════════════════════════════════
//  PASTE YOUR GOOGLE APPS SCRIPT URL BELOW (keep the quotes)
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLTO734OJ_9Z-qJkfztFEvtzk2hTDMhVaf5KbKwu_J3m0tzPl_rqAo6pJjhTLLX9RJWg/exec";
// ═══════════════════════════════════════════════════════════════

let complaints = JSON.parse(localStorage.getItem('pb_complaints')) || [];
let warrantyRegistry = [];  // Always loaded fresh from Google Sheets

// Seed database with mock data if completely empty (to make the demo look realistic immediately)
// Mock seed removed — data is loaded from Google Sheets cloud database

if (complaints.length === 0) {
  const mockComplaints = [
    {
      id: "TCK-1001",
      name: "Aarav Sharma",
      phone: "9876543210",
      address: "102 Sky Tower, Sector 62, Noida",
      product: "Promax 200AH",
      brand: "Promax",
      serial: "PRX-2026-9874",
      details: "Inverter starts beep-beeping continuously with red overload LED blinking when refrigerator is turned on. Need guidance.",
      status: "pending",
      timestamp: new Date().toISOString()
    },
    {
      id: "TCK-1002",
      name: "Priya Patel",
      phone: "9123456789",
      address: "Flat 4B, Emerald Heights, Mumbai",
      product: "Other brand inverter 12V",
      brand: "Luminous",
      serial: "LUM-8874-9021",
      details: "Inverter is not charging the battery anymore. The charging indicator is blank. Cleaned terminals, still not working.",
      status: "in-progress",
      timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    }
  ];
  localStorage.setItem('pb_complaints', JSON.stringify(mockComplaints));
  complaints = mockComplaints;
}


// 1.1 CLOUD SYNC ENGINE — 100% Direct to Google Sheets, no server needed.
// Works from any device anywhere in the world.
function loadExcelBackupAndSync() {
  const pathEl = document.getElementById('excel-file-path');
  if (pathEl) pathEl.innerText = '☁️ Google Sheets Cloud Database (Live sync — all devices worldwide)';

  // Direct GET to Google Apps Script — fully CORS-safe, works from any browser globally
  fetch(APPS_SCRIPT_URL + '?t=' + Date.now()) // cache-bust to always get fresh data
    .then(res => res.json())
    .then(result => {
      const data = Array.isArray(result) ? result : (result.data || []);
      console.log('☁️ Loaded', data.length, 'warranties from Google Sheets.');
      warrantyRegistry = data;
      updateMetrics();
      renderAdminRegistries();
    })
    .catch(err => {
      console.warn('Could not load from Google Sheets:', err);
      showToastNotification('⚠️ Could not load warranty data. Check your internet connection.');
    });
}

function openExcelBackup() {
  fetch('/api/open-excel')
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        showToastNotification("📂 Excel Backup Sheet opened successfully on your system!");
      } else if (data.status === 'unsupported') {
        alert("Launch unsupported: " + data.message);
      } else {
        alert("Failed to open Excel sheet: " + data.message);
      }
    })
    .catch(err => {
      console.error("Error opening Excel:", err);
      alert("Error contacting local server to open Excel file. Make sure Python server is running.");
    });
}

// Set default date picker to today in the admin purchase registration form
document.addEventListener('DOMContentLoaded', () => {
  // Database version upgrade: If old seed data format is detected, reset it
  if (warrantyRegistry.length > 0 && (warrantyRegistry[0].product === "Promax Tall Tubular Battery 220Ah" || !warrantyRegistry[0].brand)) {
    localStorage.removeItem('pb_warranty_registry');
    localStorage.removeItem('pb_complaints');
    location.reload();
    return;
  }

  const dateInput = document.getElementById('w-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  // Load all warranty data from Google Sheets (works on any device)
  loadExcelBackupAndSync();

  // Auto-refresh every 30 seconds so new entries from other devices show up automatically
  setInterval(loadExcelBackupAndSync, 30000);

  // Initial renders
  updateMetrics();
  renderAdminComplaints();
  renderAdminRegistries();
});


// 2. PORTAL VIEW CONTROLLER (SPA ROUTING)
function switchMainView(targetView) {
  // Toggle nav button active styles
  const custBtn = document.getElementById('tab-btn-customer');
  const admBtn = document.getElementById('tab-btn-admin');

  if (targetView === 'customer') {
    custBtn.classList.add('active');
    admBtn.classList.remove('active');
    document.getElementById('view-customer').classList.add('active');
    document.getElementById('view-admin').classList.remove('active');
  } else {
    admBtn.classList.add('active');
    custBtn.classList.remove('active');
    document.getElementById('view-admin').classList.add('active');
    document.getElementById('view-customer').classList.remove('active');

    // Check security authentication
    const isAuthenticated = sessionStorage.getItem('pb_admin_auth') === 'true';
    if (isAuthenticated) {
      document.getElementById('admin-login-panel').style.display = 'none';
      document.getElementById('admin-authenticated-console').style.display = 'block';

      // Refresh admin tables and stats
      updateMetrics();
      renderAdminComplaints();
      renderAdminRegistries();
    } else {
      document.getElementById('admin-authenticated-console').style.display = 'none';
      document.getElementById('admin-login-panel').style.display = 'block';
      document.getElementById('admin-login-error').style.display = 'none';
      setTimeout(() => {
        const pinField = document.getElementById('admin-pin');
        if (pinField) pinField.focus();
      }, 50);
    }
  }
}

// 2.1 ADMIN PIN AUTHENTICATION GATE ENGINE
const ADMIN_PIN = "PROBALAJI@2026";

function handlePinKey(event) {
  if (event.key === 'Enter') {
    verifyAdminPIN();
  }
}

function verifyAdminPIN() {
  const pinInput = document.getElementById('admin-pin');
  const errorMsg = document.getElementById('admin-login-error');

  if (pinInput.value === ADMIN_PIN) {
    sessionStorage.setItem('pb_admin_auth', 'true');
    errorMsg.style.display = 'none';
    pinInput.value = '';

    // Transition views smoothly
    document.getElementById('admin-login-panel').style.display = 'none';
    document.getElementById('admin-authenticated-console').style.display = 'block';

    // Load lists
    updateMetrics();
    renderAdminComplaints();
    renderAdminRegistries();
  } else {
    errorMsg.style.display = 'block';
    pinInput.value = '';
    pinInput.focus();
  }
}

function lockAdminConsole() {
  sessionStorage.removeItem('pb_admin_auth');
  document.getElementById('admin-authenticated-console').style.display = 'none';
  document.getElementById('admin-login-panel').style.display = 'block';
  document.getElementById('admin-pin').value = '';
}

function switchAdminSubView(targetPanel) {
  const compBtn = document.getElementById('subtab-btn-complaints');
  const warrBtn = document.getElementById('subtab-btn-warranty');

  const compPanel = document.getElementById('admin-panel-complaints');
  const warrPanel = document.getElementById('admin-panel-warranty');

  if (targetPanel === 'complaints') {
    compBtn.classList.add('active');
    warrBtn.classList.remove('active');
    compPanel.style.display = 'block';
    warrPanel.style.display = 'none';
  } else {
    warrBtn.classList.add('active');
    compBtn.classList.remove('active');
    warrPanel.style.display = 'block';
    compPanel.style.display = 'none';
  }
}

// 2.2 DYNAMIC PRODUCT BRAND CONTROLLER
function handleProductModelChange(value, prefix) {
  const brandGroup = document.getElementById(`${prefix}-brand-group`);
  const brandInput = document.getElementById(`${prefix}-brand`);

  if (brandGroup && brandInput) {
    if (value && !value.startsWith("Promax")) {
      brandGroup.style.display = "block";
      brandInput.required = true;
    } else {
      brandGroup.style.display = "none";
      brandInput.required = false;
      brandInput.value = "";
    }
  }
}

// 2.3 ADMIN BATTERY TWO-STEP SELECTOR
// Tracks the currently selected battery type ('lithium' or 'nonlithium')
let _selectedBatteryType = null;

function selectBatteryType(type) {
  _selectedBatteryType = type;

  const btnLithium    = document.getElementById('w-btn-lithium');
  const btnNonLithium = document.getElementById('w-btn-nonlithium');
  const powerRow      = document.getElementById('w-battery-power-row');
  const powerLabel    = document.getElementById('w-battery-power-label');
  const powerInput    = document.getElementById('w-battery-power');

  // Active style: highlight selected button
  const activeStyle = {
    background: 'linear-gradient(135deg, rgba(255,51,51,0.15) 0%, rgba(99,102,241,0.15) 100%)',
    borderColor: 'var(--color-primary)',
    color: '#ffffff',
    boxShadow: '0 0 12px rgba(255,51,51,0.25)'
  };
  const inactiveStyle = {
    background: 'rgba(255,255,255,0.03)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-muted)',
    boxShadow: 'none'
  };

  function applyStyle(el, styles) {
    Object.assign(el.style, styles);
  }

  if (type === 'lithium') {
    applyStyle(btnLithium, activeStyle);
    applyStyle(btnNonLithium, inactiveStyle);
    if (powerLabel) powerLabel.textContent = 'Battery Power (e.g. 48V-100Ah, 24V-200Ah)';
    if (powerInput) powerInput.placeholder = 'e.g. 48V-100Ah, 24V-150Ah, 12V-200Ah';
  } else {
    applyStyle(btnNonLithium, activeStyle);
    applyStyle(btnLithium, inactiveStyle);
    if (powerLabel) powerLabel.textContent = 'Battery Power (e.g. 150Ah, 180Ah, 220Ah)';
    if (powerInput) powerInput.placeholder = 'e.g. 100Ah, 150Ah, 180Ah, 220Ah';
  }

  // Show Step 2
  if (powerRow) powerRow.style.display = 'block';

  // Clear old value and recompose
  if (powerInput) powerInput.value = '';
  composeBatteryProductValue();

  // Focus the brand input first
  const brandInput = document.getElementById('w-battery-brand');
  setTimeout(() => { if (brandInput) brandInput.focus(); }, 50);
}

function composeBatteryProductValue() {
  const brandInput  = document.getElementById('w-battery-brand');
  const powerInput  = document.getElementById('w-battery-power');
  const hiddenInput = document.getElementById('w-product');
  if (!hiddenInput) return;

  const brand = brandInput ? brandInput.value.trim() : '';
  const power = powerInput ? powerInput.value.trim() : '';

  if (_selectedBatteryType && power) {
    const typeLabel = _selectedBatteryType === 'lithium' ? 'Lithium' : 'Non-Lithium';
    // Format: "Luminous Lithium 100Ah" or "Exide Non-Lithium 150Ah"
    hiddenInput.value = brand
      ? `${brand} ${typeLabel} ${power}`
      : `${typeLabel} ${power}`;
  } else {
    hiddenInput.value = '';
  }
}


// 3. AI QUERY SOLVER (CHAT BOT LOGIC)
function handleChatKey(event) {
  if (event.key === 'Enter') {
    submitChatMessage();
  }
}

function sendQuickTag(categoryKey) {
  const chatInput = document.getElementById('chat-input');
  if (categoryKey && BATTERY_KNOWLEDGE[categoryKey]) {
    chatInput.value = `How to resolve ${BATTERY_KNOWLEDGE[categoryKey].title.toLowerCase()}?`;
    submitChatMessage(categoryKey);
  }
}

function submitChatMessage(forcedKey = null) {
  const chatInput = document.getElementById('chat-input');
  const queryText = chatInput.value.trim();
  if (!queryText) return;

  // Render User Message
  appendChatBubble(queryText, 'user');
  chatInput.value = '';

  // Determine Answer Category based on keywords or forced tag
  let matchedKey = forcedKey;
  if (!matchedKey) {
    const textLower = queryText.toLowerCase();
    if (textLower.includes('overload') || textLower.includes('shut down') || textLower.includes('red light')) {
      matchedKey = 'overload';
    } else if (textLower.includes('charging') || textLower.includes('not charge') || textLower.includes('plugged in')) {
      matchedKey = 'charging';
    } else if (textLower.includes('backup') || textLower.includes('drain') || textLower.includes('empty quickly') || textLower.includes('duration')) {
      matchedKey = 'backup';
    } else if (textLower.includes('dead') || textLower.includes('wont turn') || textLower.includes('no power') || textLower.includes('blackout')) {
      matchedKey = 'dead';
    } else if (textLower.includes('beep') || textLower.includes('sound') || textLower.includes('alarm') || textLower.includes('noise')) {
      matchedKey = 'beep';
    } else if (textLower.includes('acid') || textLower.includes('leak') || textLower.includes('swell') || textLower.includes('bloat') || textLower.includes('bulge')) {
      matchedKey = 'acid';
    }
  }

  // Simulated AI Thinking Delay
  const chatBox = document.getElementById('chat-box');
  const thinkingId = 'ai-typing-' + Date.now();
  const thinkingBubble = document.createElement('div');
  thinkingBubble.className = 'message agent';
  thinkingBubble.id = thinkingId;
  thinkingBubble.innerHTML = `<em>PROBALAJI AI is analyzing your inquiry...</em>`;
  chatBox.appendChild(thinkingBubble);
  chatBox.scrollTop = chatBox.scrollHeight;

  setTimeout(() => {
    // Remove thinking message
    const thinkingNode = document.getElementById(thinkingId);
    if (thinkingNode) thinkingNode.remove();

    // Compile Response Content
    let responseHtml = "";
    if (matchedKey && BATTERY_KNOWLEDGE[matchedKey]) {
      const info = BATTERY_KNOWLEDGE[matchedKey];
      responseHtml = `
        <strong>AI Diagnostic Result: ${info.title}</strong><br><br>
        <strong>Common Symptoms:</strong>
        <ul style="padding-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0.75rem;">
          ${info.symptoms.map(s => `<li>${s}</li>`).join('')}
        </ul>
        
        <div class="solution-box">
          <h4>🛠️ Step-by-Step Solutions:</h4>
          <ul>
            ${info.solutions.map(sol => `<li>${sol}</li>`).join('')}
          </ul>
        </div>
        
        <div class="safety-box">
          <strong>CRITICAL SAFETY WARNING:</strong> ${info.safety}
        </div>
        <br>
        If these solutions do not resolve the issue, please scroll down to register a formal complaint ticket so our admin team can assist on site!
      `;
    } else {
      // General fall-back helpful message
      responseHtml = `
        I've processed your query about inverters/batteries, but I couldn't isolate a specific single fault signature. Let's do a quick diagnosis:<br><br>
        1. **Check the mains input**: Is your household grid power working? If mains is off, the inverter is expected to beep occasionally.<br>
        2. **Inspect water floats**: If you have a tubular lead-acid battery, are all the yellow indicator indicators floats up in the green section? Low water causes high battery stress.<br>
        3. **Is it overload?**: Unplug refrigerators and air conditioners to see if it starts back up.<br><br>
        Please clarify your symptoms or choose one of our quick diagnostics badges (e.g. *Overload*, *Low Backup*, *Swelling*) for structured checklist assistance.
      `;
    }

    appendChatBubble(responseHtml, 'agent');
  }, 1000);
}

function appendChatBubble(htmlText, sender) {
  const chatBox = document.getElementById('chat-box');
  const bubble = document.createElement('div');
  bubble.className = `message ${sender}`;
  bubble.innerHTML = htmlText;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
}


// 4. PROMAX WARRANTY ENGINE & LOOKUP
function calculateWarrantyStatus(purchaseDateStr, durationMonths) {
  const purchaseDate = new Date(purchaseDateStr);
  const duration = parseInt(durationMonths, 10);

  // Expiration date
  const expirationDate = new Date(purchaseDate);
  expirationDate.setMonth(purchaseDate.getMonth() + duration);

  const currentDate = new Date();

  // Calculate difference
  const totalDays = Math.ceil((expirationDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  const isUnderWarranty = remainingDays > 0;
  const elapsedDays = totalDays - Math.max(0, remainingDays);
  const remainingPercent = isUnderWarranty ? Math.max(0, Math.min(100, Math.floor((remainingDays / totalDays) * 100))) : 0;

  return {
    isUnderWarranty,
    purchaseDateFormatted: purchaseDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    expirationDateFormatted: expirationDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    totalDays,
    remainingDays: Math.max(0, remainingDays),
    remainingPercent,
    statusText: isUnderWarranty ? "Under Warranty" : "Warranty Expired"
  };
}

function lookupWarranty() {
  const serialInput = document.getElementById('lookup-serial').value.trim().toUpperCase();
  const resultCard = document.getElementById('warranty-result');

  if (!serialInput) {
    alert("Please enter a product serial number to search.");
    return;
  }

  // Filter for matching registries by Serial Number
  const matches = warrantyRegistry.filter(record => record.serial.toUpperCase() === serialInput);

  if (matches.length === 0) {
    resultCard.style.display = 'flex';
    resultCard.innerHTML = `
      <div style="text-align: center; padding: 1rem 0;">
        <span style="font-size: 2rem;">🔍</span>
        <h4 style="margin-top: 0.5rem; color: var(--color-danger)">No Registered Warranty Found</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
          No warranty records match serial number <strong>${serialInput}</strong>. Make sure you entered it correctly.
        </p>
      </div>
    `;
    return;
  }

  // Build lookup report
  let cardsHtml = `<h4 style="color: var(--color-secondary); margin-bottom: 0.75rem;">Warranty Records Found (${matches.length})</h4>`;

  matches.forEach(match => {
    const analysis = calculateWarrantyStatus(match.date, match.duration);

    // Status button html
    const statusBtnHtml = analysis.isUnderWarranty
      ? `<div style="background: linear-gradient(135deg, #047857 0%, #064e3b 100%); color: #ffffff; border: 1.5px solid #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); text-align: center; padding: 0.9rem; border-radius: 0.75rem; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.05em; margin-bottom: 1.25rem; text-transform: uppercase;">🟢 ACTIVE WARRANTY COVERAGE</div>`
      : `<div style="background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: #ffffff; border: 1.5px solid #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); text-align: center; padding: 0.9rem; border-radius: 0.75rem; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.05em; margin-bottom: 1.25rem; text-transform: uppercase;">🔴 WARRANTY PERIOD FINISHED</div>`;

    // Choose battery color class
    let colorClass = "";
    if (analysis.remainingPercent > 50) {
      colorClass = ""; // Normal green
    } else if (analysis.remainingPercent > 20) {
      colorClass = "warning"; // Amber
    } else {
      colorClass = "danger"; // Red
    }

    cardsHtml += `
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem; margin-bottom: 1.25rem; &:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }">
        ${statusBtnHtml}
        
        <div class="warranty-header-row">
          <div>
            <div class="warranty-product-name">${match.brand} ${match.product}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Serial No: ${match.serial}</div>
          </div>
          <span class="warranty-badge ${analysis.isUnderWarranty ? 'active' : 'expired'}">
            ${analysis.statusText}
          </span>
        </div>
        
        <div class="battery-visualizer-container" style="margin: 1rem 0;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
            <span>Warranty Lifespan Status</span>
            <span>${analysis.remainingPercent}% Coverage Left</span>
          </div>
          <div class="battery-row">
            <div class="battery-body-outline">
              <div class="battery-liquid-fill ${colorClass}" style="width: ${analysis.remainingPercent}%;">
                <div class="battery-fill-text">${analysis.remainingDays} Days Left</div>
              </div>
            </div>
            <div class="battery-terminal-node"></div>
          </div>
        </div>
        
        <div class="warranty-timeline-details" style="grid-template-columns: repeat(2, 1fr); gap: 0.75rem 1.5rem; display: grid;">
          <div class="time-detail-item">
            <div class="time-detail-label">Registered Owner</div>
            <div class="time-detail-val">${match.name}</div>
          </div>
          <div class="time-detail-item">
            <div class="time-detail-label">Registered Mobile</div>
            <div class="time-detail-val">${match.phone}</div>
          </div>
          <div class="time-detail-item" style="grid-column: span 2;">
            <div class="time-detail-label">Installation Address</div>
            <div class="time-detail-val">${match.address}</div>
          </div>
          <div class="time-detail-item">
            <div class="time-detail-label">Product Model</div>
            <div class="time-detail-val">${match.product}</div>
          </div>
          <div class="time-detail-item">
            <div class="time-detail-label">Product Brand</div>
            <div class="time-detail-val">${match.brand}</div>
          </div>
          <div class="time-detail-item">
            <div class="time-detail-label">Purchased On</div>
            <div class="time-detail-val">${analysis.purchaseDateFormatted}</div>
          </div>
          <div class="time-detail-item">
            <div class="time-detail-label">Coverage Period</div>
            <div class="time-detail-val">${match.duration} Months</div>
          </div>
          <div class="time-detail-item" style="grid-column: span 2;">
            <div class="time-detail-label">Expiration Date</div>
            <div class="time-detail-val" style="color: #ff3333;">${analysis.expirationDateFormatted}</div>
          </div>
        </div>
      </div>
    `;
  });

  resultCard.style.display = 'flex';
  resultCard.innerHTML = cardsHtml;
}


// 5. CUSTOMER COMPLAINT REGISTRATION
function handleNameInput(nameVal) {
  const nameIndicator = document.getElementById('name-lookup-indicator');
  const phoneField = document.getElementById('comp-phone');
  const addressField = document.getElementById('comp-address');
  const productField = document.getElementById('comp-product');
  const serialWrapper = document.getElementById('serial-input-wrapper');

  if (!nameVal || nameVal.trim().length < 3) {
    if (nameIndicator) nameIndicator.style.display = 'none';
    return;
  }

  // Find case-insensitive exact name matches in warranty registry
  const matches = warrantyRegistry.filter(record => record.name.toLowerCase() === nameVal.trim().toLowerCase());

  if (matches.length > 0) {
    if (nameIndicator) nameIndicator.style.display = 'block';

    // Autofill phone and address
    phoneField.value = matches[0].phone;
    addressField.value = matches[0].address;

    if (matches.length === 1) {
      // Exactly 1 product registered
      productField.value = matches[0].product;
      handleProductModelChange(matches[0].product, 'comp');
      const brandField = document.getElementById('comp-brand');
      if (brandField) brandField.value = matches[0].brand || "";

      serialWrapper.innerHTML = `<input type="text" id="comp-serial" class="input-styled" value="${matches[0].serial}" required>`;
    } else {
      // Multiple products registered under this name
      window.currentCustomerMatches = matches;

      let dropdownHtml = `<select id="comp-serial" class="input-styled" required onchange="handleSerialDropdownChange(this.value)">`;
      dropdownHtml += `<option value="" disabled selected>-- Select Your Battery Serial No. --</option>`;
      matches.forEach(match => {
        dropdownHtml += `<option value="${match.serial}">${match.serial} (${match.brand} ${match.product})</option>`;
      });
      dropdownHtml += `<option value="manual">Enter other manually...</option>`;
      dropdownHtml += `</select>`;

      serialWrapper.innerHTML = dropdownHtml;
      // Clear product select until they choose a serial from dropdown
      productField.value = "";
      handleProductModelChange("", 'comp');
    }
  } else {
    if (nameIndicator) nameIndicator.style.display = 'none';
    // Switch back to normal serial input if it was swapped to select
    if (serialWrapper.querySelector('select')) {
      serialWrapper.innerHTML = `<input type="text" id="comp-serial" class="input-styled" placeholder="e.g. PRX-2026-9874" required>`;
    }
  }
}

function handleSerialDropdownChange(serialVal) {
  const productField = document.getElementById('comp-product');
  const serialWrapper = document.getElementById('serial-input-wrapper');
  const brandField = document.getElementById('comp-brand');

  if (serialVal === 'manual') {
    serialWrapper.innerHTML = `<input type="text" id="comp-serial" class="input-styled" placeholder="e.g. PRX-2026-9874" required>`;
    productField.value = "";
    handleProductModelChange("", 'comp');
    // focus the field
    setTimeout(() => {
      const serialField = document.getElementById('comp-serial');
      if (serialField) serialField.focus();
    }, 50);
    return;
  }

  if (window.currentCustomerMatches) {
    const match = window.currentCustomerMatches.find(m => m.serial === serialVal);
    if (match) {
      productField.value = match.product;
      handleProductModelChange(match.product, 'comp');
      if (brandField) brandField.value = match.brand || "";
    }
  }
}

function showToastNotification(message) {
  const toast = document.getElementById('live-toast');
  const toastMsg = document.getElementById('toast-message');

  if (toast && toastMsg) {
    toastMsg.innerText = message;
    toast.style.display = 'flex';

    // Snappy transitions using transform
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 50);

    // Auto close
    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, 6000);
  }
}

function registerComplaint(event) {
  event.preventDefault();

  const name = document.getElementById('comp-name').value.trim();
  const phone = document.getElementById('comp-phone').value.trim();
  const address = document.getElementById('comp-address').value.trim();
  const product = document.getElementById('comp-product').value;
  const serial = document.getElementById('comp-serial').value.trim();
  const details = document.getElementById('comp-desc').value.trim();

  const newTicket = {
    id: "TCK-" + Math.floor(1000 + Math.random() * 9000),
    name,
    phone,
    address,
    product,
    serial,
    details,
    status: "pending",
    timestamp: new Date().toISOString()
  };

  complaints.unshift(newTicket);
  localStorage.setItem('pb_complaints', JSON.stringify(complaints));

  // Calculate Call times
  const now = new Date();
  const callbackTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour call limit

  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const nowStr = now.toLocaleTimeString('en-US', timeOptions);
  const callbackStr = callbackTime.toLocaleTimeString('en-US', timeOptions);
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  // Update customer popup overlay message
  document.getElementById('complaint-success-message').innerHTML = `
    Your complaint has been successfully registered!<br>
    <strong>Our representative will call you under 1 hour.</strong>
  `;

  document.getElementById('complaint-time-details').innerHTML = `
    Registered On: <strong>${nowStr} (${dateStr})</strong><br>
    Assured Call Before: <strong style="color: #ff3333;">${callbackStr}</strong>
  `;

  // Open popup
  document.getElementById('complaint-success').style.display = 'flex';

  // Trigger Live Toast notification (Admin Alert)
  showToastNotification(`🔔 New Ticket Alert: Complaint logged by ${name} for serial ${serial}!`);

  // Auto update admin table in background
  updateMetrics();
  renderAdminComplaints();

  // Auto open whatsapp details to Admin number
  const matchSales = warrantyRegistry.filter(record => record.serial === serial || record.phone === phone);
  const waLink = compileWhatsAppLink(newTicket, matchSales[0]);

  setTimeout(() => {
    window.open(waLink, '_blank');
  }, 1000);
}

function resetComplaintForm() {
  document.getElementById('complaint-form').reset();

  // Hide lookup indicator
  const nameIndicator = document.getElementById('name-lookup-indicator');
  if (nameIndicator) nameIndicator.style.display = 'none';

  // Restore default serial input field if it was converted to select
  const serialWrapper = document.getElementById('serial-input-wrapper');
  if (serialWrapper) {
    serialWrapper.innerHTML = `<input type="text" id="comp-serial" class="input-styled" placeholder="e.g. PRX-2026-9874" required>`;
  }

  document.getElementById('complaint-success').style.display = 'none';
}


// 6. ADMIN - PROMAX SALES REGISTER
function registerPromaxSale(event) {
  event.preventDefault();

  const name = document.getElementById('w-name').value.trim();
  const phone = document.getElementById('w-phone').value.trim();
  const address = document.getElementById('w-address').value.trim();
  const productVal = document.getElementById('w-product').value.trim();
  const serial = document.getElementById('w-serial').value.trim();
  const date = document.getElementById('w-date').value;
  const duration = document.getElementById('w-duration').value;

  // Validate product model was fully filled
  if (!productVal) {
    alert('Please select a battery type (Lithium / Non-Lithium) and enter the battery power before submitting.');
    return;
  }

  // For the new battery selector model the brand is derived from the brand input
  const batteryBrandInput = document.getElementById('w-battery-brand');
  const brandVal = batteryBrandInput && batteryBrandInput.value.trim()
    ? batteryBrandInput.value.trim()
    : (_selectedBatteryType === 'lithium' ? 'Lithium' : 'Non-Lithium');

  const cardInput = document.getElementById('w-card-given');
  const cardGiven = cardInput ? (cardInput.checked ? 'Yes' : 'No') : 'No';

  const newSale = {
    name,
    phone,
    address,
    product: productVal,
    brand: brandVal,
    serial,
    date,
    duration,
    cardGiven: cardGiven
  };

  // ── Direct save to Google Sheets via Apps Script ──────────────────
  // Uses no-cors POST: data is sent & saved in Google Sheets.
  // Works from any device, any browser, anywhere in the world.
  const payload = Object.assign({}, newSale, { action: 'add' });

  showToastNotification('💾 Saving to Google Sheets...');

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',   // Bypasses CORS preflight; data goes through to Apps Script
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(() => {
      // no-cors gives opaque response — data WAS sent. Show success and reload.
      document.getElementById('warranty-success').style.display = 'flex';
      // Wait 2.5s for Google Sheets to process, then pull fresh data
      setTimeout(() => loadExcelBackupAndSync(), 2500);
    })
    .catch(err => {
      console.error('Save failed:', err);
      showToastNotification('❌ Could not save. Check your internet connection.');
    });
}

function resetWarrantyForm() {
  document.getElementById('warranty-register-form').reset();
  document.getElementById('warranty-success').style.display = 'none';

  // Reset battery two-step selector
  _selectedBatteryType = null;
  const powerRow = document.getElementById('w-battery-power-row');
  if (powerRow) powerRow.style.display = 'none';
  const powerInput = document.getElementById('w-battery-power');
  if (powerInput) powerInput.value = '';
  const brandInput = document.getElementById('w-battery-brand');
  if (brandInput) brandInput.value = '';
  const hiddenProduct = document.getElementById('w-product');
  if (hiddenProduct) hiddenProduct.value = '';

  // Reset button styles to inactive
  const btnLi  = document.getElementById('w-btn-lithium');
  const btnNon = document.getElementById('w-btn-nonlithium');
  const inactiveStyle = {
    background: 'rgba(255,255,255,0.03)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-muted)',
    boxShadow: 'none'
  };
  if (btnLi)  Object.assign(btnLi.style,  inactiveStyle);
  if (btnNon) Object.assign(btnNon.style, inactiveStyle);

  // Set date field back to default today
  const dateInput = document.getElementById('w-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  const cardInput = document.getElementById('w-card-given');
  if (cardInput) {
    cardInput.checked = false;
  }
}


// 7. ADMIN - SYSTEM DASHBOARD RENDERERS
function updateMetrics() {
  const totalVal = document.getElementById('metric-total');
  const pendingVal = document.getElementById('metric-pending');
  const activeVal = document.getElementById('metric-active');
  const warrantyVal = document.getElementById('metric-warranty');

  if (totalVal && pendingVal && activeVal && warrantyVal) {
    totalVal.innerText = complaints.length;
    pendingVal.innerText = complaints.filter(c => c.status === 'pending').length;
    activeVal.innerText = complaints.filter(c => c.status === 'in-progress').length;
    warrantyVal.innerText = warrantyRegistry.length;
  }
}

function renderAdminComplaints() {
  const tableBody = document.getElementById('complaints-table-body');
  if (!tableBody) return;

  const filterStatus = document.getElementById('filter-complaints-status').value;
  const searchQuery = document.getElementById('search-complaints').value.trim().toLowerCase();

  // Filter complaints array
  let filtered = complaints.filter(c => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery) ||
      c.phone.includes(searchQuery) ||
      c.serial.toLowerCase().includes(searchQuery) ||
      c.id.toLowerCase().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-data-row">
          <span class="empty-data-icon">📂</span>
          No complaints matching current filters found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(c => {
    // Determine dynamic warranty connection
    let warrantyMarkup = "";

    // Check if serial matches any Promax warranty registration
    const matchSales = warrantyRegistry.filter(record => record.serial === c.serial || record.phone === c.phone);
    if (matchSales.length > 0) {
      // Use the closest match
      const analysis = calculateWarrantyStatus(matchSales[0].date, matchSales[0].duration);
      if (analysis.isUnderWarranty) {
        warrantyMarkup = `<span class="warranty-status-tag active">Promax: Under Warranty</span>`;
      } else {
        warrantyMarkup = `<span class="warranty-status-tag expired">Promax: Expired</span>`;
      }
    } else {
      // General or other brand inverter
      warrantyMarkup = `<span style="font-size: 0.75rem; color: var(--text-muted)">Non-Promax / Unregistered</span>`;
    }

    // Compile pre-filled WhatsApp alert text URL link
    const waLink = compileWhatsAppLink(c, matchSales[0]);

    return `
      <tr>
        <td style="font-weight: 700; color: var(--color-secondary);">${c.id}</td>
        <td>
          <div style="font-weight: 600; color: #ffffff;">${c.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Phone: ${c.phone}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Addr: ${c.address}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${c.product}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; font-family: monospace;">Serial: ${c.serial}</div>
          <div style="font-size: 0.8rem; color: #d1d5db; margin-top: 0.4rem; font-style: italic; max-width: 250px; white-space: normal;">"${c.details}"</div>
        </td>
        <td>${warrantyMarkup}</td>
        <td>
          <select class="select-table-status" onchange="updateComplaintStatus('${c.id}', this.value)">
            <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in-progress" ${c.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </td>
        <td>
          <div class="action-buttons-cell">
            <a href="${waLink}" target="_blank" class="btn-icon whatsapp-btn" title="Contact admin / technician on WhatsApp">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.59 1.978 14.12 .952 11.487.95c-5.438 0-9.863 4.372-9.867 9.8.001 2.13.588 4.21 1.705 5.968l-.407 1.485.461-.17 1.498-.549 1.18.72zm11.367-6.593c-.31-.154-1.834-.905-2.119-1.01-.284-.104-.49-.154-.697.155-.206.31-.799.982-.979 1.19-.18.206-.361.232-.67.077-.31-.154-1.31-.483-2.497-1.542-.924-.824-1.548-1.843-1.73-2.152-.18-.31-.02-.477.136-.63.14-.139.31-.361.464-.542.155-.18.206-.31.31-.516.103-.206.052-.387-.026-.542-.078-.154-.697-1.68-.954-2.3-.25-.6-.525-.515-.718-.525-.187-.01-.401-.01-.614-.01-.213 0-.56.08-.853.4-.293.32-1.12.1.1-1.12 1.1-2.43 2.187-.31-.413-.31-.95-.31-1.93.593-.104.103-.92.836-.92 1.835 0 .206.052.413.155.62.104.206.918 1.524 2.222 2.085.31.134.55.214.737.273.31.097.593.084.814.052.247-.036.756-.31.862-.61.106-.299.106-.554.075-.61-.03-.056-.113-.088-.423-.242z"></path>
              </svg>
            </a>
            <button class="btn-icon" onclick="deleteComplaint('${c.id}')" title="Delete record" style="color: var(--color-danger)">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminRegistries() {
  const tableBody = document.getElementById('registries-table-body');
  if (!tableBody) return;

  const searchQuery = document.getElementById('search-registries').value.trim().toLowerCase();

  let filtered = warrantyRegistry.filter(record => {
    return record.name.toLowerCase().includes(searchQuery) ||
      record.phone.includes(searchQuery) ||
      record.serial.toLowerCase().includes(searchQuery);
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-data-row">
          <span class="empty-data-icon">📦</span>
          No Promax registrations found in database.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(r => {
    const analysis = calculateWarrantyStatus(r.date, r.duration);
    const cardStatusHtml = r.cardGiven === "Yes"
      ? `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #10b981; font-weight: 700; font-size: 0.85rem; background: rgba(16, 185, 129, 0.08); border: 1px solid #10b981; padding: 0.35rem 0.65rem; border-radius: 0.5rem; cursor: not-allowed;" title="Warranty card handed over and locked.">
           📜 Handed Over
         </span>`
      : `<button onclick="markCardGiven('${r.serial}')" style="display: inline-flex; align-items: center; gap: 0.35rem; color: var(--text-muted); font-weight: 600; font-size: 0.85rem; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); padding: 0.35rem 0.65rem; border-radius: 0.5rem; cursor: pointer; transition: var(--transition-smooth); outline: none;" onmouseover="this.style.borderColor='#10b981'; this.style.color='#10b981';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-muted)';">
           ⬜ Mark Given
         </button>`;

    return `
      <tr>
        <td style="font-weight: 600; color: #ffffff;">${r.name}</td>
        <td>${r.phone}</td>
        <td>${r.product}</td>
        <td style="font-family: monospace; font-size: 0.85rem;">${r.serial}</td>
        <td>${new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${r.duration} Months</td>
        <td>
          <span class="status-pill ${analysis.isUnderWarranty ? 'resolved' : 'pending'}" style="font-size: 0.75rem;">
            ${analysis.statusText}
          </span>
        </td>
        <td>
          ${cardStatusHtml}
        </td>
      </tr>
    `;
  }).join('');
}

function updateComplaintStatus(ticketId, newStatus) {
  complaints = complaints.map(c => {
    if (c.id === ticketId) {
      return { ...c, status: newStatus };
    }
    return c;
  });
  localStorage.setItem('pb_complaints', JSON.stringify(complaints));
  updateMetrics();
  renderAdminComplaints();
}

function deleteComplaint(ticketId) {
  if (confirm(`Are you sure you want to delete ticket ${ticketId}?`)) {
    complaints = complaints.filter(c => c.id !== ticketId);
    localStorage.setItem('pb_complaints', JSON.stringify(complaints));
    updateMetrics();
    renderAdminComplaints();
  }
}

// 8. WHATSAPP LINK COMPILER UTILITY
function compileWhatsAppLink(complaint, warrantyMatch) {
  // Format message text
  let warrantyText = "Non-Promax / General";
  if (warrantyMatch) {
    const analysis = calculateWarrantyStatus(warrantyMatch.date, warrantyMatch.duration);
    warrantyText = `${analysis.statusText} (${analysis.remainingDays} Days Left)`;
  }

  const textMsg = `*PROBALAJI AI - SERVICE REQUEST ALERT*\n` +
    `---------------------------------------------\n` +
    `*Ticket ID:* ${complaint.id}\n` +
    `*Customer Name:* ${complaint.name}\n` +
    `*Mobile Number:* ${complaint.phone}\n` +
    `*Service Address:* ${complaint.address}\n` +
    `*Product Type:* ${complaint.product}\n` +
    `*Product Serial:* ${complaint.serial}\n` +
    `*Warranty Status:* ${warrantyText}\n` +
    `*Problem Description:* "${complaint.details}"\n` +
    `---------------------------------------------\n` +
    `Please dispatch an engineer or call client directly.`;

  const encodedText = encodeURIComponent(textMsg);

  // Directs message to the configurable admin WhatsApp number
  return `https://wa.me/91${ADMIN_WHATSAPP}?text=${encodedText}`;
}

// 8.1 CUSTOM CONFIRMATION DIALOG MODAL UTILITY
function showCustomConfirm(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-modal-message');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');

  if (modal && msgEl && okBtn && cancelBtn) {
    msgEl.innerText = message;
    modal.style.display = 'flex';

    // Clear old event handlers to prevent multiple firings
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
      modal.style.display = 'none';
      onConfirm();
    });

    newCancel.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  } else {
    // Fallback if elements not found
    if (confirm(message)) {
      onConfirm();
    }
  }
}

// 9. LOCKED WARRANTY CARD UPDATE CONTROLLER
function markCardGiven(serial) {
  showCustomConfirm(
    `Confirm that physical warranty card was handed over to the customer for Serial No: ${serial}?\n\nOnce marked as handed over, this status is permanently locked and cannot be changed!`,
    () => {
      // Direct POST to Google Sheets — works from any device globally
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'card-given', serial: serial })
      })
        .then(() => {
          showToastNotification('📜 Warranty card permanently locked in Google Sheets!');
          setTimeout(() => loadExcelBackupAndSync(), 2500);
        })
        .catch(() => {
          showToastNotification('⚠️ Could not update card status. Check internet.');
        });
    }
  );
}
