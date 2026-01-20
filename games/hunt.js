// games/hunt.js
const { EmbedBuilder } = require('discord.js');
const { SHOP_ITEMS, CURRENCY, HUNT_CONFIG } = require('../config'); 
const economy = require('../utils/economy');
const { resolveGlobalUser } = require('../utils/helpers'); // IMPORT THÊM
const crypto = require('crypto'); 

// ID CỦA BẠN (BOT OWNER)
const OWNER_ID = '414792622289190917';

// --- DROP STATE QUẢN LÝ ---
let globalDropState = { 
    count: 0, 
    lastHour: new Date().getHours(),
    lastDropTime: 0 
};

function checkAndResetDropState() {
    const currentHour = new Date().getHours();
    if (currentHour !== globalDropState.lastHour) {
        globalDropState.count = 0;
        globalDropState.lastHour = currentHour;
    }
}

function getMinutesUntilReset() {
    const now = new Date();
    return 60 - now.getMinutes();
}

function toSuperscript(num) {
    const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return num.toString().split('').map(digit => map[digit]).join('');
}

function getSecureRandom(max) {
    return crypto.randomInt(0, max);
}

function weightedRandom(items, isClassSelection = false) {
    const SCALE = 100000; 
    let table = [];
    let totalWeight = 0;

    if (isClassSelection) {
        for (const [key, data] of Object.entries(items)) {
            const weight = Math.round(data.rate * 1000); 
            if (weight > 0) {
                table.push({ key, data, weight });
                totalWeight += weight;
            }
        }
    } else {
        for (const item of items) {
            const weight = Math.round(item.rate * SCALE);
            if (weight > 0) {
                table.push({ data: item, weight });
                totalWeight += weight;
            }
        }
    }

    if (totalWeight === 0) return isClassSelection ? { key: 'U', ...items['U'] } : items[0];

    const rand = getSecureRandom(totalWeight);
    let currentSum = 0;
    for (const entry of table) {
        currentSum += entry.weight;
        if (rand < currentSum) {
            return isClassSelection ? { key: entry.key, ...entry.data } : entry.data;
        }
    }
    return table[0].data; 
}

// --- HÀM XỬ LÝ LỆNH HUNT ---
async function handleHunt(message) {
    const userId = message.author.id;
    
    // 0. CHECK COOLDOWN (GLOBAL)
    const cooldownExp = economy.checkCooldown(null, userId, 'hunt', HUNT_CONFIG.COOLDOWN);
    if (cooldownExp > 0) {
        const timeLeft = Math.floor(cooldownExp / 1000);
        const msg = await message.reply(`Bạn cần nghỉ ngơi một chút. Thử lại sau <t:${timeLeft}:R>`);
        setTimeout(() => msg.delete().catch(() => {}), cooldownExp - Date.now());
        return;
    }

    // 1. CHECK TIỀN & TRỪ TIỀN (GLOBAL)
    const userBalance = await economy.getBalance(userId); 
    const huntPrice = HUNT_CONFIG.PRICE;

    if (userBalance.cash < huntPrice) {
        return message.reply(`Bạn không đủ tiền mặt! Cần **${huntPrice.toLocaleString()}** ${CURRENCY} để mua vé đi săn.`);
    }

    const deductSuccess = await economy.subtractMoney(userId, huntPrice, "Hunt Fee");
    if (!deductSuccess) {
        return message.reply("Có lỗi xảy ra khi trừ tiền.");
    }

    // 2. Lấy Buff (Global)
    const userBuffs = await economy.getUserBuffs(userId);
    
    // -- Buff Số Lượng --
    let huntCount = 3; 
    let quantityBuffInfo = "";
    if (userBuffs.qty_turns > 0) {
        const gemId = userBuffs.qty_gem_id;
        const bonus = HUNT_CONFIG.GEM_BUFFS[gemId]?.bonus || 0;
        huntCount += bonus;
        const gemIcon = SHOP_ITEMS[gemId]?.emoji || '';
        quantityBuffInfo = `${gemIcon} \`[${userBuffs.qty_turns}/${userBuffs.qty_total}]\``;
    }

    // -- Buff Tỉ Lệ --
    let activeClasses = JSON.parse(JSON.stringify(HUNT_CONFIG.CLASSES));
    let qualityBuffInfo = "";
    
    if (userBuffs.qual_turns > 0) {
        const gemId = userBuffs.qual_gem_id;
        const gemIcon = SHOP_ITEMS[gemId]?.emoji || '';
        qualityBuffInfo = `${gemIcon} \`[${userBuffs.qual_turns}/${userBuffs.qual_total}]\``;
        
        const buffPercents = HUNT_CONFIG.BUFF_RATES_PERCENTAGE;
        for (const [classKey, percentage] of Object.entries(buffPercents)) {
            if (activeClasses[classKey]) {
                const baseRate = activeClasses[classKey].rate;
                const increase = baseRate * (percentage / 100);
                activeClasses[classKey].rate = parseFloat((baseRate + increase).toFixed(2));
            }
        }
    }

    // 3. Logic Bắt Thú
    const caughtAnimals = [];
    const animalDisplayParts = []; 

    for (let i = 0; i < huntCount; i++) {
        const selectedClass = weightedRandom(activeClasses, true);
        const animalPool = HUNT_CONFIG.ANIMALS[selectedClass.key];
        
        if (!animalPool || animalPool.length === 0) {
            animalDisplayParts.push(`💨 Trượt`);
            continue;
        }

        const selectedAnimal = weightedRandom(animalPool, false);
        caughtAnimals.push(selectedAnimal);
        animalDisplayParts.push(`${selectedClass.emoji} **${selectedAnimal.name}** ${selectedAnimal.emoji}`);
    }

    // 4. Logic Drop Hòm (Global)
    checkAndResetDropState();
    let dropInfo = "";
    const now = Date.now();
    const timeSinceLastDrop = now - globalDropState.lastDropTime;
    const DROP_COOLDOWN = 5 * 60 * 1000; // 5 phút

    if (globalDropState.count < 10 && timeSinceLastDrop >= DROP_COOLDOWN) {
        const rand = getSecureRandom(10000); 
        let droppedItemKey = null;
        
        if (rand < 100) droppedItemKey = 'crateL';      // 1%
        else if (rand < 600) droppedItemKey = 'crate';  // 5%

        if (droppedItemKey) {
            // Add Item Global
            await economy.addItem(userId, droppedItemKey, 1);
            globalDropState.count++;
            globalDropState.lastDropTime = now;
            
            const itemData = SHOP_ITEMS[droppedItemKey];
            const minutesLeft = getMinutesUntilReset();
            
            dropInfo = `\n---------------------------------------------------------\n` +
                       `${itemData.emoji} | Bạn tìm thấy x1 **${itemData.name}** | \`[${globalDropState.count}/10] Reset: ${minutesLeft}p\``;
        }
    }

    // 5. Lưu Database (Global)
    if (caughtAnimals.length > 0) {
        await economy.addAnimals(userId, caughtAnimals);
    }
    await economy.decreaseBuffTurns(userId);

    // 6. Hiển thị
    let buffMessage = "";
    if (quantityBuffInfo || qualityBuffInfo) {
        buffMessage = `Khả năng săn bắt được tăng cường nhờ: ${quantityBuffInfo} ${qualityBuffInfo}\n`;
    }

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setAuthor({ 
            name: `${message.member ? message.member.displayName : message.author.username} Đang Đi Săn`, 
            iconURL: message.author.displayAvatarURL() 
        })
        .setDescription(
            `${buffMessage}\n` +
            animalDisplayParts.join(' | ') + 
            dropInfo
        )
        .setFooter({ text: "Sử dụng .zoo để xem kho thú" });

    message.channel.send({ embeds: [embed] });
}

