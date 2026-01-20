// dashboard/middleware/authMiddleware.js
const requireLogin = (req, res, next) => {
    // Sửa 'loggedin' thành 'isAuthenticated' cho khớp với authRoutes
    if (req.session && req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/login');
    }
};

const requireGuildSelection = (req, res, next) => {
    if (!req.session || !req.session.isAuthenticated) return res.redirect('/login');
    // Nếu app của bạn cần chọn Guild mới cho vào, giữ dòng dưới. 
    // Nếu logic mới không cần (vì Master Admin quản hết), có thể bỏ qua dòng check guildId
    // if (!req.session.guildId) return res.redirect('/select-server');
    next();
};

module.exports = { requireLogin, requireGuildSelection };