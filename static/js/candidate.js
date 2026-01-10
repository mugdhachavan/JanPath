// Global chart instances
let affiliationChartInstance = null;
let issueChartInstance = null;
let genderChartInstance = null;
let topIssueChartInstance = null; // NEW: For Command Centre chart
document.addEventListener('DOMContentLoaded', () => {
    // Load the default section on page load
    showSection('commandCenter');

    // Start other dynamic updates
    startLiveActivityFeed();
    startNewsFeed();
    loadElectionNews();
    // Load booths into filter dropdown
    loadBoothsForFilter();
});

/**
 * Shows the selected section and hides others. Also updates the active navigation link.
 * @param {string} sectionId The ID of the section to display.
 */
function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.style.display = 'block';
    }
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${sectionId}'`)) {
            link.classList.add('active');
        }
    });

    // Load data for the shown section
    switch (sectionId) {
        case 'commandCenter':
            loadCommandCenterData();
            loadWardMap();   // <--- add this line
            loadOverdueTasks(); // New
            loadBoothPerformance(); // New
            loadTopIssues(); // New
            loadSegmentPerformance(); // New
            break;
        case 'voterAnalytics':
            applyVoterFilters();
            break;
        case 'campaignHub':
            loadCampaignHub();
            break;
        case 'boothStrategy':
            loadBoothStrategy();
            break;
        case 'chatbotSection':
            //
            break;    
    }
}

/**
 * Fetches and displays LIVE data for the Command Center from the backend.
 */
async function loadCommandCenterData() {
    try {
        // API call to the backend endpoint
        const response = await fetch('/api/candidate/kpis');
        if (!response.ok) throw new Error('Network response was not ok');
        const kpiData = await response.json();

        // Update KPI Cards with data from the server
        const contactedPercentage = (kpiData.votersContacted.count / kpiData.votersContacted.total) * 100;
        document.getElementById('kpiContacted').textContent = `${kpiData.votersContacted.count} / ${kpiData.votersContacted.total}`;
        document.getElementById('kpiContactedBar').style.width = `${contactedPercentage}%`;
        
        document.getElementById('kpiSupporters').textContent = kpiData.supporters.toLocaleString();
        document.getElementById('kpiUndecided').textContent = kpiData.undecided.toLocaleString();
        
        const tasksPercentage = (kpiData.tasksCompleted.count / kpiData.tasksCompleted.total) * 100;
        document.getElementById('kpiTasks').textContent = `${Math.round(tasksPercentage || 0)}% (${kpiData.tasksCompleted.count})`;

        // Load activity feed
        loadActivityFeed();

    } catch (error) {
        console.error('Failed to load command center KPIs:', error);
        // Display an error message on the page
        document.getElementById('kpiContacted').textContent = 'Error';
        document.getElementById('kpiSupporters').textContent = 'Error';
        document.getElementById('kpiUndecided').textContent = 'Error';
        document.getElementById('kpiTasks').textContent = 'Error';
    }
}
// -------------------- NEW COMMAND CENTRE FUNCTIONS --------------------

/**
 * NEW: Fetches and displays overdue tasks.
 */
async function loadOverdueTasks() {
    const list = document.getElementById('overdueTaskList');
    list.innerHTML = '<li>Loading alerts...</li>';
    try {
        const response = await fetch('/api/candidate/overdue-tasks');
        if (!response.ok) throw new Error('Network response was not ok');
        const tasks = await response.json();
        
        if (tasks.length === 0) {
            list.innerHTML = '<li>No overdue tasks. Great job!</li>';
            return;
        }
        
        list.innerHTML = tasks.map(task => 
            `<li><strong>${task.title}</strong> (Due: ${task.due_date})</li>`
        ).join('');

    } catch (error) {
        console.error('Failed to load overdue tasks:', error);
        list.innerHTML = '<li>Error loading tasks.</li>';
    }
}

/**
 * NEW: Fetches and displays booth performance leaderboard.
 */
