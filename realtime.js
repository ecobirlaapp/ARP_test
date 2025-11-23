import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { refreshUserData } from './app.js';
import { renderDashboard } from './dashboard.js';
import { loadLeaderboardData } from './social.js';
import { loadEventsData } from './events.js';

let debounceTimer = null;

export const initRealtime = () => {
    if (!state.currentUser) return;

    // Listen to changes in specific tables
    const channel = supabase.channel('public:eco_db_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${state.currentUser.id}` }, 
            (payload) => handleUpdate('user', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checkins', filter: `user_id=eq.${state.currentUser.id}` }, 
            (payload) => handleUpdate('checkin', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, 
            (payload) => handleUpdate('event', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, 
            (payload) => handleUpdate('product', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${state.currentUser.id}` }, 
            (payload) => handleUpdate('streak', payload))
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('🟢 Realtime Connected');
        });
};

const handleUpdate = (type, payload) => {
    console.log(`⚡ Realtime Update: ${type}`, payload);
    
    // Debounce updates to prevent UI flickering on rapid DB changes
    if (debounceTimer) clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(async () => {
        if (type === 'user' || type === 'streak' || type === 'checkin') {
            await refreshUserData();
        }
        if (type === 'event') {
            await loadEventsData();
        }
        // Add other refresh logic as needed
    }, 1000);
};
