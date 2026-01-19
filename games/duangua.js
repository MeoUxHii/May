const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType 
} = require('discord.js');
const { GAME_CONFIG, HORSES } = require('../config');
const economy = require('../utils/economy');

const activeRaces = new Set();

async function handleRace(message) {
    if (activeRaces.has(message.channel.id)) {
        return message.reply("Đang có một cuộc đua diễn ra ở kênh này rồi anh ơi!");
    }
    startRace(message);
}

async function startRace(message) {
    activeRaces.add(message.channel.id);
    const channel = message.channel;
    // const guildId = message.guild.id; // Bỏ guildId

    const TRACK_LENGTH = GAME_CONFIG.raceTrackLength || 28;
    const PAYOUT_RATE = GAME_CONFIG.racePayoutRate || 3;
    const MIN_BET = GAME_CONFIG.minBetRace || 1000;
    const MAX_BET = GAME_CONFIG.maxBetRace || 50000;

    const shuffled = [...HORSES].sort(() => 0.5 - Math.random());
    const raceHorses = shuffled.slice(0, 5).map(h => ({
        ...h,
        position: 0,
        finished: false
    }));

    const row = new ActionRowBuilder();
    
    raceHorses.forEach((h, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`bet_race_${index}`) 
                .setLabel(h.name)
                .setEmoji(h.icon) 
                .setStyle(ButtonStyle.Primary)
        );
    });

    const timeBet = GAME_CONFIG.raceBetTime || 30; 
    const endTime = Math.floor(Date.now() / 1000) + timeBet;

    const betEmbed = new EmbedBuilder()
        .setAuthor({ 
            name: 'Nhà Cái đến từ châu Phi', 
            iconURL: message.client.user.displayAvatarURL() 
        })
        .setTitle('🎰 SÒNG ĐUA NGỰA MỞ CỬA')
        .setDescription(
            `**LUẬT CHƠI**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `1. **Thể lệ:** 5 chiến mã sẽ đua trong 15 giây.\n` +
            `2. **Đặt cược:**\n` +
            `   - Tiền tươi thóc thật, đặt rồi miễn đòi lại.\n` +
            `   - Tỉ lệ ăn: **x${PAYOUT_RATE}**\n` +
            `   - Cược tối thiểu: **${MIN_BET.toLocaleString()}** 🪙 | Tối đa: **${MAX_BET.toLocaleString()}** 🪙\n` +
            `   - Thua thì coi như ủng hộ quỹ từ thiện 'Admin nghèo vượt khó'.\n\n` +
            `**Thời gian cược:** <t:${endTime}:R>\n\n` + 
            `**Danh sách ngựa đua:**\n` +
            raceHorses.map((h, i) => `> ${i+1}. ${h.icon} **${h.name}**`).join('\n')
        )
        .setColor('#FF0000') 
        .setFooter({ text: 'Nhà Cái Uy Tín - Chất Lượng!' });

    const betMsg = await channel.send({ 
        embeds: [betEmbed], 
        components: [row] 
    });

    const bets = new Map(); 

    const collector = betMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: timeBet * 1000 
    });

    collector.on('collect', async (interaction) => {
        const horseIndex = parseInt(interaction.customId.split('_')[2]); 
        const selectedHorse = raceHorses[horseIndex];

        const modal = new ModalBuilder()
            .setCustomId(`modal_bet_${interaction.id}`)
            .setTitle(`Cược cho ${selectedHorse.name}`);

        const amountInput = new TextInputBuilder()
            .setCustomId('betAmount')
            .setLabel("Nhập số tiền muốn cược:")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Từ ${MIN_BET.toLocaleString()} đến ${MAX_BET.toLocaleString()}`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(10);

        const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);

        try {
            const submitted = await interaction.awaitModalSubmit({
                time: 15000, 
                filter: (i) => i.customId === `modal_bet_${interaction.id}`
            });

            let amountStr = submitted.fields.getTextInputValue('betAmount');
            amountStr = amountStr.toLowerCase().replace(/k/g, '000').replace(/,/g, '');
            const amount = parseInt(amountStr);

            if (isNaN(amount)) {
                return submitted.reply({ content: "Số tiền không hợp lệ!", ephemeral: true });
            }

            if (amount < MIN_BET) {
                return submitted.reply({ content: `Đặt ít quá bạn ơi! Tối thiểu **${MIN_BET.toLocaleString()}** 🪙 mới nhận kèo nha.`, ephemeral: true });
            }

            if (amount > MAX_BET) {
                return submitted.reply({ content: `Số tiền quá lớn! Tối đa **${MAX_BET.toLocaleString()}** 🪙 thôi bạn.`, ephemeral: true });
            }

            if (bets.has(interaction.user.id)) {
                return submitted.reply({ content: "Bạn đã cược rồi, mỗi ván chỉ được chọn 1 con!", ephemeral: true });
            }

            // Global Check
            const balance = await economy.getBalance(interaction.user.id);
            if (balance.cash < amount) {
                return submitted.reply({ content: `Bạn không đủ tiền! Trong ví còn có **${balance.cash.toLocaleString()}** 🪙`, ephemeral: true });
            }

            // Global Deduct
            const success = await economy.subtractMoney(interaction.user.id, amount, `Bet Race: ${selectedHorse.name}`);
            if (success) {
                bets.set(interaction.user.id, { horse: selectedHorse.name, amount: amount, user: interaction.user });
                await submitted.reply({ 
                    content: `${interaction.user} đã đặt **${amount.toLocaleString()}** 🪙 cho **${selectedHorse.name}** ${selectedHorse.icon}!`,
                    ephemeral: false 
                });
            } else {
                return submitted.reply({ content: `Lỗi hệ thống khi trừ tiền!`, ephemeral: true });
            }

        } catch (error) {}
    });

    collector.on('end', async () => {
        const endedEmbed = EmbedBuilder.from(betEmbed)
            .setDescription(
                `⛔ **ĐÃ NGƯNG NHẬN CƯỢC**\n\n` +
                `**Danh sách ngựa đua:**\n` +
                raceHorses.map((h, i) => `> ${i+1}. ${h.icon} **${h.name}**`).join('\n')
            )
            .setColor('#808080'); 

        try {
            await betMsg.edit({ 
                embeds: [endedEmbed], 
                components: [] 
            });
        } catch (e) {}

        let round = 20; 
        
        const raceEmbed = new EmbedBuilder()
            .setTitle('🔥 TRƯỜNG ĐUA ĐÃ BẮT ĐẦU 🔥')
            .setDescription(renderRaceBoard(raceHorses, round, false, TRACK_LENGTH))
            .setColor('#FFA500'); 

        const raceMsg = await channel.send({ embeds: [raceEmbed] });

        const raceInterval = setInterval(async () => {
            round--;

            raceHorses.forEach(h => {
                const move = Math.floor(Math.random() * 3) + 1; 
                h.position += move;
                
                if (h.position > TRACK_LENGTH) {
                    h.position = TRACK_LENGTH;
                }
            });

            const finishers = raceHorses.filter(h => h.position >= TRACK_LENGTH);

            if (finishers.length > 0 || round <= 0) {
                clearInterval(raceInterval);
                
                let winner;
                
                if (finishers.length > 0) {
                    const winnersPool = finishers;
                    winner = winnersPool[Math.floor(Math.random() * winnersPool.length)];
                } else {
                    const maxPos = Math.max(...raceHorses.map(h => h.position));
                    const potentialWinners = raceHorses.filter(h => h.position === maxPos);
                    winner = potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
                }

                try {
                    const finalEmbed = EmbedBuilder.from(raceEmbed)
                        .setDescription(renderRaceBoard(raceHorses, 0, winner, TRACK_LENGTH)); 
                    await raceMsg.edit({ embeds: [finalEmbed] });
                } catch (e) { console.error(e); }

                finishRace(channel, winner, raceHorses, bets, PAYOUT_RATE);
            } else {
                try {
                    const updatedEmbed = EmbedBuilder.from(raceEmbed)
                        .setDescription(renderRaceBoard(raceHorses, round, null, TRACK_LENGTH));
                    await raceMsg.edit({ embeds: [updatedEmbed] });
                } catch (e) { console.error(e); }
            }

        }, 1000); 
    });
}

