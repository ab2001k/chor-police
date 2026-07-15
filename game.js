// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyBWT6w0EsRYm_Cd2P6JmeQlQjZpNK07V0Y",
    authDomain: "chorpolicegame-8c330.firebaseapp.com",
    databaseURL: "https://chorpolicegame-8c330-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chorpolicegame-8c330",
    storageBucket: "chorpolicegame-8c330.firebasestorage.app",
    messagingSenderId: "70710319190",
    appId: "1:70710319190:web:ef3d024730bacf241543f7"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// --- Core Variables ---
let playerName = localStorage.getItem('cp_playerName') || "";
let playerId = localStorage.getItem('cp_playerId') || "user_" + Math.random().toString(36).substr(2, 9);
let playerPhoto = localStorage.getItem('cp_photo') || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + playerId;
localStorage.setItem('cp_playerId', playerId);

const defaultDescs = ["Sneaky Thief 🥷", "Master Detective 🕵️", "Always Daroga 👮", "Just chilling 😎", "Smooth Criminal 💼"];
let playerDesc = localStorage.getItem('cp_desc') || defaultDescs[Math.floor(Math.random() * defaultDescs.length)];
localStorage.setItem('cp_desc', playerDesc);

let roomCode = ""; let roomMaxPlayers = 4; let isHost = false; let myRole = null;
let playersData = {}; let currentRound = 1; let soundEnabled = true; let dialogueRevealed = false;
let gameMaxRounds = 20; let gameStatus = 'lobby'; let lastVoteCount = 0;
let botTimeouts = {}; let botDialogueTimeouts = {}; let currentLastGuess = null; let bgmInterval = null;

// New SVG Score Icon
const scoreSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

const roleEmojis = { OC: "👨‍⚖️", Daroga: "👮", Police: "🕵️", Chor: "🏃", DC: "🏛️", Army: "🪖", Businessman: "💼", Hacker: "💻" };
const roles4 = [{name:"OC",pts:2000},{name:"Daroga",pts:1200},{name:"Police",pts:500},{name:"Chor",pts:0}];
const roles6 = [{name:"DC",pts:2500},{name:"OC",pts:2000},{name:"Army",pts:1500},{name:"Daroga",pts:1200},{name:"Police",pts:500},{name:"Chor",pts:0}];
const roles8 = [
    {name:"DC",pts:2500},{name:"OC",pts:2000},{name:"Army",pts:1500},{name:"Daroga",pts:1200},
    {name:"Businessman",pts:1000},{name:"Hacker",pts:800},{name:"Police",pts:500},{name:"Chor",pts:0}
];

// --- Sound System & Ambient BGM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
document.body.addEventListener('click', () => { 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    toggleBGM();
}, { once: true });

function toggleBGM() {
    if (soundEnabled && !bgmInterval) {
        let notes = [261.63, 329.63, 392.00, 523.25];
        let i = 0;
        bgmInterval = setInterval(() => {
            if(!soundEnabled || audioCtx.state === 'suspended') return;
            let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.value = notes[i] / 2; 
            gain.gain.setValueAtTime(0.005, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 2);
            i = (i+1)%notes.length;
        }, 2500);
    } else if (!soundEnabled && bgmInterval) {
        clearInterval(bgmInterval); bgmInterval = null;
    }
}

function playSound(type) {
    if(!soundEnabled) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    let now = audioCtx.currentTime;
    
    if(type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'flip') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'whistle') { 
        osc.type = 'sine'; osc.frequency.setValueAtTime(1500, now); osc.frequency.linearRampToValueAtTime(2500, now + 0.2); osc.frequency.linearRampToValueAtTime(2000, now + 0.4); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'win') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'error') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'alert') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(900, now); osc.frequency.setValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'sad') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.8); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.8); osc.start(now); osc.stop(now + 0.8);
    }
}
document.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' || e.target.classList.contains('emoji-btn') || e.target.tagName === 'SPAN') playSound('click'); });
document.getElementById('sound-toggle').onclick = function() { soundEnabled = !soundEnabled; this.innerText = soundEnabled ? "🔊 ON" : "🔇 OFF"; toggleBGM(); };

window.toggleCustomRound = function() {
    const select = document.getElementById('round-count'); const customInput = document.getElementById('custom-round-input');
    customInput.style.display = select.value === 'custom' ? 'block' : 'none';
}

// --- Central Name Update Handler ---
function applyNameChange(newName) {
    if (newName) {
        playerName = newName; 
        localStorage.setItem('cp_playerName', playerName);
        if (roomCode && playersData[playerId]) {
            db.ref(`rooms/${roomCode}/players/${playerId}/name`).set(playerName);
        }
        document.getElementById('profile-name').innerText = playerName;
        document.getElementById('profile-name-input').value = playerName;
        alert("Name updated successfully!");
    }
}

// Bind to the Profile menu rename button ONLY
document.getElementById('profile-rename-btn').onclick = () => applyNameChange(document.getElementById('profile-name-input').value.trim());

// --- Auth & Profile Management ---
if (playerName) {
    document.getElementById('lobby-screen').classList.add('active');
    document.getElementById('profile-name-input').value = playerName;
} else {
    document.getElementById('auth-overlay').classList.add('active');
}

auth.onAuthStateChanged(user => {
    if (user) {
        playerId = user.uid; playerName = user.displayName || "Player";
        if (user.photoURL && !localStorage.getItem('cp_photo')) {
            playerPhoto = user.photoURL;
            localStorage.setItem('cp_photo', playerPhoto);
        }
        db.ref(`users/${playerId}/profile`).update({ name: playerName, photo: playerPhoto });
        if(document.getElementById('auth-overlay').classList.contains('active')) finishAuth();
    } 
});

