// games/chicken.js
const { EmbedBuilder } = require('discord.js');
const { GAME_CONFIG, CURRENCY } = require('../config');
const economy = require('../utils/economy');
const { parseBetAmount } = require('../utils/helpers');

const chickenSessions = {}; 
const cockFightStats = {}; 

async function handleChicken(message, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id; // Bỏ

    // Xử lý khi đang dùng Chicken Box (Đá gà miễn phí/theo lượt)
    if (!args[0] && chickenSessions[userId]) {
        const session = chickenSessions[userId];
        if (Date.now() - session.startTime > 120000) {
            clearInterval(session.timer);
            delete chickenSessions[userId];
            return message.reply("Gà chết già rồi. Mua con khác đê!");
        }
        const isWin = Math.random() < GAME_CONFIG.winRateChickenBox;
        if (isWin) {
            session.wins++;
            let reward = 0;
            if (session.wins === 1) reward = 20000;
            if (session.wins === 2) reward = 15000;
            if (session.wins === 3) reward = 25000;

            // Global Add Money
            await economy.addMoney(userId, reward, "Chicken Fight Win");
            message.reply(`<:ga:1458577141804306643> của bạn đá thắng và mang về cho bạn **${reward.toLocaleString()}** ${CURRENCY}`);

            if (session.wins >= 3) {
                clearInterval(session.timer);
                delete chickenSessions[userId];
                message.reply(`**Gà Điên Xuất Hiện!** Gà của <@${userId}> đã thắng thông 3 trận liên tiếp và mang về **60,000** ${CURRENCY} Gà sẽ được thu hồi để tiêu hủy`);
            }
        } else {
            clearInterval(session.timer);
            delete chickenSessions[userId];
            message.reply(`🪦 **Gà của bạn đã tử trận!** Trò chơi kết thúc.`);
        }
        return;
    }

    // Xử lý đá gà thường (Cược tiền)
    let betAmount = 0;
    let balance = null;

    if (args[0] && args[0].toLowerCase() === 'all') {
        balance = await economy.getBalance(userId); // Global
        betAmount = balance.cash > GAME_CONFIG.maxBetDaGa ? GAME_CONFIG.maxBetDaGa : balance.cash;
    } else {
        betAmount = parseBetAmount(args[0]);
    }

    if (!args[0]) return message.reply("Nhập tiền vào bạn ơi! VD: `.dg 5000` hoặc `.dg all`");
    if (betAmount <= 0) return message.reply("Tiền cược tào lao!");
    if (betAmount > GAME_CONFIG.maxBetDaGa) return message.reply(`Cược tối đa **${GAME_CONFIG.maxBetDaGa.toLocaleString()}** thôi!`);

    if (!balance) balance = await economy.getBalance(userId); // Global
    if (balance.cash < betAmount) return message.reply(`Không đủ tiền! Bạn chỉ có ${balance.cash.toLocaleString()} ${CURRENCY}`);
    
    // Global Deduct
    const success = await economy.subtractMoney(userId, betAmount, "Bet Chicken Fight");
    if (!success) return message.reply("Lỗi trừ tiền.");

    if (!cockFightStats[userId]) cockFightStats[userId] = 0; 
    let winRate = GAME_CONFIG.winRateDaGaBase + (cockFightStats[userId] * 0.01); 
    if (winRate > GAME_CONFIG.winRateDaGaMax) winRate = GAME_CONFIG.winRateDaGaMax;
    
    const isWin = Math.random() < winRate;
    const embed = new EmbedBuilder().setAuthor({ name: "MeoU Miền Tây - Đá Gà", iconURL: message.author.displayAvatarURL() });

    if (isWin) {
        cockFightStats[userId]++;
        const winAmount = betAmount * 2; 
        // Global Add Money
        await economy.addMoney(userId, winAmount, "Win Chicken Fight");
        embed.setColor('Green').setDescription(`Gà của bạn đã thắng và mang về cho bạn **${winAmount.toLocaleString()}** ${CURRENCY}!\nChuỗi **${cockFightStats[userId]}** trận thắng <:ga:1458577141804306643>`).setFooter({ text: `Sức mạnh: ${Math.round(winRate*100)}%` });
    } else {
        cockFightStats[userId] = 0; 
        embed.setColor('Red').setDescription(`🪦 Gà của bạn đã về nơi chín suối!\nChuỗi win reset về 0.`).setFooter({ text: `Sức mạnh: ${Math.round(winRate*100)}%` });
    }
    return message.reply({ embeds: [embed] });
}

// Hàm kích hoạt Chicken Box (gọi từ file item_usage.js)
async function activateChickenBox(message, userId) {
    if (chickenSessions[userId]) {
        return { success: false, msg: "🚫 Đang có gà rồi, đá xong đi đã." };
    }
    const getDesc = (t) => `**Luật:** Trong **${t}s** hãy đá 3 trận đá gà.\n👊 Gõ \`.dg\` để đá.\n------------------------\n•Thắng 1 Lần: Nhận 20,000🪙\n•Thắng 2 Lần: Thêm 15,000🪙\n•Thắng 3 Lần: Thêm 25,000🪙`;
    const embed = new EmbedBuilder().setColor('DarkRed').setTitle("🐓 GÀ CHIẾN VÀO CHUỒNG!").setDescription(getDesc(120));
    const msg = await message.reply({ embeds: [embed] });
    
    let t = 120;
    const timer = setInterval(async () => { 
        t--; 
        if (t <= 0) { 
            clearInterval(timer); 
            delete chickenSessions[userId]; 
            msg.edit({ embeds: [EmbedBuilder.from(embed).setDescription("**HẾT GIỜ!**")] }); 
            return; 
        } 
        try { if(t % 5 === 0) msg.edit({ embeds: [EmbedBuilder.from(embed).setDescription(getDesc(t))] }); } catch (e) {} 
    }, 1000);
    
    chickenSessions[userId] = { wins: 0, startTime: Date.now(), timer: timer };
    return { success: true };
}

module.exports = { handleChicken, activateChickenBox };