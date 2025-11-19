import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, formatDate, getPlaceholderImage, getUserLevel } from './utils.js';
import { refreshUserData } from './app.js';

const getProduct = (productId) => state.products.find(p => p.id === productId);

export const loadStoreAndProductData = async () => {
    try {
        const { data, error } = await supabase.from('products').select(`
                id, name, description, original_price, discounted_price, ecopoints_cost, store_id,
                stores ( name, logo_url ), product_images ( image_url, sort_order ),
                product_features ( feature, sort_order ), product_specifications ( spec_key, spec_value, sort_order )
            `).eq('is_active', true);
        if (error) return;

        state.products = data.map(p => ({
            ...p, images: p.product_images.sort((a,b) => a.sort_order - b.sort_order).map(img => img.image_url),
            features: p.product_features.sort((a,b) => a.sort_order - b.sort_order).map(f => f.feature),
            specifications: p.product_specifications.sort((a,b) => a.sort_order - b.sort_order),
            storeName: p.stores.name, storeLogo: p.stores.logo_url, popularity: Math.floor(Math.random() * 50) 
        }));
        if (document.getElementById('rewards').classList.contains('active')) renderRewards();
    } catch (err) { console.error('Product Load Error:', err); }
};

export const renderRewards = () => {
    els.productGrid.innerHTML = '';
    let products = [...state.products];
    if (products.length === 0) { els.productGrid.innerHTML = `<p class="text-sm text-center text-gray-500 col-span-2">Loading rewards...</p>`; return; }
    
    const searchTerm = els.storeSearch.value.toLowerCase();
    if(searchTerm.length > 0) products = products.filter(p => p.name.toLowerCase().includes(searchTerm) || p.storeName.toLowerCase().includes(searchTerm));
    els.storeSearchClear.classList.toggle('hidden', !searchTerm);

    const criteria = els.sortBy.value;
    products.sort((a, b) => {
        switch (criteria) {
            case 'points-lh': return a.ecopoints_cost - b.ecopoints_cost;
            case 'points-hl': return b.ecopoints_cost - a.ecopoints_cost;
            case 'price-lh': return a.discounted_price - b.discounted_price;
            case 'price-hl': return b.discounted_price - a.discounted_price;
            default: return b.popularity - a.popularity;
        }
    });
    if (products.length === 0) { els.productGrid.innerHTML = `<p class="text-sm text-center text-gray-500 col-span-2">No rewards found.</p>`; return; }

    products.forEach(p => {
        const imageUrl = (p.images && p.images[0]) ? p.images[0] : getPlaceholderImage('300x225');
        els.productGrid.innerHTML += `
            <div class="w-full flex-shrink-0 glass-card border border-gray-200/60 dark:border-gray-700/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer" onclick="showProductDetailPage('${p.id}')">
                <img src="${imageUrl}" class="w-full h-40 object-cover" onerror="this.src='${getPlaceholderImage('300x225')}'"><div class="p-3 flex flex-col flex-grow"><div class="flex items-center mb-1"><img src="${p.storeLogo || getPlaceholderImage('40x40')}" class="w-5 h-5 rounded-full mr-2 border dark:border-gray-600"><p class="text-xs font-medium text-gray-600 dark:text-gray-400">${p.storeName}</p></div><p class="font-bold text-gray-800 dark:text-gray-100 text-sm truncate mt-1">${p.name}</p><div class="mt-auto pt-2"><p class="text-xs text-gray-400 dark:text-gray-500 line-through">₹${p.original_price}</p><div class="flex items-center font-bold text-gray-800 dark:text-gray-100 my-1"><span class="text-md text-green-700 dark:text-green-400">₹${p.discounted_price}</span><span class="mx-1 text-gray-400 dark:text-gray-500 text-xs">+</span><i data-lucide="leaf" class="w-3 h-3 text-green-500 mr-1"></i><span class="text-sm text-green-700 dark:text-green-400">${p.ecopoints_cost}</span></div></div></div>
            </div>`;
    });
    if(window.lucide) window.lucide.createIcons();
};

