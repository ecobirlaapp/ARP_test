import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, getPlaceholderImage, logUserActivity, isLowDataMode } from './utils.js';

export const loadGalleryData = async () => {
    const container = document.getElementById('gallery-grid');
    
    try {
        const { data, error } = await supabase
            .from('campus_gallery')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Gallery: DB Fetch Error:', error.message);
            throw error;
        }

        state.gallery = data || [];
        
        if (document.getElementById('green-lens').classList.contains('active')) {
            renderGallery();
        }
    } catch (err) {
        console.error('Gallery: Critical Load Error:', err);
        if (container) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 opacity-60 text-center">
                    <i data-lucide="image-off" class="w-10 h-10 text-gray-400 mb-2"></i>
                    <p class="text-sm text-gray-500">Gallery unavailable.</p>
                    <p class="text-xs text-gray-400 mt-1">Please run the SQL script in Supabase.</p>
                </div>
            `;
            if(window.lucide) window.lucide.createIcons();
        }
    }
};

export const filterGallery = (filterType) => {
    try {
        const buttons = document.querySelectorAll('.gallery-filter-btn');
        buttons.forEach(btn => {
            if(btn.dataset.filter === filterType) {
                btn.classList.add('bg-green-600', 'text-white');
                btn.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-200');
            } else {
                btn.classList.remove('bg-green-600', 'text-white');
                btn.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-200');
            }
        });
        renderGallery(filterType);
        logUserActivity('filter_gallery', `Filtered gallery by ${filterType}`);
    } catch (e) {
        console.error('Gallery: Filter Error:', e);
    }
};

export const renderGallery = (filter = 'all') => {
    try {
        const container = document.getElementById('gallery-grid');
        if (!container) return;
        
        container.innerHTML = '';

        let items = state.gallery;
        if (filter !== 'all') {
            items = items.filter(item => item.media_type === filter || (item.tags && item.tags.includes(filter)));
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 opacity-60 text-center">
                    <i data-lucide="camera" class="w-10 h-10 text-gray-400 mb-2"></i>
                    <p class="text-sm text-gray-500">No moments captured yet.</p>
                </div>`;
            if(window.lucide) window.lucide.createIcons();
            return;
        }

        const lowData = isLowDataMode();

        items.forEach(item => {
            const isVideo = item.media_type === 'video';
            const displayUrl = (lowData && isVideo && item.thumbnail_url) ? item.thumbnail_url : item.media_url;
            
            const card = document.createElement('div');
            card.className = "gallery-item break-inside-avoid mb-4 group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-gray-100 dark:bg-gray-800";
            card.onclick = () => openLightbox(item);

            let mediaHTML = '';
            if (isVideo && !lowData) {
                mediaHTML = `
                    <video src="${displayUrl}" class="w-full h-auto object-cover" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                        <div class="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <i data-lucide="play" class="w-5 h-5 text-white fill-white ml-1"></i>
                        </div>
                    </div>
                `;
            } else {
                const poster = isVideo ? (item.thumbnail_url || getPlaceholderImage('400x300', 'Video')) : displayUrl;
                mediaHTML = `<img src="${poster}" class="w-full h-auto object-cover" loading="lazy">`;
                if(isVideo) {
                     mediaHTML += `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-md"><i data-lucide="video" class="w-3 h-3 inline mr-1"></i>Video</div>`;
                }
            }

            card.innerHTML = `
                ${mediaHTML}
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 class="text-white font-bold text-sm line-clamp-1">${item.title}</h3>
                    <p class="text-gray-300 text-xs line-clamp-2">${item.description || ''}</p>
                    <div class="flex gap-1 mt-2 flex-wrap">
                        ${(item.tags || []).map(t => `<span class="text-[8px] px-1.5 py-0.5 bg-white/20 text-white rounded backdrop-blur-sm">#${t}</span>`).join('')}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
        
        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error('Gallery: Render Error:', e);
    }
};

// Lightbox Logic
export const openLightbox = (item) => {
    try {
        logUserActivity('view_gallery_item', `Opened ${item.media_type}: ${item.title}`);
        const modal = document.getElementById('gallery-modal');
        const content = document.getElementById('gallery-modal-content');
        
        let contentHTML = '';
        if (item.media_type === 'video') {
            contentHTML = `<video src="${item.media_url}" controls autoplay class="max-h-[70vh] w-full rounded-lg shadow-2xl bg-black"></video>`;
        } else {
            contentHTML = `<img src="${item.media_url}" class="max-h-[70vh] w-full object-contain rounded-lg shadow-2xl">`;
        }

        content.innerHTML = `
            ${contentHTML}
            <div class="mt-4 text-left">
                <h2 class="text-xl font-bold text-white">${item.title}</h2>
                <p class="text-gray-300 text-sm mt-1">${item.description || ''}</p>
                <div class="flex gap-2 mt-3">
                     ${(item.tags || []).map(t => `<span class="text-xs px-2 py-1 bg-white/10 text-white rounded-full border border-white/20">#${t}</span>`).join('')}
                </div>
            </div>
        `;

        modal.classList.remove('hidden', 'opacity-0');
        modal.classList.add('flex', 'opacity-100');
    } catch (e) {
        console.error('Gallery: Lightbox Error:', e);
    }
};

export const closeLightbox = () => {
    try {
        const modal = document.getElementById('gallery-modal');
        const content = document.getElementById('gallery-modal-content');
        const video = content.querySelector('video');
        if(video) video.pause();
        
        modal.classList.add('hidden', 'opacity-0');
        modal.classList.remove('flex', 'opacity-100');
    } catch (e) {
        console.error('Gallery: Close Lightbox Error:', e);
    }
};

window.filterGallery = filterGallery;
window.closeLightbox = closeLightbox;
