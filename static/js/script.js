// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginBtn = document.getElementById('login-popup-btn');
    const loginModal = document.getElementById('login-modal');
    const loginCloseBtn = loginModal ? loginModal.querySelector('.close-btn') : null;
    const loginTitle = loginModal ? loginModal.querySelector('h2') : null;

    const roleModal = document.getElementById('roleModal');
    const roleCloseBtn = roleModal ? roleModal.querySelector('.close-btn') : null;

    const candidateBtn = document.querySelector('.candidate');
    const partyBtn = document.querySelector('.party');
    const adminBtn = document.querySelector('.admin');

    const defaultLoginTitle = "Welcome Back!";

    /* -------------------------
       STEP 1: Open Role Modal
    ------------------------- */
    if (loginBtn && roleModal) {
        loginBtn.addEventListener('click', () => {
            // Reset login modal heading if it was changed previously
            if (loginTitle) loginTitle.textContent = defaultLoginTitle;

            // Show role modal
            roleModal.style.display = 'flex';
        });
    }

    /* -------------------------
       STEP 2: Close Role Modal
    ------------------------- */
    if (roleCloseBtn) {
        roleCloseBtn.addEventListener('click', () => {
            roleModal.style.display = 'none';
        });
    }

    // Close role modal if clicked outside
    window.addEventListener('click', (e) => {
        if (e.target === roleModal) {
            roleModal.style.display = 'none';
        }
    });

    /* -------------------------
       STEP 3: When Role Selected
       → Close Role Modal & Show Login Modal
    ------------------------- */
    const openLoginModal = (role) => {
        // Hide role modal
        roleModal.style.display = 'none';

        // Show login modal
        if (loginModal) {
            loginModal.style.display = 'flex';
        }

        // Change heading text dynamically
        if (loginTitle) {
            loginTitle.textContent = `Welcome ${role}!`;
        }

        // Store selected role
        localStorage.setItem('selectedRole', role);
    };

    if (candidateBtn) candidateBtn.addEventListener('click', () => openLoginModal('Candidate'));
    if (partyBtn) partyBtn.addEventListener('click', () => openLoginModal('Party Worker'));
    if (adminBtn) adminBtn.addEventListener('click', () => openLoginModal('Admin'));

    /* -------------------------
       STEP 4: Login Modal Controls
    ------------------------- */
    if (loginCloseBtn) {
        loginCloseBtn.addEventListener('click', () => {
            loginModal.style.display = 'none';
            if (loginTitle) loginTitle.textContent = defaultLoginTitle; // reset title
        });
    }

    // Close login modal when clicking outside
    window.addEventListener('click', (e) => {
        if (loginModal && e.target === loginModal) {
            loginModal.style.display = 'none';
            if (loginTitle) loginTitle.textContent = defaultLoginTitle;
        }
    });

    // Allow ESC key to close both modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (loginModal && loginModal.style.display === 'flex') {
                loginModal.style.display = 'none';
                if (loginTitle) loginTitle.textContent = defaultLoginTitle;
            }
            if (roleModal && roleModal.style.display === 'flex') {
                roleModal.style.display = 'none';
            }
        }
    });
});
