// SriVaariBot - Complete WhatsApp Temple Bot Code with Baileys.js, Excel Events, and Scheduled Messages

const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
const cron = require('node-cron');
const XLSX = require('xlsx');
const http = require('http');
const moment = require('moment-timezone'); // Added moment-timezone

const MENU_TEXT = 'Reply with:\n1️⃣ Temple Timings\n2️⃣ Archana Timings\n3️⃣ Darshan Live\n4️⃣ Event Calendar\n5️⃣ Donate\n6️⃣ Upcoming Programs\n7️⃣ Srivari ThiruNakshatra Kalyanam\n8️⃣ Srivari Abhishekam Booking\n9️⃣ Sri SatyanarayanaSwamy Vratam Booking\n🔟 Register Birthday'; // Added Birthday Registration option

const QUOTES = [
    'Govinda Govinda! May Lord Venkateswara bless your day 🙏',
    '🍀 Jai Balaji! Keep faith and move forward.',
    '🕉️ Chant Govinda Govinda and feel the peace.',
    '☀️ Start your day with devotion and light.'
];

const USERS_FILE_PATH = path.join(__dirname, 'users.json');
const EXCEL_FILE_PATH = path.join(__dirname, 'programs_notifiy.xlsx'); // Updated Excel file name
const BIRTHDAY_FILE_PATH = path.join(__dirname, 'Birthday_File.xlsx'); // New Excel file for birthdays

function loadUsers() {
    return fs.existsSync(USERS_FILE_PATH) ? JSON.parse(fs.readFileSync(USERS_FILE_PATH)) : [];
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2));
}

function storeUser(name, number) {
    const users = loadUsers();
    if (!users.some((u) => u.number === number)) {
        users.push({ name, number });
        saveUsers(users);
        console.log(`✅ Added new user: ${name} - ${number}`);
    }
}

function excelSerialDateToJSDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);
    return date;
}

