const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START'; // START, PLAYING, LEVEL_TRANSITION, GAMEOVER
let score = 0;
let level = 1;
let lives = 3;
let speedMultiplier = 1;
let frameCount = 0;
let nextLevelScore = 150; // Modified initial goal to match manual change
let currentLevelStartScore = 0; // Track start score of current level for progress bar

// New Competitive Features State
let combo = 0;
let maxCombo = 0;
let currentTier = '브론즈';

// Elements
const scoreEl = document.getElementById('score');
const targetScoreEl = document.getElementById('target-score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
// stageClearScreen is removed from HTML interaction
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

// New UI Elements
const tierEl = document.getElementById('tier');
const comboContainer = document.getElementById('combo-container');
const comboCountEl = document.getElementById('combo-count');

// Resizing Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial call

// Player (Basket)
const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 80, // Reduced from 100 for better proportion
    height: 60, // Reduced from 80 for better proportion
    speed: 13, // Increased from 7 for swifter movement
    dx: 0,
    emoji: '🧺'
};

// Items
const items = [];
const itemTypes = [
    { type: 'good', emoji: '🍎', score: 10 },
    { type: 'good', emoji: '🍌', score: 10 },
    { type: 'good', emoji: '🍇', score: 15 },
    { type: 'good', emoji: '🍊', score: 10 },
    { type: 'good', emoji: '⭐', score: 50 }, // Rare bonus
    { type: 'bad', emoji: '💣', damage: 1 },
    { type: 'bad', emoji: '💩', damage: 1 },
    { type: 'villain', emoji: '👾', damage: 2 } // New Villain for Level 5+
];

// Input Handling
let isTouch = false;

// Keyboard Input
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') player.dx = -player.speed;
    if (e.code === 'ArrowRight') player.dx = player.speed;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') player.dx = 0;
});

// Touch/Mouse Input (Direct Mapping)
function movePlayerTo(clientX) {
    if (gameState === 'PLAYING') {
        const rect = canvas.getBoundingClientRect();
        let newX = clientX - rect.left - player.width / 2;

        // Boundary check immediate
        if (newX < 0) newX = 0;
        if (newX + player.width > canvas.width) newX = canvas.width - player.width;

        player.x = newX;
    }
}

canvas.addEventListener('mousemove', (e) => {
    if (!isTouch) {
        movePlayerTo(e.clientX);
    }
});

canvas.addEventListener('touchmove', (e) => {
    isTouch = true;
    e.preventDefault(); // Prevent scrolling
    movePlayerTo(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    isTouch = true;
    if (e.target === canvas) e.preventDefault();
    movePlayerTo(e.touches[0].clientX);
}, { passive: false });


// Game Loop
let animationId; // Track the loop

function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;

    // Player Movement (Keyboard velocity)
    // If using mouse/touch, dx might be 0, which is fine as we set x directly
    player.x += player.dx;

    // Boundary Constraints
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Spawn Items
    // Difficulty: Spawn faster as level increases
    let spawnRate = Math.max(20, 60 - (level * 2));
    if (frameCount % spawnRate === 0) {
        spawnItem();
    }

    // Update Items
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.y += item.speed * speedMultiplier;

        // Collision with Player
        if (
            item.x < player.x + player.width &&
            item.x + item.width > player.x &&
            item.y < player.y + player.height &&
            item.y + item.height > player.y
        ) {
            handleCollision(item);
            items.splice(i, 1);
            continue;
        }

        // Off screen
        if (item.y > canvas.height) {
            // Missed a good item -> Reset Combo
            if (item.type === 'good') {
                resetCombo();
            }
            items.splice(i, 1);
        }
    }

    // Check Level Up
    if (score >= nextLevelScore) {
        nextLevel(); // Auto level up
    }
}

function spawnItem() {
    let availableTypes = itemTypes.filter(t => t.type === 'good'); // Level 1: Good items only

    // Level 2+: Add Bombs
    if (level >= 2) {
        availableTypes = itemTypes.filter(t => t.type !== 'villain');
    }

    // Level 5+: Add Villain
    if (level >= 5) {
        availableTypes = itemTypes;
    }

    const randomType = Math.random() < 0.3 ?
        // 30% bad items/villains (only if available)
        availableTypes.filter(t => t.type === 'bad' || t.type === 'villain')[Math.floor(Math.random() * (level >= 5 ? 3 : 2))] :
        availableTypes.filter(t => t.type === 'good')[Math.floor(Math.random() * 5)];

    // Fallback if randomType is undefined (e.g. Level 1 has no bad items)
    const type = randomType || availableTypes[Math.floor(Math.random() * availableTypes.length)];

    const width = 40;
    let x = Math.random() * (canvas.width - width);

    // Prevent overlap: Try to find a spot not too close to recent items
    // Simple check against last few items
    let safe = true;
    for (let i = items.length - 1; i >= Math.max(0, items.length - 3); i--) {
        const other = items[i];
        if (other.y < 100 && Math.abs(other.x - x) < 60) {
            safe = false;
            break;
        }
    }

    // If not safe, try shifting x (simple retry once)
    if (!safe) {
        x = Math.random() * (canvas.width - width);
    }

    items.push({
        x: x,
        y: -50,
        width: width,
        height: 40,
        speed: 2 + Math.random() * 3, // Reduced base speed (was 3)
        ...type
    });
}

