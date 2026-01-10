/* ==========================================================
   Worker Dashboard Script (worker.js) - UPDATED
========================================================== */

let currentPage = 1;
let entriesPerPage = 50;

/* -------- Navigation Between Sections -------- */
function showSection(sectionId) {
  document.querySelectorAll('.dashboard-section').forEach(sec => (sec.style.display = 'none'));
  const target = document.getElementById(sectionId);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.main-nav a').forEach(link => link.classList.remove('active'));
  const activeLink = [...document.querySelectorAll('.main-nav a')]
    .find(a => a.getAttribute('onclick') && a.getAttribute('onclick').includes(sectionId));
  if (activeLink) activeLink.classList.add('active');

  if (sectionId === 'manageVoters') fetchVoters();
  if (sectionId === 'householdData') fetchHouseholds();
  if (sectionId === 'campaignTasks') fetchTasks();
  if (sectionId === 'communication') fetchMessages();
  if (sectionId === 'reports') fetchReports();
}

/* ==========================================================
   VOTER MANAGEMENT
========================================================== */

async function fetchVoters() {
  const tbody = document.getElementById('workerVotersTableBody');
  if (!tbody) return;

  const table = tbody.closest('table');
  const headerCount = table ? table.querySelectorAll('thead th').length : 7;

  const genderEl = document.getElementById('genderFilter');
  let gender = genderEl ? (genderEl.value || '').trim() : '';
  if (gender.toLowerCase() === 'all') gender = '';

  const search = document.getElementById('searchInput') ? (document.getElementById('searchInput').value || '').trim() : '';
  entriesPerPage = parseInt((document.getElementById('entriesPerPage') || { value: '50' }).value, 10);

  tbody.innerHTML = `<tr><td colspan="${headerCount}">Loading...</td></tr>`;

  const params = new URLSearchParams({
    page: String(currentPage),
    per_page: String(entriesPerPage)
  });
  if (gender) params.append('gender', gender);
  if (search) params.append('search', search);

  try {
    const res = await fetch(`/api/voters?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = Array.isArray(data.items) ? data.items : [];
    renderVoterRows(items, headerCount);

    const page = data.page || 1;
    const pages = data.pages || 1;
    document.getElementById('pageInfo').textContent = `Page ${page} of ${pages || 1}`;
    document.getElementById('prevPage').disabled = page <= 1;
    document.getElementById('nextPage').disabled = page >= pages;
  } catch (err) {
    console.error('Error fetching voters:', err);
    tbody.innerHTML = `<tr><td colspan="${headerCount}">Error loading data</td></tr>`;
  }
}

function formatAffiliation(affiliation) {
  if (!affiliation) return '';
  const value = String(affiliation).toLowerCase();
  if (value === 'supporter') return `<span class="affiliation-badge affiliation-supporter">Supporter</span>`;
  if (value === 'opponent') return `<span class="affiliation-badge affiliation-opponent">Opponent</span>`;
  return `<span class="affiliation-badge affiliation-SwingVoter">Swing Voter</span>`;
}

function renderVoterRows(voters, colCount) {
  const tbody = document.getElementById('workerVotersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!voters.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}">No voters found</td></tr>`;
    return;
  }

  voters.forEach(v => {
    const idVal = v.ID ?? v.id ?? '';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${safe(idVal)}</td>
      <td class="voter-name" style="color:#0052cc; cursor:pointer; font-weight:500;">
        ${safe(v.Name ?? v.name ?? '')}
      </td>
      <td>${safe(v["Father's or Husband's name"] ?? v.father_or_husband_name ?? '')}</td>
      <td>${safe(v.Age ?? v.age ?? '')}</td>
      <td>${safe(v.Gender ?? v.gender ?? '')}</td>
      <td>${safe(v["House number"] ?? v.house_number ?? '')}</td>
      <td>${safe(v["EPIC number"] ?? v.epic_number ?? '')}</td>
      <td>${formatAffiliation(v["Political Affiliation"] ?? v.political_affiliation)}</td>
    `;

    for (let i = row.children.length; i < colCount; i++) {
      row.appendChild(document.createElement('td'));
    }

    tbody.appendChild(row);

    row.querySelector('.voter-name')
      .addEventListener('click', () => toggleDetailsRow(row, v, colCount));
  });
}

function toggleDetailsRow(row, voter, colCount) {
  if (row.nextElementSibling && row.nextElementSibling.classList.contains('voter-details-row')) {
    row.nextElementSibling.remove();
    return;
  }
  document.querySelectorAll('.voter-details-row').forEach(r => r.remove());

  const detailsRow = document.createElement('tr');
  detailsRow.classList.add('voter-details-row');

  // Helper function to format values with "Not provided" styling
  function formatValue(value) {
    if (!value || value === '' || value === 'Not provided') {
      return '<span class="not-provided">Not provided</span>';
    }
    return safe(value);
  }

  const staticDetails = `
    <div class="details-grid">
      <p><strong>ID:</strong> ${safe(voter.ID ?? voter.id ?? '')}</p>
      <p><strong>Name:</strong> ${safe(voter.Name ?? voter.name ?? '')}</p>
      <p><strong>Father/Husband:</strong> ${formatValue(voter["Father's or Husband's name"] ?? voter.father_or_husband_name)}</p>
      <p><strong>Age:</strong> ${safe(voter.Age ?? voter.age ?? '')}</p>
      <p><strong>Gender:</strong> ${safe(voter.Gender ?? voter.gender ?? '')}</p>
      <p><strong>House Number:</strong> ${safe(voter["House number"] ?? voter.house_number ?? '')}</p>
      <p><strong>EPIC Number:</strong> ${safe(voter["EPIC number"] ?? voter.epic_number ?? '')}</p>
      <p><strong>Mobile:</strong> ${formatValue(voter["Mobile Number"] ?? voter.mobile_number)}</p>
      <p><strong>Occupation:</strong> ${formatValue(voter.Occupation ?? voter.occupation)}</p>
      <p><strong>Education:</strong> ${formatValue(voter["Education Level"] ?? voter.education_level)}</p>
      <p><strong>Political Affiliation:</strong> ${voter["Political Affiliation"] ?? voter.political_affiliation ? formatAffiliation(voter["Political Affiliation"] ?? voter.political_affiliation) : '<span class="not-provided">Not provided</span>'}</p>
      <p><strong>Key Issues:</strong> ${formatValue(voter["Key Issues"] ?? voter.key_issues)}</p>
      <p><strong>Remarks:</strong> ${formatValue(voter.Remarks ?? voter.remarks)}</p>
    </div>
  `;

  const idForForm = voter.ID ?? voter.id;
const formHtml = `
  <hr>
  <h4>Update Information</h4>
  <div class="form-grid" id="voterForm_${safe(idForForm)}">
    <div>
      <label>Mobile Number</label>
      <input type="tel" data-field="mobile_number" maxlength="10" placeholder="Enter 10-digit mobile">
      <small class="field-error" data-error-for="mobile_number" style="color:red"></small>
    </div>
    <div>
      <label>Occupation</label>
      <input type="text" data-field="occupation" placeholder="Enter occupation">
      <small class="field-error" data-error-for="occupation" style="color:red"></small>
    </div>
    <div>
      <label>Education Level</label>
      <input type="text" data-field="education_level" placeholder="Enter education level">
      <small class="field-error" data-error-for="education_level" style="color:red"></small>
    </div>
    <div>
      <label>Political Affiliation</label>
      <select data-field="political_affiliation">
        <option value="">Select...</option>
        <option value="Supporter">Supporter</option>
        <option value="Opponent">Opponent</option>
        <option value="SwingVoter">Swing Voter</option>
      </select>
      <small class="field-error" data-error-for="political_affiliation" style="color:red"></small>
    </div>
    <div class="full-width">
      <label>Key Issues</label>
      <textarea data-field="key_issues" maxlength="300" placeholder="Enter key issues or concerns (max 300 chars)" rows="3"></textarea>
      <small class="field-error" data-error-for="key_issues" style="color:red"></small>
    </div>
    <div class="full-width">
      <label>Remarks</label>
      <textarea data-field="remarks" maxlength="200" placeholder="Enter remarks (max 200 chars)" rows="3"></textarea>
      <small class="field-error" data-error-for="remarks" style="color:red"></small>
    </div>
  </div>
  <button class="save-details-btn" data-save-voter-id="${safe(idForForm)}" disabled>Save Details</button>
`;

  detailsRow.innerHTML = `<td colspan="${colCount}"><div class="voter-details">${staticDetails}${formHtml}</div></td>`;
  row.parentNode.insertBefore(detailsRow, row.nextSibling);

  const form = document.getElementById(`voterForm_${idForForm}`);
  const saveBtn = detailsRow.querySelector('.save-details-btn');

  function setError(key, msg) {
    const err = form.querySelector(`.field-error[data-error-for="${key}"]`);
    if (err) err.textContent = msg || '';
  }

  function validateField(key) {
  const val = (form.querySelector(`[data-field="${key}"]`)?.value || '').trim();
  if (!val) { setError(key, ''); return true; }

  if (key === 'mobile_number') {
    if (!/^[6-9][0-9]{9}$/.test(val)) { setError(key, 'Enter valid 10-digit mobile starting 6–9'); return false; }
  }
  if (key === 'occupation' && val.length < 2) {
    setError(key, 'At least 2 characters'); return false;
  }
  if (key === 'education_level' && val.length < 2) {
    setError(key, 'At least 2 characters'); return false;
  }
  if (key === 'key_issues' && val.length > 300) {
    setError(key, 'Max 300 characters'); return false;
  }
  if (key === 'remarks' && val.length > 200) {
    setError(key, 'Max 200 characters'); return false;
  }
  setError(key, ''); return true;
}

  function updateSaveState() {
    const fields = [...form.querySelectorAll('[data-field]')].map(f => f.getAttribute('data-field'));
    const filled = fields.filter(k => (form.querySelector(`[data-field="${k}"]`).value || '').trim() !== '');
    const valid = filled.every(validateField);
    saveBtn.disabled = !(filled.length > 0 && valid);
  }

  form.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', () => { validateField(el.dataset.field); updateSaveState(); });
    el.addEventListener('change', () => { validateField(el.dataset.field); updateSaveState(); });
  });

  updateSaveState();

  saveBtn.addEventListener('click', () => saveVoterDetails(idForForm));
}

async function saveVoterDetails(voterId) {
  const form = document.getElementById(`voterForm_${voterId}`);
  if (!form) return;
  const updates = {};
  form.querySelectorAll('[data-field]').forEach(el => {
    const val = (el.value || '').trim();
    if (val) updates[el.dataset.field] = val;
  });
  if (!Object.keys(updates).length) return;

  try {
    const res = await fetch(`/api/voters/${encodeURIComponent(voterId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      document.querySelectorAll('.voter-details-row').forEach(r => r.remove());
      fetchVoters();
      alert('Voter details updated successfully');
    } else throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error('Error saving:', err);
    alert('Error saving voter details');
  }
}

function safe(val) {
  return String(val ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* -------- Pagination, Households, Tasks, Messages, Reports -------- */
// keep your existing fetchHouseholds, fetchTasks, fetchMessages, fetchReports unchanged...


/* -------- Pagination Controls -------- */
const prevBtnEl = document.getElementById('prevPage');
const nextBtnEl = document.getElementById('nextPage');
const searchBtnEl = document.getElementById('searchBtn');
const entriesEl = document.getElementById('entriesPerPage');
const genderEl = document.getElementById('genderFilter');

if (prevBtnEl) {
  prevBtnEl.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchVoters();
    }
  });
}
if (nextBtnEl) {
  nextBtnEl.addEventListener('click', () => {
    currentPage++;
    fetchVoters();
  });
}
if (searchBtnEl) {
  searchBtnEl.addEventListener('click', () => {
    currentPage = 1;
    fetchVoters();
  });
}
if (entriesEl) {
  entriesEl.addEventListener('change', () => {
    currentPage = 1;
    fetchVoters();
  });
}
if (genderEl) {
  genderEl.addEventListener('change', () => {
    currentPage = 1;
    fetchVoters();
  });
}

/* ==========================================================
   HOUSEHOLDS
========================================================== */
let householdCurrentPage = 1;
let householdEntriesPerPage = 25;
let allHouseholds = [];
let activeVoterId = null;
let mapInstance = null;
let marker = null;

function openVoterLocationModal(id, name, landmark, lat, lng) {
  activeVoterId = id;

  document.getElementById("voterNameTitle").innerText = name;
  document.getElementById("locationLandmark").value = landmark || "";

  const modal = document.getElementById("locationModal");
  modal.style.display = "block";

  setTimeout(() => initVoterMap(parseFloat(lat), parseFloat(lng)), 200);
}

function initVoterMap(lat, lng) {
  if (mapInstance) mapInstance.remove();

  const center = (lat && lng) ? [lat, lng] : [19.000, 73.000];
  mapInstance = L.map('mapView').setView(center, 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);

  if (lat && lng) {
    marker = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
  }

  mapInstance.on("click", (e) => {
    if (marker) mapInstance.removeLayer(marker);
    marker = L.marker(e.latlng, { draggable: true }).addTo(mapInstance);
  });
}

function saveLocationDetails() {
  if (!marker) return alert("📍 Please pin a location");

  const landmark = document.getElementById("locationLandmark").value;
  const { lat, lng } = marker.getLatLng();
  const voterName = document.getElementById("voterNameTitle").innerText;

  // ✅ get house number from UI table
  const row = document.querySelector(`span.voter-chip[data-name="${voterName}"]`)
  const house = row.closest("tr").children[0].innerText.trim();

  fetch(`/api/voter-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: voterName,
      house_number: house,
      landmark: landmark,
      latitude: lat,
      longitude: lng,
    })
  })
  .then(r => r.json())
  .then(() => {
    alert("✅ Location updated!");
    closeLocationModal();
    fetchHouseholds();
  });
}


function closeLocationModal() {
  document.getElementById("locationModal").style.display = "none";
}

async function fetchHouseholds() {
  try {
    const res = await fetch('/api/household-data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allHouseholds = await res.json();
    renderHouseholds();
  } catch (err) {
    console.error(err);
  }
}

function renderHouseholds() {
  const tbody = document.getElementById('householdTableBody');
  if (!tbody) return;

  const searchTerm = document.getElementById('householdSearchInput')?.value.toLowerCase() || '';
  householdEntriesPerPage = Number(document.getElementById('householdEntriesPerPage')?.value || 25);

  const filtered = allHouseholds.filter(h =>
    (h.house_number || '').toLowerCase().includes(searchTerm)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / householdEntriesPerPage));
  if (householdCurrentPage > totalPages) householdCurrentPage = totalPages;

  const items = filtered.slice(
    (householdCurrentPage - 1) * householdEntriesPerPage,
    householdCurrentPage * householdEntriesPerPage
  );

  tbody.innerHTML = items.length ?
    items.map(h => `
      <tr>
        <td>${safe(h.house_number)}</td>
        <td>
          ${(h.voters || []).map(v => `
            <span class="chip voter-chip"
              data-id="${v.id}"
              data-name="${safe(v.name)}"
              data-landmark="${safe(v.landmark || '')}"
              data-lat="${v.latitude || ''}"
              data-lng="${v.longitude || ''}"
              style="cursor:pointer;">
              ${safe(v.name)}
            </span>
          `).join(' ')}
        </td>
      </tr>
    `).join('') :
    `<tr><td colspan="2">No households found</td></tr>`;

  // ✅ Rebind click handler dynamically after insert
  tbody.querySelectorAll('.voter-chip').forEach(chip => {
    chip.addEventListener('click', () => openVoterLocationModal(
      chip.dataset.id,
      chip.dataset.name,
      chip.dataset.landmark,
      chip.dataset.lat,
      chip.dataset.lng
    ));
  });

  const pageInfo = document.getElementById("householdPageInfo");
  if (pageInfo) pageInfo.textContent = `Page ${householdCurrentPage} of ${totalPages}`;
}


  // --- Household Pagination Controls ---
  const householdPrevBtn = document.getElementById('householdPrevPage');
  const householdNextBtn = document.getElementById('householdNextPage');
  const householdSearchInput = document.getElementById('householdSearchInput');
  const householdEntriesEl = document.getElementById('householdEntriesPerPage');

if (householdPrevBtn) {
  householdPrevBtn.disabled = householdCurrentPage <= 1;
  householdPrevBtn.onclick = () => {
    if (householdCurrentPage > 1) {
      householdCurrentPage--;
      renderHouseholds();
    }
  };
}

if (householdNextBtn) {
  householdNextBtn.disabled = householdCurrentPage >= totalPages;
  householdNextBtn.onclick = () => {
    if (householdCurrentPage < totalPages) {
      householdCurrentPage++;
      renderHouseholds();
    }
  };
}

  if (householdSearchInput) {
    householdSearchInput.oninput = () => {
      householdCurrentPage = 1;
      renderHouseholds();
    };
  }

  if (householdEntriesEl) {
    householdEntriesEl.onchange = () => {
      householdCurrentPage = 1;
      renderHouseholds();
    };
  }



/* ==========================================================
   TASKS
========================================================== */
async function fetchTasks() {
  const res = await fetch('/api/tasks');
  const tasks = await res.json();
  const tbody = document.getElementById('taskTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No tasks assigned</td></tr>`;
    return;
  }

  tasks.forEach(task => {
    const tr = document.createElement('tr');
    const statusClass = task.status === 'Completed' ? 'completed'
                      : task.status === 'In Progress' ? 'progress'
                      : 'pending';

    tr.innerHTML = `
      <td>${safe(task.title)}</td>
      <td>${safe(task.description || '')}</td>
      <td><span class="badge ${statusClass}">${safe(task.status)}</span></td>
      <td>${safe(task.due_date || '')}</td>
      <td class="actions">
        <select onchange="updateTaskStatus(${task.id}, this.value)" class="task-status-dropdown">
          <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
      <td class="delete-column">
        <button class="icon-btn btn-danger" onclick="deleteTask(${task.id})" title="Delete Task">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

const taskForm = document.getElementById('taskForm');
if (taskForm) {
  taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    e.target.reset();
    fetchTasks();
  });
}

async function updateTaskStatus(id, newStatus) {
  try {
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchTasks();
  } catch (err) {
    console.error('Error updating task status:', err);
    alert('Error updating task status');
  }
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  } catch (err) {
    console.error('Error deleting task:', err);
    alert('Error deleting task');
  }
}

/* ==========================================================
   MESSAGES
========================================================== */
async function fetchMessages() {
  const res = await fetch('/api/messages');
  const messages = await res.json();
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  container.innerHTML = '';
  if (messages.length === 0) {
    container.innerHTML = `<p>No messages found</p>`;
    return;
  }

  messages.forEach(m => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${safe(m.title)}</h4>
      <div class="meta"><span>${safe(m.audience || '')}</span><span>${new Date(m.created_at).toLocaleString()}</span></div>
      <p>${safe(m.body || '')}</p>
    `;
    container.appendChild(card);
  });
}

const messageForm = document.getElementById('messageForm');
if (messageForm) {
  messageForm.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    e.target.reset();
    fetchMessages();
  });
}

/* ==========================================================
   REPORTS
========================================================== */
async function fetchReports() {
  const res = await fetch('/api/reports');
  const reports = await res.json();
  const container = document.getElementById('reportsContainer');
  if (!container) return;

  container.innerHTML = '';
  if (reports.length === 0) {
    container.innerHTML = `<p>No reports submitted</p>`;
    return;
  }

  reports.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${safe(r.title)}</h4>
      <div class="meta"><span>${safe(r.date || '')}</span><span>${new Date(r.submitted_at).toLocaleString()}</span></div>
      <p>${safe(r.content || '')}</p>
    `;
    container.appendChild(card);
  });
}

const reportForm = document.getElementById('reportForm');
if (reportForm) {
  reportForm.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    e.target.reset();
    fetchReports();
  });
}

/* -------- Allow Enter key to trigger search -------- */
const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
  searchInputEl.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchBtnEl) searchBtnEl.click();
    }
  });
}

/* -------- Init -------- */
document.addEventListener('DOMContentLoaded', () => {
  fetchVoters();
  fetchHouseholds();
});
