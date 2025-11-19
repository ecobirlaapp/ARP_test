import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, formatDate, getIconForChallenge, uploadToCloudinary } from './utils.js';

export const loadChallengesData = async () => {
    try {
        const { data: challenges, error: challengeError } = await supabase.from('challenges').select('id, title, description, points_reward, type').eq('is_active', true);
        if (challengeError) throw challengeError;
        const { data: submissions, error: subError } = await supabase.from('challenge_submissions').select('challenge_id, status, submission_url').eq('user_id', state.currentUser.id);
        if (subError) throw subError;

        state.dailyChallenges = challenges.map(c => {
            const sub = submissions.find(s => s.challenge_id === c.id);
            let status = 'active', buttonText = 'Start', isDisabled = false;
            if (sub) {
                if (sub.status === 'approved' || sub.status === 'verified') { status = 'completed'; buttonText = 'Completed'; isDisabled = true; } 
                else if (sub.status === 'pending') { status = 'pending'; buttonText = 'Pending Review'; isDisabled = true; } 
                else if (sub.status === 'rejected') { status = 'active'; buttonText = 'Retry'; }
            } else {
                if (c.type === 'Upload') buttonText = 'Take Photo'; else if (c.type === 'Quiz') buttonText = 'Start Quiz';
            }
            return { ...c, icon: getIconForChallenge(c.type), status, buttonText, isDisabled };
        });

        if (document.getElementById('challenges').classList.contains('active')) renderChallengesPage();
    } catch (err) { console.error('Challenges Load Error:', err); }
};

export const renderChallengesPage = () => {
    els.challengesList.innerHTML = '';
    if (state.dailyChallenges.length === 0) { els.challengesList.innerHTML = `<p class="text-sm text-center text-gray-500">No active challenges.</p>`; return; }
    
    state.dailyChallenges.forEach(c => {
        let buttonHTML = '';
        if (c.isDisabled) buttonHTML = `<button disabled class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed">${c.buttonText}</button>`;
        else if (c.type === 'Quiz') buttonHTML = `<button onclick="openEcoQuizModal('${c.id}')" class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white hover:bg-green-700">${c.buttonText}</button>`;
        else if (c.type === 'Upload' || c.type === 'selfie') buttonHTML = `<button onclick="startCamera('${c.id}')" data-challenge-id="${c.id}" class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white hover:bg-green-700"><i data-lucide="camera" class="w-3 h-3 mr-1 inline-block"></i>${c.buttonText}</button>`;
        else buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white">${c.buttonText}</button>`;

        els.challengesList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-start">
                <div class="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3"><i data-lucide="${c.icon}" class="w-5 h-5 text-green-600 dark:text-green-300"></i></div>
                <div class="flex-1"><h3 class="font-bold text-gray-900 dark:text-gray-100">${c.title}</h3><p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${c.description}</p><div class="flex items-center justify-between mt-3"><span class="text-xs font-semibold text-green-700 dark:text-green-300">+${c.points_reward} pts</span>${buttonHTML}</div></div>
            </div>`;
    });
    if(window.lucide) window.lucide.createIcons();
};

export const loadEventsData = async () => {
    try {
        const { data, error } = await supabase.from('events').select('*').order('start_at', { ascending: true });
        if (error) return;
        const { data: attendance } = await supabase.from('event_attendance').select('event_id, status').eq('user_id', state.currentUser.id);
        
        state.events = data.map(e => {
            const att = attendance ? attendance.find(a => a.event_id === e.id) : null;
            let status = 'upcoming';
            if (att) { if (att.status === 'confirmed') status = 'attended'; else if (att.status === 'absent') status = 'missed'; else status = 'registered'; }
            return { ...e, date: formatDate(e.start_at, { month: 'short', day: 'numeric', year: 'numeric' }), points: e.points_reward, status };
        });
        if (document.getElementById('events').classList.contains('active')) renderEventsPage();
    } catch (err) { console.error('Events Load Error:', err); }
};

export const renderEventsPage = () => {
    els.eventsList.innerHTML = '';
    if (state.events.length === 0) { els.eventsList.innerHTML = `<p class="text-sm text-center text-gray-500">No events scheduled.</p>`; return; }
    state.events.forEach(e => {
        let statusButton = '';
        if (e.status === 'upcoming') statusButton = `<button class="w-full bg-green-600 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center space-x-2"><i data-lucide="ticket" class="w-4 h-4"></i><span>RSVP +${e.points} pts</span></button>`;
        else if (e.status === 'attended') statusButton = `<div class="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-200 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="check-circle" class="w-4 h-4"></i><span>Attended (+${e.points} pts)</span></div>`;
        else statusButton = `<div class="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="x-circle" class="w-4 h-4"></i><span>Missed</span></div>`;
        els.eventsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl ${e.status === 'missed' ? 'opacity-60' : ''}">
                <div class="flex items-start"><div class="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg mr-4"><i data-lucide="calendar" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i></div><div class="flex-grow"><p class="text-xs font-semibold text-purple-600 dark:text-purple-400">${e.date}</p><h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${e.title}</h3><p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${e.description}</p>${statusButton}</div></div>
            </div>`;
    });
    if(window.lucide) window.lucide.createIcons();
};

// Camera & Quiz Logic
let currentCameraStream = null;
let currentChallengeIdForCamera = null;

export const startCamera = async (challengeId) => {
    currentChallengeIdForCamera = challengeId;
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-feed');
    modal.classList.remove('hidden');
    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = currentCameraStream;
    } catch (err) { alert("Unable to access camera."); closeCameraModal(); }
};

export const closeCameraModal = () => {
    const modal = document.getElementById('camera-modal');
    if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());
    document.getElementById('camera-feed').srcObject = null;
    modal.classList.add('hidden');
};

export const capturePhoto = async () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    closeCameraModal();
    
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        const btn = document.querySelector(`button[data-challenge-id="${currentChallengeIdForCamera}"]`);
        const originalText = btn ? btn.innerText : 'Uploading...';
        if(btn) { btn.innerText = 'Uploading...'; btn.disabled = true; }
        
        try {
            const imageUrl = await uploadToCloudinary(file);
            const { error } = await supabase.from('challenge_submissions').insert({ challenge_id: currentChallengeIdForCamera, user_id: state.currentUser.id, submission_url: imageUrl, status: 'pending' });
            if (error) throw error;
            await loadChallengesData();
            alert('Challenge submitted successfully!');
        } catch (err) {
            console.error('Camera Upload Error:', err); alert('Failed to upload photo.');
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    }, 'image/jpeg', 0.8);
};

export const openEcoQuizModal = (challengeId) => {
    document.getElementById('eco-quiz-modal').classList.add('open');
    document.getElementById('eco-quiz-modal').classList.remove('invisible');
};
export const closeEcoQuizModal = () => {
    document.getElementById('eco-quiz-modal').classList.remove('open');
    setTimeout(() => document.getElementById('eco-quiz-modal').classList.add('invisible'), 300);
};
export const handleQuizAnswer = (isCorrect, challengeId) => {
    alert(`Quiz answer submitted. Correct: ${isCorrect}`);
    closeEcoQuizModal();
};

window.renderChallengesPageWrapper = renderChallengesPage;
window.renderEventsPageWrapper = renderEventsPage;
window.startCamera = startCamera;
window.closeCameraModal = closeCameraModal;
window.capturePhoto = capturePhoto;
window.switchCamera = () => alert("Switch camera not implemented.");
window.openEcoQuizModal = openEcoQuizModal;
window.closeEcoQuizModal = closeEcoQuizModal;
window.handleQuizAnswer = handleQuizAnswer;
