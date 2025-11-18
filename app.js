// =========================================
// 1. IMPORTS & SETUP
// =========================================
import { supabase } from './supabase-client.js';

// =========================================
// 2. APPLICATION STATE
// =========================================

let state = {
    currentUser: null, // Will hold profile from 'users' table
    userAuth: null,    // Will hold 'auth.users' object
    checkInReward: 10,
    leaderboard: [],
    stores: [],
    products: [],      // All products, flattened
    history: [],
    dailyChallenges: [],
    events: [],
    userRewards: [],   // User's 'orders'
    levels: [
        { level: 1, title: 'Green Starter', minPoints: 0, nextMin: 1001 },
        { level: 2, title: 'Eco Learner', minPoints: 1001, nextMin: 2001 },
        { level: 3, title: 'Sustainability Leader', minPoints: 2001, nextMin: 4001 },
    ]
};

// =========================================
// 3. AUTHENTICATION
// =========================================

/**
 * Checks if a user is logged in.
 * If not, redirects to login.html.
 * If logged in, loads the application.
 */
const checkAuth = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting session:', error.message);
        redirectToLogin();
        return;
    }
    
    if (!session) {
        console.log('No active session. Redirecting to login.');
        redirectToLogin();
        return;
    }

    // User is logged in
    console.log('Session found. User is authenticated.');
    state.userAuth = session.user;
    await initializeApp();
};

/**
 * Main data-loading function after auth.
 */
const initializeApp = async () => {
    // 1. Get the user's profile from the 'users' table
    const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', state.userAuth.id)
        .single();

    if (error || !userProfile) {
        console.error('Error fetching user profile:', error?.message);
        alert('Could not load user profile. Logging out.');
        await handleLogout();
        return;
    }

    state.currentUser = userProfile;
    console.log('Current user profile loaded:', state.currentUser);

    // 2. Load all initial data in parallel
    // We can show the app *after* the most critical data (dashboard) is loaded
    await loadDashboardData();
    renderDashboard(); // First render to show user info
    
    // Hide loader
    setTimeout(() => document.getElementById('app-loading').classList.add('loaded'), 500);
    lucide.createIcons();
    
    // Load other data in the background
    Promise.all([
        loadStoreAndProductData(),
        loadLeaderboardData(),
        loadHistoryData(),
        loadChallengesData(),
        loadEventsData(),
        loadUserRewardsData()
    ]);
};

const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error.message);
    }
    redirectToLogin();
};

const redirectToLogin = () => {
    window.location.replace('login.html');
};

// =========================================
// 4. DATA LOADING (FETCH FROM SUPABASE)
// =========================================

const getTodayDateString = () => new Date().toISOString().split('T')[0];

/**
 * Fetches all data needed for the dashboard.
 * - User's check-in status
 * - User's streak
 * - User's impact
 * - A featured event
 */
const loadDashboardData = async () => {
    const userId = state.currentUser.id;
    const today = getTodayDateString();

    const [
        { data: checkinData, error: checkinError },
        { data: streakData, error: streakError },
        { data: impactData, error: impactError },
        { data: eventData, error: eventError }
    ] = await Promise.all([
        supabase.from('daily_checkins').select('id').eq('user_id', userId).eq('checkin_date', today).limit(1),
        supabase.from('user_streaks').select('current_streak').eq('user_id', userId).single(),
        supabase.from('user_impact').select('*').eq('user_id', userId).single(),
        supabase.from('events').select('title, description').order('start_at', { ascending: true }).limit(1)
    ]);
    
    // Process Check-in
    if (!checkinError && checkinData && checkinData.length > 0) {
        state.currentUser.isCheckedInToday = true;
    } else {
        state.currentUser.isCheckedInToday = false;
    }

    // Process Streak
    if (!streakError && streakData) {
        state.currentUser.checkInStreak = streakData.current_streak;
    } else {
        state.currentUser.checkInStreak = 0;
    }
    
    // Process Impact
    if (!impactError && impactData) {
        state.currentUser.impact = impactData;
    } else {
        state.currentUser.impact = { total_plastic_kg: 0, co2_saved_kg: 0, events_attended: 0 };
    }
    
    // Process Event
    if (!eventError && eventData && eventData.length > 0) {
        state.featuredEvent = eventData[0];
    } else {
        state.featuredEvent = { title: "No upcoming events", description: "Check back soon for more activities!" };
    }
};

/**
 * Fetches all store and product data.
 * This is a complex query joining multiple tables.
 */
const loadStoreAndProductData = async () => {
    const { data, error } = await supabase
        .from('products')
        .select(`
            id, name, description, original_price, discounted_price, ecopoints_cost,
            store_id,
            stores ( name, logo_url ),
            product_images ( image_url, sort_order ),
            product_features ( feature, sort_order ),
            product_specifications ( spec_key, spec_value, sort_order )
        `)
        .eq('is_active', true);
        
    if (error) {
        console.error('Error fetching products:', error.message);
        return;
    }

    // Process and flatten data
    const products = data.map(p => ({
        ...p,
        // Ensure arrays are sorted
        images: p.product_images.sort((a,b) => a.sort_order - b.sort_order).map(img => img.image_url),
        features: p.product_features.sort((a,b) => a.sort_order - b.sort_order).map(f => f.feature),
        specifications: p.product_specifications.sort((a,b) => a.sort_order - b.sort_order),
        // Flatten store info
        storeName: p.stores.name,
        storeLogo: p.stores.logo_url,
        // Add a default popularity score (you can add this column to your table)
        popularity: Math.floor(Math.random() * 50) 
    }));
    
    state.products = products;
    console.log('Products loaded:', state.products);
    
    // Re-render rewards if on that page
    if (document.getElementById('rewards').classList.contains('active')) {
        renderRewards();
    }
};

/**
 * Fetches leaderboard data (top 20 users).
 */
