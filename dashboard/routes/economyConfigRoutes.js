// dashboard/routes/economyConfigRoutes.js
const express = require('express');
const router = express.Router();
const economy = require('../../utils/economy');
const { getBaseHtml } = require('../utils/viewHelper');
const { requireGuildSelection } = require('../middleware/authMiddleware');

module.exports = () => {
    // GENERIC ECONOMY SETTINGS
    router.get('/settings/:type', requireGuildSelection, async (req, res) => {
        const type = req.params.type;
        const guildId = req.session.guildId;
        const settings = await economy.getConfig(guildId);
        const replies = await economy.getCustomReplies(guildId, type);
        
        const body = `
            <h3 class="mb-4 text-capitalize fw-bold"><i class="fas fa-cogs me-2"></i> Cấu hình: ${type}</h3>
            
            <div class="card mb-4">
                <div class="card-header">Thông số cơ bản</div>
                <div class="card-body">
                    <form action="/settings/update/${type}" method="POST" class="row g-3">
                        <input type="hidden" name="guild_id" value="${guildId}">
                        <div class="col-md-3"><label class="form-label">Cooldown (giây)</label><input type="number" name="cd" class="form-control" value="${settings[type + '_cd'] || 0}"></div>
                        <div class="col-md-3"><label class="form-label">Min Reward</label><input type="number" name="min" class="form-control" value="${settings[type + '_min'] || 0}"></div>
                        <div class="col-md-3"><label class="form-label">Max Reward</label><input type="number" name="max" class="form-control" value="${settings[type + '_max'] || 0}"></div>
                        ${type !== 'work' ? `<div class="col-md-3"><label class="form-label">Fail Rate (%)</label><input type="number" name="fail" class="form-control" value="${settings[type + '_fail'] || 0}"></div>` : ''}
                        <div class="col-12 text-end"><button type="submit" class="btn btn-primary">Lưu thông số</button></div>
                    </form>
                </div>
            </div>

            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span>💬 Custom Replies</span>
                    <span class="badge bg-secondary">${replies.length} messages</span>
                </div>
                <div class="card-body">
                     <form action="/replies/add" method="POST" class="row g-2 mb-4">
                        <input type="hidden" name="guild_id" value="${guildId}">
                        <input type="hidden" name="command_type" value="${type}">
                        <input type="hidden" name="redirect_to" value="/settings/${type}">
                        <div class="col-md-2">
                            <select name="status" class="form-select">
                                <option value="success">Success</option>
                                ${type !== 'work' ? '<option value="fail">Fail</option>' : ''}
                            </select>
                        </div>
                        <div class="col-md-8">
                            <input type="text" name="message" class="form-control" placeholder="Nội dung tin nhắn... Dùng {amount} để hiện tiền" required>
                        </div>
                        <div class="col-md-2"><button class="btn btn-success w-100"><i class="fas fa-plus"></i> Thêm</button></div>
                    </form>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <tbody>
                                ${replies.map(r => `
                                    <tr>
                                        <td width="100"><span class="badge bg-${r.status==='success'?'success':'danger'} w-100">${r.status.toUpperCase()}</span></td>
                                        <td>${r.message}</td>
                                        <td width="50" class="text-end">
                                            <form action="/replies/delete" method="POST" class="m-0">
                                                <input type="hidden" name="id" value="${r.id}">
                                                <input type="hidden" name="redirect_to" value="/settings/${type}">
                                                <button class="btn btn-sm btn-outline-danger border-0"><i class="fas fa-trash"></i></button>
                                            </form>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${replies.length === 0 ? '<tr><td colspan="3" class="text-center text-muted py-3">Chưa có tin nhắn tùy chỉnh nào</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        res.send(getBaseHtml(`Config ${type}`, body, type, req.session.guildName));
    });

    router.post('/settings/update/:type', requireGuildSelection, async (req, res) => {
        const type = req.params.type;
        const { guild_id, cd, min, max, fail } = req.body;
        await economy.updateConfig(guild_id, `${type}_cd`, parseInt(cd));
        await economy.updateConfig(guild_id, `${type}_min`, parseInt(min));
        await economy.updateConfig(guild_id, `${type}_max`, parseInt(max));
        if (type !== 'work') await economy.updateConfig(guild_id, `${type}_fail`, parseInt(fail));
        res.redirect(`/settings/${type}`);
    });

    router.post('/replies/add', requireGuildSelection, async (req, res) => {
        const { guild_id, command_type, status, message, redirect_to } = req.body;
        await economy.addReply(guild_id, command_type, status, message);
        res.redirect(redirect_to);
    });

    router.post('/replies/delete', requireGuildSelection, async (req, res) => {
        await economy.deleteReply(req.body.id);
        res.redirect(req.body.redirect_to);
    });

    return router;
};