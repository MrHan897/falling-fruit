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

// Elements
const scoreEl = document.getElementById('score');
const targetScoreEl = document.getElementById('target-score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const stageClearScreen = document.getElementById('stage-clear-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const restartBtn = document.getElementById('restart-btn');
const nameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

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
            items.splice(i, 1);
        }
    }

    // Check Level Up
    if (score >= nextLevelScore) {
        stageClear();
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
        score += item.score;
        createParticles(item.x, item.y, '✨'); // Sparkle effect
    } else if (item.type === 'villain') {
        lives -= item.damage;
        createParticles(item.x, item.y, '👿');
        canvas.style.transform = 'translate(10px, 10px)'; // Stronger shake
        setTimeout(() => canvas.style.transform = 'translate(0, 0)', 150);
    } else {
        lives -= item.damage;
        createParticles(item.x, item.y, '💥'); // Explosion effect
        // Screen shake effect
        canvas.style.transform = 'translate(5px, 5px)';
        setTimeout(() => canvas.style.transform = 'translate(0, 0)', 100);
    }

    updateUI();

    if (lives <= 0) {
        endGame();
    }
}

function stageClear() {
    gameState = 'LEVEL_TRANSITION';
    createParticles(canvas.width / 2, canvas.height / 2, '🎉');
    stageClearScreen.classList.remove('hidden');
}

function nextLevel() {
    level++;
    currentLevelStartScore = nextLevelScore; // Set start score for new level
    nextLevelScore += 100 + (level * 20); // Slightly increasing gap
    speedMultiplier += 0.05;

    // Clear items so level starts fresh
    items.length = 0;

    // Resume Game
    stageClearScreen.classList.add('hidden');
    gameState = 'PLAYING';
    updateUI();
}

function updateUI() {
    scoreEl.innerText = score;
    targetScoreEl.innerText = nextLevelScore;
    livesEl.innerText = lives;
    levelEl.innerText = level;
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

    gameState = 'PLAYING';
    score = 0;
    level = 1;
    lives = 3;
    speedMultiplier = 1;
    currentLevelStartScore = 0; // Reset for level 1
    nextLevelScore = 150; // Initial goal
    items.length = 0;
    particles.length = 0;
    updateUI();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    stageClearScreen.classList.add('hidden');

    // Player position reset
    player.x = canvas.width / 2 - player.width / 2;

    // Stop any existing loop before starting a new one
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    loop();
}

function endGame() {
    gameState = 'GAMEOVER';
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');

    saveScore(score);
    updateLeaderboardDisplay(); // Update display for next time
}

// Leaderboard Logic
function saveScore(newScore) {
    const name = nameInput.value.trim() || "익명";
    let scores = JSON.parse(localStorage.getItem('fallingFruitScores')) || [];

    scores.push({ name: name, score: newScore });
    scores.sort((a, b) => b.score - a.score); // Sort descending
    scores = scores.slice(0, 5); // Keep top 5

    localStorage.setItem('fallingFruitScores', JSON.stringify(scores));
}

function updateLeaderboardDisplay() {
    let scores = JSON.parse(localStorage.getItem('fallingFruitScores')) || [];

    // Fill up to 5 if empty
    while (scores.length < 5) {
        scores.push({ name: "???", score: 0 });
    }

    leaderboardList.innerHTML = scores.map((s, i) =>
        `<li>${i + 1}. ${s.name} - ${s.score}점</li>`
    ).join('');
}

// Load saved name
const savedName = localStorage.getItem('lastPlayerName');
if (savedName) {
    nameInput.value = savedName;
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    // Show start screen again to see leaderboard
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');

    // Only update UI, let startGame handle the rest when clicked
    updateLeaderboardDisplay();
});
nextLevelBtn.addEventListener('click', nextLevel);

// Initial Draw
resizeCanvas();
updateUI();
updateLeaderboardDisplay();
