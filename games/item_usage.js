// games/item_usage.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { SHOP_ITEMS, HUNT_CONFIG } = require('../config');
const economy = require('../utils/economy');
const { activateChickenBox } = require('./chicken');
const { activateLuckyBox, openLootbox } = require('./lootbox');
const { findAllItemsSmart } = require('../utils/helpers'); // Sử dụng hàm tìm kiếm mới
const { showSelectionMenu } = require('../utils/selection_ui'); // Import UI Selection

async function handleUseItem(message, args) {
    const userId = message.author.id;
    // const guildId = message.guild.id; // Không dùng guildId cho economy global nữa

    // Logic tách số lượng và tên item
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

    const searchKeyword = keywordArgs.join(' ');
    
    // 1. TÌM TẤT CẢ ITEM TRÙNG KHỚP
    const matchedItems = findAllItemsSmart(searchKeyword);

    if (matchedItems.length === 0) {
        return message.reply("Không tìm thấy vật phẩm nào tên như vậy.");
    }

    // 2. NẾU CÓ NHIỀU HƠN 1 ITEM -> HIỂN THỊ BẢNG CHỌN
    if (matchedItems.length > 1) {
        // Chuyển đổi format cho showSelectionMenu
        const selectionItems = matchedItems.map(i => ({
            id: i.id,
            name: i.name,
            emoji: i.emoji || '📦',
            type: 'item',
            data: i
        }));

        return showSelectionMenu(message, selectionItems, 'use', (selected) => {
            // Callback khi user chọn xong: Gọi lại logic xử lý chính với item đã chọn
            processUseItem(message, selected.data, quantity, userId);
        });
    }

    // 3. NẾU CHỈ CÓ 1 ITEM -> DÙNG LUÔN
    processUseItem(message, matchedItems[0], quantity, userId);
}

// --- LOGIC XỬ LÝ DÙNG ITEM (Tách ra để tái sử dụng) ---
async function processUseItem(message, item, quantity, userId) {
    // --- CHECK NẾU LÀ GEM BUFF ---
    const buffInfo = HUNT_CONFIG.GEM_BUFFS[item.id];
    if (buffInfo) {
        // FIX: Bỏ guildId
        const userStock = await economy.getItemAmount(userId, item.id);
        if (userStock <= 0) return message.reply(`Bạn không có **${item.name}** nào.`);

        // FIX: Bỏ guildId
        const currentBuffs = await economy.getUserBuffs(userId);
        if (buffInfo.type === 'quantity' && currentBuffs.qty_turns > 0) {
            return message.reply(`⛔ Bạn đang có hiệu ứng **Tăng Số Lượng**. Hãy dùng hết lượt trước!`);
        }
        if (buffInfo.type === 'quality' && currentBuffs.qual_turns > 0) {
            return message.reply(`⛔ Bạn đang có hiệu ứng **Tăng Tỉ Lệ**. Hãy dùng hết lượt trước!`);
        }

        let desc = buffInfo.type === 'quantity' 
            ? `${item.emoji} sẽ giúp **tăng thêm ${buffInfo.bonus} thú** bắt được với **${buffInfo.turns} lượt hunt**`
            : `${item.emoji} sẽ giúp **tăng đáng kể cơ hội bắt thú hiếm** với **${buffInfo.turns} lượt hunt**`;

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('Xác nhận sử dụng vật phẩm')
            .setDescription(`Bạn có chắc muốn sử dụng ${item.emoji} **${item.name}** để đi bắt thú không?\n\n${desc}`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('buff_yes').setLabel('Có').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('buff_no').setLabel('Không').setStyle(ButtonStyle.Danger)
        );

        const replyMsg = await message.reply({ embeds: [embed], components: [row] });
        const collector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000, filter: i => i.user.id === userId });

        collector.on('collect', async i => {
            if (i.customId === 'buff_no') await i.update({ content: "Đã hủy sử dụng.", embeds: [], components: [] });
            else {
                // FIX: Bỏ guildId
                const stockNow = await economy.getItemAmount(userId, item.id);
                if (stockNow <= 0) return i.update({ content: "Bạn đã hết item này rồi.", embeds: [], components: [] });
                
                // FIX: Bỏ guildId
                await economy.removeItem(userId, item.id, 1);
                await economy.activateBuff(userId, buffInfo.type, item.id, buffInfo.turns);
                
                await i.update({ content: `Đã kích hoạt sức mạnh của ${item.emoji} **${item.name}**!`, embeds: [], components: [] });
            }
        });
        return;
    }

    // --- LOOTBOX ---
    if (['lootbox', 'lootboxvip', 'crate', 'crateL'].includes(item.id)) {
        // FIX: Bỏ guildId
        const userStock = await economy.getItemAmount(userId, item.id);
        if (userStock <= 0) return message.reply(`Bạn không có **${item.name}** nào để mở.`);

        const MAX_OPEN = 10;
        let amountToOpen = quantity === 'all' ? Math.min(userStock, MAX_OPEN) : Math.min(quantity, userStock);
        if (amountToOpen > MAX_OPEN) amountToOpen = MAX_OPEN;
        
        // FIX: Bỏ guildId
        await economy.removeItem(userId, item.id, amountToOpen);
        
        if ((quantity === 'all' && userStock > MAX_OPEN) || (quantity > MAX_OPEN)) {
            message.channel.send(`⚠️ Chỉ được mở tối đa **${MAX_OPEN}** hòm/lần. Đang mở **${amountToOpen}** hòm.`);
        }
        
        // Lưu ý: openLootbox trong file lootbox.js có thể cũng cần check lại nếu nó nhận guildId, 
        // nhưng ở đây tôi chỉ sửa file item_usage.js theo yêu cầu.
        await openLootbox(message, userId, item, amountToOpen);
        return;
    }

    // --- OTHER ITEMS ---
    // FIX: Bỏ guildId
    const hasItem = await economy.removeItem(userId, item.id, 1);
    if (!hasItem) return message.reply("Không có hàng trong kho.");

    if (item.id === 'luckybox') {
        await activateLuckyBox(message, userId, item);
    } else if (item.id === 'chickenbox') {
        const result = await activateChickenBox(message, userId);
        if (!result.success) {
            // FIX: Bỏ guildId (Hoàn trả item nếu thất bại)
            await economy.addItem(userId, item.id, 1);
            message.reply(result.msg);
        }
    } else {
         message.reply({ embeds: [new EmbedBuilder().setColor('Purple').setTitle(`📦 ĐÃ SỬ DỤNG ${item.name.toUpperCase()}`).setDescription("Đã sử dụng vật phẩm.")] });
    }
}

module.exports = { handleUseItem };