function renderRaceBoard(horses, timeLeft, winnerObj, trackLength) {
    let board = `⏱️ **Thời gian: ${timeLeft}s**\n\n`;
    
    horses.forEach(h => {
        const pos = Math.floor(h.position);
        
        const safePos = Math.min(pos, trackLength);
        const safeRemaining = Math.max(0, trackLength - safePos);

        const leftSpace = ' '.repeat(safePos); 
        const rightSpace = ' '.repeat(safeRemaining);
        
        let status = '|';
        if (winnerObj && h === winnerObj) {
            status = '🏁';
        }
        
        board += `\`|${leftSpace}\` ${h.icon} \`${rightSpace}|\` ${status} - **${h.name}**\n`;
    });
    return board;
}

// Bỏ guildId
async function finishRace(channel, winner, horses, bets, payoutRate) {
    let description = `<a:hihi:1457471433302216724>**QUÁN QUÂN:** ${winner.icon} **${winner.name}**\n\n`;

    const winnersList = [];
    const losersList = [];

    for (const [userId, betData] of bets) {
        const betHorse = horses.find(h => h.name === betData.horse);
        const horseIcon = betHorse ? betHorse.icon : '';

        if (betData.horse === winner.name) {
            const payout = betData.amount * payoutRate; 
            try {
                // Global Add Money
                await economy.addMoney(userId, payout, "Win Race");
                winnersList.push(`<@${userId}> đã đặt **${betData.amount.toLocaleString()}** 🪙 vào ${horseIcon} **${betData.horse}** và nhận được **${payout.toLocaleString()}** 🪙`);
            } catch (error) {
                console.error(`Lỗi trả thưởng cho ${userId}:`, error);
            }
        } else {
            const userName = betData.user.username;
            losersList.push(`<a:haha:1457472038980685956>**${userName}** đã đặt **${betData.amount.toLocaleString()}** 🪙 vào ${horseIcon} **${betData.horse}** và mất sạch không còn gì.`);
        }
    }

    if (winnersList.length > 0) {
        description += `${winnersList.join('\n')}\n\n`;
    }

    if (losersList.length > 0) {
        description += `${losersList.join('\n')}`;
    }

    if (bets.size === 0) {
        description += "\n👻 Không có ai cược ván này cả.";
    }

    const resultEmbed = new EmbedBuilder()
        .setTitle('<a:aha:1457473109992149033>KẾT QUẢ CUỘC ĐUA<a:aha:1457473109992149033> ')
        .setDescription(description)
        .setColor('#FFD700')
        .setThumbnail(winner.icon.match(/https?:\/\/[^\s]+/) ? winner.icon : null);

    channel.send({ embeds: [resultEmbed] });
    activeRaces.delete(channel.id);
}

module.exports = { handleRace };