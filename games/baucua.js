// games/baucua.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { GAME_CONFIG, ANIMALS, CURRENCY } = require('../config');
const economy = require('../utils/economy');
const { parseBetAmount } = require('../utils/helpers');

// Map để lưu session cho từng kênh riêng biệt
const activeBauCuaSessions = new Map();

function resolveAnimal(keyword) {
    if (!keyword) return null;
    keyword = keyword.toLowerCase();
    for (const [key, data] of Object.entries(ANIMALS)) {
        if (data.keywords.includes(keyword)) return key;
    }
    return null;
}

// Xử lý lệnh .bc
async function handleBauCua(message, args, client) {
    const animalArg = args[0];
    const amountArg = args[1];
    // const guildId = message.guild.id; // Bỏ
    const channelId = message.channel.id;
    const userId = message.author.id;
    const displayName = message.member ? message.member.displayName : message.author.username;

    const currentSession = activeBauCuaSessions.get(channelId);

    // CASE 1: Mở bàn hoặc xem bàn
    if (!animalArg) {
        if (currentSession) return message.reply("Bàn Bầu Cua tại kênh này đang mở rồi, đặt nhanh đi bạn!");
        await startBauCuaGame(message, client);
        return;
    }

    // CASE 2: Đặt cược nhanh (.bc bau 10k)
    const animalKey = resolveAnimal(animalArg);
    if (!animalKey) return message.reply("Tên con vật không đúng! (bau, cua, tom, ca, ga, nai)");

    let amount = 0;
    if (amountArg && amountArg.toLowerCase() === 'all') {
        const balance = await economy.getBalance(userId); // Global Check
        amount = balance.cash > GAME_CONFIG.maxBetBauCua ? GAME_CONFIG.maxBetBauCua : balance.cash;
    } else {
        amount = parseBetAmount(amountArg);
    }

    if (amount <= 0) return message.reply("Tiền cược không hợp lệ!");

    if (!currentSession) {
        await startBauCuaGame(message, client);
    }
    // Global bet
    await placeBauCuaBet(userId, displayName, animalKey, amount, message);
}

