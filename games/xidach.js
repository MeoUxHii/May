// games/xidach.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { GAME_CONFIG, CURRENCY } = require('../config');
const economy = require('../utils/economy');
const E = require('../emoji');
const { parseBetAmount } = require('../utils/helpers');

const xiDachSessions = {}; 

const CARD_EMOJIS = E.CARDS;

// ... (Giữ nguyên các hàm helper deck/score để tiết kiệm không gian) ...
function createDeck() { let deck = []; const SUITS = ['d', 'c', 'b', 'a']; const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a']; for (let suit of SUITS) { for (let rank of RANKS) { let value; if (['j', 'q', 'k', '10'].includes(rank)) value = 10; else if (rank === 'a') value = 11; else value = parseInt(rank); const key = `${rank}${suit}`; const emoji = CARD_EMOJIS[key] || `[${key}]`; deck.push({ rank: rank === '10' ? '10' : rank.toUpperCase(), suit, value, emoji: emoji }); } } for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function calculateScore(hand) { let score = 0; let aces = 0; for (let card of hand) { score += card.value; if (card.rank === 'A') aces += 1; } while (score > 21 && aces > 0) { score -= 10; aces -= 1; } return score; }
function checkSpecialHand(hand) { if (hand.length !== 2) return null; if (hand[0].rank === 'A' && hand[1].rank === 'A') return 'xi_ban'; const hasAce = hand.some(c => c.rank === 'A'); const hasTen = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.rank)); if (hasAce && hasTen) return 'xi_dach'; return null; }
function getHandString(hand, hideFirst = false) { if (hideFirst) { const hiddenCard = CARD_EMOJIS['xx']; const visibleCards = hand.slice(1).map(c => c.emoji).join(" "); return `${hiddenCard} ${visibleCards}`; } return hand.map(c => c.emoji).join(" "); }

async function handleXiDach(message, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id; // Bỏ

    if (xiDachSessions[userId]) return message.reply("bạn đang chơi một ván rồi, tập trung đi bạn!");
    
    let betAmount = 0;
    let balance = null;

    if (args[0] && args[0].toLowerCase() === 'all') {
        balance = await economy.getBalance(userId); // Global
        betAmount = balance.cash > GAME_CONFIG.maxBetXiDach ? GAME_CONFIG.maxBetXiDach : balance.cash;
    } else {
        betAmount = parseBetAmount(args[0]);
    }

    if (betAmount <= 0) return message.reply("Cược bao nhiêu nói rõ đi bạn! Ví dụ: `.xd 5000` hoặc `.xd all`");
    if (betAmount > GAME_CONFIG.maxBetXiDach) return message.reply(`⛔ Sòng bài chỉ nhận cược Xì Dách tối đa **${GAME_CONFIG.maxBetXiDach.toLocaleString()}** ${CURRENCY} thôi bạn nhé!`);
    
    if (!balance) balance = await economy.getBalance(userId); // Global
    if (balance.cash < betAmount) return message.reply(`Tiền đâu mà chơi bạn ơi? (Có ${balance.cash.toLocaleString()} ${CURRENCY})`);
    
    const success = await economy.subtractMoney(userId, betAmount, "Bet Xi Dach");
    if (!success) return message.reply("Lỗi trừ tiền.");
    
    setupXiDachGame(message, userId, betAmount);
}

