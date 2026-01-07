const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');
const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[36m",   // [INFO]
    green: "\x1b[32m",  // [SUCCESS]
    yellow: "\x1b[33m", // [Rate]
    red: "\x1b[31m",    // [Error]
    gray: "\x1b[90m"
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

function getRangeValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (value.includes('-')) {
            const [min, max] = value.split('-').map(Number);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return Number(value);
    }
    return 1000;
}

function parseMessage(content) {
    return content.replace(/\{r-(\d+)\}/g, (match, length) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: Number(length) }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function log(type, msg) {
    const time = new Date().toLocaleTimeString();
    let color = colors.reset;
    let label = "";

    switch (type) {
        case 'INFO':
            color = colors.blue;
            label = "[INFO]";
            break;
        case 'SUCCESS':
            color = colors.green;
            label = "[SUCCESS]";
            break;
        case 'RATE':
            color = colors.yellow;
            label = "[Rate]";
            break;
        case 'ERROR':
            color = colors.red;
            label = "[Error]";
            break;
    }
    console.log(`${colors.gray}[${time}]${colors.reset} ${color}${label}${colors.reset} ${msg}`);
}

function displayStats() {
    const elapsed = STATS.startTime ? Math.floor((Date.now() - STATS.startTime) / 1000) : 0;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}m ${seconds}s`;
    
    const successRate = STATS.totalSent > 0 
        ? ((STATS.success / STATS.totalSent) * 100).toFixed(1) 
        : 0;
    
    const avgSpeed = elapsed > 0 
        ? (STATS.success / elapsed * 60).toFixed(2) 
        : 0;
    
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━ 統計情報 ━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green} 成功:${colors.reset} ${STATS.success}  ${colors.red} 失敗:${colors.reset} ${STATS.errors}  ${colors.yellow} レート制限:${colors.reset} ${STATS.rateLimit}`);
    console.log(`${colors.blue} 総送信数:${colors.reset} ${STATS.totalSent}  ${colors.green}成功率:${colors.reset} ${successRate}%`);
    console.log(`${colors.blue} 実行時間:${colors.reset} ${timeStr}  ${colors.green}平均速度:${colors.reset} ${avgSpeed} msg/分`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

let statsInterval = null;

function startStatsDisplay() {
    // 10秒ごとに統計情報を表示
    statsInterval = setInterval(() => {
        displayStats();
    }, 10000);
}

function stopStatsDisplay() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

let TOKENS = [];
let CHANNELS = [];
let MESSAGES = [];
let SETTINGS = {};
let CHANNEL_NAMES_CACHE = {}; 
let ACTIVE_REQUESTS = 0;

// 統計情報
let STATS = {
    success: 0,
    errors: 0,
    rateLimit: 0,
    startTime: null,
    totalSent: 0
}; 

async function loadData(folderName) {
    const folderPath = path.join(__dirname, folderName);
    try {
        await fs.access(folderPath);
    } catch {
        throw new Error(`Directory '${folderName}' not found.`);
    }

    const tokensRaw = await fs.readFile(path.join(folderPath, 'token.txt'), 'utf-8');
    TOKENS = tokensRaw.split(/\r?\n/).map(t => t.trim()).filter(Boolean);

    const channelsRaw = await fs.readFile(path.join(folderPath, 'channels.txt'), 'utf-8');
    CHANNELS = channelsRaw.split(/\r?\n/).map(c => c.trim()).filter(Boolean);

    const messageRaw = await fs.readFile(path.join(folderPath, 'message.txt'), 'utf-8');
    
    try {
        const settingsRaw = await fs.readFile(path.join(folderPath, 'settings.json'), 'utf-8');
        SETTINGS = JSON.parse(settingsRaw);
    } catch (e) {
        throw new Error("Failed to load settings.json: " + e.message);
    }

    if (SETTINGS.SPLIT_NEWLINE) {
        MESSAGES = messageRaw.split(/\r?\n/).filter(line => line.trim() !== '');
    } else {
        MESSAGES = [messageRaw.trim()];
    }

    log('INFO', `Data Loaded: Tokens:[${TOKENS.length}] Channels:[${CHANNELS.length}] Messages:[${MESSAGES.length}]`);
}

async function fetchChannelName(channelId, token) {
    if (CHANNEL_NAMES_CACHE[channelId]) return CHANNEL_NAMES_CACHE[channelId];
    try {
        const res = await fetch(`https://discord.com/api/v9/channels/${channelId}`, {
            headers: { 'Authorization': token }
        });
        if (res.ok) {
            const data = await res.json();
            CHANNEL_NAMES_CACHE[channelId] = data.name || "unknown";
            return data.name;
        }
    } catch (e) { }
    return "unknown";
}

async function deleteMessage(channelId, messageId, token) {
    const delay = getRangeValue(SETTINGS.AFTER_DELETE_TIME);
    await sleep(delay);
    try {
        const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token }
        });
        if (res.status === 429) {
            const json = await res.json().catch(() => ({}));
            const retry = (json.retry_after || 1) * 1000;
            await sleep(retry);
            deleteMessage(channelId, messageId, token);
        }
    } catch (e) {}
}

