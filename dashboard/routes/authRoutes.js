// dashboard/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios'); 
// Import credentials từ config
const { ADMIN_CREDENTIALS } = require('../../config'); 

const WHITELIST_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());

module.exports = (client) => {

    // ... (Giữ nguyên router.get('/login') ...) 
    router.get('/login', (req, res) => {
        if (req.session.isAuthenticated) return res.redirect('/');
        
        const errorType = req.query.error;
        let errorMessage = '';
        
        if (errorType === 'true') errorMessage = 'Tên đăng nhập hoặc mật khẩu không chính xác!';
        if (errorType === 'access_denied') errorMessage = 'Tài khoản Discord của bạn KHÔNG có quyền truy cập!';
        if (errorType === 'discord_error') errorMessage = 'Lỗi kết nối với Discord. Vui lòng thử lại!';
        if (errorType === 'missing_config') errorMessage = 'Server chưa cấu hình Client ID/Secret!';

        // ... (Giữ nguyên phần HTML giao diện login) ...
        // Chỉ copy lại phần HTML cũ của bạn vào đây
        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Login | MeoU System</title>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { background: #0f172a; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; position: relative; }
                    body::before { content: ''; position: absolute; width: 150%; height: 150%; background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15), transparent 50%), radial-gradient(circle at 0% 0%, rgba(168, 85, 247, 0.2), transparent 40%), radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.2), transparent 40%); animation: floatBg 20s infinite alternate; z-index: -1; }
                    @keyframes floatBg { from { transform: translate(-10%, -10%); } to { transform: translate(0, 0); } }
                    .glass-card { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); padding: 48px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 440px; color: white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; overflow: hidden; }
                    .glass-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #6366f1, #ec4899); }
                    .form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; padding: 14px 16px; border-radius: 12px; font-size: 0.95rem; }
                    .form-control:focus { background: rgba(15, 23, 42, 0.8); border-color: #818cf8; color: white; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15); outline: none; }
                    .btn-discord { background: #5865F2; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 600; width: 100%; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; box-shadow: 0 4px 15px rgba(88, 101, 242, 0.4); }
                    .btn-discord:hover { background: #4752c4; transform: translateY(-2px); color: white; }
                    .btn-primary { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none; padding: 14px; border-radius: 12px; font-weight: 600; width: 100%; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); transition: 0.3s; }
                    .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }
                    .logo-container { width: 100px; height: 100px; background: transparent; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
                    .logo-img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5)); }
                    .divider { display: flex; align-items: center; text-align: center; color: #64748b; margin: 24px 0; font-size: 0.8rem; font-weight: 600; letter-spacing: 1px; }
                    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid rgba(255,255,255,0.1); }
                    .divider::before { margin-right: 15px; } .divider::after { margin-left: 15px; }
                </style>
            </head>
            <body>
                <div class="glass-card text-center">
                    <div class="logo-container"><img src="/pictures/logo.png" alt="Logo" class="logo-img" onerror="this.style.display='none';"></div>
                    <h3 class="fw-bold mb-1">MeoU Admin</h3>
                    <p class="text-secondary small mb-4">Dashboard System v2.5</p>
                    ${errorMessage ? `<div class="alert alert-danger mb-4 text-start small border-0 bg-danger bg-opacity-10 text-danger"><i class="fas fa-exclamation-circle me-2"></i>${errorMessage}</div>` : ''}
                    <a href="/auth/discord" class="btn-discord"><i class="fab fa-discord"></i> Login with Discord</a>
                    <div class="divider">OR USE PASSWORD</div>
                    <form action="/login" method="POST" class="text-start">
                        <div class="mb-3 position-relative"><i class="fas fa-user position-absolute text-secondary" style="top: 18px; left: 16px;"></i><input type="text" name="username" class="form-control ps-5" placeholder="Username" required autocomplete="off"></div>
                        <div class="mb-4 position-relative"><i class="fas fa-lock position-absolute text-secondary" style="top: 18px; left: 16px;"></i><input type="password" name="password" class="form-control ps-5" placeholder="Password" required></div>
                        <button class="btn btn-primary">Access Dashboard</button>
                    </form>
                    <div class="mt-4 pt-3 border-top border-secondary border-opacity-10 text-secondary small opacity-50">&copy; 2024 MeoU Bot System • Secure Access</div>
                </div>
            </body>
            </html>
        `);
    });

    // --- SỬA ĐỔI: Dùng ADMIN_CREDENTIALS từ config ---
    router.post('/login', (req, res) => {
        const { username, password } = req.body;
        
        // Kiểm tra với biến môi trường
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            req.session.isAuthenticated = true;
            req.session.user = { username: 'Root Admin', role: 'admin', provider: 'local' };
            return res.redirect('/');
        }
        res.redirect('/login?error=true');
    });

    // ... (Giữ nguyên phần Discord OAuth2) ...
    router.get('/auth/discord', (req, res) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        const redirectUri = process.env.DISCORD_REDIRECT_URI;
        if (!clientId || !redirectUri) return res.redirect('/login?error=missing_config');
        const encodedRedirect = encodeURIComponent(redirectUri);
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=identify`;
        res.redirect(url);
    });

    router.get('/auth/discord/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect('/login?error=discord_error');
        try {
            const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
                scope: 'identify',
            }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            const accessToken = tokenResponse.data.access_token;
            const userResponse = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
            const user = userResponse.data;
            if (WHITELIST_IDS.includes(user.id)) {
                req.session.isAuthenticated = true;
                req.session.user = { username: user.username, discrimin: user.discriminator, avatar: user.avatar, id: user.id, role: 'admin', provider: 'discord' };
                return res.redirect('/');
            } else {
                return res.redirect('/login?error=access_denied');
            }
        } catch (error) {
            console.error('Discord Auth Error:', error);
            return res.redirect('/login?error=discord_error');
        }
    });

    router.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/login');
    });

    return router;
};