document.getElementById('google-login-btn').onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert("Login Failed."));
document.getElementById('guest-login-btn').onclick = () => {
    const guestInput = document.getElementById('guest-name-input').value.trim();
    playerName = guestInput || "Guest_" + Math.floor(Math.random()*1000);
    localStorage.setItem('cp_playerName', playerName); finishAuth();
};
document.getElementById('logout-btn').onclick = () => auth.signOut().then(() => { localStorage.clear(); window.location.reload(); });

function finishAuth() {
    document.getElementById('auth-overlay').classList.remove('active');
    document.getElementById('lobby-screen').classList.add('active');
    document.getElementById('profile-name-input').value = playerName;
}

// Avatar Updater
document.getElementById('random-avatar-btn').onclick = () => {
    playerPhoto = "https://api.dicebear.com/7.x/avataaars/svg?seed=" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('cp_photo', playerPhoto);
    document.getElementById('profile-pic').src = playerPhoto;
    if (roomCode && playersData[playerId]) db.ref(`rooms/${roomCode}/players/${playerId}`).update({ photo: playerPhoto });
    playSound('click');
};

document.getElementById('lobby-share-btn').onclick = () => { 
    const link = window.location.origin + window.location.pathname;
    const msg = `Play Chor Police Multiplayer with me! 🔥 Join here: ${link}`;
    if (navigator.share) navigator.share({ title: 'Chor Police', text: msg });
    else { navigator.clipboard.writeText(msg); alert("Message & Link copied! Paste it in WhatsApp."); }
};

document.getElementById('copy-link-btn').onclick = () => { 
    const link = window.location.origin + window.location.pathname + "?room=" + roomCode;
    const msg = `Join my Chor Police room! Code: ${roomCode} 🔥 Link: ${link}`;
    if (navigator.share) navigator.share({ title: 'Chor Police', text: msg });
    else { navigator.clipboard.writeText(msg); alert("Game Link copied! Send it to your friends."); }
};

window.copyJustCode = function() {
    navigator.clipboard.writeText(roomCode); alert("Room Code " + roomCode + " copied!");
}

document.getElementById('profile-btn').onclick = () => {
    document.getElementById('profile-name-input').value = playerName;
    document.getElementById('profile-name').innerText = playerName;
    document.getElementById('profile-desc').innerText = `"${playerDesc}"`;
    document.getElementById('profile-pic').src = playerPhoto;
    document.getElementById('profile-pic').style.display = "block";
    db.ref(`users/${playerId}/stats`).once('value', snap => {
        const stats = snap.val() || { wins: 0, lifetimeScore: 0 };
        document.getElementById('stat-wins').innerText = stats.wins; document.getElementById('stat-score').innerText = stats.lifetimeScore;
    });
    document.getElementById('profile-overlay').classList.add('active');
};

document.getElementById('edit-desc-btn').onclick = () => {
    let newDesc = prompt("Enter your profile description:", playerDesc);
    if(newDesc && newDesc.trim()) { playerDesc = newDesc.trim(); localStorage.setItem('cp_desc', playerDesc); document.getElementById('profile-desc').innerText = `"${playerDesc}"`; }
};

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) document.getElementById('room-code-input').value = urlParams.get('room').toUpperCase();

// --- Create / Join / Bots ---
document.getElementById('create-btn').onclick = () => {
    if (!playerName) {
        alert("Please set your name in your Profile first!");
        document.getElementById('profile-overlay').classList.add('active');
        return;
    }
    roomMaxPlayers = parseInt(document.getElementById('player-count').value);
    let rCountVal = document.getElementById('round-count').value;
    gameMaxRounds = rCountVal === 'custom' ? (parseInt(document.getElementById('custom-round-input').value) || 20) : parseInt(rCountVal);
    
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.ref(`rooms/${roomCode}/info`).set({ maxPlayers: roomMaxPlayers, maxRounds: gameMaxRounds, hostId: playerId });
    db.ref(`rooms/${roomCode}/gameState`).set({ round: 1, status: 'lobby' });
    db.ref(`rooms/${roomCode}/players/${playerId}`).set({ name: playerName, score: 0, photo: playerPhoto, status: 'online' });
    enterGameScreen();
};

window.addBot = function() {
    if (!isHost) return;
    const currentPlayersCount = Object.keys(playersData).length;
    if (currentPlayersCount >= roomMaxPlayers) return alert("Room is full!");

    const botNames = ["Alpha", "Beta", "Gamma", "Delta", "Echo", "Zeta", "Omega"];
    const bName = "Bot " + botNames[Math.floor(Math.random() * botNames.length)] + " " + Math.floor(Math.random() * 100);
    const bId = "bot_" + Math.random().toString(36).substr(2, 9);
    const bPhoto = "https://api.dicebear.com/7.x/bottts/svg?seed=" + bId;

    db.ref(`rooms/${roomCode}/players/${bId}`).set({ name: bName, score: 0, photo: bPhoto, status: 'online', isBot: true });
};

