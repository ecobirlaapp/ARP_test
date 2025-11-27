import { state } from './state.js';
import { logUserActivity, isLowDataMode } from './utils.js';

// --- STATIC STORY DATA (Flagler-Inspired) ---
const CAMPUS_STORIES = [
    {
        id: 'story-1',
        title: 'Where Nature Meets Innovation.',
        category: 'The Solar Canopy',
        description: 'Our B-Block roof has been transformed into a living power station. Generating 50kW of clean energy daily, this architectural marvel doesn’t just power our labs—it stands as a testament to our commitment to a carbon-neutral future.',
        image: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1200&q=80', // Modern building/solar
        // THEME: Deep Forest (Dark Green / White)
        bgClass: 'bg-[#064e3b]', 
        textClass: 'text-emerald-50',
        accentClass: 'text-emerald-400',
        layout: 'normal', // Image Right
        imgShape: 'rounded-tl-[100px] rounded-br-[100px]' // Organic Leaf Shape
    },
    {
        id: 'story-2',
        title: 'Academics Done Differently.',
        category: 'Native Botanical Garden',
        description: 'Forget dull lectures. Our Botany students learn in the "Living Library"—a curated sanctuary of 200+ indigenous plant species. It’s not just a garden; it’s a classroom without walls where local biodiversity thrives.',
        image: 'https://images.unsplash.com/photo-1623286908359-a73927f7b373?auto=format&fit=crop&w=1200&q=80', // Student in garden
        // THEME: Solar Gold (Yellow / Dark)
        bgClass: 'bg-[#fbbf24]', 
        textClass: 'text-amber-950',
        accentClass: 'text-amber-800',
        layout: 'reverse', // Image Left
        imgShape: 'rounded-t-full' // The "Arch" Window Look (Flagler Style)
    },
    {
        id: 'story-3',
        title: 'A Future Free of Waste.',
        category: 'Zero-Waste Cafeteria',
        description: 'We are redefining consumption. From biodegradable sugarcane plates to our on-site bio-gas plant that turns leftovers into energy, every meal served here closes the loop on waste.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80', // Recycling/Food
        // THEME: Earthy Terracotta (Red/Brown / White)
        bgClass: 'bg-[#9c4221]', 
        textClass: 'text-orange-50',
        accentClass: 'text-orange-200',
        layout: 'normal', // Image Right
        imgShape: 'rounded-xl rotate-2' // Slightly tilted polaroid style
    },
    {
        id: 'story-4',
        title: 'Leading the Blue Wave.',
        category: 'Water Conservation',
        description: 'Our rainwater harvesting systems collect over 100,000 liters annually, recharging the campus groundwater tables. We don’t just use water; we respect it, protect it, and replenish it.',
        image: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=1200&q=80', // Water/Science
        // THEME: Ocean Depth (Deep Blue / White)
        bgClass: 'bg-[#1e3a8a]', 
        textClass: 'text-blue-50',
        accentClass: 'text-blue-300',
        layout: 'reverse', // Image Left
        imgShape: 'rounded-full aspect-square object-cover' // Porthole / Circle look
    }
];

// 1. Load Data
export const loadGalleryData = async () => {
    state.gallery = CAMPUS_STORIES;
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render (Immersive Single Page View)
export const renderGallery = () => {
    const container = document.getElementById('gallery-feed');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Add a "Hero" Header inside the feed
    const hero = document.createElement('div');
    hero.className = "py-20 px-6 text-center bg-white dark:bg-gray-900";
    hero.innerHTML = `
        <span class="text-green-600 font-bold tracking-[0.3em] uppercase text-xs mb-4 block">The GreenLens Project</span>
        <h1 class="text-5xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tight font-jakarta mb-6">
            Our Campus.<br>Reimagined.
        </h1>
        <div class="w-20 h-1 bg-green-500 mx-auto rounded-full"></div>
    `;
    container.appendChild(hero);

    const isLowData = isLowDataMode();

    state.gallery.forEach((item, index) => {
        const section = document.createElement('section');
        
        // Layout Logic: Alternating Row Direction
        const flexDirection = item.layout === 'reverse' ? 'lg:flex-row-reverse' : 'lg:flex-row';
        
        // Base Classes for full width section
        section.className = `w-full py-20 lg:py-32 px-6 lg:px-20 flex flex-col ${flexDirection} items-center gap-12 lg:gap-24 ${item.bgClass} transition-colors duration-500 overflow-hidden relative`;

        // Visual Content (Image)
        const mediaHTML = `
            <div class="w-full lg:w-1/2 relative z-10">
                <div class="relative w-full aspect-[4/5] lg:aspect-square shadow-2xl ${item.imgShape} overflow-hidden transform hover:scale-[1.02] transition-transform duration-700 ease-out">
                    <img src="${item.image}" class="w-full h-full object-cover" loading="lazy" alt="${item.category}">
                    ${!isLowData ? '<div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>' : ''}
                </div>
            </div>
        `;

        // Text Content
        const textHTML = `
            <div class="w-full lg:w-1/2 relative z-10 text-center lg:text-left">
                <span class="inline-block py-1 mb-4 text-xs font-bold tracking-[0.2em] uppercase border-b-2 border-current ${item.accentClass} opacity-80">
                    ${item.category}
                </span>
                <h2 class="text-4xl md:text-6xl font-black mb-6 font-jakarta leading-[1.1] ${item.textClass}">
                    ${item.title}
                </h2>
                <p class="text-lg md:text-xl leading-relaxed opacity-90 ${item.textClass} font-medium max-w-xl mx-auto lg:mx-0">
                    ${item.description}
                </p>
            </div>
        `;

        // Background Decor (Subtle huge text or shapes behind)
        const decorHTML = `
            <div class="absolute -bottom-20 -right-20 text-[20rem] font-black opacity-5 select-none pointer-events-none mix-blend-overlay ${item.textClass}">
                ${index + 1}
            </div>
        `;

        section.innerHTML = mediaHTML + textHTML + decorHTML;
        container.appendChild(section);
    });
    
    // Footer Message
    const footer = document.createElement('div');
    footer.className = "py-24 bg-gray-900 text-center text-white";
    footer.innerHTML = `
        <h3 class="text-3xl font-bold mb-6">Be Part of the Story.</h3>
        <button onclick="showPage('challenges')" class="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full transition-all transform hover:scale-105 shadow-lg shadow-green-500/30">
            Join a Challenge
        </button>
    `;
    container.appendChild(footer);

    // Log view
    logUserActivity('view_greenlens_feed', 'User scrolled through GreenLens stories');
};

// Expose to window
window.renderGalleryWrapper = renderGallery;
