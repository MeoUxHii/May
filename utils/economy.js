// utils/economy.js
const fs = require('fs');
const path = require('path');
const { 
    User, Inventory, Setting, ShopItemDB, WordChainRank, CustomReply, DisabledCommand, 
    WordDB, Zoo, GemHistory, UserBuff, BattleProfile, GameSession 
} = require('../database/models');

const userLib = require('./eco_libs/user');
const itemLib = require('./eco_libs/item');
const systemLib = require('./eco_libs/system');
const zooLib = require('./eco_libs/zoo');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONTRIBUTE_FILE = path.join(DATA_DIR, 'contribute-words.txt');
const WORDS_FILE = path.join(DATA_DIR, 'official-words.txt');

const MAIN_GUILD_ID = '528097406684758018'; 
const OWNER_ID = '414792622289190917';

class EconomyManager {
    constructor() {
        // --- DATA IN RAM ---
        this.users = new Map();
        this.inventory = new Map();
        this.settings = new Map();
        this.shopItems = new Map();
        this.wordChain = new Map();
        this.zooCache = new Map();
        this.gameSessions = new Map(); 

        // --- CACHE TÊN NGƯỜI DÙNG (MỚI - GIÚP LB SIÊU NHANH) ---
        this.userNames = new Map(); 

        this.replies = [];
        this.disabledCmds = new Set();
        this.cooldowns = new Map();

        this.dirty = {
            users: new Set(),
            inventory: new Set(),
            settings: new Set(),
            shop: new Set(),
            wordChain: new Set(),
            zoo: new Set(),
            gameSessions: new Set()
        };

        this.initialized = false;
        this.saveInterval = null;
        this.isSaving = false;
    }
    // --- MIGRATION DỮ LIỆU CŨ (NẾU CẦN) ---
    async performMigration() {
        // (Giữ nguyên logic migration cũ)
        try {
            const deleteQuery = { guild_id: { $ne: MAIN_GUILD_ID } };
            await Promise.all([
                User.deleteMany(deleteQuery),
                Inventory.deleteMany(deleteQuery),
                Zoo.deleteMany(deleteQuery),
                WordChainRank.deleteMany(deleteQuery),
                UserBuff.deleteMany(deleteQuery),
                BattleProfile.deleteMany(deleteQuery),
                GemHistory.deleteMany(deleteQuery)
            ]);
            const updateQuery = { $unset: { guild_id: 1 } };
            const filterQuery = { guild_id: MAIN_GUILD_ID };
            await Promise.all([
                User.updateMany(filterQuery, updateQuery),
                Inventory.updateMany(filterQuery, updateQuery),
                Zoo.updateMany(filterQuery, updateQuery),
                WordChainRank.updateMany(filterQuery, updateQuery),
                UserBuff.updateMany(filterQuery, updateQuery),
                BattleProfile.updateMany(filterQuery, updateQuery),
                GemHistory.updateMany(filterQuery, updateQuery)
            ]);
        } catch (e) {}
    }

    // --- INIT: TẢI DB VỀ RAM ---
    async init() {
        await this.performMigration();

        console.log("📥 Đang tải dữ liệu Global vào RAM...");
        const start = Date.now();

        const usersDB = await User.find({}); usersDB.forEach(u => this.users.set(u.user_id, u.toObject()));
        const invDB = await Inventory.find({}); invDB.forEach(i => this.inventory.set(`${i.user_id}_${i.item_id}`, i.toObject()));
        const setDB = await Setting.find({}); setDB.forEach(s => { const obj = s.toObject(); if (obj.game_channels instanceof Map) obj.game_channels = Object.fromEntries(obj.game_channels); this.settings.set(s.guild_id, obj); });
        const shopDB = await ShopItemDB.find({}); shopDB.forEach(s => this.shopItems.set(s.item_id, s.toObject()));
        const wcDB = await WordChainRank.find({}); wcDB.forEach(w => this.wordChain.set(w.user_id, w.toObject()));
        const zooDB = await Zoo.find({}); zooDB.forEach(z => { const obj = z.toObject(); if (obj.animals instanceof Map) obj.animals = Object.fromEntries(obj.animals); this.zooCache.set(z.user_id, obj); });
        const sessionsDB = await GameSession.find({}); sessionsDB.forEach(s => { this.gameSessions.set(s.channel_id, s.toObject()); });

        this.replies = await CustomReply.find({}).then(r => r.map(x => x.toObject()));
        const disDB = await DisabledCommand.find({}); disDB.forEach(d => this.disabledCmds.add(`${d.channel_id}_${d.command}`));

        try {
            const allWordsDB = await WordDB.find({});
            if (allWordsDB.length > 0) {
                const wordList = allWordsDB.map(w => w.word).join('\n');
                fs.writeFileSync(WORDS_FILE, wordList, 'utf8');
            }
        } catch (e) {}

        this.initialized = true;
        console.log(`🚀 System Online. Loaded ${this.users.size} users into RAM.`);
        
        if (this.saveInterval) clearInterval(this.saveInterval);
        this.saveInterval = setInterval(() => this.saveData(), 2 * 60 * 1000);
    }

