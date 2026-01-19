// games/wordchain.js
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const economy = require('../utils/economy');
const { ADMIN_ROLE_ID, DEFAULT_CONFIG } = require('../config');
const E = require('../emoji'); 

const DATA_DIR = path.join(__dirname, '..', 'data');
const WORDS_FILE = path.join(DATA_DIR, 'official-words.txt');
const CONTRIBUTE_FILE = path.join(DATA_DIR, 'contribute-words.txt'); 
const CONFIG_FILE = path.join(DATA_DIR, 'wordchain-config.json'); 

// ID CỦA BẠN
const OWNER_ID = '414792622289190917';

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let CONFIG = { ...DEFAULT_CONFIG };
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
        CONFIG = { ...DEFAULT_CONFIG, ...savedConfig };
    } catch (e) {
        console.error("Lỗi đọc config nối từ:", e);
    }
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2));
}

const EMOJI = {
    OK: E.SYSTEM.OK,
    WRONG: E.SYSTEM.WRONG,
    HAHA: E.SYSTEM.HAHA,
    HOHO: E.SYSTEM.HOHO,
    HEHE: E.SYSTEM.HEHE,
    AHA: E.SYSTEM.AHA
};

// Map lưu timer cục bộ (Vì timer không lưu DB được)
const localTimers = new Map();
let dictionary = new Set(); 

async function loadDictionary() {
    try {
        if (!fs.existsSync(WORDS_FILE)) {
            const sampleWords = ["con gà", "gà trống", "trống mái", "mái nhà", "nhà cửa"].join('\n');
            fs.writeFileSync(WORDS_FILE, sampleWords);
        }
        const data = fs.readFileSync(WORDS_FILE, 'utf-8');
        const words = data.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
        dictionary = new Set(words);
        console.log(` [WordChain] Đã tải ${dictionary.size} từ vựng.`);
    } catch (e) {
        console.error("[WordChain] Lỗi tải từ điển:", e);
    }
}

