// games/inventory.js
const { EmbedBuilder } = require('discord.js');
const { SHOP_ITEMS } = require('../config');
const economy = require('../utils/economy');
const { findItemSmart, resolveGlobalUser } = require('../utils/helpers');

// ID CỦA BẠN
const OWNER_ID = '414792622289190917';

async function handleInventory(message, args = []) {
    let targetUser = message.author;
    let targetId = message.author.id;
    let displayName = message.author.globalName || message.author.username;
    let avatarUrl = message.author.displayAvatarURL();
    
    // Logic tìm user thông minh (Fix lỗi check ID dạng text)
    if (args.length > 0) {
        const foundUser = await resolveGlobalUser(message, args[0]);
        if (foundUser) {
            targetUser = foundUser;
            targetId = foundUser.id;
            displayName = foundUser.globalName || foundUser.username;
            avatarUrl = foundUser.displayAvatarURL();
        } else {
            return message.reply("❌ Không tìm thấy người chơi này (Thử dùng ID hoặc Username chính xác).");
        }
    }

    // Lấy Global Inventory
    const inventory = await economy.getInventory(targetId);

    if (inventory.length === 0) { 
        const isSelf = targetId === message.author.id;
        return message.reply(isSelf
            ? "🎒 Kho đồ của bạn trống trơn! Hãy ghé `.shop` để mua sắm nhé."
            : `🎒 Kho đồ của **${displayName}** trống trơn!`
        ); 
    }

    let shopItems = [];
    let lootboxGems = [];
    let crateGems = [];

    const getGemRank = (id) => {
        return parseInt(id.replace('gem', '').replace('a', '')) || 0;
    };

    inventory.forEach(invItem => {
        const itemConfig = SHOP_ITEMS[invItem.item_id];
        if (!itemConfig) return;

        const entry = {
            ...invItem,
            name: itemConfig.name,
            emoji: itemConfig.emoji || '',
            rank: getGemRank(invItem.item_id)
        };

        if (invItem.item_id.startsWith('gem')) {
            if (invItem.item_id.endsWith('a')) {
                crateGems.push(entry); 
            } else {
                lootboxGems.push(entry); 
            }
        } else {
            shopItems.push(entry); 
        }
    });

    // Sắp xếp
    lootboxGems.sort((a, b) => b.rank - a.rank);
    crateGems.sort((a, b) => b.rank - a.rank);
    shopItems.sort((a, b) => a.item_id.localeCompare(b.item_id));

    let description = "";
    let globalIndex = 1;

    const renderList = (list) => {
        if (list.length === 0) return "";
        return list.map(i => {
            const line = `**${globalIndex}.** ${i.name} ${i.emoji} - **SL: ${i.amount}**`;
            globalIndex++;
            return line;
        }).join('\n') + "\n";
    };

    const sections = [];
    if (shopItems.length > 0) sections.push(renderList(shopItems));
    if (lootboxGems.length > 0) sections.push(renderList(lootboxGems));
    if (crateGems.length > 0) sections.push(renderList(crateGems));

    description = sections.join("------------------------------\n");

    if (!description) description = "Lỗi hiển thị vật phẩm.";

    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle(`**Hòm Đồ Của ${displayName}**`)
        .setDescription(description)
        .setThumbnail(avatarUrl)
        .setFooter({ text: "Sử dụng .use <tên item> để dùng hoặc .sell <tên item> để bán" });
        
    return message.channel.send({ embeds: [embed] });
}

