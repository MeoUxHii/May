const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
    MessageFlags, ComponentType 
} = require('discord.js');
const economy = require('../utils/economy');
const fs = require('fs');
const { GAME_CONFIG } = require('../config');

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const activeGames = new Map();

const BET_ALIASES = {
    'red': 'red', 'do': 'red', 'đỏ': 'red', 'd': 'red',
    'black': 'black', 'den': 'black', 'đen': 'black',
    'even': 'even', 'chan': 'even', 'chẵn': 'even', 'c': 'even',
    'odd': 'odd', 'le': 'odd', 'lẻ': 'odd', 'l': 'odd',
    '1-12': '1-12', '1st': '1-12', 'mot': '1-12', 'nhất': '1-12',
    '13-24': '13-24', '2nd': '13-24', 'hai': '13-24', 'nhì': '13-24',
    '25-36': '25-36', '3rd': '25-36', 'ba': '25-36',
};

async function handleRoulette(message, args) {
    if (args.length === 0) {
        if (activeGames.has(message.channel.id)) {
            return message.reply("Sòng đang mở rồi bạn ơi! Nhanh tay đặt cược đi nào.");
        }
        return startGame(message);
    }

    if (args.length >= 2) {
        const betTypeRaw = args[0]; 
        const amountRaw = args[1];  
        
        await handleCommandBet(message, betTypeRaw, amountRaw);
    }
}

async function handleCommandBet(message, typeInput, amountInput) {
    const channelId = message.channel.id;
    let gameState = activeGames.get(channelId);

    if (!gameState) {
        await startGame(message);
        gameState = activeGames.get(channelId);
        if (!gameState) return message.reply("Lỗi không thể mở sòng, bạn thử lại giúp mình nhé.");
    }

    let betType = null;
    let betValue = null;

    if (!isNaN(typeInput) && parseInt(typeInput) >= 0 && parseInt(typeInput) <= 36) {
        betType = 'specific';
        betValue = parseInt(typeInput);
    } else {
        betType = BET_ALIASES[typeInput];
    }

    if (!betType) {
        return message.reply(`Không hiểu cửa **"${typeInput}"** là cửa nào. Bạn thử: đỏ, đen, chẵn, lẻ, 1-12, hoặc số 0-36 xem.`);
    }

    let amountStr = amountInput.replace(/k/g, '000').replace(/,/g, '');
    let amount = parseInt(amountStr);

    if (isNaN(amount) || amount < GAME_CONFIG.minBet) {
        return message.reply(`Tiền cược không hợp lệ hoặc nhỏ quá bạn ơi (Tối thiểu ${GAME_CONFIG.minBet} 🪙).`);
    }

    await processBetLogic(
        message.channel, 
        message.author, 
        betType, 
        betValue, 
        amount, 
        true 
    );
}

