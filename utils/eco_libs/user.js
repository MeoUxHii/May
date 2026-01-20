// utils/eco_libs/user.js
const { User, UserBuff } = require('../../database/models');

module.exports = {
    // --- BASIC USER & BALANCE (GLOBAL) ---
    async getUser(userId) {
        const key = userId; 
        if (!this.users.has(key)) {
            const newUser = {
                user_id: userId,
                username: "Unknown",     // Mới
                display_name: "Unknown", // Mới
                avatar: null,            // Mới
                cash: 0, 
                bank: 0,
                last_daily: null,
                streak: 0
            };
            this.users.set(key, newUser);
            this.dirty.users.add(key);
        }
        return this.users.get(key);
    },

    // --- MỚI: CẬP NHẬT THÔNG TIN HIỂN THỊ CỦA USER ---
    // Hàm này sẽ được gọi mỗi khi user chat, để data luôn mới nhất
    async updateUserDiscordInfo(userId, discordUser) {
        if (!discordUser) return;
        const user = await this.getUser(userId);
        
        const newUsername = discordUser.username;
        const newDisplayName = discordUser.globalName || discordUser.username;
        const newAvatar = discordUser.avatar;

        // Chỉ update và lưu DB nếu có sự thay đổi để tránh spam write
        if (user.username !== newUsername || user.display_name !== newDisplayName || user.avatar !== newAvatar) {
            user.username = newUsername;
            user.display_name = newDisplayName;
            user.avatar = newAvatar;
            this.dirty.users.add(userId);
        }
    },

    async getBalance(userId) {
        const user = await this.getUser(userId);
        return { cash: user.cash, bank: user.bank, total: user.cash + user.bank };
    },

    async updateBalance(userId, amount, type = "cash", mode = "add") {
        const key = userId;
        const user = await this.getUser(userId);
        const field = type === 'bank' ? 'bank' : 'cash';
        
        if (mode === "set") user[field] = amount;
        else user[field] += (mode === "add" ? amount : -amount);
        
        this.dirty.users.add(key);
        return true;
    },

    async addMoney(userId, amount, reason) { 
        return this.updateBalance(userId, amount, "cash", "add"); 
    },
    
    async subtractMoney(userId, amount, reason) {
        const user = await this.getUser(userId);
        if (user.cash < amount) return false;
        return this.updateBalance(userId, amount, "cash", "remove");
    },

    async deductMoney(userId, amount) {
        const user = await this.getUser(userId);
        let remaining = amount;
        let deductedCash = 0, deductedBank = 0;

        if (user.cash >= remaining) { deductedCash = remaining; remaining = 0; }
        else { deductedCash = user.cash; remaining -= user.cash; }

        if (remaining > 0) {
            if (user.bank >= remaining) { deductedBank = remaining; remaining = 0; }
            else { deductedBank = user.bank; remaining -= user.bank; }
        }

        if (deductedCash > 0) await this.updateBalance(userId, deductedCash, 'cash', 'remove');
        if (deductedBank > 0) await this.updateBalance(userId, deductedBank, 'bank', 'remove');
        return deductedCash + deductedBank;
    },

    async addMoneyToAll(memberIds, amount) {
        let count = 0;
        for (const userId of memberIds) {
            await this.updateBalance(userId, amount, 'bank', 'add');
            count++;
        }
        return count;
    },

    async updateDaily(userId, streak) {
        const key = userId;
        const user = await this.getUser(userId);
        user.last_daily = new Date();
        user.streak = streak;
        this.dirty.users.add(key);
    },

    async getAllUsers() {
        const result = [];
        for (const user of this.users.values()) {
            result.push({ ...user, total: user.cash + user.bank });
        }
        return result;
    },

    async createTestUsers(count) {
        for (let i = 1; i <= count; i++) {
            const uid = `test_user_${i}`;
            const key = uid;
            this.users.set(key, {
                user_id: uid,
                username: `Bot Tester ${i}`, // Cập nhật tên giả
                display_name: `Tester ${i}`,
                cash: Math.floor(Math.random() * 50000),
                bank: Math.floor(Math.random() * 500000),
                streak: 0
            });
            this.dirty.users.add(key);
        }
        return true;
    },

    async removeTestUsers() {
        let count = 0;
        for (const [key, user] of this.users) {
            if (user.user_id.startsWith('test_user_')) {
                this.users.delete(key);
                await User.deleteOne({ user_id: user.user_id });
                count++;
            }
        }
        return count;
    },
    
    async getUserBuffs(userId) {
        let buff = await UserBuff.findOne({ user_id: userId });
        if (!buff) {
            buff = await UserBuff.create({ user_id: userId });
        }
        return buff;
    },

    async activateBuff(userId, type, gemId, turns) {
        const buff = await this.getUserBuffs(userId);
        if (type === 'quantity') {
            buff.qty_gem_id = gemId;
            buff.qty_turns = turns;
            buff.qty_total = turns;
        } else if (type === 'quality') {
            buff.qual_gem_id = gemId;
            buff.qual_turns = turns;
            buff.qual_total = turns;
        }
        await buff.save();
        return true;
    },

    async decreaseBuffTurns(userId) {
        const buff = await this.getUserBuffs(userId);
        let changed = false;
        if (buff.qty_turns > 0) {
            buff.qty_turns -= 1;
            if (buff.qty_turns <= 0) { buff.qty_turns = 0; buff.qty_gem_id = null; buff.qty_total = 0; }
            changed = true;
        }
        if (buff.qual_turns > 0) {
            buff.qual_turns -= 1;
            if (buff.qual_turns <= 0) { buff.qual_turns = 0; buff.qual_gem_id = null; buff.qual_total = 0; }
            changed = true;
        }
        if (changed) await buff.save();
        return buff;
    }
};