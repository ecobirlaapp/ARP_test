import { state } from './state.js';
import { logUserActivity, isLowDataMode } from './utils.js';

// --- IMMERSIVE STORY CONFIGURATION ---
const CAMPUS_STORIES = [
    {
        id: 'story-solar',
        title: 'Powering the Future.',
        subtitle: 'The Solar Canopy Initiative',
        description: 'Our B-Block roof isn\'t just a shelter; it\'s a power station. Generating 50kW of clean energy daily, this architectural marvel powers our science labs and stands as a testament to our carbon-neutral goals.',
        image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80', 
        // THEME: Deep Forest (Dark Green & Crisp White)
        bgClass: 'bg-[#1a2e05]', 
        textClass: 'text-[#ecfccb]', // Lime-100
        headingClass: 'text-white',
        accentColor: 'bg-[#84cc16]', // Lime-500
        layout: 'normal', 
        imgShape: 'rounded-tr-[100px] rounded-bl-[100px]' // Leaf Shape
    },
    {
        id: 'story-garden',
        title: 'A Library Without Walls.',
        subtitle: 'Native Botanical Sanctuary',
        description: 'Forget dull lectures. Our Botany students learn in the "Living Library"—a curated sanctuary of 200+ indigenous plant species. It is a classroom where local biodiversity thrives and students find focus.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80',
        // THEME: Warm Sandstone (Beige & Dark Earth)
        bgClass: 'bg-[#fffbeb]', // Amber-50
        textClass: 'text-[#78350f]', // Amber-900
        headingClass: 'text-[#451a03]', // Amber-950
        accentColor: 'bg-[#d97706]', // Amber-600
        layout: 'reverse', 
        imgShape: 'rounded-t-full' // The "Arch" Window (Flagler Style)
    },
    {
        id: 'story-waste',
        title: 'Closing the Loop.',
        subtitle: 'Zero-Waste Cafeteria',
        description: 'We are redefining consumption. From biodegradable sugarcane plates to our on-site bio-gas plant that turns leftovers into energy, every meal served here is a step towards a landfill-free campus.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        // THEME: Earthen Clay (Terracotta & Cream)
        bgClass: 'bg-[#7c2d12]', // Orange-900
        textClass: 'text-[#ffedd5]', // Orange-100
        headingClass: 'text-white',
        accentColor: 'bg-[#fdba74]', // Orange-300
        layout: 'normal', 
        imgShape: 'rounded-[3rem]' // Soft Rect
    },
    {
        id: 'story-water',
        title: 'Every Drop Counts.',
        subtitle: 'Smart Water Conservation',
        description: 'Our rainwater harvesting systems collect over 100,000 liters annually, recharging the campus groundwater tables. We don’t just use water; we respect it, protect it, and replenish it.',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
        // THEME: Deep Ocean (Navy & Cyan)
        bgClass: 'bg-[#083344]', // Cyan-950
        textClass: 'text-[#cffafe]', // Cyan-100
        headingClass: 'text-white',
        accentColor: 'bg-[#06b6d4]', // Cyan-500
        layout: 'reverse', 
        imgShape: 'rounded-full aspect-square object-cover shadow-[0_0_60px_-15px_rgba(6,182,212,0.3)]' // Planet/Porthole
    }
];