async function setupXiDachGame(message, userId, initialBet) {
    const deck = createDeck();
    let tempPHand = [deck[deck.length-1], deck[deck.length-2]];
    let tempScore = calculateScore(tempPHand);
    let tempSpecial = checkSpecialHand(tempPHand);
    if (tempScore >= 18 || tempSpecial) { if (Math.random() < 0.3) { const swapIndex = 20; const userCardIndex = deck.length - 2; [deck[userCardIndex], deck[swapIndex]] = [deck[swapIndex], deck[userCardIndex]]; } }
    
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    let currentBet = initialBet;
    xiDachSessions[userId] = { deck, playerHand, dealerHand, currentBet, startTime: Date.now() };

    const getEmbed = (isEnd = false, resultText = "") => {
        const pScore = calculateScore(playerHand);
        const pSpecial = checkSpecialHand(playerHand);
        const pStatus = pSpecial ? (pSpecial === 'xi_ban' ? " (Xì Bàn!)" : " (Xì Dách!)") : ` (${pScore} điểm)`;
        const dScore = calculateScore(dealerHand);
        const dSpecial = checkSpecialHand(dealerHand);
        const dDisplay = isEnd ? getHandString(dealerHand) : getHandString(dealerHand, true);
        const dStatus = isEnd ? (dSpecial ? (dSpecial === 'xi_ban' ? " (Xì Bàn!)" : " (Xì Dách!)") : ` (${dScore} điểm)`) : " (**?** Nút)";
        
        let embedColor = "Blue";
        if (isEnd) {
            if (resultText.includes("🤝")) embedColor = "Gold";
            else if (resultText.includes("🎉") || resultText.includes("🏆") || resultText.includes("🔥")) embedColor = "Green";
            else embedColor = "Red";
        }

        const embed = new EmbedBuilder().setTitle("🎲 Nhà Cái Đến Từ Châu Phi 🎲").setColor(embedColor).addFields({ name: `MeoU - ${dStatus}`, value: `${dDisplay}`, inline: false }, { name: `${message.author.username} - ${pStatus}`, value: `${getHandString(playerHand)}\n**Cược:** ${currentBet.toLocaleString()} ${CURRENCY}`, inline: false });
        if (resultText) embed.addFields({ name: "KẾT QUẢ", value: resultText });
        return embed;
    };

    const pSpecial = checkSpecialHand(playerHand); const dSpecial = checkSpecialHand(dealerHand);
    if (pSpecial || dSpecial) {
        let resultText = ""; let winnings = 0; let isDraw = false;
        if (pSpecial === 'xi_ban' && dSpecial === 'xi_ban') { resultText = "🤝 Hòa Xì Bàn! Hoàn tiền cho bạn."; isDraw = true; }
        else if (pSpecial === 'xi_ban') { resultText = "🎉 **XÌ BÀN!** Bạn thắng gấp đôi!"; winnings = currentBet * 3; } 
        else if (dSpecial === 'xi_ban') { resultText = "💀 Nhà cái **XÌ BÀN**! Bạn thua trắng."; winnings = 0; }
        else if (pSpecial === 'xi_dach' && dSpecial === 'xi_dach') { resultText = "🤝 Hòa Xì Dách! Hoàn tiền cho bạn."; isDraw = true; }
        else if (pSpecial === 'xi_dach') { resultText = "🎉 **XÌ DÁCH!** Lượm lúa!"; winnings = currentBet * 2; }
        else if (dSpecial === 'xi_dach') { resultText = "💀 Nhà cái **XÌ DÁCH**! Thua rồi."; winnings = 0; }
        else if (pSpecial) { resultText = "🎉 **XÌ DÁCH/XÌ BÀN!** Ngon lành."; winnings = currentBet * 2; } 
        else if (dSpecial) { resultText = "💀 Nhà cái có hàng nóng! Thua."; winnings = 0; }
        delete xiDachSessions[userId];
        // Global Add Money
        if (isDraw) await economy.addMoney(userId, currentBet, "Draw Xi Dach");
        else if (winnings > 0) await economy.addMoney(userId, winnings, "Win Xi Dach Special");
        return message.channel.send({ embeds: [getEmbed(true, resultText)] });
    }

    const getRow = (disableDouble = false) => {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hit').setLabel('Rút bài').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('stand').setLabel('Dừng').setStyle(ButtonStyle.Danger));
        if (!disableDouble) row.addComponents(new ButtonBuilder().setCustomId('double').setLabel('Cược x2').setStyle(ButtonStyle.Primary));
        return row;
    };

    const msg = await message.channel.send({ embeds: [getEmbed()], components: [getRow()] });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    
    collector.on('collect', async (i) => {
        if (i.user.id !== userId) return i.reply({ content: "🚫 Không phải sòng của bạn!", flags: MessageFlags.Ephemeral });
        
        if (i.customId === 'double') {
            // Global Check & Deduct
            const bal = await economy.getBalance(userId);
            if (bal.cash < currentBet) return i.reply({ content: `Không đủ tiền x2!`, flags: MessageFlags.Ephemeral });
            
            await economy.subtractMoney(userId, currentBet, "Double Xi Dach");
            currentBet *= 2; 
            xiDachSessions[userId].currentBet = currentBet;
            
            playerHand.push(deck.pop()); const score = calculateScore(playerHand);
            if (score > 21) { await i.update({ embeds: [getEmbed()], components: [] }); collector.stop('busted'); } else { await i.update({ embeds: [getEmbed()], components: [getRow(true)] }); }
        } else if (i.customId === 'hit') {
            playerHand.push(deck.pop()); const score = calculateScore(playerHand);
            if (playerHand.length === 5 && score <= 21) { await i.update({ embeds: [getEmbed()], components: [] }); collector.stop('ngu_linh'); return; }
            if (score > 21) { await i.update({ embeds: [getEmbed()], components: [] }); collector.stop('busted'); } else { await i.update({ embeds: [getEmbed()], components: [getRow(true)] }); }
        } else if (i.customId === 'stand') {
            const score = calculateScore(playerHand);
            if (score < 16) return i.reply({ content: "**Chưa đủ tuổi!**", flags: MessageFlags.Ephemeral });
            await i.update({ embeds: [getEmbed()], components: [] }); collector.stop('stand');
        }
    });

    collector.on('end', async (collected, reason) => {
        if (!xiDachSessions[userId]) return;
        let dealerScore = calculateScore(dealerHand);
        while (dealerScore < 17 && dealerHand.length < 5) { dealerHand.push(deck.pop()); dealerScore = calculateScore(dealerHand); }
        const pScore = calculateScore(playerHand); const dScore = calculateScore(dealerHand);
        let resultText = ""; let winAmount = 0;
        const pNguLinh = (playerHand.length === 5 && pScore <= 21); const dNguLinh = (dealerHand.length === 5 && dScore <= 21);
        if (pNguLinh && dNguLinh) { if (pScore > dScore) { resultText = "🏆 Cả 2 Ngũ Linh! Bạn thắng!"; winAmount = currentBet * 2; } else if (pScore < dScore) { resultText = "💀 Cả 2 Ngũ Linh! Bạn thua."; } else { resultText = "🤝 Hòa Ngũ Linh! Về tiền."; winAmount = currentBet; } }
        else if (pNguLinh) { resultText = "🔥 **NGŨ LINH!** Bạn thắng!"; winAmount = currentBet * 2; } else if (dNguLinh) { resultText = "💀 Nhà cái **NGŨ LINH**! Bạn thua."; }
        else {
            const pBust = pScore > 21; const dBust = dScore > 21;
            if (pBust && dBust) { resultText = "🤝 Cả 2 cùng **QUẮC**! Hoàn tiền."; winAmount = currentBet; } else if (pBust) { resultText = "💀 Bạn đã **QUẮC**!"; } else if (dBust) { resultText = "🎉 Nhà cái **QUẮC**! Bạn thắng!"; winAmount = currentBet * 2; }
            else { if (pScore > dScore) { resultText = `🎉 **THẮNG!** (${pScore} vs ${dScore})`; winAmount = currentBet * 2; } else if (pScore < dScore) { resultText = `💀 **THUA!** (${pScore} vs ${dScore})`; } else { resultText = `🤝 **HÒA!** (${pScore} vs ${dScore})`; winAmount = currentBet; } }
        }
        
        // Global Add Money
        if (winAmount > 0) await economy.addMoney(userId, winAmount, "Win Xi Dach");
        
        delete xiDachSessions[userId];
        try { await msg.edit({ embeds: [getEmbed(true, resultText)], components: [] }); } catch (e) {}
    });
}

module.exports = { handleXiDach };