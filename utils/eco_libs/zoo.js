// utils/eco_libs/zoo.js
const { Zoo } = require('../../database/models');

module.exports = {
    // Lấy kho thú (Global - Key là userId)
    async getZoo(userId) {
        const key = userId;
        
        // Khởi tạo cache nếu chưa có
        if (!this.zooCache) this.zooCache = new Map();
        
        // Nếu chưa có trong RAM, lấy từ DB
        if (!this.zooCache.has(key)) {
            // SỬ DỤNG .lean() ĐỂ LẤY OBJECT THUẦN (Quan trọng)
            // Không dùng findOne thường để tránh trả về Mongoose Document (Map)
            let zooData = await Zoo.findOne({ user_id: userId }).lean();
            
            if (!zooData) {
                // Nếu chưa có, tạo object mặc định trong RAM
                // (Chưa cần lưu DB ngay để tối ưu)
                zooData = { 
                    user_id: userId, 
                    animals: {} 
                };
            }

            // Đảm bảo animals luôn là một Object (đề phòng DB cũ lưu null/map)
            if (!zooData.animals || typeof zooData.animals !== 'object' || Array.isArray(zooData.animals)) {
                zooData.animals = {};
            }

            // Set vào Cache
            this.zooCache.set(key, zooData);
        }
        
        return this.zooCache.get(key);
    },

    // Thêm danh sách thú
    async addAnimals(userId, animalsList) {
        const key = userId;
        // Lấy data từ cache (đã được hàm getZoo chuẩn hóa thành Object)
        const zooData = await this.getZoo(userId);
        
        // Double check
        if (!zooData.animals) zooData.animals = {};

        for (const animal of animalsList) {
            const currentCount = zooData.animals[animal.id] || 0;
            zooData.animals[animal.id] = currentCount + 1;
        }

        // Cập nhật Cache
        this.zooCache.set(key, zooData);
        
        // Đánh dấu Dirty
        if (!this.dirty.zoo) this.dirty.zoo = new Set();
        this.dirty.zoo.add(key);
        
        return true;
    },

    // Xóa thú (Dùng để bán)
    async removeAnimals(userId, animalId, amount) {
        const key = userId;
        const zooData = await this.getZoo(userId);
        
        if (!zooData.animals) return false;

        const currentCount = zooData.animals[animalId] || 0;
        
        if (currentCount < amount) return false; // Không đủ số lượng

        // Trừ số lượng
        zooData.animals[animalId] = currentCount - amount;
        
        // Nếu hết thì xóa key khỏi object cho gọn
        if (zooData.animals[animalId] <= 0) {
            delete zooData.animals[animalId];
        }

        // Cập nhật Cache
        this.zooCache.set(key, zooData);
        
        // Đánh dấu Dirty
        if (!this.dirty.zoo) this.dirty.zoo = new Set();
        this.dirty.zoo.add(key);
        
        return true;
    }
};