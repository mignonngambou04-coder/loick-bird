// ==========================================
// 1. CONFIGURATION, ACCUEIL & ÉTATS
// ==========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const statsBtn = document.getElementById("stats-btn");
const statsPanel = document.getElementById("stats-panel");
const closeStatsBtn = document.getElementById("close-stats-btn");
const gameOverPanel = document.getElementById("game-over-panel");
const themeToggle = document.getElementById("theme-toggle");

const highScoreText = document.getElementById("high-score-text");
const finalScoreText = document.getElementById("final-score-text");
const medalContainer = document.getElementById("medal-container");
const medalName = document.getElementById("medal-name");
const retryBtn = document.getElementById("retry-btn");

let gameRunning = false;
let score = 0;
let frameCount = 0;
let currentSpeed = 2;
const baseSpeed = 2;

let flashAlpha = 0;
let scoreFlashAlpha = 0;
const particles = [];
const clouds = [];

// ==========================================
// 2. BACKEND LOCAL : SYSTÈME DE STATS & SKINS
// ==========================================
let stats = JSON.parse(localStorage.getItem("loickBirdStats")) || {
    highScore: 0,
    gamesPlayed: 0,
    totalPipes: 0,
    goldMedals: 0
};
let activeSkin = "green"; // Choix de l'oiseau au départ

function updateStatsUI() {
    highScoreText.innerText = `Meilleur Score : ${stats.highScore}`;
    document.getElementById("stat-games").innerText = stats.gamesPlayed;
    document.getElementById("stat-pipes").innerText = stats.totalPipes;
    document.getElementById("stat-golds").innerText = stats.goldMedals;
    
    const goldCard = document.getElementById("gold-skin-card");
    if (stats.highScore >= 15) {
        goldCard.classList.remove("locked");
        goldCard.querySelector(".skin-preview").innerText = "🟨";
    }
}

document.querySelectorAll(".skin-card").forEach(card => {
    card.addEventListener("click", () => {
        if (card.classList.contains("locked")) return;
        document.querySelectorAll(".skin-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        activeSkin = card.dataset.skin;
    });
});

let isDarkMode = localStorage.getItem("darkMode") === "true";
if (isDarkMode) {
    document.body.setAttribute("data-theme", "dark");
    themeToggle.innerText = "☀️";
}
themeToggle.addEventListener("click", () => {
    isDarkMode = !isDarkMode;
    document.body.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    themeToggle.innerText = isDarkMode ? "☀️" : "🌙";
    localStorage.setItem("darkMode", isDarkMode);
});

statsBtn.addEventListener("click", () => { startScreen.classList.add("hidden"); statsPanel.classList.remove("hidden"); });
closeStatsBtn.addEventListener("click", () => { statsPanel.classList.add("hidden"); startScreen.classList.remove("hidden"); });

// ==========================================
// 3. SYNTHÉTISEUR AUDIO RETRO
// ==========================================
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === "jump") {
        osc.type = "square"; osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.08, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === "point") {
        osc.type = "triangle"; osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gainNode.gain.setValueAtTime(0.12, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === "crash") {
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.4);
        gainNode.gain.setValueAtTime(0.18, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    }
}

// ==========================================
// 4. MOTEUR GRAPHIQUE (PARALLAXE & PARTICULES)
// ==========================================
function generateClouds() {
    if (frameCount % 120 === 0 && clouds.length < 5) {
        clouds.push({
            x: canvas.width + 50,
            y: Math.random() * 140 + 40,
            width: Math.random() * 50 + 40,
            height: Math.random() * 15 + 12,
            speed: Math.random() * 0.3 + 0.15
        });
    }
}

function updateAndDrawClouds() {
    ctx.fillStyle = isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)";
    clouds.forEach((c, i) => {
        if (gameRunning) c.x -= c.speed;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.height, 0, Math.PI * 2);
        ctx.arc(c.x + c.width * 0.4, c.y - c.height * 0.2, c.height * 1.2, 0, Math.PI * 2);
        ctx.arc(c.x + c.width * 0.7, c.y, c.height * 0.9, 0, Math.PI * 2);
        ctx.fill();
        if (c.x + c.width < -50) clouds.splice(i, 1);
    });
}

function createParticle(x, y) {
    particles.push({
        x: x, y: y,
        size: Math.random() * 4 + 2,
        speedX: -(Math.random() * 1 + 1),
        speedY: (Math.random() * 0.8 - 0.4),
        alpha: 1
    });
}