document.getElementById('join-btn').onclick = () => {
    if (!playerName) {
        alert("Please set your name in your Profile first!");
        document.getElementById('profile-overlay').classList.add('active');
        return;
    }
    const codeInput = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (codeInput.length !== 6) return alert("Enter a valid 6-digit code.");
    
    db.ref(`rooms/${codeInput}`).once('value', snap => {
        if (!snap.exists()) return alert("Room not found!");
        const rData = snap.val();
        roomCode = codeInput; roomMaxPlayers = rData.info.maxPlayers; gameMaxRounds = rData.info.maxRounds || 20;
        const currPlayers = rData.players ? Object.keys(rData.players).length : 0;
        
        if (currPlayers < roomMaxPlayers || (rData.players && rData.players[playerId])) {
            if (rData.info.hostId === playerId || (rData.players && rData.players[playerId])) {
                db.ref(`rooms/${roomCode}/players/${playerId}`).update({ status: 'online', name: playerName, photo: playerPhoto });
                enterGameScreen();
            } else {
                db.ref(`rooms/${roomCode}/requests/${playerId}`).set({ name: playerName, uid: playerId, photo: playerPhoto });
                document.getElementById('waiting-overlay').classList.add('active');
                db.ref(`rooms/${roomCode}/players/${playerId}`).on('value', pSnap => {
                    if (pSnap.exists()) {
                        document.getElementById('waiting-overlay').classList.remove('active');
                        db.ref(`rooms/${roomCode}/players/${playerId}`).off(); 
                        enterGameScreen();
                    }
                });
            }
        } else alert("Room is full!");
    });
};

function cancelJoinRequest() { db.ref(`rooms/${roomCode}/requests/${playerId}`).remove(); document.getElementById('waiting-overlay').classList.remove('active'); }

function enterGameScreen() {
    document.getElementById('lobby-screen').classList.remove('active'); document.getElementById('game-screen').classList.add('active');
    document.getElementById('display-room-code').innerText = roomCode;
    
    const table = document.getElementById('card-table');
    table.classList.remove('six-players', 'eight-players');
    if(roomMaxPlayers === 6) table.classList.add('six-players');
    if(roomMaxPlayers === 8) table.classList.add('eight-players');
    
    window.history.replaceState(null, '', `?room=${roomCode}`);
    document.getElementById('chat-messages').innerHTML = ""; 
    
    const voteBtn = document.getElementById('vote-end-btn');
    voteBtn.disabled = false; voteBtn.style.background = ''; voteBtn.innerText = 'Vote End';
    
    const myStatusRef = db.ref(`rooms/${roomCode}/players/${playerId}/status`);
    db.ref('.info/connected').on('value', function(snap) { if (snap.val() === true) { myStatusRef.onDisconnect().set('offline'); myStatusRef.set('online'); } });
    db.ref(`rooms/${roomCode}/endVotes/${playerId}`).onDisconnect().remove();
    
    listenToRoomData(); setupChatListener();
}

// --- Interactive Smart Bot Chat Logic ---
function triggerBotChat(event, contextData = {}) {
    if (!isHost) return;
    let bots = Object.keys(playersData).filter(id => playersData[id].isBot);
    bots.forEach(bId => {
        if (Math.random() < 0.35) { // 35% chance to participate per event
            setTimeout(() => {
                let msg = getBotPhrase(event, bId, contextData);
                if (msg) db.ref(`rooms/${roomCode}/chat`).push({ sender: playersData[bId].name, text: msg, senderId: bId });
            }, Math.random() * 2500 + 1000);
        }
    });
}

function getBotPhrase(event, botId, data) {
    const phrases = {
        'start': ["Let's do this! 💪", "I hope I get King.", "Who wants to be Chor? 😂", "GLHF", "Ready!"],
        'waiting_daroga': ["Daroga, hurry up! 👮", "Who has the whistle?", "Blow the whistle Daroga!"],
        'waiting_police': ["Where is the Police? 🕵️", "Police is sleeping 💤", "Come on Police..."],
    };
    
    if (event === 'guess_reaction') {
        if (data.suspect === botId) {
            return data.correct ? "Ok, you got me 😭" : "Are you blind? I'm not the Chor! 😡";
        } else {
            return data.correct ? "Nice catch Police! 🎉" : "Police needs glasses 😂";
        }
    }
    
    if (phrases[event]) return phrases[event][Math.floor(Math.random() * phrases[event].length)];
    return null;
}


