import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { getPlaceholderImage, formatDate } from './utils.js';

// --- Data Loading ---
export const loadStoreAndProductData = async () => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select(`id, name, description, original_price, discounted_price, ecopoints_cost, store_id, stores ( name, logo_url ), product_images ( image_url, sort_order ), product_features ( feature, sort_order )`)
            .eq('is_active', true);
            
        if (error) throw error;

        state.products = data.map(p => ({
            ...p,
            images: p.product_images.sort((a,b) => a.sort_order - b.sort_order).map(img => img.image_url),
            features: p.product_features.sort((a,b) => a.sort_order - b.sort_order).map(f => f.feature),
            storeName: p.stores.name,
            storeLogo: p.stores.logo_url,
            popularity: Math.floor(Math.random() * 50) 
        }));
    } catch (err) { console.error('Product Load Error:', err); }
};

export const loadUserRewardsData = async () => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`id, created_at, status, order_items ( products ( id, name, product_images ( image_url ), stores ( name ) ) )`)
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.userRewards = data.map(order => {
            const item = order.order_items[0]; 
            if (!item) return null;
            return {
                userRewardId: order.id,
                purchaseDate: formatDate(order.created_at),
                status: order.status,
                productName: item.products.name,
                storeName: item.products.stores.name,
                productImage: (item.products.product_images[0] && item.products.product_images[0].image_url) || getPlaceholderImage()
            };
        }).filter(Boolean);
    } catch (err) { console.error('User Rewards Load Error:', err); }
};

// --- Rendering ---
export const renderRewards = () => {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    let products = [...state.products];
    
    const searchTerm = document.getElementById('store-search-input').value.toLowerCase();
    if(searchTerm.length > 0) {
        products = products.filter(p => p.name.toLowerCase().includes(searchTerm) || p.storeName.toLowerCase().includes(searchTerm));
    }

    const criteria = document.getElementById('sort-by-select').value;
    products.sort((a, b) => {
        if (criteria === 'points-lh') return a.ecopoints_cost - b.ecopoints_cost;
        if (criteria === 'points-hl') return b.ecopoints_cost - a.ecopoints_cost;
        return b.popularity - a.popularity;
    });

    if (products.length === 0) { grid.innerHTML = `<p class="text-center text-gray-500 col-span-2">No rewards found.</p>`; return; }

    products.forEach(p => {
        const img = (p.images && p.images[0]) ? p.images[0] : getPlaceholderImage('300x225');
        grid.innerHTML += `
            <div class="w-full glass-card rounded-2xl overflow-hidden flex flex-col cursor-pointer" onclick="showProductDetailPage('${p.id}')">
                <img src="${img}" class="w-full h-40 object-cover">
                <div class="p-3 flex flex-col flex-grow">
                    <p class="text-xs font-medium text-gray-600 dark:text-gray-400">${p.storeName}</p>
                    <p class="font-bold text-gray-800 dark:text-gray-100 text-sm truncate mt-1">${p.name}</p>
                    <div class="mt-auto pt-2 flex items-center font-bold">
                        <span class="text-md text-green-700 dark:text-green-400">₹${p.discounted_price}</span>
                        <span class="mx-1 text-gray-400 text-xs">+</span>
                        <i data-lucide="leaf" class="w-3 h-3 text-green-500 mr-1"></i>
                        <span class="text-sm text-green-700 dark:text-green-400">${p.ecopoints_cost}</span>
                    </div>
                </div>
            </div>`;
    });
    if(window.lucide) window.lucide.createIcons();
};

export const showProductDetailPage = (productId) => {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    const canAfford = state.currentUser.current_points >= product.ecopoints_cost;
    const sliderImagesHTML = (product.images.length ? product.images : [getPlaceholderImage()]).map(img => 
        `<img src="${img}" class="slider-item w-full h-80 object-cover flex-shrink-0 rounded-3xl">`
    ).join('');

    const detailPage = document.getElementById('product-detail-page');
    detailPage.innerHTML = `
        <div class="pb-8">
            <div class="relative">
                <div class="slider-container flex w-full overflow-x-auto snap-x gap-4 px-4 pt-4 pb-10">${sliderImagesHTML}</div>
                <button onclick="showPage('rewards')" class="absolute top-6 left-6 p-2 glass-card rounded-full"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
            </div>
            <div class="px-4 -mt-6">
                <div class="glass-card p-6 rounded-3xl">
                    <h2 class="text-2xl font-extrabold text-gray-900 dark:text-gray-50">${product.name}</h2>
                    <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">${product.description}</p>
                    <div class="pt-4 mt-2 border-t flex items-center justify-between gap-3">
                         <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                            <span class="text-xl text-emerald-700">₹${product.discounted_price}</span>
                            <span class="mx-2 text-gray-400 text-sm">+</span>
                            <span class="text-xl text-emerald-700">${product.ecopoints_cost} Pts</span>
                        </div>
                        <button onclick="openPurchaseModal('${product.id}')" class="btn-eco-gradient text-white text-sm font-semibold py-3 px-5 rounded-xl ${canAfford ? '' : 'opacity-60'}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Redeem' : 'No Pts'}</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    window.showPage('product-detail-page');
};

export const confirmPurchase = async (productId, refreshCallback) => {
    const product = state.products.find(p => p.id === productId);
    if (!product || state.currentUser.current_points < product.ecopoints_cost) return alert("Not enough points.");

    try {
        const { data: order, error } = await supabase.from('orders').insert({ 
            user_id: state.currentUser.id, store_id: product.store_id, status: 'pending',
            total_points: product.ecopoints_cost, total_price: product.discounted_price 
        }).select().single();
        
        if(error) throw error;

        await supabase.from('order_items').insert({ order_id: order.id, product_id: product.id, quantity: 1 });
        await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id); // Trigger handles deduction
        
        document.getElementById('purchase-modal-overlay').click(); // Close modal
        if(refreshCallback) refreshCallback();
        window.showPage('my-rewards');
    } catch (err) { alert(`Purchase failed: ${err.message}`); }
};

export const renderMyRewardsPage = () => {
    const list = document.getElementById('all-rewards-list');
    list.innerHTML = '';
    if (state.userRewards.length === 0) return list.innerHTML = `<p class="text-center text-gray-500">No rewards yet.</p>`;
    
    state.userRewards.forEach(ur => {
        list.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between">
                <div class="flex items-center">
                    <img src="${ur.productImage}" class="w-14 h-14 rounded-lg object-cover mr-3">
                    <div>
                        <p class="text-sm font-bold dark:text-gray-100">${ur.productName}</p>
                        <p class="text-xs text-gray-500">${ur.storeName}</p>
                    </div>
                </div>
                ${ur.status === 'confirmed' ? `<button onclick="openRewardQrModal('${ur.userRewardId}')" class="text-xs px-3 py-2 rounded-full bg-emerald-600 text-white">View QR</button>` : `<span>${ur.status}</span>`}
            </div>`;
    });
};