async function addContributeWords(newWordsArray) {
    const validWords = newWordsArray.map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    if (validWords.length === 0) return 0;

    let addedCount = 0;
    validWords.forEach(w => {
        if (!dictionary.has(w)) {
            dictionary.add(w);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        const fileContent = validWords.join('\n') + '\n';
        fs.appendFileSync(CONTRIBUTE_FILE, fileContent, 'utf8');
    }
    return addedCount;
}

function getWordChainConfig() { return CONFIG; }
function updateWordChainConfig(newConfig) { CONFIG = { ...CONFIG, ...newConfig }; saveConfig(); }
function isValidWord(word) { return dictionary.has(word.toLowerCase()); }

function checkWordCooldown(words, word) {
    for (let j = words.length - 1; j >= 0; j--) {
        if (words[j] === word) {
            const distance = words.length - j;
            if (distance <= CONFIG.COOLDOWN_TURNS) return CONFIG.COOLDOWN_TURNS - distance + 1;
        }
    }
    return false;
}

function setIdleReminder(channel, word) {
    if (localTimers.has(channel.id)) clearTimeout(localTimers.get(channel.id));

    const timer = setTimeout(() => {
        const session = economy.getGameSession(channel.id);
        if (session && session.game_type === 'noitu') {
            const embed = new EmbedBuilder()
                .setColor('Yellow')
                .setDescription(`${EMOJI.AHA} **Game đang chờ!** Từ hiện tại là: **${word.toUpperCase()}**\n👉 Hãy nối tiếp bằng từ bắt đầu bằng chữ **"${word.split(' ').pop().toUpperCase()}"**`);
            channel.send({ embeds: [embed] }).catch(() => {});
        }
    }, 120000); 
    
    localTimers.set(channel.id, timer);
}

const sendAutoDeleteMessage = (message, msgContent, seconds = 5) => {
    message.channel.send({ content: msgContent }).then(m => {
        setTimeout(() => m.delete().catch(() => {}), seconds * 1000);
    }).catch(() => {});
};

async function handleWordChain(message, cmd, args) {
    const channelId = message.channel.id;
    const userId = message.author.id;
    const guildId = message.guild.id;
    const content = message.content.trim().toLowerCase();

    // Lấy Session từ Economy (DB/RAM)
    const sessionDB = economy.getGameSession(channelId);
    const isRunning = sessionDB && sessionDB.game_type === 'noitu';

    // .START
    if (cmd === '.start') {
        if (isRunning) {
            return message.reply("Game nối từ đang chạy ở kênh này rồi! Dùng `.stop` để dừng.");
        }

        if (dictionary.size === 0) await loadDictionary();
        const dictArray = Array.from(dictionary);
        if (dictArray.length === 0) return message.reply("Từ điển trống!");

        const firstWord = dictArray[Math.floor(Math.random() * dictArray.length)];

        // Lưu Session vào Economy
        const newSessionData = {
            words: [firstWord],
            lastUser: null,
            mode: 'multi'
        };
        await economy.setGameSession(channelId, guildId, 'noitu', newSessionData);

        setIdleReminder(message.channel, firstWord);

        const embed = new EmbedBuilder()
            .setTitle("🎮 GAME NỐI TỪ BẮT ĐẦU!")
            .setDescription(`Từ đầu tiên là: **${firstWord.toUpperCase()}**\n\n👉 Hãy nối tiếp bằng từ bắt đầu bằng chữ **"${firstWord.split(' ').pop().toUpperCase()}"**\n👉 Chế độ: **Multi** (Mặc định)`)
            .setColor('Green')
            .setFooter({ text: "Gõ .mode solo hoặc .mode multi để đổi chế độ." });

        return message.channel.send({ embeds: [embed] });
    }

    // .STOP
    if (cmd === '.stop') {
        if (!isRunning) return message.reply("Không có game nào đang chạy ở đây.");

        if (localTimers.has(channelId)) clearTimeout(localTimers.get(channelId));
        
        const dictArray = Array.from(dictionary);
        const newWord = dictArray[Math.floor(Math.random() * dictArray.length)];

        // Update Session (Reset lượt)
        const newSessionData = {
            words: [newWord],
            lastUser: null,
            mode: sessionDB.data.mode || 'multi'
        };
        await economy.setGameSession(channelId, guildId, 'noitu', newSessionData);
        
        setIdleReminder(message.channel, newWord);
        
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(
                `🛑 **${message.author.toString()} đã kết thúc lượt này do bí từ! Lượt mới đã sẵn sàng.**\n` +
                `👉 Từ đầu tiên là: **${newWord.toUpperCase()}**`
            );

        return message.channel.send({ embeds: [embed] });
    }

    // .MODE
    if (cmd === '.mode') {
        if (!isRunning) return message.reply("Chưa có game nào chạy.");
        
        const config = await economy.getConfig(guildId);
        const adminRoles = config.admin_roles || [];
        const isOwner = userId === message.guild.ownerId || userId === OWNER_ID;
        const hasAdminRole = message.member.roles.cache.some(r => adminRoles.includes(r.id));
        const hasHardcodedAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID);

        if (!isOwner && !hasAdminRole && !hasHardcodedAdmin) {
            return message.reply("⛔ Bạn không có quyền đổi chế độ chơi! (Cần quyền Admin/Mod)");
        }

        const modeArg = args && args[0] ? args[0].toLowerCase() : '';
        const currentData = sessionDB.data;

        if (modeArg === 'solo') {
            currentData.mode = 'solo';
            await economy.setGameSession(channelId, guildId, 'noitu', currentData);
            return message.reply(" Đã chuyển sang chế độ **SOLO** (Có thể tự nối từ của chính mình).");
        } else if (modeArg === 'multi') {
            currentData.mode = 'multi';
            await economy.setGameSession(channelId, guildId, 'noitu', currentData);
            return message.reply(" Đã chuyển sang chế độ **MULTI** (Phải chờ người khác nối).");
        }
        return message.reply(`Chế độ hiện tại: **${currentData.mode.toUpperCase()}**. Dùng \`.mode solo\` hoặc \`.mode multi\` để đổi.`);
    }

    // GAMEPLAY
    if (isRunning) {
        if (content.startsWith('.') && cmd !== '.start' && cmd !== '.stop' && cmd !== '.mode') return;

        const sessionData = sessionDB.data;

        if (sessionData.mode === 'multi' && sessionData.lastUser === userId) {
            const msg = await message.channel.send("Bạn cần chờ người khác nối từ này mới có thể tiếp tục trò chơi");
            setTimeout(() => msg.delete().catch(() => {}), 3000);
            return; 
        }

        let word = content.replace(/\s+/g, ' '); 
        let args1 = word.split(' ');

        if (args1.length !== 2) return; 

        // --- GIỮ NGUYÊN BLOCK CHECK TỪ ĐIỂN ---
        if (!isValidWord(word)) {
            message.react(EMOJI.WRONG).catch(() => {});
            
            const invalidMessages = [
                `${EMOJI.HAHA} Từ này chắc chỉ có trong giấc mơ của bạn thôi =))`,
                "Tra mòn cái từ điển cũng không ra từ này đâu á.",
                `${EMOJI.HOHO} Ủa alo? Tiếng Việt update bản mới hồi nào dợ?`,
                `Ní lại lươn lẹo rồi, từ này làm gì có nghĩa ${EMOJI.WRONG}`,
                `${EMOJI.HEHE} Chịu thua chưa? Chứ em là em thấy sai sai rồi đó.`,
                "Đừng có bịa từ nha, em méc cô giáo tiếng Việt đó!",
                "Từ này lạ quá, chắc người ngoài hành tinh mới hiểu :v",
                "Sai rồi bạn ơi, thử lại từ khác đi nè.",
                "Cố chấp là không có hạnh phúc đâu nha, từ sai lè kìa!",
                "Bạn định hack não em bằng từ này hả? Không có cửa đâu :)))"
            ];
            const randomMsg = invalidMessages[Math.floor(Math.random() * invalidMessages.length)];
            sendAutoDeleteMessage(message, randomMsg, 5);
            return;
        }
        // ----------------------------------------

        const lastWord = sessionData.words[sessionData.words.length - 1];
        const lastChar = lastWord.split(' ').pop(); 
        const firstChar = args1[0];                 

        if (lastChar !== firstChar) {
            message.react(EMOJI.WRONG).catch(() => {});
            sendAutoDeleteMessage(message, `Từ này không bắt đầu với tiếng \`${lastChar}\``, 3);
            return;
        }

        const cooldownRemaining = checkWordCooldown(sessionData.words, word);
        if (cooldownRemaining) {
            message.react(EMOJI.WRONG).catch(() => {});
            // --- GIỮ NGUYÊN MESSAGE COOLDOWN ---
            sendAutoDeleteMessage(message, `- Từ này đã sử dụng trong ${CONFIG.COOLDOWN_TURNS} lượt gần nhất.`, 5);
            return;
        }

        // --- HỢP LỆ ---
        sessionData.words.push(word);
        sessionData.lastUser = userId;
        
        // Lưu Session vào Economy
        await economy.setGameSession(channelId, guildId, 'noitu', sessionData);
        
        setIdleReminder(message.channel, word);

        // Global Add Money (Không guildId)
        await economy.addMoney(userId, CONFIG.REWARD_PER_WORD, "Wordchain Reward");
        await economy.updateWordChainStats(null, userId, false);

        await message.react(EMOJI.OK).catch(() => {});

        const nextStart = args1[1]; 
        let canContinue = false;

        for (const dictWord of dictionary) {
            const dictParts = dictWord.split(' ');
            if (dictParts[0] === nextStart && dictWord !== word) {
                if (!checkWordCooldown(sessionData.words, dictWord)) {
                    canContinue = true;
                    break;
                }
            }
        }

        if (!canContinue) {
            const totalWords = sessionData.words.length;
            const rewardBase = parseInt(CONFIG.REWARD_BASE) || 1000;
            const rewardPerWord = parseInt(CONFIG.REWARD_PER_WORD) || 200;
            const rewardMax = parseInt(CONFIG.REWARD_MAX) || 25000;

            let calculatedReward = rewardBase + (totalWords * rewardPerWord);
            let finalReward = Math.min(calculatedReward, rewardMax);
            
            if (isNaN(finalReward)) finalReward = 1000;

            await economy.addMoney(userId, finalReward, "WordChain Win Bonus");
            await economy.updateWordChainStats(null, userId, true);

            // --- GIỮ NGUYÊN MESSAGE CHIẾN THẮNG ---
            message.channel.send(`<@${userId}> đã chiến thắng sau **${totalWords}** từ và nhận được **${finalReward.toLocaleString()}** 🪙 vào ngân hàng\nLượt mới đã bắt đầu!`);
            
            const dictArray = Array.from(dictionary);
            let newWord = dictArray[Math.floor(Math.random() * dictArray.length)];
            
            const newData = { words: [newWord], lastUser: null, mode: sessionData.mode };
            
            // Reset Session
            await economy.setGameSession(channelId, guildId, 'noitu', newData);
            message.channel.send(`Từ đầu tiên là: **${newWord}**`);
            return;
        }
    }
}

// --- HÀM RESUME (Để index.js gọi) ---
async function resumeWordChainGames(client) {
    console.log("🔄 [WordChain] Resuming active games...");
    for (const [channelId, session] of economy.gameSessions) {
        if (session.game_type === 'noitu') {
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel) {
                    const lastWord = session.data.words[session.data.words.length - 1];                }
            } catch (e) {
                economy.deleteGameSession(channelId);
            }
        }
    }
}

module.exports = {
    handleWordChain,
    loadDictionary,
    resumeWordChainGames,
    getWordChainConfig,
    updateWordChainConfig,
    addContributeWords
};