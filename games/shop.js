// games/shop.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { SHOP_ITEMS, CURRENCY, GEM_RATES, GEM_RATES_VIP } = require('../config');
const economy = require('../utils/economy');
const gemMarket = require('../utils/gem_market');
const { findItemSmart } = require('../utils/helpers');

// ID CỦA BẠN
const OWNER_ID = '414792622289190917';

// Sync data shop lúc khởi động
async function initShopData() {
    if (economy.syncShopData) {
        await economy.syncShopData(SHOP_ITEMS);
    }
}

async function handleShop(message, cmd, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id; // Không cần dùng guildId cho economy nữa

    // --- ADMIN COMMANDS: ADDSTOCK & SETMONEY (CHỈ OWNER) ---
    if (cmd === '.addstock') {
        if (userId !== OWNER_ID) return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
        if (args.length < 2) return message.reply("Cú pháp: `.addstock <item> <số lượng>`");
        
        let quantity = parseInt(args[args.length - 1]);
        if (isNaN(quantity)) return message.reply("Số lượng không hợp lệ.");
        
        const searchKeyword = args.slice(0, -1).join(' ');
        const item = findItemSmart(searchKeyword);
        if (!item) return message.reply("Không tìm thấy item.");

        item.stock += quantity; 
        await economy.updateShopItem(item.id, { stock: item.stock });
        return message.reply(`✅ Đã thêm **${quantity}** vào kho **${item.name}**. Tồn kho hiện tại: **${item.stock}**`);
    }

    if (cmd === '.setmoney') {
        if (userId !== OWNER_ID) return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
        if (args.length < 2) return message.reply("Cú pháp: `.setmoney <item> <giá tiền>`");
        
        let price = parseInt(args[args.length - 1]);
        if (isNaN(price) || price < 0) return message.reply("Giá tiền không hợp lệ.");
        
        const searchKeyword = args.slice(0, -1).join(' ');
        const item = findItemSmart(searchKeyword);
        if (!item) return message.reply("Không tìm thấy item.");

        item.price = price; 
        await economy.updateShopItem(item.id, { price: item.price });
        return message.reply(`✅ Đã cập nhật giá **${item.name}** thành **${price.toLocaleString()} ${CURRENCY}**`);
    }

    // --- USER COMMANDS: VIEW SHOP & BUY ---
    if (['.ch', '.cuahang', '.shop'].includes(cmd)) {
        const embed = new EmbedBuilder().setTitle("🛒 TIỆM TẠP HÓA MEOU").setColor('Blue');
        
        const itemsToShow = Object.values(SHOP_ITEMS).filter(i => 
            i.price > 0 || ['crate', 'crateL'].includes(i.id)
        );

        itemsToShow.sort((a, b) => {
            const isBoxA = a.id.includes('box') || a.id.includes('crate');
            const isBoxB = b.id.includes('box') || b.id.includes('crate');
            if (isBoxA && !isBoxB) return -1;
            if (!isBoxA && isBoxB) return 1;
            return 0;
        });

        itemsToShow.forEach(i => {
            const priceDisplay = i.price > 0 ? `${i.price.toLocaleString()} ${CURRENCY}` : "**Miễn Phí (Sự kiện)**";
            const emojiDisplay = i.emoji ? i.emoji : '';
            embed.addFields({ 
                name: `${emojiDisplay} ${i.name} - ${priceDisplay}`, 
                value: `${i.description}\n**Kho: ${i.stock}**` 
            });
        });

        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === '.mua' || cmd === '.buy') {
        if (!args[0]) return message.reply("Bạn muốn mua gì? VD: `.mua lucky` hoặc `.mua lucky 10`");

        let quantity = 1;
        let searchKeyword = "";

        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg) && args.length > 1) {
            quantity = parseInt(lastArg);
            searchKeyword = args.slice(0, -1).join(' ').toLowerCase().trim();
        } else {
            searchKeyword = args.join(' ').toLowerCase().trim();
        }

        if (quantity <= 0) return message.reply("Số lượng phải lớn hơn 0.");

        const item = Object.values(SHOP_ITEMS).find(i => {
            if (i.keywords.some(k => k === searchKeyword || k.startsWith(searchKeyword))) return true;
            if (i.name.toLowerCase().includes(searchKeyword)) return true;
            return false;
        });

        if (!item) return message.reply("Shop không có món này hoặc bạn nhập chưa đúng tên.");
        
        if (item.price === 0 && !['crate', 'crateL'].includes(item.id)) {
            return message.reply("⛔ Item này không bán, chỉ có thể kiếm được!");
        }
        
        if (item.stock < quantity) return message.reply(`😭 Shop chỉ còn **${item.stock}** cái thôi.`);
        
        const totalPrice = item.price * quantity;
        
        // Trừ tiền Global (bỏ guildId)
        let transactionSuccess = true;
        if (totalPrice > 0) {
            transactionSuccess = await economy.subtractMoney(userId, totalPrice, `Mua ${quantity}x ${item.name}`);
        }

        if (transactionSuccess) {
            item.stock -= quantity;
            await economy.updateShopItem(item.id, { stock: item.stock });
            // Cộng item Global (bỏ guildId)
            await economy.addItem(userId, item.id, quantity);
            message.reply({ embeds: [new EmbedBuilder().setColor('Green').setTitle("🛍️ MUA THÀNH CÔNG").setDescription(`Đã mua **${quantity}x ${item.name}**\nĐã cất vào kho đồ (\`.inv\`).\nGõ \`.xai ${item.keywords[0]}\` để dùng.`)] });
            
        } else {
            return message.reply(`Không đủ tiền! Cần **${totalPrice.toLocaleString()} ${CURRENCY}**.`);
        }
    }
}

