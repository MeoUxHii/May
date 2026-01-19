// utils/helpers.js
const { SHOP_ITEMS } = require('../config');

function parseBetAmount(str) {
    if (!str) return 0;
    str = str.toLowerCase();
    let multi = 1;
    if (str.endsWith('k')) { multi = 1000; str = str.slice(0, -1); } 
    else if (str.endsWith('m')) { multi = 1000000; str = str.slice(0, -1); }
    const val = parseFloat(str);
    return isNaN(val) ? 0 : Math.floor(val * multi);
}

function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

function findItemSmart(inputName) {
    if (!inputName) return null;
    const cleanInput = inputName.toLowerCase().trim();
    const cleanInputNoTone = removeVietnameseTones(cleanInput);

    return Object.values(SHOP_ITEMS).find(i => {
        const nameLower = i.name.toLowerCase();
        const nameNoTone = removeVietnameseTones(nameLower);
        if (i.keywords.some(k => k === cleanInput || k === cleanInputNoTone)) return true;
        if (nameLower.includes(cleanInput) || nameNoTone.includes(cleanInputNoTone)) return true;
        return false;
    });
}

function findAllItemsSmart(inputName) {
    if (!inputName) return [];
    const cleanInput = inputName.toLowerCase().trim();
    const cleanInputNoTone = removeVietnameseTones(cleanInput);

    return Object.values(SHOP_ITEMS).filter(i => {
        const nameLower = i.name.toLowerCase();
        const nameNoTone = removeVietnameseTones(nameLower);
        if (i.keywords.some(k => k === cleanInput || k === cleanInputNoTone)) return true;
        if (nameLower.includes(cleanInput) || nameNoTone.includes(cleanInputNoTone)) return true;
        return false;
    });
}

// --- HÀM TÌM USER GLOBAL (PHIÊN BẢN CHIẾN THẦN) ---
async function resolveGlobalUser(message, keyword) {
    if (!keyword) return null;
    const client = message.client;
    // Xóa dấu @ nếu user gõ kiểu @buiviethoangf
    const cleanKey = keyword.toLowerCase().replace(/^@/, '');

    // 1. Nếu là Mention <@!ID>
    const mentionMatch = keyword.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return await client.users.fetch(mentionMatch[1]).catch(() => null);
    }

    // 2. Nếu là ID số
    if (/^\d{17,19}$/.test(cleanKey)) {
        return await client.users.fetch(cleanKey).catch(() => null);
    }

    // 3. Tìm bằng Username/Nickname trong Cache của TOÀN BỘ server bot đang tham gia
    for (const guild of client.guilds.cache.values()) {
        const member = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === cleanKey || 
            (m.nickname && m.nickname.toLowerCase() === cleanKey) ||
            (m.user.globalName && m.user.globalName.toLowerCase() === cleanKey)
        );
        if (member) return member.user;
    }

    // 4. Nếu vẫn không thấy, quét sâu hơn trong danh sách User bot đã từng thấy
    const user = client.users.cache.find(u => 
        u.username.toLowerCase() === cleanKey || 
        (u.globalName && u.globalName.toLowerCase() === cleanKey)
    );
    
    return user || null;
}

module.exports = { 
    parseBetAmount, 
    removeVietnameseTones, 
    findItemSmart, 
    findAllItemsSmart,
    resolveGlobalUser 
};