// games/minigames.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { GAME_CONFIG, SHOP_ITEMS, CURRENCY, GEM_RATES, GEM_RATES_VIP, ADMIN_ROLE_ID } = require('../config');
const economy = require('../utils/economy');
const gemMarket = require('../utils/gem_market'); // Import Market Module
// --- IMPORT TỪ HELPER (FIX DRY) ---
const { parseBetAmount, findItemSmart } = require('../utils/helpers');

const rollWaitList = {};  
const chickenSessions = {}; 
const cockFightStats = {}; 

// --- ĐÃ XÓA: parseBetAmount (Dùng từ utils/helpers) ---
// --- ĐÃ XÓA: removeVietnameseTones (Dùng từ utils/helpers) ---
// --- ĐÃ XÓA: findItemSmart (Dùng từ utils/helpers) ---

// --- HÀM SYNC SHOP DATA ---
async function initShopData() {
    if (economy.syncShopData) {
        await economy.syncShopData(SHOP_ITEMS);
    }
}

// --- XỬ LÝ CHECK GIÁ GEM ---
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

// --- XỬ LÝ XEM ITEM INFO (Lootbox Rate) ---
async function handleItemInfo(message, args) {
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

// --- XỬ LÝ BÁN GEM (FIXED: Support Amount & All) ---
async function handleSellGem(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (args.length === 0) return message.reply("Bạn muốn bán gì? VD: `.ban thothach` hoặc `.ban thothach 10` hoặc `.ban thothach all`.");

    // Tách số lượng và từ khóa
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

    const currentStock = await economy.getItemAmount(guildId, userId, item.id);
    if (currentStock <= 0) {
        return message.reply(`Bạn không có **${item.name}** nào để bán.`);
    }

    // Điều chỉnh số lượng bán thực tế
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
            const amountCheck = await economy.getItemAmount(guildId, userId, item.id);
            if (amountCheck < quantity) {
                await interaction.update({ content: "Số lượng trong kho đã thay đổi!", embeds: [], components: [] });
                return;
            }

            const removeSuccess = await economy.removeItem(guildId, userId, item.id, quantity);
            if (removeSuccess) {
                await economy.addMoney(guildId, userId, totalPrice, `Sell ${quantity} ${item.name}`);
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

// --- XỬ LÝ REMOVE ITEM (ADMIN) ---
async function handleRemoveItem(message, args) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    const config = await economy.getConfig(guildId);
    const adminRoles = config.admin_roles || [];
    const isOwner = userId === message.guild.ownerId;
    const hasAdminRole = message.member.roles.cache.some(r => adminRoles.includes(r.id));
    const hasHardcodedAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID);

    if (!isOwner && !hasAdminRole && !hasHardcodedAdmin) {
        return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
    }

    const targetArg = args[args.length - 1];
    let targetType = null; 
    let targetObj = null;

    if (targetArg.match(/^<@!?(\d+)>$/)) {
        targetType = 'user';
        targetObj = message.mentions.members.first();
    } else if (targetArg.match(/^<@&(\d+)>$/)) {
        targetType = 'role';
        targetObj = message.mentions.roles.first();
    }

    if (!targetType || !targetObj) {
        return message.reply("Vui lòng tag User hoặc Role ở cuối lệnh. VD: `.remove-item lucky 1 @Huy`");
    }

    const amountArg = args[args.length - 2];
    let amount = parseInt(amountArg);
    
    if (isNaN(amount) || amount <= 0) {
        return message.reply("Số lượng không hợp lệ!");
    }

    const itemKeyword = args.slice(0, args.length - 2).join(' ');
    const item = findItemSmart(itemKeyword);

    if (!item) {
        return message.reply(`Không tìm thấy vật phẩm nào tên là "**${itemKeyword}**".`);
    }

    if (targetType === 'user') {
        const currentStock = await economy.getItemAmount(guildId, targetObj.id, item.id);
        const removeAmount = Math.min(currentStock, amount);
        
        if (removeAmount > 0) {
            await economy.removeItem(guildId, targetObj.id, item.id, removeAmount);
            return message.reply(`🗑️ Đã xóa **${removeAmount}x ${item.name}** khỏi kho của **${targetObj.displayName}**.`);
        } else {
            return message.reply(`User này không có **${item.name}** nào.`);
        }
    } else if (targetType === 'role') {
        await message.guild.members.fetch();
        const members = targetObj.members.filter(m => !m.user.bot);
        let count = 0;
        let totalRemoved = 0;

        for (const member of members.values()) {
            const currentStock = await economy.getItemAmount(guildId, member.id, item.id);
            const removeAmount = Math.min(currentStock, amount);
            if (removeAmount > 0) {
                await economy.removeItem(guildId, member.id, item.id, removeAmount);
                totalRemoved += removeAmount;
                count++;
            }
        }
        
        return message.reply(`🗑️ Đã xóa tổng cộng **${totalRemoved}x ${item.name}** từ **${count}** thành viên thuộc role **${targetObj.name}**.`);
    }
}

// --- XỬ LÝ ADD ITEM ---
async function handleAddItem(message, args) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    const config = await economy.getConfig(guildId);
    const adminRoles = config.admin_roles || [];
    const isOwner = userId === message.guild.ownerId;
    const hasAdminRole = message.member.roles.cache.some(r => adminRoles.includes(r.id));
    const hasHardcodedAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID);

    if (!isOwner && !hasAdminRole && !hasHardcodedAdmin) {
        return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
    }

    const targetArg = args[args.length - 1];
    let targetType = null;
    let targetObj = null;

    if (targetArg.match(/^<@!?(\d+)>$/)) {
        targetType = 'user';
        targetObj = message.mentions.members.first();
    } else if (targetArg.match(/^<@&(\d+)>$/)) {
        targetType = 'role';
        targetObj = message.mentions.roles.first();
    }

    if (!targetType || !targetObj) {
        return message.reply("Vui lòng tag User hoặc Role ở cuối lệnh. VD: `.additem lucky 10 @Huy`");
    }

    const amountArg = args[args.length - 2];
    let amount = parseInt(amountArg);
    
    if (isNaN(amount) || amount <= 0) {
        return message.reply("Số lượng không hợp lệ!");
    }

    const itemKeyword = args.slice(0, args.length - 2).join(' ');
    const item = findItemSmart(itemKeyword);

    if (!item) {
        return message.reply(`Không tìm thấy vật phẩm nào tên là "**${itemKeyword}**".`);
    }

    if (targetType === 'user') {
        await economy.addItem(guildId, targetObj.id, item.id, amount);
        return message.reply(`✅ Đã thêm **${amount}x ${item.name}** ${item.emoji || ''} vào kho của **${targetObj.displayName}**.`);
    } else if (targetType === 'role') {
        await message.guild.members.fetch();
        const members = targetObj.members.filter(m => !m.user.bot);
        const promises = members.map(m => economy.addItem(guildId, m.id, item.id, amount));
        await Promise.all(promises);
        return message.reply(`✅ Đã thêm **${amount}x ${item.name}** ${item.emoji || ''} cho **${members.size}** thành viên thuộc role **${targetObj.name}**.`);
    }
}