async function loadBoothPerformance() {
    const topList = document.getElementById('topBoothsList');
    const bottomList = document.getElementById('bottomBoothsList');
    topList.innerHTML = '<li>Loading...</li>';
    bottomList.innerHTML = '<li>Loading...</li>';

    try {
        const response = await fetch('/api/candidate/booth-performance');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.top.length === 0) {
            topList.innerHTML = '<li>Not enough data.</li>';
        } else {
            topList.innerHTML = data.top.map(booth => 
                `<li>${booth.name} <span>${booth.supporter_percent.toFixed(1)}%</span></li>`
            ).join('');
        }
        
        if (data.bottom.length === 0) {
            bottomList.innerHTML = '<li>Not enough data.</li>';
        } else {
            bottomList.innerHTML = data.bottom.map(booth => 
                `<li>${booth.name} <span>${booth.supporter_percent.toFixed(1)}%</span></li>`
            ).join('');
        }

    } catch (error) {
        console.error('Failed to load booth performance:', error);
        topList.innerHTML = '<li>Error loading data.</li>';
        bottomList.innerHTML = '<li>Error loading data.</li>';
    }
}

/**
 * NEW: Fetches and renders the Top 5 Key Issues chart.
 */
async function loadTopIssues() {
    try {
        const response = await fetch('/api/candidate/top-issues');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        const ctx = document.getElementById('topIssuesChart')?.getContext('2d');
        if (!ctx) return;

        const labels = Object.keys(data);
        const values = Object.values(data);
        
        if (topIssueChartInstance) topIssueChartInstance.destroy();
        topIssueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Voter Mentions',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal bar chart
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });

    } catch (error) {
        console.error('Failed to load top issues:', error);
    }
}

/**
 * NEW: Fetches and displays performance of saved segments.
 */