async function handleGiveItem(message, args) {
    const senderId = message.author.id;

    if (args.length < 2) return message.reply("Cú pháp: `.give-item <tên item> <user/id/name> [số lượng]`");

    // Logic tách user và item từ args
    let targetUser = null;
    let userArgIndex = -1;

    // Quét qua args để tìm xem đâu là User
    for (let i = 0; i < args.length; i++) {
        const u = await resolveGlobalUser(message, args[i]);
        if (u) {
            targetUser = u;
            userArgIndex = i;
            break;
        }
    }

    if (!targetUser) return message.reply("❌ Không tìm thấy người nhận (Tag tên, nhập ID hoặc Username).");
    if (targetUser.id === senderId) return message.reply("Không thể tự tặng quà cho mình!");
    if (targetUser.bot) return message.reply("Bot không cần quà đâu!");

    // Loại bỏ arg user để lấy item và amount
    const remainingArgs = args.filter((_, index) => index !== userArgIndex);

    if (remainingArgs.length === 0) return message.reply("Thiếu tên vật phẩm!");

    let amount = 1;
    // Kiểm tra xem arg cuối cùng có phải là số không
    const lastArg = remainingArgs[remainingArgs.length - 1];
    if (!isNaN(lastArg)) {
        amount = parseInt(lastArg);
        remainingArgs.pop(); // Xóa số lượng ra khỏi mảng tên
    }

    if (amount <= 0) return message.reply("Số lượng không hợp lệ!");
    
    const itemKeyword = remainingArgs.join(" "); 
    const item = findItemSmart(itemKeyword);

    if (!item) return message.reply(`Không tìm thấy vật phẩm nào tên là "**${itemKeyword}**".`);

    // Global Check
    const currentAmount = await economy.getItemAmount(senderId, item.id);
    if (currentAmount < amount) return message.reply(`🎒 Bạn không đủ **${item.name}** để tặng (Có: ${currentAmount}).`);

    // Global Transfer
    const success = await economy.transferItem(senderId, targetUser.id, item.id, amount);
    if (success) {
        return message.reply(`Đã chuyển **${amount}x ${item.name}** ${item.emoji || ''} cho **${targetUser.username}**!`);
    } else {
        return message.reply("Lỗi khi chuyển vật phẩm. Vui lòng thử lại.");
    }
}

// --- ADMIN COMMANDS (Chỉ Owner) ---

async function handleAddItem(message, args) {
    const userId = message.author.id;
    if (userId !== OWNER_ID) {
        return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
    }

    const targetArg = args[args.length - 1];
    let targetType = null;
    let targetObj = null;

    // Check Role
    if (targetArg.match(/^<@&(\d+)>$/)) {
        targetType = 'role';
        targetObj = message.mentions.roles.first();
    } 
    // Check User (ID hoặc Tag)
    else {
        const u = await resolveGlobalUser(message, targetArg);
        if (u) {
            targetType = 'user';
            targetObj = u;
        }
    }

    if (!targetType || !targetObj) {
        return message.reply("Vui lòng tag User/ID hoặc Role ở cuối lệnh. VD: `.additem lucky 10 @Huy`");
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
        await economy.addItem(targetObj.id, item.id, amount);
        return message.reply(`Đã thêm **${amount}x ${item.name}** ${item.emoji || ''} vào kho của **${targetObj.displayName || targetObj.username}**.`);
    } else if (targetType === 'role') {
        await message.guild.members.fetch();
        const members = targetObj.members.filter(m => !m.user.bot);
        const promises = members.map(m => economy.addItem(m.id, item.id, amount));
        await Promise.all(promises);
        return message.reply(`Đã thêm **${amount}x ${item.name}** ${item.emoji || ''} cho **${members.size}** thành viên thuộc role **${targetObj.name}**.`);
    }
}

async function handleRemoveItem(message, args) {
    const userId = message.author.id;
    if (userId !== OWNER_ID) {
        return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
    }

    const targetArg = args[args.length - 1];
    let targetType = null; 
    let targetObj = null;

    if (targetArg.match(/^<@&(\d+)>$/)) {
        targetType = 'role';
        targetObj = message.mentions.roles.first();
    } else {
        const u = await resolveGlobalUser(message, targetArg);
        if (u) {
            targetType = 'user';
            targetObj = u;
        }
    }

    if (!targetType || !targetObj) {
        return message.reply("Vui lòng tag User/ID hoặc Role ở cuối lệnh.");
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
        const currentStock = await economy.getItemAmount(targetObj.id, item.id);
        const removeAmount = Math.min(currentStock, amount);
        
        if (removeAmount > 0) {
            await economy.removeItem(targetObj.id, item.id, removeAmount);
            return message.reply(`🗑️ Đã xóa **${removeAmount}x ${item.name}** khỏi kho của **${targetObj.displayName || targetObj.username}**.`);
        } else {
            return message.reply(`User này không có **${item.name}** nào.`);
        }
    } else if (targetType === 'role') {
        await message.guild.members.fetch();
        const members = targetObj.members.filter(m => !m.user.bot);
        let count = 0;
        let totalRemoved = 0;

        for (const member of members.values()) {
            const currentStock = await economy.getItemAmount(member.id, item.id);
            const removeAmount = Math.min(currentStock, amount);
            if (removeAmount > 0) {
                await economy.removeItem(member.id, item.id, removeAmount);
                totalRemoved += removeAmount;
                count++;
            }
        }
        
        return message.reply(`Đã xóa tổng cộng **${totalRemoved}x ${item.name}** từ **${count}** thành viên thuộc role **${targetObj.name}**.`);
    }
}

module.exports = { handleInventory, handleGiveItem, handleAddItem, handleRemoveItem };