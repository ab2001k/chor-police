// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBWT6w0EsRYm_Cd2P6JmeQlQjZpNK07V0Y",
    authDomain: "chorpolicegame-8c330.firebaseapp.com",
    databaseURL: "https://chorpolicegame-8c330-default-rtdb.firebaseio.com",
    projectId: "chorpolicegame-8c330",
    storageBucket: "chorpolicegame-8c330.firebasestorage.app",
    messagingSenderId: "70710319190",
    appId: "1:70710319190:web:ef3d024730bacf241543f7",
    measurementId: "G-XDZ3J1R6F1"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Game Variables ---
let playerName = "";
let playerId = "player_" + Math.random().toString(36).substr(2, 9);
let roomCode = "";
let roomMaxPlayers = 4;
let isHost = false;
let myRole = null;
let playersData = {};
let soundEnabled = true;
let hasTriggeredDialogue = false;
let currentRound = 1;
const MAX_ROUNDS = 20;

// Roles & Exact Points
const roles4 = [
    { name: "OC", points: 2000 }, 
    { name: "Daroga", points: 1200 },
    { name: "Police", points: 500 }, 
    { name: "Chor", points: 0 }
];
const roles6 = [
    { name: "DC", points: 2500 }, 
    { name: "OC", points: 2000 },
    { name: "Army", points: 1500 }, 
    { name: "Daroga", points: 1200 },
    { name: "Police", points: 500 }, 
    { name: "Chor", points: 0 }
];

// --- Check URL for Invite Code ---
const urlParams = new URLSearchParams(window.location.search);
const urlRoom = urlParams.get('room');
if (urlRoom) {
    document.getElementById('room-code-input').value = urlRoom.toUpperCase();
}

// --- Audio ---
document.getElementById('sound-toggle').addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.innerText = soundEnabled ? "Sound: ON" : "Sound: OFF";
});

// --- Rename Feature ---
document.getElementById('rename-btn').addEventListener('click', () => {
    let newName = prompt("Enter your new name:", playerName);
    if (newName && newName.trim() !== "") {
        playerName = newName.trim();
        db.ref(`rooms/${roomCode}/players/${playerId}/name`).set(playerName);
        
        // System message for rename
        db.ref(`rooms/${roomCode}/chat`).push({
            sender: "System",
            text: `A player is now known as ${playerName}`
        });
    }
});

// --- Lobby Logic ---
document.getElementById('create-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name').value.trim();
    if (!nameInput) return alert("Please enter your name!");
    
    playerName = nameInput;
    roomMaxPlayers = parseInt(document.getElementById('player-count').value);
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    db.ref(`rooms/${roomCode}/info`).set({ maxPlayers: roomMaxPlayers, status: "lobby" });
    db.ref(`rooms/${roomCode}/gameState`).set({ round: 1, status: 'lobby' });
    enterGameScreen();
});

document.getElementById('join-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name').value.trim();
    const codeInput = document.getElementById('room-code-input').value.trim().toUpperCase();
    
    if (!nameInput) return alert("Please enter your name!");
    if (codeInput.length !== 6) return alert("Enter a valid 6-digit code.");
    
    db.ref(`rooms/${codeInput}/info`).once('value', snap => {
        if (snap.exists()) {
            playerName = nameInput;
            roomCode = codeInput;
            roomMaxPlayers = snap.val().maxPlayers;
            enterGameScreen();
        } else {
            alert("Room not found! Check the code.");
        }
    });
});

function enterGameScreen() {
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    document.getElementById('display-room-code').innerText = roomCode;
    document.getElementById('display-max-players').innerText = roomMaxPlayers;
    
    if(roomMaxPlayers === 6) document.getElementById('card-table').classList.add('six-players');
    
    window.history.replaceState(null, '', `?room=${roomCode}`);
    
    // FIX: Clear chat history before joining a new room
    document.getElementById('chat-messages').innerHTML = ""; 
    
    joinRoomFirebase();
}

// --- Multiplayer Logic ---
function joinRoomFirebase() {
    const playerRef = db.ref(`rooms/${roomCode}/players/${playerId}`);
    playerRef.set({ name: playerName, score: 0 });
    playerRef.onDisconnect().remove();

    listenToRoomData();
    setupChatListener();
}