async function loadSegmentPerformance() {
    const list = document.getElementById('segmentPerformanceList');
    list.innerHTML = '<p>Loading segments...</p>';
    try {
        const response = await fetch('/api/candidate/segment-performance');
        if (!response.ok) throw new Error('Network response was not ok');
        const segments = await response.json();

        if (segments.length === 0) {
            list.innerHTML = '<p>No saved segments. Go to "Voter Analytics" to create some.</p>';
            return;
        }

        list.innerHTML = segments.map(seg => `
            <div class="segment-card">
                <strong>${seg.name}</strong>
                <div class="segment-stats">
                    <span>Total: ${seg.total}</span>
                    <span>Supporters: ${seg.supporters} (${seg.percent.toFixed(0)}%)</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Failed to load segment performance:', error);
        list.innerHTML = '<p>Error loading segment data.</p>';
    }
}

// -------------------- ACTIVITY FEED --------------------
function startLiveActivityFeed() {
    loadActivityFeed(); // initial load

    if (window.EventSource) {
        try {
            const evtSource = new EventSource('/api/candidate/activity-stream');
            evtSource.onmessage = e => {
                try {
                    const activity = JSON.parse(e.data);
                    addActivityItem(activity);
                } catch {
                    console.error("Invalid SSE activity data:", e.data);
                }
            };
            evtSource.onerror = () => {
                console.warn('SSE failed, switching to polling...');
                evtSource.close();
                setInterval(loadActivityFeed, 10000);
            };
        } catch {
            console.warn('SSE not supported, using polling...');
            setInterval(loadActivityFeed, 10000);
        }
    } else {
        setInterval(loadActivityFeed, 10000);
    }
}

async function loadActivityFeed() {
    const feedList = document.getElementById('activityFeedList');
    if (!feedList) return;

    try {
        const response = await fetch('/api/candidate/activity-feed');
        if (!response.ok) throw new Error('Failed to load activity feed');
        const activities = await response.json();

        feedList.innerHTML = '';
        if (!activities.length) {
            feedList.innerHTML = '<li>No recent activities</li>';
            return;
        }

        activities.reverse().forEach(activity => addActivityItem(activity, false));
    } catch (error) {
        console.error('Failed to load activity feed:', error);
        feedList.innerHTML = '<li>⚠️ Unable to load activity feed</li>';
    }
}

function addActivityItem(activity, prepend = true) {
    const feedList = document.getElementById('activityFeedList');
    if (!feedList) return;

    const li = document.createElement('li');
    const timestamp = activity.timestamp
        ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    li.innerHTML = `<div style="display:flex; justify-content:space-between;">
                        <span>${activity.message || "Unknown event"}</span>
                        <small style="color:#666;">${timestamp}</small>
                    </div>`;
    li.classList.add('new-activity');

    prepend ? feedList.prepend(li) : feedList.appendChild(li);

    // Keep only latest 30
    while (feedList.children.length > 30) feedList.removeChild(feedList.lastChild);
}

// -------------------- NEWS FEED --------------------
function startNewsFeed() {
    loadNewsFeed();
    setInterval(loadNewsFeed, 60000);
}

async function loadNewsFeed() {
    let newsContainer = document.getElementById('newsFeedList');
    if (!newsContainer) {
        const newsSection = document.createElement('div');
        newsSection.className = 'activity-feed';
        newsSection.innerHTML = '<h4>📰 Election News</h4><ul id="newsFeedList"></ul>';
        document.querySelector('.command-center-grid').appendChild(newsSection);
        newsContainer = document.getElementById('newsFeedList');
    }
    newsContainer.innerHTML = '<li>Loading news...</li>';

    try {
        const response = await fetch('/api/candidate/news');
        if (!response.ok) throw new Error('Failed to fetch news');
        const newsItems = await response.json();

        if (!newsItems.length) {
            newsContainer.innerHTML = '<li>No recent news</li>';
            return;
        }

        newsContainer.innerHTML = newsItems.map(item => {
            const date = item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "";
            return `
                <li>
                    <a href="${item.url}" target="_blank" rel="noopener">
                        ${item.title}
                    </a>
                    <br><small style="color:#6c757d;">${date}</small>
                </li>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load news feed:', error);
        newsContainer.innerHTML = '<li>⚠️ Unable to load news feed</li>';
    }
}


// ---- MAP ----
async function loadWardMap() {
    const mapContainer = document.getElementById('wardMapContainer');
    mapContainer.innerHTML = ""; // clear placeholder

    // Initialize Leaflet map
    const map = L.map('wardMapContainer').setView([16.7, 74.25], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    try {
        // Fetch CSV from backend
        const response = await fetch('ImpFiles/Pandharpur_final.csv');
        const csvText = await response.text();

        // Parse CSV (basic)
        const rows = csvText.trim().split('\n').slice(1); // skip header
        rows.forEach(row => {
            const [name, lat, lng, supporters, opponents] = row.split(',');
            if (lat && lng) {
                const marker = L.marker([parseFloat(lat), parseFloat(lng)]).addTo(map);
                marker.bindPopup(`
                    <b>${name}</b><br>
                    ✅ Supporters: ${supporters}<br>
                    ❌ Opponents: ${opponents}
                `);
            }
        });

    } catch (error) {
        console.error('Failed to load map CSV:', error);
        mapContainer.innerHTML = "<p>Error loading map data.</p>";
    }
}


/**
 * Applies all filters and fetches BOTH the voter list and visualization data.
 * This is now the main function for the analytics tab.
 */
async function applyVoterFilters() {
    // 1. Get all filters
    const filters = {
        affiliation: document.getElementById('filterAffiliation').value,
        age: document.getElementById('filterAge').value,
        issues: document.getElementById('filterIssues').value,
        occupation: document.getElementById('filterOccupation').value,
        gender: document.getElementById('filterGender').value,
        ward: document.getElementById('filterWard').value,
        education: document.getElementById('filterEducation').value,
    };
    const queryParams = new URLSearchParams();
    for (const key in filters) {
        if (filters[key]) {
            queryParams.append(key, filters[key]);
        }
    }
    const queryString = queryParams.toString();

    // 2. Fetch Voter List
    const tbody = document.getElementById('analyticsVoterList');
    tbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;
    try {
        const response = await fetch(`/api/candidate/voters?${queryString}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const voters = data.items;

        tbody.innerHTML = "";
        
        if (voters.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No voters match the criteria.</td></tr>`;
        } else {
            voters.forEach(voter => {
                const tr = document.createElement('tr');
                const affiliationClass = getAffiliationClass(voter['Political Affiliation']);
                tr.innerHTML = `
                    <td>${voter.Name || ''}</td>
                    <td>${voter.Age || ''}</td>
                    <td>${voter.Gender || ''}</td>
                    <td><span class="badge ${affiliationClass}">${voter['Political Affiliation'] || 'Empty'}</span></td>
                    <td>${voter['Key Issues'] || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('voterCount').textContent = data.total;
    } catch (error) {
        console.error('Failed to fetch voters:', error);
        tbody.innerHTML = `<tr><td colspan="5">Error loading data.</td></tr>`;
    }
    fetchVisualizationData(queryString);
}

/**
 * Resets all filters to default and re-applies.
 */
function resetFilters() {
    document.getElementById('filterAffiliation').value = "";
    document.getElementById('filterAge').value = "";
    document.getElementById('filterIssues').value = "";
    document.getElementById('filterOccupation').value = "";
    document.getElementById('filterGender').value = "";
    document.getElementById('filterWard').value = "";
    document.getElementById('filterEducation').value = "";
    applyVoterFilters();
}





/**
 * Returns CSS class for political affiliation badge
 */
function getAffiliationClass(affiliation) {
    if (!affiliation) return '';
    const aff = affiliation.toLowerCase();
    if (aff === 'supporter') return 'affiliation-supporter';
    if (aff === 'opponent') return 'affiliation-opponent';
    if (aff === 'swingvoter' || aff === 'neutral') return 'affiliation-SwingVoter';
    return '';
}

/**
 * Saves current filters as a voter segment
 */
async function saveSegment() {
    const segmentName = document.getElementById('segmentName').value.trim();
    if (!segmentName) {
        alert('Please enter a segment name');
        return;
    }

    const filters = {
        affiliation: document.getElementById('filterAffiliation').value,
        age: document.getElementById('filterAge').value,
        issues: document.getElementById('filterIssues').value,
        occupation: document.getElementById('filterOccupation').value,
    };

    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });

    try {
        const response = await fetch('/api/segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: segmentName,
                filters: filters
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save segment');
        }

        alert(`Segment "${segmentName}" saved successfully!`);
        document.getElementById('segmentName').value = '';
        
    } catch (error) {
        console.error('Failed to save segment:', error);
        alert(`Error: ${error.message}`);
    }
}

/**
 * Loads LIVE data for the Campaign Hub (Tasks and Segments).
 */
async function loadCampaignHub() {
    console.log("Loading Campaign Hub...");
    showHubTab('hubTasks', document.getElementById('navTasks'));
    
    const tasksTableBody = document.getElementById('hubTasksTableBody');
    tasksTableBody.innerHTML = `<tr><td colspan="4">Loading tasks...</td></tr>`;

    try {
        // API call to fetch all tasks
        const response = await fetch('/api/tasks'); 
        if (!response.ok) throw new Error('Network response was not ok');
        const tasks = await response.json();

        tasksTableBody.innerHTML = ""; // Clear loading message
        if (tasks.length === 0) {
            tasksTableBody.innerHTML = `<tr><td colspan="4">No tasks found.</td></tr>`;
        } else {
            tasks.forEach(task => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${task.title}</td>
                    <td>N/A</td> 
                    <td><span class="badge ${task.status.toLowerCase().replace(' ', '')}">${task.status}</span></td>
                    <td>${task.due_date || ''}</td>
                `;
                tasksTableBody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Failed to load tasks:', error);
        tasksTableBody.innerHTML = `<tr><td colspan="4">Error loading tasks.</td></tr>`;
    }

    // Load segments for communication dropdown
    loadSegments();
}

/**
 * Loads saved segments for the communication dropdown
 */
async function loadSegments() {
    try {
        const response = await fetch('/api/segments');
        if (!response.ok) throw new Error('Failed to load segments');
        const segments = await response.json();

        const segmentSelect = document.getElementById('commSegment');
        // Keep the first default option
        segmentSelect.innerHTML = '<option value="">Select Segment...</option>';
        
        segments.forEach(segment => {
            const option = document.createElement('option');
            option.value = segment.id;
            option.textContent = segment.name;
            segmentSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Failed to load segments:', error);
    }
}

/**
 * Shows a specific tab in the campaign hub
 */
function showHubTab(tabId, linkElement) {
    // Hide all tabs
    document.querySelectorAll('.hub-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all links
    document.querySelectorAll('.hub-nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected tab and activate link
    document.getElementById(tabId).classList.add('active');
    linkElement.classList.add('active');
}

/**
 * Handles task form submission
 */
document.getElementById('createTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        title: document.getElementById('taskTitle').value,
        description: `Assigned to: ${document.getElementById('taskAssignee').selectedOptions[0].text}`,
        due_date: document.getElementById('taskDueDate').value,
        status: 'Pending'
    };

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to create task');
        
        alert('Task assigned successfully!');
        document.getElementById('createTaskForm').reset();
        
        // Refresh the tasks table
        loadCampaignHub();
        
    } catch (error) {
        console.error('Failed to create task:', error);
        alert('Error creating task');
    }
});

/**
 * Handles communication form submission
 */
document.getElementById('sendMessageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const segmentSelect = document.getElementById('commSegment');
    const selectedSegment = segmentSelect.selectedOptions[0].text;
    
    const messageData = {
        title: document.getElementById('commTitle').value,
        body: document.getElementById('commBody').value,
        audience: selectedSegment
    };

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });

        if (!response.ok) throw new Error('Failed to send message');
        
        alert('Message sent successfully!');
        document.getElementById('sendMessageForm').reset();
        
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Error sending message');
    }
});

/**
 * Fetches LIVE booth data and renders the booth cards.
 */
async function loadBoothStrategy() {
    const container = document.getElementById('boothGridContainer');
    container.innerHTML = `<p>Loading Booth Data...</p>`;
    try {
        const response = await fetch('/api/booths');
        if (!response.ok) throw new Error('Network response was not ok');
        const booths = await response.json();

        if (booths.length === 0) {
            container.innerHTML = `<p>No booths have been added yet. Click "+ Add New Booth" to start.</p>`;
            return;
        }

        container.innerHTML = booths.map(booth => `
            <div class="booth-card">
                <h5>${booth.name} (#${booth.booth_number})</h5>
                <p><strong>Panna Pramukh:</strong> ${booth.in_charge_name || 'Not Assigned'}</p>
                <div class="booth-stats">
                    <span><strong>Total:</strong> ${booth.total_voters}</span>
                    <span style="color: green;"><strong>Supporters:</strong> ${booth.supporters}</span>
                    <span style="color: orange;"><strong>Neutral:</strong> ${booth.neutral}</span>
                    <span style="color: red;"><strong>Opponents:</strong> ${booth.opponents}</span>
                </div>
                <div class="booth-actions">
                    <button class="button-ghost btn-sm" onclick="openBoothModal(${booth.id})">Edit</button>
                    <button class="btn-danger btn-sm" onclick="deleteBooth(${booth.id})">Delete</button>
                    <button class="btn-sm" onclick="generateSlips(${booth.id})">Generate Slips</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load booth data:', error);
        container.innerHTML = `<p>Error loading booth data.</p>`;
    }
}

// --- MODAL AND FORM FUNCTIONS ---

const boothModal = document.getElementById('boothModal');
const boothForm = document.getElementById('boothForm');
const boothModalTitle = document.getElementById('boothModalTitle');
const boothIdField = document.getElementById('boothId');

/** Opens the modal for adding or editing a booth. */
async function openBoothModal(id = null) {
    boothForm.reset();
    if (id) {
        // Edit mode
        boothModalTitle.textContent = 'Edit Booth';
        boothIdField.value = id;
        // Fetch existing booth data to populate the form
        const res = await fetch(`/api/booths`);
        const booths = await res.json();
        const booth = booths.find(b => b.id === id);
        if (booth) {
            document.getElementById('boothName').value = booth.name;
            document.getElementById('boothNumber').value = booth.booth_number;
            document.getElementById('inChargeName').value = booth.in_charge_name || '';
            document.getElementById('inChargeContact').value = booth.in_charge_contact || '';
        }
    } else {
        // Add mode
        boothModalTitle.textContent = 'Add New Booth';
        boothIdField.value = '';
    }
    boothModal.style.display = 'flex';
}

/** Closes the booth modal. */
function closeBoothModal() {
    boothModal.style.display = 'none';
}

/** Handles the form submission for saving a booth. */
boothForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = boothIdField.value;
    const isEdit = !!id;
    const url = isEdit ? `/api/booths/${id}` : '/api/booths';
    const method = isEdit ? 'PUT' : 'POST';

    const formData = {
        name: document.getElementById('boothName').value,
        booth_number: document.getElementById('boothNumber').value,
        in_charge_name: document.getElementById('inChargeName').value,
        in_charge_contact: document.getElementById('inChargeContact').value,
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        // If the response is not OK, try to read the error message from the backend
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save booth.');
        }
        
        closeBoothModal();
        loadBoothStrategy(); // Refresh the list
    } catch (error) {
        console.error(error);
        alert(`Error: ${error.message}`); // Display the specific error message
    }
});

/** Deletes a booth after confirmation. */
async function deleteBooth(id) {
    if (!confirm('Are you sure you want to delete this booth? This action cannot be undone.')) {
        return;
    }
    try {
        const response = await fetch(`/api/booths/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete booth.');
        loadBoothStrategy(); // Refresh the list
    } catch (error) {
        console.error(error);
        alert('Error deleting booth.');
    }
}

/** Fetches supporter list and opens it for printing. */
async function generateSlips(id) {
    alert(`(Demo) Generating printable voter slips for supporters in booth #${id}.`);
    // In a real app, this would fetch data and format it into a new window for printing.
}

// Close modal if clicked outside
window.onclick = function(event) {
    if (event.target == boothModal) {
        closeBoothModal();
    }
}
/* =========================
   Voter Analytics Chart Logic
   ========================= */

async function fetchVisualizationData(queryString = "") {
    try {
        const resp = await fetch(`/api/candidate/visualization?${queryString}`);
        if (!resp.ok) throw new Error('Visualization API failed');
        const agg = await resp.json();
        
        const affiliations = agg.affiliations || {};
        const supporterCount = affiliations.Supporter || 0;
        const swingCount = affiliations.SwingVoter || 0;
        const opponentCount = affiliations.Opponent || 0;
        const emptyCount = affiliations.Empty || 0;
        
        document.getElementById('supporterCount').textContent = supporterCount.toLocaleString();
        document.getElementById('swingCount').textContent = swingCount.toLocaleString();
        document.getElementById('opponentCount').textContent = opponentCount.toLocaleString();
        document.getElementById('emptyCount').textContent = emptyCount.toLocaleString();

        renderAffiliationChart(agg.affiliations);
        renderIssueChart(agg.topIssues);
        renderGenderChart(agg.genderSplit);
    } catch (err) {
        console.warn('Failed to fetch visualization data:', err);
        document.getElementById('supporterCount').textContent = 'Err';
        document.getElementById('swingCount').textContent = 'Err';
        document.getElementById('opponentCount').textContent = 'Err';
        document.getElementById('emptyCount').textContent = 'Err';
    }
}

function renderAffiliationChart(data = {}) {
    const ctx = document.getElementById('affiliationChart')?.getContext('2d');
    if (!ctx) return;
    const labels = Object.keys(data);
    const values = Object.values(data);
    const backgroundColors = labels.map(label => {
        const l = label.toLowerCase();
        if (l.includes('supporter')) return '#4CAF50'; // Green
        if (l.includes('opponent')) return '#F44336'; // Red
        if (l.includes('swingvoter')) return '#FFC107'; // Yellow
        return '#9E9E9E'; // Grey for Empty/Other
    });
    if (affiliationChartInstance) affiliationChartInstance.destroy();
    affiliationChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Affiliation Breakdown' }
            }
        }
    });
}