async function handleChicken(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;

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

            await economy.addMoney(guildId, userId, reward, "Chicken Fight Win");
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

    let betAmount = 0;
    let balance = null;

    if (args[0] && args[0].toLowerCase() === 'all') {
        balance = await economy.getBalance(guildId, userId);
        betAmount = balance.cash > GAME_CONFIG.maxBetDaGa ? GAME_CONFIG.maxBetDaGa : balance.cash;
    } else {
        betAmount = parseBetAmount(args[0]);
    }

    if (!args[0]) return message.reply("Nhập tiền vào bạn ơi! VD: `.dg 5000` hoặc `.dg all`");
    if (betAmount <= 0) return message.reply("Tiền cược tào lao!");
    if (betAmount > GAME_CONFIG.maxBetDaGa) return message.reply(`Cược tối đa **${GAME_CONFIG.maxBetDaGa.toLocaleString()}** thôi!`);

    if (!balance) balance = await economy.getBalance(guildId, userId);
    if (balance.cash < betAmount) return message.reply(`Không đủ tiền! Bạn chỉ có ${balance.cash.toLocaleString()} ${CURRENCY}`);
    
    const success = await economy.subtractMoney(guildId, userId, betAmount, "Bet Chicken Fight");
    if (!success) return message.reply("Lỗi trừ tiền.");

    if (!cockFightStats[userId]) cockFightStats[userId] = 0; 
    let winRate = GAME_CONFIG.winRateDaGaBase + (cockFightStats[userId] * 0.01); 
    if (winRate > GAME_CONFIG.winRateDaGaMax) winRate = GAME_CONFIG.winRateDaGaMax;
    
    const isWin = Math.random() < winRate;
    const embed = new EmbedBuilder().setAuthor({ name: "MeoU Miền Tây - Đá Gà", iconURL: message.author.displayAvatarURL() });

    if (isWin) {
        cockFightStats[userId]++;
        const winAmount = betAmount * 2; 
        await economy.addMoney(guildId, userId, winAmount, "Win Chicken Fight");
        embed.setColor('Green').setDescription(`Gà của bạn đã thắng và mang về cho bạn **${winAmount.toLocaleString()}** ${CURRENCY}!\nChuỗi **${cockFightStats[userId]}** trận thắng <:ga:1458577141804306643>`).setFooter({ text: `Sức mạnh: ${Math.round(winRate*100)}%` });
    } else {
        cockFightStats[userId] = 0; 
        embed.setColor('Red').setDescription(`🪦 Gà của bạn đã về nơi chín suối!\nChuỗi win reset về 0.`).setFooter({ text: `Sức mạnh: ${Math.round(winRate*100)}%` });
    }
    return message.reply({ embeds: [embed] });
}