async function handleCheckPrice(message) {
    const content = message.content.trim();
    const args = content.split(/ +/).slice(1); 
    
    if (args.length === 0) {
        const embed = gemMarket.getMarketEmbed();
        return message.channel.send({ embeds: [embed] });
    } else {
        const searchKeyword = args.join(' ');
        const item = findItemSmart(searchKeyword);

        if (!item) return message.reply("Không tìm thấy loại Ngọc này.");
        if (!item.id.startsWith('gem')) return message.reply("Chỉ có thể xem lịch sử giá của các loại Ngọc.");

        const embed = await gemMarket.getGemHistoryEmbed(item.id); 
        return message.channel.send({ embeds: [embed] });
    }
}

async function handleSellGem(message, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id;

    if (args.length === 0) return message.reply("Bạn muốn bán gì? VD: `.ban thothach` hoặc `.ban thothach 10` hoặc `.ban thothach all`.");

    let quantity = 1;
    let isAll = false;
    let keywordArgs = args;

    const lastArg = args[args.length - 1].toLowerCase();
    if (lastArg === 'all') {
        isAll = true;
        keywordArgs = args.slice(0, -1);
    } else if (!isNaN(parseInt(lastArg))) {
        quantity = parseInt(lastArg);
        keywordArgs = args.slice(0, -1);
    }

    if (!isAll && quantity <= 0) return message.reply("Số lượng phải lớn hơn 0.");

    const searchKeyword = keywordArgs.length > 0 ? keywordArgs.join(' ') : args.join(' ');
    const item = findItemSmart(searchKeyword);

    if (!item) return message.reply("Không tìm thấy vật phẩm này.");
    if (!item.id.startsWith('gem')) {
        return message.reply("⛔ Chỉ có **Bảo Ngọc** mới có thể bán ở Chợ Đen!");
    }

    // Check kho Global (bỏ guildId)
    const currentStock = await economy.getItemAmount(userId, item.id);
    if (currentStock <= 0) {
        return message.reply(`Bạn không có **${item.name}** nào để bán.`);
    }

    if (isAll) {
        quantity = currentStock;
    } else if (quantity > currentStock) {
        quantity = currentStock;
    }

    const marketInfo = gemMarket.getGemPrice(item.id);
    const unitPrice = marketInfo.price;
    const totalPrice = unitPrice * quantity;

    const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('**MeoU Chợ Đen - Chợ Ngọc**')
        .setDescription(
            `--------------------------------\n` +
            `Bạn có chắc muốn bán **${quantity}x** ${item.emoji} **${item.name}** không?\n` +
            `Giá bán: **${unitPrice.toLocaleString()}** 🪙 / viên\n` +
            `Tổng nhận: **${totalPrice.toLocaleString()}** 🪙`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sell_yes').setLabel('Có').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sell_no').setLabel('Không').setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await message.reply({ embeds: [embed], components: [row] });

    const collector = replyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 30000,
        filter: i => i.user.id === userId 
    });

    collector.on('collect', async interaction => {
        if (interaction.customId === 'sell_no') {
            await interaction.update({ content: "Đã hủy lệnh bán.", embeds: [], components: [] });
            return;
        }

        if (interaction.customId === 'sell_yes') {
            // Check lại stock Global
            const amountCheck = await economy.getItemAmount(userId, item.id);
            if (amountCheck < quantity) {
                await interaction.update({ content: "Số lượng trong kho đã thay đổi!", embeds: [], components: [] });
                return;
            }

            // Trừ item Global
            const removeSuccess = await economy.removeItem(userId, item.id, quantity);
            if (removeSuccess) {
                // Cộng tiền Global
                await economy.addMoney(userId, totalPrice, `Sell ${quantity} ${item.name}`);
                const successEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('**MeoU Chợ Đen - Chợ Ngọc**')
                    .setDescription(
                        `--------------------------------\n` +
                        `Bạn đã bán **${quantity}x** ${item.emoji} **${item.name}** với giá **${totalPrice.toLocaleString()}** 🪙`
                    )
                    .setFooter({ text: "MeoU Thương Gia - Uy Tín hơn NYC Của Bạn" });

                await interaction.update({ embeds: [successEmbed], components: [] });
            } else {
                await interaction.update({ content: "Lỗi hệ thống khi giao dịch.", embeds: [], components: [] });
            }
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyMsg.edit({ content: "⏰ Hết thời gian xác nhận.", components: [] }).catch(() => {});
        }
    });
}

