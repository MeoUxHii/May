const { GemHistory } = require('../../database/models');

module.exports = {
    // Lấy Inventory của User (Global)
    async getInventory(userId) {
        // Key inventory: userId_itemId
        const prefix = `${userId}_`;
        const items = [];
        
        for (const [key, val] of this.inventory) {
            if (key.startsWith(prefix) && val.amount > 0) {
                items.push(val);
            }
        }
        return items;
    },

    async getItemAmount(userId, itemId) {
        const key = `${userId}_${itemId}`;
        const item = this.inventory.get(key);
        return item ? item.amount : 0;
    },

    async addItem(userId, itemId, amount) {
        const key = `${userId}_${itemId}`;
        let item = this.inventory.get(key);
        if (!item) {
            // Không còn guild_id
            item = { user_id: userId, item_id: itemId, amount: 0 };
            this.inventory.set(key, item);
        }
        item.amount += amount;
        this.dirty.inventory.add(key);
        return true;
    },

    async removeItem(userId, itemId, amount) {
        const key = `${userId}_${itemId}`;
        const item = this.inventory.get(key);
        if (!item || item.amount < amount) return false;
        
        item.amount -= amount;
        this.dirty.inventory.add(key);
        return true;
    },

    async transferItem(fromUserId, toUserId, itemId, amount) {
        if (await this.removeItem(fromUserId, itemId, amount)) {
            await this.addItem(toUserId, itemId, amount);
            return true;
        }
        return false;
    },

    // SHOP SYNC (Giữ nguyên vì Shop là toàn cục)
    async syncShopData(ITEMS_CONFIG) {
        this.shopItems.forEach((dbItem, id) => {
            if (ITEMS_CONFIG[id]) {
                ITEMS_CONFIG[id].stock = dbItem.stock;
                ITEMS_CONFIG[id].price = dbItem.price;
            }
        });
        
        for (const key in ITEMS_CONFIG) {
            if (!this.shopItems.has(key)) {
                const newItem = { item_id: key, stock: ITEMS_CONFIG[key].stock, price: ITEMS_CONFIG[key].price };
                this.shopItems.set(key, newItem);
                this.dirty.shop.add(key);
            }
        }
    },
    
    async updateShopItem(itemId, data) {
        if (this.shopItems.has(itemId)) {
            const item = this.shopItems.get(itemId);
            if (data.stock !== undefined) item.stock = data.stock;
            if (data.price !== undefined) item.price = data.price;
            this.dirty.shop.add(itemId);
        }
    },

    // Đếm tổng item toàn server (Global)
    async countItemInServer(itemId) {
        let total = 0;
        for (const [key, val] of this.inventory) {
            if (val.item_id === itemId) {
                total += val.amount;
            }
        }
        return total;
    },
async logGemHistory(userId, itemId, itemName) {
        try {
            await GemHistory.create({
                user_id: userId,
                item_id: itemId,
                item_name: itemName,
                time: new Date()
            });
        } catch (e) {
            console.error("Lỗi lưu lịch sử ngọc:", e);
        }
    },

    // Hàm đếm tổng item trong server (Dùng cho Dashboard realtime)
    async countItemInServer(itemId) {
        let total = 0;
        for (const [key, val] of this.inventory) {
            if (val.item_id === itemId) {
                total += val.amount;
            }
        }
        return total;
    },    
};