async function handleRoll(message, args) {
    const userId = message.author.id;
    if (!rollWaitList[userId]) return;
    if (args[0] !== '10') return message.reply("Gõ `.roll 10` mới đúng nha!");
    
    const result = Math.floor(Math.random() * 10) + 1;
    delete rollWaitList[userId];
    
    let win = 0, msg = "";
    if ([2, 5, 6].includes(result)) { win = 15000; msg = `🎲 Số **${result}** - Trúng **15,000** ${CURRENCY}`; }
    else if (result === 10) { win = 25000; msg = `🎲 **JACKPOT!** Số **${result}** - Nhận Thêm **25,000** ${CURRENCY}`; }
    else { msg = `🎲 Số **${result}** - Còn đúng cái nịt!`; }
    
    if (win > 0) await economy.addMoney(message.guild.id, userId, win, "Lucky Box");
    return message.reply(msg);
}

async function handleInventory(message, args = []) {
    const guildId = message.guild.id;
    let targetUser = message.author;
    
    if (message.mentions.users.size > 0) {
        targetUser = message.mentions.users.first();
    } else if (args.length > 0) {
        const idArg = args[0];
        if (/^\d{17,19}$/.test(idArg)) {
            try {
                targetUser = await message.client.users.fetch(idArg);
            } catch (e) {
                return message.reply("Không tìm thấy thành viên với ID này.");
            }
        }
    }

    const displayName = targetUser.globalName || targetUser.username;
    const inventory = await economy.getInventory(guildId, targetUser.id);

    if (inventory.length === 0) { 
        return message.reply(targetUser.id === message.author.id 
            ? "Kho đồ của bạn trống trơn! Hãy ghé `.shop` để mua sắm nhé."
            : `Kho đồ của **${displayName}** trống trơn!`
        ); 
    }

    let description = "------------------------------\n";
    let index = 1;
    for (const invItem of inventory) {
        const itemConfig = SHOP_ITEMS[invItem.item_id];
        let itemName = itemConfig ? itemConfig.name : `Unknown Item (${invItem.item_id})`;
        if (itemConfig && itemConfig.emoji) {
            itemName += ` ${itemConfig.emoji}`;
        }
        description += `**${index}.** ${itemName} - **SL: ${invItem.amount}**\n`;
        index++;
    }
    description += "------------------------------";
    
    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`**Hòm Đồ Của ${displayName}**`)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL());
        
    return message.channel.send({ embeds: [embed] });
}