function renderIssueChart(data = {}) {
    const ctx = document.getElementById('issueChart')?.getContext('2d');
    if (!ctx) return;
    const labels = Object.keys(data);
    const values = Object.values(data);
    if (issueChartInstance) issueChartInstance.destroy();
    issueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Voter Count',
                data: values,
                backgroundColor: '#2196F3',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Top 10 Key Issues' }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

function renderGenderChart(data = {}) {
    const ctx = document.getElementById('genderChart')?.getContext('2d');
    if (!ctx) return;
    const labels = Object.keys(data);
    const values = Object.values(data);
    if (genderChartInstance) genderChartInstance.destroy();
    genderChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#3f51b5', '#e91e63', '#9e9e9e'] 
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Gender Breakdown' }
            }
        }
    });
}
/* =========================
   CSV Export Logic
   ========================= */

async function exportVoters() {
    console.log("Exporting voters...");
    const filters = {
        affiliation: document.getElementById('filterAffiliation').value,
        age: document.getElementById('filterAge').value,
        issues: document.getElementById('filterIssues').value,
        occupation: document.getElementById('filterOccupation').value,
        gender: document.getElementById('filterGender').value,
        ward: document.getElementById('filterWard').value,
        education: document.getElementById('filterEducation').value,
    };
    const queryParams = new URLSearchParams();
    for (const key in filters) {
        if (filters[key]) {
            queryParams.append(key, filters[key]);
        }
    }
    queryParams.append('page', '1');
    queryParams.append('per_page', '100000'); 
    try {
        const response = await fetch(`/api/candidate/voters?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch data for export');
        const data = await response.json();
        const voters = data.items;
        if (voters.length === 0) {
            alert("No voters to export for this filter.");
            return;
        }
        const csv = jsonToCsv(voters);
        downloadCsv(csv, 'voter_export.csv');
    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("Could not export voter data.");
    }
}

function jsonToCsv(json) {
    const items = json;
    const headers = [
        "ID", "Name", "Father's or Husband's name", "Age", "Gender", 
        "House number", "EPIC number", "Mobile Number", "Occupation", 
        "Education Level", "Political Affiliation", "Key Issues", "Remarks"
    ];
    let csv = headers.join(',') + '\r\n';
    for (const row of items) {
        const values = headers.map(header => {
            let val = row[header] === null || row[header] === undefined ? '' : row[header];
            let strVal = String(val);
            if (strVal.includes('"') || strVal.includes(',')) {
                strVal = `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        });
        csv += values.join(',') + '\r\n';
    }
    return csv;
}