async function startBauCuaGame(message, client) {
    const channelId = message.channel.id;
    if (activeBauCuaSessions.has(channelId)) return;

    const imagePath = './baucua.jpg';
    let attachment = null;
    if (fs.existsSync(imagePath)) attachment = new AttachmentBuilder(imagePath);

    const timeWait = GAME_CONFIG.bauCuaTime || 30; 
    const getEmbedDescription = (timeString) => {
        return "👉Chọn cửa và đặt cược bằng nút hoặc lệnh `.bc <con> <tiền>`\n" +
            "👉Nhà cái sẽ chờ bạn trong **30s**.\n" +
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
            "**Trạng thái:** Đang nhận cược\n" +
            `🕒 **Thời gian:** ${timeString}`;
    };

    const embed = new EmbedBuilder()
        .setTitle("MeoU Casino - Bầu Cua Tôm Cá")
        .setDescription(getEmbedDescription(`**${timeWait}s**`))
        .setColor('Gold')
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: "Uy tín - Xanh chín | MeoU Casino", iconURL: client.user.displayAvatarURL() });

    if (attachment) embed.setImage('attachment://baucua.jpg');

    const createBtn = (id, label, emoji, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
    
    const animalButtons1 = new ActionRowBuilder();
    const animalButtons2 = new ActionRowBuilder();
    let count = 0;
    for (const [key, data] of Object.entries(ANIMALS)) {
        const btn = createBtn(`animal_${key}`, data.name, data.emoji, data.style);
        if (count < 3) animalButtons1.addComponents(btn); else animalButtons2.addComponents(btn);
        count++;
    }
    
    const amountButtons1 = new ActionRowBuilder();
    const amountButtons2 = new ActionRowBuilder();
    const betLevels = [1000, 2000, 5000, 10000, 15000, 20000, 25000, 50000];

    betLevels.forEach((amt, index) => {
        const btn = createBtn(`amount_${amt}`, `${amt}`, '🪙', ButtonStyle.Secondary);
        if (index < 4) amountButtons1.addComponents(btn); 
        else amountButtons2.addComponents(btn); 
    });

    const sendOptions = { 
        embeds: [embed], 
        components: [animalButtons1, animalButtons2, amountButtons1, amountButtons2] 
    };
    if (attachment) sendOptions.files = [attachment];

    const gameMsg = await message.channel.send(sendOptions);

    const sessionData = {
        userBets: {}, 
        tempSelections: {}, 
        message: gameMsg,
        startTime: Date.now()
    };
    activeBauCuaSessions.set(channelId, sessionData);

    let timeLeft = timeWait;
    const timerInterval = setInterval(async () => {
        timeLeft--;
        if (timeLeft < 0) { clearInterval(timerInterval); return; }
        const currentS = activeBauCuaSessions.get(channelId);
        if (!currentS) { clearInterval(timerInterval); return; }

        try { if (timeLeft % 5 === 0 || timeLeft <= 5) await gameMsg.edit({ embeds: [EmbedBuilder.from(embed).setDescription(getEmbedDescription(`**${timeLeft}s**`))] }); } catch (e) {}
    }, 1000);

    const collector = gameMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: timeWait * 1000 });

    collector.on('collect', async (interaction) => {
        const userId = interaction.user.id;
        const displayName = interaction.member ? interaction.member.displayName : interaction.user.globalName;
        const session = activeBauCuaSessions.get(interaction.channelId);

        if (!session) {
             return interaction.reply({ content: "Ván chơi đã kết thúc!", flags: MessageFlags.Ephemeral });
        }

        if (interaction.customId.startsWith('animal_')) {
            const animalKey = interaction.customId.replace('animal_', '');
            session.tempSelections[userId] = animalKey;
            
            await interaction.reply({ 
                content: `👌 Bạn đã chọn **${ANIMALS[animalKey].emoji} ${ANIMALS[animalKey].name.trim()}**. Hãy chọn tiền cược!`, 
                flags: MessageFlags.Ephemeral 
            });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        } 
        else if (interaction.customId.startsWith('amount_')) {
            if (!session.tempSelections[userId]) {
                const warn = await interaction.reply({ content: "Chọn con vật trước đã bạn ơi!", flags: MessageFlags.Ephemeral });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
                return;
            }
            const amount = parseInt(interaction.customId.replace('amount_', ''));
            const animalKey = session.tempSelections[userId];
            
            // Global Bet
            await placeBauCuaBet(userId, displayName, animalKey, amount, interaction);
            if (activeBauCuaSessions.get(interaction.channelId)) {
                delete activeBauCuaSessions.get(interaction.channelId).tempSelections[userId];
            }
        }
    });

    collector.on('end', async () => {
        const finishedSession = activeBauCuaSessions.get(channelId);
        activeBauCuaSessions.delete(channelId);
        clearInterval(timerInterval);

        const endEmbed = EmbedBuilder.from(embed).setDescription(getEmbedDescription("🔴 Đã kết thúc")).setColor('Grey');
        try { await gameMsg.edit({ embeds: [endEmbed], components: [] }); } catch (e) {}

        const keys = Object.keys(ANIMALS);
        const results = [keys[Math.floor(Math.random()*keys.length)], keys[Math.floor(Math.random()*keys.length)], keys[Math.floor(Math.random()*keys.length)]];
        const resultString = results.map(k => `${ANIMALS[k].emoji} ${ANIMALS[k].name.trim()}`).join("  |  ");

        const resultLines = [];
        let hasWinner = false;

        if (finishedSession && finishedSession.userBets) {
            for (const [userId, userData] of Object.entries(finishedSession.userBets)) {
                let totalUserPayout = 0;
                const betsAggregated = {};
                for (const bet of userData.bets) {
                    if (!betsAggregated[bet.animal]) betsAggregated[bet.animal] = { count: 0, totalAmount: 0 };
                    betsAggregated[bet.animal].count += 1;
                    betsAggregated[bet.animal].totalAmount += bet.amount;
                    
                    const hitCount = results.filter(r => r === bet.animal).length;
                    if (hitCount > 0) totalUserPayout += (bet.amount + (bet.amount * hitCount));
                }
                const betDisplayString = Object.entries(betsAggregated).map(([k, d]) => `**${d.totalAmount.toLocaleString()}** ${CURRENCY} vào **${d.count}** ${ANIMALS[k].emoji}`).join(" + ");
                
                if (totalUserPayout > 0) {
                    hasWinner = true;
                    // Global Add Money
                    await economy.addMoney(userId, totalUserPayout, "Thắng Bầu Cua");
                    resultLines.push(`🟢 <@${userId}> đã cược ${betDisplayString} và ăn **${totalUserPayout.toLocaleString()}** ${CURRENCY}`);
                } else {
                    resultLines.push(`🔴 ${userData.name} đã cược ${betDisplayString} và mất sạch!`);
                }
            }
        }
        
        if (!hasWinner && resultLines.length > 0) resultLines.push("\n<a:haha:1457472038980685956> Nhà cái húp trọn ổ!");

        const resultEmbed = new EmbedBuilder()
            .setTitle("<a:hihi:1457471433302216724> KẾT QUẢ BẦU CUA <a:hihi:1457471433302216724>")
            .setDescription(`## ${resultString}`)
            .setColor('Red')
            .addFields({ name: "📜 TỔNG KẾT", value: resultLines.length > 0 ? resultLines.join("\n") : "Không có ai đặt cược.", inline: false })
            .setFooter({ text: "Cảm ơn đã cống hiến!", iconURL: client.user.displayAvatarURL() }).setTimestamp();
        await message.channel.send({ embeds: [resultEmbed] });
    });
}