async function handleGiveItem(message, args) {
    const guildId = message.guild.id;
    const senderId = message.author.id;

    if (args.length < 2) return message.reply("Cú pháp: `.give-item <tên item> @user [số lượng]`");

    const targetUser = message.mentions.members.first();
    if (!targetUser) return message.reply("Bạn phải tag người nhận!");
    if (targetUser.id === senderId) return message.reply("Không thể tự tặng quà cho mình!");
    if (targetUser.user.bot) return message.reply("Bot không cần quà đâu!");

    const remainingArgs = args.filter(arg => !arg.includes(targetUser.id));

    if (remainingArgs.length === 0) return message.reply("Thiếu tên vật phẩm!");

    let amount = 1;
    const lastArg = remainingArgs[remainingArgs.length - 1];
    if (!isNaN(lastArg)) {
        amount = parseInt(lastArg);
        remainingArgs.pop();
    }

    if (amount <= 0) return message.reply("Số lượng không hợp lệ!");
    const itemKeyword = remainingArgs.join(" "); 
    const item = findItemSmart(itemKeyword);

    if (!item) return message.reply(`Không tìm thấy vật phẩm nào tên là "**${itemKeyword}**".`);

    const currentAmount = await economy.getItemAmount(guildId, senderId, item.id);
    if (currentAmount < amount) return message.reply(`Bạn không đủ **${item.name}** để tặng (Có: ${currentAmount}).`);

    const success = await economy.transferItem(guildId, senderId, targetUser.id, item.id, amount);
    if (success) {
        return message.reply(`✅ Đã chuyển **${amount}x ${item.name}** ${item.emoji || ''} cho ${targetUser}!`);
    } else {
        return message.reply("Lỗi khi chuyển vật phẩm. Vui lòng thử lại.");
    }
}