export const showProductDetailPage = (productId) => {
    const product = getProduct(productId);
    if (!product) return;
    const images = (product.images && product.images.length > 0) ? product.images : [getPlaceholderImage()];
    let sliderImagesHTML = '', sliderDotsHTML = '';
    images.forEach((img, index) => {
        sliderImagesHTML += `<img src="${img}" class="slider-item w-full h-80 object-cover flex-shrink-0 rounded-3xl" data-index="${index}" onerror="this.src='${getPlaceholderImage('600x400')}'">`;
        sliderDotsHTML += `<button class="slider-dot w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-gray-700/80 ${index === 0 ? 'active' : ''}"></button>`;
    });
    const canAfford = state.currentUser.current_points >= product.ecopoints_cost;
    els.productDetailPage.innerHTML = `
        <div class="pb-8"><div class="relative"><div class="slider-container flex w-full overflow-x-auto snap-x snap-mandatory gap-4 px-4 pt-4 pb-10">${sliderImagesHTML}</div><button onclick="showPage('rewards')" class="absolute top-6 left-6 p-2 glass-card rounded-full text-gray-700 dark:text-gray-200 !px-2 !py-2"><i data-lucide="arrow-left" class="w-5 h-5"></i></button><div class="absolute bottom-5 left-0 right-0 flex justify-center items-center space-x-2 z-10">${sliderDotsHTML}</div></div>
            <div class="px-4 -mt-6"><div class="glass-card p-6 rounded-3xl"><div class="flex items-start justify-between gap-3 mb-2"><div><h2 class="text-2xl font-extrabold text-gray-900 dark:text-gray-50">${product.name}</h2><div class="flex items-center mt-2"><img src="${product.storeLogo || getPlaceholderImage('40x40')}" class="w-7 h-7 rounded-full mr-2 border"><p class="text-xs font-medium text-gray-500 dark:text-gray-400">${product.storeName}</p></div></div><span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">${product.ecopoints_cost} EcoPts</span></div><div class="mt-4 space-y-5"><div><h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Description</h3><p class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${product.description}</p></div><div class="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3"><div><p class="text-xs text-gray-500 line-through">₹${product.original_price}</p><div class="flex items-center font-bold text-gray-800 dark:text-gray-100"><span class="text-xl text-emerald-700 dark:text-emerald-400">₹${product.discounted_price}</span><span class="mx-2 text-gray-400 text-sm">+</span><i data-lucide="leaf" class="w-4 h-4 text-emerald-500 mr-1"></i><span class="text-xl text-emerald-700">${product.ecopoints_cost}</span></div></div><button onclick="openPurchaseModal('${product.id}')" class="btn-eco-gradient text-white text-sm font-semibold py-3 px-5 rounded-xl flex-shrink-0 ${canAfford ? '' : 'opacity-60 cursor-not-allowed'}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Redeem Offer' : 'Not enough points'}</button></div></div></div></div></div>`;
    // Manually set active
    els.pages.forEach(p => p.classList.remove('active'));
    els.productDetailPage.classList.add('active');
    document.querySelector('.main-content').scrollTop = 0;
    if(window.lucide) window.lucide.createIcons();
};

export const openPurchaseModal = (productId) => {
    const product = getProduct(productId);
    if (!product) return;
    const imageUrl = (product.images && product.images[0]) ? product.images[0] : getPlaceholderImage('100x100');
    els.purchaseModal.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Purchase Reward</h3><button onclick="closePurchaseModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button></div><div class="flex items-center mb-4"><img src="${imageUrl}" class="w-20 h-20 object-cover rounded-lg mr-4"><div><h4 class="text-lg font-bold text-gray-800 dark:text-gray-100">${product.name}</h4><p class="text-sm text-gray-500 mb-2">From ${product.storeName}</p><div class="flex items-center font-bold text-gray-800 dark:text-gray-100"><span class="text-lg text-green-700 dark:text-green-400">₹${product.discounted_price}</span><span class="mx-1 text-gray-400">+</span><i data-lucide="leaf" class="w-4 h-4 text-green-500 mr-1"></i><span class="text-lg text-green-700">${product.ecopoints_cost}</span></div></div></div><button id="confirm-purchase-btn" onclick="confirmPurchase('${product.id}')" class="w-full btn-eco-gradient text-white font-bold py-3 px-4 rounded-lg mb-2">Confirm Purchase</button><button onclick="closePurchaseModal()" class="w-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg">Cancel</button>`;
    els.purchaseModalOverlay.classList.remove('hidden');
    setTimeout(() => els.purchaseModal.classList.remove('translate-y-full'), 10);
    if(window.lucide) window.lucide.createIcons();
};

export const closePurchaseModal = () => {
    els.purchaseModal.classList.add('translate-y-full');
    setTimeout(() => els.purchaseModalOverlay.classList.add('hidden'), 300);
};

export const confirmPurchase = async (productId) => {
    try {
        const product = getProduct(productId);
        if (!product || state.currentUser.current_points < product.ecopoints_cost) { alert("You do not have enough points."); return; }
        const confirmBtn = document.getElementById('confirm-purchase-btn');
        confirmBtn.disabled = true; confirmBtn.textContent = 'Processing...';
        const { data: orderData, error: orderError } = await supabase.from('orders').insert({ user_id: state.currentUser.id, store_id: product.store_id, status: 'pending', total_points: product.ecopoints_cost, total_price: product.discounted_price, requires_approval: false }).select().single();
        if (orderError) throw orderError;
        const { error: itemError } = await supabase.from('order_items').insert({ order_id: orderData.id, product_id: product.id, quantity: 1, price_each: product.discounted_price, points_each: product.ecopoints_cost });
        if (itemError) throw itemError;
        const { error: confirmError } = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderData.id);
        if (confirmError) throw confirmError;
        closePurchaseModal();
        await Promise.all([refreshUserData(), loadUserRewardsData()]);
        window.showPage('my-rewards');
    } catch (err) { console.error('Purchase Failed:', err); alert(`Purchase failed: ${err.message}`); }
};