// --- Room Data Listening ---
function listenToRoomData() {
    db.ref(`rooms/${roomCode}/info/hostId`).on('value', snap => {
        isHost = (snap.val() === playerId);
        if(isHost) monitorJoinRequests(); 
        updateButtonsVisibility();
    });

    db.ref(`rooms/${roomCode}/gameState/status`).on('value', snap => {
        if(snap.val()) { 
            gameStatus = snap.val(); 
            checkPauseState(); 
            updateButtonsVisibility();
            
            if (gameStatus === 'ended') {
                document.getElementById('end-game-overlay').classList.add('active');
            } else {
                document.getElementById('end-game-overlay').classList.remove('active');
            }
        }
    });

    db.ref(`rooms/${roomCode}/players`).on('value', snap => {
        playersData = snap.val() || {};
        const playerIds = Object.keys(playersData);
        document.getElementById('display-max-players').innerText = `${playerIds.length}/${roomMaxPlayers}`;
        
        updateButtonsVisibility();

        db.ref(`rooms/${roomCode}/info/hostId`).once('value', hSnap => {
            let humanIds = playerIds.filter(id => !playersData[id].isBot);
            if (humanIds.length > 0 && !humanIds.includes(hSnap.val()) && humanIds[0] === playerId) {
                db.ref(`rooms/${roomCode}/info/hostId`).set(playerId);
            }
        });

        const list = document.getElementById('player-list'); list.innerHTML = ""; 
        
        // Sort live scoreboard by score
        let sortedLive = playerIds.map(id => ({id, ...playersData[id]})).sort((a,b)=>(b.score||0)-(a.score||0));
        
        sortedLive.forEach(p => {
            let photo = p.photo || "https://api.dicebear.com/7.x/avataaars/svg?seed="+p.id;
            let dotClass = p.status === 'online' ? 'status-online' : 'status-offline';
            let kickBtn = (isHost && p.id !== playerId) ? `<button class="danger" style="padding:4px 8px; font-size:0.7rem; margin-left:8px; border-radius:6px;" onclick="kickPlayer('${p.id}')">Kick</button>` : "";
            let botBadge = p.isBot ? " <span style='font-size:0.8rem;'>🤖</span>" : "";
            let isMeClass = p.id === playerId ? "is-me" : "";
            
            list.innerHTML += `<li class="player-row ${isMeClass}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${photo}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid #ccc;">
                    <span><span class="status-dot ${dotClass}"></span> ${p.name}${botBadge} ${p.id===playerId ? "<strong>(You)</strong>" : ""}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span class="score-pill">${scoreSvg} ${p.score || 0}</span> 
                    ${kickBtn}
                </div>
            </li>`;
        });

        checkPauseState(); 
        db.ref(`rooms/${roomCode}/cards`).once('value', cSnap => { if(cSnap.val()) checkBotsNeedCards(cSnap.val()); });

        // Safe Game Starter
        if (playerIds.length === roomMaxPlayers && isHost && gameStatus === 'lobby') {
            hostDealsCards();
        }
    });

    db.ref(`rooms/${roomCode}/gameState/round`).on('value', snap => { if (snap.val()) currentRound = snap.val(); });
    db.ref(`rooms/${roomCode}/dialogue`).on('value', snap => { if (snap.val()) document.getElementById('dialogue-box').innerHTML = snap.val(); });
    db.ref(`rooms/${roomCode}/convPhase`).on('value', snap => handleConversationPhase(snap.val()));
    
    db.ref(`rooms/${roomCode}/cards`).on('value', snap => { 
        if (snap.val()) {
            renderCards(snap.val());
            checkBotsNeedCards(snap.val()); 
        }
    });

    db.ref(`rooms/${roomCode}/lastGuess`).on('value', snap => {
        currentLastGuess = snap.val();
        if (currentLastGuess) {
            applyLastGuessVisuals();
            
            // Allow bots to react contextually
            triggerBotChat('guess_reaction', currentLastGuess);

            if (isHost) {
                setTimeout(() => {
                    if (gameStatus !== 'playing') return;
                    if (currentRound >= gameMaxRounds) triggerEndGame();
                    else {
                        db.ref(`rooms/${roomCode}/gameState/round`).set(currentRound + 1);
                        db.ref(`rooms/${roomCode}/cards`).remove(); 
                        db.ref(`rooms/${roomCode}/lastGuess`).remove(); 
                        setTimeout(hostDealsCards, 1500); 
                    }
                }, 6000); // 6 second transition delay so players see exactly what happened
            }
            if (currentLastGuess.guesserId === playerId) myRole = null; 
        }
    });

    db.ref(`rooms/${roomCode}/endVotes`).on('value', snap => {
        const votes = snap.val() || {}; const voteCount = Object.keys(votes).length;
        let humanCount = Object.keys(playersData).filter(id => !playersData[id].isBot).length;
        const display = document.getElementById('vote-count-display');
        
        if (voteCount > 0) {
            if(voteCount > lastVoteCount) playSound('alert'); 
            lastVoteCount = voteCount;
            display.style.display = "block"; display.innerText = `Ending Votes: ${voteCount}/${humanCount}`;
            if (voteCount >= humanCount && isHost) triggerEndGame();
        } else { display.style.display = "none"; lastVoteCount = 0; }
    });
}

function updateButtonsVisibility() {
    let pCount = Object.keys(playersData).length;
    let isNotFull = pCount < roomMaxPlayers;
    document.getElementById('add-bot-btn').style.display = (isHost && isNotFull && (gameStatus === 'lobby' || gameStatus === 'playing')) ? 'inline-block' : 'none';
}

window.applyLastGuessVisuals = function() {
    if(!currentLastGuess) return;
    const allCardEls = document.querySelectorAll('.card');
    allCardEls.forEach(cardEl => {
        if(cardEl.getAttribute('data-owner') === currentLastGuess.suspect) {
            cardEl.classList.add(currentLastGuess.correct ? 'guess-correct' : 'guess-wrong');
        }
    });

    if (currentLastGuess.correct) {
        if (playerId === currentLastGuess.chorId) playSound('sad'); else playSound('win'); 
    } else {
        if (playerId === currentLastGuess.guesserId) playSound('sad'); 
        else if (playerId === currentLastGuess.chorId) playSound('win'); 
        else playSound('error'); 
    }

    if (currentLastGuess.chorId) {
        let chorCard = document.querySelector(`.card[data-owner="${currentLastGuess.chorId}"]`);
        if (chorCard && !chorCard.querySelector('.react-emoji')) {
            let floatEmoji = document.createElement('div');
            floatEmoji.className = 'floating-emoji react-emoji';
            floatEmoji.innerText = currentLastGuess.correct ? "😭" : "😂";
            chorCard.appendChild(floatEmoji);
        }
    }
}

function checkPauseState() {
    let activeCount = Object.keys(playersData).filter(id => playersData[id].status === 'online').length;
    const pauseBanner = document.getElementById('pause-banner');
    if(gameStatus === 'playing' && activeCount < roomMaxPlayers) {
        pauseBanner.style.display = "block";
        let hasOffline = Object.keys(playersData).some(id => playersData[id].status === 'offline');
        document.getElementById('kick-offline-btn').style.display = (isHost && hasOffline) ? 'inline-block' : 'none';
    } else {
        pauseBanner.style.display = "none";
        document.getElementById('kick-offline-btn').style.display = 'none';
    }
}

window.kickOfflinePlayers = function() {
    if(confirm("Kick all offline players?")) {
        Object.keys(playersData).forEach(id => {
            if (playersData[id].status === 'offline') db.ref(`rooms/${roomCode}/players/${id}`).remove();
        });
    }
};
window.kickPlayer = function(uid) { if(confirm("Kick this player?")) db.ref(`rooms/${roomCode}/players/${uid}`).remove(); };

