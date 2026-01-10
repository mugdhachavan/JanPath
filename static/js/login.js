// static/js/login.js

document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Basic client-side validation
    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    // --- FOR DEMO PURPOSES ONLY ---
    if (username === 'admin' && password === 'admin') {
        alert('Admin login successful!');
        window.location.href = '/admin'; // Flask route for admin
    } else if (username === 'candidate' && password === 'candidate') {
        alert('Candidate login successful!');
        window.location.href = '/candidate'; // Flask route for candidate
    } else if (username === 'worker' && password === 'worker') {
        alert('Party Worker login successful!');
        window.location.href = '/worker'; // Flask route for worker dashboard
    } else {
        alert('Invalid credentials. Try "admin/admin", "candidate/candidate", or "worker/worker".');
    }
    // --- END DEMO ---

    // In production, send to backend
    /*
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.role === 'admin') {
                window.location.href = '/admin';
            } else if (data.role === 'candidate') {
                window.location.href = '/candidate';
            } else if (data.role === 'party-worker') {
                window.location.href = '/worker';
            }
        } else {
            alert('Login failed: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        alert('An error occurred during login. Please try again.');
    });
    */
});