// Hàm này đã bỏ guildId
async function placeBauCuaBet(userId, displayName, animalKey, amount, context) {
    const channelId = context.channel.id;
    const session = activeBauCuaSessions.get(channelId);

    const sendAndClear = async (content, isEphemeral = false) => {
        try {
            if (context.isButton && context.isButton()) {
                if (context.deferred || context.replied) {
                    await context.followUp({ content, flags: isEphemeral ? MessageFlags.Ephemeral : undefined });
                } else {
                    await context.reply({ content, flags: isEphemeral ? MessageFlags.Ephemeral : undefined });
                }
                setTimeout(() => context.deleteReply().catch(() => {}), 3000);
            } else {
                const msg = await context.channel.send(content);
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            }
        } catch (e) {
            console.error("Lỗi khi gửi/xóa tin nhắn:", e);
        }
    };

    if (!session) return sendAndClear("Bàn cược đã đóng hoặc chưa mở!", true);
    if (amount > GAME_CONFIG.maxBetBauCua) return sendAndClear(`⛔ Chỉ nhận cược tối đa **${GAME_CONFIG.maxBetBauCua.toLocaleString()}** thôi!`, true);

    // Global Check
    const balance = await economy.getBalance(userId);
    if (balance.cash < amount) return sendAndClear(`**Không đủ tiền mặt!** (Có ${balance.cash.toLocaleString()} ${CURRENCY})`, true);

    // Global Deduct
    const success = await economy.subtractMoney(userId, amount, `Bet Bau Cua: ${ANIMALS[animalKey].name.trim()}`);
    if (success) {
        if (!session.userBets[userId]) session.userBets[userId] = { name: displayName, bets: [] };
        session.userBets[userId].bets.push({ animal: animalKey, amount: amount });

        const embed = new EmbedBuilder()
            .setColor('LuminousVividPink') 
            .setDescription(`🔥 <@${userId}> đã cược **${amount.toLocaleString()}** ${CURRENCY} vào **${ANIMALS[animalKey].emoji} ${ANIMALS[animalKey].name.trim()}**!`);

        if (context.isButton && context.isButton()) {
            if (context.deferred || context.replied) await context.followUp({ embeds: [embed] });
            else await context.reply({ embeds: [embed] });
        } else {
            await context.channel.send({ embeds: [embed] });
        }
    } else {
        await sendAndClear("Lỗi hệ thống.", true);
    }
}

module.exports = { handleBauCua };