// games/economy_game.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const economy = require('../utils/economy');
const { setHuntCooldown } = require('./hunt'); 
const { resolveGlobalUser } = require('../utils/helpers'); 

const OWNER_ID = '414792622289190917';

const COMMAND_ALIASES = {
    'w': 'work', 's': 'slut', 'c': 'crime',
    'dep': 'deposit', 'cat': 'deposit', 
    'with': 'withdraw', 'lay': 'withdraw', 
    'bal': 'balance', 'lb': 'leaderboard', 'give': 'givemoney',
    'addmoney': 'add-money', 'removemoney': 'remove-money',
    'addmoneyrole': 'add-money-role', 'removemoneyrole': 'remove-money-role',
    'addmoneyall': 'add-money-allmember',
    'setcooldown': 'set-cooldown', 'setpayout': 'set-payout',
    'setfailrate': 'set-fail-rate', 'setcurrency': 'set-currency',
    'setstartbalance': 'set-start-balance',
    'removetestusers': 'remove-test-users', 'gentestusers': 'gen-test-users',
    'addreply': 'add-reply', 'addreplyfail': 'add-reply-fail',
    'setadmin': 'set-admin', 'removeadmin': 'remove-admin',
    'diemdanh': 'daily', 'checkin': 'daily',
    'setchanel': 'set-channel', 'setchannel': 'set-channel'
};

const ROB_FAIL_MESSAGES = [
    "Định móc ví thằng bạn thân lúc nó đang ngủ, ai ngờ nó ngủ mở mắt. Nó tóm tay vặn ngược ra sau, bắt đền tiền thuốc xoa bóp {amount}.",
    "Lén đăng nhập Momo của đứa bạn để chuyển tiền, nhập sai mật khẩu 5 lần bị khóa tài khoản. Nó bắt đền phí mở khóa và tổn thất tinh thần {amount}.",
    "Thò tay vào túi áo khoác bạn định 'mượn tạm', ai ngờ trong túi nó có con chuột Hamster. Chuột cắn sưng tay, tốn tiền tiêm phòng {amount}.",
    "Rủ bạn đi cafe định dàn cảnh quên ví để nó bao, bị nó 'đọc vị' bắt trả luôn cả chầu nước cho cả nhóm. Bay màu {amount}.",
    "Đột nhập phòng trọ thằng bạn, dẫm phải bãi lego nó rải dưới sàn. Đau thấu trời xanh, ngã vỡ luôn cái bình nước của nó. Đền bù {amount}.",
    "Định trộm long tráo phụ đổi tiền giả lấy tiền thật của bạn, bị nó soi đèn cực tím phát hiện ngay tại trận. Phạt nộp quỹ nhóm {amount}.",
    "Hack nick Facebook bạn định nhắn tin vay tiền người lạ, bị nó cài bảo mật 2 lớp gửi mã về điện thoại. Bị lộ tẩy, phải mời nó đi ăn lẩu tạ lỗi hết {amount}.",
    "Lợi dụng lúc bạn đi vệ sinh định thó điện thoại, ai ngờ camera quán cafe chiếu thẳng vào mặt. Chủ quán báo công an, nộp phạt hành chính {amount}.",
    "Tính trấn lột thằng bạn hiền lành nhất nhóm, ai ngờ nó mới đi học Muay Thái về. Bị nó 'test' vài đường quyền, tốn tiền mua thuốc đỏ {amount}.",
    "Canh me lúc bạn rút tiền cây ATM định giật chạy, bị bảo vệ ngân hàng tưởng cướp thật gô cổ lại. Bạn thân phải lên bảo lãnh, tốn phí 'trà nước' {amount}."
];

const ROB_SUCCESS_MESSAGES = [
    "Thực hiện nghị quyết lấy của người giàu chia cho người nghèo (là tui). Đã trưng thu thành công {amount} từ kho bạc của bạn.",
    "Sợ bạn đi lệch cột sống vì ví quá dày, mình xin phép gánh vác giùm {amount}. Không cần cảm ơn đâu, nghĩa vụ thôi mà!",
    "Kỹ năng bàn tay vàng trong làng móc túi đã được kích hoạt. Lụm nhẹ {amount}, xin phép đi trước lỡ bị bắt đền.",
    "Mượn tạm {amount} mua ly trà sữa full topping, bao giờ giàu tui trả (mà bao giờ giàu thì tui chưa biết). Iu bạn!",
    "Thu phí duy trì tình bạn tháng này là {amount} nha. Đã trừ trực tiếp vào tài khoản, dịch vụ nhanh gọn lẹ!",
    "Alo alo, check ví xem có thiếu {amount} không? Nếu có thì đừng tìm, nó đang nằm ấm êm bên túi mình rồi.",
    "Cảm ơn bạn đã đầu tư {amount} vào quỹ từ thiện Nuôi tui béo mầm. Công đức vô lượng!",
    "Một pha check var ví tiền cực gắt. Trọng tài xác nhận bạn đã mất {amount} vào tay đội bạn (là tui).",
    "Tính lấy hết mà lương tâm cắn rứt, nên chỉ xin đểu {amount} uống cà phê thôi. Vẫn còn tiền đi xe bus về nhé bạn hiền!",
    "Vũ trụ gửi tín hiệu là bạn cần học cách buông bỏ vật chất. Tui giúp bạn thực hành bài học đó với giá {amount}."
];

