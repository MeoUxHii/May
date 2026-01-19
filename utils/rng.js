const crypto = require('crypto');

/**
 * HỆ THỐNG VÒNG QUAY ẢO (VIRTUAL WHEEL) - PRECISION 100,000
 * Giúp xử lý các tỉ lệ siêu nhỏ như 0.01% một cách chính xác.
 */

const PRECISION_SCALE = 100000; // 0.001% = 1 đơn vị

function getSecureRandomInt(min, max) {
    return crypto.randomInt(min, max);
}

/**
 * Quay thưởng dựa trên danh sách item có rate
 * @param {Array} items - Danh sách item [{id: 'x', rate: 10.5}, ...]
 */
function spinWheel(items) {
    let pool = [];
    let totalWeight = 0;

    // 1. Chuẩn hóa dữ liệu đầu vào
    for (const item of items) {
        if (item.rate && item.rate > 0) {
            // Nhân rate với 100,000 để chuyển thành số nguyên
            // VD: Rate 0.05 -> Weight 5000
            const weight = Math.round(item.rate * PRECISION_SCALE);
            
            if (weight > 0) {
                pool.push({
                    item: item,
                    min: totalWeight,
                    max: totalWeight + weight
                });
                totalWeight += weight;
            }
        }
    }

    if (totalWeight === 0) return items[0]; // Fallback

    // 2. Quay số (0 -> TotalWeight)
    const luckyNumber = getSecureRandomInt(0, totalWeight);

    // 3. Dò kết quả
    const winner = pool.find(p => luckyNumber >= p.min && luckyNumber < p.max);

    return winner ? winner.item : items[0];
}

module.exports = { spinWheel, getSecureRandomInt };