function listenToRoomData() {
    db.ref(`rooms/${roomCode}/players`).on('value', snap => {
        playersData = snap.val() || {};
        const playerIds = Object.keys(playersData);
        const list = document.getElementById('player-list');
        list.innerHTML = ""; 
        
        playerIds.forEach(id => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${playersData[id].name}</span> <span class="score-pill">${playersData[id].score} pts</span>`;
            list.appendChild(li);
        });

        isHost = (playerIds.length > 0 && playerIds[0] === playerId);

        if (playerIds.length === roomMaxPlayers && isHost) {
            db.ref(`rooms/${roomCode}/gameState`).once('value', gSnap => {
                if (!gSnap.val() || gSnap.val().status !== 'playing' && gSnap.val().status !== 'ended') {
                    hostDealsCards();
                }
            });
        }
    });

    db.ref(`rooms/${roomCode}/gameState/round`).on('value', snap => {
        if (snap.val()) currentRound = snap.val();
    });

    db.ref(`rooms/${roomCode}/cards`).on('value', snap => {
        if (snap.val()) renderCards(snap.val());
    });

    db.ref(`rooms/${roomCode}/dialogue`).on('value', snap => {
        if (snap.val()) document.getElementById('dialogue-box').innerHTML = snap.val();
    });
}

function hostDealsCards() {
    hasTriggeredDialogue = false; 
    const activeRoles = roomMaxPlayers === 6 ? roles6 : roles4;
    const shuffledRoles = [...activeRoles].sort(() => Math.random() - 0.5);
    const cardData = {};
    
    for(let i = 0; i < roomMaxPlayers; i++) {
        cardData[i] = { role: shuffledRoles[i].name, points: shuffledRoles[i].points, owner: null };
    }
    
    db.ref(`rooms/${roomCode}/cards`).set(cardData);
    db.ref(`rooms/${roomCode}/gameState`).update({ status: 'playing' });
    db.ref(`rooms/${roomCode}/dialogue`).set(`<strong>Round ${currentRound}/${MAX_ROUNDS}</strong><br/>Game Started! Pick a card quickly!`);
}

function renderCards(cards) {
    const table = document.getElementById('card-table');
    table.innerHTML = "";
    let claimedCount = 0;
    let iClaimed = false;
    
    let darogaName = "Daroga";
    let policeName = "Police";

    Object.values(cards).forEach(c => { if (c.owner === playerId) iClaimed = true; });

    Object.keys(cards).forEach(key => {
        const cardObj = cards[key];
        const cardEl = document.createElement('div');
        cardEl.className = 'card';

        if (cardObj.owner) {
            claimedCount++;
            cardEl.classList.add('flipped');
            cardEl.style.transform = "rotateY(180deg)";
            
            const ownerName = playersData[cardObj.owner] ? playersData[cardObj.owner].name : "Player";
            
            // Track dynamic names for dialogue
            if (cardObj.role === "Daroga") darogaName = ownerName;
            if (cardObj.role === "Police") policeName = ownerName;

            if (cardObj.owner === playerId) {
                myRole = cardObj.role;
                cardEl.innerHTML = `<div><span style="font-size: 0.8rem; color: #64748B;">You</span><br/>${cardObj.role}<br/><span style="font-size: 0.9rem; color: #3B82F6;">${cardObj.points}</span></div>`;
            } else {
                cardEl.innerHTML = `<span style="font-size: 0.9rem; color: #64748B;">Picked by</span><br/>${ownerName}`;
            }
        } else {
            cardEl.innerText = "Select";
            cardEl.addEventListener('click', () => {
                if (!iClaimed) db.ref(`rooms/${roomCode}/cards/${key}`).update({ owner: playerId });
            });
        }
        table.appendChild(cardEl);
    });

    if (claimedCount === roomMaxPlayers && !hasTriggeredDialogue) {
        hasTriggeredDialogue = true;
        if (isHost) triggerCinematicDialogue(darogaName, policeName);
    }
}

function triggerCinematicDialogue(daroga, police) {
    const dialogueRef = db.ref(`rooms/${roomCode}/dialogue`);
    dialogueRef.set("Cards revealed! Processing...");
    
    setTimeout(() => {
        dialogueRef.set(`<strong>${daroga} (Daroga):</strong> "Police, police; koun hai??"`);
    }, 2000); // 2 seconds

    setTimeout(() => {
        dialogueRef.set(`<strong>${police} (Police):</strong> "Hum hai!"`);
    }, 5000); // Wait 3s after previous

    setTimeout(() => {
        dialogueRef.set(`<strong>${daroga} (Daroga):</strong> "Chor ko pakdo!"`);
        db.ref(`rooms/${roomCode}/guessPhase`).set(true); 
    }, 7000); // Wait 2s after previous
}

// --- Guessing & 20-Round Logic ---
db.ref(`rooms/${roomCode}/guessPhase`).on('value', snap => {
    if (snap.val() && myRole === "Police") {
        activatePoliceGuessing();
    }
});

function activatePoliceGuessing() {
            const guessSec = document.getElementById('guess-section');
            guessSec.innerHTML = "<h3>You are the Police! Who is the Chor?</h3>";
            guessSec.style.display = "block";
            
            // OPTIMIZATION: Fetch the cards exactly ONCE to build the buttons instantly
            db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
                const cards = snap.val();
                
                Object.keys(playersData).forEach(id => {
                    let isDaroga = false;
                    
                    // Check if this specific player holds the Daroga card
                    Object.values(cards).forEach(c => { 
                        if (c.owner === id && c.role === "Daroga") isDaroga = true; 
                    });
                    
                    // Do not show a button for the Police (yourself) or the Daroga
                    if (id !== playerId && !isDaroga) {
                        const btn = document.createElement('button');
                        btn.className = "guess-btn";
                        btn.innerText = playersData[id].name;
                        btn.onclick = () => makeGuess(id);
                        guessSec.appendChild(btn);
                    }
                });
            });
        }

function makeGuess(suspectId) {
    document.getElementById('guess-section').style.display = "none";
    
    db.ref(`rooms/${roomCode}/cards`).once('value', snap => {
        const cards = snap.val();
        let suspectRole = "";
        let chorId = "";
        
        Object.values(cards).forEach(c => {
            if (c.owner === suspectId) suspectRole = c.role;
            if (c.role === "Chor") chorId = c.owner;
        });

        // Rule: Police Right = Police 500, Chor 0. Police Wrong = Police 0, Chor 500.
        if (suspectRole === "Chor") {
            db.ref(`rooms/${roomCode}/dialogue`).set(`Correct! ${playerName} (Police) caught the Chor! (+500 pts)`);
            updateScore(playerId, 500); 
        } else {
            const realChorName = playersData[chorId] ? playersData[chorId].name : "Unknown";
            db.ref(`rooms/${roomCode}/dialogue`).set(`Incorrect! The Chor was ${realChorName}. Chor escapes! (+500 pts)`);
            updateScore(chorId, 500); 
        }

        // Auto-award exact points for OC, Daroga, Army, DC
        Object.values(cards).forEach(c => {
            if (c.role !== "Police" && c.role !== "Chor" && c.owner) {
                updateScore(c.owner, c.points);
            }
        });
        
        // Handle Next Round or Game Over
        setTimeout(() => {
            if(isHost) {
                if (currentRound >= MAX_ROUNDS) {
                    triggerEndGameCelebration();
                } else {
                    db.ref(`rooms/${roomCode}/gameState/round`).set(currentRound + 1);
                    db.ref(`rooms/${roomCode}/guessPhase`).remove();
                    db.ref(`rooms/${roomCode}/cards`).remove();
                    db.ref(`rooms/${roomCode}/dialogue`).set(`Round over! Preparing Round ${currentRound + 1}...`);
                    setTimeout(hostDealsCards, 3000); 
                }
            }
            myRole = null;
        }, 5000);
    });
}

function triggerEndGameCelebration() {
    db.ref(`rooms/${roomCode}/players`).once('value', snap => {
        const finalPlayers = snap.val();
        let sortedPlayers = Object.keys(finalPlayers).map(id => {
            return { name: finalPlayers[id].name, score: finalPlayers[id].score };
        }).sort((a, b) => b.score - a.score);

        const titles = ["👑 KING", "👸 QUEEN", "🛡️ MINISTER", "💂 SENAPATI", "🏃 CHOR", "🕵️ PRISONER"];
        
        let resultHTML = "<h2 style='margin: 0 0 10px 0; color: #E11D48;'>🎉 GAME OVER 🎉</h2>";
        sortedPlayers.forEach((p, index) => {
            let title = titles[index] || "CITIZEN";
            resultHTML += `<p style="margin: 5px 0; font-size: 1.1rem; color: #1E293B;"><strong>${title}:</strong> ${p.name} <span style="color: #3B82F6;">(${p.score} pts)</span></p>`;
        });

        db.ref(`rooms/${roomCode}/dialogue`).set(resultHTML);
        db.ref(`rooms/${roomCode}/gameState/status`).set('ended');
        db.ref(`rooms/${roomCode}/guessPhase`).remove();
    });
}

function updateScore(targetPlayerId, pointsToAdd) {
    const scoreRef = db.ref(`rooms/${roomCode}/players/${targetPlayerId}/score`);
    scoreRef.once('value', snap => {
        scoreRef.set((snap.val() || 0) + pointsToAdd);
    });
}

// --- Controls (Exit, Link, Chat) ---
document.getElementById('copy-link-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Invite link copied to clipboard!");
});

document.getElementById('exit-btn').addEventListener('click', () => {
    db.ref(`rooms/${roomCode}/players/${playerId}`).remove();
    window.location.href = window.location.pathname; 
});

const chatInput = document.getElementById('chat-input');
function sendChat() {
    const text = chatInput.value.trim();
    if (text && playerName) {
        db.ref(`rooms/${roomCode}/chat`).push({ sender: playerName, text: text });
        chatInput.value = ""; 
    }
}
document.getElementById('send-chat-btn').addEventListener('click', sendChat);
chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });

function setupChatListener() {
    db.ref(`rooms/${roomCode}/chat`).on('child_added', snap => {
        const msg = snap.val();
        const box = document.getElementById('chat-messages');
        let msgClass = msg.sender === "System" ? "style='background: #FFF1F2; color: #E11D48; margin: 5px auto; text-align: center; width: 90%;'" : "";
        box.innerHTML += `<div class="chat-msg" ${msgClass}><strong>${msg.sender}:</strong> ${msg.text}</div>`;
        box.scrollTop = box.scrollHeight;
    });
}