function monitorJoinRequests() {
    const reqDiv = document.getElementById('host-requests'); const reqList = document.getElementById('request-list');
    db.ref(`rooms/${roomCode}/requests`).on('value', snap => {
        const reqs = snap.val() || {}; reqList.innerHTML = "";
        if(Object.keys(reqs).length > 0) {
            reqDiv.style.display = "block";
            Object.values(reqs).forEach(req => {
                reqList.innerHTML += `<div class="request-item" style="display:flex; justify-content:space-between; align-items:center; background:white; padding:8px; border-radius:12px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${req.photo}" style="width:30px; height:30px; border-radius:50%;">
                        <strong>${req.name}</strong>
                    </div> 
                    <div style="display:flex; gap:5px;">
                        <button onclick="approvePlayer('${req.uid}', '${req.name}', '${req.photo}')" style="background:#10B981; padding:6px 12px; font-size:0.8rem;">Accept</button> 
                        <button onclick="rejectPlayer('${req.uid}')" class="danger" style="padding:6px 12px; font-size:0.8rem;">Reject</button>
                    </div>
                </div>`;
            });
        } else reqDiv.style.display = "none";
    });
}

window.approvePlayer = function(uid, name, photo) {
    db.ref(`rooms/${roomCode}/players`).once('value', snap => {
        if ((snap.val() ? Object.keys(snap.val()).length : 0) >= roomMaxPlayers) return alert("Room is full!");
        db.ref(`rooms/${roomCode}/players/${uid}`).set({ name: name, score: 0, photo: photo, status: 'online' });
        db.ref(`rooms/${roomCode}/requests/${uid}`).remove();
    });
};
window.rejectPlayer = function(uid) { db.ref(`rooms/${roomCode}/requests/${uid}`).remove(); };

function clearBotTimeouts() {
    Object.values(botTimeouts).forEach(clearTimeout); botTimeouts = {};
    Object.values(botDialogueTimeouts).forEach(clearTimeout); botDialogueTimeouts = {};
}

// --- Core Gameplay ---
function hostDealsCards() {
    if (gameStatus === 'playing') return; // Anti-double deal safeguard
    
    dialogueRevealed = false; 
    clearBotTimeouts();
    
    // Choose active roles based on max players setup in room logic
    const activeRoles = roomMaxPlayers === 8 ? roles8 : (roomMaxPlayers === 6 ? roles6 : roles4);
    const shuffled = [...activeRoles].sort(() => Math.random() - 0.5);
    const cardData = {};
    for(let i=0; i<roomMaxPlayers; i++) cardData[i] = { role: shuffled[i].name, points: shuffled[i].pts, owner: null };
    
    // Completely clear states before setting up the new round
    db.ref(`rooms/${roomCode}/lastGuess`).remove();
    db.ref(`rooms/${roomCode}/convPhase`).remove(); 
    
    db.ref(`rooms/${roomCode}/cards`).set(cardData);
    db.ref(`rooms/${roomCode}/gameState`).update({ status: 'playing' });
    db.ref(`rooms/${roomCode}/dialogue`).set(`<strong>Round ${currentRound}/${gameMaxRounds}</strong><br/>Cards dealt! Pick one quickly.`);

    triggerBotChat('start');
}

function checkBotsNeedCards(cardsData) {
    if (!isHost || gameStatus !== 'playing') return;
    let bots = Object.keys(playersData).filter(id => playersData[id].isBot);
    let botsWithoutCards = bots.filter(bId => !Object.values(cardsData).some(c => c.owner === bId));
    let avail = Object.keys(cardsData).filter(k => !cardsData[k].owner);

    if (botsWithoutCards.length > 0 && avail.length > 0) {
        let bId = botsWithoutCards[0]; 
        if (!botTimeouts[bId]) {
            botTimeouts[bId] = setTimeout(() => {
                db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
                    let cData = snap.val(); if(!cData) return;
                    let currentAvail = Object.keys(cData).filter(k => !cData[k].owner);
                    if(currentAvail.length > 0 && !Object.values(cData).some(c => c.owner === bId)) {
                        let rKey = currentAvail[Math.floor(Math.random() * currentAvail.length)];
                        db.ref(`rooms/${roomCode}/cards/${rKey}`).update({ owner: bId });
                        playSound('flip');
                    }
                    delete botTimeouts[bId];
                });
            }, Math.floor(Math.random() * 2000) + 1500); 
        }
    }
}

