// dashboard/utils/viewHelper.js
const getBaseHtml = (title, bodyContent, activeTab = '', user = null) => {
    // Logic lấy Avatar User (Giữ nguyên)
    const currentUser = user || { username: 'Admin', id: '0', avatar: null };
    let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png'; 
    if (currentUser.avatar) {
        const format = currentUser.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.${format}`;
    } else if (currentUser.provider === 'discord') {
         avatarUrl = `https://cdn.discordapp.com/embed/avatars/${(currentUser.id >> 22) % 6}.png`;
    }

    return `
<!DOCTYPE html>
<html lang="vi" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | MeoU Master Admin</title>
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Bootstrap & Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --primary-grad: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            --glass-bg: rgba(30, 41, 59, 0.4);
            --glass-border: 1px solid rgba(255, 255, 255, 0.08);
            --sidebar-width: 280px;
            --body-bg: #0f172a;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--body-bg);
            color: #e2e8f0;
            overflow-x: hidden;
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(45, 212, 191, 0.15) 0px, transparent 50%);
            background-attachment: fixed;
            min-height: 100vh;
        }

        /* --- Scrollbar --- */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #6366f1; }

        /* --- Sidebar --- */
        .sidebar {
            width: var(--sidebar-width);
            height: 100vh;
            position: fixed;
            top: 0; left: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-right: var(--glass-border);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }

        .brand {
            font-size: 1.5rem;
            font-weight: 800;
            background: var(--primary-grad);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 40px;
            display: flex;
            align-items: center;
            gap: 15px; /* Tăng khoảng cách giữa logo và chữ */
            letter-spacing: -0.5px;
        }

        .brand img {
            /* THAY ĐỔI: CSS cho Logo Sidebar */
            height: 45px; 
            width: auto;
            filter: drop-shadow(0 0 5px rgba(99, 102, 241, 0.5));
        }

        .nav-link {
            color: #94a3b8;
            padding: 14px 18px;
            border-radius: 12px;
            margin-bottom: 8px;
            transition: all 0.3s ease;
            font-weight: 500;
            border: 1px solid transparent;
            display: flex;
            align-items: center;
        }

        .nav-link:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            transform: translateX(5px);
        }

        .nav-link.active {
            background: rgba(99, 102, 241, 0.15);
            color: #fff;
            border: 1px solid rgba(99, 102, 241, 0.3);
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.15);
        }
        .nav-link i { width: 24px; font-size: 1.1em; transition: 0.3s; }
        .nav-link.active i { color: #818cf8; }

        .submenu { 
            margin-left: 15px; 
            padding-left: 15px; 
            border-left: 1px solid rgba(255,255,255,0.1); 
            margin-top: 5px;
            list-style: none;
        }

        /* --- Main Content --- */
        .content-wrapper {
            margin-left: var(--sidebar-width);
            padding: 40px;
            animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .card {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: var(--glass-border);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }

        .card-header {
            background: rgba(255, 255, 255, 0.03);
            border-bottom: var(--glass-border);
            padding: 20px 24px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
            color: #94a3b8;
        }
        
        .card-body { padding: 24px; }

        .form-control, .form-select {
            background: rgba(15, 23, 42, 0.6) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            color: #fff !important;
            border-radius: 12px;
            padding: 12px 16px;
        }
        .form-control:focus, .form-select:focus {
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
            border-color: #6366f1 !important;
        }

        .btn { border-radius: 10px; padding: 10px 24px; font-weight: 600; border: none; }
        .btn-primary { background: var(--primary-grad); box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); }
        .btn-success { background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%); }
        .btn-danger { background: linear-gradient(135deg, #ef4444 0%, #f43f5e 100%); }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

        .table { --bs-table-bg: transparent; color: #cbd5e1; }
        .table thead th { background: rgba(255,255,255,0.05); color: #fff; padding: 15px; border-bottom: none; }
        .table tbody td { border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px; vertical-align: middle; }
        .table-hover tbody tr:hover { background-color: rgba(255,255,255,0.03); }

        .user-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 16px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            transition: 0.3s;
        }
        .user-profile:hover { background: rgba(255,255,255,0.06); }
        .user-avatar {
            width: 40px; height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #6366f1;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <!-- THAY ĐỔI Ở ĐÂY: LOGO VÀ TÊN -->
        <div class="brand">
            <img src="/pictures/logo.png" alt="MeoU" onerror="this.style.display='none';"> 
            MEOW ADMIN
        </div>
        <nav class="flex-grow-1 overflow-auto custom-scrollbar">
            <p class="text-uppercase small text-muted fw-bold mb-3 ps-3" style="font-size: 0.7rem; letter-spacing: 1.5px;">Main Menu</p>
            
            <a href="/" class="nav-link ${activeTab === 'home' ? 'active' : ''}">
                <i class="fas fa-grid-2 me-2"></i> Dashboard
            </a>
            <a href="/install-servers" class="nav-link ${activeTab === 'servers' ? 'active' : ''}">
                <i class="fas fa-server me-2"></i> Servers
            </a>
            
            <div class="my-4 border-top border-secondary opacity-25"></div>
            <p class="text-uppercase small text-muted fw-bold mb-3 ps-3" style="font-size: 0.7rem; letter-spacing: 1.5px;">Game System</p>

            <a href="/game-config" class="nav-link ${activeTab === 'game' ? 'active' : ''}">
                <i class="fas fa-gamepad me-2"></i> Config Game
            </a>
            
            <div class="nav-item">
                <a class="nav-link ${activeTab.startsWith('shop') ? 'active' : 'collapsed'}" data-bs-toggle="collapse" href="#shopSubmenu">
                    <i class="fas fa-store me-2"></i> Shop & Items <i class="fas fa-chevron-down ms-auto small"></i>
                </a>
                <div class="collapse ${activeTab.startsWith('shop') ? 'show' : ''}" id="shopSubmenu">
                    <ul class="submenu">
                        <li><a href="/shop-config/items" class="nav-link ${activeTab === 'shop-items' ? 'active' : ''} border-0">Items Setup</a></li>
                        <li><a href="/shop-config/gems" class="nav-link ${activeTab === 'shop-gems' ? 'active' : ''} border-0">Gem Market</a></li>
                        <li><a href="/shop-config/rates" class="nav-link ${activeTab === 'gem-rates' ? 'active' : ''} border-0">Gem Rates & Config</a>
                    </ul>
                </div>
            </div>

            <a href="/users" class="nav-link ${activeTab === 'users' ? 'active' : ''}">
                <i class="fas fa-users-cog me-2"></i> User Manager
            </a>
            <a href="/settings/wordchain" class="nav-link ${activeTab === 'wordchain' ? 'active' : ''}">
                <i class="fas fa-link me-2"></i> Wordchain
            </a>
        </nav>
        
        <div class="mt-auto pt-4 border-top border-secondary border-opacity-25">
            <div class="user-profile mb-3">
                <img src="${avatarUrl}" class="user-avatar" alt="User">
                <div style="line-height: 1.2; overflow: hidden;">
                    <div class="fw-bold text-white small text-truncate">${currentUser.username}</div>
                    <div class="text-success" style="font-size: 0.75rem;">● Online</div>
                </div>
            </div>
            <a href="/logout" class="btn btn-outline-danger w-100 btn-sm"><i class="fas fa-sign-out-alt me-2"></i> Logout</a>
        </div>
    </div>

    <div class="content-wrapper">
        <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
                <h2 class="fw-bold mb-0 text-white">${title}</h2>
                <div class="text-muted small mt-1">Quản lý hệ thống bot Discord</div>
            </div>
            <div class="d-flex gap-3">
                <div class="d-flex align-items-center text-white gap-2">
                    <img src="${avatarUrl}" width="32" height="32" class="rounded-circle border border-secondary">
                    <span class="fw-bold small">${currentUser.username}</span>
                </div>
            </div>
        </div>

        ${bodyContent}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
};

module.exports = { getBaseHtml };