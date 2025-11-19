import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads, loadHistoryData } from './dashboard.js';
import { loadStoreAndProductData, loadUserRewardsData, renderRewards } from './store.js';
import { loadLeaderboardData } from './social.js';
import { loadChallengesData, loadEventsData } from './challenges.js';

// Auth
const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { console.error('Session Error:', error.message); redirectToLogin(); return; }
        if (!session) { console.log('No active session.'); redirectToLogin(); return; }
        console.log('Authenticated.');
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { console.error('Auth check failed:', err); }
};

const initializeApp = async () => {
    try {
        const { data: userProfile, error } = await supabase.from('users').select('*').eq('auth_user_id', state.userAuth.id).single();
        if (error || !userProfile) { alert('Could not load profile. Logging out.'); await handleLogout(); return; }
        
        state.currentUser = userProfile;
        await loadDashboardData();
        renderDashboard(); 
        
        setTimeout(() => document.getElementById('app-loading').classList.add('loaded'), 500);
        if(window.lucide) window.lucide.createIcons();
        
        await Promise.all([
            loadStoreAndProductData(),
            loadLeaderboardData(),
            loadHistoryData(),
            loadChallengesData(),
            loadEventsData(),
            loadUserRewardsData()
        ]);
        setupFileUploads();
    } catch (err) { console.error('Initialization Error:', err); }
};

const handleLogout = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Logout error:', error.message);
        redirectToLogin();
    } catch (err) { console.error('Logout Error:', err); }
};

const redirectToLogin = () => { window.location.replace('login.html'); };

export const refreshUserData = async () => {
    try {
         const { data: userProfile, error } = await supabase.from('users').select('*').eq('id', state.currentUser.id).single();
        if (error || !userProfile) return;
        state.currentUser = userProfile;
        const header = document.getElementById('user-points-header');
        header.classList.add('points-pulse'); header.textContent = userProfile.current_points;
        document.getElementById('user-points-sidebar').textContent = userProfile.current_points;
        setTimeout(() => header.classList.remove('points-pulse'), 400);
        renderDashboard();
    } catch (err) { console.error('Refresh User Data Error:', err); }
};

// Event Listeners
if(els.storeSearch) els.storeSearch.addEventListener('input', renderRewards);
if(els.storeSearchClear) els.storeSearchClear.addEventListener('click', () => { els.storeSearch.value = ''; renderRewards(); });
if(els.sortBy) els.sortBy.addEventListener('change', renderRewards);
document.getElementById('sidebar-toggle-btn').addEventListener('click', () => toggleSidebar());
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Theme
const themeBtn = document.getElementById('theme-toggle-btn');
const themeText = document.getElementById('theme-text');
const themeIcon = document.getElementById('theme-icon');
const applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    if(window.lucide) window.lucide.createIcons();
};
themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
});
const savedTheme = localStorage.getItem('eco-theme');
applyTheme(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches));

// Forms
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const msgEl = document.getElementById('password-message');
    const btn = document.getElementById('change-password-button');
    btn.disabled = true; msgEl.textContent = 'Updating...';
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        msgEl.textContent = 'Password updated successfully!'; msgEl.classList.add('text-green-500');
        document.getElementById('new-password').value = '';
    } catch (err) { msgEl.textContent = `Error: ${err.message}`; msgEl.classList.add('text-red-500'); } 
    finally { btn.disabled = false; setTimeout(() => { msgEl.textContent = ''; msgEl.classList.remove('text-red-500', 'text-green-500'); }, 3000); }
});

document.getElementById('redeem-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('redeem-input').value;
    const msgEl = document.getElementById('redeem-message');
    const btn = document.getElementById('redeem-submit-btn');
    btn.disabled = true; msgEl.textContent = 'Redeeming...';
    try {
        const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
        if (error) throw error;
        msgEl.textContent = `Success! You earned ${data.points_awarded} points.`; msgEl.classList.add('text-green-500');
        document.getElementById('redeem-input').value = '';
        await refreshUserData(); 
    } catch (err) { msgEl.textContent = `Error: ${err.message}`; msgEl.classList.add('text-red-500'); } 
    finally { btn.disabled = false; setTimeout(() => { msgEl.textContent = ''; msgEl.classList.remove('text-red-500', 'text-green-500'); }, 3000); }
});

document.getElementById('chatbot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatbot-input');
    const messages = document.getElementById('chatbot-messages');
    if (input.value.trim() === '') return;
    messages.innerHTML += `<div class="flex justify-end"><div class="bg-green-600 text-white p-3 rounded-lg rounded-br-none max-w-xs"><p class="text-sm">${input.value}</p></div></div>`;
    setTimeout(() => {
        messages.innerHTML += `<div class="flex"><div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-none max-w-xs"><p class="text-sm text-gray-800 dark:text-gray-100">I'm sorry, I'm just a demo. I can't process requests yet.</p></div></div>`;
        messages.scrollTop = messages.scrollHeight;
    }, 1000);
    input.value = ''; messages.scrollTop = messages.scrollHeight;
});

// Attach logout to window for backup access
window.handleLogout = handleLogout;

// Start
checkAuth();