function renderCards(cards) {
    const table = document.getElementById('card-table'); table.innerHTML = "";
    let claimedCount = 0; let iClaimed = false;
    let isNewRound = (Object.values(cards).filter(c => c.owner).length === 0);

    Object.values(cards).forEach(c => { if (c.owner === playerId) iClaimed = true; });

    Object.keys(cards).forEach((key, index) => {
        const cardObj = cards[key];
        const cardEl = document.createElement('div'); 
        cardEl.className = 'card';
        cardEl.setAttribute('data-owner', cardObj.owner || ""); 
        
        if (isNewRound) {
            cardEl.classList.add('deal-anim');
            cardEl.style.animationDelay = `${index * 0.1}s`;
        }

        if (cardObj.owner) {
            claimedCount++; cardEl.classList.add('flipped');
            if (cardObj.owner === playerId) cardEl.classList.add('my-card');

            const ownerData = playersData[cardObj.owner];
            const ownerName = ownerData ? ownerData.name : "Player";
            const photoSrc = ownerData && ownerData.photo ? ownerData.photo : "https://api.dicebear.com/7.x/avataaars/svg?seed="+cardObj.owner;
            
            let roleStr = `${roleEmojis[cardObj.role] || ""} ${cardObj.role}`;
            let showRole = (cardObj.owner === playerId) || (dialogueRevealed && (cardObj.role === "Daroga" || cardObj.role === "Police"));

            if (showRole) {
                if (cardObj.owner === playerId) myRole = cardObj.role;
                cardEl.innerHTML = `<div class="card-inner-text">
                    <img src="${photoSrc}" class="card-avatar" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${cardObj.owner}'">
                    <span style="font-size:0.9rem; color:var(--text-main); font-weight:700;">${roleStr}</span>
                    <span style="color:var(--primary); font-size: 0.8rem; font-weight:600;">${cardObj.points} pts</span>
                </div>`;
            } else {
                cardEl.innerHTML = `<div class="card-inner-text">
                    <img src="${photoSrc}" class="card-avatar" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${cardObj.owner}'">
                    <span style="font-size:0.85rem; color:var(--text-light); font-weight:500;">${ownerName}</span>
                </div>`;
            }
        } else {
            cardEl.innerText = "Select";
            cardEl.onclick = () => { if (!iClaimed) { playSound('flip'); db.ref(`rooms/${roomCode}/cards/${key}`).update({ owner: playerId }); } };
        }
        table.appendChild(cardEl);
    });

    if(currentLastGuess) setTimeout(applyLastGuessVisuals, 50);

    if (claimedCount === roomMaxPlayers && isHost) {
        db.ref(`rooms/${roomCode}/convPhase`).once('value', snap => {
            if(!snap.exists() && !dialogueRevealed) { 
                db.ref(`rooms/${roomCode}/convPhase`).set('daroga_call');
            }
        });
    }
}

// --- INTERACTIVE CONVERSATION SYSTEM & BOTS ---
function handleConversationPhase(phase) {
    const guessSec = document.getElementById('guess-section');
    if (!phase || phase === 'ended') { 
        clearBotTimeouts();
        guessSec.style.display = "none"; 
        return; 
    } 
    
    guessSec.style.display = "block";

    if (isHost) {
        clearBotTimeouts(); 
        db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
            const cards = Object.values(snap.val() || {});
            const dId = cards.find(c => c.role === 'Daroga')?.owner; const pId = cards.find(c => c.role === 'Police')?.owner;
            const dBot = dId && playersData[dId]?.isBot; const pBot = pId && playersData[pId]?.isBot;

            if (phase === 'daroga_call' && dBot) {
                botDialogueTimeouts['dc'] = setTimeout(() => advanceConv('police_reply', `<strong>👮 ${playersData[dId].name}:</strong> Police, police koun hai?`, null, false, true), 3000);
            } else if (phase === 'police_reply' && pBot) {
                botDialogueTimeouts['pr'] = setTimeout(() => advanceConv('daroga_order', `<strong>🕵️ ${playersData[pId].name}:</strong> Hum hai!`, null, true, false), 3000);
            } else if (phase === 'daroga_order' && dBot) {
                botDialogueTimeouts['do'] = setTimeout(() => advanceConv('guess_time', `<strong>👮 ${playersData[dId].name}:</strong> Chor ko pakdo!`, null, true, false), 2000);
            } else if (phase === 'guess_time' && pBot) {
                botDialogueTimeouts['gt'] = setTimeout(() => {
                    let suspects = Object.keys(playersData).filter(id => id !== pId && id !== dId && playersData[id].status === 'online');
                    let randomSuspect = suspects[Math.floor(Math.random() * suspects.length)];
                    if(randomSuspect) makeGuess(randomSuspect, pId);
                }, 4000);
            }
        });
    }

    if (phase === 'daroga_call') {
        if (myRole === "Daroga") {
            guessSec.innerHTML = `<h3 style="color:var(--accent); margin:0 0 10px 0;">You are Daroga 👮!</h3><button class="attention-btn" onclick="advanceConv('police_reply', '<strong>👮 ${playerName}:</strong> Police, police koun hai?', this, false, true)">Blow Whistle & Call Out Police</button>`;
        } else guessSec.innerHTML = `<p style="margin:0;">Waiting for Daroga to blow the whistle...</p>`;
    } 
    else if (phase === 'police_reply') {
        dialogueRevealed = true; db.ref(`rooms/${roomCode}/cards`).once('value', s=>renderCards(s.val()));
        if (myRole === "Police") {
            guessSec.innerHTML = `<h3 style="color:var(--primary); margin:0 0 10px 0;">You are Police 🕵️!</h3><button class="attention-btn" onclick="advanceConv('daroga_order', '<strong>🕵️ ${playerName}:</strong> Hum hai!', this, true, false)">Reply: "Hum hai!"</button>`;
        } else guessSec.innerHTML = `<p style="margin:0;">Waiting for Police to reply...</p>`;
    } 
    else if (phase === 'daroga_order') {
        dialogueRevealed = true; db.ref(`rooms/${roomCode}/cards`).once('value', s=>renderCards(s.val()));
        if (myRole === "Daroga") {
            guessSec.innerHTML = `<button class="attention-btn danger" onclick="advanceConv('guess_time', '<strong>👮 ${playerName}:</strong> Chor ko pakdo!', this, true, false)">Order Catch!</button>`;
        } else guessSec.innerHTML = `<p style="margin:0;">Waiting for Daroga's order...</p>`;
    }
    else if (phase === 'guess_time') {
        if (myRole === "Police") activatePoliceGuessing();
        else guessSec.innerHTML = `<p style="margin:0;">Police 🕵️ is deciding who the Chor is...</p>`;
    }
}

window.advanceConv = function(nextPhase, dialogueText, btnEl, playClick=false, playWhist=false) {
    if(btnEl) btnEl.disabled = true;
    if(playWhist) playSound('whistle');
    db.ref(`rooms/${roomCode}/dialogue`).set(dialogueText);
    db.ref(`rooms/${roomCode}/convPhase`).set(nextPhase);
};