function loadProgramsFromExcel() {
    try {
        const workbook = XLSX.readFile(EXCEL_FILE_PATH);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        return data.map(row => {
            const rawDate = row.Date;
            const rawTime = row.Time || '';

            let momentDate;
            if (typeof rawDate === 'number') {
                // Handle Excel serial date
                const jsDate = excelSerialDateToJSDate(rawDate);
                momentDate = moment(jsDate);
            } else if (rawDate) {
                // Try parsing as DDMMMYYYY, and other common formats
                momentDate = moment(rawDate, ['DDMMMYYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'D-M-YYYY', 'YYYY-M-D'], true);
            } else {
                momentDate = moment.invalid(); // Set to invalid if no date
            }

            let formattedDate = '';
            let formattedDay = '';
            if (momentDate.isValid()) {
                formattedDate = momentDate.format('DMMMYYYY');
                formattedDay = momentDate.format('dddd');
            }

            let formattedTime = '';
            const momentTime = moment(rawTime, ['h:mm A', 'HH:mm', 'h A'], true);
            if (momentTime.isValid()) {
                formattedTime = momentTime.format('h:mm A');
            } else if (typeof rawTime === 'number') {
                const secondsInDay = 24 * 60 * 60;
                const seconds = Math.round(rawTime * secondsInDay);
                const hours = Math.floor(seconds / (60 * 60));
                const minutes = Math.floor((seconds % (60 * 60)) / 60);
                formattedTime = moment({ hour: hours, minute: minutes }).format('h:mm A');
            }

            return {
                Date: formattedDate || rawDate || '', // Keep rawDate for potential fallback or logging
                Day: formattedDay || (rawDate ? moment(rawDate, ['DDMMMYYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'D-M-YYYY', 'YYYY-M-D'], true).format('dddd') : ''),
                Time: formattedTime || rawTime,
                Event: row.Event || '',
                Notes: row.Notes || ''
            };
        });
    } catch (err) {
        console.error('❌ Failed to load program Excel file:', err.message);
        return [];
    }
}

// --- Birthday Feature ---
// --- Birthday Feature ---
const BIRTHDAY_REGISTRATION_STATE = {};

function loadBirthdayDataFromExcel() {
    console.log('🎂 Loading birthday data from Excel...');
    try {
        const workbook = XLSX.readFile(BIRTHDAY_FILE_PATH);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log('🎂 Raw birthday data from Excel:', data);
        const mappedData = data.map(row => {
            console.log('🔍 Processing row:', row);
            let birthdayMoment = null;
            if (typeof row.birthday === 'number') {
                // Handle Excel serial date
                const jsDate = excelSerialDateToJSDate(row.birthday);
                birthdayMoment = moment(jsDate);
                console.log(`🔍 Birthday data - Raw: ${row.birthday}, Parsed from serial: ${birthdayMoment?.format('YYYY-MM-DD')}, Valid: ${birthdayMoment?.isValid()}`);
            } else if (row.birthday) {
                // Try parsing as YYYY-MM-DD string
                birthdayMoment = moment(row.birthday, ['YYYY-MM-DD'], true);
                console.log(`🔍 Birthday data - Raw: ${row.birthday}, Parsed as string: ${birthdayMoment?.format('YYYY-MM-DD')}, Valid: ${birthdayMoment?.isValid()}`);
            } else {
                console.warn('⚠️ Birthday field is empty.');
            }

            return {
                name: row.name?.trim(),
                number: String(row.number)?.trim(),
                birthday: birthdayMoment,
            };
        }).filter(item => {
            const isValid = item.name && item.number && item.birthday && item.birthday.isValid();
            console.log('✅ Filtered item:', item, 'Is Valid:', isValid);
            return isValid;
        });
        console.log('🎂 Loaded and processed birthday data from Excel:', mappedData);
        return mappedData;
    } catch (err) {
        console.error('❌ Failed to load birthday Excel file:', err.message);
        return [];
    }
}

function excelSerialDateToJSDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);
    return date;
}

function saveBirthdayDataToExcel(data) {
    console.log('💾 Saving birthday data to Excel:', data);
    try {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
            name: item.name,
            number: item.number,
            birthday: item.birthday?.format('YYYY-MM-DD')
        })));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Birthdays');
        XLSX.writeFile(workbook, BIRTHDAY_FILE_PATH);
        console.log('✅ Birthday data saved to Excel successfully.');
    } catch (err) {
        console.error('❌ Failed to save birthday data to Excel:', err.message);
    }
}

async function handleBirthdayRegistration(sock, sender, text) {
    console.log(`🎂 Handling birthday registration for ${sender} with input: ${text}`);
    if (!BIRTHDAY_REGISTRATION_STATE[sender]) {
        BIRTHDAY_REGISTRATION_STATE[sender] = { step: 1 };
        await sock.sendMessage(sender, { text: '🎂 Let\'s register your birthday! Please enter your name:' });
        console.log(`👤 Birthday registration initiated by ${sender}. Waiting for name.`);
    } else if (BIRTHDAY_REGISTRATION_STATE[sender].step === 1) {
        BIRTHDAY_REGISTRATION_STATE[sender].name = text.trim();
        BIRTHDAY_REGISTRATION_STATE[sender].step = 2;
        await sock.sendMessage(sender, { text: '🗓️ Please enter your birthday (DD-MM-YYYY):' });
        console.log(`👤 Name received from ${sender}: ${BIRTHDAY_REGISTRATION_STATE[sender].name}. Waiting for birthday.`);
    } else if (BIRTHDAY_REGISTRATION_STATE[sender].step === 2) {
        const birthday = moment(text, 'DD-MM-YYYY', true);
        console.log(`🔍 Birthday input from ${sender}: ${text}, Parsed: ${birthday.format('YYYY-MM-DD')}, Valid: ${birthday.isValid()}`);
        if (birthday.isValid()) {
            const users = loadUsers();
            console.log('Registered Users:', users);
            const user = users.find(u => u.number === sender);
            if (user) {
                const birthdayData = loadBirthdayDataFromExcel();
                birthdayData.push({ name: BIRTHDAY_REGISTRATION_STATE[sender].name, number: sender, birthday: birthday.format('YYYY-MM-DD') });
                saveBirthdayDataToExcel(birthdayData);
                await sock.sendMessage(sender, { text: `🎉 Your birthday (${birthday.format('DD-MM-YYYY')}) has been registered!` });
                console.log(`🎂 Birthday registered for ${sender} (${BIRTHDAY_REGISTRATION_STATE[sender].name}): ${birthday.format('YYYY-MM-DD')}`);
            } else {
                await sock.sendMessage(sender, { text: '⚠️ Could not find your user information. Please interact with the bot with "jai" first.' });
                console.log(`⚠️ Could not register birthday for ${sender}. User not found.`);
            }
            delete BIRTHDAY_REGISTRATION_STATE[sender];
            console.log(`🗑️ Birthday registration state cleared for ${sender}.`);
        } else {
            await sock.sendMessage(sender, { text: '⚠️ Invalid date format. Please enter your birthday in DD-MM-YYYY format.' });
            console.log(`⚠️ Invalid birthday format received from ${sender}: ${text}`);
        }
    }
}