function handleCollision(item) {
    if (item.type === 'good') {
        // Combo Logic
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        // Score Calculation with Combo Multiplier
        // Base score + (Base score * Combo * 0.1)
        const bonus = Math.floor(item.score * (combo * 0.1));
        const totalScore = item.score + bonus;
        score += totalScore;

        createParticles(item.x, item.y, '✨'); // Sparkle effect

        // GSAP Animation for Score
        const scorePopup = document.createElement('div');
        scorePopup.innerText = `+${totalScore}`;
        scorePopup.style.position = 'absolute';
        scorePopup.style.left = `${player.x + player.width / 2}px`;
        scorePopup.style.top = `${player.y}px`;
        scorePopup.style.color = '#FFD700';
        scorePopup.style.fontWeight = 'bold';
        scorePopup.style.fontSize = '24px';
        scorePopup.style.pointerEvents = 'none';
        document.body.appendChild(scorePopup);

        gsap.to(scorePopup, {
            y: -50,
            opacity: 0,
            duration: 0.8,
            onComplete: () => scorePopup.remove()
        });

        // Player Feedback
        gsap.fromTo(canvas, { scale: 1.02 }, { scale: 1, duration: 0.1 });

        updateComboUI();

    } else if (item.type === 'villain') {
        lives -= item.damage;
        resetCombo();
        createParticles(item.x, item.y, '👿');
        shakeScreen(10);
    } else {
        lives -= item.damage;
        resetCombo();
        createParticles(item.x, item.y, '💥'); // Explosion effect
        shakeScreen(5);
    }

    updateUI();
    checkTier(); // Update Tier based on new score

    if (lives <= 0) {
        endGame();
    }
}

function resetCombo() {
    if (combo > 5) {
        // Visual feedback for losing combo
        const lostEl = document.createElement('div');
        lostEl.innerText = "Combo Lost!";
        lostEl.style.position = 'absolute';
        lostEl.style.top = '30%';
        lostEl.style.left = '50%';
        lostEl.style.transform = 'translate(-50%, -50%)';
        lostEl.style.color = '#FF6B6B';
        lostEl.style.fontSize = '30px';
        lostEl.style.fontWeight = 'bold';
        document.body.appendChild(lostEl);
        gsap.to(lostEl, { y: -20, opacity: 0, duration: 1, onComplete: () => lostEl.remove() });
    }
    combo = 0;
    updateComboUI();
}

function updateComboUI() {
    comboCountEl.innerText = combo;
    if (combo >= 2) {
        comboContainer.classList.remove('hidden');
        // Pulse animation
        gsap.fromTo(comboCountEl, { scale: 1.5, color: '#FFF' }, { scale: 1, color: '#FFD700', duration: 0.2 });
    } else {
        comboContainer.classList.add('hidden');
    }
}

function checkTier() {
    let newTier = '브론즈';
    let color = '#CD7F32'; // Bronze

    if (score >= 5000) { newTier = '다이아몬드'; color = '#b9f2ff'; }
    else if (score >= 3000) { newTier = '플래티넘'; color = '#e5e4e2'; }
    else if (score >= 1500) { newTier = '골드'; color = '#FFD700'; }
    else if (score >= 500) { newTier = '실버'; color = '#C0C0C0'; }

    if (newTier !== currentTier) {
        // Tier Up Animation
        currentTier = newTier;
        tierEl.innerText = currentTier;
        tierEl.style.color = color;

        gsap.fromTo(tierEl.parentElement,
            { scale: 1.5, rotation: -10 },
            { scale: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" }
        );

        // Celebrate Tier Up
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.1 },
            colors: [color, '#FFFFFF']
        });
    }
}

function shakeScreen(intensity) {
    gsap.to(canvas, {
        x: `random(-${intensity}, ${intensity})`,
        y: `random(-${intensity}, ${intensity})`,
        duration: 0.1,
        repeat: 3,
        yoyo: true,
        onComplete: () => {
            gsap.to(canvas, { x: 0, y: 0, duration: 0.1 });
        }
    });
}