function activatePoliceGuessing() {
    const guessSec = document.getElementById('guess-section');
    guessSec.innerHTML = "<h3 style='margin:0 0 10px 0; color:var(--accent)'>Who is Chor 🏃?</h3><p style='font-size:0.8rem; margin:0 0 10px 0;'>Tap a Card or Name below</p>";
    
    db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
        const cards = Object.values(snap.val());
        const allCardEls = document.querySelectorAll('.card');
        
        Object.keys(playersData).forEach(id => {
            const isDaroga = cards.some(c => c.owner === id && c.role === "Daroga");
            if (id !== playerId && !isDaroga) {
                
                allCardEls.forEach(cardEl => {
                    if(cardEl.getAttribute('data-owner') === id) {
                        cardEl.classList.add('suspect-glow'); cardEl.onclick = () => makeGuess(id, playerId);
                    }
                });

                const pPhoto = playersData[id].photo || "https://api.dicebear.com/7.x/avataaars/svg?seed="+id;
                const btn = document.createElement('button');
                btn.className = "guess-btn"; 
                btn.innerHTML = `<img src="${pPhoto}" style="width:24px; height:24px; border-radius:50%; vertical-align:middle; margin-right:8px; object-fit:cover;"> ${playersData[id].name}`;
                btn.onclick = () => makeGuess(id, playerId);
                guessSec.appendChild(btn);
            }
        });
    });
}

function makeGuess(suspectId, guesserId) {
    const isBotGuess = playersData[guesserId].isBot;
    const canUpdateState = (guesserId === playerId) || (isHost && isBotGuess);

    document.getElementById('guess-section').style.display = "none";
    document.querySelectorAll('.suspect-glow').forEach(el => { el.classList.remove('suspect-glow'); el.onclick = null; });
    
    if(canUpdateState) {
        db.ref(`rooms/${roomCode}/convPhase`).set('ended'); 
        
        db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
            const cards = Object.values(snap.val());
            let suspectRole = cards.find(c => c.owner === suspectId)?.role;
            let chorId = cards.find(c => c.role === "Chor")?.owner;

            const guesserName = playersData[guesserId].name;
            const suspectName = playersData[suspectId].name;

            if (suspectRole === "Chor") {
                db.ref(`rooms/${roomCode}/dialogue`).set(`🕵️ <strong>${guesserName}</strong> guessed <strong>${suspectName}</strong>!<br/><br/>🎉 Correct! The Chor is caught! (+500 pts)`);
                if (isHost) updateScore(guesserId, 500); 
            } else {
                db.ref(`rooms/${roomCode}/dialogue`).set(`🕵️ <strong>${guesserName}</strong> guessed <strong>${suspectName}</strong>!<br/><br/>❌ Wrong! The Chor escaped! (+500 to Chor)`);
                if (isHost) updateScore(chorId, 500); 
            }

            if (isHost) {
                cards.forEach(c => { if (c.role !== "Police" && c.role !== "Chor" && c.owner) updateScore(c.owner, c.points); });
                
                db.ref(`rooms/${roomCode}/lastGuess`).set({ 
                    suspect: suspectId, 
                    correct: (suspectRole === "Chor"), 
                    chorId: chorId, 
                    guesserId: guesserId, 
                    timestamp: Date.now() 
                });
            }
            
            dialogueRevealed = true;
            db.ref(`rooms/${roomCode}/cards`).once('value', s=>renderCards(s.val()));
        });
    }
}

// --- Leaderboard & End Game ---
document.getElementById('leaderboard-btn').onclick = () => {
    let sorted = Object.keys(playersData).map(id => ({ id, name: playersData[id].name, score: playersData[id].score || 0 })).sort((a,b)=>b.score-a.score);
    const titles = ["👑 KING", "👸 QUEEN", "🛡️ MINISTER", "💂 SENAPATI", "💼 BANKER", "💻 HACKER", "🏃 CHOR", "🕵️ PRISONER"];
    let html = `<h3 style="margin-top:0; color:var(--text-light); text-transform: uppercase; font-size: 0.9rem;">Round ${currentRound} / ${gameMaxRounds}</h3>`;
    sorted.forEach((p, i) => { html += `<p style="margin: 10px 0; font-size: 1.05rem; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:5px;"><strong>${titles[i]||"CITIZEN"}</strong>: ${p.name} <span style="color:var(--primary); font-weight:600; float:right;">${p.score || 0} pts</span></p>`; });
    document.getElementById('stats-content').innerHTML = html;
    document.getElementById('stats-overlay').classList.add('active');
};

function triggerEndGame() {
    db.ref(`rooms/${roomCode}/players`).once('value', snap => {
        const p = snap.val();
        let sorted = Object.keys(p).map(id => ({ id, name: p[id].name, score: p[id].score || 0, isBot: p[id].isBot })).sort((a,b)=>b.score-a.score);
        const titles = ["👑 KING", "👸 QUEEN", "🛡️ MINISTER", "💂 SENAPATI", "💼 BANKER", "💻 HACKER", "🏃 CHOR", "🕵️ PRISONER"];
        
        let html = ``;
        sorted.forEach((player, i) => { 
            let cClass = i === 0 ? "final-player-card winner" : "final-player-card";
            html += `
            <div class="${cClass}">
                <div class="final-rank">#${i+1}</div>
                <div style="flex-grow:1;">
                    <div class="final-title">${titles[i]||"CITIZEN"}</div>
                    <div style="font-weight:600;">${player.name}</div>
                </div>
                <div class="final-score-val">${player.score} pts</div>
            </div>`; 
        });
        
        document.getElementById('final-scores-list').innerHTML = html;
        
        let actionHtml = '';
        if (isHost) {
            actionHtml = `
                <button onclick="window.playAgain()" style="padding: 12px 20px;">🔄 Play Again</button>
                <button class="danger" onclick="window.location.reload()" style="padding: 12px 20px; background:#7F1D1D;">🏠 Home</button>
            `;
        } else {
            actionHtml = `
                <button class="danger" onclick="window.location.reload()" style="padding: 12px 20px; background:#7F1D1D;">🏠 Home</button>
            `;
        }
        document.getElementById('end-game-actions').innerHTML = actionHtml;

        const winner = sorted[0];
        if(!winner.isBot) db.ref(`users/${winner.id}/stats/wins`).once('value', s => db.ref(`users/${winner.id}/stats/wins`).set((s.val()||0)+1));
        sorted.forEach(player => { if(!player.isBot) db.ref(`users/${player.id}/stats/lifetimeScore`).once('value', s => db.ref(`users/${player.id}/stats/lifetimeScore`).set((s.val()||0)+player.score)); });

        db.ref(`rooms/${roomCode}/gameState/status`).set('ended');
        playSound('win');
    });
}

