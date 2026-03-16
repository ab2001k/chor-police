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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
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

// Roles for different game sizes
const roles4 = [
    { name: "OC", points: 2000 }, { name: "Daroga", points: 1200 },
    { name: "Police", points: 500 }, { name: "Chor", points: 0 }
];
const roles6 = [
    { name: "OC", points: 2000 }, { name: "Daroga", points: 1200 },
    { name: "Havildar", points: 800 }, { name: "Police", points: 500 },
    { name: "Daku", points: 300 }, { name: "Chor", points: 0 }
];

// --- Check URL for Invite Code ---
const urlParams = new URLSearchParams(window.location.search);
const urlRoom = urlParams.get('room');
if (urlRoom) {
    document.getElementById('room-code-input').value = urlRoom.toUpperCase();
}

// --- Audio Toggle ---
document.getElementById('sound-toggle').addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.innerText = soundEnabled ? "🔊" : "🔇";
});

// --- Helper: Auto-assign Name ---
function getValidName() {
    let nameInput = document.getElementById('player-name').value.trim();
    if (!nameInput) {
        // Automatically assign a unique guest name if left blank
        nameInput = "Guest_" + Math.floor(Math.random() * 10000);
        document.getElementById('player-name').value = nameInput;
    }
    return nameInput;
}

// --- Lobby Logic (Create & Join) ---
document.getElementById('create-btn').addEventListener('click', () => {
    playerName = getValidName();
    roomMaxPlayers = parseInt(document.getElementById('player-count').value);
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create room in database
    db.ref(`rooms/${roomCode}/info`).set({ maxPlayers: roomMaxPlayers, status: "lobby" });
    enterGameScreen();
});