function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ✅ Chatbot Messaging Logic — FINAL
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const voiceBtn = document.getElementById("voiceBtn");
let currentLang = "en";

function addMessage(text, from) {
    const div = document.createElement("div");
    div.className = `message ${from === "user" ? "user-msg" : "bot-msg"}`;
    div.innerHTML = `
        <div class="avatar">${from === "user" ? "🧑" : "🤖"}</div>
        <div class="bubble">${text}</div>
    `;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ✅ Send to Backend
async function sendToServer() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    chatInput.value = "";

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg, lang: currentLang })
        });

        const data = await res.json();
        addMessage(data.reply, "bot");
    } catch {
        addMessage("⚠️ Network issue.", "bot");
    }
}

chatSendBtn.addEventListener("click", sendToServer);
chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendToServer();
});

// ✅ Voice Support — if available
if (window.webkitSpeechRecognition) {
    const recog = new webkitSpeechRecognition();
    recog.lang = "en-IN";

    voiceBtn.addEventListener("click", () => recog.start());
    recog.onresult = e => {
        chatInput.value = e.results[0][0].transcript;
        sendToServer();
    };
} else {
    voiceBtn.style.display = "none";
}

// ✅ Language Toggle
document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        currentLang = btn.dataset.lang;

        document.querySelectorAll(".lang-btn")
            .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        chatInput.placeholder = currentLang === "mr"
            ? "प्रश्न विचारा..."
            : "Ask your question...";
    });
});

// ✅ Welcome Message
addMessage("Hello! I assist with voter analytics + general political strategy. 😊", "bot");
