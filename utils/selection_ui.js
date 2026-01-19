const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

/**
 * Hiển thị bảng xác nhận chọn vật phẩm/thú khi có nhiều kết quả trùng khớp
 * @param {Message} message - Message gốc của user
 * @param {Array} items - Danh sách các item trùng khớp [{id, name, emoji, type, data...}]
 * @param {String} actionType - 'use' hoặc 'sell' (để hiển thị tiêu đề)
 * @param {Function} callback - Hàm callback chạy khi user chọn xong (selectedItem, interaction) => {}
 */
async function showSelectionMenu(message, items, actionType, callback) {
    const userId = message.author.id;

    // Giới hạn tối đa 25 item (giới hạn của Discord Button grid)
    const displayItems = items.slice(0, 25); 
    
    let description = items.length > 1 
        ? `Tìm thấy **${items.length}** kết quả trùng khớp.\nVui lòng chọn chính xác thứ bạn muốn **${actionType === 'use' ? 'Sử Dụng' : 'Bán'}**:`
        : `Xác nhận thao tác với:`;

    const itemListText = displayItems.map((item, index) => {
        const typeLabel = item.type === 'animal' ? '[Thú]' : '[Item]';
        return `**${index + 1}.** ${item.emoji} **${item.name}** \`${typeLabel}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle(`🔍 XÁC NHẬN ${actionType.toUpperCase()} ITEM`)
        .setDescription(`${description}\n\n${itemListText}\n\n*Bấm nút bên dưới để chọn.*`)
        .setFooter({ text: "Lựa chọn sẽ hết hạn sau 30 giây." });

    const rows = [];
    let currentRow = new ActionRowBuilder();

    displayItems.forEach((item, index) => {
        if (index > 0 && index % 5 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`select_item_${index}`)
                .setLabel(`${index + 1}. ${item.name}`.substring(0, 80))
                .setEmoji(item.emoji)
                .setStyle(ButtonStyle.Secondary)
        );
    });
    if (currentRow.components.length > 0) rows.push(currentRow);

    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('select_cancel').setLabel('Hủy Bỏ').setStyle(ButtonStyle.Danger)
    );
    rows.push(cancelRow);

    const replyMsg = await message.reply({ embeds: [embed], components: rows });

    const collector = replyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 30000,
        filter: i => i.user.id === userId 
    });

    collector.on('collect', async interaction => {
        if (interaction.customId === 'select_cancel') {
            await interaction.update({ content: "Đã hủy thao tác.", embeds: [], components: [] });
            return;
        }

        if (interaction.customId.startsWith('select_item_')) {
            const index = parseInt(interaction.customId.replace('select_item_', ''));
            const selectedItem = displayItems[index];

            // KHÔNG update tại đây nữa để tránh tin nhắn trung gian.
            // Truyền interaction vào callback để hàm xử lý tiếp theo (sell/use) thực hiện update.
            if (callback) callback(selectedItem, interaction);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyMsg.edit({ content: "Đã hết thời gian lựa chọn.", embeds: [], components: [] }).catch(() => {});
        }
    });
}

module.exports = { showSelectionMenu };