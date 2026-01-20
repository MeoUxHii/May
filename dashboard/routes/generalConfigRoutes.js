// dashboard/routes/generalConfigRoutes.js
const express = require('express');
const router = express.Router();

// 1. Import Config
const { 
    GAME_CONFIG, SHOP_ITEMS, CURRENCY, HUNT_CONFIG,
    GEM_RATES, GEM_RATES_VIP, GEM_RATES_CRATE, GEM_RATES_CRATE_L, GEM_PRICE_RANGES 
} = require('../../config');

// 2. Import Economy
const economy = require('../../utils/economy'); 

const gemMarket = require('../../utils/gem_market');
const { GemHistory, MarketHistory } = require('../../database/models'); 
const { getWordChainConfig, updateWordChainConfig, addContributeWords } = require('../../games/wordchain');
const { getBaseHtml } = require('../utils/viewHelper');
const { requireLogin } = require('../middleware/authMiddleware');

// Đảm bảo cấu trúc Battle tồn tại
if (!GAME_CONFIG.battle) {
    GAME_CONFIG.battle = {
        cooldown: 10,
        tier1: { min: 1000, max: 2000, exp: 50 },
        tier2: { min: 2000, max: 4000, exp: 100 },
        tier3: { min: 4000, max: 6000, exp: 150 }
    };
}

// Helper: Lấy đường dẫn ảnh từ local folder
const getLocalImgUrl = (itemId) => {
    // Danh sách các item là ảnh động (GIF)
    const gifItems = ['gem6', 'gem6a', 'gem7', 'gem7a', 'lootboxvip', 'crateL'];
    const ext = gifItems.includes(itemId) ? 'gif' : 'png';
    return `/pictures/${itemId}.${ext}`;
};

