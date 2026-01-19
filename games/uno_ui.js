// games/uno_ui.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, AttachmentBuilder } = require('discord.js');
const { UNO_CONFIG } = require('../config.js');
const EMOJIS = require('./uno_emojis.js');

function createLobbyEmbed(game) {
    const playerList = game.players.map(p => `- ${p.toString()}`).join('\n');
    return new EmbedBuilder()
        .setTitle("LOBBY UNO RANKED")
        .setDescription(`Chủ sòng: ${game.host.toString()}\nCược: **${game.betAmount.toLocaleString()}** 🪙\n\n------------------------\n**Danh Sách Tham Gia:**\n${playerList}`)
        .setColor(Colors.Green);
}

function createHelpEmbed() {
    return new EmbedBuilder()
        .setTitle("**MeoU UNO - Hướng Dẫn Cơ Bản**")
        .setDescription(
            "—--------------------------------------\n" +
            "**1. Chế Độ Chơi:**\n" +
            "• Solo Mode: Gõ `.uno <tiền cược>` để tiến hành đấu với BOT\n" +
            "• Ranked Mode: Gõ `.uno add <tiền cược>` để tiến hành tạo bàn đấu. Tối thiểu 2 người chơi và tối đa 5 người chơi để bắt đầu bàn đấu.\n" +
            "—--------------------------------------------\n" +
            "**2. Lá bài chức năng**\n" +
            `• Cấm lượt - ${EMOJIS.YSKIP}: Khi đánh lá này, người chơi kế tiếp sẽ bị mất lượt.\n` +
            `• Đổi chiều - ${EMOJIS.YREVERSE}: Đảo ngược chiều đánh bài. Ví dụ đang đánh theo chiều kim đồng hồ thì đổi thành ngược chiều kim đồng hồ.\n` +
            `• Cộng 2 - ${EMOJIS.Yplus2}: Người chơi kế tiếp bắt buộc phải bốc 2 lá bài và mất lượt đánh.\n` +
            `• Đổi Màu - ${EMOJIS.WILD}: Có thể đánh lá này bất cứ lúc nào. Bạn được quyền chọn màu tiếp theo cho ván bài (Đỏ, Xanh, Vàng hoặc Lục).\n` +
            `• Đổi Màu Cộng 4 - ${EMOJIS.WILD4}: "Vũ khí hủy diệt". Bạn được chọn màu tiếp theo người chơi kế tiếp bắt buộc phải bốc 4 lá bài và mất lượt đánh.\n` +
            "—--------------------------------------------\n" +
            "**3. Nguyên tắc đánh bài:**\n" +
            "Khi đến lượt mình, bạn phải đánh 1 lá bài sao cho khớp với lá bài vừa được đánh trước đó theo quy tắc:\n" +
            `• Cùng màu: Ví dụ lá trước là ${EMOJIS.R7}, bạn có thể đánh bất kỳ lá nào màu Đỏ.\n` +
            `• Cùng số/kí hiệu: Ví dụ lá trước là ${EMOJIS.R7}, bạn có thể đánh lá ${EMOJIS.Y7}, ${EMOJIS.G7}...\n` +
            `• Lá bài chức năng: Lá ${EMOJIS.WILD} hoặc ${EMOJIS.WILD4} có thể đánh đè lên bất cứ màu nào.\n` +
            "—--------------------------------------------\n" +
            "**Nếu không có bài để đánh?**\n" +
            "Nếu trên tay bạn không có lá nào hợp lệ bạn phải bốc 1 lá từ chồng bài rút.\n" +
            "• Nếu lá vừa bốc đánh được luôn: Bạn có quyền đánh ngay lập tức hoặc bỏ lượt.\n" +
            "• Nếu vẫn không đánh được: Bạn giữ lá đó và chuyển lượt cho người kế tiếp.\n" +
            "—--------------------------------------------\n" +
            "**4. Luật hô \"UNO!\"**\n" +
            "Đây là luật tạo nên tên gọi của trò chơi.\n" +
            "Khi bạn đánh bài xuống và trên tay chỉ còn lại đúng 1 lá bài, anh phải bấm \"UNO!\".\n" +
            "• Hình phạt: Nếu bạn quên hô \"UNO\" và bị người khác/bot phát hiện trước khi người kế tiếp đánh bài, bạn sẽ phải bốc phạt 2 lá bài.\n" +
            "—--------------------------------------------\n" +
            "**5. Luật cộng dồn:**\n" +
            `Nếu người trước đánh lá ${EMOJIS.Yplus2}, người sau có thể đánh tiếp một lá ${EMOJIS.Bplus2} màu bất kì nữa để không phải bốc bài.\n` +
            `Người thứ 3 sẽ phải bốc tổng cộng 4 lá (2+2), hoặc đánh tiếp ${EMOJIS.Gplus2} để dồn cho người thứ 4 bốc 6 lá...\n` +
            `Tương tự với lá ${EMOJIS.WILD4}.`
        )
        .setColor(Colors.Green)
        .setFooter({ text: "UNO Đơn Giản Dễ Hiểu" });
}

