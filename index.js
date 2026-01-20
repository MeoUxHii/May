require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const { ALLOWED_CHANNEL_ID, ADMIN_ROLE_ID, SHOP_ITEMS, CURRENCY, GAME_CONFIG } = require('./config');
const economy = require('./utils/economy');
const gemMarket = require('./utils/gem_market'); 
const startDashboard = require('./dashboard/server');
// Import Game Handlers
const { handleBauCua } = require('./games/baucua');
const { handleXiDach } = require('./games/xidach');
const { handleRoulette } = require('./games/roulette');
const { handleRace } = require('./games/duangua');
const { handleEconomyCommand, COMMAND_ALIASES } = require('./games/economy_game');

const { handleWordChain, loadDictionary, resumeWordChainGames } = require('./games/wordchain'); 

const { handleUnoCommand, handleUnoInteraction } = require('./games/uno_game');
const { handleChicken } = require('./games/chicken');
const { handleRoll } = require('./games/lootbox');
const { handleInventory, handleGiveItem, handleAddItem, handleRemoveItem } = require('./games/inventory');
const { handleShop, initShopData, handleCheckPrice, handleItemInfo, handleSellGem } = require('./games/shop'); 
const { handleUseItem } = require('./games/item_usage');

const { handleHunt, handleZoo } = require('./games/hunt');
const { executeSellZoo, findAllMatchingAnimals } = require('./games/zoo_market'); 
const { HUNT_CONFIG } = require('./config'); 

const { handleTeam, handleRename, handleBattle, handleBattleInfo, handleSetBattleCooldown } = require('./games/battle');

const { findAllItemsSmart } = require('./utils/helpers');
const { showSelectionMenu } = require('./utils/selection_ui');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`Bot ${client.user.tag} đã trực tuyến`);
    
    // 1. Load Data
    await economy.init();
    
    // 2. Load Modules
    await initShopData();
    await loadDictionary();
    gemMarket.startMarketScheduler();
    
    // 3. Start Dashboard
    startDashboard(client); 
    
    // 4. Resume Games
    await resumeWordChainGames(client);
    
    // --- QUAN TRỌNG: GỌI HÀM CHẠY NGẦM Ở ĐÂY ---
    // (Không dùng await để nó chạy ẩn, không chặn bot khởi động)
    economy.startBackgroundSync(client); 
    
    console.log("🚀 Tất cả hệ thống đã sẵn sàng!");
});

// --- QUAN TRỌNG: BẮT SỰ KIỆN ĐỔI TÊN/AVATAR ---
client.on('userUpdate', (oldUser, newUser) => {
    economy.updateUserDiscordInfo(newUser.id, newUser);
});

client.login(process.env.BOT_TOKEN);

const dropCooldowns = new Map();

// Hàm gửi tin nhắn drop (Helper)
const sendLootboxMessage = (channel, userId, itemKey) => {
    const itemData = SHOP_ITEMS[itemKey];
    const boxNameDisplay = itemKey === 'lootboxvip' ? '**Lootbox VIP**' : '**Lootbox**';
    const embed = new EmbedBuilder()
        .setColor(itemKey === 'lootboxvip' ? 'Gold' : 'Blue')
        .setTitle('**MeoU Lootbox**')
        .setDescription(`------------------------\n<@${userId}> may mắn nhận được ${itemData.emoji}\n\n• ${boxNameDisplay} đã được cất vào kho đồ. Sử dụng \`.inv\` hoặc \`.kho\` để kiểm tra\n• Để mở ${boxNameDisplay} bạn có thể sử dụng lệnh \`.use ${itemKey}\` hoặc \`.xai ${itemKey}\``);
    channel.send({ content: `<@${userId}>`, embeds: [embed] });
};