const loadLeaderboardData = async () => {
    const { data, error } = await supabase
        .from('users')
        .select('id, full_name, course, lifetime_points, profile_img_url')
        .order('lifetime_points', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching leaderboard:', error.message);
        return;
    }

    state.leaderboard = data.map(u => ({
        ...u,
        name: u.full_name,
        initials: (u.full_name || '...').split(' ').map(n => n[0]).join(''),
        isCurrentUser: u.id === state.currentUser.id
    }));
    
    console.log('Leaderboard loaded:', state.leaderboard);
    
    // TODO: Add department leaderboard loading
    state.departmentLeaderboard = [
        { id: 'd1', name: 'BSc IT', points: 0 },
        { id: 'd2', name: 'BMS', points: 0 },
        { id: 'd3', name: 'BAF', points: 0 },
    ];
    
    if (document.getElementById('leaderboard').classList.contains('active')) {
        renderStudentLeaderboard();
        renderDepartmentLeaderboard();
    }
};

/**
 * Fetches user's transaction history.
 */
const loadHistoryData = async () => {
    const { data, error } = await supabase
        .from('points_ledger')
        .select('*')
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching history:', error.message);
        return;
    }

    state.history = data.map(item => ({
        type: item.source_type,
        description: item.description,
        points: item.points_delta,
        date: formatDate(item.created_at),
        icon: getIconForHistory(item.source_type)
    }));
    
    console.log('History loaded:', state.history);
    if (document.getElementById('history').classList.contains('active')) {
        renderHistory();
    }
};

/**
 * Fetches active challenges.
 */
const loadChallengesData = async () => {
    const { data, error } = await supabase
        .from('challenges')
        .select('id, title, description, points_reward, type')
        .eq('is_active', true);
        
    if (error) {
        console.error('Error fetching challenges:', error.message);
        return;
    }
    
    state.dailyChallenges = data.map(c => ({
        ...c,
        icon: getIconForChallenge(c.type),
        status: 'active', // TODO: Check 'challenge_submissions' table
        buttonText: c.type === 'quiz' ? 'Start Quiz' : 'Upload Selfie'
    }));

    console.log('Challenges loaded:', state.dailyChallenges);
    if (document.getElementById('challenges').classList.contains('active')) {
        renderChallengesPage();
    }
};

/**
 * Fetches all events.
 */
const loadEventsData = async () => {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true });

    if (error) {
        console.error('Error fetching events:', error.message);
        return;
    }

    state.events = data.map(e => ({
        ...e,
        date: formatDate(e.start_at, { month: 'short', day: 'numeric', year: 'numeric' }),
        points: e.points_reward,
        status: 'upcoming' // TODO: Check 'event_attendance' table
    }));

    console.log('Events loaded:', state.events);
    if (document.getElementById('events').classList.contains('active')) {
        renderEventsPage();
    }
};

/**
 * Fetches user's purchased rewards (orders).
 */
const loadUserRewardsData = async () => {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, created_at, status,
            order_items (
                products (
                    id, name,
                    product_images ( image_url ),
                    stores ( name )
                )
            )
        `)
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user rewards:', error.message);
        return;
    }

    state.userRewards = data.map(order => {
        const item = order.order_items[0]; // Assuming 1 item per order for this app
        if (!item) return null;
        
        return {
            userRewardId: order.id,
            purchaseDate: formatDate(order.created_at),
            status: order.status,
            productName: item.products.name,
            storeName: item.products.stores.name,
            productImage: (item.products.product_images[0] && item.products.product_images[0].image_url) || getPlaceholderImage()
        };
    }).filter(Boolean); // Filter out any null items

    console.log('User rewards loaded:', state.userRewards);
    if (document.getElementById('my-rewards').classList.contains('active')) {
        renderMyRewardsPage();
    }
};

/**
 * Refreshes just the user's profile/points.
 */
const refreshUserData = async () => {
     const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', state.currentUser.id)
        .single();
    
    if (error || !userProfile) {
        console.error('Error refreshing user data:', error?.message);
        return;
    }
    
    state.currentUser = userProfile;
    // Animate points update
    animatePointsUpdate(userProfile.current_points);
    // Re-render dashboard components that show points
    renderDashboardUI();
};


// =========================================
// 5. HELPER FUNCTIONS
// =========================================

const getPlaceholderImage = (size = '400x300', text = 'EcoBirla') => `https://placehold.co/${size}/EBFBEE/166534?text=${text}&font=inter`;

const getUserLevel = (points) => {
    let current = state.levels[0];
    for (let i = state.levels.length - 1; i >= 0; i--) {
        if (points >= state.levels[i].minPoints) {
            current = state.levels[i];
            break;
        }
    }
    const nextMin = current.nextMin || Infinity;
    let progress = 0;
    let progressText = "Max Level";
    if (nextMin !== Infinity) {
        const pointsInLevel = points - current.minPoints;
        const range = nextMin - current.minPoints;
        progress = Math.max(0, Math.min(100, (pointsInLevel / range) * 100));
        progressText = `${points} / ${nextMin} Pts`;
    }
    return { ...current, progress, progressText };
};

const getProduct = (productId) => {
    return state.products.find(p => p.id === productId);
};

const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
    if (!dateString) return '...';
    return new Date(dateString).toLocaleDateString('en-US', options);
};

const getIconForHistory = (type) => {
    const icons = {
        'checkin': 'calendar-check',
        'event': 'calendar-check',
        'challenge': 'award',
        'plastic': 'recycle',
        'order': 'shopping-cart',
        'coupon': 'ticket'
    };
    return icons[type] || 'help-circle';
};

const getIconForChallenge = (type) => {
    const icons = {
        'quiz': 'brain',
        'upload': 'camera',
        'selfie': 'camera',
        'spot': 'eye'
    };
    return icons[type] || 'award';
};

const getUserInitials = (fullName) => {
    if (!fullName) return '..';
    return fullName.split(' ').map(n => n[0]).join('').toUpperCase();
};

