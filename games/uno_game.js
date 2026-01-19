// games/uno_game.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { UNO_CONFIG } = require('../config.js');
const EMOJIS = require('./uno_emojis.js');
const UI = require('./uno_ui.js');
const economy = require('../utils/economy.js');

// Store active games
const activeUnoGames = new Map();

class Card {
    constructor(type, color, value) {
        this.type = type;
        this.color = color;
        this.value = value;
        this.id = `card_${Math.random().toString(36).substr(2, 9)}`;
    }

    getIconKey() {
        const colorMap = { '🔴': 'R', '🔵': 'B', '🟢': 'G', '🟡': 'Y', 'black': '' };
        const prefix = colorMap[this.color] !== undefined ? colorMap[this.color] : '';
        let suffix = '';
        if (this.type === UNO_CONFIG.TYPES.NUMBER) suffix = this.value;
        else if (this.type === UNO_CONFIG.TYPES.SKIP) suffix = 'SKIP';
        else if (this.type === UNO_CONFIG.TYPES.REVERSE) suffix = 'REVERSE';
        else if (this.type === UNO_CONFIG.TYPES.DRAW2) suffix = 'plus2';
        else if (this.type === UNO_CONFIG.TYPES.WILD) suffix = 'WILD';
        else if (this.type === UNO_CONFIG.TYPES.WILD4) suffix = 'WILD4';
        return prefix + suffix;
    }

    toString() {
        const key = this.getIconKey();
        return EMOJIS[key] || `${this.value} ${this.color}`;
    }

    canPlayOn(topCard, activeDrawStack = 0) {
        if (activeDrawStack > 0) {
            if (topCard.type === UNO_CONFIG.TYPES.DRAW2) return this.type === UNO_CONFIG.TYPES.DRAW2 || this.type === UNO_CONFIG.TYPES.WILD4;
            if (topCard.type === UNO_CONFIG.TYPES.WILD4) return this.type === UNO_CONFIG.TYPES.WILD4;
            return false;
        }
        if (this.type === UNO_CONFIG.TYPES.WILD || this.type === UNO_CONFIG.TYPES.WILD4) return true;
        if (this.color === topCard.color) return true;
        if (this.type === UNO_CONFIG.TYPES.NUMBER && this.value === topCard.value) return true;
        if (this.type !== UNO_CONFIG.TYPES.NUMBER && this.type === topCard.type) return true;
        return false;
    }
}

class UnoGame {
    constructor(channel, betAmount, mode, host, onEndGame, onCancelLobby) {
        this.channel = channel;
        this.betAmount = betAmount;
        this.mode = mode; 
        this.host = host;
        this.onEndGame = onEndGame;
        this.onCancelLobby = onCancelLobby;
        this.players = []; 
        this.hands = new Map(); 
        this.publicHandMessages = new Map();
        this.playerInteractions = new Map(); 
        this.lobbyMessage = null;
        this.deck = [];
        this.currentTurnIndex = 0;
        this.direction = 1; 
        this.topCard = null;
        this.lastPlayedCard = null; 
        this.lastPlayerName = null; 
        this.gameOver = false;
        this.drawStack = 0; 
        this.pendingWildUser = null; 
        this.pendingWildCard = null; 
        this.boardMessage = null; 
        this.unoCalled = false; 
        this.turnTimer = null; 
        this.noJoinTimer = null;
        this.autoCancelTimer = null;
        this.generateDeck();
        if (this.mode === 'ranked') this.startLobbyTimers();
    }

    startLobbyTimers() {
        this.noJoinTimer = setTimeout(() => {
            if (this.onCancelLobby && this.players.length < 2) this.onCancelLobby(this, "Quá 5 phút không có người tham gia.");
        }, 5 * 60 * 1000);
        this.autoCancelTimer = setTimeout(() => {
            if (this.onCancelLobby) this.onCancelLobby(this, "Quá 10 phút sòng chưa bắt đầu.");
        }, 10 * 60 * 1000);
    }

