import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { getTickImg } from './utils.js';

export const loadDashboardData = async () => {
    try {
        const userId = state.currentUser.id;
        const today = new Date().toISOString().split('T')[0];

        const [
            { data: checkinData },
            { data: streakData },
            { data: impactData },
            { data: eventData }
        ] = await Promise.all([
            supabase.from('daily_checkins').select('id').eq('user_id', userId).eq('checkin_date', today),
            supabase.from('user_streaks').select('current_streak').eq('user_id', userId).single(),
            supabase.from('user_impact').select('*').eq('user_id', userId).single(),
            // Fetch only future events
            supabase.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(1)
        ]);

        state.currentUser.isCheckedInToday = (checkinData && checkinData.length > 0);
        state.currentUser.checkInStreak = streakData ? streakData.current_streak : 0;
        state.currentUser.impact = impactData || { total_plastic_kg: 0, co2_saved_kg: 0, events_attended: 0 };
        state.featuredEvent = (eventData && eventData.length > 0) ? eventData[0] : null;
        
    } catch (err) { console.error('Dash Error', err); }
};

export const renderDashboard = () => {
    if (!state.currentUser) return;
    
    // User
    document.getElementById('user-name-greeting').textContent = state.currentUser.full_name;
    document.getElementById('user-points-header').textContent = state.currentUser.current_points;
    document.getElementById('user-name-sidebar').innerHTML = `${state.currentUser.full_name} ${getTickImg(state.currentUser.tick_type)}`;
    document.getElementById('user-points-sidebar').textContent = state.currentUser.current_points;
    document.getElementById('user-avatar-sidebar').src = state.currentUser.profile_img_url || 'https://placehold.co/80x80?text=User';

    // Impact
    const imp = state.currentUser.impact || {};
    document.getElementById('impact-recycled').textContent = `${(imp.total_plastic_kg || 0)}kg`;
    document.getElementById('impact-co2').textContent = `${(imp.co2_saved_kg || 0)}kg`;
    document.getElementById('impact-events').textContent = imp.events_attended || 0;

    // Logic: Hide Event Card if null
    const evtContainer = document.getElementById('dashboard-event-card-container');
    if (state.featuredEvent) {
        evtContainer.classList.remove('hidden');
        document.getElementById('dashboard-event-title').textContent = state.featuredEvent.title;
        document.getElementById('dashboard-event-desc').textContent = state.featuredEvent.location || 'Campus';
    } else {
        evtContainer.classList.add('hidden');
    }

    // Check-in Button State
    const btn = document.getElementById('daily-checkin-button');
    const streakText = document.getElementById('dashboard-streak-text');
    streakText.textContent = state.currentUser.checkInStreak;
    
    if(state.currentUser.isCheckedInToday) {
        btn.classList.add('opacity-60', 'cursor-default');
        btn.onclick = null;
        btn.querySelector('h3').textContent = "Streak Active";
        btn.querySelector('p').textContent = "Come back tomorrow";
    } else {
        btn.classList.remove('opacity-60', 'cursor-default');
        btn.onclick = openCheckinModal;
        btn.querySelector('h3').textContent = "Daily Check-in";
        btn.querySelector('p').textContent = "Tap to maintain streak!";
    }
};

export const openCheckinModal = () => {
    const modal = document.getElementById('checkin-modal');
    const content = modal.querySelector('.bg-white');
    modal.classList.remove('hidden');
    
    // Animate
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-full');
    }, 10);
    
    // Render Calendar
    const cal = document.getElementById('checkin-calendar');
    cal.innerHTML = '';
    for(let i=-3; i<=3; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const isToday = i===0;
        cal.innerHTML += `
            <div class="flex flex-col items-center ${isToday ? 'font-bold text-green-600' : 'text-gray-400'}">
                <span class="text-xs mb-1">${['S','M','T','W','T','F','S'][d.getDay()]}</span>
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${isToday ? 'bg-green-100' : ''}">${d.getDate()}</div>
            </div>`;
    }
};

export const closeCheckinModal = () => {
    const modal = document.getElementById('checkin-modal');
    const content = modal.querySelector('.bg-white');
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

export const confirmCheckin = async () => {
    try {
        const { error } = await supabase.from('daily_checkins').insert({ 
            user_id: state.currentUser.id, points_awarded: 10 
        });
        if(error) throw error;
        
        state.currentUser.isCheckedInToday = true;
        state.currentUser.current_points += 10;
        state.currentUser.checkInStreak += 1;
        
        closeCheckinModal();
        renderDashboard();
        alert('Checked in! +10 Points');
    } catch(e) { alert('Already checked in or error.'); }
};