// DOM Cache
const els = {
    pages: document.querySelectorAll('.page'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    userPointsHeader: document.getElementById('user-points-header'),
    userNameGreeting: document.getElementById('user-name-greeting'),
    dailyCheckinBtn: document.getElementById('daily-checkin-button'),
    lbPodium: document.getElementById('lb-podium-container'),
    lbList: document.getElementById('lb-list-container'),
    lbLeafLayer: document.getElementById('lb-leaf-layer'),
    productGrid: document.getElementById('product-grid'),
    storeSearch: document.getElementById('store-search-input'),
    storeSearchClear: document.getElementById('store-search-clear'),
    sortBy: document.getElementById('sort-by-select'),
    challengesList: document.getElementById('challenges-page-list'),
    eventsList: document.getElementById('event-list'),
    allRewardsList: document.getElementById('all-rewards-list'),
    historyList: document.getElementById('history-list'),
    storeDetailPage: document.getElementById('store-detail-page'),
    productDetailPage: document.getElementById('product-detail-page'),
    purchaseModalOverlay: document.getElementById('purchase-modal-overlay'),
    purchaseModal: document.getElementById('purchase-modal'),
    qrModalOverlay: document.getElementById('qr-modal-overlay'),
    qrModal: document.getElementById('qr-modal')
};

// =========================================
// 6. NAVIGATION & UI
// =========================================

const showPage = (pageId) => {
    els.pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Clear detail pages when navigating away
    if (pageId !== 'store-detail-page' && pageId !== 'product-detail-page') {
        els.storeDetailPage.innerHTML = '';
        els.productDetailPage.innerHTML = '';
    }

    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(btn => {
        const onclickVal = btn.getAttribute('onclick');
        btn.classList.toggle('active', onclickVal && onclickVal.includes(`'${pageId}'`));
    });

    document.querySelector('.main-content').scrollTop = 0;

    // Load data or render if data is already loaded
    if (pageId === 'dashboard') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderDashboard(); // Re-render from state
    } else if (pageId === 'leaderboard') {
        showLeaderboardTab(currentLeaderboardTab);
    } else if (pageId === 'rewards') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderRewards();
    } else if (pageId === 'my-rewards') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderMyRewardsPage();
    } else if (pageId === 'history') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderHistory();
    } else if (pageId === 'ecopoints') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderEcoPointsPage();
    } else if (pageId === 'challenges') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderChallengesPage();
    } else if (pageId === 'events') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderEventsPage();
    } else if (pageId === 'profile') {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderProfile();
    }
     else {
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
    }

    toggleSidebar(true);
    lucide.createIcons();
};
window.showPage = showPage; // Expose to global scope for HTML onclick

const toggleSidebar = (forceClose = false) => {
    if (forceClose) {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebarOverlay.classList.add('opacity-0');
        els.sidebarOverlay.classList.add('hidden');
    } else {
        els.sidebar.classList.toggle('-translate-x-full');
        els.sidebarOverlay.classList.toggle('hidden');
        els.sidebarOverlay.classList.toggle('opacity-0');
    }
};
window.toggleSidebar = toggleSidebar;

const animatePointsUpdate = (newPoints) => {
    els.userPointsHeader.classList.add('points-pulse');
    els.userPointsHeader.textContent = newPoints;
    document.getElementById('user-points-sidebar').textContent = newPoints;
    setTimeout(() => els.userPointsHeader.classList.remove('points-pulse'), 400);
};

// =========================================
// 7. RENDERING FUNCTIONS (Read from State)
// =========================================

/**
 * Renders all dashboard components from the state.
 */
const renderDashboard = () => {
    if (!state.currentUser) return; // Guard clause
    renderDashboardUI();
    renderCheckinButtonState();
};

/**
 * Renders only the UI elements, not the button state.
 */
const renderDashboardUI = () => {
    const user = state.currentUser;
    els.userPointsHeader.textContent = user.current_points;
    els.userNameGreeting.textContent = user.full_name.split(' ')[0];
    
    // Sidebar
    document.getElementById('user-name-sidebar').textContent = user.full_name;
    document.getElementById('user-points-sidebar').textContent = user.current_points;
    const level = getUserLevel(user.lifetime_points);
    document.getElementById('user-level-sidebar').textContent = level.title;
    document.getElementById('user-avatar-sidebar').src = user.profile_img_url || getPlaceholderImage('80x80', getUserInitials(user.full_name));

    // Impact stats
    document.getElementById('impact-recycled').textContent = `${(user.impact?.total_plastic_kg || 0).toFixed(1)} kg`;
    document.getElementById('impact-co2').textContent = `${(user.impact?.co2_saved_kg || 0).toFixed(1)} kg`;
    document.getElementById('impact-events').textContent = user.impact?.events_attended || 0;
    
    // Featured event
    document.getElementById('dashboard-event-title').textContent = state.featuredEvent?.title || '...';
    document.getElementById('dashboard-event-desc').textContent = state.featuredEvent?.description || '...';
};

/**
 * Renders the check-in button state.
 */
