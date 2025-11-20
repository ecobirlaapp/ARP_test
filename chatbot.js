import { state } from './state.js';
import { els } from './utils.js';

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// PASTE YOUR NEW KEY HERE (The one ending in ...yaU or ...JCCU)
const GEMINI_API_KEY = 'AIzaSyCJKZPm8hQafgfEoFRN4_P04gkcdBv_yaU'; 

// FIX: Changed model from 'gemini-pro' to 'gemini-1.5-flash' (The new standard)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ==========================================
// 🧠 AI LOGIC
// ==========================================

const getSystemPrompt = () => {
    const user = state.currentUser || { full_name: 'Student', current_points: 0 };
    return `
    You are EcoBot, the AI assistant for EcoCampus.
    User: ${user.full_name}
    Points: ${user.current_points}
    
    Knowledge:
    - Earn points by Daily Check-in, Events, and Uploading photos.
    - Spend points in the Store.
    
    Keep answers short, friendly, and use emojis 🌿.
    `;
};

const fetchAIResponse = async (userMessage) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_YOUR')) {
        return "⚠️ API Key is missing. Please paste it in chatbot.js line 8.";
    }

    const payload = {
        contents: [{
            parts: [{
                text: getSystemPrompt() + `\n\nUser: ${userMessage}\nEcoBot:`
            }]
        }]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Google Error:", data);
            return `❌ Google Error: ${data.error?.message || 'Unknown error'}`;
        }

        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        return `❌ Network Error: ${error.message}`;
    }
};

// ==========================================
// 🎨 UI HANDLERS
// ==========================================

const chatOutput = document.getElementById('chatbot-messages');
const chatForm = document.getElementById('chatbot-form');
const chatInput = document.getElementById('chatbot-input');
const modal = document.getElementById('chatbot-modal');
const modalContent = document.getElementById('chatbot-modal-content');

const appendMessage = (text, sender) => {
    const div = document.createElement('div');
    div.className = 'flex w-full mb-4 animate-fade-in';
    
    if (sender === 'user') {
        div.innerHTML = `<div class="ml-auto bg-green-600 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md"><p class="text-sm">${text}</p></div>`;
    } else {
        div.innerHTML = `
            <div class="flex items-end">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-6 h-6 mr-2 mb-1 object-contain">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none max-w-[80%] shadow-sm">
                    <p class="text-sm text-gray-800 dark:text-gray-100">${marked.parse(text)}</p> 
                </div>
            </div>`;
    }
    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight; 
};

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage(message, 'user');
        chatInput.value = '';
        
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'flex w-full mb-4';
        typingDiv.innerHTML = `<div class="flex items-end"><div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none shadow-sm"><div class="flex space-x-1"><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div></div></div></div>`;
        chatOutput.appendChild(typingDiv);
        chatOutput.scrollTop = chatOutput.scrollHeight;

        const botResponse = await fetchAIResponse(message);

        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.remove();
        appendMessage(botResponse, 'bot');
    });
}

window.openChatbotModal = () => {
    modal.classList.remove('invisible', 'opacity-0');
    modal.classList.add('open'); 
    setTimeout(() => { modalContent.classList.remove('translate-y-full'); modalContent.classList.add('translate-y-0'); }, 10);
};

window.closeChatbotModal = () => {
    modalContent.classList.remove('translate-y-0');
    modalContent.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.remove('open'); modal.classList.add('invisible', 'opacity-0'); }, 300);
};

const marked = {
    parse: (text) => {
        if(!text) return '';
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\n/g, '<br>');
        return text;
    }
};
