// dashboard/routes/homeRoutes.js
const express = require('express');
const router = express.Router();
const { EmbedBuilder } = require('discord.js');
const economy = require('../../utils/economy');
const { getBaseHtml } = require('../utils/viewHelper');
const { requireLogin } = require('../middleware/authMiddleware');

module.exports = (client) => {
    router.get('/', requireLogin, async (req, res) => {
        try {
            // 1. TÍNH TOÁN DỮ LIỆU (Logic này bắt buộc phải có để HTML hiển thị)
            const allUsers = await economy.getAllUsers(); // Lấy list user từ DB
            const totalUsers = allUsers.length;
            const totalMoney = allUsers.reduce((sum, u) => sum + (u.total || 0), 0); // Cộng tổng tiền
            
            // Tính tổng member của tất cả server bot đang ở
            const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

            // 2. GIAO DIỆN HTML (Đã nâng cấp)
            const body = `
            <div class="row g-4 mb-5">
                <!-- CARD: ACTIVE USERS -->
                <div class="col-md-3">
                    <div class="card border-0 h-100" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h6 class="text-uppercase text-muted fw-bold small">Active Users</h6>
                                    <h2 class="fw-bold text-white mb-0">${totalUsers.toLocaleString()}</h2>
                                </div>
                                <div class="rounded-3 p-2" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">
                                    <i class="fas fa-users fa-lg"></i>
                                </div>
                            </div>
                            <div class="small text-success"><i class="fas fa-check-circle me-1"></i> Database Loaded</div>
                        </div>
                    </div>
                </div>
                
                <!-- CARD: ECONOMY -->
                <div class="col-md-3">
                    <div class="card border-0 h-100" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(45, 212, 191, 0.1) 100%);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h6 class="text-uppercase text-muted fw-bold small">Economy</h6>
                                    <h2 class="fw-bold text-white mb-0">${(totalMoney / 1000000).toFixed(2)}M</h2>
                                </div>
                                <div class="rounded-3 p-2" style="background: rgba(45, 212, 191, 0.2); color: #2dd4bf;">
                                    <i class="fas fa-coins fa-lg"></i>
                                </div>
                            </div>
                             <div class="small text-muted">Total Server Assets</div>
                        </div>
                    </div>
                </div>

                <!-- CARD: SERVERS -->
                <div class="col-md-3">
                    <div class="card border-0 h-100" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h6 class="text-uppercase text-muted fw-bold small">Servers</h6>
                                    <h2 class="fw-bold text-white mb-0">${client.guilds.cache.size}</h2>
                                </div>
                                <div class="rounded-3 p-2" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">
                                    <i class="fas fa-server fa-lg"></i>
                                </div>
                            </div>
                            <div class="small text-muted">Tracking ${totalMembers.toLocaleString()} members</div>
                        </div>
                    </div>
                </div>

                <!-- CARD: VERSION -->
                <div class="col-md-3">
                    <div class="card border-0 h-100" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h6 class="text-uppercase text-muted fw-bold small">System Status</h6>
                                    <h2 class="fw-bold text-white mb-0">Online</h2>
                                </div>
                                <div class="rounded-3 p-2" style="background: rgba(244, 63, 94, 0.2); color: #fb7185;">
                                    <i class="fas fa-heartbeat fa-lg"></i>
                                </div>
                            </div>
                            <div class="small text-success">Ping: ${client.ws.ping}ms</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <!-- GỬI THÔNG BÁO -->
                <div class="col-lg-7">
                    <div class="card h-100">
                        <div class="card-header"><i class="fas fa-bullhorn me-2"></i> Gửi Thông Báo Hệ Thống</div>
                        <div class="card-body">
                            <form action="/api/global/send-notif" method="POST">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-bold text-uppercase">Phạm vi gửi</label>
                                    <select name="scope" id="scope" class="form-select" onchange="toggleScope()">
                                        <option value="all">🚀 Toàn bộ Server (Bot Status)</option>
                                        <option value="specific">🎯 Server chỉ định</option>
                                    </select>
                                </div>
                                <div id="specific-box" class="d-none p-3 rounded mb-3" style="background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.1);">
                                    <div class="mb-2">
                                        <label class="small text-muted">Chọn Server</label>
                                        <select name="guildId" id="guildSelect" class="form-select" onchange="loadChannels()">
                                            <option value="">-- Chọn Server --</option>
                                            ${client.guilds.cache.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="small text-muted">Chọn Kênh</label>
                                        <select name="channelId" id="channelSelect" class="form-select"></select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-bold text-uppercase">Nội dung</label>
                                    <textarea name="message" class="form-control" rows="5" placeholder="Nhập nội dung thông báo Markdown..." required></textarea>
                                </div>
                                <button class="btn btn-primary w-100"><i class="fas fa-paper-plane me-2"></i> Gửi Thông Báo Ngay</button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- PHÁT QUÀ GLOBAL -->
                <div class="col-lg-5">
                    <div class="card h-100">
                        <div class="card-header text-danger"><i class="fas fa-gift me-2"></i> Global Airdrop (Admin Only)</div>
                        <div class="card-body">
                            <div class="alert alert-warning border-0" style="background: rgba(245, 158, 11, 0.1); color: #fbbf24; font-size: 0.9rem;">
                                <i class="fas fa-exclamation-triangle me-2"></i> Chức năng này sẽ cộng vật phẩm cho <strong>TẤT CẢ</strong> user trong database. Cẩn thận!
                            </div>
                            <form action="/api/global/give-all" method="POST">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-bold text-uppercase">Loại vật phẩm</label>
                                    <select name="item" class="form-select">
                                        <option value="money">Tiền🪙</option>
                                        <option value="lootbox">📦 Lootbox Thường</option>
                                        <option value="lootboxvip">🎁 Lootbox VIP</option>
                                        <option value="crate">🗝️ Normal Crate</option>
                                        <option value="crateL">🗝️ Legend Crate</option>
                                    </select>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-bold text-uppercase">Số lượng</label>
                                    <input type="number" name="amount" class="form-control" value="1000" min="1">
                                </div>
                                <button class="btn btn-danger w-100" onclick="return confirm('Hành động này KHÔNG THỂ hoàn tác. Bạn chắc chứ?')">
                                    <i class="fas fa-meteor me-2"></i> Kích Hoạt Airdrop
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                function toggleScope() {
                    const isSpecific = document.getElementById('scope').value === 'specific';
                    document.getElementById('specific-box').classList.toggle('d-none', !isSpecific);
                }
                async function loadChannels() {
                    const gId = document.getElementById('guildSelect').value;
                    const cSelect = document.getElementById('channelSelect');
                    if(!gId) return;
                    cSelect.innerHTML = '<option>Đang tải kênh...</option>';
                    const res = await fetch('/api/guild-channels/' + gId);
                    const channels = await res.json();
                    cSelect.innerHTML = channels.map(c => \`<option value="\${c.id}"># \${c.name}</option>\`).join('');
                }
            </script>
            `;

            res.send(getBaseHtml('Master Dashboard', body, 'home', req.session.user));
        } catch (error) {
            console.error(error);
            res.send(`<h1>Lỗi Server: ${error.message}</h1><pre>${error.stack}</pre>`);
        }
    });

    // API SEND NOTIF
    router.post('/api/global/send-notif', requireLogin, async (req, res) => {
        const { scope, guildId, channelId, message } = req.body;
        const embed = new EmbedBuilder().setTitle("📢 THÔNG BÁO TỪ HỆ THỐNG").setDescription(message).setColor('Gold').setTimestamp();

        try {
            if (scope === 'all') {
                // Logic tìm kênh text đầu tiên để gửi
                for (const guild of client.guilds.cache.values()) {
                    const channel = guild.channels.cache.filter(c => c.type === 0 && c.permissionsFor(client.user).has('SendMessages')).first();
                    if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
                }
            } else {
                const channel = await client.channels.fetch(channelId);
                if (channel) await channel.send({ embeds: [embed] });
            }
        } catch (e) { console.error(e); }
        res.redirect('/');
    });

    // API GIVE ALL
    router.post('/api/global/give-all', requireLogin, async (req, res) => {
        try {
            const { item, amount } = req.body;
            const val = parseInt(amount);
            const users = await economy.getAllUsers();
            for(let u of users) {
                if(item === 'money') await economy.updateBalance(u.user_id, val, 'bank', 'add');
                else await economy.addItem(u.user_id, item, val);
            }
        } catch (e) { console.error(e); }
        res.redirect('/');
    });

    // API FETCH CHANNELS
    router.get('/api/guild-channels/:guildId', requireLogin, (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.json([]);
        const channels = guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }));
        res.json(channels);
    });

    return router;
};