export const loadUserRewardsData = async () => {
    try {
        const { data, error } = await supabase.from('orders').select(`id, created_at, status, order_items ( products ( id, name, product_images ( image_url ), stores ( name ) ) )`).eq('user_id', state.currentUser.id).order('created_at', { ascending: false });
        if (error) return;
        state.userRewards = data.map(order => {
            const item = order.order_items[0]; if (!item) return null;
            return { userRewardId: order.id, purchaseDate: formatDate(order.created_at), status: order.status, productName: item.products.name, storeName: item.products.stores.name, productImage: (item.products.product_images[0] && item.products.product_images[0].image_url) || getPlaceholderImage() };
        }).filter(Boolean);
        if (document.getElementById('my-rewards').classList.contains('active')) renderMyRewardsPage();
    } catch (err) { console.error('User Rewards Load Error:', err); }
};

export const renderMyRewardsPage = () => {
    els.allRewardsList.innerHTML = '';
    if (state.userRewards.length === 0) { els.allRewardsList.innerHTML = `<p class="text-sm text-center text-gray-500">You haven't purchased any rewards yet.</p>`; return; }
    state.userRewards.forEach(ur => {
        els.allRewardsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between"><div class="flex items-center"><img src="${ur.productImage}" class="w-14 h-14 rounded-lg object-cover mr-3"><div class="p-1"><p class="text-sm font-bold text-gray-900 dark:text-gray-100">${ur.productName}</p><p class="text-xs text-gray-500 dark:text-gray-400">From ${ur.storeName}</p><p class="text-xs text-gray-400 mt-1">${ur.purchaseDate}</p></div></div>${ur.status === 'confirmed' ? `<button onclick="openRewardQrModal('${ur.userRewardId}')" class="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-600 text-white">View QR</button>` : `<span class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 text-gray-600">${ur.status}</span>`}</div>`;
    });
};

export const openRewardQrModal = (userRewardId) => {
    const ur = state.userRewards.find(r => r.userRewardId === userRewardId);
    if (!ur) return;
    const qrValue = `ecocampus-order:${userRewardId}-user:${state.currentUser.id}`;
    els.qrModal.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Reward QR</h3><button onclick="closeQrModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button></div><p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Show this QR at <strong>${ur.storeName}</strong> to redeem <strong>${ur.productName}</strong>.</p><div class="flex justify-center mb-4"><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrValue)}" class="rounded-lg border"></div><button onclick="closeQrModal()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg">Close</button>`;
    els.qrModalOverlay.classList.remove('hidden');
    setTimeout(() => els.qrModal.classList.remove('translate-y-full'), 10);
    if(window.lucide) window.lucide.createIcons();
};

export const closeQrModal = () => {
    els.qrModal.classList.add('translate-y-full');
    setTimeout(() => els.qrModalOverlay.classList.add('hidden'), 300);
};

export const renderEcoPointsPage = () => {
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
    if (state.history.length === 0) actContainer.innerHTML = `<p class="text-sm text-gray-500">No recent activity.</p>`;
    else state.history.slice(0,4).forEach(h => { actContainer.innerHTML += `<div class="flex items-center justify-between text-sm"><div class="flex items-center"><span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3"><i data-lucide="${h.icon}" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i></span><div><p class="font-semibold text-gray-800 dark:text-gray-100">${h.description}</p><p class="text-xs text-gray-500 dark:text-gray-400">${h.date}</p></div></div><span class="font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">${h.points > 0 ? '+' : ''}${h.points}</span></div>`; });
    
    const levelsContainer = document.getElementById('all-levels-list');
    levelsContainer.innerHTML = '';
    state.levels.forEach(lvl => { levelsContainer.innerHTML += `<div class="flex items-center"><span class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3 text-sm font-bold text-green-600 dark:text-green-300">${lvl.level}</span><div><p class="text-sm font-bold text-gray-800 dark:text-gray-100">${lvl.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${lvl.minPoints} pts required</p></div></div>`; });
    if(window.lucide) window.lucide.createIcons();
};

// Wrapper exports for Window access
window.renderRewardsWrapper = renderRewards;
window.showProductDetailPage = showProductDetailPage;
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.confirmPurchase = confirmPurchase;
window.renderMyRewardsPageWrapper = renderMyRewardsPage;
window.openRewardQrModal = openRewardQrModal;
window.closeQrModal = closeQrModal;
window.renderEcoPointsPageWrapper = renderEcoPointsPage;