// Fixed Restart Function
window.playAgain = function() {
    Object.keys(playersData).forEach(id => { if(playersData[id]) db.ref(`rooms/${roomCode}/players/${id}/score`).set(0); });
    
    const voteBtn = document.getElementById('vote-end-btn');
    voteBtn.disabled = false; voteBtn.style.background = ''; voteBtn.innerText = 'Vote End';
    
    db.ref(`rooms/${roomCode}/endVotes`).remove();
    db.ref(`rooms/${roomCode}/lastGuess`).remove();
    db.ref(`rooms/${roomCode}/convPhase`).remove(); 
    db.ref(`rooms/${roomCode}/cards`).remove(); 
    
    dialogueRevealed = false; 
    
    db.ref(`rooms/${roomCode}/dialogue`).set("Restarting match...");
    db.ref(`rooms/${roomCode}/gameState/round`).set(1);
    db.ref(`rooms/${roomCode}/gameState/status`).set('lobby'); // Instantly sets lobby so hostDealsCards picks it up smoothly
};

function updateScore(id, pts) { db.ref(`rooms/${roomCode}/players/${id}/score`).once('value', s => db.ref(`rooms/${roomCode}/players/${id}/score`).set((s.val()||0)+pts)); }

// --- Controls ---
document.getElementById('vote-end-btn').onclick = function() {
    this.disabled = true; this.style.background = '#94A3B8'; this.innerText = 'Voted';
    db.ref(`rooms/${roomCode}/endVotes/${playerId}`).set(true);
    db.ref(`rooms/${roomCode}/chat`).push({ sender: "System", text: `${playerName} voted to end early.`, senderId: 'sys' });
};

let chatVisible = true;
document.getElementById('toggle-chat-btn').onclick = () => { 
    chatVisible = !chatVisible;
    document.getElementById('chat-box').style.display = chatVisible ? 'flex' : 'none';
    document.getElementById('toggle-chat-btn').innerText = chatVisible ? '🔽 Hide Chat' : '💬 Show Chat';
};

document.getElementById('exit-btn').onclick = () => { 
    db.ref(`rooms/${roomCode}/players/${playerId}`).remove(); 
    db.ref(`rooms/${roomCode}/endVotes/${playerId}`).remove(); 
    window.location.reload(); 
};

// --- Chat with Cooldown Protection ---
const chatInput = document.getElementById('chat-input');
let lastChatTime = 0;

function canSendChat() {
    const now = Date.now();
    if (now - lastChatTime < 3000) {
        const btn = document.getElementById('send-chat-btn');
        let oldHtml = btn.innerHTML;
        btn.innerHTML = "⏳";
        btn.disabled = true;
        setTimeout(() => { btn.innerHTML = oldHtml; btn.disabled = false; }, 1500);
        return false;
    }
    lastChatTime = now;
    return true;
}

window.sendQuickEmoji = function(emoji) { 
    if(!canSendChat()) return;
    db.ref(`rooms/${roomCode}/chat`).push({ sender: playerName, text: emoji, senderId: playerId }); 
}

function sendChat() {
    const text = chatInput.value.trim();
    if (text && playerName) { 
        if(!canSendChat()) return;
        db.ref(`rooms/${roomCode}/chat`).push({ sender: playerName, text: text, senderId: playerId }); 
        chatInput.value = ""; 
    }
}
document.getElementById('send-chat-btn').onclick = sendChat;
chatInput.onkeypress = e => { if (e.key === 'Enter') sendChat(); };

function setupChatListener() {
    db.ref(`rooms/${roomCode}/chat`).on('child_added', snap => {
        const msg = snap.val(); const box = document.getElementById('chat-messages');
        
        const pureEmojis = ['👍', '😂', '😎', '😡', '🚓', '😭', '🎉', '🤦‍♂️', '💼'];
        if (pureEmojis.includes(msg.text)) {
            let floatEl = document.createElement('div');
            floatEl.className = 'floating-emoji'; floatEl.innerText = msg.text;
            document.getElementById('emoji-layer').appendChild(floatEl);
            setTimeout(() => floatEl.remove(), 2000);
        }

        let isMe = msg.senderId === playerId;
        let mClass = msg.sender === "System" ? "style='background: #FFF1F2; color: #E11D48; margin: 5px auto; text-align: center; width: 90%;'" : "";
        let classAppend = isMe ? "me" : "";

        box.innerHTML += `<div class="chat-msg ${classAppend}" ${mClass}>
            ${!isMe && msg.sender !== "System" ? `<strong>${msg.sender}</strong>` : ""}
            ${msg.text}
        </div>`;
        box.scrollTop = box.scrollHeight;
    });
}