function updateAndDrawParticles() {
    particles.forEach((p, i) => {
        p.x += p.speedX; p.y += p.speedY; p.alpha -= 0.025;
        ctx.fillStyle = isDarkMode ? `rgba(168, 85, 247, ${p.alpha})` : `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        if (p.alpha <= 0) particles.splice(i, 1);
    });
}

// ==========================================
// 5. RENDU DU VÉRITABLE OISEAU ANIMÉ (SKINS)
// ==========================================
const bird = {
    x: 60, y: 240,
    width: 38, height: 38,
    gravity: 0.26, jump: -5.4, velocity: 0, flapTimer: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        // Inclinaison dynamique de l'oiseau selon la chute
        let angle = Math.min(Math.PI / 3, Math.max(-Math.PI / 7, this.velocity * 0.08));
        ctx.rotate(angle);
        
        let w = this.width;
        
        // 1. Détermination de la couleur du corps de l'oiseau
        if (activeSkin === "retro") {
            ctx.fillStyle = "#ef4444"; // Oiseau Rouge
            ctx.strokeStyle = "#991b1b";
        } else if (activeSkin === "gold") {
            ctx.fillStyle = "#fbbf24"; // Oiseau d'Or
            ctx.strokeStyle = "#b45309";
        } else {
            ctx.fillStyle = isDarkMode ? "#a855f7" : "#2ecc71"; // Oiseau Vert (ou Violet en Dark mode)
            ctx.strokeStyle = isDarkMode ? "#c084fc" : "#27ae60";
        }
        ctx.lineWidth = 2.5;
        
        // 2. CORPS DE L'OISEAU (Rond/Ovale)
        ctx.beginPath();
        ctx.arc(0, 0, w / 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 3. L'ŒIL & LA PUPILLE
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(5, -5, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.beginPath(); ctx.arc(6, -5, 2, 0, Math.PI * 2); ctx.fill();
        
        // 4. LE BEC (Orange)
        ctx.fillStyle = "#f97316";
        ctx.strokeStyle = "#c2410c";
        ctx.beginPath();
        ctx.moveTo(w / 2.2 - 2, -2);
        ctx.lineTo(w / 2.2 + 9, 2);
        ctx.lineTo(w / 2.2 - 2, 6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        
        // 5. L'AILE ANIMÉE (Batement d'aile lors du saut)
        if (activeSkin === "retro") ctx.fillStyle = "#fca5a5";
        else if (activeSkin === "gold") ctx.fillStyle = "#fef08a";
        else ctx.fillStyle = isDarkMode ? "#e9d5ff" : "#a7f3d0";
        
        ctx.save();
        ctx.beginPath();
        // Si le flapTimer est actif, l'aile remonte vers le haut (animation de vol)
        let wingHeight = (this.flapTimer > 0) ? -4 : 4;
        ctx.ellipse(-5, wingHeight, 7, (this.flapTimer > 0) ? 4 : 8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        if (this.flapTimer > 0) this.flapTimer--;
        
        ctx.restore();
    },
    update() {
        this.velocity += this.gravity; this.y += this.velocity;
        if (frameCount % 2 === 0 && gameRunning) createParticle(this.x, this.y + this.height / 2);
        if (this.y + this.height > canvas.height) triggerGameOverEffect();
        if (this.y < 0) { this.y = 0; this.velocity = 0; }
    },
    flap() { this.velocity = this.jump; this.flapTimer = 8; playSound("jump"); }
};

// ==========================================
// 6. LES ENNEMIS / LES BARRIÈRES (TUYAUX)
// ==========================================
const pipes = [];
const pipeWidth = 56;
const pipeGap = 125;

function generatePipes() {
    const dynamicInterval = Math.max(65, Math.floor(190 / currentSpeed));
    if (frameCount % dynamicInterval === 0) {
        const minH = 60; const maxH = canvas.height - pipeGap - minH;
        const topH = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
        pipes.push({ x: canvas.width, top: topH, bottom: canvas.height - topH - pipeGap, passed: false });
    }
}

function updateAndDrawPipes() {
    pipes.forEach((p, i) => {
        if (gameRunning) p.x -= currentSpeed;
        ctx.fillStyle = isDarkMode ? "#a855f7" : "#10b981";
        ctx.strokeStyle = isDarkMode ? "#c084fc" : "#047857";
        ctx.lineWidth = 3;
        
        ctx.fillRect(p.x, 0, pipeWidth, p.top); ctx.strokeRect(p.x, 0, pipeWidth, p.top);
        ctx.fillRect(p.x, canvas.height - p.bottom, pipeWidth, p.bottom); ctx.strokeRect(p.x, canvas.height - p.bottom, pipeWidth, p.bottom);
        
        if (!p.passed && p.x + pipeWidth < bird.x) {
            score++; p.passed = true; scoreFlashAlpha = 0.35; playSound("point");
            currentSpeed = baseSpeed + (score * 0.15);
        }
        if (bird.x < p.x + pipeWidth && bird.x + bird.width > p.x && (bird.y < p.top || bird.y + bird.height > canvas.height - p.bottom)) {
            triggerGameOverEffect();
        }
        if (p.x + pipeWidth < 0) pipes.splice(i, 1);
    });
}

// ==========================================
// 7. SYSTÈME DE RENDU GÉNÉRAL (MAIN LOOP)
// ==========================================
function drawScore() {
    ctx.fillStyle = "#ffffff";
    ctx.font = (scoreFlashAlpha > 0) ? "bold 26px sans-serif" : "bold 22px sans-serif";
    ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.fillText(`SCORE: ${score}`, 25, 45);
    ctx.shadowBlur = 0;
}

function drawFlashEffects() {
    if (flashAlpha > 0) { ctx.fillStyle = `rgba(239, 68, 68, ${flashAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); flashAlpha -= 0.08; }
    if (scoreFlashAlpha > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${scoreFlashAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); scoreFlashAlpha -= 0.06; }
}

function gameLoop() {
    if (!gameRunning && flashAlpha <= 0) { processGameOver(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (isDarkMode) { skyGrad.addColorStop(0, "#1e1b4b"); skyGrad.addColorStop(1, "#311042"); }
    else { skyGrad.addColorStop(0, "#bae6fd"); skyGrad.addColorStop(1, "#7dd3fc"); }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    generateClouds(); updateAndDrawClouds();
    if (gameRunning) { bird.update(); generatePipes(); }
    updateAndDrawPipes(); updateAndDrawParticles();
    bird.draw(); drawScore(); drawFlashEffects();
    
    frameCount++; requestAnimationFrame(gameLoop);
}

// ==========================================
// 8. INTERACTION, ENREGISTREMENTS & TRIGGERS
// ==========================================
function startGame() {
    initAudio();
    startScreen.classList.add("hidden"); gameOverPanel.classList.add("hidden");
    
    gameRunning = true; score = 0; frameCount = 0; currentSpeed = baseSpeed;
    flashAlpha = 0; scoreFlashAlpha = 0;
    pipes.length = 0; particles.length = 0; clouds.length = 0;
    bird.y = 240; bird.velocity = 0;
    
    gameLoop();
}

function triggerGameOverEffect() { if (gameRunning) { gameRunning = false; flashAlpha = 0.55; playSound("crash"); } }

function processGameOver() {
    stats.gamesPlayed++;
    stats.totalPipes += score;
    if (score > stats.highScore) stats.highScore = score;
    
    if (score >= 15) {
        medalContainer.innerText = "🥇"; medalName.innerText = "Rang : Divinité de l'Arcade";
        medalName.style.color = "#fbbf24"; stats.goldMedals++;
    } else if (score >= 7) {
        medalContainer.innerText = "🥈"; medalName.innerText = "Rang : Challenger Élite";
        medalName.style.color = "#94a3b8";
    } else {
        medalContainer.innerText = "🥉"; medalName.innerText = "Rang : Recrue";
        medalName.style.color = "#b45309";
    }
    
    localStorage.setItem("loickBirdStats", JSON.stringify(stats));
    updateStatsUI();
    
    finalScoreText.innerText = `Score Final : ${score}`;
    gameOverPanel.classList.remove("hidden");
}

window.addEventListener("keydown", (e) => { if (e.code === "Space" && gameRunning) { bird.flap(); e.preventDefault(); } });
canvas.addEventListener("click", () => { initAudio(); if (gameRunning) bird.flap(); });
startBtn.addEventListener("click", startGame); retryBtn.addEventListener("click", startGame);

updateStatsUI();