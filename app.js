import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, setupLazyImages, isLowDataMode, logActivity } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads, loadHistoryData } from './dashboard.js';
import { loadStoreAndProductData, loadUserRewardsData, renderRewards } from './store.js';
import { loadLeaderboardData } from './social.js';
import { loadChallengesData } from './challenges.js';
import { loadEventsData } from './events.js';
import { initRealtime } from './realtime.js';

// Auth
const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { console.error('Session Error:', error.message); redirectToLogin(); return; }
        if (!session) { console.log('No active session.'); redirectToLogin(); return; }
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { console.error('Auth check failed:', err); }
};

const initializeApp = async () => {
    try {
        const { data: userProfile, error } = await supabase.from('users').select('*').eq('auth_user_id', state.userAuth.id).single();
        if (error || !userProfile) { alert('Could not load profile. Logging out.'); await handleLogout(); return; }
        
        state.currentUser = userProfile;
        
        // Initialize History State for Mobile Back Button
        history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        // Initial Load (Cache-first logic will be handled in respective modules)
        await loadDashboardData();
        renderDashboard(); 
        
        setTimeout(() => document.getElementById('app-loading').classList.add('loaded'), 500);
        if(window.lucide) window.lucide.createIcons();
        
        // Realtime Updates (Only if not in Low-Data Mode)
        if (!isLowDataMode()) {
            initRealtime();
        } else {
            console.log("⚠️ Low Data Mode detected: Realtime updates paused.");
        }

        // Lazy Loading Images
        setupLazyImages();

        // Load other data (Parallel)
        await Promise.all([
            loadStoreAndProductData(),
            loadLeaderboardData(),
            loadHistoryData(),
            loadChallengesData(),
            loadEventsData(),
            loadUserRewardsData()
        ]);

        setupFileUploads();
        
        // Log App Open
        logActivity('app_open', { page: 'dashboard' });

    } catch (err) { console.error('Initialization Error:', err); }
};

const handleLogout = async () => {
    try {
        logActivity('logout', { user_id: state.currentUser?.id });
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
        
        // Preserving local state
        const existingState = {
            isCheckedInToday: state.currentUser.isCheckedInToday,
            checkInStreak: state.currentUser.checkInStreak,
            impact: state.currentUser.impact
        };

        state.currentUser = { ...userProfile, ...existingState };

        const header = document.getElementById('user-points-header');
        if (header) {
            header.classList.add('points-pulse'); 
            header.textContent = userProfile.current_points;
            setTimeout(() => header.classList.remove('points-pulse'), 400);
        }
        
        const sidebarPoints = document.getElementById('user-points-sidebar');
        if (sidebarPoints) sidebarPoints.textContent = userProfile.current_points;

        renderDashboard();
    } catch (err) { console.error('Refresh User Data Error:', err); }
};

// Event Listeners
if(els.storeSearch) els.storeSearch.addEventListener('input', () => {
    renderRewards();
});
if(els.storeSearchClear) els.storeSearchClear.addEventListener('click', () => { 
    els.storeSearch.value = ''; 
    renderRewards(); 
});
if(els.sortBy) els.sortBy.addEventListener('change', (e) => {
    renderRewards();
    logActivity('sort_store', { criteria: e.target.value });
});

document.getElementById('sidebar-toggle-btn').addEventListener('click', () => toggleSidebar());
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Theme Logic
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
    logActivity('theme_toggle', { mode: isDark ? 'dark' : 'light' });
});
const savedTheme = localStorage.getItem('eco-theme');
applyTheme(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches));

// --- FORM LOGIC ---

// 1. Change Password Form
const changePwdForm = document.getElementById('change-password-form');
if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const passwordInput = document.getElementById('new-password');
        const newPassword = passwordInput.value;
        const msgEl = document.getElementById('password-message');
        const btn = document.getElementById('change-password-button');

        // Validation
        if (newPassword.length < 6) {
             msgEl.textContent = 'Password must be at least 6 characters.';
             msgEl.className = 'text-sm text-center text-red-500 font-bold';
             return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';
        msgEl.textContent = '';

        try {
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            msgEl.textContent = 'Password updated successfully!';
            msgEl.className = 'text-sm text-center text-green-600 font-bold';
            passwordInput.value = ''; 
            logActivity('change_password', { status: 'success' });

        } catch (err) {
            console.error('Password Update Error:', err);
            msgEl.textContent = err.message || 'Failed to update password.';
            msgEl.className = 'text-sm text-center text-red-500 font-bold';
            logActivity('change_password', { status: 'failure', error: err.message });
        } finally {
            btn.disabled = false;
            btn.textContent = 'Update Password';
            setTimeout(() => { if (msgEl.textContent.includes('success')) msgEl.textContent = ''; }, 3000);
        }
    });
}

// 2. Redeem Code Form
const redeemForm = document.getElementById('redeem-code-form');
if (redeemForm) {
    redeemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const codeInput = document.getElementById('redeem-input');
        const code = codeInput.value.trim();
        const msgEl = document.getElementById('redeem-message');
        const btn = document.getElementById('redeem-submit-btn');
        
        btn.disabled = true; 
        btn.innerText = 'Verifying...'; 
        msgEl.textContent = '';
        msgEl.className = 'text-sm text-center h-5'; 

        try {
            const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
            
            if (error) throw error;
            
            msgEl.textContent = `Success! You earned ${data.points_awarded} points.`; 
            msgEl.classList.add('text-green-600', 'font-bold');
            codeInput.value = ''; 
            
            await refreshUserData(); 
            logActivity('redeem_code', { code: code, points: data.points_awarded, status: 'success' });
            
        } catch (err) { 
            console.error("Redemption Error:", err);
            msgEl.textContent = err.message || "Invalid or expired code."; 
            msgEl.classList.add('text-red-500', 'font-bold'); 
            logActivity('redeem_code', { code: code, status: 'failure', error: err.message });
        } finally { 
            btn.disabled = false; 
            btn.innerText = 'Redeem Points';
            setTimeout(() => { 
                msgEl.textContent = ''; 
                msgEl.classList.remove('text-red-500', 'text-green-600', 'font-bold'); 
            }, 4000); 
        }
    });
}

// Attach logout to window for backup access
window.handleLogout = handleLogout;

// Start
checkAuth();