    generateDeck() {
        this.deck = [];
        const Colors = UNO_CONFIG.COLORS;
        Colors.forEach(color => {
            this.deck.push(new Card(UNO_CONFIG.TYPES.NUMBER, color, 0));
            for (let i = 1; i <= 9; i++) {
                this.deck.push(new Card(UNO_CONFIG.TYPES.NUMBER, color, i));
                this.deck.push(new Card(UNO_CONFIG.TYPES.NUMBER, color, i));
            }
            for (let i = 0; i < 2; i++) {
                this.deck.push(new Card(UNO_CONFIG.TYPES.SKIP, color, -1));
                this.deck.push(new Card(UNO_CONFIG.TYPES.REVERSE, color, -1));
                this.deck.push(new Card(UNO_CONFIG.TYPES.DRAW2, color, -1));
            }
        });
        for (let i = 0; i < 4; i++) {
            this.deck.push(new Card(UNO_CONFIG.TYPES.WILD, 'black', -1));
            this.deck.push(new Card(UNO_CONFIG.TYPES.WILD4, 'black', -1));
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() {
        if (this.deck.length === 0) this.generateDeck(); 
        return this.deck.pop();
    }

    addPlayer(user) {
        if (!this.players.find(p => p.id === user.id)) this.players.push(user);
        if (this.players.length >= 2 && this.noJoinTimer) { clearTimeout(this.noJoinTimer); this.noJoinTimer = null; }
    }

    start() {
        if (this.noJoinTimer) clearTimeout(this.noJoinTimer);
        if (this.autoCancelTimer) clearTimeout(this.autoCancelTimer);
        this.players.forEach(p => this.hands.set(p.id, Array(7).fill(null).map(() => this.drawCard())));
        if (this.mode === 'solo') this.hands.set("0", Array(7).fill(null).map(() => this.drawCard()));
        let firstCard = this.drawCard();
        while (firstCard.type !== UNO_CONFIG.TYPES.NUMBER) {
            this.deck.unshift(firstCard); this.shuffleDeck(); firstCard = this.drawCard();
        }
        this.topCard = firstCard;
        this.lastPlayedCard = firstCard;
        this.lastPlayerName = null;
        this.drawStack = 0;
    }

    getCurrentPlayer() {
        if (this.mode === 'solo') return this.currentTurnIndex === 0 ? this.players[0] : { id: "0", username: "Bot", bot: true };
        return this.players[this.currentTurnIndex];
    }

    nextTurn(skip = false) {
        this.unoCalled = false;
        const total = this.mode === 'solo' ? 2 : this.players.length;
        let step = this.direction;
        if (skip) step *= 2; 
        this.currentTurnIndex = (this.currentTurnIndex + step) % total;
        if (this.currentTurnIndex < 0) this.currentTurnIndex += total;
        this.resetTurnTimer();
    }

    resetTurnTimer() {
        if (this.turnTimer) clearTimeout(this.turnTimer);
        if (this.gameOver) return;
        this.turnTimer = setTimeout(() => this.handleTimeout(), 30000);
    }

    async handleTimeout() {
        if (this.gameOver) return;
        const player = this.getCurrentPlayer();
        if (this.pendingWildUser && this.pendingWildUser === player.id) { await this.resolveWildPlay(player.id, UNO_CONFIG.COLORS[0], true); return; }
        if (player.bot) return;
        const hand = this.hands.get(player.id);
        const playableCardIndex = hand.findIndex(c => c.canPlayOn(this.topCard, this.drawStack));
        let actionMsg = "";
        if (playableCardIndex !== -1) {
            const card = hand[playableCardIndex];
            if (card.type === UNO_CONFIG.TYPES.WILD || card.type === UNO_CONFIG.TYPES.WILD4) {
                 hand.splice(playableCardIndex, 1); this.pendingWildCard = card;
                 await this.resolveWildPlay(player.id, UNO_CONFIG.COLORS[0], true); return;
            }
            hand.splice(playableCardIndex, 1);
            await this.executeCardPlay(player, card, "(Auto)");
        } else {
            if (this.drawStack > 0) {
                const count = this.drawStack; for(let i=0; i<count; i++) hand.push(this.drawCard());
                this.drawStack = 0; actionMsg = `(Auto) Phải rút ${count} lá!`;
            } else {
                hand.push(this.drawCard()); actionMsg = `(Auto) Rút 1 lá`;
            }
            this.nextTurn();
            this.updateBoardMessage(actionMsg);
            this.updateAllPlayersHands();
            if (this.mode === 'solo') await this.runBotTurn();
        }
    }

    async executeCardPlay(player, card, prefixMsg = "") {
        this.topCard = card; this.lastPlayedCard = card; this.lastPlayerName = player.username;
        let extraMsg = prefixMsg; let skipTurn = false;
        if (card.type === UNO_CONFIG.TYPES.DRAW2) { this.drawStack += 2; extraMsg += " (+2)"; } 
        else if (card.type === UNO_CONFIG.TYPES.WILD4) { this.drawStack += 4; extraMsg += " (+4)"; }
        else if (card.type === UNO_CONFIG.TYPES.SKIP) { skipTurn = true; extraMsg += " (Cấm)"; }
        else if (card.type === UNO_CONFIG.TYPES.REVERSE) {
            if (this.mode === 'solo' || this.players.length === 2) { skipTurn = true; extraMsg += " (Đảo - Đánh tiếp)"; }
            else { this.direction *= -1; extraMsg += " (Đảo chiều)"; }
        }
        if (this.boardMessage) { const payload = UI.createBoardPayload(this); await this.boardMessage.edit(payload).catch(() => {}); }
        const hand = this.hands.get(player.id);
        if (hand.length === 0) {
            this.gameOver = true;
            if (this.turnTimer) clearTimeout(this.turnTimer);
            setTimeout(async () => { await this.onEndGame(this, player); }, 1000);
            return;
        }
        this.nextTurn(skipTurn);
        this.updateBoardMessage();
        await this.updateAllPlayersHands();
        if (this.mode === 'solo' && !this.gameOver) await this.runBotTurn();
    }

    async resolveWildPlay(userId, color, isAuto = false) {
        const player = userId === "0" ? { id: "0", username: "Bot", bot: true } : this.players.find(p => p.id === userId);
        const card = this.pendingWildCard;
        card.color = color;
        this.pendingWildUser = null; this.pendingWildCard = null;
        await this.executeCardPlay(player, card, isAuto ? "(Auto)" : "");
    }

    updateBoardMessage(statusMsg = "") {
        if (this.boardMessage) { const payload = UI.createBoardPayload(this, statusMsg); this.boardMessage.edit(payload).catch(() => {}); }
    }
    
    async updateHandMessage(userId) {
        const rows = UI.createHandRows(this, userId);
        const user = this.players.find(p => p.id === userId);
        const endTime = Math.floor(Date.now() / 1000) + 30;
        const currentPlayer = this.getCurrentPlayer();
        const isMyTurn = currentPlayer.id === userId;
        const statusText = isMyTurn ? "⚡ **Lượt của Bạn**" : " **Đang Chờ Đối Thủ**";
        const content = `**${this.host.username}'s UNO Game**\n${user.toString()} ${statusText}\n*Hết giờ: <t:${endTime}:R>*`;
        if (this.mode === 'solo') {
            const msg = this.publicHandMessages.get(userId);
            if (msg) { try { await msg.edit({ content: content, components: rows }); } catch(e) {} }
        } else {
            const interaction = this.playerInteractions.get(userId);
            if (interaction) { try { await interaction.editReply({ content: content, components: rows }); } catch(e) {} }
        }
    }

    async updateAllPlayersHands() {
        for (const player of this.players) { if (!player.bot) await this.updateHandMessage(player.id); }
    }

    botPlay() {
        const botHand = this.hands.get("0");
        const playableCards = botHand.filter(c => c.canPlayOn(this.topCard, this.drawStack));
        if (playableCards.length > 0) {
            let cardToPlay = playableCards.find(c => (this.drawStack > 0 && (c.type === UNO_CONFIG.TYPES.DRAW2 || c.type === UNO_CONFIG.TYPES.WILD4)));
            if (!cardToPlay) cardToPlay = playableCards.find(c => c.type !== UNO_CONFIG.TYPES.WILD && c.type !== UNO_CONFIG.TYPES.WILD4);
            if (!cardToPlay) cardToPlay = playableCards[0];
            const index = botHand.indexOf(cardToPlay);
            botHand.splice(index, 1);
            if (cardToPlay.type === UNO_CONFIG.TYPES.WILD || cardToPlay.type === UNO_CONFIG.TYPES.WILD4) {
                const colorCounts = {};
                botHand.forEach(c => { if(c.color !== 'black') colorCounts[c.color] = (colorCounts[c.color] || 0) + 1; });
                const bestColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b, UNO_CONFIG.COLORS[0]);
                cardToPlay.color = bestColor;
            }
            let extra = botHand.length === 1 ? "\nBot **UNO!**" : "";
            return { action: 'play', card: cardToPlay, msg: `**Bot đã đánh** ${cardToPlay}${extra}` };
        } else {
            if (this.drawStack > 0) {
                const count = this.drawStack; for(let i=0; i<count; i++) botHand.push(this.drawCard());
                this.drawStack = 0;
                return { action: 'draw', msg: `Bot Đã Rút ${count} Lá - Lượt Của Bạn!` };
            } else {
                botHand.push(this.drawCard());
                return { action: 'draw', msg: "Bot Đã Rút 1 Lá - Lượt Của Bạn!" };
            }
        }
    }

    async runBotTurn() {
        this.updateAllPlayersHands();
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer.bot) return;
        setTimeout(async () => {
            if (this.gameOver || !this.getCurrentPlayer().bot) return;
            const result = this.botPlay(); 
            if (result.action === 'play') await this.executeCardPlay({ id: "0", username: "Bot", bot: true }, result.card);
            else {
                this.nextTurn(); this.updateBoardMessage(result.msg); this.updateAllPlayersHands();
            }
        }, 3000); 
    }
}