async function sendBirthdayWishes(sock) {
    console.log('🎂 Starting sendBirthdayWishes process...');
    const today = moment().tz('Asia/Kolkata');
    console.log('📅 Today\'s date (IST):', today.format('YYYY-MM-DD'));
    const birthdayDevotees = loadBirthdayDataFromExcel();
    console.log('🎂 Birthday devotees loaded:', JSON.stringify(birthdayDevotees, null, 2));
    const birthdayAudioPath = path.join(__dirname, 'birthdaywishes_audio.mp3');
    const birthdayImagePath = path.join(__dirname, 'SriVaariBotLogo.png'); // Using SriVaariBotLogo.png

    let birthdayImageBuffer = null;
    if (fs.existsSync(birthdayImagePath)) {
        birthdayImageBuffer = fs.readFileSync(birthdayImagePath);
        console.log('✅ Birthday logo image found: SriVaariBotLogo.png');
    } else {
        console.warn('⚠️ Birthday logo image not found: SriVaariBotLogo.png');
    }

    for (const devotee of birthdayDevotees) {
        console.log('🔍 Checking devotee:', JSON.stringify(devotee));
        if (devotee.birthday && devotee.birthday.isValid() &&
            devotee.birthday.date() === today.date() &&
            devotee.birthday.month() === today.month()) {
            console.log(`🎉 Found birthday for ${devotee.name} (${devotee.number}) TODAY! Sending wishes with audio.`);
            const birthdayWishText = `🙏Sri ${devotee.name} 🌟💐 May the divine blessings of Sri Bhoo Neela Sametha Venkateswara Swamy be always upon you.May your life flourish with joy and prosperity through the grace of the Lord. 🙏🌸🌺🌼 శ్రీ వేంకటేశ్వర స్వామి దేవస్థానం తరపున మీకు జన్మదిన శుభాకాంక్షలు! 🙏 శ్రీ భూ నీళా సమేతుడైన వేంకటేశ్వరుని దివ్య ఆశీస్సులు మీపై ఎల్లప్పుడూ ఉండుగాక🌿🌷🏵️. ఈ ప్రత్యేకమైన రోజున మీరు మరియు మీ కుటుంబ సభ్యులు ఆనందం, ఆరోగ్యం మరియు శాంతిని పొందాలని ప్రార్థిస్తున్నాముస్వామివారి కృపతో మీ జీవితం సుఖ సంతోషాలతో నిండుగా వర్ధిల్లు గాక  🙏🌿We cordially invite you to visit our sacred temple for Darshan and to receive the auspicious Vedashirvachanam, *offered 🌼freely🌼* to all devotees 🌿🌷🏵️🛕`;
            const personalizedWishText = birthdayWishText.replace('${devotee.name}', devotee.name);
            try {
                if (birthdayImageBuffer) {
                    await sock.sendMessage(devotee.number, {
                        image: birthdayImageBuffer,
                        caption: personalizedWishText
                    });
                } else {
                    await sock.sendMessage(devotee.number, { text: personalizedWishText });
                }
                await sock.sendMessage(devotee.number, {
                    audio: { url: birthdayAudioPath },
                    mimetype: 'audio/mpeg'
                });
                console.log(`🎉 Sent birthday wishes with audio to ${devotee.name} (${devotee.number})`);
            } catch (error) {
                console.error(`❌ Error sending birthday wishes with audio to ${devotee.name} (${devotee.number}):`, error);
            }
        } else if (devotee.birthday) {
            console.log(`🎂 No birthday for ${devotee.name} (${devotee.number}) today. Birthday is on: ${devotee.birthday.format('YYYY-MM-DD')}`);
        } else {
            console.warn(`⚠️ Invalid or missing birthday for ${devotee.name} (${devotee.number}).`);
        }
    }
    console.log('🎂 Birthday wishes process completed for today.');
}
// Cron Job for sending birthday wishes at 6:00 AM IST
    cron.schedule('59 0 * * *', async () => {
    await sendBirthdayWishes(sock);
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
});
// --- End Birthday Feature ---
// --- End Birthday Feature ---

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, printQRInTerminal: true });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp bot is connected and ready!');
        }
    });

    sock.ev.on('messages.upsert', async (msgUpdate) => {
        const msg = msgUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        if (sender.endsWith('@g.us')) return;

        const userName = msg.pushName || 'User';
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim().toLowerCase();

        storeUser(userName, sender);

        const imagePath = path.join(__dirname, 'SriVaariBotLogo.png');
        const imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;

        if (BIRTHDAY_REGISTRATION_STATE[sender]) {
            await handleBirthdayRegistration(sock, sender, text);
            return;
        }

        if (text === 'jai' || text.includes('🙏 jaishreeram')) {
            await sock.sendMessage(sender, {
                image: imageBuffer,
                caption: `🙏 *${userName}*, Welcome to HC SriVenkateswara Swamy Temple WhatsApp Bot - *SriVaariBot*!\n\n${MENU_TEXT}`
            });
        } else if (text === '1') {
            await sock.sendMessage(sender, {
                text: '🕉️ *Darshan Timings:*\n- Morning: 6:00 AM to 11:00 AM\n- Evening: 6:00 PM to 8:00 PM\n- Weekends: Until 11:30 AM (morning), 8:30 PM (evening)'
            });
        } else if (text === '2') {
            await sock.sendMessage(sender, {
                text: '🕉️ *Archana Timings:*\n- Morning: 7:00 AM to 10:45 AM\n- Evening: 6:00 PM to 7:20 PM'
            });
        } else if (text === '3') {
            await sock.sendMessage(sender, { text: '📺 Click here for Live Darshan:\nhttps://yourtemplelink.com/live' });
        } else if (['4', '6'].includes(text) || text.includes('event') || text.includes('program')) {
            const programs = loadProgramsFromExcel();
            if (programs.length === 0) {
                await sock.sendMessage(sender, { text: '📅 No upcoming programs found.' });
            } else {
                let message = '📅 *Upcoming Events & Programs:*\n\n';
                programs.forEach(p => {
                    message += `🔔 *${p.Event}*\n🗓️ *${p.Date}* (${p.Day}) at *${p.Time}*\n📝 *${p.Notes}*\n\n`;
                });
                await sock.sendMessage(sender, { text: message.trim() });
            }
        } else if (text === '5') {
            await sock.sendMessage(sender, { text: '🙏 *Support Our Temple*\nClick to donate:\nhttps://yourtemplelink.com/donate' });
        } else if (text === '7') {
            await sock.sendMessage(sender, { text: '💒 *Srivari ThiruNakshatra Kalyanam Booking:*\nhttps://hctemple.company.site/products/Sri-Vari-ThiruNakshatra-Kalyanam-p393853824' });
        } else if (text === '8') {
            await sock.sendMessage(sender, { text: '🕉️ *Abhishekam Booking:*\nhttps://hctemple.company.site/products/Sri-Vari-ThiruNakshatra-Kalyanam-p393853824' });
        } else if (text === '9') {
            await sock.sendMessage(sender, { text: '🪔 *Sri SatyanarayanaSwamy Vratam Booking:*\nhttps://hctemple.company.site/products/Sri-Rama-Sametha-Satya-Narayana-Swamy-Vratam-p393850634' });
        } else if (text === '10' || text.includes('register birthday')) {
            BIRTHDAY_REGISTRATION_STATE[sender] = { step: 1 };
            await sock.sendMessage(sender, { text: '🎂 Let\'s register your birthday! Please enter your name:' });
        } else if (text.includes('quote')) {
            const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
            await sock.sendMessage(sender, { text: `🕉️ *Daily Quote*\n\n"${quote}"` });
        } else if (text === 'menu') {
            await sock.sendMessage(sender, { text: MENU_TEXT });
        } else {
            await sock.sendMessage(sender, { text: '🙏 Please type "jai" or a number (1-10) to explore temple services.\n\nType *menu* anytime to see options again.' });
        }
    });

    const imagePath = path.join(__dirname, 'SriVaariBotLogo.png');
    const imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;

    // Cron Job for event notifications (runs every minute for testing, change to your desired schedule)
    cron.schedule('* * * * *', async () => {
        await sendScheduledNotifications(sock, imageBuffer); // Pass sock and imageBuffer
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    // Cron Job for sending birthday wishes at 6:00 AM IST
    cron.schedule('15 19 * * *', async () => {
        await sendBirthdayWishes(sock);
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
}

async function sendScheduledNotifications(sock, imageBuffer) {
    const users = loadUsers();
    console.log('Registered Users:', users);
    const programs = loadProgramsFromExcel();
    console.log('Loaded Programs:', programs);
    const now = moment().tz('Asia/Kolkata');
    console.log('Current Hour:', now.hour(), 'Current Minute:', now.minute());

    for (let program of programs) {
        try {
            const rawDate = program.Date || '';
            const rawTime = program.Time || '';

            let momentDate;
            if (typeof rawDate === 'number') {
                const jsDate = excelSerialDateToJSDate(rawDate);
                momentDate = moment(jsDate);
            } else if (rawDate) {
                momentDate = moment(rawDate, ['DDMMMYYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'D-M-YYYY', 'YYYY-M-D'], true);
            } else {
                momentDate = moment.invalid();
            }

            let formattedDate = '';
            if (momentDate.isValid()) {
                formattedDate = momentDate.format('DMMMYYYY');
            }

            let formattedTime = rawTime;
            const momentTime = moment(rawTime, ['h:mm A', 'HH:mm', 'h A'], true);
            if (momentTime.isValid()) {
                formattedTime = momentTime.format('h:mm A');
            } else if (typeof rawTime === 'number') {
                const secondsInDay = 24 * 60 * 60;
                const seconds = Math.round(rawTime * secondsInDay);
                const hours = Math.floor(seconds / (60 * 60));
                const minutes = Math.floor((seconds % (60 * 60)) / 60);
                formattedTime = moment({ hour: hours, minute: minutes }).format('h:mm A');
            }

            console.log(`🔍 Tracing - Raw Date: "${rawDate}", Formatted Date: "${formattedDate}", Moment Date Valid: ${momentDate.isValid()}`);
            console.log(`🔍 Tracing - Raw Time: "${rawTime}", Formatted Time: "${formattedTime}", Moment Time Valid: ${momentTime.isValid() || typeof rawTime === 'number'}`);

            const programDate = moment(formattedDate, 'DMMMYYYY', true); // Use the formatted date for comparison
            const programTimeMoment = moment(formattedTime, 'h:mm A', true); // Use the formatted time for comparison

            console.log('Program Date (for comparison):', programDate.isValid() ? programDate.format() : 'Invalid Date');
            console.log('Program Time (for comparison):', programTimeMoment.isValid() ? programTimeMoment.format('h:mm A') : 'Invalid Time');

            if (!programDate.isValid() || !programTimeMoment.isValid()) {
                console.warn(`⚠️ Could not parse date or time: Date="${rawDate}", Time="${rawTime}", Event="${program.Event}"`);
                continue;
            }

            const eventDateTime = programDate.clone().set({
                hour: programTimeMoment.hour(),
                minute: programTimeMoment.minute(),
                second: 0,
                millisecond: 0
            });

            console.log('Parsed Event DateTime:', eventDateTime.format());

            const diffHours = moment.duration(eventDateTime.diff(now)).asHours();
            const diffDays = eventDateTime.clone().startOf('day').diff(now.clone().startOf('day'), 'days');

            console.log('diffDays:', diffDays);
            console.log('diffHours:', diffHours);

            const is1005AM = now.hour() === 19 && now.minute() === 54; // Check for 10:05 AM
            const is600PM = now.hour() === 18 && now.minute() === 01; // Check for 6:00 PM
            const is1505PM = now.hour() === 19 && now.minute() === 55;

            if (is1005AM && (diffDays === 0)) {
                const dailyCaption = `✨🔔 Om Namo Venkateseya!🌸🪔🌼 Upcoming Event Today/in 3 Days at Our 🌺🌷🛕 HC Sri Venkateswara Swamy Temple:🙏🛕✨🌺🌷🛕🌺🌷🛕 *${program.Event}* 🙏🛕✨🌺🌷🛕🌺🌷🛕🌺🌷🛕
                🗓️ ${moment(programDate).format('DD MMM')} (${program.Day}) | 🕒 ${program.Time}
                📝 ${program.Notes}
                🌟🙏 Come and seek the divine blessings of Lord Srinivasa!🛕🪔🛕 🌸🛕🪔`;
                await sendToAllUsers(sock, users, dailyCaption, imageBuffer);
                console.log(`📩 Sent daily scheduled message for "${program.Event}" (${diffDays === 0 ? 'Today' : 'in 3 days'})`);
            }
             if (is1505PM && (diffDays === 20 || diffDays === 7 || diffDays === 3 || diffDays === 0)) {
                const dailyCaption = `🛕🔔Om Namo Venkateseya!\n Upcoming Event at Our HC Sri Venkateswara Swamy Temple:\n 🌷 *${program.Event}* 🌷
🗓️ ${moment(programDate).format('DD MMM')} (${program.Day}) | 🕒 ${program.Time}
📝 ${program.Notes}\n
🌟🙏 Come and seek the divine blessings of Lord Srinivasa!🛕`;
                await sendToAllUsers(sock, users, dailyCaption, imageBuffer);
                console.log(`📩 Sent daily scheduled message for "${program.Event}" (${diffDays === 0 ? 'Today' : 'in 3 days'})`);
            }

            if (diffHours <= 3 && diffHours === 0 && diffDays === 0) {
                const hourlyCaption = `🔔 Reminder: *${program.Event}* at HC Sri Venkateswara Swamy Temple in *${Math.round(diffHours)} hours*! 🙏
🗓️ ${moment(programDate).format('DD MMM')} (${program.Day}) | 🕒 ${program.Time}
📍 Don't miss it!`;
                await sendToAllUsers(sock, users, hourlyCaption, imageBuffer);
                console.log(`⏰ Sent hourly reminder for "${program.Event}" (${Math.round(diffHours)} hours before})`);
            }

        } catch (error) {
            console.error(`❌ Error sending scheduled notification for "${program.Event}":`, error);
        }
    }
}

async function sendToAllUsers(sock, users, message, imageBuffer) {
    for (let user of users) {
        try {
            await sock.sendMessage(user.number, {
                image: imageBuffer,
                caption: message
            });
        } catch (error) {
            console.error(`⚠️ Error sending message to ${user.number}:`, error);
        }
    }
}

startBot();

http.createServer((_, res) => res.end('🛕 SriVaariBot is running')).listen(process.env.PORT || 3000);
