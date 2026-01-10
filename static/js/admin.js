// --- Dummy functions for demonstration for Admin Dashboard ---
function addWard() {
    const wardName = document.getElementById('wardName').value;
    if (wardName) {
        alert(`Adding Ward: ${wardName}`);
        document.getElementById('wardName').value = '';
        // In real app: fetch('/api/admin/wards', { method: 'POST', body: JSON.stringify({ ward_name: wardName }) })
    } else {
        alert('Please enter a ward name.');
    }
}

function editWard(id, name) {
    const newName = prompt(`Editing Ward ID ${id}. Enter new name for "${name}":`);
    if (newName && newName !== name) {
        alert(`Updating Ward ID ${id} to ${newName}`);
        // In real app: fetch(`/api/admin/wards/${id}`, { method: 'PUT', body: JSON.stringify({ ward_name: newName }) })
    }
}

function deleteWard(id) {
    if (confirm(`Are you sure you want to delete Ward ID ${id}?`)) {
        alert(`Deleting Ward ID ${id}`);
        // In real app: fetch(`/api/admin/wards/${id}`, { method: 'DELETE' })
    }
}

function addWorker() {
    const workerName = document.getElementById('workerName').value;
    const workerUsername = document.getElementById('workerUsername').value;
    if (workerName && workerUsername) {
        alert(`Adding Worker: ${workerName} (Username: ${workerUsername})`);
        document.getElementById('workerName').value = '';
        document.getElementById('workerUsername').value = '';
        // In real app: fetch('/api/admin/workers', { method: 'POST', body: JSON.stringify({ name: workerName, username: workerUsername }) })
    } else {
        alert('Please enter worker name and username.');
    }
}

function editWorker(id, name) {
    const newName = prompt(`Editing Worker ID ${id}. Enter new name for "${name}":`);
    if (newName && newName !== name) {
        alert(`Updating Worker ID ${id} to ${newName}`);
        // In real app: fetch(`/api/admin/workers/${id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) })
    }
}

function assignWards(id) {
    const wards = prompt(`Assigning wards for Worker ID ${id}. Enter ward IDs separated by commas (e.g., 1,2,5):`);
    if (wards) {
        alert(`Assigning wards [${wards}] to Worker ID ${id}`);
        // In real app: fetch(`/api/admin/workers/${id}/assign-ward`, { method: 'POST', body: JSON.stringify({ ward_ids: wards.split(',').map(Number) }) })
    }
}

function deleteWorker(id) {
    if (confirm(`Are you sure you want to delete Worker ID ${id}?`)) {
        alert(`Deleting Worker ID ${id}`);
        // In real app: fetch(`/api/admin/workers/${id}`, { method: 'DELETE' })
    }
}

function importVoterData() {
    const fileInput = document.getElementById('voterFile');
    const statusDiv = document.getElementById('importStatus');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        statusDiv.textContent = `Uploading ${file.name}...`;
        // Simulate upload
        setTimeout(() => {
            statusDiv.textContent = `${file.name} imported successfully! (This is a dummy message)`;
            alert('File uploaded and ready for processing by backend.');
        }, 2000);
        // In real app:
        // const formData = new FormData();
        // formData.append('voter_data', file);
        // fetch('/api/admin/voters/import', { method: 'POST', body: formData })
        // .then(response => response.json())
        // .then(data => { /* handle response */ })
        // .catch(error => { /* handle error */ });
    } else {
        statusDiv.textContent = 'Please select a file to import.';
    }
}

function loadAnalytics() {
    const selectedWard = document.getElementById('analyticsWardSelect').value;
    alert(`Loading analytics for Ward ID: ${selectedWard || 'All Wards'}`);
    // In real app: fetch(`/api/admin/analytics/voter-demographics-by-ward/${selectedWard}`)
    // Then use a charting library (Chart.js, D3.js) to render data
}