const E = require('../emoji'); // Lấy emoji từ file tổng

const HUNT_CONFIG = {
    COOLDOWN: 2, 
    PRICE: 0,  
    
    // CẤU HÌNH TỈ LỆ GỐC & ICON CLASS
    CLASSES: {
        'U': { rate: 35.94, emoji: E.ZOO.CLASSES.U, name: "Common" },
        'C': { rate: 30.0,  emoji: E.ZOO.CLASSES.C, name: "Uncommon" },
        'R': { rate: 20.0,  emoji: E.ZOO.CLASSES.R, name: "Rare" },
        'E': { rate: 10.0,  emoji: E.ZOO.CLASSES.E, name: "Epic" },
        'M': { rate: 3.5,   emoji: E.ZOO.CLASSES.M, name: "Mythical" },
        'G': { rate: 0.5,   emoji: E.ZOO.CLASSES.G, name: "Godly" },
        'L': { rate: 0.05,  emoji: E.ZOO.CLASSES.L, name: "Legendary" },
        'F': { rate: 0.01,  emoji: E.ZOO.CLASSES.F, name: "Fable" }
    },

    BUFF_RATES_PERCENTAGE: {
        'R': 50.0, 'E': 70.0, 'M': 70.0, 'G': 100.0, 'L': 100.0, 'F': 100.0 
    },

    GEM_BUFFS: {
        'gem1a': { type: 'quantity', bonus: 1, turns: 20 },
        'gem2a': { type: 'quantity', bonus: 1, turns: 30 },
        'gem3a': { type: 'quantity', bonus: 2, turns: 35 },
        'gem4a': { type: 'quantity', bonus: 2, turns: 35 },
        'gem5a': { type: 'quantity', bonus: 3, turns: 40 },
        'gem6a': { type: 'quantity', bonus: 3, turns: 50 },
        'gem7a': { type: 'quantity', bonus: 4, turns: 100 },
        'gem1': { type: 'quality', bonus: 0, turns: 10 }, 
        'gem2': { type: 'quality', bonus: 0, turns: 20 },
        'gem3': { type: 'quality', bonus: 0, turns: 30 },
        'gem4': { type: 'quality', bonus: 0, turns: 35 },
        'gem5': { type: 'quality', bonus: 0, turns: 40 },
        'gem6': { type: 'quality', bonus: 0, turns: 50 },
        'gem7': { type: 'quality', bonus: 0, turns: 100 },
    },

    ANIMALS: {
        'U': [
            { id: 'ga', name: 'Gà', emoji: '🐓', rate: 0.20, price: 50 },
            { id: 'vit', name: 'Vịt', emoji: '🦆', rate: 0.20, price: 70 },
            { id: 'soc', name: 'Sóc', emoji: '🐿️', rate: 0.20, price: 90 },
            { id: 'doi', name: 'Dơi', emoji: '🦇', rate: 0.20, price: 110 },
            { id: 'meo', name: 'Mèo', emoji: '🐈', rate: 0.20, price: 140 }
        ],
        'C': [
            { id: 'sau', name: 'Sâu', emoji: '🐛', rate: 0.20, price: 150 },
            { id: 'sen', name: 'Sên', emoji: '🐌', rate: 0.20, price: 190 },
            { id: 'kien', name: 'Kiến', emoji: '🐜', rate: 0.20, price: 220 },
            { id: 'buom', name: 'Bướm', emoji: '🦋', rate: 0.20, price: 250 },
            { id: 'ong', name: 'Ong', emoji: '🐝', rate: 0.20, price: 280 }
        ],
        'R': [
            { id: 'cuu', name: 'Cừu', emoji: '🐑', rate: 0.20, price: 350 },
            { id: 'bo', name: 'Bò', emoji: '🐄', rate: 0.20, price: 370 },
            { id: 'voi', name: 'Voi', emoji: '🐘', rate: 0.20, price: 390 },
            { id: 'cong', name: 'Công', emoji: '🦚', rate: 0.20, price: 400 },
            { id: 'ngua', name: 'Ngựa', emoji: '🐎', rate: 0.20, price: 480 }
        ],
        'E': [
            { id: 'vet', name: 'Vẹt', emoji: '🦜', rate: 0.20, price: 600 },
            { id: 'te_giac', name: 'Tê Giác', emoji: '🦏', rate: 0.20, price: 650 },
            { id: 'khi_dot', name: 'Khỉ Đột', emoji: '🦧', rate: 0.20, price: 750 },
            { id: 'bao', name: 'Báo', emoji: '🐆', rate: 0.20, price: 850 },
            { id: 'ho', name: 'Hổ', emoji: '🐯', rate: 0.20, price: 990 }
        ],
        'M': [
            { id: 'khung_long', name: 'Khủng Long', emoji: '🦖', rate: 0.20, price: 1200 },
            { id: 'ca_voi', name: 'Cá Voi', emoji: '🐳', rate: 0.20, price: 1600 },
            { id: 'nguoi_tuyet', name: 'Người Tuyết', emoji: '☃️', rate: 0.20, price: 1800 },
            { id: 'ki_lan', name: 'Kì Lân', emoji: '🦄', rate: 0.20, price: 1900 },
            { id: 'phuong', name: 'Phượng', emoji: '🐦‍🔥', rate: 0.20, price: 2200 }
        ],
        'G': [
            { id: 'ca', name: 'Cá', emoji: E.ZOO.GODLY.fish, rate: 0.30, price: 4000 },
            { id: 'lac_da', name: 'Lạc Đà', emoji: E.ZOO.GODLY.camel, rate: 0.30, price: 5500 },
            { id: 'gau_truc', name: 'Gấu Trúc', emoji: E.ZOO.GODLY.panda, rate: 0.20, price: 6500 },
            { id: 'tom', name: 'Tôm', emoji: E.ZOO.GODLY.shrimp, rate: 0.10, price: 8000 },
            { id: 'nhen', name: 'Nhện', emoji: E.ZOO.GODLY.spider, rate: 0.10, price: 9900 }
        ],
        'L': [
            { id: 'huu', name: 'Hươu', emoji: E.ZOO.LEGENDARY.deer, rate: 0.30, price: 12200 },
            { id: 'cao', name: 'Cáo', emoji: E.ZOO.LEGENDARY.fox, rate: 0.30, price: 15500 },
            { id: 'su_tu', name: 'Sư Tử', emoji: E.ZOO.LEGENDARY.lion, rate: 0.20, price: 17000 },
            { id: 'bach_tuoc', name: 'Bạch Tuộc', emoji: E.ZOO.LEGENDARY.squid, rate: 0.10, price: 19000 },
            { id: 'cu_meo', name: 'Cú Mèo', emoji: E.ZOO.LEGENDARY.owl, rate: 0.10, price: 22000 }
        ],
        'F': [
            { id: 'heo_f', name: 'Heo', emoji: E.ZOO.FABLE.pig, rate: 0.35, price: 24000 },
            { id: 'chim_ung', name: 'Chim Ưng', emoji: E.ZOO.FABLE.eagle, rate: 0.30, price: 29000 },
            { id: 'ech', name: 'Ếch', emoji: E.ZOO.FABLE.frog, rate: 0.15, price: 32000 },
            { id: 'khi_f', name: 'Khỉ', emoji: E.ZOO.FABLE.monkey, rate: 0.15, price: 50000 },
            { id: 'cho_f', name: 'Chó', emoji: E.ZOO.FABLE.dog, rate: 0.05, price: 250000 }
        ]
    }
};

module.exports = { HUNT_CONFIG };