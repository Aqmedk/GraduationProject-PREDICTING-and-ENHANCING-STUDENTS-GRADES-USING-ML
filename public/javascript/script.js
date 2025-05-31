document.addEventListener('DOMContentLoaded', function () {
    // if (window.location.pathname !== '/') {
    //     const backArrow = document.createElement('div');
    //     backArrow.className = 'back-arrow';
    //     backArrow.innerHTML = '&#8592;';
    //     backArrow.onclick = function () {

    //         window.history.back();
    //     };
    //     document.body.appendChild(backArrow);
    // }
});


document.addEventListener("DOMContentLoaded", function () {
    let savedGrades = JSON.parse(localStorage.getItem("grades")) || {}; // Load existing or create empty
    if (window.location.pathname !== '/Login' || window.location.pathname !== '/Register' || window.location.pathname !== '/') {
        const footer = document.getElementsByClassName("footer")[0];


    }

    // Default values
    const defaultGrades = {
        cs222: "NA",
        cs214: "NA",
        coe351: "NA",
        cs315: "NA"
    };

    // Merge saved grades with defaults
    savedGrades = { ...defaultGrades, ...savedGrades };

    // Pre-fill dropdowns with saved values
    document.getElementById("cs222").value = savedGrades.cs222;
    document.getElementById("cs214").value = savedGrades.cs214;
    document.getElementById("coe351").value = savedGrades.coe351;
    document.getElementById("cs315").value = savedGrades.cs315;
});

function saveChanges() {
    const grades = {
        cs222: document.getElementById("cs222").value,
        cs214: document.getElementById("cs214").value,
        coe351: document.getElementById("coe351").value,
        cs315: document.getElementById("cs315").value
    };

    localStorage.setItem("grades", JSON.stringify(grades));
    alert("Grades saved!");

    // Ensure redirect works (update filename if needed)
    window.location.href = "MainMenu"; // Ensure this file exists
}


function chatbot() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('messageInput');
    const chatCon = document.getElementById('chatCon');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (!message) return;

        // Add user message immediately
        const userMsg = document.createElement('p');
        userMsg.innerHTML = `<strong>You:</strong> ${message}`;
        chatCon.appendChild(userMsg);

        input.value = '';

        // Send message via AJAX
        const response = await fetch('/AI', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        const aiMsg = document.createElement('p');
        aiMsg.innerHTML = `<strong>AI:</strong> ${data.AI}`;
        chatCon.appendChild(aiMsg);

        const hr = document.createElement('hr');
        hr.style.color = 'black';
        chatCon.appendChild(hr);

        chatCon.scrollTop = chatCon.scrollHeight;
    });

    // Scroll to bottom on page load
    chatCon.scrollTop = chatCon.scrollHeight;
}