async function startGame(message) {
    const endTime = Date.now() + GAME_CONFIG.countdown * 1000;
    // const guildId = message.guild.id; // Bỏ guildId
    
    activeGames.set(message.channel.id, {
        // guildId: guildId, // Bỏ
        endTime: endTime,
        bets: [], 
        usersSelection: new Map(), 
        userBetMessages: new Map(), 
        gameMsg: null
    });

    const rowBets1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bet_red').setLabel('Đỏ (x2)').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('bet_black').setLabel('Đen (x2)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bet_even').setLabel('Chẵn (x2)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bet_odd').setLabel('Lẻ (x2)').setStyle(ButtonStyle.Primary),
    );

    const rowBets2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bet_1-12').setLabel('1-12 (x3)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bet_13-24').setLabel('13-24 (x3)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bet_25-36').setLabel('25-36 (x3)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bet_specific').setLabel('🎯 Số (x36)').setStyle(ButtonStyle.Secondary),
    );
    
    const rowChips1 = new ActionRowBuilder().addComponents(
        createChipBtn(1000), createChipBtn(2000), createChipBtn(5000), createChipBtn(10000)
    );
    const rowChips2 = new ActionRowBuilder().addComponents(
        createChipBtn(15000), createChipBtn(20000), createChipBtn(25000), createChipBtn(50000)
    );

    let files = [];
    try {
        if (fs.existsSync('./roulette.png')) {
            const imageAttachment = new AttachmentBuilder('./roulette.png', { name: 'roulette.png' });
            files.push(imageAttachment);
        }
    } catch (e) { console.log("Thiếu ảnh roulette.png"); }

    const timestamp = Math.floor(endTime / 1000);

    const embed = new EmbedBuilder()
        .setTitle('ROULETTE - NHÀ CÁI ĐẾN TỪ CHÂU PHI')
        .setDescription(
            `⏱️ **CHỐT SỔ SAU:** <t:${timestamp}:R>\n\n` +
            `📜 **CÁCH CHƠI:**\n` +
            `1️⃣ **Dùng Nút:** Chọn Cửa -> Chọn Tiền.\n` +
            `2️⃣ **Dùng Lệnh:** Chat \`.rl <cửa> <tiền>\` (VD: \`.rl đỏ 50k\`, \`.rl 20 10k\`)\n` +
            `3️⃣ **Cửa hỗ trợ:** Đỏ, Đen, Chẵn, Lẻ, 1-12, 13-24, 25-36, Số 0-36.`
        )
        .setColor('#FF4500')
        .setFooter({ text: 'Xanh chín - Uy tín - Hỗ trợ lệnh chat' });

    if (files.length > 0) embed.setImage('attachment://roulette.png');

    const gameMsg = await message.channel.send({ 
        embeds: [embed], 
        components: [rowBets1, rowBets2, rowChips1, rowChips2], 
        files: files
    });

    const collector = gameMsg.createMessageComponentCollector({ 
        filter: i => !i.user.bot, 
        time: GAME_CONFIG.countdown * 1000 
    });
    
    const gameState = activeGames.get(message.channel.id);
    if (gameState) gameState.gameMsg = gameMsg; 

    collector.on('collect', async i => handleInteraction(i, message.channel.id));
    collector.on('end', async () => finishGame(message.channel));
}

function createChipBtn(amount) {
    return new ButtonBuilder()
        .setCustomId(`chip_${amount}`)
        .setLabel(`${amount.toLocaleString()} 🪙`)
        .setStyle(ButtonStyle.Secondary);
}

