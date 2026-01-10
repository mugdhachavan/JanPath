// static/js/main.js

// Function to toggle between dashboard sections
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    // Update active navigation link
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`.main-nav a[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Optional: Default to first section when page loads
document.addEventListener('DOMContentLoaded', () => {
    const defaultSection = document.querySelector('.dashboard-section');
    if (defaultSection) {
        defaultSection.style.display = 'block';
    }
});