// --- CALLBACK FUNCTIONS ---
async function endGame(game, winner) {
    if (game.turnTimer) clearTimeout(game.turnTimer); 
    const isBotWinner = winner.id === "0" || winner.bot;
    let winnerName = isBotWinner ? "MeoU Bot" : winner.username;
    
    if (!isBotWinner) {
        let reward = game.mode === 'solo' ? game.betAmount * 2 : game.betAmount * game.players.length;
        // Global Add Money (bỏ guildId)
        await economy.addMoney(winner.id, reward, "Thắng UNO");
        game.channel.send(`🎉 Chúc mừng ${winner.toString()} húp **${reward.toLocaleString()}** 🪙!`);
    } else {
        game.channel.send(`🤖 Bot thắng! Bot xin tiền cược nhé.`);
    }

    const embed = new EmbedBuilder().setTitle("🏁 VÁN ĐẤU KẾT THÚC").setDescription(`🏆 Người chiến thắng: **${winnerName}**`).setColor(Colors.Red);
    await game.channel.send({ embeds: [embed] });
    
    game.publicHandMessages.forEach(async (msg) => { try { await msg.delete(); } catch(e) {} });
    activeUnoGames.delete(game.channel.id);
}

async function cancelLobby(game, reason) {
    if (game.noJoinTimer) clearTimeout(game.noJoinTimer);
    if (game.autoCancelTimer) clearTimeout(game.autoCancelTimer);
    for (const player of game.players) {
        // Global Refund (bỏ guildId)
        await economy.addMoney(player.id, game.betAmount, "Hoàn tiền UNO");
    }
    if (game.lobbyMessage) {
        const cancelEmbed = new EmbedBuilder().setTitle("Phòng Đã Bị Hủy").setDescription(`**Lý do:** ${reason}\n\nĐã hoàn tiền cược.`).setColor(Colors.Red);
        try { await game.lobbyMessage.edit({ embeds: [cancelEmbed], components: [] }); } catch (e) {}
    } else {
        game.channel.send(`**Phòng UNO đã bị hủy.**\nLý do: ${reason}\nĐã hoàn tiền.`);
    }
    activeUnoGames.delete(game.channel.id);
}