// --- XỬ LÝ SHOP & USE ITEM ---
async function handleShop(message, cmd, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    // --- ADMIN COMMANDS: ADDSTOCK & SETMONEY ---
    if (cmd === '.addstock') {
        const config = await economy.getConfig(guildId);
        const adminRoles = config.admin_roles || [];
        const isOwner = userId === message.guild.ownerId;
        const hasAdminRole = message.member.roles.cache.some(r => adminRoles.includes(r.id));
        
        if (!isOwner && !hasAdminRole) return message.reply("⛔ Bạn không có quyền!");
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
        const config = await economy.getConfig(guildId);
        const adminRoles = config.admin_roles || [];
        const isOwner = userId === message.guild.ownerId;
        const hasAdminRole = message.member.roles.cache.some(r => adminRoles.includes(r.id));

        if (!isOwner && !hasAdminRole) return message.reply("⛔ Bạn không có quyền!");
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

    if (['.ch', '.cuahang', '.shop'].includes(cmd)) {
        const embed = new EmbedBuilder().setTitle("🛒 TIỆM TẠP HÓA MEOU").setColor('Blue');
        Object.values(SHOP_ITEMS)
            .filter(i => i.price > 0)
            .forEach(i => embed.addFields({ name: `${i.name} ${i.emoji ? i.emoji : ''} - ${i.price.toLocaleString()} ${CURRENCY}`, value: `${i.description}\n**Kho: ${i.stock}**` }));
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
        if (item.price === 0) return message.reply("⛔ Item này không bán, chỉ có thể kiếm được!");
        if (item.stock < quantity) return message.reply(`😭 Shop chỉ còn **${item.stock}** cái thôi.`);
        
        const totalPrice = item.price * quantity;
        
        if (await economy.subtractMoney(guildId, userId, totalPrice, `Mua ${quantity}x ${item.name}`)) {
            item.stock -= quantity;
            await economy.updateShopItem(item.id, { stock: item.stock });
            await economy.addItem(guildId, userId, item.id, quantity);
            message.reply({ embeds: [new EmbedBuilder().setColor('Green').setTitle("🛍️ MUA THÀNH CÔNG").setDescription(`Đã mua **${quantity}x ${item.name}**\nĐã cất vào kho đồ (\`.inv\`).\nGõ \`.xai ${item.keywords[0]}\` để dùng.`)] });
            
        } else return message.reply(`Không đủ tiền! Cần **${totalPrice.toLocaleString()} ${CURRENCY}**.`);
    }

    // --- XỬ LÝ LỆNH USE / XAI ---
    if (cmd === '.xai' || cmd === '.use') {
        let quantity = 1;
        let keywordArgs = args;
        const lastArg = args[args.length - 1];

        if (lastArg && lastArg.toLowerCase() === 'all') {
            quantity = 'all'; 
            keywordArgs = args.slice(0, -1);
        } else if (lastArg && !isNaN(parseInt(lastArg))) {
            quantity = parseInt(lastArg);
            keywordArgs = args.slice(0, -1);
        }

        const searchKeyword = keywordArgs.join(' ').toLowerCase().trim();
        const item = Object.values(SHOP_ITEMS).find(i => i.keywords.some(k => k === searchKeyword || k.startsWith(searchKeyword)));
        
        if (!item) return message.reply("Không tìm thấy vật phẩm.");

        if (item.id === 'lootbox' || item.id === 'lootboxvip') {
            const userStock = await economy.getItemAmount(guildId, userId, item.id);
            if (userStock <= 0) return message.reply(`Bạn không có **${item.name}** nào để mở.`);

            if (quantity === 1) {
                const hasItem = await economy.removeItem(guildId, userId, item.id, 1);
                if (!hasItem) return message.reply("Lỗi trừ item.");

                const boxName = item.id === 'lootboxvip' ? '**Lootbox VIP**' : '**Lootbox**';
                const openEmbed = new EmbedBuilder()
                    .setColor('Purple')
                    .setTitle('**Tiến Hành Mở Lootbox**')
                    .setDescription(
                        `--------------------------\n` +
                        `<@${userId}> đang mở ${boxName} và nhận được <a:lootboxopen:1461108774160039998>`
                    );
                
                const msg = await message.reply({ embeds: [openEmbed] });
                const rates = item.id === 'lootboxvip' ? GEM_RATES_VIP : GEM_RATES;
                
                // FIXED: Loại bỏ việc sort tự động theo tỉ lệ thấp lên cao
                const activeRates = [...rates]; 
                
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
                if (!selectedGem) selectedGem = SHOP_ITEMS['gem1']; 

                await economy.addItem(guildId, userId, selectedGem.id, 1);

                setTimeout(() => {
                    const resultEmbed = new EmbedBuilder()
                        .setColor(item.id === 'lootboxvip' ? 'Gold' : 'Blue')
                        .setTitle('**Mở Lootbox Thành Công**')
                        .setDescription(
                            `--------------------------\n` +
                            `<a:lootboxopened:1461118461186019330> **|** <@${userId}> đã mở ${boxName} và nhận được **${selectedGem.name}** ${selectedGem.emoji}\n\n` +
                            `• Ngọc đã được cất vào kho đồ. Bạn có thể sử dụng lệnh \`.check <item>\` để kiểm tra giá hiện tại của item.\n` +
                            `• Bạn có thể sử dụng lệnh \`.ban <item>\` hoặc \`.sell <item>\` để bán.`
                        );
                    msg.edit({ embeds: [resultEmbed] });
                }, 2000);
                return;
            } else {
                const MAX_OPEN = 10;
                let amountToOpen = (quantity === 'all') ? Math.min(userStock, MAX_OPEN) : Math.min(quantity, userStock, MAX_OPEN);

                await economy.removeItem(guildId, userId, item.id, amountToOpen);

                if ((quantity === 'all' && userStock > MAX_OPEN) || (quantity > MAX_OPEN)) {
                    message.channel.send(`⚠️ Chỉ được mở tối đa **${MAX_OPEN}** hòm/lần. Đang mở **${amountToOpen}** hòm.`);
                }

                const boxName = item.name;
                const boxIcon = item.emoji;
                const rates = item.id === 'lootboxvip' ? GEM_RATES_VIP : GEM_RATES;
                
                // FIXED: Loại bỏ việc sort tự động theo tỉ lệ thấp lên cao
                const activeRates = [...rates];

                let processLog = "";
                const getEmbed = (log, currentStepMsg = "") => {
                    return new EmbedBuilder()
                        .setColor(item.id === 'lootboxvip' ? 'Gold' : 'Purple')
                        .setTitle('**Tiến Hành Mở Lootbox**')
                        .setDescription(
                            `---------------------------------------------\n` +
                            `<@${userId}> đã tiến hành mở **${amountToOpen}** ${boxIcon} **${boxName}**\n\n` +
                            log +
                            currentStepMsg
                        );
                };

                const msg = await message.reply({ embeds: [getEmbed(processLog)] });

                for (let i = 1; i <= amountToOpen; i++) {
                    const openingMsg = `\nHòm số ${i} đang mở <a:lootboxopen:1461108774160039998> và nhận được...`;
                    await msg.edit({ embeds: [getEmbed(processLog, openingMsg)] });
                    await new Promise(r => setTimeout(r, 2000));

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
                    if (!selectedGem) selectedGem = SHOP_ITEMS['gem1'];

                    await economy.addItem(guildId, userId, selectedGem.id, 1);
                    processLog += `Hòm số ${i} đã mở <a:lootboxopened:1461118461186019330> và nhận được ${selectedGem.emoji} **${selectedGem.name}**\n`;
                    await msg.edit({ embeds: [getEmbed(processLog)] });

                    if (i < amountToOpen) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                return;
            }
        }

        const hasItem = await economy.removeItem(guildId, userId, item.id, 1);
        if (!hasItem) return message.reply("Không có hàng trong kho.");

        if (item.id === 'luckybox') {
            rollWaitList[userId] = true;
            message.reply({ embeds: [new EmbedBuilder().setColor('Purple').setTitle(`📦 ĐÃ MỞ ${item.name.toUpperCase()}`).setDescription(item.useDescription)] });
        } else if (item.id === 'chickenbox') {
            if (chickenSessions[userId]) {
                await economy.addItem(guildId, userId, item.id, 1); 
                return message.reply("🚫 Đang có gà rồi, đá xong đi đã.");
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
                try { msg.edit({ embeds: [EmbedBuilder.from(embed).setDescription(getDesc(t))] }); } catch (e) {} 
            }, 1000);
            chickenSessions[userId] = { wins: 0, startTime: Date.now(), timer: timer };
        } else {
             message.reply({ embeds: [new EmbedBuilder().setColor('Purple').setTitle(`📦 ĐÃ SỬ DỤNG ${item.name.toUpperCase()}`).setDescription("Đã sử dụng vật phẩm.")] });
        }
    }
}

module.exports = { 
    handleChicken, 
    handleRoll, 
    handleShop, 
    handleInventory, 
    handleGiveItem, 
    initShopData, 
    handleSellGem, 
    handleCheckPrice, 
    handleAddItem,
    handleItemInfo,
    handleRemoveItem
};