function getOrdinalSuffix(i) {
    var j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return i + "st";
    if (j == 2 && k != 12) return i + "nd";
    if (j == 3 && k != 13) return i + "rd";
    return i + "th";
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendCooldownMessage(message, expirationTimestamp) {
    const expirationSeconds = Math.floor(expirationTimestamp / 1000);
    const timeLeft = expirationTimestamp - Date.now();
    const msg = await message.reply(`Vui lòng chờ thêm trong <t:${expirationSeconds}:R> để sử dụng lại lệnh`);
    if (timeLeft > 0) { setTimeout(() => { msg.delete().catch(() => {}); }, timeLeft); }
}

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(s|m|h)$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return val;
    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    return null;
}

async function getHybridRobReply(guildId, status, amount, currency) {
    let dbReplies = [];
    try { dbReplies = await economy.getCustomReplies(guildId, 'rob'); } catch (e) {}
    const validDbMessages = dbReplies.filter(r => r.status === status).map(r => r.message);
    const hardcodedMessages = status === 'success' ? ROB_SUCCESS_MESSAGES : ROB_FAIL_MESSAGES;
    const allMessages = [...validDbMessages, ...hardcodedMessages];
    let template = status === 'success' ? "Bạn nhận được {amount}" : "Bạn mất {amount}";
    if (allMessages.length > 0) template = allMessages[Math.floor(Math.random() * allMessages.length)];
    const formattedAmount = `**${economy.formatMoney(amount)} ${currency}**`;
    return template.replace(/{amount}/g, formattedAmount);
}

function getNextDailyTime() {
    const now = new Date();
    const gmt7Time = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const nextDay = new Date(gmt7Time);
    nextDay.setUTCHours(24, 0, 0, 0); 
    return nextDay.getTime() - (7 * 60 * 60 * 1000); 
}

function isSameDayGMT7(date1, date2) {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1.getTime() + (7 * 60 * 60 * 1000));
    const d2 = new Date(date2.getTime() + (7 * 60 * 60 * 1000));
    return d1.getUTCFullYear() === d2.getUTCFullYear() && d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCDate() === d2.getUTCDate();
}

function isYesterdayGMT7(lastDailyDate) {
    if (!lastDailyDate) return false;
    const now = new Date();
    const d1 = new Date(lastDailyDate.getTime() + (7 * 60 * 60 * 1000));
    const d2 = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const oneDay = 24 * 60 * 60 * 1000;
    const d1Reset = new Date(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate()).getTime();
    const d2Reset = new Date(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()).getTime();
    return (d2Reset - d1Reset) === oneDay;
}

const formatMoney = (n) => parseInt(n).toLocaleString('en-US');