module.exports = (client) => {

    // =========================================================
    // 1. GIAO DIỆN CẤU HÌNH GAME
    // =========================================================
    router.get('/game-config', requireLogin, (req, res) => {
        const successAlert = req.query.success ? `
            <div class="alert alert-success alert-dismissible fade show border-0 shadow-sm mb-4" role="alert" style="background: #059669; color: white;">
                <i class="fas fa-check-circle me-2"></i> <strong>Thành công!</strong> Cấu hình hệ thống đã được cập nhật.
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        ` : '';

        const body = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="fw-bold"><i class="fas fa-cogs me-2"></i> Global Game Settings</h3>
                <span class="badge bg-danger">Master Admin Mode</span>
            </div>
            
            ${successAlert}

            <form action="/api/global/update-game-config" method="POST">
                <div class="row g-4">
                    <!-- ĐÁ GÀ -->
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 shadow-sm border-warning" style="border-top-width: 5px;">
                            <div class="card-header bg-transparent fw-bold text-warning"><i class="fas fa-feather-alt me-2"></i> Đá Gà</div>
                            <div class="card-body">
                                <label class="small text-muted fw-bold">Max Bet</label>
                                <input type="number" name="maxBetDaGa" class="form-control mb-3" value="${GAME_CONFIG.maxBetDaGa}">
                                <div class="row">
                                    <div class="col-6">
                                        <label class="small text-muted fw-bold">WinRate Base</label>
                                        <input type="number" step="0.01" name="winRateDaGaBase" class="form-control" value="${GAME_CONFIG.winRateDaGaBase}">
                                    </div>
                                    <div class="col-6">
                                        <label class="small text-muted fw-bold">WinRate Max</label>
                                        <input type="number" step="0.01" name="winRateDaGaMax" class="form-control" value="${GAME_CONFIG.winRateDaGaMax}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- BẦU CUA -->
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 shadow-sm border-danger" style="border-top-width: 5px;">
                            <div class="card-header bg-transparent fw-bold text-danger"><i class="fas fa-dice me-2"></i> Bầu Cua</div>
                            <div class="card-body">
                                <label class="small text-muted fw-bold">Max Bet</label>
                                <input type="number" name="maxBetBauCua" class="form-control mb-3" value="${GAME_CONFIG.maxBetBauCua}">
                                <label class="small text-muted fw-bold">Thời gian chờ (s)</label>
                                <input type="number" name="bauCuaTime" class="form-control" value="${GAME_CONFIG.bauCuaTime || 30}">
                            </div>
                        </div>
                    </div>

                    <!-- CASINO KHÁC -->
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 shadow-sm border-success" style="border-top-width: 5px;">
                            <div class="card-header bg-transparent fw-bold text-success"><i class="fas fa-cards me-2"></i> Casino Khác</div>
                            <div class="card-body">
                                <label class="small text-muted fw-bold">Max Bet Xì Dách</label>
                                <input type="number" name="maxBetXiDach" class="form-control mb-3" value="${GAME_CONFIG.maxBetXiDach}">
                                <label class="small text-muted fw-bold">Max Bet Roulette</label>
                                <input type="number" name="maxBetRoulette" class="form-control" value="${GAME_CONFIG.maxBetRoulette}">
                            </div>
                        </div>
                    </div>

                    <!-- HUNT SYSTEM -->
                    <div class="col-md-12 col-lg-4">
                        <div class="card h-100 shadow-sm border-info" style="border-top-width: 5px;">
                            <div class="card-header bg-transparent fw-bold text-info"><i class="fas fa-crosshairs me-2"></i> Hunt System</div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="small text-muted fw-bold">Hồi chiêu (s)</label>
                                    <input type="number" name="hunt_cd" class="form-control" value="${HUNT_CONFIG.COOLDOWN}">
                                </div>
                                <div>
                                    <label class="small text-muted fw-bold">Giá vé lượt săn</label>
                                    <input type="number" name="hunt_price" class="form-control" value="${HUNT_CONFIG.PRICE}">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- BATTLE SYSTEM -->
                    <div class="col-md-12 col-lg-8">
                        <div class="card shadow-sm border-primary" style="border-top-width: 5px;">
                            <div class="card-header bg-transparent fw-bold text-primary"><i class="fas fa-khanda me-2"></i> Battle System</div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-4"><label class="small text-muted fw-bold">Hồi chiêu trận đấu (s)</label><input type="number" name="battle_cd" class="form-control" value="${GAME_CONFIG.battle.cooldown}"></div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-dark table-sm table-bordered text-center small align-middle mb-0">
                                        <thead>
                                            <tr><th>Mốc Level</th><th>Tiền Thắng (Min)</th><th>Tiền Thắng (Max)</th><th>EXP Thắng</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>Dưới 30</td>
                                                <td><input type="number" name="bt1_min" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier1.min}"></td>
                                                <td><input type="number" name="bt1_max" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier1.max}"></td>
                                                <td><input type="number" name="bt1_exp" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier1.exp}"></td>
                                            </tr>
                                            <tr><td>30 - 50</td>
                                                <td><input type="number" name="bt2_min" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier2.min}"></td>
                                                <td><input type="number" name="bt2_max" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier2.max}"></td>
                                                <td><input type="number" name="bt2_exp" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier2.exp}"></td>
                                            </tr>
                                            <tr><td>Trên 50</td>
                                                <td><input type="number" name="bt3_min" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier3.min}"></td>
                                                <td><input type="number" name="bt3_max" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier3.max}"></td>
                                                <td><input type="number" name="bt3_exp" class="form-control form-control-sm text-center" value="${GAME_CONFIG.battle.tier3.exp}"></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sticky-bottom bg-dark p-3 text-end mt-4 border-top border-secondary mx-n4">
                    <button type="submit" class="btn btn-success btn-lg px-5 shadow"><i class="fas fa-save me-2"></i> LƯU TẤT CẢ CẤU HÌNH</button>
                </div>
            </form>
        `;
        res.send(getBaseHtml('Game Config', body, 'game', req.session.user));
    });

    router.post('/api/global/update-game-config', requireLogin, (req, res) => {
        const d = req.body;
        try {
            GAME_CONFIG.maxBetDaGa = parseInt(d.maxBetDaGa);
            GAME_CONFIG.maxBetBauCua = parseInt(d.maxBetBauCua);
            GAME_CONFIG.maxBetXiDach = parseInt(d.maxBetXiDach);
            GAME_CONFIG.maxBetRoulette = parseInt(d.maxBetRoulette);
            GAME_CONFIG.bauCuaTime = parseInt(d.bauCuaTime);
            GAME_CONFIG.winRateDaGaBase = parseFloat(d.winRateDaGaBase);
            GAME_CONFIG.winRateDaGaMax = parseFloat(d.winRateDaGaMax);
            HUNT_CONFIG.COOLDOWN = parseInt(d.hunt_cd);
            HUNT_CONFIG.PRICE = parseInt(d.hunt_price);
            GAME_CONFIG.battle = {
                cooldown: parseInt(d.battle_cd),
                tier1: { min: parseInt(d.bt1_min), max: parseInt(d.bt1_max), exp: parseInt(d.bt1_exp) },
                tier2: { min: parseInt(d.bt2_min), max: parseInt(d.bt2_max), exp: parseInt(d.bt2_exp) },
                tier3: { min: parseInt(d.bt3_min), max: parseInt(d.bt3_max), exp: parseInt(d.bt3_exp) }
            };
            res.redirect('/game-config?success=1');
        } catch (e) {
            console.error(e);
            res.redirect('/game-config');
        }
    });

    // =========================================================
    // 2. SHOP ITEMS CONFIG (HÌNH ẢNH LOCAL)
    // =========================================================
    router.get('/shop-config/items', requireLogin, (req, res) => {
        let itemsHtml = '';
        for (const key in SHOP_ITEMS) {
            if (!key.startsWith('gem')) {
                const item = SHOP_ITEMS[key];
                const imgUrl = getLocalImgUrl(item.id);
                
                itemsHtml += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 border-secondary bg-dark text-white">
                            <div class="card-body">
                                <div class="d-flex align-items-center mb-3">
                                    <img src="${imgUrl}" class="me-3 rounded bg-secondary p-1" width="48" height="48" style="object-fit: contain;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                    <div>
                                        <div class="fw-bold text-warning">${item.name}</div>
                                        <div class="small text-white-50">ID: ${item.id}</div>
                                    </div>
                                </div>
                                <div class="row g-2">
                                    <div class="col-6">
                                        <label class="small text-muted">Giá bán</label>
                                        <input type="number" name="price_${key}" class="form-control form-control-sm" value="${item.price}">
                                    </div>
                                    <div class="col-6">
                                        <label class="small text-muted">Tồn kho</label>
                                        <input type="number" name="stock_${key}" class="form-control form-control-sm" value="${item.stock}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
        }

        const body = `
            <h3 class="mb-4 fw-bold"><i class="fas fa-store me-2"></i> Shop Items Configuration</h3>
            <form action="/api/update/shop-form" method="POST">
                <input type="hidden" name="redirect_to" value="/shop-config/items">
                <div class="row g-3 mb-4">${itemsHtml}</div>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save me-2"></i> Cập Nhật Shop</button>
            </form>
        `;
        res.send(getBaseHtml('Shop Items', body, 'shop-items', req.session.user));
    });

    router.post('/api/update/shop-form', requireLogin, (req, res) => {
        for (const key in req.body) {
            if(key === 'redirect_to') continue;
            const [field, id] = key.split('_'); 
            if (SHOP_ITEMS[id]) SHOP_ITEMS[id][field] = parseFloat(req.body[key]);
        }
        res.redirect(req.body.redirect_to || '/shop-config/items');
    });

    // =========================================================
    // 3. GEM MARKET & HISTORY (REALTIME STOCK)
    // =========================================================
    router.get('/shop-config/gems', requireLogin, async (req, res) => {
        const gemPriceData = gemMarket.currentMarketPrices || await gemMarket.updateMarketPrices();
        let gemsHtml = '';
        const gemKeys = Object.keys(SHOP_ITEMS).filter(k => k.startsWith('gem')).sort().reverse();

        for (const key of gemKeys) {
            const item = SHOP_ITEMS[key];
            const marketData = gemPriceData[key] || { price: 0, trend: 'stable' };
            const totalInServer = await economy.countItemInServer(key);
            const imgUrl = getLocalImgUrl(key);
            
            let trendHtml = '<span class="badge bg-secondary">Stable</span>';
            if (marketData.trend === 'up') trendHtml = '<span class="badge bg-success"><i class="fas fa-arrow-up"></i> Tăng</span>';
            if (marketData.trend === 'down') trendHtml = '<span class="badge bg-danger"><i class="fas fa-arrow-down"></i> Giảm</span>';

            let actionBtn = '';
            if (['gem6', 'gem7', 'gem6a', 'gem7a'].includes(key)) {
                actionBtn = `<a href="/shop-config/gem-history/${key}" class="btn btn-sm btn-info w-100 mt-2"><i class="fas fa-history"></i> Lịch sử</a>`;
            } else {
                 actionBtn = `<a href="/shop-config/gem-history/${key}" class="btn btn-sm btn-secondary w-100 mt-2"><i class="fas fa-history"></i> Lịch sử</a>`;
            }

            gemsHtml += `
                <tr>
                    <td><div class="d-flex align-items-center"><img src="${imgUrl}" width="40" height="40" class="me-2 rounded bg-dark p-1"><div><div class="fw-bold text-warning">${item.name}</div><div class="small text-muted">${key}</div></div></div></td>
                    <td><div class="fw-bold">${marketData.price.toLocaleString()} ${CURRENCY}</div>${trendHtml}</td>
                    <td><div class="fs-5 fw-bold text-info">${totalInServer.toLocaleString()}</div></td>
                    <td width="120">${actionBtn}</td>
                </tr>`;
        }

        const body = `
            <div class="d-flex justify-content-between mb-4"><h3 class="fw-bold"><i class="fas fa-gem me-2"></i> Thị Trường Đá Quý</h3><a href="/shop-config/reroll" class="btn btn-warning">Reroll Giá</a></div>
            <div class="card border-0 shadow-sm"><div class="card-body p-0"><table class="table table-hover align-middle mb-0"><thead class="bg-dark text-white"><tr><th class="ps-4">Ngọc</th><th>Giá</th><th>Tổng Toàn Cầu</th><th>Thao Tác</th></tr></thead><tbody>${gemsHtml}</tbody></table></div></div>
        `;
        res.send(getBaseHtml('Gem Market', body, 'shop-gems', req.session.user));
    });

    router.get('/shop-config/reroll', requireLogin, async (req, res) => { await gemMarket.updateMarketPrices(); res.redirect('/shop-config/gems'); });

    router.get('/shop-config/gem-history/:id', requireLogin, async (req, res) => {
        const gemId = req.params.id;
        const item = SHOP_ITEMS[gemId];
        if (!item) return res.redirect('/shop-config/gems');
        
        const history = await GemHistory.find({ item_id: gemId }).sort({ time: -1 }).limit(50);
        let rows = history.length === 0 ? '<tr><td colspan="3" class="text-center py-4">Chưa có ai mở được.</td></tr>' : '';
        
        for (const r of history) {
            let name = await economy.getCachedUsername(r.user_id, client);
            rows += `<tr><td class="ps-4">${name}</td><td>${new Date(r.time).toLocaleString('vi-VN')}</td><td><span class="badge bg-success">Success</span></td></tr>`;
        }
        
        const body = `
            <div class="mb-4"><a href="/shop-config/gems" class="btn btn-secondary btn-sm mb-3">Back</a><h3 class="fw-bold text-warning">Lịch sử mở được: ${item.name}</h3></div>
            <div class="card shadow-sm border-0"><div class="card-body p-0"><table class="table table-hover mb-0"><thead><tr><th class="ps-4">Người mở</th><th>Thời gian</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        `;
        res.send(getBaseHtml(`History ${item.name}`, body, 'shop-gems', req.session.user));
    });

    // =========================================================
    // 4. GEM RATES & CONFIG (SỬ DỤNG ẢNH LOCAL & LAYOUT 4 CỘT)
    // =========================================================
    router.get('/shop-config/rates', requireLogin, (req, res) => {
        
        const createRateTable = (title, rates, prefix) => {
            let rows = rates.map(r => {
                const item = SHOP_ITEMS[r.id];
                const imgUrl = getLocalImgUrl(item.id);

                return `
                    <tr>
                        <td class="d-flex align-items-center gap-2">
                            <img src="${imgUrl}" width="32" height="32" style="object-fit: contain;"> 
                            <span class="text-warning small">${item.name}</span>
                        </td>
                        <td>
                            <div class="input-group input-group-sm">
                                <input type="number" step="0.01" name="${prefix}_${r.id}" value="${r.rate}" class="form-control text-center bg-dark text-white border-secondary">
                                <span class="input-group-text bg-secondary border-secondary text-white small">%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // UPDATE LAYOUT: col-12 col-md-6 col-xl-3 (4 cột trên màn hình lớn)
            return `
                <div class="col-12 col-md-6 col-xl-3 mb-4">
                    <div class="card h-100 border-secondary">
                        <div class="card-header bg-dark border-secondary text-info fw-bold text-uppercase text-center small">
                            ${title}
                        </div>
                        <div class="card-body p-0">
                            <table class="table table-dark table-hover mb-0 align-middle small">
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        };

        let priceRows = Object.entries(GEM_PRICE_RANGES).map(([id, range]) => {
            const item = SHOP_ITEMS[id];
            const isCrate = id.includes('a'); 
            const colorClass = isCrate ? 'text-info' : 'text-warning';
            const imgUrl = getLocalImgUrl(item.id);
            
            return `
                <tr>
                    <td class="ps-3 d-flex align-items-center gap-2">
                        <img src="${imgUrl}" width="32" height="32" style="object-fit: contain;">
                        <span class="${colorClass} fw-bold">${item.name}</span>
                    </td>
                    <td>
                        <input type="number" name="min_${id}" value="${range.min}" class="form-control form-control-sm bg-dark text-white border-secondary text-center" style="max-width: 120px; margin: 0 auto;">
                    </td>
                    <td>
                        <input type="number" name="max_${id}" value="${range.max}" class="form-control form-control-sm bg-dark text-white border-secondary text-center" style="max-width: 120px; margin: 0 auto;">
                    </td>
                </tr>
            `;
        }).join('');

        const body = `
            <h3 class="mb-4 fw-bold"><i class="fas fa-sliders-h me-2"></i> Gem Configuration</h3>
            
            <form action="/api/update/gem-config" method="POST">
                
                <h5 class="text-white-50 border-bottom border-secondary pb-2 mb-3"><i class="fas fa-percentage me-2"></i> Tỉ lệ mở hòm</h5>
                <div class="row">
                    ${createRateTable('<i class="fas fa-box me-2"></i> Lootbox', GEM_RATES, 'rate')}
                    ${createRateTable('<i class="fas fa-gem me-2"></i> VIP', GEM_RATES_VIP, 'ratevip')}
                    ${createRateTable('<i class="fas fa-archive me-2"></i> Crate', GEM_RATES_CRATE, 'ratecrate')}
                    ${createRateTable('<i class="fas fa-star me-2"></i> Legend', GEM_RATES_CRATE_L, 'ratecratel')}
                </div>

                <h5 class="text-white-50 border-bottom border-secondary pb-2 mb-3 mt-2"><i class="fas fa-tag me-2"></i> Khoảng giá thị trường (Min - Max)</h5>
                <div class="card border-secondary mb-4">
                    <div class="card-body p-0">
                        <table class="table table-dark table-hover mb-0 align-middle">
                            <thead>
                                <tr class="text-muted small text-uppercase">
                                    <th class="ps-3">Loại Ngọc</th>
                                    <th class="text-center">Giá Min</th>
                                    <th class="text-center">Giá Max</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${priceRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="sticky-bottom bg-dark p-3 text-end mt-4 border-top border-secondary mx-n4">
                    <button type="submit" class="btn btn-success btn-lg px-5 shadow"><i class="fas fa-save me-2"></i> LƯU CẤU HÌNH GEM</button>
                </div>
            </form>
        `;
        res.send(getBaseHtml('Gem Config', body, 'gem-rates', req.session.user));
    });

    router.post('/api/update/gem-config', requireLogin, (req, res) => {
        const body = req.body;

        const updateRateArray = (targetArray, prefix) => {
            targetArray.forEach(item => {
                const key = `${prefix}_${item.id}`;
                if (body[key] !== undefined) {
                    item.rate = parseFloat(body[key]);
                }
            });
        };

        updateRateArray(GEM_RATES, 'rate');
        updateRateArray(GEM_RATES_VIP, 'ratevip');
        updateRateArray(GEM_RATES_CRATE, 'ratecrate');
        updateRateArray(GEM_RATES_CRATE_L, 'ratecratel');

        for (const [id, range] of Object.entries(GEM_PRICE_RANGES)) {
            const minKey = `min_${id}`;
            const maxKey = `max_${id}`;
            
            if (body[minKey] !== undefined) range.min = parseInt(body[minKey]);
            if (body[maxKey] !== undefined) range.max = parseInt(body[maxKey]);
        }

        res.redirect('/shop-config/rates?success=1');
    });

    // =========================================================
    // 5. WORDCHAIN
    // =========================================================
    router.get('/settings/wordchain', requireLogin, (req, res) => {
        const wc = getWordChainConfig();
        const body = `
            <h3 class="mb-4 fw-bold">🔗 Cấu hình Nối Từ</h3>
            <div class="row">
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-dark text-warning"><i class="fas fa-coins me-2"></i> Thiết lập Thưởng</div>
                        <div class="card-body">
                            <form action="/api/global/update-wordchain" method="POST">
                                <div class="mb-3"><label class="form-label">Lương cứng (Khi thắng)</label><input type="number" name="REWARD_BASE" class="form-control" value="${wc.REWARD_BASE}"></div>
                                <div class="mb-3"><label class="form-label">Lương từng từ</label><input type="number" name="REWARD_PER_WORD" class="form-control" value="${wc.REWARD_PER_WORD}"></div>
                                <div class="mb-3"><label class="form-label">Giới hạn thưởng tối đa</label><input type="number" name="REWARD_MAX" class="form-control" value="${wc.REWARD_MAX}"></div>
                                <div class="mb-3"><label class="form-label">Cooldown lặp từ (lượt)</label><input type="number" name="COOLDOWN_TURNS" class="form-control" value="${wc.COOLDOWN_TURNS}"></div>
                                <div class="text-end"><button class="btn btn-warning">Lưu Cấu Hình</button></div>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-dark text-success"><i class="fas fa-plus-circle me-2"></i> Đóng góp từ vựng</div>
                        <div class="card-body">
                            <form action="/api/global/add-words" method="POST">
                                <div class="mb-3"><label class="form-label">Nhập từ mới (1 từ/dòng)</label><textarea name="words" class="form-control font-monospace" rows="10"></textarea></div>
                                <div class="text-end"><button class="btn btn-success">Thêm Từ</button></div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        res.send(getBaseHtml('WordChain', body, 'wordchain', req.session.user));
    });

    router.post('/api/global/update-wordchain', requireLogin, (req, res) => {
        updateWordChainConfig({
            REWARD_BASE: parseInt(req.body.REWARD_BASE),
            REWARD_PER_WORD: parseInt(req.body.REWARD_PER_WORD),
            REWARD_MAX: parseInt(req.body.REWARD_MAX),
            COOLDOWN_TURNS: parseInt(req.body.COOLDOWN_TURNS)
        });
        res.redirect('/settings/wordchain');
    });

    router.post('/api/global/add-words', requireLogin, async (req, res) => {
        const rawText = req.body.words || '';
        await addContributeWords(rawText.split(/\r?\n/));
        res.redirect('/settings/wordchain');
    });

    return router;
};