const renderCheckinButtonState = () => {
    document.getElementById('dashboard-streak-text').textContent = `${state.currentUser.checkInStreak} Day Streak`;
    const btn = els.dailyCheckinBtn;
    const checkIcon = document.getElementById('checkin-check-icon');
    const subtext = document.getElementById('checkin-subtext');
    const doneText = document.getElementById('checkin-done-text');

    if (state.currentUser.isCheckedInToday) {
        btn.classList.add('checkin-completed'); 
        btn.classList.remove('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        
        btn.querySelector('h3').textContent = "Check-in Complete";
        subtext.style.display = 'none';
        doneText.classList.remove('hidden');
        checkIcon.classList.remove('hidden');
        
        btn.onclick = null; 
    } else {
        btn.classList.remove('checkin-completed');
        btn.classList.add('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        
        btn.querySelector('h3').textContent = "Daily Check-in";
        subtext.style.display = 'block';
        doneText.classList.add('hidden');
        checkIcon.classList.add('hidden');
        
        btn.onclick = openCheckinModal;
    }
};

const openCheckinModal = () => {
    if (state.currentUser.isCheckedInToday) return;
    const checkinModal = document.getElementById('checkin-modal');
    checkinModal.classList.add('open');
    checkinModal.classList.remove('invisible');
    
    const calendarContainer = document.getElementById('checkin-modal-calendar');
    calendarContainer.innerHTML = '';
    for (let i = -3; i <= 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const isToday = i === 0;
        calendarContainer.innerHTML += `
            <div class="flex flex-col items-center text-xs ${isToday ? 'font-bold text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}">
                <span class="mb-1">${['S','M','T','W','T','F','S'][d.getDay()]}</span>
                <span class="w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-yellow-100 dark:bg-yellow-900' : ''}">${d.getDate()}</span>
            </div>
        `;
    }
    document.getElementById('checkin-modal-streak').textContent = `${state.currentUser.checkInStreak} Days`;
    document.getElementById('checkin-modal-button-container').innerHTML = `
        <button onclick="handleDailyCheckin()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 shadow-lg transition-transform active:scale-95">
            Check-in &amp; Earn ${state.checkInReward} Points
        </button>
    `;
};
window.openCheckinModal = openCheckinModal;

const closeCheckinModal = () => {
    const checkinModal = document.getElementById('checkin-modal');
    checkinModal.classList.remove('open');
    setTimeout(() => checkinModal.classList.add('invisible'), 300);
};
window.closeCheckinModal = closeCheckinModal;

/**
 * Handles the daily check-in logic.
 */
const handleDailyCheckin = async () => {
    const checkinButton = document.querySelector('#checkin-modal-button-container button');
    checkinButton.disabled = true;
    checkinButton.textContent = 'Checking in...';

    // The database trigger 'trg_daily_checkins_before_insert' will handle
    // streak logic and 'points_ledger' insertion.
    const { error } = await supabase
        .from('daily_checkins')
        .insert({ 
            user_id: state.currentUser.id, 
            points_awarded: state.checkInReward 
        });

    if (error) {
        console.error('Check-in error:', error.message);
        alert(`Failed to check in: ${error.message}`);
        checkinButton.disabled = false;
        checkinButton.textContent = `Check-in & Earn ${state.checkInReward} Points`;
        return;
    }

    // Success
    state.currentUser.isCheckedInToday = true;
    
    closeCheckinModal();
    // Refresh user data (points, streak) and re-render dashboard
    await Promise.all([
        refreshUserData(),
        loadDashboardData() // To get new streak
    ]);
    renderCheckinButtonState();
};
window.handleDailyCheckin = handleDailyCheckin;


// =========================================
// 8. ECO-STORE (REWARDS)
// =========================================

const renderRewards = () => {
    els.productGrid.innerHTML = '';
    let products = [...state.products];

    if (products.length === 0) {
        els.productGrid.innerHTML = `<p class="text-sm text-center text-gray-500 col-span-2">Loading rewards...</p>`;
        return;
    }

    const searchTerm = els.storeSearch.value.toLowerCase();
    if(searchTerm.length > 0) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            p.storeName.toLowerCase().includes(searchTerm)
        );
    }
    els.storeSearchClear.classList.toggle('hidden', !searchTerm);

    const criteria = els.sortBy.value;
    products.sort((a, b) => {
        switch (criteria) {
            case 'points-lh': return a.ecopoints_cost - b.ecopoints_cost;
            case 'points-hl': return b.ecopoints_cost - a.ecopoints_cost;
            case 'price-lh': return a.discounted_price - b.discounted_price;
            case 'price-hl': return b.discounted_price - a.discounted_price;
            case 'popularity': default: return b.popularity - a.popularity;
        }
    });
    
    if (products.length === 0) {
        els.productGrid.innerHTML = `<p class="text-sm text-center text-gray-500 col-span-2">No rewards found for "${searchTerm}".</p>`;
        return;
    }

    products.forEach(p => {
        const imageUrl = (p.images && p.images[0]) ? p.images[0] : getPlaceholderImage('300x225');
        
        els.productGrid.innerHTML += `
            <div class.="w-full flex-shrink-0 glass-card border border-gray-200/60 dark:border-gray-700/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer"
                 onclick="showProductDetailPage('${p.id}')">
                <img src="${imageUrl}" class="w-full h-40 object-cover" onerror="this.src='${getPlaceholderImage('300x225')}'">
                <div class="p-3 flex flex-col flex-grow">
                    <div class="flex items-center mb-1">
                        <img src="${p.storeLogo || getPlaceholderImage('40x40')}" class="w-5 h-5 rounded-full mr-2 border dark:border-gray-600" onerror="this.src='${getPlaceholderImage('40x40')}'">
                        <p class="text-xs font-medium text-gray-600 dark:text-gray-400">${p.storeName}</p>
                    </div>
                    <p class="font-bold text-gray-800 dark:text-gray-100 text-sm truncate mt-1">${p.name}</p>
                    <div class="mt-auto pt-2">
                        <p class="text-xs text-gray-400 dark:text-gray-500 line-through">₹${p.original_price}</p>
                        <div class="flex items-center font-bold text-gray-800 dark:text-gray-100 my-1">
                            <span class="text-md text-green-700 dark:text-green-400">₹${p.discounted_price}</span>
                            <span class="mx-1 text-gray-400 dark:text-gray-500 text-xs">+</span>
                            <i data-lucide="leaf" class="w-3 h-3 text-green-500 mr-1"></i>
                            <span class="text-sm text-green-700 dark:text-green-400">${p.ecopoints_cost}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
};
window.renderRewards = renderRewards; // Expose for listeners

const showProductDetailPage = (productId) => {
    const product = getProduct(productId);
    if (!product) return;

    const images = (product.images && product.images.length > 0) ? product.images : [getPlaceholderImage()];
    let sliderImagesHTML = '';
    let sliderDotsHTML = '';

    images.forEach((img, index) => {
        sliderImagesHTML += `
            <img src="${img}" class="slider-item w-full h-80 object-cover flex-shrink-0 rounded-3xl" data-index="${index}" onerror="this.src='${getPlaceholderImage('600x400')}'">
        `;
        sliderDotsHTML += `<button class="slider-dot w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-gray-700/80 ${index === 0 ? 'active' : ''}"></button>`;
    });

    const featuresHTML = (product.features || []).map(f => `
        <li class="flex items-start space-x-2">
            <span class="mt-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600 dark:text-emerald-300"></i>
            </span>
            <span class="text-sm text-gray-700 dark:text-gray-300">${f}</span>
        </li>
    `).join('');

    const canAfford = state.currentUser.current_points >= product.ecopoints_cost;

    els.productDetailPage.innerHTML = `
        <div class="pb-8">
            <div class="relative">
                <div class="slider-container flex w-full overflow-x-auto snap-x snap-mandatory gap-4 px-4 pt-4 pb-10">
                    ${sliderImagesHTML}
                </div>
                <button onclick="showPage('rewards')" class="absolute top-6 left-6 p-2 glass-card rounded-full text-gray-700 dark:text-gray-200 !px-2 !py-2">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div class="absolute bottom-5 left-0 right-0 flex justify-center items-center space-x-2 z-10">${sliderDotsHTML}</div>
            </div>
            <div class="px-4 -mt-6">
                <div class="glass-card p-6 rounded-3xl">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <div>
                            <h2 class="text-2xl font-extrabold text-gray-900 dark:text-gray-50">${product.name}</h2>
                            <div class="flex items-center mt-2">
                                <img src="${product.storeLogo || getPlaceholderImage('40x40')}" class="w-7 h-7 rounded-full mr-2 border" onerror="this.src='${getPlaceholderImage('40x40')}'">
                                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">${product.storeName}</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                            ${product.ecopoints_cost} EcoPts
                        </span>
                    </div>
                    <div class="mt-4 space-y-5">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Description</h3>
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${product.description}</p>
                        </div>
                        ${featuresHTML ? `<div><h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Highlights</h3><ul class="mt-2 space-y-2">${featuresHTML}</ul></div>` : ''}
                        <div class="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                            <div>
                                <p class="text-xs text-gray-500 line-through">₹${product.original_price}</p>
                                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                                    <span class="text-xl text-emerald-700 dark:text-emerald-400">₹${product.discounted_price}</span>
                                    <span class="mx-2 text-gray-400 text-sm">+</span>
                                    <i data-lucide="leaf" class="w-4 h-4 text-emerald-500 mr-1"></i>
                                    <span class="text-xl text-emerald-700">${product.ecopoints_cost}</span>
                                </div>
                            </div>
                            <button onclick="openPurchaseModal('${product.id}')" class="btn-eco-gradient text-white text-sm font-semibold py-3 px-5 rounded-xl flex-shrink-0 ${canAfford ? '' : 'opacity-60 cursor-not-allowed'}" ${canAfford ? '' : 'disabled'}>
                                ${canAfford ? 'Redeem Offer' : 'Not enough points'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    els.pages.forEach(p => p.classList.remove('active'));
    els.productDetailPage.classList.add('active');
    document.querySelector('.main-content').scrollTop = 0;
    lucide.createIcons();
};
window.showProductDetailPage = showProductDetailPage;

const openPurchaseModal = (productId) => {
    const product = getProduct(productId);
    if (!product) return;

    const imageUrl = (product.images && product.images[0]) ? product.images[0] : getPlaceholderImage('100x100');

    els.purchaseModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Purchase Reward</h3>
            <button onclick="closePurchaseModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="flex items-center mb-4">
            <img src="${imageUrl}" class="w-20 h-20 object-cover rounded-lg mr-4" onerror="this.src='${getPlaceholderImage('100x100')}'">
            <div>
                <h4 class="text-lg font-bold text-gray-800 dark:text-gray-100">${product.name}</h4>
                <p class="text-sm text-gray-500 mb-2">From ${product.storeName}</p>
                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                    <span class="text-lg text-green-700 dark:text-green-400">₹${product.discounted_price}</span>
                    <span class="mx-1 text-gray-400">+</span>
                    <i data-lucide="leaf" class="w-4 h-4 text-green-500 mr-1"></i>
                    <span class="text-lg text-green-700">${product.ecopoints_cost}</span>
                </div>
            </div>
        </div>
        <button id="confirm-purchase-btn" onclick="confirmPurchase('${product.id}')" class="w-full btn-eco-gradient text-white font-bold py-3 px-4 rounded-lg mb-2">Confirm Purchase</button>
        <button onclick="closePurchaseModal()" class="w-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg">Cancel</button>
    `;
    
    els.purchaseModalOverlay.classList.remove('hidden');
    setTimeout(() => els.purchaseModal.classList.remove('translate-y-full'), 10);
    lucide.createIcons();
};
window.openPurchaseModal = openPurchaseModal;

const closePurchaseModal = () => {
    els.purchaseModal.classList.add('translate-y-full');
    setTimeout(() => els.purchaseModalOverlay.classList.add('hidden'), 300);
};
window.closePurchaseModal = closePurchaseModal;

const confirmPurchase = async (productId) => {
    const product = getProduct(productId);
    if (!product || state.currentUser.current_points < product.ecopoints_cost) {
        alert("You do not have enough points for this item.");
        return;
    }

    const confirmBtn = document.getElementById('confirm-purchase-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    // 1. Create the order
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({ 
            user_id: state.currentUser.id, 
            store_id: product.store_id, 
            status: 'pending', // Will be updated to 'confirmed'
            total_points: product.ecopoints_cost,
            total_price: product.discounted_price,
            requires_approval: false // Or true, depending on product
        })
        .select()
        .single();

    if (orderError) {
        console.error('Error creating order:', orderError.message);
        alert(`Purchase failed: ${orderError.message}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Purchase';
        return;
    }

    // 2. Add item to the order
    const { error: itemError } = await supabase
        .from('order_items')
        .insert({ 
            order_id: orderData.id, 
            product_id: product.id, 
            quantity: 1,
            price_each: product.discounted_price,
            points_each: product.ecopoints_cost
        });
        
    if (itemError) {
        console.error('Error adding order item:', itemError.message);
        // TODO: Add logic to cancel the order if this fails
        alert(`Purchase failed: ${itemError.message}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Purchase';
        return;
    }
    
    // 3. Confirm the order (this will fire the trigger 'trg_orders_after_update' to deduct points)
    const { error: confirmError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderData.id);

    if (confirmError) {
        console.error('Error confirming order:', confirmError.message);
        alert(`Purchase failed: ${confirmError.message}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Purchase';
        return;
    }
    
    // 4. Success! Refresh data and UI
    closePurchaseModal();
    await Promise.all([
        refreshUserData(), // Get new points total
        loadUserRewardsData() // Get new list of orders
    ]);
    showPage('my-rewards');
};
window.confirmPurchase = confirmPurchase;

// =========================================
// 9. MY ORDERS & HISTORY
// =========================================

const renderMyRewardsPage = () => {
    els.allRewardsList.innerHTML = '';
    if (state.userRewards.length === 0) {
        els.allRewardsList.innerHTML = `<p class="text-sm text-center text-gray-500">You haven't purchased any rewards yet. Visit the Store to redeem your points!</p>`;
        return;
    }
    
    state.userRewards.forEach(ur => {
        els.allRewardsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between">
                <div class="flex items-center">
                    <img src="${ur.productImage}" class="w-14 h-14 rounded-lg object-cover mr-3" onerror="this.src='${getPlaceholderImage('100x100')}'">
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-gray-100">${ur.productName}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">From ${ur.storeName}</p>
                        <p class="text-xs text-gray-400 mt-1">${ur.purchaseDate}</p>
                    </div>
                </div>
                ${ur.status === 'confirmed'
                    ? `<button onclick="openRewardQrModal('${ur.userRewardId}')" class="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-600 text-white">View QR</button>`
                    : `<span class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 text-gray-600">${ur.status}</span>`
                }
            </div>
        `;
    });
};

const openRewardQrModal = (userRewardId) => {
    const ur = state.userRewards.find(r => r.userRewardId === userRewardId);
    if (!ur) return;
    
    // Generate a unique QR code value
    const qrValue = `ecobirla-order:${userRewardId}-user:${state.currentUser.id}`;
    
    els.qrModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Reward QR</h3>
            <button onclick="closeQrModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Show this QR at <strong>${ur.storeName}</strong> to redeem <strong>${ur.productName}</strong>.</p>
        <div class="flex justify-center mb-4">
            <!-- Using a placeholder, but you would replace this with a QR library -->
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrValue)}" class="rounded-lg border">
        </div>
        <button onclick="closeQrModal()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg">Close</button>
    `;
    els.qrModalOverlay.classList.remove('hidden');
    setTimeout(() => els.qrModal.classList.remove('translate-y-full'), 10);
    lucide.createIcons();
};
window.openRewardQrModal = openRewardQrModal;

const closeQrModal = () => {
    els.qrModal.classList.add('translate-y-full');
    setTimeout(() => els.qrModalOverlay.classList.add('hidden'), 300);
};
window.closeQrModal = closeQrModal;

const renderHistory = () => {
    els.historyList.innerHTML = '';
    
    if (state.history.length === 0) {
        els.historyList.innerHTML = `<p class="text-sm text-center text-gray-500">No activity history yet. Start participating in challenges to earn points!</p>`;
        return;
    }
    
    state.history.forEach(h => {
        els.historyList.innerHTML += `
            <div class="glass-card p-3 rounded-xl flex items-center justify-between">
                <div class="flex items-center">
                    <span class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3">
                        <i data-lucide="${h.icon}" class="w-5 h-5 text-gray-700 dark:text-gray-200"></i>
                    </span>
                    <div>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${h.description}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${h.date}</p>
                    </div>
                </div>
                <span class="text-sm font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">
                    ${h.points > 0 ? '+' : ''}${h.points}
                </span>
            </div>
        `;
    });
    lucide.createIcons();
};

// =========================================
// 10. CHALLENGES & EVENTS
// =========================================

const renderChallengesPage = () => {
    els.challengesList.innerHTML = '';
    
    if (state.dailyChallenges.length === 0) {
        els.challengesList.innerHTML = `<p class="text-sm text-center text-gray-500">No active challenges right now. Check back later!</p>`;
        return;
    }
    
    state.dailyChallenges.forEach(c => {
        let buttonHTML = '';
        if (c.status === 'active') {
            const onclick = c.type === 'quiz' ? `openEcoQuizModal('${c.id}')` : `startCamera('${c.id}')`;
            buttonHTML = `<button onclick="${onclick}" class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white">${c.buttonText}</button>`;
        } else if (c.status === 'pending') {
            buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed">Pending Review</button>`;
        }
        els.challengesList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-start">
                <div class="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3">
                    <i data-lucide="${c.icon}" class="w-5 h-5 text-green-600 dark:text-green-300"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-900 dark:text-gray-100">${c.title}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${c.description}</p>
                    <div class="flex items-center justify-between mt-3">
                        <span class="text-xs font-semibold text-green-700 dark:text-green-300">+${c.points_reward} pts</span>
                        ${buttonHTML}
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
};

const renderEventsPage = () => {
    els.eventsList.innerHTML = '';
    
    if (state.events.length === 0) {
        els.eventsList.innerHTML = `<p class="text-sm text-center text-gray-500">No events scheduled. Please check back soon!</p>`;
        return;
    }
    
    state.events.forEach(e => {
        let statusButton = '';
        if (e.status === 'upcoming') {
            statusButton = `<button class="w-full bg-green-600 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center space-x-2"><i data-lucide="ticket" class="w-4 h-4"></i><span>RSVP +${e.points} pts</span></button>`;
        } else if (e.status === 'attended') {
            statusButton = `<div class="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-200 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="check-circle" class="w-4 h-4"></i><span>Attended (+${e.points} pts)</span></div>`;
        } else {
             statusButton = `<div class="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="x-circle" class="w-4 h-4"></i><span>Missed</span></div>`;
        }
        els.eventsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl ${e.status === 'missed' ? 'opacity-60' : ''}">
                <div class="flex items-start">
                    <div class="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg mr-4"><i data-lucide="calendar" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i></div>
                    <div class="flex-grow">
                        <p class="text-xs font-semibold text-purple-600 dark:text-purple-400">${e.date}</p>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${e.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${e.description}</p>
                        ${statusButton}
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
};


// =========================================
// 11. LEADERBOARD
// =========================================
let currentLeaderboardTab = 'student';

const showLeaderboardTab = (tab) => {
    currentLeaderboardTab = tab;
    const btnStudent = document.getElementById('leaderboard-tab-student');
    const btnDept = document.getElementById('leaderboard-tab-dept');
    const contentStudent = document.getElementById('leaderboard-content-student');
    const contentDept = document.getElementById('leaderboard-content-department');

    if (tab === 'department') {
        btnDept.classList.add('active');
        btnStudent.classList.remove('active');
        contentDept.classList.remove('hidden');
        contentStudent.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderDepartmentLeaderboard();
    } else {
        btnStudent.classList.add('active');
        btnDept.classList.remove('active');
        contentStudent.classList.remove('hidden');
        contentDept.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.remove('hidden');
        renderStudentLeaderboard();
    }
};
window.showLeaderboardTab = showLeaderboardTab;

const renderDepartmentLeaderboard = () => {
    const container = document.getElementById('eco-wars-page-list');
    container.innerHTML = '';
    
    if (state.departmentLeaderboard.length === 0) {
        container.innerHTML = `<p class="text-sm text-center text-gray-500">Department rankings are being calculated.</p>`;
        return;
    }
    
    state.departmentLeaderboard
        .sort((a, b) => b.points - a.points)
        .forEach((dept, index) => {
            container.innerHTML += `
                <div class="glass-card p-3 rounded-2xl flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center mr-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">#${index + 1}</span>
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-gray-100">${dept.name}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${dept.points.toLocaleString()} pts</p>
                        </div>
                    </div>
                </div>
            `;
        });
};

const renderStudentLeaderboard = () => {
    if (state.leaderboard.length === 0) {
        els.lbPodium.innerHTML = `<p class="text-sm text-center text-gray-500">Loading podium...</p>`;
        els.lbList.innerHTML = `<p class="text-sm text-center text-gray-500">Loading rankings...</p>`;
        return;
    }
    
    const sorted = [...state.leaderboard];
    const rank1 = sorted[0], rank2 = sorted[1], rank3 = sorted[2];
    const rest = sorted.slice(3);

    els.lbPodium.innerHTML = `
        <div class="podium">
            <div class="champ"><div class="badge silver">${rank2 ? rank2.initials : 'N/A'}</div><div class="champ-name">${rank2 ? rank2.name : '-'}</div><div class="champ-points">${rank2 ? rank2.lifetime_points : 0} pts</div><div class="rank">2nd</div></div>
            <div class="champ"><div class="badge gold">${rank1 ? rank1.initials : 'N/A'}</div><div class="champ-name">${rank1 ? rank1.name : '-'}</div><div class="champ-points">${rank1 ? rank1.lifetime_points : 0} pts</div><div class="rank">1st</div></div>
            <div class="champ"><div class="badge bronze">${rank3 ? rank3.initials : 'N/A'}</div><div class="champ-name">${rank3 ? rank3.name : '-'}</div><div class="champ-points">${rank3 ? rank3.lifetime_points : 0} pts</div><div class="rank">3rd</div></div>
        </div>
    `;

    els.lbList.innerHTML = '';
    rest.forEach((user, index) => {
        els.lbList.innerHTML += `
            <div class="item ${user.isCurrentUser ? 'is-me' : ''}">
                <div class="user">
                    <span class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3 text-xs font-bold text-gray-600 dark:text-gray-300">#${index + 4}</span>
                    <div class="circle">${user.initials}</div>
                    <div class="user-info"><strong>${user.name} ${user.isCurrentUser ? '(You)' : ''}</strong><span class="sub-class">${user.course}</span></div>
                </div>
                <div class="points-display">${user.lifetime_points} pts</div>
            </div>
        `;
    });
};

// =========================================
// 12. OTHER PAGES (Profile, Ecopoints)
// =========================================

const renderProfile = () => {
    const u = state.currentUser;
    if (!u) return;
    
    const l = getUserLevel(u.lifetime_points);
    document.getElementById('profile-name').textContent = u.full_name;
    document.getElementById('profile-email').textContent = u.email;
    document.getElementById('profile-avatar').src = u.profile_img_url || getPlaceholderImage('112x112', getUserInitials(u.full_name));
    document.getElementById('profile-joined').textContent = 'Joined ' + formatDate(u.joined_at, { month: 'short', year: 'numeric' });
    document.getElementById('profile-level-title').textContent = l.title;
    document.getElementById('profile-level-number').textContent = l.level;
    document.getElementById('profile-level-progress').style.width = l.progress + '%';
    document.getElementById('profile-level-next').textContent = l.progressText;
    document.getElementById('profile-student-id').textContent = u.student_id;
    document.getElementById('profile-course').textContent = u.course;
    document.getElementById('profile-mobile').textContent = u.mobile || 'Not set';
    document.getElementById('profile-email-personal').textContent = u.email;
};

const renderEcoPointsPage = () => {
    const u = state.currentUser;
    if (!u) return;
    
    const l = getUserLevel(u.lifetime_points);
    document.getElementById('ecopoints-balance').textContent = u.current_points;
    document.getElementById('ecopoints-level-title').textContent = l.title;
    document.getElementById('ecopoints-level-number').textContent = l.level;
    document.getElementById('ecopoints-level-progress').style.width = l.progress + '%';
    document.getElementById('ecopoints-level-next').textContent = l.progressText;
    
    const actContainer = document.getElementById('ecopoints-recent-activity');
    actContainer.innerHTML = '';
    if (state.history.length === 0) {
        actContainer.innerHTML = `<p class="text-sm text-gray-500">No recent activity.</p>`;
    } else {
        state.history.slice(0,4).forEach(h => {
            actContainer.innerHTML += `<div class="flex items-center justify-between text-sm"><div class="flex items-center"><span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3"><i data-lucide="${h.icon}" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i></span><div><p class="font-semibold text-gray-800 dark:text-gray-100">${h.description}</p><p class="text-xs text-gray-500 dark:text-gray-400">${h.date}</p></div></div><span class="font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">${h.points > 0 ? '+' : ''}${h.points}</span></div>`;
        });
    }
    
    const levelsContainer = document.getElementById('all-levels-list');
    levelsContainer.innerHTML = '';
    state.levels.forEach(lvl => {
         levelsContainer.innerHTML += `<div class="flex items-center"><span class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3 text-sm font-bold text-green-600 dark:text-green-300">${lvl.level}</span><div><p class="text-sm font-bold text-gray-800 dark:text-gray-100">${lvl.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${lvl.minPoints} pts required</p></div></div>`;
    });
    
    lucide.createIcons();
};

// =========================================
// 13. MODALS (Chat, Quiz, Camera)
// =========================================
// --- Chatbot ---
const openChatbotModal = () => {
    document.getElementById('chatbot-modal').classList.add('open');
    document.getElementById('chatbot-modal').classList.remove('invisible');
};
window.openChatbotModal = openChatbotModal;

const closeChatbotModal = () => {
    document.getElementById('chatbot-modal').classList.remove('open');
    setTimeout(() => document.getElementById('chatbot-modal').classList.add('invisible'), 300);
};
window.closeChatbotModal = closeChatbotModal;

// --- Eco Quiz ---
const openEcoQuizModal = (challengeId) => {
    document.getElementById('eco-quiz-modal').classList.add('open');
    document.getElementById('eco-quiz-modal').classList.remove('invisible');
    // TODO: Load quiz questions from Supabase based on challengeId
};
window.openEcoQuizModal = openEcoQuizModal;

const closeEcoQuizModal = () => {
    document.getElementById('eco-quiz-modal').classList.remove('open');
    setTimeout(() => document.getElementById('eco-quiz-modal').classList.add('invisible'), 300);
};
window.closeEcoQuizModal = closeEcoQuizModal;

const handleQuizAnswer = (isCorrect, challengeId) => {
    // TODO: Implement quiz logic and grant points
    alert(`Quiz answer submitted for ${challengeId}. Correct: ${isCorrect}`);
    closeEcoQuizModal();
};
window.handleQuizAnswer = handleQuizAnswer;

// --- Camera ---
let currentCameraStream = null;
let currentChallengeIdForCamera = null;

const startCamera = async (challengeId) => {
    currentChallengeIdForCamera = challengeId;
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-feed');
    
    modal.classList.remove('hidden');
    
    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Use 'environment' for back camera
        });
        video.srcObject = currentCameraStream;
    } catch (err) {
        console.error("Camera error:", err);
        alert("Unable to access camera. Please check permissions.");
        closeCameraModal();
    }
};
window.startCamera = startCamera;

const closeCameraModal = () => {
    const modal = document.getElementById('camera-modal');
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('camera-feed').srcObject = null;
    modal.classList.add('hidden');
};
window.closeCameraModal = closeCameraModal;

const capturePhoto = () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // TODO: Implement image upload to Supabase Storage
    alert(`Photo captured for challenge ${currentChallengeIdForCamera}. Upload logic needed.`);
    
    // For now, just set to pending
    const challenge = state.dailyChallenges.find(c => c.id === currentChallengeIdForCamera);
    if (challenge) {
        challenge.status = 'pending';
        challenge.buttonText = 'Pending Review';
        renderChallengesPage();
    }
    
    closeCameraModal();
};
window.capturePhoto = capturePhoto;

const switchCamera = () => {
    alert("Switch camera functionality not implemented.");
};
window.switchCamera = switchCamera;

// =========================================
// 14. EVENT LISTENERS & INIT
// =========================================

// Search & Sort Listeners
els.storeSearch.addEventListener('input', renderRewards);
els.storeSearchClear.addEventListener('click', () => { els.storeSearch.value = ''; renderRewards(); });
els.sortBy.addEventListener('change', renderRewards);

// Sidebar Toggle Listener
document.getElementById('sidebar-toggle-btn').addEventListener('click', () => toggleSidebar());

// Logout Listener
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Theme Toggle
const themeBtn = document.getElementById('theme-toggle-btn');
const themeText = document.getElementById('theme-text');
const themeIcon = document.getElementById('theme-icon');

const applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    lucide.createIcons();
};

themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
});

// Load initial theme
const savedTheme = localStorage.getItem('eco-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(savedTheme === 'dark' || (!savedTheme && prefersDark));

// --- Password Update ---
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const msgEl = document.getElementById('password-message');
    const btn = document.getElementById('change-password-button');
    
    btn.disabled = true;
    msgEl.textContent = 'Updating...';
    
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
        msgEl.textContent = `Error: ${error.message}`;
        msgEl.classList.add('text-red-500');
    } else {
        msgEl.textContent = 'Password updated successfully!';
        msgEl.classList.add('text-green-500');
        document.getElementById('new-password').value = '';
    }
    
    btn.disabled = false;
    setTimeout(() => {
        msgEl.textContent = '';
        msgEl.classList.remove('text-red-500', 'text-green-500');
    }, 3000);
});

// --- Redeem Code ---
document.getElementById('redeem-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('redeem-input').value;
    const msgEl = document.getElementById('redeem-message');
    const btn = document.getElementById('redeem-submit-btn');

    btn.disabled = true;
    msgEl.textContent = 'Redeeming...';
    
    // Call a Supabase RPC function 'redeem_coupon'
    const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });

    if (error) {
        msgEl.textContent = `Error: ${error.message}`;
        msgEl.classList.add('text-red-500');
    } else {
        msgEl.textContent = `Success! You earned ${data.points_awarded} points.`;
        msgEl.classList.add('text-green-500');
        document.getElementById('redeem-input').value = '';
        await refreshUserData(); // Refresh points
    }
    
    btn.disabled = false;
    setTimeout(() => {
        msgEl.textContent = '';
        msgEl.classList.remove('text-red-500', 'text-green-500');
    }, 3000);
});


// --- Chatbot Form ---
document.getElementById('chatbot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatbot-input');
    const messages = document.getElementById('chatbot-messages');
    if (input.value.trim() === '') return;

    // Add user message
    messages.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-green-600 text-white p-3 rounded-lg rounded-br-none max-w-xs">
                <p class="text-sm">${input.value}</p>
            </div>
        </div>
    `;
    
    // TODO: Add call to AI chatbot
    const botReply = "I'm sorry, I'm just a demo. I can't process requests yet.";
    
    // Add bot reply
    setTimeout(() => {
        messages.innerHTML += `
            <div class="flex">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-none max-w-xs">
                    <p class="text-sm text-gray-800 dark:text-gray-100">${botReply}</p>
                </div>
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;
    }, 1000);

    input.value = '';
    messages.scrollTop = messages.scrollHeight;
});

// =========================================
// 15. START APPLICATION
// =========================================
checkAuth();