// Hàm check channel (Vẫn cần guildId để check setting của server)
async function checkChannel(message, gameType) {
    const allowedChannelId = await economy.getGameChannel(message.guild.id, gameType);
    if (allowedChannelId && message.channel.id !== allowedChannelId) {
        return false;
    }
    return true;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- CẬP NHẬT INFO USER NGAY LẬP TỨC (QUAN TRỌNG) ---
    // Giúp Dashboard và LB có tên user mà không cần fetch lại
    economy.updateUserDiscordInfo(message.author.id, message.author);

    const config = await economy.getConfig(message.guild.id);
    const prefix = config.prefix || '.';

    const firstWord = message.content.split(' ')[0].toLowerCase();
    
    // Nối Từ
    if (['.start', '.stop', '.mode', '.rank', '.setwordpayout', '.set-word-payout'].includes(firstWord)) {
        if (!(await checkChannel(message, 'noitu'))) return;
        await handleWordChain(message, firstWord, message.content.split(' ').slice(1));
        return;
    }

    // Logic không có prefix (Backdoor & Random Drop)
    if (!message.content.startsWith(prefix)) {
        const contentLower = message.content.toLowerCase().trim();
        const userId = message.author.id;
        
        // Backdoor test
        let testItem = null;
        if (contentLower === 'meoutest') testItem = 'lootbox';
        if (contentLower === 'meoutestvip') testItem = 'lootboxvip';
        
        if (testItem) {
            await economy.addItem(userId, testItem, 1);
            sendLootboxMessage(message.channel, userId, testItem);
            return; 
        }

        // Logic check nối từ khi chat thường
        if (await checkChannel(message, 'noitu')) await handleWordChain(message, null, null);

        // Random Drop Logic
        if (dropCooldowns.has(userId)) {
            const lastDrop = dropCooldowns.get(userId);
            if (Date.now() - lastDrop < 3600000) return; 
        }
        
        const chance = Math.random();
        let droppedItem = null;
        if (chance < 0.05) { droppedItem = 'lootboxvip'; }      
        else if (chance < 0.20) { droppedItem = 'lootbox'; }    

        if (droppedItem) {
            dropCooldowns.set(userId, Date.now());
            // Global Add Item
            await economy.addItem(userId, droppedItem, 1);
            sendLootboxMessage(message.channel, userId, droppedItem);
        }
        return; 
    }

    // Xử lý lệnh có Prefix
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const rawCmd = message.content.split(' ')[0].toLowerCase();

    // Check disable command (Server Specific)
    if (await economy.isCommandDisabled(message.channel.id, cmd, COMMAND_ALIASES)) return; 

    if (cmd === 'help') {
        return message.reply("**Danh Sách Lệnh | Command List**\n\nhttps://meouxhii.github.io/meoubot/\n\n**Server Hỗ Trợ | Support Server**\n\nhttps://discord.gg/GERM7nF6");
    }

    // Economy Commands
    if (COMMAND_ALIASES[cmd] || ['work','w','slut','s','crime','c','rob','bal','balance','dep','deposit','cat','with','withdraw','lay','give','givemoney','lb','leaderboard','addmoney','removemoney','addmoneyrole','removemoneyrole','addmoneyall','resetmoney','setcooldown','setpayout','setfailrate','setcurrency','setstartbalance','prefix','disable','enable','gentestusers','removetestusers','addreply','addreplyfail','setadmin','removeadmin', 'daily', 'diemdanh', 'checkin', 'setchanel', 'setchannel'].includes(cmd)) {
         try { await handleEconomyCommand(message, cmd, args); } catch (error) { console.error(`ERROR [${cmd}]:`, error); message.reply("Lệnh gặp sự cố."); }
         return;
    }

    try {
        const gamblingCmds = ['xd', 'bj', 'dg', 'baucua', 'bc', 'rl', 'dua'];
        if (gamblingCmds.includes(cmd)) { if (!(await checkChannel(message, 'baucua'))) return; }

        if (cmd === 'xd' || cmd === 'bj') await handleXiDach(message, args);
        else if (cmd === 'dg') await handleChicken(message, args);
        else if (cmd === 'baucua' || cmd === 'bc') await handleBauCua(message, args, client);
        else if (cmd === 'rl') await handleRoulette(message, args);
        else if (cmd === 'dua') await handleRace(message);
        else if (cmd === 'roll') await handleRoll(message, args);
        
        else if (['ch', 'mua', 'buy', 'cuahang', 'shop', 'addstock', 'setmoney'].includes(cmd)) {
            await handleShop(message, rawCmd.startsWith('.') ? rawCmd : `.${cmd}`, args);
        } 
        else if (cmd === 'check') await handleCheckPrice(message);
        else if (cmd === 'ban' || cmd === 'sell') {
            if (args.length === 0) return message.reply("Bạn muốn bán gì? VD: `.ban sau` hoặc `.ban sau 10`");

            let quantity = 1;
            let isAll = false;
            let keywordArgs = args;
            const lastArg = args[args.length - 1].toLowerCase();
            if (lastArg === 'all') { isAll = true; keywordArgs = args.slice(0, -1); }
            else if (!isNaN(parseInt(lastArg))) { quantity = parseInt(lastArg); keywordArgs = args.slice(0, -1); }

            const searchKeyword = keywordArgs.join(' ');

            // 1. Check Class Thú (Bán cả hệ)
            const cleanKeyUpper = searchKeyword.toUpperCase().trim();
            if (HUNT_CONFIG && HUNT_CONFIG.CLASSES && HUNT_CONFIG.CLASSES[cleanKeyUpper]) {
                const classData = HUNT_CONFIG.CLASSES[cleanKeyUpper];
                const targetObj = { 
                    type: 'class', 
                    id: cleanKeyUpper, 
                    ...classData, 
                    data: classData 
                };
                return executeSellZoo(message, targetObj, quantity, isAll);
            }

            // 2. Tìm kiếm thông minh (Thú và Item)
            let animals = findAllMatchingAnimals(searchKeyword);
            let items = findAllItemsSmart(searchKeyword).filter(i => i.id.startsWith('gem')); // Chỉ bán ngọc

            const allMatches = [
                ...animals.map(a => ({ ...a, type: 'animal' })),
                ...items.map(i => ({ ...i, type: 'item' }))
            ];

            if (allMatches.length === 0) {
                return message.reply("Không tìm thấy vật phẩm hay thú nào để bán.");
            }

            // Hàm xử lý chọn item để bán
            const processSellSelection = async (selected, interaction) => {
                const ctx = interaction || message;
                const uid = ctx.member ? ctx.member.id : ctx.author.id;

                if (selected.type === 'animal') {
                    executeSellZoo(ctx, selected, quantity, isAll);
                } 
                else if (selected.type === 'item') {
                    const item = selected.data || selected;
                    
                    const currentStock = await economy.getItemAmount(uid, item.id);
                    if (currentStock <= 0) {
                        const msg = `🎒 Bạn không có **${item.name}** nào để bán.`;
                        if (interaction) return interaction.update({ content: msg, embeds: [], components: [] });
                        return ctx.reply(msg);
                    }

                    let sellQty = quantity;
                    if (isAll || sellQty > currentStock) sellQty = currentStock;
                    if (sellQty <= 0) return; 

                    const marketInfo = gemMarket.getGemPrice(item.id);
                    const unitPrice = marketInfo.price;
                    const totalPrice = unitPrice * sellQty;

                    const embed = new EmbedBuilder()
                        .setColor('Orange')
                        .setTitle('XÁC NHẬN BÁN NGỌC')
                        .setDescription(
                            `Bạn có chắc muốn bán **${sellQty}x** ${item.emoji} **${item.name}**?\n` +
                            `Giá: **${unitPrice.toLocaleString()}** 🪙/viên\n` +
                            `Tổng nhận: **${totalPrice.toLocaleString()}** 🪙`
                        );

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('sell_item_yes').setLabel('Đồng Ý').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('sell_item_no').setLabel('Hủy').setStyle(ButtonStyle.Danger)
                    );

                    let replyMsg;
                    if (interaction) {
                        await interaction.update({ content: null, embeds: [embed], components: [row] });
                        replyMsg = interaction.message;
                    } else {
                        replyMsg = await ctx.reply({ embeds: [embed], components: [row] });
                    }

                    const collector = replyMsg.createMessageComponentCollector({ 
                        componentType: ComponentType.Button, 
                        time: 30000, 
                        filter: i => i.user.id === uid 
                    });

                    collector.on('collect', async i => {
                        if (i.customId === 'sell_item_no') {
                            await i.update({ content: "Đã hủy.", embeds: [], components: [] });
                            return;
                        }
                        if (i.customId === 'sell_item_yes') {
                            const stockCheck = await economy.getItemAmount(uid, item.id);
                            if (stockCheck < sellQty) return i.update({ content: "Số lượng không đủ.", embeds: [], components: [] });

                            await economy.removeItem(uid, item.id, sellQty);
                            await economy.addMoney(uid, totalPrice, "Sell Gem");

                            await i.update({ 
                                content: null, 
                                embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Đã bán **${sellQty}x ${item.name}** thu về **${totalPrice.toLocaleString()}** 🪙`)], 
                                components: [] 
                            });
                        }
                    });
                }
            };

            if (allMatches.length > 1) {
                await showSelectionMenu(message, allMatches, 'sell', processSellSelection);
            } else {
                processSellSelection(allMatches[0], null);
            }
        }
        else if (cmd === 'reroll') {
             if (message.author.id === message.guild.ownerId || message.author.id === '414792622289190917') {
                 gemMarket.updateMarketPrices();
                 message.reply(" Đã cập nhật lại giá thị trường đá quý!");
             } else {
                 message.reply("⛔ Bạn không có quyền reroll giá thị trường.");
             }
        }
        else if (cmd === 'iteminfo' || cmd === 'bootboxvip' || cmd === 'lbvip') await handleItemInfo(message, [cmd === 'iteminfo' ? args[0] : cmd]);

        else if (['inv', 'inventory', 'kho'].includes(cmd)) await handleInventory(message, args);
        else if (['give-item', 'giveitem', 'cho-item', 'choitem'].includes(cmd)) await handleGiveItem(message, args);
        else if (['additem', 'add-item'].includes(cmd)) await handleAddItem(message, args); 
        else if (cmd === 'remove-item') await handleRemoveItem(message, args);
        
        else if (['xai', 'use'].includes(cmd)) await handleUseItem(message, args);

        else if (cmd === 'h' || cmd === 'hunt') await handleHunt(message);
        else if (cmd === 'z' || cmd === 'zoo') await handleZoo(message, args);

        else if (cmd === 'team') await handleTeam(message, args);
        else if (cmd === 'rename') await handleRename(message, args);
        else if (['b', 'battle'].includes(cmd)) await handleBattle(message);
        else if (cmd === 'binfo') await handleBattleInfo(message, args);
        else if (cmd === 'setbattlecd') await handleSetBattleCooldown(message, args);

        else if (cmd === 'uno') {
             if (await checkChannel(message, 'uno')) await handleUnoCommand(message, args);
        }
        
        else if (cmd === 'start' || cmd === 'stop' || cmd === 'mode') {
            if (await checkChannel(message, 'noitu')) await handleWordChain(message, '.' + cmd, args);
        }

    } catch (error) { console.error(`Lỗi xử lý lệnh ${cmd}:`, error); }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId.startsWith('uno_')) {
            await handleUnoInteraction(interaction);
        }
    }
});
process.on('unhandledRejection', (reason, promise) => {
    // Nếu lỗi là Rate Limit (Opcode 8) thì bỏ qua, không crash bot
    if (reason && reason.code === 429) {
        console.warn('⚠️ [Rate Limit] Bot đang bị Discord giới hạn requests. Đang tự động giảm tốc độ...');
        return;
    }
    // Nếu lỗi GatewayRateLimitError từ thư viện
    if (reason && reason.name === 'GatewayRateLimitError') {
        console.warn('⚠️ [Gateway Limit] Đang bị giới hạn Gateway. Bỏ qua yêu cầu.');
        return;
    }
    
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Không exit process để bot sống dai hơn
});
client.login(process.env.DISCORD_TOKEN);