async function handleInteraction(interaction, channelId) {
    const gameState = activeGames.get(channelId);
    if (!gameState) return interaction.reply({ content: 'Ván chơi kết thúc rồi!', flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const customId = interaction.customId;

    if (customId.startsWith('bet_')) {
        const type = customId.replace('bet_', '');
        
        if (type === 'specific') {
            const modal = new ModalBuilder().setCustomId('modal_number').setTitle('Chọn Số May Mắn');
            const input = new TextInputBuilder().setCustomId('input_num').setLabel("Số (0-36)").setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            
            await interaction.showModal(modal);
            
            try {
                const modalSubmit = await interaction.awaitModalSubmit({ 
                    time: 60000, 
                    filter: i => i.customId === 'modal_number' && i.user.id === userId
                });
                
                const numStr = modalSubmit.fields.getTextInputValue('input_num');
                const number = parseInt(numStr);
                
                if (isNaN(number) || number < 0 || number > 36) {
                    await modalSubmit.reply({ content: 'Số không hợp lệ!', flags: MessageFlags.Ephemeral });
                } else {
                    gameState.usersSelection.set(userId, { type: 'specific', value: number });
                    await modalSubmit.reply({ content: ` Đã chọn số **${number}**. Bấm chọn tiền đi bạn!`, flags: MessageFlags.Ephemeral });
                    setTimeout(() => modalSubmit.deleteReply().catch(() => {}), 3000);
                }
            } catch (e) {}
            return;
        }

        gameState.usersSelection.set(userId, { type: type, value: null });
        
        await interaction.reply({ content: ` Đã chọn cửa **${type.toUpperCase()}**. Giờ bấm chọn tiền đi bạn!`, flags: MessageFlags.Ephemeral });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }

    if (customId.startsWith('chip_')) {
        const selection = gameState.usersSelection.get(userId);
        if (!selection) return interaction.reply({ content: `Chọn cửa cược trước đã bạn ơi!`, flags: MessageFlags.Ephemeral });

        const amount = parseInt(customId.split('_')[1]);
        
        await interaction.deferUpdate();
        await processBetLogic(interaction.channel, interaction.user, selection.type, selection.value, amount, true);
    }
}

async function processBetLogic(channel, user, type, value, amount, showPublicMsg) {
    const gameState = activeGames.get(channel.id);
    if (!gameState) {
        if (showPublicMsg) channel.send("Sòng đã đóng hoặc chưa mở kịp, bạn thử lại nhé.");
        return;
    }

    const currentTotal = gameState.bets
        .filter(b => b.userId === user.id)
        .reduce((sum, b) => sum + b.amount, 0);

    if (currentTotal + amount > GAME_CONFIG.maxTotalBet) {
        const msg = `🛑 Bạn chơi lớn quá! Giới hạn mỗi ván là ${GAME_CONFIG.maxTotalBet.toLocaleString()} 🪙 thôi.`;
        if (showPublicMsg) channel.send(msg);
        return;
    }

    try {
        // Global Balance Check (Bỏ guildId)
        const bal = await economy.getBalance(user.id);
        if (bal.cash < amount) {
            const msg = `**Không đủ lúa!** Bạn còn có ${bal.cash.toLocaleString()} 🪙 à.`;
            if (showPublicMsg) channel.send(msg);
            return;
        }
        
        // Global Deduct (Bỏ guildId)
        const success = await economy.subtractMoney(user.id, amount, "Bet Roulette");
        if (!success) {
             if (showPublicMsg) channel.send(`Lỗi hệ thống khi trừ tiền!`);
             return;
        }

        const existingBet = gameState.bets.find(b => 
            b.userId === user.id && 
            b.type === type && 
            b.value === value 
        );

        if (existingBet) {
            existingBet.amount += amount;
        } else {
            gameState.bets.push({
                userId: user.id,
                username: user.username,
                type: type,
                value: value,
                amount: amount
            });
        }

        if (showPublicMsg) {
            const userBets = gameState.bets.filter(b => b.userId === user.id);
            
            const betDescriptions = userBets.map(bet => {
                let betName = "";
                if (bet.type === 'specific') betName = `số **${bet.value}**`;
                else if (bet.type === 'red') betName = `**Đỏ**`;
                else if (bet.type === 'black') betName = `**Đen**`;
                else if (bet.type === 'even') betName = `**Chẵn**`;
                else if (bet.type === 'odd') betName = `**Lẻ**`;
                else betName = `khoảng **${bet.type}**`;
                
                return `**${bet.amount.toLocaleString()} 🪙** vào ${betName}`;
            });

            const fullDescription = `${user.toString()} đã cược tổng ${betDescriptions.join(' **+** ')}`;

            const pinkEmbed = new EmbedBuilder()
                .setColor('#FF69B4') 
                .setDescription(fullDescription)
                .setFooter({ text: 'Nhà cái nhận cược!' });

            const existingMsg = gameState.userBetMessages.get(user.id);

            if (existingMsg) {
                try {
                    await existingMsg.edit({ embeds: [pinkEmbed] });
                } catch (e) {
                    const newMsg = await channel.send({ embeds: [pinkEmbed] });
                    gameState.userBetMessages.set(user.id, newMsg);
                }
            } else {
                const newMsg = await channel.send({ embeds: [pinkEmbed] });
                gameState.userBetMessages.set(user.id, newMsg);
            }
        } 

    } catch (e) {
        console.error(e);
        if (showPublicMsg) channel.send("Lỗi kết nối ngân hàng hoặc Bot chưa có quyền!");
    }
}

async function finishGame(channel) {
    const gameState = activeGames.get(channel.id);
    if (!gameState) return;

    if (gameState.gameMsg) {
        try {
            const disabledRows = gameState.gameMsg.components.map(row => {
                const r = ActionRowBuilder.from(row);
                r.components.forEach(c => c.setDisabled(true));
                return r;
            });
            await gameState.gameMsg.edit({ components: disabledRows });
        } catch (e) {}
    }

    activeGames.delete(channel.id);

    const resultNum = Math.floor(Math.random() * 37);
    
    let color = 'green'; 
    if (RED_NUMBERS.includes(resultNum)) color = 'red';
    else if (resultNum !== 0) color = 'black';

    const isEven = resultNum !== 0 && resultNum % 2 === 0;
    const colorEmoji = { 'red': '🔴', 'black': '⚫', 'green': '🟢' };

    const playerResults = new Map();

    for (const bet of gameState.bets) {
        let multiplier = 0;

        if (bet.type === 'specific' && bet.value === resultNum) multiplier = 36;
        else if (bet.type === 'red' && color === 'red') multiplier = 2;
        else if (bet.type === 'black' && color === 'black') multiplier = 2;
        else if (bet.type === 'even' && isEven) multiplier = 2;
        else if (bet.type === 'odd' && !isEven && resultNum !== 0) multiplier = 2;
        else if (bet.type === '1-12' && resultNum >= 1 && resultNum <= 12) multiplier = 3;
        else if (bet.type === '13-24' && resultNum >= 13 && resultNum <= 24) multiplier = 3;
        else if (bet.type === '25-36' && resultNum >= 25 && resultNum <= 36) multiplier = 3;

        const payout = bet.amount * multiplier;

        if (!playerResults.has(bet.userId)) {
            playerResults.set(bet.userId, {
                totalBet: 0,
                totalPayout: 0,
                details: []
            });
        }

        const stats = playerResults.get(bet.userId);
        stats.totalBet += bet.amount;
        stats.totalPayout += payout;

        let betDisplay = bet.type === 'specific' ? `Số ${bet.value}` : bet.type.toUpperCase();
        if(betDisplay === 'RED') betDisplay = '**Đỏ**';
        if(betDisplay === 'BLACK') betDisplay = '**Đen**';
        if(betDisplay === 'EVEN') betDisplay = '**Chẵm**';
        if(betDisplay === 'ODD') betDisplay = '**Lẻ**';
        
        stats.details.push(`${bet.amount.toLocaleString()} 🪙 vào ${betDisplay}`);
    }

    const resultsList = [];
    
    for (const [userId, stats] of playerResults) {
        if (stats.totalPayout > 0) {
            try {
                // Global Add Money
                await economy.addMoney(userId, stats.totalPayout, "Win Roulette");
            } catch (e) { console.error(`Lỗi trả thưởng cho ${userId}:`, e); }
        }

        if (stats.totalPayout > 0) {
            if (stats.details.length === 1) {
                resultsList.push(
                    `<@${userId}> đã cược ${stats.details[0]} và mang về **${stats.totalPayout.toLocaleString()} 🪙**`
                );
            } else {
                const detailsStr = stats.details.join(' + ');
                resultsList.push(
                    `<@${userId}> đã cược ${detailsStr} tổng cộng hết **${stats.totalBet.toLocaleString()} 🪙** và mang về **${stats.totalPayout.toLocaleString()} 🪙**`
                );
            }
        } else {
            if (stats.details.length === 1) {
                resultsList.push(
                    `<@${userId}> đã cược ${stats.details[0]} và mất hết`
                );
            } else {
                const detailsStr = stats.details.join(' + ');
                resultsList.push(
                    `<@${userId}> đã cược ${detailsStr} tổng cộng hết **${stats.totalBet.toLocaleString()} 🪙** và nhà cái húp sạch. Hihi`
                );
            }
        }
    }

    const resultEmbed = new EmbedBuilder()
        .setAuthor({ 
            name: 'MeoU Tài Xỉu - Roulette', 
            iconURL: channel.client.user.displayAvatarURL() 
        })
        .setTitle(`🎲 KẾT QUẢ: ${colorEmoji[color]} ${resultNum} ${colorEmoji[color]}`)
        .setColor('#FFFF00') 
        .setDescription(resultsList.length > 0 ? resultsList.join('\n\n') : "Nhà cái húp trọn! Không ai chơi cả.");

    await channel.send({ embeds: [resultEmbed] });
}

module.exports = { handleRoulette };