async function handleItemInfo(message, args) {
    // ... Logic giữ nguyên, không liên quan đến economy ...
    // (Đã có trong file gốc, không cần sửa đổi gì vì chỉ hiển thị thông tin tĩnh)
    const keyword = args[0] ? args[0].toLowerCase() : '';
    let isVip = false;
    let isNormal = false;

    if (['lootboxvip', 'lbvip', 'vip'].includes(keyword)) isVip = true;
    else if (['lootbox', 'lb'].includes(keyword)) isNormal = true;

    if (!isVip && !isNormal) {
        const item = findItemSmart(keyword);
        if (item) {
             const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`Thông tin vật phẩm: ${item.name}`)
                .setDescription(`${item.description}\n\nGiá: ${item.price} ${CURRENCY}\nTồn kho: ${item.stock}`);
             if (item.emoji) embed.setDescription(`${item.emoji} ${item.description}\n\nGiá: ${item.price} ${CURRENCY}\nTồn kho: ${item.stock}`);
             return message.reply({ embeds: [embed] });
        }
        return message.reply("Bạn muốn xem tỉ lệ hòm nào? `.iteminfo lb` hoặc `.iteminfo lbvip`");
    }

    const rates = isVip ? GEM_RATES_VIP : GEM_RATES;
    const boxItem = isVip ? SHOP_ITEMS['lootboxvip'] : SHOP_ITEMS['lootbox'];
    const boxName = boxItem.name;
    const boxIcon = boxItem.emoji;

    let listStr = "";
    for (const rateData of rates) {
        const item = SHOP_ITEMS[rateData.id];
        const percent = rateData.rate.toFixed(1).replace('.', ',');
        listStr += `${item.emoji} ${item.name.padEnd(16, ' ')} •         ${percent}%\n`;
    }

    const embed = new EmbedBuilder()
        .setColor(isVip ? 'Gold' : 'Blue')
        .setDescription(
            `Tỉ lệ mở hòm ${boxIcon} **${boxName}** là:\n` +
            `-----------------------------\n` +
            `|     Tên Ngọc       -          Tỉ Lệ |\n` +
            listStr
        );
        
    return message.channel.send({ embeds: [embed] });
}

module.exports = { initShopData, handleShop, handleCheckPrice, handleSellGem, handleItemInfo };