function createBoardPayload(game, statusOverride = null) {
    const currentPlayer = game.getCurrentPlayer();
    const isBot = currentPlayer.id === "0";
    
    const turnDisplay = isBot ? "**MeoU Bot**" : currentPlayer.toString();
    const modeText = game.mode === 'solo' ? 'Solo Mode' : 'Ranked Mode';
    
    const cardIconKey = game.topCard.getIconKey(); 
    const fileName = `${cardIconKey}.png`;
    const attachment = new AttachmentBuilder(`./cards/${fileName}`, { name: fileName });

    let description = "";
    
    // 1. Thông tin cược
    const singleBet = game.betAmount.toLocaleString();
    const totalBet = (game.betAmount * game.players.length).toLocaleString();
    
    let betInfo = `💰 **Cược:** ${singleBet} 🪙`;
    if (game.mode === 'ranked') {
        betInfo += ` (Tổng: ${totalBet} 🪙)`;
    }
    description += `${betInfo}\n\n`;

    // 2. Lượt chơi
    description += `👉 Lượt Của: ${turnDisplay}\n\n`;

    // 3. Diễn biến lá bài vừa đánh
    let actionLine = "";
    if (game.lastPlayerName) {
        const lastPlayerDisplay = game.lastPlayerName === "Bot" ? "**MeoU Bot**" : `**${game.lastPlayerName}**`;
        actionLine = `⚡ Diễn Biến: ${lastPlayerDisplay} vừa đánh: ${game.topCard.toString()}`;
        if (game.lastPlayerName === "Bot" && game.hands.get("0").length === 1) {
             actionLine += " 📢 **UNO!**";
        }
    } else {
        actionLine = `🏁 Lá bài khởi điểm: ${game.topCard.toString()}`;
    }
    description += `${actionLine}\n`;
    
    // 4. Các trạng thái game (Cộng dồn / Thông báo lỗi/Auto)
    if (game.drawStack > 0) {
        description += `🔥 **Cộng dồn: +${game.drawStack} lá**\n`;
    }
    if (statusOverride) {
        description += `🔔 ${statusOverride}\n`;
    }

    // --- PHẦN MỚI THÊM: HIỂN THỊ SỐ LÁ BÀI ---
    description += `--------------------------\n`;

    if (game.mode === 'solo') {
        // Chế độ Solo: Hiện Bot
        const botHand = game.hands.get("0");
        const botCount = botHand ? botHand.length : 0;
        description += `🤖 **MeoU Bot** còn: **${botCount}** Lá\n`;
    } else {
        // Chế độ Ranked: Hiện danh sách người chơi
        const currentPlayerId = currentPlayer.id;
        
        game.players.forEach(p => {
            const hand = game.hands.get(p.id);
            const count = hand ? hand.length : 0;
            
            const isTurn = p.id === currentPlayerId;
            const statusSuffix = isTurn ? " <a:loading:1461163273872474162> **(Đang Chờ...)**" : ""; // Có thể thêm icon loading nếu muốn
            
            // Sử dụng username để hiển thị tên cho gọn
            description += `👤 **${p.username}** còn: **${count}** Lá${statusSuffix}\n`;
        });
    }
    // ------------------------------------------

    const embed = new EmbedBuilder()
        .setTitle(`Ván UNO của ${game.host.username} - ${modeText}`)
        .setColor(game.topCard.color === 'black' ? Colors.DarkButNotBlack : 
                  (game.topCard.color === '🔴' ? Colors.Red : 
                   game.topCard.color === '🔵' ? Colors.Blue : 
                   game.topCard.color === '🟢' ? Colors.Green : Colors.Gold))
        .setThumbnail(`attachment://${fileName}`)
        .setDescription(description)
        .setFooter({ text: "MeoU Uno - Uy Tín Hơn Cả NYC Của Bạn" });

    const components = [];
    
    if (game.mode === 'ranked') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('uno_get_hand')
                .setLabel('🃏 Bài Của Tôi')
                .setStyle(ButtonStyle.Success)
        );
        components.push(row);
    }

    return { embeds: [embed], files: [attachment], components: components };
}

function createHandRows(game, userId) {
    if (game.pendingWildUser === userId) {
        const row = new ActionRowBuilder();
        UNO_CONFIG.COLORS.forEach(color => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`uno_choose_color_${color}`)
                    .setLabel(color) 
                    .setStyle(ButtonStyle.Secondary)
            );
        });
        return [row];
    }

    const currentPlayer = game.getCurrentPlayer();
    const isMyTurn = currentPlayer.id === userId;

    const hand = game.hands.get(userId) || [];
    const rows = [];
    let currentRow = new ActionRowBuilder();

    // Giới hạn hiển thị tối đa 20 lá để không vỡ giao diện
    const maxCards = 20;
    const cardsToShow = hand.slice(0, maxCards);

    cardsToShow.forEach((card, index) => {
        if (index > 0 && index % 5 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        
        const playable = isMyTurn && card.canPlayOn(game.topCard, game.drawStack);
        const cardString = card.toString();
        const emojiIdMatch = cardString.match(/:(\d+)>/);
        
        const btn = new ButtonBuilder()
            .setCustomId(`uno_play_${card.id}`)
            .setStyle(playable ? ButtonStyle.Secondary : ButtonStyle.Secondary) 
            .setDisabled(!playable); 

        if (emojiIdMatch && emojiIdMatch[1]) {
            btn.setEmoji(emojiIdMatch[1]); 
        } else {
            btn.setLabel(cardString); 
        }

        currentRow.addComponents(btn);
    });

    if (currentRow.components.length >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
    }
    
    let drawLabel = "Rút";
    let drawStyle = ButtonStyle.Primary;
    if (game.drawStack > 0) {
        drawLabel = `Nhận ${game.drawStack} lá!`; 
        drawStyle = ButtonStyle.Danger;
    }

    currentRow.addComponents(
        new ButtonBuilder()
            .setCustomId('uno_draw_card')
            .setLabel(drawLabel)
            .setStyle(drawStyle)
            .setDisabled(!isMyTurn)
    );

    if (hand.length === 2 && !game.unoCalled) {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('uno_shout')
                .setLabel('UNO!')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!isMyTurn)
        );
    }

    rows.push(currentRow);
    return rows;
}

module.exports = { createLobbyEmbed, createBoardPayload, createHandRows, createHelpEmbed };