async function handleUnoCommand(message, args) {
    const allowedChannel = await economy.getGameChannel(message.guild.id, 'uno');
    if (allowedChannel && message.channel.id !== allowedChannel) {
        return message.reply(`🚫 UNO chỉ chơi được ở kênh <#${allowedChannel}>!`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
    }

    if (activeUnoGames.has(message.channel.id)) return message.reply("Đang có kèo rồi bạn ơi!");
    
    if (args[0] === 'help') {
        const helpEmbed = UI.createHelpEmbed();
        return message.channel.send({ embeds: [helpEmbed] });
    }

    let isMulti = false;
    let betAmount = 0;
    
    if (args[0] && args[0].toLowerCase() === 'add') {
        isMulti = true; 
        betAmount = parseInt(args[1]);
    } else {
        betAmount = parseInt(args[0]);
    }

    if (isNaN(betAmount) || betAmount < 1000 || betAmount > 50000) {
        return message.reply("Tiền cược phải từ **1,000** đến **50,000** 🪙!");
    }

    // Global Balance Check
    const bal = await economy.getBalance(message.author.id);
    if (bal.cash < betAmount) return message.reply("💸 Không đủ tiền cược!");

    const game = new UnoGame(message.channel, betAmount, isMulti ? 'ranked' : 'solo', message.author, endGame, cancelLobby);
    activeUnoGames.set(message.channel.id, game);

    if (!isMulti) {
        // Global Deduct (Solo)
        await economy.subtractMoney(message.author.id, betAmount, "Cược UNO Solo");
        game.addPlayer(message.author);
        game.start();

        const payload = UI.createBoardPayload(game);
        game.boardMessage = await message.channel.send(payload);
        
        const rows = UI.createHandRows(game, message.author.id);
        const endTime = Math.floor(Date.now() / 1000) + 30;
        const handMsg = await message.channel.send({ 
            content: `**${message.author.username}'s UNO Game**\n${message.author.toString()} ⚡ **Lượt của Bạn**\n*Hết giờ: <t:${endTime}:R>*`, 
            components: rows 
        });
        game.publicHandMessages.set(message.author.id, handMsg);
        game.resetTurnTimer();
    } else {
        // Global Deduct (Host Ranked)
        await economy.subtractMoney(message.author.id, betAmount, "Cược UNO Ranked");
        game.addPlayer(message.author);
        const lobbyEmbed = UI.createLobbyEmbed(game);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('uno_join').setLabel('Vào Trận').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('uno_start').setLabel('Bắt Đầu').setStyle(ButtonStyle.Danger)
        );
        game.lobbyMessage = await message.channel.send({ embeds: [lobbyEmbed], components: [row] });
    }
}

