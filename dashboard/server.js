// dashboard/server.js
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

function startDashboard(client) {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // --- SETUP MIDDLEWARE ---
    app.use(bodyParser.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/pictures', express.static(path.join(__dirname, '../pictures')));

    app.use(session({
        secret: 'meou_dashboard_super_secret',
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 3600000 } // 1 giờ
    }));

    // --- IMPORT & INITIALIZE ROUTES INSIDE FUNCTION ---
    // Phải require ở đây để biến 'client' được truyền vào các route
    const authRoutes = require('./routes/authRoutes')(client);
    const homeRoutes = require('./routes/homeRoutes')(client);
    const serverRoutes = require('./routes/serverRoutes')(client);
    const generalConfigRoutes = require('./routes/generalConfigRoutes')(client); 
    const userRoutes = require('./routes/userRoutes')(client);

    // --- SỬ DỤNG ROUTES ---
    app.use('/', authRoutes);
    app.use('/', homeRoutes);
    app.use('/', serverRoutes);
    app.use('/', generalConfigRoutes);
    app.use('/', userRoutes);

    app.listen(PORT, () => {
        console.log(`🌐 Dashboard Master Online: http://localhost:${PORT}`);
    });
}

module.exports = startDashboard;