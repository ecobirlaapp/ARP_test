import { state } from './state.js';
import { logUserActivity } from './utils.js';

// --- STATIC DATA (Configuration) ---
// Replace these URLs with actual photos of your college campus later
const CAMPUS_STORIES = [
    {
        id: 'story-1',
        title: 'The Solar Canopy Project',
        category: 'Energy',
        description: 'Our B-Block roof is now 100% solar-powered, generating 50kW of clean energy daily for the science labs.',
        image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
        size: 'large' // Spans 2 columns on desktop
    },
    {
        id: 'story-2',
        title: 'Native Botanical Garden',
        category: 'Biodiversity',
        description: 'Preserving local flora with over 200 indigenous plant species maintained by the Botany department.',
        image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=800&q=80',
        size: 'normal'
    },
    {
        id: 'story-3',
        title: 'Zero-Waste Cafeteria',
        category: 'Sustainability',
        description: 'Converting 100% of wet waste into compost for our gardens using the new bio-gas plant.',
        image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
        size: 'normal'
    },
    {
        id: 'story-4',
        title: 'Paperless Campus Drive',
        category: 'Digital',
        description: 'Moving 90% of administrative work to digital platforms to save 500+ trees annually.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
        size: 'normal'
    },
    {
        id: 'story-5',
        title: 'Eco-Warriors Team',
        category: 'Community',
        description: 'Meet the student council members leading the change for a greener tomorrow.',
        image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
        size: 'normal'
    }
];

// 1. Load Data (Now Static)
export const loadGalleryData = async () => {
    // Simulate "loading" for a split second for smoothness, but no API call
    state.gallery = CAMPUS_STORIES;
    
    // Render immediately if on the page
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render Gallery (Flagler/College Website Style)
export const renderGallery = () => {
    const container = document.getElementById('gallery-grid');
    if (!container) return;
    
    // Update Container Layout for "Bento" style grid
    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto";
    container.innerHTML = '';

    state.gallery.forEach(item => {
        const card = document.createElement('div');
        
        // Dynamic Spanning: Feature items span 2 columns
        const spanClass = item.size === 'large' ? 'md:col-span-2' : 'md:col-span-1';
        
        card.className = `${spanClass} group relative h-80 md:h-96 rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1`;
        
        card.onclick = () => openStaticLightbox(item);

        card.innerHTML = `
            <div class="absolute inset-0">
                <img src="${item.image}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="${item.title}" loading="lazy">
            </div>
            
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"></div>

            <div class="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <span class="inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-widest text-white uppercase bg-green-600 rounded-full shadow-sm">
                        ${item.category}
                    </span>
                    <h3 class="text-2xl md:text-3xl font-bold text-white mb-2 font-jakarta leading-tight">
                        ${item.title}
                    </h3>
                    <div class="h-0 group-hover:h-auto overflow-hidden transition-all duration-300 opacity-0 group-hover:opacity-100">
                        <p class="text-gray-200 text-sm leading-relaxed mb-4 line-clamp-2">
                            ${item.description}
                        </p>
                        <span class="inline-flex items-center text-green-300 text-xs font-bold uppercase tracking-wide group-hover:text-white transition-colors">
                            Read Story <i data-lucide="arrow-right" class="w-4 h-4 ml-2"></i>
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    if(window.lucide) window.lucide.createIcons();
};

// 3. Simplified Lightbox for Static Data
export const openStaticLightbox = (item) => {
    logUserActivity('view_gallery_story', `Viewed story: ${item.title}`);
    const modal = document.getElementById('gallery-modal');
    const content = document.getElementById('gallery-modal-content');
    
    content.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden max-w-3xl w-full mx-auto shadow-2xl relative">
            <div class="relative h-64 md:h-96">
                <img src="${item.image}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                    <div>
                        <span class="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full mb-2 inline-block">${item.category}</span>
                        <h2 class="text-3xl font-bold text-white font-jakarta">${item.title}</h2>
                    </div>
                </div>
            </div>
            <div class="p-8 text-left">
                <p class="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                    ${item.description}
                </p>
                <div class="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Initiative by BKBNC Green Club</p>
                </div>
            </div>
            <button onclick="closeLightbox()" class="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('flex', 'opacity-100');
    if(window.lucide) window.lucide.createIcons();
};

// Re-use existing close logic or simplified
export const closeLightbox = () => {
    const modal = document.getElementById('gallery-modal');
    modal.classList.add('hidden', 'opacity-0');
    modal.classList.remove('flex', 'opacity-100');
};

// Expose to window
window.renderGalleryWrapper = renderGallery;
window.closeLightbox = closeLightbox;