async function handleEconomyCommand(message, command, args) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const config = await economy.getConfig(guildId);
    
    if (await economy.isCommandDisabled(message.channel.id, command, COMMAND_ALIASES)) return;

    const cleanArgs = args.filter(arg => arg.trim() !== '');
    const isOwner = (userId === OWNER_ID);

    // Quyền Admin Server dành cho lệnh setchannel
    const checkServerAdmin = async () => {
        if (userId === message.guild.ownerId || isOwner) return true;
        const adminRoles = config.admin_roles || [];
        return message.member.roles.cache.some(role => adminRoles.includes(role.id));
    };
    const isServerAdmin = await checkServerAdmin();

    // --- 1. WORK ---
    if (command === 'work' || command === 'w') {
        const exp = economy.checkCooldown(null, userId, 'work', config.work_cd);
        if (exp > 0) return sendCooldownMessage(message, exp);
        const amount = getRandomInt(config.work_min || 1000, config.work_max || 2000);
        await economy.updateBalance(userId, amount, 'cash', 'add');
        const replyMsg = await economy.getReply(guildId, 'work', 'success', amount, config.currency);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(replyMsg)] });
    }

    // --- 2. SLUT ---
    if (command === 'slut' || command === 's') {
        const exp = economy.checkCooldown(null, userId, 'slut', config.slut_cd);
        if (exp > 0) return sendCooldownMessage(message, exp);
        if (Math.random() * 100 < (config.slut_fail || 48)) {
            const fine = Math.floor((config.slut_max || 3000) / 2);
            const actualLost = await economy.deductMoney(userId, fine);
            const replyMsg = await economy.getReply(guildId, 'slut', 'fail', actualLost, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(replyMsg)] });
        } else {
            const amount = getRandomInt(config.slut_min || 2000, config.slut_max || 3000);
            await economy.updateBalance(userId, amount, 'cash', 'add');
            const replyMsg = await economy.getReply(guildId, 'slut', 'success', amount, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(replyMsg)] });
        }
    }

    // --- 3. CRIME ---
    if (command === 'crime' || command === 'c') {
        const exp = economy.checkCooldown(null, userId, 'crime', config.crime_cd);
        if (exp > 0) return sendCooldownMessage(message, exp);
        if (Math.random() * 100 < (config.crime_fail || 48)) {
            const fine = Math.floor((config.crime_max || 3000) * 0.8);
            const actualLost = await economy.deductMoney(userId, fine);
            const replyMsg = await economy.getReply(guildId, 'crime', 'fail', actualLost, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(replyMsg)] });
        } else {
            const amount = getRandomInt(config.crime_min || 2000, config.crime_max || 3000);
            await economy.updateBalance(userId, amount, 'cash', 'add');
            const replyMsg = await economy.getReply(guildId, 'crime', 'success', amount, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(replyMsg)] });
        }
    }

    // --- 4. ROB ---
    if (command === 'rob') {
        const exp = economy.checkCooldown(null, userId, 'rob', config.rob_cd);
        if (exp > 0) return sendCooldownMessage(message, exp);
        const target = await resolveGlobalUser(message, cleanArgs[0]);
        if (!target) return message.reply("Không tìm thấy người này.");
        if (target.id === userId) return message.reply("Không thể tự cướp.");
        const victimBal = await economy.getBalance(target.id);
        if (victimBal.cash < 100) return message.reply(`**${target.username}** quá nghèo.`);
        if (Math.random() * 100 < (config.rob_fail || 50)) {
            const fine = getRandomInt(1000, 3000);
            const actualLost = await economy.deductMoney(userId, fine);
            const replyMsg = await getHybridRobReply(guildId, 'fail', actualLost, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(replyMsg)] });
        } else {
            const robAmount = Math.floor(victimBal.cash * (getRandomInt(10, 40) / 100));
            await economy.updateBalance(target.id, robAmount, 'cash', 'remove');
            await economy.updateBalance(userId, robAmount, 'cash', 'add');
            const replyMsg = await getHybridRobReply(guildId, 'success', robAmount, config.currency);
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(replyMsg)] });
        }
    }

    // --- 5. DAILY ---
    if (['daily', 'diemdanh', 'checkin'].includes(command)) {
        const user = await economy.getUser(userId);
        const now = new Date();
        if (user.last_daily && isSameDayGMT7(user.last_daily, now)) return sendCooldownMessage(message, getNextDailyTime());
        let streak = (user.last_daily && isYesterdayGMT7(user.last_daily)) ? user.streak + 1 : 1;
        let reward = 10000 + (Math.min(streak, 4) * 5000);
        let boxes = 2 + (Math.min(streak, 4) - 1);
        await economy.addMoney(userId, reward, "Daily");
        await economy.addItem(userId, 'lootbox', boxes);
        await economy.updateDaily(userId, streak);
        const embed = new EmbedBuilder().setColor('Gold').setTitle('**Quà Điểm Danh**').setDescription(`Chuỗi **${streak}** ngày. Nhận **${reward.toLocaleString()}** 🪙 và **${boxes}** <:lootbox:1461108775808143370>`).setThumbnail(message.author.displayAvatarURL());
        return message.reply({ embeds: [embed] });
    }

    // --- 6. BALANCE ---
    if (['bal', 'balance'].includes(command)) {
        const target = await resolveGlobalUser(message, cleanArgs[0]) || message.author;
        const bal = await economy.getBalance(target.id);
        const embed = new EmbedBuilder().setColor(0x00FF00).setTitle(`Tài sản của ${target.username}`)
            .addFields(
                { name: 'Cash', value: `${formatMoney(bal.cash)} ${config.currency}`, inline: true },
                { name: 'Bank', value: `${formatMoney(bal.bank)} ${config.currency}`, inline: true },
                { name: 'Total', value: `${formatMoney(bal.total)} ${config.currency}`, inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    // --- 7. DEPOSIT/WITHDRAW ---
    if (['deposit', 'dep', 'cat'].includes(command)) {
        const bal = await economy.getBalance(userId);
        let amount = cleanArgs[0]?.toLowerCase() === 'all' ? bal.cash : parseInt(cleanArgs[0]);
        if (!amount || amount <= 0 || amount > bal.cash) return message.reply("Tiền không hợp lệ.");
        await economy.updateBalance(userId, amount, 'cash', 'remove');
        await economy.updateBalance(userId, amount, 'bank', 'add');
        return message.reply(`Đã gửi **${economy.formatMoney(amount)} ${config.currency}** vào ngân hàng.`);
    }
    if (['withdraw', 'with', 'lay'].includes(command)) {
        const bal = await economy.getBalance(userId);
        let amount = cleanArgs[0]?.toLowerCase() === 'all' ? bal.bank : parseInt(cleanArgs[0]);
        if (!amount || amount <= 0 || amount > bal.bank) return message.reply("Tiền không hợp lệ.");
        await economy.updateBalance(userId, amount, 'bank', 'remove');
        await economy.updateBalance(userId, amount, 'cash', 'add');
        return message.reply(`Đã rút **${economy.formatMoney(amount)} ${config.currency}** ra tiền mặt.`);
    }

    // --- 8. GIVE ---
    if (['givemoney', 'give'].includes(command)) {
        const target = await resolveGlobalUser(message, cleanArgs[0]);
        const amount = parseInt(cleanArgs[1]);
        if (!target || !amount || amount <= 0 || target.id === userId) return message.reply("Thông tin không hợp lệ.");
        const bal = await economy.getBalance(userId);
        if (amount > bal.cash) return message.reply("Không đủ tiền.");
        await economy.updateBalance(userId, amount, 'cash', 'remove');
        await economy.updateBalance(target.id, amount, 'cash', 'add');
        return message.reply(`Đã chuyển **${economy.formatMoney(amount)} ${config.currency}** cho **${target.username}**.`);
    }

    // --- 9. LEADERBOARD ---
    if (['lb', 'leaderboard'].includes(command)) {
        const allUsers = (await economy.getAllUsers()).sort((a, b) => b.total - a.total);
        if (allUsers.length === 0) return message.reply("Chưa có dữ liệu.");
        const itemsPerPage = 10;
        const totalPages = Math.ceil(allUsers.length / itemsPerPage);
        let currentPage = 0;
        const generateEmbed = async (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const currentData = allUsers.slice(start, end);
            const preparedList = await Promise.all(currentData.map(async (row, index) => {
                const name = await economy.getCachedUsername(row.user_id, message.client);
                return { rank: start + index + 1, name, money: row.total };
            }));
            let maxNameLen = Math.max(...preparedList.map(i => i.name.length));
            let tableContent = preparedList.map(i => `#${i.rank.toString().padEnd(3)} ${i.name.padEnd(maxNameLen + 1)} ${economy.formatMoney(i.money).padStart(12)} ${config.currency}`).join('\n');
            return new EmbedBuilder().setColor(0x3498DB).setTitle(`**🏦 Bảng Xếp Hạng Thế Giới**`).setDescription(`\`\`\`yaml\n${tableContent}\`\`\``)
                .setFooter({ text: `Trang ${page + 1}/${totalPages} - Hạng bạn: #${allUsers.findIndex(u => u.user_id === userId) + 1}` });
        };
        const generateButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('Trước').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId('next').setLabel('Sau').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
        );
        const replyMsg = await message.reply({ embeds: [await generateEmbed(0)], components: [generateButtons(0)] });
        const collector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: 'Không phải lệnh của bạn!', ephemeral: true });
            await i.deferUpdate();
            if (i.customId === 'prev' && currentPage > 0) currentPage--;
            else if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;
            await i.editReply({ embeds: [await generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
        });
        return;
    }

    // --- 10. LỆNH CHỈNH KÊNH (Dành cho Admin Server) ---
    if (['set-channel', 'setchannel', 'setchanel'].includes(command)) {
        if (!isServerAdmin) return message.reply("⛔ Bạn không có quyền sử dụng lệnh này!");
        const gameType = cleanArgs[0]?.toLowerCase();
        if (!['noitu', 'baucua', 'uno'].includes(gameType)) return message.reply("Game: noitu, baucua, uno.");
        const channel = message.mentions.channels.first() || message.channel;
        await economy.setGameChannel(guildId, gameType, channel.id);
        return message.reply(`Đã set kênh **${gameType}** tại ${channel}.`);
    }

    // --- 11. OWNER COMMANDS (CHẶN TUYỆT ĐỐI) ---
    const ownerCmds = ['add-money','addmoney','remove-money','removemoney','setcooldown','setpayout','set-start-balance','removetestusers','gentestusers','setadmin','removeadmin','resetmoney','reset-money','add-money-role','addmoneyrole','removemoneyrole','addmoneyall','disable','enable','set-currency','prefix','add-reply','addreply','addreplyfail'];
    
    if (ownerCmds.includes(command) || ownerCmds.includes(COMMAND_ALIASES[command])) {
        if (!isOwner) return message.reply("**LỆNH CẤM:** Chỉ có **Bot Owner** mới được sử dụng lệnh này!");

        if (command.includes('addmoney') || command.includes('add-money')) {
            const target = await resolveGlobalUser(message, cleanArgs[0]) || await resolveGlobalUser(message, cleanArgs[1]);
            let amount = parseInt(cleanArgs[1]) || parseInt(cleanArgs[0]);
            if (!target || isNaN(amount)) return message.reply("Sai cú pháp. `.addmoney <user> <amount>`");
            await economy.updateBalance(target.id, amount, 'cash', 'add');
            return message.reply(`Đã thêm **${formatMoney(amount)}** cho **${target.username}**.`);
        }

        if (['resetmoney', 'reset-money'].includes(command)) {
            const target = await resolveGlobalUser(message, cleanArgs[0]);
            if (target) { 
                await economy.updateBalance(target.id, 0, 'cash', 'set'); 
                await economy.updateBalance(target.id, 0, 'bank', 'set'); 
                return message.reply(`Đã reset tiền của **${target.username}**.`); 
            } 
            return message.reply("Không tìm thấy user.");
        }

        if (['set-admin', 'setadmin'].includes(command)) {
            const role = message.mentions.roles.first();
            if (!role) return message.reply("Tag role vào.");
            await economy.addAdminRole(guildId, role.id);
            return message.reply(`Đã cấp quyền Admin Server cho role **${role.name}**.`);
        }

        if (command === 'setcooldown') {
            const type = cleanArgs[0]?.toLowerCase();
            const durationStr = cleanArgs[1];
            if (!type || !durationStr) return message.reply("Ví dụ: `.setcooldown rob 10s`.");
            const seconds = parseDuration(durationStr);
            if (seconds === null) return message.reply("Thời gian không hợp lệ.");
            if (type === 'hunt') setHuntCooldown(seconds);
            else await economy.updateConfig(guildId, `${type}_cd`, seconds);
            return message.reply(`Đã chỉnh cooldown **${type}** thành **${seconds}s**.`);
        }

        if (command === 'disable') { let targetCmd = cleanArgs[0]; await economy.disableCommand(message.channel.id, targetCmd); return message.reply(`🔇 Đã tắt lệnh **${targetCmd}**.`); }
        if (command === 'enable') { let targetCmd = cleanArgs[0]; await economy.enableCommand(message.channel.id, targetCmd); return message.reply(`🔊 Đã bật lại lệnh **${targetCmd}**.`); }
        if (['set-currency', 'setcurrency'].includes(command)) { const symbol = cleanArgs[0]; await economy.updateConfig(guildId, 'currency', symbol); return message.reply(`Đã đổi đơn vị tiền tệ: \`${symbol}\``); }
        if (command === 'prefix') { const newPrefix = cleanArgs[0]; await economy.updateConfig(guildId, 'prefix', newPrefix); return message.reply(`Prefix đổi thành: \`${newPrefix}\``); }
        if (['gen-test-users'].includes(command)) { await economy.createTestUsers(20); return message.reply("Đã tạo 20 user ảo."); }
        if (['remove-test-users'].includes(command)) { const count = await economy.removeTestUsers(); return message.reply(`Đã xóa **${count}** user ảo.`); }
        if (['add-reply', 'addreply'].includes(command)) { const type = cleanArgs[0]?.toLowerCase(); const text = cleanArgs.slice(1).join(" "); await economy.addReply(guildId, type, 'success', text); return message.reply(`Đã thêm văn mẫu thành công cho **${type}**.`); }
        if (['add-reply-fail', 'addreplyfail'].includes(command)) { const type = cleanArgs[0]?.toLowerCase(); const text = cleanArgs.slice(1).join(" "); await economy.addReply(guildId, type, 'fail', text); return message.reply(`Đã thêm văn mẫu thất bại cho **${type}**.`); }
    }
}

module.exports = { handleEconomyCommand, COMMAND_ALIASES };