function nextLevel() {
    level++;
    currentLevelStartScore = nextLevelScore; // Set start score for new level
    nextLevelScore += 100 + (level * 20); // Slightly increasing gap
    speedMultiplier += 0.05;

    // Visual Notification for Level Up
    const levelUpMsg = document.createElement('div');
    levelUpMsg.id = 'level-up-msg';
    levelUpMsg.innerText = `🎉 LEVEL ${level} 🎉`;

    // Style for centered display
    levelUpMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        font-weight: bold;
        color: #FFD700;
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.5);
        z-index: 1000;
        pointer-events: none;
        white-space: nowrap;
    `;
    document.body.appendChild(levelUpMsg);

    // Animate and Remove (only opacity, no scale to prevent movement)
    gsap.fromTo(levelUpMsg,
        { opacity: 0, y: 20 },
        {
            opacity: 1, y: 0, duration: 0.4, ease: "power2.out", onComplete: () => {
                gsap.to(levelUpMsg, { opacity: 0, y: -20, duration: 0.4, delay: 0.8, onComplete: () => levelUpMsg.remove() });
            }
        }
    );

    // Confetti Celebration
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });

    // Clear items so level starts fresh
    items.length = 0;

    updateUI();
}

function updateUI() {
    scoreEl.innerText = score;
    targetScoreEl.innerText = nextLevelScore;
    livesEl.innerText = lives;
    levelEl.innerText = level;

    // Animate score update
    gsap.to(scoreEl, { scale: 1.2, duration: 0.1, yoyo: true, repeat: 1 });
}

// Particle System
const particles = [];
function createParticles(x, y, char) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 30,
            char: char
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Player (Basket)
    ctx.font = '60px Arial';
    ctx.fillText(player.emoji, player.x, player.y + 50);

    // Draw Progress Bar on Basket
    const barWidth = 60;
    const barHeight = 8;
    const barX = player.x + (player.width - barWidth) / 2 + 10; // Center visually
    const barY = player.y + 60;

    // Background (Gray)
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Progress (Green-Yellow)
    const currentProgress = Math.max(0, score - currentLevelStartScore); // Score gained in this level
    const levelGoal = nextLevelScore - currentLevelStartScore; // Total score needed for this level
    const percent = Math.min(1, currentProgress / levelGoal);

    ctx.fillStyle = `hsl(${120 * percent}, 100%, 50%)`; // Color changes from Red (0) to Green (120) based on progress
    ctx.fillRect(barX, barY, barWidth * percent, barHeight);

    // Border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw Items
    ctx.font = '40px Arial';
    for (let item of items) {
        ctx.fillText(item.emoji, item.x, item.y + 35);
    }

    // Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.globalAlpha = p.life / 30;
        ctx.fillText(p.char, p.x, p.y);
        ctx.globalAlpha = 1;

        if (p.life <= 0) particles.splice(i, 1);
    }

    animationId = requestAnimationFrame(loop);
}

function loop() {
    update();
    draw();
}

// Game Flow Control
function startGame() {
    const name = nameInput.value.trim();
    if (!name) {
        alert("이름을 입력해주세요! 😊");
        return;
    }
    localStorage.setItem('lastPlayerName', name);

    // Cancel existing loop if any
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameState = 'PLAYING';
    score = 0;
    level = 1;
    lives = 3;
    speedMultiplier = 1;
    currentLevelStartScore = 0; // Reset for level 1
    nextLevelScore = 150; // Initial goal
    items.length = 0;
    particles.length = 0;

    // Reset Competitive Stats
    combo = 0;
    maxCombo = 0;
    currentTier = '브론즈';

    checkTier(); // Reset UI
    updateComboUI();
    updateUI();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    // stageClearScreen is removed

    // Player position reset
    player.x = canvas.width / 2 - player.width / 2;

    loop();
}

function endGame() {
    // Stop the loop
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameState = 'GAMEOVER';
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');

    saveScore(score);
    updateLeaderboardDisplay(); // Update display for next time

    // Game Over Shake
    gsap.fromTo(gameOverScreen, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" });
}

// Leaderboard Logic (Firebase)
function saveScore(newScore) {
    const name = nameInput.value.trim() || "익명";

    // Add a new document with a generated id.
    db.collection("leaderboard").add({
        name: name,
        score: newScore,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // For tie-breaking or recent views
    })
        .then((docRef) => {
            console.log("Score written with ID: ", docRef.id);
        })
        .catch((error) => {
            console.error("Error adding score: ", error);
        });
}

function updateLeaderboardDisplay() {
    // Real-time listener
    // Limit to top 5, ordered by score desc
    db.collection("leaderboard")
        .orderBy("score", "desc")
        .limit(5)
        .onSnapshot((querySnapshot) => {
            const scores = [];
            querySnapshot.forEach((doc) => {
                scores.push(doc.data());
            });

            // Fill up to 5 if empty (visual placeholder)
            while (scores.length < 5) {
                scores.push({ name: "???", score: 0 });
            }

            leaderboardList.innerHTML = scores.map((s, i) =>
                `<li>${i + 1}. ${s.name} - ${s.score}점</li>`
            ).join('');
        });
}

// Initialize leaderboard listener immediately
updateLeaderboardDisplay();

// Load saved name
const savedName = localStorage.getItem('lastPlayerName');
if (savedName) {
    nameInput.value = savedName;
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    // Clear canvas to remove lingering visuals
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    items.length = 0;
    particles.length = 0;

    // Show start screen again to see leaderboard
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');

    // Only update UI, let startGame handle the rest when clicked
    updateLeaderboardDisplay();
});
// nextLevelBtn listener removed

// Initial Draw
resizeCanvas();
updateUI();
updateLeaderboardDisplay();