    // --- SAVE: ĐỒNG BỘ RAM LÊN DB ---
    async saveData(force = false) {
        if (!this.initialized || this.isSaving) return;
        
        const totalDirty = this.dirty.users.size + this.dirty.inventory.size + this.dirty.zoo.size + 
                           this.dirty.settings.size + this.dirty.shop.size + this.dirty.wordChain.size +
                           this.dirty.gameSessions.size;

        if (totalDirty === 0 && !force) return;

        this.isSaving = true;
        console.log(`💾 Auto-Save: Syncing ${totalDirty} changes to MongoDB...`);

        try {
            if (this.dirty.users.size > 0) { const ops = []; this.dirty.users.forEach(k => { const d = this.users.get(k); if(d) ops.push({ updateOne: { filter: { user_id: d.user_id }, update: { $set: d }, upsert: true } }); }); if(ops.length) await User.bulkWrite(ops); this.dirty.users.clear(); }
            if (this.dirty.inventory.size > 0) { const ops = []; this.dirty.inventory.forEach(k => { const d = this.inventory.get(k); if(d) ops.push({ updateOne: { filter: { user_id: d.user_id, item_id: d.item_id }, update: { $set: { amount: d.amount } }, upsert: true } }); }); if(ops.length) await Inventory.bulkWrite(ops); this.dirty.inventory.clear(); }
            if (this.dirty.shop.size > 0) { const ops = []; this.dirty.shop.forEach(k => { const d = this.shopItems.get(k); if(d) ops.push({ updateOne: { filter: { item_id: k }, update: { $set: d }, upsert: true } }); }); await ShopItemDB.bulkWrite(ops); this.dirty.shop.clear(); }
            if (this.dirty.wordChain.size > 0) { const ops = []; this.dirty.wordChain.forEach(k => { const d = this.wordChain.get(k); if(d) ops.push({ updateOne: { filter: { user_id: k }, update: { $set: d }, upsert: true } }); }); await WordChainRank.bulkWrite(ops); this.dirty.wordChain.clear(); }
            if (this.dirty.zoo.size > 0) { const ops = []; this.dirty.zoo.forEach(k => { const d = this.zooCache.get(k); if(d) ops.push({ updateOne: { filter: { user_id: k }, update: { $set: { animals: d.animals } }, upsert: true } }); }); await Zoo.bulkWrite(ops); this.dirty.zoo.clear(); }
            if (this.dirty.settings.size > 0) { const ops = []; for (const guildId of this.dirty.settings) { const data = this.settings.get(guildId); if (data) ops.push({ updateOne: { filter: { guild_id: guildId }, update: { $set: data }, upsert: true } }); } if (ops.length > 0) await Setting.bulkWrite(ops); this.dirty.settings.clear(); }
            if (this.dirty.gameSessions.size > 0) { const ops = []; for (const channelId of this.dirty.gameSessions) { const data = this.gameSessions.get(channelId); if (data) ops.push({ updateOne: { filter: { channel_id: channelId }, update: { $set: data }, upsert: true } }); else ops.push({ deleteOne: { filter: { channel_id: channelId } } }); } if (ops.length > 0) await GameSession.bulkWrite(ops); this.dirty.gameSessions.clear(); }

            if (fs.existsSync(CONTRIBUTE_FILE)) {
                try {
                    const raw = fs.readFileSync(CONTRIBUTE_FILE, 'utf8');
                    const words = raw.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w);
                    if (words.length > 0) {
                        const unique = [...new Set(words)];
                        const ops = unique.map(w => ({ updateOne: { filter: { word: w }, update: { $set: { word: w } }, upsert: true } }));
                        await WordDB.bulkWrite(ops);
                        fs.appendFileSync(WORDS_FILE, '\n' + unique.join('\n'), 'utf8');
                        fs.writeFileSync(CONTRIBUTE_FILE, '', 'utf8');
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.error("❌ Save Error:", e);
        } finally {
            this.isSaving = false;
        }
    }

    // --- HÀM LẤY TÊN USER (CÓ CACHE RAM) ---
    async getCachedUsername(userId, client) {
        // 1. Kiểm tra Cache RAM của Economy trước
        if (this.userNames.has(userId)) {
            return this.userNames.get(userId);
        }

        // 2. Nếu không có, hỏi Discord Cache
        let user = client.users.cache.get(userId);
        
        // 3. Nếu Discord Cache không có, Fetch API (Chỉ 1 lần duy nhất)
        if (!user) {
            try {
                user = await client.users.fetch(userId);
            } catch (e) {
                return "Unknown";
            }
        }

        if (user) {
            const name = user.username;
            // Lưu vào Cache RAM của Economy để lần sau không phải fetch nữa
            this.userNames.set(userId, name);
            return name;
        }
        return "Unknown";
    }

    // ... (Giữ nguyên các hàm khác) ...
    getGameSession(channelId) { return this.gameSessions.get(channelId); }
    async setGameSession(channelId, guildId, type, data) { const session = { channel_id: channelId, guild_id: guildId, game_type: type, data: data, updated_at: new Date() }; this.gameSessions.set(channelId, session); this.dirty.gameSessions.add(channelId); }
    async deleteGameSession(channelId) { this.gameSessions.delete(channelId); this.dirty.gameSessions.add(channelId); }
    isOwner(userId) { return userId === OWNER_ID; }

    async startBackgroundSync(client) {
        console.log("🔄 [Auto-Sync] Kích hoạt tiến trình đồng bộ dữ liệu ngầm...");
        
        const allUsers = Array.from(this.users.values());
        let missingCount = 0;

        // Đếm xem bao nhiêu người chưa có tên
        for (const u of allUsers) {
            if (!u.username || u.username === 'Unknown' || !u.avatar) missingCount++;
        }

        if (missingCount === 0) {
            console.log("✅ [Auto-Sync] Dữ liệu User đã đầy đủ.");
            return;
        }

        console.log(`📉 [Auto-Sync] Tìm thấy ${missingCount} user thiếu thông tin. Đang tải từ Discord...`);

        let processed = 0;
        // Chạy loop xử lý từng user
        for (const u of allUsers) {
            // Chỉ xử lý những user bị thiếu thông tin
            if (!u.username || u.username === 'Unknown' || !u.avatar) {
                try {
                    let discordUser = client.users.cache.get(u.user_id);
                    
                    // Nếu cache không có, phải fetch API
                    if (!discordUser) {
                        try {
                            discordUser = await client.users.fetch(u.user_id);
                        } catch (e) {
                            // User này có thể đã xóa acc hoặc bot không thấy, set tên tạm
                            u.username = `User ${u.user_id}`;
                            u.display_name = `User ${u.user_id}`;
                            this.dirty.users.add(u.user_id);
                        }
                    }

                    if (discordUser) {
                        u.username = discordUser.username;
                        u.display_name = discordUser.globalName || discordUser.username;
                        u.avatar = discordUser.avatar;
                        this.dirty.users.add(u.user_id);
                        processed++;
                    }
                } catch (err) {
                    // Bỏ qua lỗi nhỏ
                }

                // Nghỉ 1s giữa mỗi lần gọi để tránh bị Discord chặn
                await new Promise(r => setTimeout(r, 1000));
                
                // Cứ 10 người thì log 1 lần cho đỡ spam console
                if (processed % 10 === 0 && processed > 0) {
                    console.log(`⏳ [Auto-Sync] Đã cập nhật: ${processed}/${missingCount}`);
                }
            }
        }

        console.log(`✅ [Auto-Sync] Hoàn tất! Đã cập nhật xong ${processed} user.`);
        await this.saveData(true);
    }
}

Object.assign(EconomyManager.prototype, userLib);
Object.assign(EconomyManager.prototype, itemLib);
Object.assign(EconomyManager.prototype, systemLib);
Object.assign(EconomyManager.prototype, zooLib);

const economyManager = new EconomyManager();

const cleanup = async () => {
    console.log("🛑 Saving data before exit...");
    await economyManager.saveData(true);
    process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = economyManager;