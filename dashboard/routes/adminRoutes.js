// dashboard/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const economy = require('../../utils/economy');
const { getBaseHtml } = require('../utils/viewHelper');
const { requireGuildSelection } = require('../middleware/authMiddleware');

module.exports = (client) => {
    router.get('/admins', requireGuildSelection, async (req, res) => {
        const guildId = req.session.guildId;
        const config = await economy.getConfig(guildId);
        const guild = client.guilds.cache.get(guildId);
        
        let adminRolesHtml = '';
        if (config.admin_roles && config.admin_roles.length > 0) {
            if (guild) {
                // --- TỐI ƯU HÓA: Chỉ fetch nếu cache rỗng ---
                if (guild.roles.cache.size === 0) {
                    try { await guild.roles.fetch(); } catch (e) {}
                }
                // --------------------------------------------

                adminRolesHtml = config.admin_roles.map(roleId => {
                    const role = guild.roles.cache.get(roleId);
                    const roleName = role ? role.name : `Unknown Role (${roleId})`;
                    const roleColor = role ? role.hexColor : '#99aab5';
                    
                    return `
                        <tr>
                            <td>
                                <span class="badge" style="background-color: ${roleColor}">${roleName}</span>
                                <span class="text-muted small ms-2">${roleId}</span>
                            </td>
                            <td class="text-end">
                                <form action="/admins/remove" method="POST" style="display:inline;">
                                    <input type="hidden" name="role_id" value="${roleId}">
                                    <button class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i> Xóa quyền</button>
                                </form>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                 adminRolesHtml = '<tr><td colspan="2" class="text-danger">Không thể tải thông tin server Discord.</td></tr>';
            }
        } else {
            adminRolesHtml = '<tr><td colspan="2" class="text-center text-muted">Chưa có Role nào được cấp quyền Admin (Ngoài Owner).</td></tr>';
        }

        const body = `
            <h3 class="mb-4 fw-bold">🛡️ Quản lý Quyền Admin</h3>
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">Danh sách Role Admin</div>
                        <div class="card-body p-0">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th class="ps-4">Role</th>
                                        <th class="text-end pe-4">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${adminRolesHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-success text-white"><i class="fas fa-plus-circle me-2"></i> Thêm Role Admin</div>
                        <div class="card-body">
                            <form action="/admins/add" method="POST">
                                <div class="mb-3">
                                    <label class="form-label">Role ID Discord</label>
                                    <input type="text" name="role_id" class="form-control" placeholder="Nhập ID của Role (VD: 987654...)" required>
                                    <div class="form-text text-white-50">Role này sẽ có full quyền quản lý tiền tệ và shop.</div>
                                </div>
                                <button class="btn btn-success w-100">Cấp quyền</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        res.send(getBaseHtml('Admin Manager', body, 'admins', req.session.user));
    });

    router.post('/admins/add', requireGuildSelection, async (req, res) => {
        const { role_id } = req.body;
        const guildId = req.session.guildId;
        if (role_id) {
            await economy.addAdminRole(guildId, role_id);
        }
        res.redirect('/admins');
    });

    router.post('/admins/remove', requireGuildSelection, async (req, res) => {
        const { role_id } = req.body;
        const guildId = req.session.guildId;
        if (role_id) {
            await economy.removeAdminRole(guildId, role_id);
        }
        res.redirect('/admins');
    });

    return router;
};