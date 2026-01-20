// dashboard/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const economy = require('../../utils/economy');
const { getBaseHtml } = require('../utils/viewHelper');
const { requireLogin } = require('../middleware/authMiddleware'); 

module.exports = (client) => {
    
    // 1. TRANG QUẢN LÝ USER (GLOBAL)
    router.get('/users', requireLogin, async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const searchId = req.query.search || '';
        const limit = 20;
        const offset = (page - 1) * limit;

        // Lấy tất cả user từ RAM
        let allUsers = await economy.getAllUsers();

        // Lọc nếu có tìm kiếm
        if (searchId) {
            allUsers = allUsers.filter(u => u.user_id.includes(searchId) || (u.display_name && u.display_name.toLowerCase().includes(searchId.toLowerCase())));
        }

        // Sắp xếp theo tổng tài sản giảm dần
        allUsers.sort((a, b) => b.total - a.total);

        // Phân trang
        const usersPage = allUsers.slice(offset, offset + limit);
        const totalPages = Math.ceil(allUsers.length / limit);

        // --- XỬ LÝ HIỂN THỊ THÔNG MINH (Smart Fetch) ---
        const rowsHtml = await Promise.all(usersPage.map(async (u, index) => {
            let displayName = u.display_name || u.username;
            let avatarUrl = u.avatar ? `https://cdn.discordapp.com/avatars/${u.user_id}/${u.avatar}.png` : null;

            // NẾU CHƯA CÓ TÊN -> GỌI DISCORD LẤY NGAY LẬP TỨC
            if (!displayName || displayName === 'Unknown' || displayName === 'Unknown (Wait update)') {
                try {
                    const discordUser = await client.users.fetch(u.user_id);
                    // Cập nhật ngay vào biến hiển thị
                    displayName = discordUser.globalName || discordUser.username;
                    avatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 64 });
                    
                    // Lưu ngược lại vào Database để lần sau load nhanh
                    economy.updateUserDiscordInfo(u.user_id, discordUser);
                } catch (e) {
                    displayName = `User ${u.user_id}`; // User đã xóa acc hoặc không tìm thấy
                    avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
                }
            } else if (!avatarUrl) {
                 avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
            }

            return `
            <tr>
                <td class="ps-4"><span class="badge bg-secondary">#${offset + index + 1}</span></td>
                <td class="font-monospace text-muted small">${u.user_id}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${avatarUrl}" class="rounded-circle me-2 border border-secondary" width="36" height="36" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        <div class="fw-bold text-info text-truncate" style="max-width: 180px;">${displayName}</div>
                    </div>
                </td>
                <form action="/users/update" method="POST">
                    <input type="hidden" name="user_id" value="${u.user_id}">
                    <td>
                        <input type="number" name="cash" value="${u.cash}" class="form-control form-control-sm bg-dark text-white border-secondary" style="width: 120px;">
                    </td>
                    <td>
                        <input type="number" name="bank" value="${u.bank}" class="form-control form-control-sm bg-dark text-white border-secondary" style="width: 120px;">
                    </td>
                    <td class="fw-bold text-success">${u.total.toLocaleString()} 🪙</td>
                    <td class="text-end pe-4">
                        <button type="submit" class="btn btn-sm btn-success"><i class="fas fa-save"></i></button>
                        <a href="/users/delete/${u.user_id}" class="btn btn-sm btn-outline-danger" onclick="return confirm('Reset tiền user này về 0?')"><i class="fas fa-trash"></i></a>
                    </td>
                </form>
            </tr>
            `;
        }));

        // Render HTML
        const body = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="fw-bold"><i class="fas fa-users-cog me-2"></i> Global User Manager</h3>
                <form class="d-flex gap-2" method="GET" action="/users">
                    <input class="form-control bg-dark text-white border-secondary" type="search" name="search" placeholder="Nhập ID hoặc Tên..." value="${searchId}">
                    <button class="btn btn-primary" type="submit">Tìm</button>
                </form>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 text-nowrap">
                            <thead class="bg-dark text-white">
                                <tr>
                                    <th class="ps-4">Rank</th>
                                    <th>ID</th>
                                    <th>User</th>
                                    <th>Cash</th>
                                    <th>Bank</th>
                                    <th>Tổng tài sản</th>
                                    <th class="text-end pe-4">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml.join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Pagination -->
                <div class="card-footer bg-dark border-top border-secondary d-flex justify-content-between align-items-center">
                    <div>
                        <span class="text-muted small">Hiển thị ${usersPage.length} / ${allUsers.length} users</span>
                    </div>
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item ${page <= 1 ? 'disabled' : ''}">
                                <a class="page-link bg-dark border-secondary text-white" href="/users?page=${page - 1}&search=${searchId}">Trước</a>
                            </li>
                            <li class="page-item disabled">
                                <span class="page-link bg-dark border-secondary text-white">Trang ${page} / ${totalPages || 1}</span>
                            </li>
                            <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
                                <a class="page-link bg-dark border-secondary text-white" href="/users?page=${page + 1}&search=${searchId}">Sau</a>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        `;
        
        res.send(getBaseHtml('User Manager', body, 'users', req.session.user));
    });

    // API CẬP NHẬT TIỀN
    router.post('/users/update', requireLogin, async (req, res) => {
        const { user_id, cash, bank } = req.body;
        await economy.updateBalance(user_id, parseInt(cash), 'cash', 'set');
        await economy.updateBalance(user_id, parseInt(bank), 'bank', 'set');
        const referrer = req.get('Referrer') || '/users';
        res.redirect(referrer);
    });

    // API XÓA USER (RESET)
    router.get('/users/delete/:id', requireLogin, async (req, res) => {
        const userId = req.params.id;
        await economy.updateBalance(userId, 0, 'cash', 'set');
        await economy.updateBalance(userId, 0, 'bank', 'set');
        res.redirect('/users');
    });

    return router;
};