// --- HÀM ADMIN SET GIÁ HUNT ---
async function handleSetHuntPrice(message, args) {
    if (message.author.id !== OWNER_ID) {
        return message.reply("⛔ Bạn không có quyền sử dụng lệnh này.");
    }

    const price = parseInt(args[0]);
    if (isNaN(price) || price < 0) {
        return message.reply(`Vui lòng nhập giá hợp lệ. Ví dụ: \`.sethuntprice 500\``);
    }

    HUNT_CONFIG.PRICE = price;
    return message.reply(`✅ Đã cập nhật giá Hunt thành: **${price.toLocaleString()}** ${CURRENCY}`);
}

// --- HÀM HELPER ĐỂ SET COOLDOWN ---
function setHuntCooldown(seconds) {
    const time = parseInt(seconds);
    if (isNaN(time) || time < 0) return false;
    
    HUNT_CONFIG.COOLDOWN = time;
    return true;
}

// --- HANDLE ZOO (GLOBAL - SỬA LỖI CHECK ID) ---
async function handleZoo(message, args) {
    let targetUser = message.author;
    let targetName = message.member ? message.member.displayName : message.author.username;
    let avatarUrl = targetUser.displayAvatarURL();

    // Logic tìm User thông minh (Dùng resolveGlobalUser)
    if (args.length > 0) {
        const foundUser = await resolveGlobalUser(message, args[0]);
        if (foundUser) {
            targetUser = foundUser;
            targetName = foundUser.globalName || foundUser.username;
            avatarUrl = foundUser.displayAvatarURL();
        } else {
            return message.reply("❌ Không tìm thấy sở thú của người này.");
        }
    }

    // Lấy Zoo Global
    const zooData = await economy.getZoo(targetUser.id);
    
    if (!zooData || !zooData.animals || Object.keys(zooData.animals).length === 0) {
        const isSelf = targetUser.id === message.author.id;
        return message.channel.send(isSelf 
            ? `🎒 Kho thú của bạn trống trơn! Đi săn ngay nào.`
            : `🎒 Kho thú của **${targetName}** trống trơn!`
        );
    }

    let description = "";
    let totalValue = 0;
    const classOrder = ['F', 'L', 'G', 'M', 'E', 'R', 'C', 'U'];
    
    for (const classKey of classOrder) {
        const classInfo = HUNT_CONFIG.CLASSES[classKey];
        const animalsInConfig = HUNT_CONFIG.ANIMALS[classKey];
        const userOwnedInClass = [];
        
        if (animalsInConfig) {
            for (const animal of animalsInConfig) {
                const quantity = zooData.animals[animal.id] || 0;
                if (quantity > 0) {
                    userOwnedInClass.push(`${animal.emoji}${toSuperscript(quantity)}`);
                    const pricePerUnit = animal.price || classInfo.price || 0;
                    totalValue += (pricePerUnit * quantity);
                }
            }
        }
        if (userOwnedInClass.length > 0) {
            description += `${classInfo.emoji} | ${userOwnedInClass.join('  ')}\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`🦁 Sở Thú Của ${targetName}`)
        .setDescription(description || "Lỗi hiển thị dữ liệu.")
        .setThumbnail(avatarUrl)
        // Fix hiển thị CURRENCY
        .setFooter({ text: `Tổng Giá Trị: ${totalValue.toLocaleString()} ${CURRENCY}` });

    message.channel.send({ embeds: [embed] });
}

module.exports = { 
    handleHunt, 
    handleZoo, 
    handleSetHuntPrice, 
    setHuntCooldown 
};