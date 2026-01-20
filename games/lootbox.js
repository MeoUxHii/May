// games/lootbox.js
const { EmbedBuilder } = require('discord.js');
// Import thêm GEM_RATES_CRATE và GEM_RATES_CRATE_L từ config
const { SHOP_ITEMS, GEM_RATES, GEM_RATES_VIP, GEM_RATES_CRATE, GEM_RATES_CRATE_L, CURRENCY } = require('../config');
const economy = require('../utils/economy');

// Lưu trạng thái ai đang mở Luckybox để chờ lệnh .roll
const rollWaitList = {};

/**
 * Kích hoạt Luckybox (Gọi từ item_usage.js khi user gõ .use luckybox)
 */
async function activateLuckyBox(message, userId, item) {
    rollWaitList[userId] = true;
    const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle(`📦 ĐÃ MỞ ${item.name.toUpperCase()}`)
        .setDescription(item.useDescription || "Gõ `.roll 10` để thử vận may!");
    
    return message.reply({ embeds: [embed] });
}

/**
 * Xử lý lệnh .roll (Gọi từ index.js)
 */
async function handleRoll(message, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id; // Bỏ guildId

    if (!rollWaitList[userId]) return; // Chưa mở hộp thì không roll được (silent return)
    
    if (!args[0] || args[0] !== '10') {
        return message.reply("Gõ `.roll 10` mới đúng nha!");
    }
    
    // Xóa trạng thái chờ để tránh spam
    delete rollWaitList[userId];
    
    const result = Math.floor(Math.random() * 10) + 1;
    let win = 0;
    let msg = "";

    // Logic trả thưởng Luckybox
    if ([2, 5, 6].includes(result)) { 
        win = 15000; 
        msg = `🎲 Số **${result}** - Trúng **15,000** ${CURRENCY}`; 
    } else if (result === 10) { 
        win = 25000; 
        msg = `🎲 **JACKPOT!** Số **${result}** - Nhận Thêm **25,000** ${CURRENCY}`; 
    } else { 
        msg = `🎲 Số **${result}** - Còn đúng cái nịt!`; 
    }
    
    if (win > 0) {
        // Global Add Money (Không dùng guildId)
        await economy.addMoney(userId, win, "Lucky Box Win");
    }
    
    return message.reply(msg);
}

/**
 * Mở Lootbox/Crate (Gọi từ item_usage.js)
 */
async function openLootbox(message, userId, item, amount) {
    const boxName = item.name;
    const boxIcon = item.emoji;
    
    // --- SỬA ĐỔI LOGIC CHỌN RATE ---
    let rates;
    let fallbackGemId; // Gem mặc định nếu xui (để tránh crash)

    if (item.id === 'lootboxvip') {
        rates = GEM_RATES_VIP;
        fallbackGemId = 'gem1';
    } else if (item.id === 'crate') {
        rates = GEM_RATES_CRATE;
        fallbackGemId = 'gem1a';
    } else if (item.id === 'crateL') {
        rates = GEM_RATES_CRATE_L;
        fallbackGemId = 'gem1a';
    } else {
        // Mặc định là lootbox thường
        rates = GEM_RATES;
        fallbackGemId = 'gem1';
    }
    
    const activeRates = [...rates]; // Copy array

    // --- CASE 1: MỞ 1 CÁI ---
    if (amount === 1) {
        const openEmbed = new EmbedBuilder()
            .setColor(item.id.includes('vip') || item.id.includes('crateL') ? 'Gold' : 'Purple')
            .setTitle('**Tiến Hành Mở Hòm**')
            .setDescription(`--------------------------\n<@${userId}> đang mở ${boxName} và nhận được <a:lootboxopen:1461108774160039998>`);
        
        const msg = await message.reply({ embeds: [openEmbed] });

        // RNG
        const rand = Math.random() * 100;
        let accumulatedRate = 0;
        let selectedGem = null;
        
        for (const gem of activeRates) {
            accumulatedRate += gem.rate;
            if (rand <= accumulatedRate) {
                selectedGem = SHOP_ITEMS[gem.id];
                break;
            }
        }
        if (!selectedGem) selectedGem = SHOP_ITEMS[fallbackGemId]; // Fallback đúng loại

        // Add Item Global
        await economy.addItem(userId, selectedGem.id, 1);

        setTimeout(() => {
            const resultEmbed = new EmbedBuilder()
                .setColor(item.id.includes('vip') || item.id.includes('crateL') ? 'Gold' : 'Blue')
                .setTitle('**Mở Hòm Thành Công**')
                .setDescription(
                    `--------------------------\n` +
                    `<a:lootboxopened:1461118461186019330> **|** <@${userId}> đã mở ${boxName} và nhận được **${selectedGem.name}** ${selectedGem.emoji}\n\n` +
                    `• Ngọc đã được cất vào kho đồ.`
                );
            msg.edit({ embeds: [resultEmbed] }).catch(() => {});
        }, 2000);
        
    } 
    // --- CASE 2: MỞ NHIỀU CÁI ---
    else {
        let processLog = "";
        
        const getEmbed = (log, currentStepMsg = "") => {
            return new EmbedBuilder()
                .setColor(item.id.includes('vip') || item.id.includes('crateL') ? 'Gold' : 'Purple')
                .setTitle('**Tiến Hành Mở Hòm**')
                .setDescription(
                    `---------------------------------------------\n` +
                    `<@${userId}> đã tiến hành mở **${amount}** ${boxIcon} **${boxName}**\n\n` +
                    log +
                    currentStepMsg
                );
        };

        const msg = await message.reply({ embeds: [getEmbed(processLog)] });

        for (let i = 1; i <= amount; i++) {
            const openingMsg = `\nHòm số ${i} đang mở <a:lootboxopen:1461108774160039998> và nhận được...`;
            try { await msg.edit({ embeds: [getEmbed(processLog, openingMsg)] }); } catch (e) {}
            
            await new Promise(r => setTimeout(r, 1500)); // Delay animation

            const rand = Math.random() * 100;
            let accumulatedRate = 0;
            let selectedGem = null;
            for (const gem of activeRates) {
                accumulatedRate += gem.rate;
                if (rand <= accumulatedRate) {
                    selectedGem = SHOP_ITEMS[gem.id];
                    break;
                }
            }
            if (!selectedGem) selectedGem = SHOP_ITEMS[fallbackGemId]; // Fallback đúng loại

            await economy.addItem(userId, selectedGem.id, 1);
            await economy.logGemHistory(userId, selectedGem.id, selectedGem.name);
            
            processLog += `Hòm số ${i} đã mở <a:lootboxopened:1461118461186019330> và nhận được ${selectedGem.emoji} **${selectedGem.name}**\n`;
            
            try { await msg.edit({ embeds: [getEmbed(processLog)] }); } catch (e) {}
        }
    }
}

module.exports = { activateLuckyBox, handleRoll, openLootbox };