document.getElementById('join-btn').addEventListener('click', () => {
    playerName = getValidName();
    const codeInput = document.getElementById('room-code-input').value.trim().toUpperCase();
    
    if (codeInput.length !== 6) return alert("Enter a valid 6-digit code!");
    
    // Check if room exists
    db.ref(`rooms/${codeInput}/info`).once('value', snap => {
        if (snap.exists()) {
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
    
    // Update UI with room details
    document.getElementById('display-room-code').innerText = roomCode;
    document.getElementById('display-max-players').innerText = roomMaxPlayers;
    
    if(roomMaxPlayers === 6) document.getElementById('card-table').classList.add('six-players');
    
    // Update URL so it's easily copyable
    window.history.replaceState(null, '', `?room=${roomCode}`);
    
    joinRoomFirebase();
    startChatListener(); // FIX: Start chat ONLY after roomCode is known
}

// --- Multiplayer Firebase Logic ---
function joinRoomFirebase() {
    const playerRef = db.ref(`rooms/${roomCode}/players/${playerId}`);
    playerRef.set({ name: playerName, score: 0 });
    
    // Auto-remove player if they disconnect or close the tab
    playerRef.onDisconnect().remove();

    listenToRoomData();
}

function listenToRoomData() {
    // 1. Listen for Players joining/leaving
    db.ref(`rooms/${roomCode}/players`).on('value', snap => {
        playersData = snap.val() || {};
        const playerIds = Object.keys(playersData);
        const list = document.getElementById('player-list');
        list.innerHTML = ""; 
        
        playerIds.forEach(id => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${playersData[id].name}</span> <span>⭐ ${playersData[id].score}</span>`;
            list.appendChild(li);
        });

        // The first person in the room is the Host
        isHost = (playerIds.length > 0 && playerIds[0] === playerId);

        // If the room is full, the Host starts the game
        if (playerIds.length === roomMaxPlayers && isHost) {
            db.ref(`rooms/${roomCode}/gameState`).once('value', gSnap => {
                if (!gSnap.val() || gSnap.val().status !== 'playing') {
                    hostDealsCards();
                }
            });
        }
    });

    // 2. Listen for Card updates
    db.ref(`rooms/${roomCode}/cards`).on('value', snap => {
        if (snap.val()) renderCards(snap.val());
    });

    // 3. Listen for Dialogue text updates
    db.ref(`rooms/${roomCode}/dialogue`).on('value', snap => {
        if (snap.val()) document.getElementById('dialogue-box').innerHTML = snap.val();
    });
}

function hostDealsCards() {
    hasTriggeredDialogue = false; 
    const activeRoles = roomMaxPlayers === 6 ? roles6 : roles4;
    // Shuffle the roles
    const shuffledRoles = [...activeRoles].sort(() => Math.random() - 0.5);
    const cardData = {};
    
    for(let i = 0; i < roomMaxPlayers; i++) {
        cardData[i] = { role: shuffledRoles[i].name, points: shuffledRoles[i].points, owner: null };
    }
    
    // Deal to everyone
    db.ref(`rooms/${roomCode}/cards`).set(cardData);
    db.ref(`rooms/${roomCode}/gameState`).set({ status: 'playing' });
    db.ref(`rooms/${roomCode}/dialogue`).set("Game Started! Fast! Pick a card!");
}

function renderCards(cards) {
    const table = document.getElementById('card-table');
    table.innerHTML = "";
    let claimedCount = 0;
    let iClaimed = false;

    // Check if I already picked a card
    Object.values(cards).forEach(c => { if (c.owner === playerId) iClaimed = true; });

    Object.keys(cards).forEach(key => {
        const cardObj = cards[key];
        const cardEl = document.createElement('div');
        cardEl.className = 'card';

        if (cardObj.owner) {
            claimedCount++;
            cardEl.classList.add('flipped');
            cardEl.style.transform = "rotateY(180deg)";
            
            if (cardObj.owner === playerId) {
                myRole = cardObj.role;
                cardEl.innerText = `${cardObj.role}\n(${cardObj.points})`;
            } else {
                const ownerName = playersData[cardObj.owner] ? playersData[cardObj.owner].name : "Player";
                cardEl.innerText = `Picked by\n${ownerName}`;
                cardEl.style.fontSize = "1rem";
            }
        } else {
            cardEl.innerText = "?";
            cardEl.addEventListener('click', () => {
                if (!iClaimed) db.ref(`rooms/${roomCode}/cards/${key}`).update({ owner: playerId });
            });
        }
        table.appendChild(cardEl);
    });

    // When all cards are picked, trigger the cinematic dialogue
    if (claimedCount === roomMaxPlayers && !hasTriggeredDialogue) {
        hasTriggeredDialogue = true;
        if (isHost) triggerCinematicDialogue();
    }
}

function triggerCinematicDialogue() {
    const dialogueRef = db.ref(`rooms/${roomCode}/dialogue`);
    dialogueRef.set("Processing roles...");
    
    setTimeout(() => dialogueRef.set("<em>Police, police; koun hai??</em>"), 2000);
    setTimeout(() => dialogueRef.set("<strong>Hum hai!</strong>"), 4500);
    setTimeout(() => {
        dialogueRef.set("<span style='color:red;'>Chor ko pakdo!</span>");
        db.ref(`rooms/${roomCode}/guessPhase`).set(true); // Tell everyone the guess phase started
    }, 6500);
}

// --- Guessing & Scoring Logic ---
db.ref(`rooms/${roomCode}/guessPhase`).on('value', snap => {
    // If guess phase is active and I am the Police, show the buttons
    if (snap.val() && myRole === "Police") {
        activatePoliceGuessing();
    }
});

function activatePoliceGuessing() {
    const guessSec = document.getElementById('guess-section');
    guessSec.innerHTML = "<h3>You are the Police! Who is the Chor?</h3>";
    guessSec.style.display = "block";
    
    // Clear previous buttons
    Array.from(guessSec.children).forEach(child => {
        if (child.tagName === "BUTTON") child.remove();
    });
    
    Object.keys(playersData).forEach(id => {
        if (id !== playerId) {
            const btn = document.createElement('button');
            btn.className = "guess-btn";
            btn.innerText = playersData[id].name;
            btn.onclick = () => makeGuess(id);
            guessSec.appendChild(btn);
        }
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

        if (suspectRole === "Chor") {
            db.ref(`rooms/${roomCode}/dialogue`).set(`🏆 **${playerName} (Police)** caught the Chor! (+500 pts)`);
            updateScore(playerId, 500); // Police wins points
        } else {
            const realChorName = playersData[chorId] ? playersData[chorId].name : "Unknown";
            db.ref(`rooms/${roomCode}/dialogue`).set(`❌ Wrong! The Chor was ${realChorName}. Chor escapes! (+500 pts)`);
            updateScore(chorId, 500); // Chor wins points
        }

        // Auto-award points for everyone else (OC, Daroga, etc.)
        Object.values(cards).forEach(c => {
            if (c.role !== "Police" && c.role !== "Chor" && c.owner) {
                updateScore(c.owner, c.points);
            }
        });
        
        // Loop the game completely intact (Chat, scores, players remain)
        setTimeout(() => {
            if(isHost) {
                db.ref(`rooms/${roomCode}/guessPhase`).remove();
                db.ref(`rooms/${roomCode}/cards`).remove();
                db.ref(`rooms/${roomCode}/gameState`).set({ status: 'lobby' });
                db.ref(`rooms/${roomCode}/dialogue`).set(`Round over! Starting next round...`);
                setTimeout(hostDealsCards, 3000); // Auto start next round
            }
            myRole = null;
        }, 5000);
    });
}

function updateScore(targetPlayerId, pointsToAdd) {
    const scoreRef = db.ref(`rooms/${roomCode}/players/${targetPlayerId}/score`);
    scoreRef.once('value', snap => {
        scoreRef.set((snap.val() || 0) + pointsToAdd);
    });
}

// --- Room Controls (Link, Exit, Chat) ---
document.getElementById('copy-link-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Invite link copied!");
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

// FIX: Start listening for chat only AFTER entering the room
function startChatListener() {
    const box = document.getElementById('chat-messages');
    box.innerHTML = ""; // Clear box on load
    
    // Listen for all past and future chats in this specific room
    db.ref(`rooms/${roomCode}/chat`).on('child_added', snap => {
        const msg = snap.val();
        box.innerHTML += `<div style="margin-bottom: 5px;"><strong>${msg.sender}:</strong> ${msg.text}</div>`;
        box.scrollTop = box.scrollHeight; // Auto-scroll down
    });
}
