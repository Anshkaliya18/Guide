// Simple frontend for Earth Explorer chatbot

// Ensure DOM elements exist before wiring up handlers
function addMessage(text, className) {
    const chat = document.getElementById('chat');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = 'msg ' + (className || '');
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Try to pick a working API base. When the page is served from a static
// server (e.g. Live Server) the origin may not provide the API endpoints;
// probe the current origin first, then fall back to the local Python server.
async function probeApiBase() {
    if (window.__apiBase__) return window.__apiBase__;
    const candidates = [];
    if (location.origin && location.origin !== 'null' && !location.origin.startsWith('file:')) candidates.push(location.origin);
    candidates.push('http://127.0.0.1:8000');

    for (const base of candidates) {
        try {
            const resp = await fetch(`${base}/api/health`, { method: 'GET', mode: 'cors' });
            if (resp.ok) {
                window.__apiBase__ = base;
                return base;
            }
        } catch (e) {
            // ignore and try next
        }
    }
    // Default to localhost if nothing responded
    window.__apiBase__ = candidates[candidates.length - 1];
    return window.__apiBase__;
}

async function sendMessage() {
    const API_BASE = await probeApiBase();
    const input = document.getElementById('msgInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    addMessage('You: ' + msg, 'user');
    input.value = '';

    // Show loader overlay if present
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.classList.add('active');

    try {
        let resp = null;
        try {
            resp = await fetch(`${API_BASE}/api/chat?msg=${encodeURIComponent(msg)}`, { mode: 'cors' });
        } catch (e) {
            // If the probe picked a non-API origin (e.g. Live Server), try localhost fallback
            if (API_BASE !== 'http://127.0.0.1:8000') {
                try {
                    resp = await fetch(`http://127.0.0.1:8000/api/chat?msg=${encodeURIComponent(msg)}`, { mode: 'cors' });
                    window.__apiBase__ = 'http://127.0.0.1:8000';
                } catch (e2) {
                    throw e2;
                }
            } else {
                throw e;
            }
        }

        // Try to parse JSON if the server returned JSON, otherwise read text
        const contentType = resp.headers.get('content-type') || '';
        let reply = '';
        if (contentType.includes('application/json')) {
            const data = await resp.json().catch(() => ({}));
            reply = data && (data.reply || data.message || data.error || '') || '';
        } else {
            reply = await resp.text().catch(() => '');
        }

        if (!reply) reply = resp.ok ? "(no reply)" : `(error ${resp.status}) ${reply}`;
        addMessage('Bot: ' + reply, 'bot');
    } catch (e) {
        addMessage('Bot: (network error)', 'bot');
        console.warn('chat sendMessage error:', e);
    } finally {
        if (loader) loader.classList.remove('active');
    }
}

const sendBtn = document.getElementById('sendBtn');
const msgInput = document.getElementById('msgInput');
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (msgInput) msgInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});
