// games/battle_config.js

// Bảng Stats Mới (Có thêm chỉ số Attack)
const ANIMAL_STATS = {
    // --- CLASS C ---
    'sen': { hp: 50, armor: 30, atk: 35, class: 'C' },
    'kien': { hp: 65, armor: 25, atk: 30, class: 'C' },
    'ong': { hp: 75, armor: 20, atk: 25, class: 'C' },
    'buom': { hp: 85, armor: 15, atk: 20, class: 'C' },
    'sau': { hp: 100, armor: 10, atk: 15, class: 'C' },

    // --- CLASS U ---
    'meo': { hp: 110, armor: 60, atk: 65, class: 'U' },
    'soc': { hp: 135, armor: 52, atk: 58, class: 'U' },
    'doi': { hp: 155, armor: 45, atk: 52, class: 'U' },
    'ga': { hp: 180, armor: 37, atk: 46, class: 'U' },
    'vit': { hp: 200, armor: 30, atk: 40, class: 'U' },

    // --- CLASS R ---
    'cong': { hp: 210, armor: 70, atk: 95, class: 'R' },
    'cuu': { hp: 235, armor: 65, atk: 85, class: 'R' },
    'ngua': { hp: 260, armor: 60, atk: 75, class: 'R' },
    'bo': { hp: 285, armor: 55, atk: 68, class: 'R' },
    'voi': { hp: 300, armor: 50, atk: 60, class: 'R' },

    // --- CLASS E ---
    'vet': { hp: 310, armor: 80, atk: 125, class: 'E' },
    'khi_dot': { hp: 335, armor: 75, atk: 115, class: 'E' }, // Mapping 'Khỉ'
    'bao': { hp: 360, armor: 70, atk: 100, class: 'E' },
    'ho': { hp: 385, armor: 65, atk: 90, class: 'E' },
    'te_giac': { hp: 400, armor: 60, atk: 80, class: 'E' },

    // --- CLASS M ---
    'cong_than': { hp: 415, armor: 90, atk: 160, class: 'M' },
    'phuong': { hp: 435, armor: 86, atk: 150, class: 'M' },
    'ki_lan': { hp: 455, armor: 82, atk: 140, class: 'M' },
    'nguoi_tuyet': { hp: 475, armor: 78, atk: 130, class: 'M' },
    'khung_long': { hp: 490, armor: 74, atk: 120, class: 'M' },
    'ca_voi': { hp: 500, armor: 70, atk: 110, class: 'M' },

    // --- CLASS G ---
    'tom': { hp: 510, armor: 100, atk: 190, class: 'G' },
    'nhen': { hp: 535, armor: 95, atk: 175, class: 'G' },
    'ca': { hp: 560, armor: 90, atk: 160, class: 'G' },
    'lac_da': { hp: 585, armor: 85, atk: 145, class: 'G' },
    'gau_truc': { hp: 600, armor: 80, atk: 130, class: 'G' },

    // --- CLASS L ---
    'cu': { hp: 610, armor: 120, atk: 220, class: 'L' },
    'cao': { hp: 635, armor: 115, atk: 205, class: 'L' },
    'huu': { hp: 660, armor: 110, atk: 190, class: 'L' },
    'bach_tuoc': { hp: 685, armor: 105, atk: 175, class: 'L' },
    'su_tu': { hp: 700, armor: 100, atk: 160, class: 'L' },

    // --- CLASS F ---
    'ech': { hp: 900, armor: 150, atk: 300, class: 'F' },
    'chim_ung': { hp: 915, armor: 142, atk: 285, class: 'F' },
    'khi_f': { hp: 930, armor: 135, atk: 275, class: 'F' }, // Khỉ Thần
    'cho_f': { hp: 945, armor: 128, atk: 265, class: 'F' }, // Chó
    'heo_f': { hp: 960, armor: 120, atk: 250, class: 'F' }, // Heo
};

// Bảng EXP cần để lên cấp (Cumulative)
const LEVEL_EXP = [
    0,      // Lv 0
    50,     // Lv 1
    200,    // Lv 2
    450,    // Lv 3
    800,    // Lv 4
    1300,   // Lv 5 (Mốc 1)
    2000,   // Lv 6
    2950,   // Lv 7
    4200,   // Lv 8
    5800,   // Lv 9
    7800,   // Lv 10 (Mốc 2)
    10300,  // Lv 11
    13400,  // Lv 12
    17200,  // Lv 13
    21800,  // Lv 14
    27300,  // Lv 15 (Mốc 3)
    33800,  // Lv 16
    41400,  // Lv 17
    50200,  // Lv 18
    60300,  // Lv 19
    71800,  // Lv 20 (Mốc 4)
    84800,  // Lv 21
    99800,  // Lv 22
    117300, // Lv 23
    137800, // Lv 24
    162800  // Lv 25 (Max)
];

// Mốc Buff theo Level
const MILESTONES = {
    5:  { hp_bonus_pct: 0.15, armor_bonus: 5 },
    10: { hp_bonus_pct: 0.35, armor_bonus: 15 },
    15: { hp_bonus_pct: 0.60, armor_bonus: 30 },
    20: { hp_bonus_pct: 0.75, armor_bonus: 40 },
    25: { hp_bonus_pct: 0.90, armor_bonus: 50 }
};

// Hàm tính chỉ số thực tế dựa trên Level
function calculateStats(animalId, level) {
    const base = ANIMAL_STATS[animalId];
    if (!base) return null; // Thú không tồn tại trong config battle

    // Tìm mốc level cao nhất đã đạt được
    let milestone = { hp_bonus_pct: 0, armor_bonus: 0 };
    
    if (level >= 25) milestone = MILESTONES[25];
    else if (level >= 20) milestone = MILESTONES[20];
    else if (level >= 15) milestone = MILESTONES[15];
    else if (level >= 10) milestone = MILESTONES[10];
    else if (level >= 5)  milestone = MILESTONES[5];

    // Tính toán HP
    const finalHp = Math.floor(base.hp * (1 + milestone.hp_bonus_pct));
    
    // Tính toán Armor
    const finalArmor = base.armor + milestone.armor_bonus;
    
    // Tính toán ATK: Tăng 2% mỗi level (để cân bằng với lượng máu tăng)
    const finalAtk = Math.floor(base.atk * (1 + (level * 0.02))); 

    return {
        ...base,
        hp: finalHp,
        max_hp: finalHp,
        armor: finalArmor, // Max Armor
        max_armor: finalArmor,
        atk: finalAtk
    };
}

module.exports = { ANIMAL_STATS, LEVEL_EXP, MILESTONES, calculateStats };