async function handleUnoInteraction(interaction) {
    const game = activeUnoGames.get(interaction.channelId);
    let targetGame = game;
    if (!targetGame && interaction.channel.type === 1) { 
        for (const [_, g] of activeUnoGames) {
            if (g.players.find(p => p.id === interaction.user.id)) { targetGame = g; break; }
        }
    }
    if (!targetGame) return interaction.reply({content: "Game không tồn tại!", ephemeral: true});

    const { customId, user } = interaction;

    if (customId === 'uno_join') {
        if (targetGame.players.find(p => p.id === user.id)) return interaction.reply({content: "Vào rồi!", ephemeral: true});
        if (targetGame.players.length >= 4) return interaction.reply({content: "Full slot!", ephemeral: true});
        
        // Global Check
        const bal = await economy.getBalance(user.id);
        if (bal.cash < targetGame.betAmount) return interaction.reply({content: "Không đủ tiền!", ephemeral: true});
        
        // Global Deduct (Join Ranked)
        await economy.subtractMoney(user.id, targetGame.betAmount, "Cược UNO Ranked");
        targetGame.addPlayer(user);
        await interaction.message.edit({ embeds: [UI.createLobbyEmbed(targetGame)] });
        await interaction.reply({ content: "Đã vào! Chờ chủ phòng start.", ephemeral: true });
        targetGame.playerInteractions.set(user.id, interaction);
    }
    else if (customId === 'uno_start') {
        if (user.id !== targetGame.host.id) return interaction.reply({content: "Chỉ chủ phòng mới được start!", ephemeral: true});
        if (targetGame.mode === 'ranked' && targetGame.players.length < 2) return interaction.reply({content: "Cần tối thiểu 2 người!", ephemeral: true});
        await interaction.message.delete().catch(()=>{});
        targetGame.start();
        const payload = UI.createBoardPayload(targetGame);
        targetGame.boardMessage = await interaction.channel.send(payload);
        targetGame.resetTurnTimer();
        interaction.deferUpdate();
    }
    else if (customId === 'uno_get_hand') {
        if (!targetGame.hands.has(user.id)) return interaction.reply({content: "Bạn không chơi ván này.", ephemeral: true});
        targetGame.playerInteractions.set(user.id, interaction);
        const rows = UI.createHandRows(targetGame, user.id);
        const endTime = Math.floor(Date.now() / 1000) + 30;
        const currentPlayer = targetGame.getCurrentPlayer();
        const isMyTurn = currentPlayer.id === user.id;
        const statusText = isMyTurn ? "⚡ **Lượt của Bạn**" : " **Đang Chờ Đối Thủ**";
        await interaction.reply({
            content: `**${targetGame.host.username}'s UNO Game**\n${user.toString()} ${statusText}\n*Hết giờ: <t:${endTime}:R>*`,
            components: rows,
            ephemeral: true
        });
    }
    else {
        const currentPlayer = targetGame.getCurrentPlayer();
        if (currentPlayer.id !== user.id) return interaction.reply({content: "Chưa đến lượt!", ephemeral: true});
        if (targetGame.mode === 'ranked') targetGame.playerInteractions.set(user.id, interaction);
        await interaction.deferUpdate().catch(() => {});

        if (customId === 'uno_shout') {
            targetGame.unoCalled = true;
            targetGame.updateHandMessage(user.id);
        }
        else if (customId.startsWith('uno_choose_color_')) {
            if (targetGame.pendingWildUser !== user.id) return;
            const color = customId.replace('uno_choose_color_', '');
            await targetGame.resolveWildPlay(user.id, color);
        }
        else if (customId === 'uno_draw_card') {
            if (targetGame.drawStack > 0) {
                const count = targetGame.drawStack;
                const hand = targetGame.hands.get(user.id);
                for(let i=0; i<count; i++) hand.push(targetGame.drawCard());
                targetGame.drawStack = 0;
                targetGame.nextTurn();
                targetGame.updateBoardMessage(`**${user.username}** bị phạt rút ${count} lá!`);
            } else {
                const newCard = targetGame.drawCard();
                targetGame.hands.get(user.id).push(newCard);
                if (newCard.canPlayOn(targetGame.topCard)) {
                    targetGame.updateHandMessage(user.id);
                    return; 
                } else {
                    targetGame.nextTurn();
                    targetGame.updateBoardMessage(`**${user.username}** rút bài và bỏ lượt.`);
                }
            }
            targetGame.updateAllPlayersHands();
            if (targetGame.mode === 'solo') await targetGame.runBotTurn();
        }
        else if (customId.startsWith('uno_play_')) {
            const cardId = customId.replace('uno_play_', '');
            const hand = targetGame.hands.get(user.id);
            const cardIndex = hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const card = hand[cardIndex];
            if (hand.length === 2 && !targetGame.unoCalled) {
                 const p1 = targetGame.drawCard(); const p2 = targetGame.drawCard();
                 hand.push(p1, p2);
            }
            if (card.type === UNO_CONFIG.TYPES.WILD || card.type === UNO_CONFIG.TYPES.WILD4) {
                 hand.splice(cardIndex, 1);
                 targetGame.pendingWildUser = user.id;
                 targetGame.pendingWildCard = card;
                 targetGame.updateHandMessage(user.id);
                 return;
            }
            hand.splice(cardIndex, 1);
            await targetGame.executeCardPlay(user, card);
        }
    }
}

module.exports = { handleUnoCommand, handleUnoInteraction };