// 1. Load Data
export const loadGalleryData = async () => {
    state.gallery = CAMPUS_STORIES;
    // Only render if user is on this page to avoid heavy DOM ops in background
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render (Scrollytelling Single Page View)
export const renderGallery = () => {
    const container = document.getElementById('gallery-feed');
    if (!container) return;
    
    container.innerHTML = '';
    
    // --- HERO SECTION ---
    const hero = document.createElement('div');
    hero.className = "min-h-[70vh] flex flex-col items-center justify-center text-center px-6 bg-white dark:bg-gray-950 sticky top-0 z-0";
    hero.style.marginBottom = "-20vh"; // Overlap effect
    hero.innerHTML = `
        <div class="animate-slideUp">
            <span class="inline-block px-4 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase mb-6">
                The GreenLens Project
            </span>
            <h1 class="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter font-jakarta leading-[0.9] mb-8">
                Campus.<br>Reimagined.
            </h1>
            <p class="text-lg text-gray-500 max-w-lg mx-auto mb-10">
                Scroll to explore the initiatives that define our commitment to a sustainable future.
            </p>
            <div class="animate-bounce text-gray-400">
                <i data-lucide="arrow-down" class="w-8 h-8"></i>
            </div>
        </div>
    `;
    container.appendChild(hero);

    const isLowData = isLowDataMode();

    // --- STORY SECTIONS ---
    state.gallery.forEach((item, index) => {
        const section = document.createElement('section');
        
        // Layout Logic: "min-h-screen" ensures the color fills the view
        const flexDirection = item.layout === 'reverse' ? 'lg:flex-row-reverse' : 'lg:flex-row';
        
        // Note: 'sticky' and 'z-index' creates a stacking card effect as you scroll
        section.className = `min-h-screen w-full flex flex-col ${flexDirection} items-center justify-center gap-12 lg:gap-24 px-6 lg:px-24 py-20 ${item.bgClass} relative z-10`;

        // Image Column
        const imgHTML = `
            <div class="w-full lg:w-1/2 flex justify-center items-center">
                <div class="relative w-full max-w-lg aspect-[4/5] ${item.imgShape} overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-700 ease-out group">
                    <img src="${item.image}" class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000" loading="lazy" alt="${item.title}">
                    
                    ${!isLowData ? `
                        <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    ` : ''}
                </div>
            </div>
        `;

        // Text Column
        const textHTML = `
            <div class="w-full lg:w-1/2 text-center lg:text-left">
                <div class="flex items-center justify-center lg:justify-start gap-3 mb-6">
                    <span class="h-0.5 w-12 ${item.accentColor}"></span>
                    <span class="text-xs font-bold tracking-[0.2em] uppercase ${item.textClass} opacity-90">${item.subtitle}</span>
                </div>
                
                <h2 class="text-5xl md:text-7xl font-black font-jakarta leading-tight mb-8 ${item.headingClass}">
                    ${item.title}
                </h2>
                
                <p class="text-lg md:text-xl leading-relaxed ${item.textClass} opacity-90 max-w-xl mx-auto lg:mx-0 font-medium">
                    ${item.description}
                </p>
            </div>
        `;

        // Background Number (Decor)
        const decorHTML = `
            <div class="absolute top-10 left-10 md:left-20 text-[12rem] font-black opacity-5 select-none pointer-events-none mix-blend-overlay text-white leading-none font-jakarta">
                0${index + 1}
            </div>
        `;

        section.innerHTML = imgHTML + textHTML + decorHTML;
        container.appendChild(section);
    });
    
    // --- FOOTER CALL TO ACTION ---
    const footer = document.createElement('section');
    footer.className = "min-h-[50vh] bg-white dark:bg-black flex flex-col items-center justify-center text-center px-6 relative z-20";
    footer.innerHTML = `
        <h3 class="text-4xl font-bold text-gray-900 dark:text-white mb-6">Be Part of the Story.</h3>
        <p class="text-gray-500 mb-8 max-w-md">Your actions contribute to the next chapter of our Green Campus.</p>
        <button onclick="showPage('challenges')" class="group relative px-8 py-4 bg-green-600 text-white font-bold rounded-full overflow-hidden shadow-lg hover:shadow-green-500/50 transition-all">
            <span class="relative z-10 flex items-center gap-2">
                Start a Challenge <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </span>
            <div class="absolute inset-0 bg-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
        </button>
    `;
    container.appendChild(footer);

    logUserActivity('view_greenlens_feed', 'User entered immersive gallery');
    if(window.lucide) window.lucide.createIcons();
};

// Expose to window for Utils
window.renderGalleryWrapper = renderGallery;