async function performRequest(token, channelId, content) {
    ACTIVE_REQUESTS++;
    STATS.totalSent++;
    const tkn = token.slice(1,20);
    try {
        let channelName = CHANNEL_NAMES_CACHE[channelId] || "...";

        const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { 
                'Authorization': token, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ content: content })
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok) {
            STATS.success++;
            const user = json.author || { username: "Unknown", id: "Unknown" };
            const cId = json.channel_id;
            const msgId = json.id;

            if(!CHANNEL_NAMES_CACHE[cId]) {
                fetchChannelName(cId, token).catch(()=>{});
            } else {
                channelName = CHANNEL_NAMES_CACHE[cId];
            }

            log('SUCCESS', `${tkn}... | ${user.username} (${user.id}) ch:#${channelName} (${cId})`);

            if (SETTINGS.AFTER_DELETE) {
                deleteMessage(cId, msgId, token);
            }

        } else if (res.status === 429) {
            STATS.rateLimit++;
            STATS.errors++;
            const retry = json.retry_after || 1;
            log('RATE', `${tkn}... | Status: 429 RETRY_AFTER: ${retry}`);
        } else {
            STATS.errors++;
            log('ERROR', `${tkn}... | Status: ${res.status} code: ${json.message || JSON.stringify(json)}`);
        }
    } catch (e) {
        STATS.errors++;
        log('ERROR', `${tkn}... | Network Error: ${e.message}`);
    } finally {
        ACTIVE_REQUESTS--;
    }
}

async function startSpam() {
    let loopCount = 0;
    
    const countSetting = getRangeValue(SETTINGS.SEND_COUNT);
    const isInfinite = (countSetting === 0);
    
    log('INFO', isInfinite ? "Mode: Infinity" : `Mode: Count: ${countSetting}`);

    let tokenIndex = 0;
    let channelIndex = 0;

    STATS.startTime = Date.now();
    startStatsDisplay();

    while (isInfinite || loopCount < countSetting) {
        const token = TOKENS[tokenIndex % TOKENS.length];
        const channelId = CHANNELS[channelIndex % CHANNELS.length];
        const rawMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        const content = parseMessage(rawMsg);

        tokenIndex++;
        channelIndex++;
        loopCount++;

        performRequest(token, channelId, content);

        const interval = getRangeValue(SETTINGS.INTERVAL);
        await sleep(interval);
    }

    log('INFO', 'All requests dispatched. Waiting for completion...');
    
    while (ACTIVE_REQUESTS > 0) {
        await sleep(500);
    }

    stopStatsDisplay();
    
    // 最終統計を表示
    console.log('\n');
    log('INFO', 'Task Complete!');
    displayStats();
    
    process.exit(0);
}

(async () => {
    console.log(colors.blue + `
  ██████╗ ██╗███████╗██████╗  █████╗ ███╗   ███╗
  ██╔══██╗██║██╔════╝██╔══██╗██╔══██╗████╗ ████║
  ██║  ██║██║███████╗██████╔╝███████║██╔████╔██║
  ██║  ██║██║╚════██║██╔═══╝ ██╔══██║██║╚██╔╝██║
  ██████╔╝██║███████║██║     ██║  ██║██║ ╚═╝ ██║
  ╚═════╝ ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝     ╚═╝
    ` + colors.reset);

    while(true) {
        const folder = await askQuestion("folder name > ");
        try {
            await loadData(folder);
            break;
        } catch (e) {
            console.log(colors.red + `[Error] ${e.message}` + colors.reset);
        }
    }

    while(true) {
        const answer = await askQuestion("Ready? (Y/n) > ");
        const ans = answer.toLowerCase();
        if (ans === 'y' || ans === 'yes') {
            break;
        } else if (ans === 'n' || ans === 'no') {
            process.exit(0);
        }
    }

    startSpam();
})();
