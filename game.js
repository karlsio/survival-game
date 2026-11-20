const canvas = document.getElementById("world");
const context = canvas.getContext("2d");

const healthElement = document.getElementById("health");
const woodElement = document.getElementById("wood");
const stoneElement = document.getElementById("stone");
const levelElement = document.getElementById("level");
const xpElement = document.getElementById("xp");
const xpNeededElement = document.getElementById("xp-needed");
const killsElement = document.getElementById("kills");
const roundElement = document.getElementById("round");
const timerElement = document.getElementById("timer");
const enemyPowerElement = document.getElementById("enemy-power");
const monsterTypesElement = document.getElementById("monster-types");
const messageElement = document.getElementById("message");

const keys = new Set();
const resources = [];
const enemies = [];
const evolutionNames = ["新生者", "探險者", "荒野獵人", "守護者"];
const worldWidth = 2400;
const worldHeight = 1500;
let cameraX = 0;
let cameraY = 0;

let player;
let attackReady = true;
let lastResourceRespawn = 0;
let evolutionRoute = null;
let routeSelectionOpen = false;
let skillSelectionOpen = false;
let pendingEvolutionRoute = false;
let roundNumber = 1;
let roundTransition = false;
let elapsedMilliseconds = 0;
let lastTimerTimestamp = 0;
let timerRunning = false;
let manuallyPaused = false;
let enemyPowerMultiplier = 1;
let lastEnemyPowerMinute = 0;
let unlockedMonsterTypes = 2;
let lastMonsterUnlockMinute = 0;

function randomPosition(padding = 30) {
  return {
    x: padding + Math.random() * (worldWidth - padding * 2),
    y: padding + Math.random() * (worldHeight - padding * 2),
  };
}

function xpNeeded(level) {
  return level * 100;
}

function createResources(count = 12) {
  for (let i = resources.length; i < count; i += 1) {
    resources.push({
      ...randomPosition(),
      type: i % 2 === 0 ? "wood" : "stone",
      size: 12,
    });
  }
}

function createEnemies(count = 3) {
  for (let i = 0; i < count; i += 1) {
    const baseHealth = 40 + player.level * 15;
    const baseSpeed = 0.7 + Math.random() * 0.5 + player.level * 0.08;
    const baseDamage = 0.25;
    enemies.push({
      ...randomPosition(),
      size: 14,
      baseHealth,
      baseSpeed,
      baseDamage,
      speed: baseSpeed * enemyPowerMultiplier,
      health: baseHealth * enemyPowerMultiplier,
      maxHealth: baseHealth * enemyPowerMultiplier,
      damage: baseDamage * enemyPowerMultiplier,
      monsterType: randomUnlockedMonsterType(),
      facing: Math.random() < 0.5 ? -1 : 1,
      hitUntil: 0,
      attackingUntil: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function enemyCountForRound() {
  return 2 + roundNumber;
}

function randomUnlockedMonsterType() {
  const types = ["fang", "slime"];
  if (unlockedMonsterTypes >= 3) types.push("fire");
  if (unlockedMonsterTypes >= 4) types.push("beetle");
  return types[Math.floor(Math.random() * types.length)];
}

function unlockMonsterTypes() {
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60000);
  const unlockMinute = elapsedMinutes - (elapsedMinutes % 3);
  const nextTypes = 2 + Math.floor(unlockMinute / 3);
  const unlockedCount = Math.min(4, nextTypes);

  if (unlockedCount > unlockedMonsterTypes) {
    unlockedMonsterTypes = unlockedCount;
    lastMonsterUnlockMinute = unlockMinute;
    const names = ["牙怪", "史萊姆怪", "火焰蜥", "機甲甲蟲"];
    setMessage(`怪物庫解鎖「${names[unlockedMonsterTypes - 1]}」！共可出現 ${unlockedMonsterTypes} 款怪物。`);
  }

  updateInterface();
}

function startNextRound() {
  if (roundTransition) return;
  roundTransition = true;
  roundNumber += 1;
  updateInterface();
  setMessage(`第 ${roundNumber} 回合！怪物增加為 ${enemyCountForRound()} 隻！`);

  window.setTimeout(() => {
    createEnemies(enemyCountForRound());
    roundTransition = false;
  }, 800);
}

function resetGame() {
  player = {
    x: worldWidth / 2,
    y: worldHeight / 2,
    size: 15,
    speed: 3,
    health: 100,
    maxHealth: 100,
    wood: 0,
    stone: 0,
    xp: 0,
    level: 1,
    kills: 0,
    damage: 35,
    attackRange: 55,
    facing: 1,
    attackCooldown: 280,
    xpBonus: 1,
    moving: false,
    attackingUntil: 0,
    damagedUntil: 0,
  };
  attackReady = true;
  evolutionRoute = null;
  routeSelectionOpen = false;
  skillSelectionOpen = false;
  pendingEvolutionRoute = false;
  roundNumber = 1;
  roundTransition = false;
  elapsedMilliseconds = 0;
  lastTimerTimestamp = performance.now();
  timerRunning = true;
  manuallyPaused = false;
  enemyPowerMultiplier = 1;
  unlockedMonsterTypes = 2;
  lastMonsterUnlockMinute = 0;
  lastEnemyPowerMinute = 0;
  document.getElementById("pause-screen").hidden = true;
  document.getElementById("pause").textContent = "暫停";
  resources.length = 0;
  enemies.length = 0;
  createResources();
  createEnemies(enemyCountForRound());
  updateCamera();
  setMessage("收集資源、進入敵人範圍即可自動攻擊；經驗可讓角色進化！");
  updateInterface();
}

function setMessage(text) {
  messageElement.textContent = text;
}

function updateInterface() {
  healthElement.textContent = Math.max(0, Math.ceil(player.health));
  woodElement.textContent = player.wood;
  stoneElement.textContent = player.stone;
  levelElement.textContent = player.level;
  xpElement.textContent = player.xp;
  xpNeededElement.textContent = xpNeeded(player.level);
  killsElement.textContent = player.kills;
  roundElement.textContent = roundNumber;
  timerElement.textContent = formatTime(elapsedMilliseconds);
  enemyPowerElement.textContent = `×${enemyPowerMultiplier.toFixed(2)}`;
  monsterTypesElement.textContent = unlockedMonsterTypes;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function strengthenEnemies() {
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60000);
  if (elapsedMinutes <= lastEnemyPowerMinute) return;

  lastEnemyPowerMinute = elapsedMinutes;
  enemyPowerMultiplier = 1 + elapsedMinutes * 0.1;

  for (const enemy of enemies) {
    const healthRatio = enemy.health / enemy.maxHealth;
    enemy.speed = enemy.baseSpeed * enemyPowerMultiplier;
    enemy.maxHealth = enemy.baseHealth * enemyPowerMultiplier;
    enemy.health = enemy.maxHealth * healthRatio;
    enemy.damage = enemy.baseDamage * enemyPowerMultiplier;
  }

  setMessage(`怪物在第 ${elapsedMinutes} 分鐘增強！基礎數值提升至 ${enemyPowerMultiplier.toFixed(2)} 倍。`);
  updateInterface();
}


function gainXp(amount) {
  player.xp += amount * player.xpBonus;

  while (player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    evolve();
  }
  updateInterface();
}

function getEvolutionName() {
  if (evolutionRoute === "flame") {
    if (player.level >= 15) return "焚界火龍";
    if (player.level >= 12) return "烈焰龍";
    return "火焰龍";
  }
  if (evolutionRoute === "machine") {
    if (player.level >= 15) return "鋼翼機龍";
    if (player.level >= 12) return "機甲龍";
    return "機械龍";
  }
  if (evolutionRoute === "light") {
    if (player.level >= 15) return "天光聖龍";
    if (player.level >= 12) return "聖光龍";
    return "光明龍";
  }
  return evolutionNames[player.level - 1] || `進化體 ${player.level}`;
}

function evolve() {
  player.level += 1;
  player.damage += 12;
  player.attackRange += 8;
  player.maxHealth += 20;
  player.health = player.maxHealth;
  player.speed = Math.min(4.8, player.speed + 0.2);

  const name = getEvolutionName();
  setMessage(`進化成功！你成為「${name}」，攻擊與生命上限提升！`);

  pendingEvolutionRoute = player.level === 10 && evolutionRoute === null;
  openSkillSelection();
}

const skillCatalog = [
  {
    id: "damage",
    name: "力量",
    description: "攻擊力＋20",
  },
  {
    id: "range",
    name: "長距攻擊",
    description: "攻擊範圍＋18",
  },
  {
    id: "speed",
    name: "迅捷",
    description: "移動速度＋0.35",
  },
  {
    id: "health",
    name: "生命強化",
    description: "生命上限＋40",
  },
  {
    id: "attack-speed",
    name: "連擊",
    description: "攻擊冷卻－45 毫秒",
  },
  {
    id: "xp",
    name: "經驗專精",
    description: "獲得經驗＋25%",
  },
];

function getRandomSkills() {
  const choices = [...skillCatalog];
  const selected = [];
  while (selected.length < 3) {
    const index = Math.floor(Math.random() * choices.length);
    selected.push(choices.splice(index, 1)[0]);
  }
  return selected;
}

function openSkillSelection() {
  skillSelectionOpen = true;
  const optionsElement = document.getElementById("skill-options");
  optionsElement.replaceChildren();

  getRandomSkills().forEach((skill) => {
    const button = document.createElement("button");
    button.dataset.skill = skill.id;
    button.innerHTML = `${skill.name}<br><small>${skill.description}</small>`;
    optionsElement.appendChild(button);
  });

  document.getElementById("skill-selection").hidden = false;
}

function applySkill(skillId) {
  if (skillId === "damage") player.damage += 20;
  if (skillId === "range") player.attackRange += 18;
  if (skillId === "speed") player.speed = Math.min(6, player.speed + 0.35);
  if (skillId === "health") {
    player.maxHealth += 40;
    player.health = player.maxHealth;
  }
  if (skillId === "attack-speed") {
    player.attackCooldown = Math.max(100, player.attackCooldown - 45);
  }
  if (skillId === "xp") player.xpBonus += 0.25;

  skillSelectionOpen = false;
  document.getElementById("skill-selection").hidden = true;
  setMessage("技能已選擇：繼續冒險！");
  updateInterface();

  if (pendingEvolutionRoute) {
    pendingEvolutionRoute = false;
    routeSelectionOpen = true;
    document.getElementById("evolution-route").hidden = false;
  }
}

function movePlayer() {
  player.moving = false;
  if (keys.has("arrowleft") || keys.has("a")) {
    player.x -= player.speed;
    player.facing = -1;
    player.moving = true;
  }
  if (keys.has("arrowright") || keys.has("d")) {
    player.x += player.speed;
    player.facing = 1;
    player.moving = true;
  }
  if (keys.has("arrowup") || keys.has("w")) {
    player.y -= player.speed;
    player.moving = true;
  }
  if (keys.has("arrowdown") || keys.has("s")) {
    player.y += player.speed;
    player.moving = true;
  }

  player.x = Math.max(player.size, Math.min(worldWidth - player.size, player.x));
  player.y = Math.max(player.size, Math.min(worldHeight - player.size, player.y));
}

function updateCamera() {
  cameraX = Math.max(0, Math.min(worldWidth - canvas.width, player.x - canvas.width / 2));
  cameraY = Math.max(0, Math.min(worldHeight - canvas.height, player.y - canvas.height / 2));
}

function collectResources() {
  for (let i = resources.length - 1; i >= 0; i -= 1) {
    const resource = resources[i];
    const dx = player.x - resource.x;
    const dy = player.y - resource.y;

    if (Math.hypot(dx, dy) < player.size + resource.size) {
      player[resource.type] += 1;
      resources.splice(i, 1);
      gainXp(resource.type === "wood" ? 12 : 15);
      setMessage(`收集到${resource.type === "wood" ? "木材" : "石頭"}！獲得經驗。`);
    }
  }
  updateInterface();
}

function attack() {
  if (!attackReady || player.health <= 0) return;
  attackReady = false;
  player.attackingUntil = performance.now() + 180;

  let hitCount = 0;
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (distance <= player.attackRange) {
      enemy.health -= player.damage;
      hitCount += 1;

      if (enemy.health <= 0) {
        enemies.splice(i, 1);
        player.kills += 1;
        gainXp(25);
        setMessage("擊敗敵人！獲得 25 點經驗。");
      } else {
        enemy.hitUntil = performance.now() + 140;
      }
    }
  }
  if (enemies.length === 0) startNextRound();
  if (hitCount === 0) attackReady = true;
  updateInterface();

  if (hitCount > 0) {
    window.setTimeout(() => {
      attackReady = true;
    }, player.attackCooldown);
  }
}

function moveEnemies() {
  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      enemy.x += (dx / distance) * enemy.speed;
      enemy.y += (dy / distance) * enemy.speed;
      enemy.facing = dx >= 0 ? 1 : -1;
    }

    if (distance < player.size + enemy.size) {
      enemy.attackingUntil = performance.now() + 180;
      player.health -= enemy.damage;
      player.damagedUntil = performance.now() + 120;
      updateInterface();

      if (player.health <= 0) {
        player.health = 0;
        timerRunning = false;
        setMessage("你已倒下。按重新開始再試一次！");
      }
    }
  }
}

function respawnWorld(timestamp) {
  if (timestamp - lastResourceRespawn > 5000) {
    if (resources.length < 8) createResources(8);
    lastResourceRespawn = timestamp;
  }
}

function drawHealthBar(enemy) {
  const width = enemy.size * 2;
  context.fillStyle = "#351313";
  context.fillRect(enemy.x - width / 2, enemy.y - enemy.size - 9, width, 4);
  context.fillStyle = "#ef6969";
  context.fillRect(
    enemy.x - width / 2,
    enemy.y - enemy.size - 9,
    width * Math.max(0, enemy.health / enemy.maxHealth),
    4,
  );
}

function drawFangMonster(enemy) {
  const now = performance.now();
  const hit = now < enemy.hitUntil;
  const attacking = now < enemy.attackingUntil;
  const bob = Math.sin(now / 140 + enemy.phase) * 2;
  context.save();
  context.translate(enemy.x, enemy.y);
  context.scale(enemy.facing, 1);
  context.translate(0, bob);
  if (hit) context.globalAlpha = 0.45;
  if (attacking) context.scale(1.12, 0.92);

  context.fillStyle = "#7a4a78";
  context.strokeStyle = "#3d2740";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 2, enemy.size, enemy.size * 0.9, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#d8b6d4";
  context.beginPath();
  context.moveTo(-9, -5);
  context.lineTo(-5, -14);
  context.lineTo(-2, -5);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(9, -5);
  context.lineTo(5, -14);
  context.lineTo(2, -5);
  context.closePath();
  context.fill();

  context.fillStyle = "#f0e9a8";
  context.beginPath();
  context.arc(-5, -1, 2.5, 0, Math.PI * 2);
  context.arc(5, -1, 2.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#1f171f";
  context.beginPath();
  context.arc(-5, -1, 1.2, 0, Math.PI * 2);
  context.arc(5, -1, 1.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f2f0e6";
  context.beginPath();
  context.moveTo(-4, 5);
  context.lineTo(-1, 11);
  context.lineTo(1, 5);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(4, 5);
  context.lineTo(1, 11);
  context.lineTo(-1, 5);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSlimeMonster(enemy) {
  const now = performance.now();
  const hit = now < enemy.hitUntil;
  const attacking = now < enemy.attackingUntil;
  const pulse = 1 + Math.sin(now / 110 + enemy.phase) * 0.08;
  context.save();
  context.translate(enemy.x, enemy.y);
  context.scale(enemy.facing * (attacking ? 1.12 : pulse), attacking ? 0.88 : 1 / pulse);
  context.translate(0, -Math.abs(Math.sin(now / 110 + enemy.phase)) * 3);
  if (hit) context.globalAlpha = 0.45;

  context.fillStyle = "#55b9a7";
  context.strokeStyle = "#28766b";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-enemy.size, 10);
  context.quadraticCurveTo(-enemy.size - 2, -9, -4, -enemy.size);
  context.quadraticCurveTo(8, -15, enemy.size, 2);
  context.quadraticCurveTo(enemy.size + 3, 12, -enemy.size, 10);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#d9fff4";
  context.beginPath();
  context.ellipse(-5, -5, 4, 5, 0, 0, Math.PI * 2);
  context.ellipse(6, -4, 3.5, 4.5, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#173a35";
  context.beginPath();
  context.arc(-5, -4, 1.5, 0, Math.PI * 2);
  context.arc(6, -3, 1.5, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawFireMonster(enemy) {
  const now = performance.now();
  const hit = now < enemy.hitUntil;
  const attacking = now < enemy.attackingUntil;
  const wag = Math.sin(now / 100 + enemy.phase) * 3;

  context.save();
  context.translate(enemy.x, enemy.y);
  context.scale(enemy.facing, 1);
  if (hit) context.globalAlpha = 0.45;

  context.fillStyle = "#df5a2b";
  context.strokeStyle = "#792a20";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 4, enemy.size, enemy.size * 0.85, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#ffb34b";
  context.beginPath();
  context.moveTo(-8, -7);
  context.quadraticCurveTo(-18, -22 - wag, -4, -18);
  context.quadraticCurveTo(6, -29 + wag, 9, -8);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffe478";
  context.beginPath();
  context.arc(-5, -3, 2.5, 0, Math.PI * 2);
  context.arc(5, -3, 2.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#351811";
  context.beginPath();
  context.arc(-5, -3, 1.2, 0, Math.PI * 2);
  context.arc(5, -3, 1.2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffd66a";
  context.lineWidth = attacking ? 5 : 2;
  context.beginPath();
  context.moveTo(10, 5);
  context.quadraticCurveTo(25 + (attacking ? 10 : 0), 8 + wag, 19, -4);
  context.stroke();
  context.restore();
}

function drawBeetleMonster(enemy) {
  const now = performance.now();
  const hit = now < enemy.hitUntil;
  const attacking = now < enemy.attackingUntil;
  const stride = Math.sin(now / 120 + enemy.phase) * 3;

  context.save();
  context.translate(enemy.x, enemy.y);
  context.scale(enemy.facing, 1);
  if (hit) context.globalAlpha = 0.45;

  context.fillStyle = "#26384e";
  context.strokeStyle = "#111925";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 3, enemy.size + 4, enemy.size, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#55a1ba";
  context.beginPath();
  context.moveTo(-12, -5);
  context.lineTo(-4, -18);
  context.lineTo(5, -16);
  context.lineTo(12, -4);
  context.lineTo(7, 8);
  context.lineTo(-8, 8);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "#9ac8d7";
  context.lineWidth = 3;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(side * 8, 7);
    context.lineTo(side * (16 + (attacking ? 5 : 0)), 17 + stride);
    context.lineTo(side * 21, 24);
    context.moveTo(side * 8, -2);
    context.lineTo(side * 20, -11 - stride);
    context.stroke();
  }

  context.fillStyle = "#ffcf58";
  context.beginPath();
  context.arc(-5, -8, 2.5, 0, Math.PI * 2);
  context.arc(5, -8, 2.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEnemy(enemy) {
  if (enemy.monsterType === "slime") drawSlimeMonster(enemy);
  else if (enemy.monsterType === "fire") drawFireMonster(enemy);
  else if (enemy.monsterType === "beetle") drawBeetleMonster(enemy);
  else drawFangMonster(enemy);
}

function drawWingEvolution(now, walking, attacking, hit) {
  const wingBeat = Math.sin(now / 180) * 4;
  const armor = [
    "#dceeff",
    "#73cdf6",
    "#147cc2",
    "#07528e",
  ];

  if (hit) context.globalAlpha = 0.45;

  context.fillStyle = "#e7f5ff";
  context.strokeStyle = "#123f70";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-29, -12);
  context.lineTo(-48, -35 - wingBeat);
  context.lineTo(-52, -15);
  context.lineTo(-38, 2);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(29, -12);
  context.lineTo(48, -35 - wingBeat);
  context.lineTo(52, -15);
  context.lineTo(38, 2);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = armor[1];
  context.beginPath();
  context.ellipse(0, 4, 23, 29, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = armor[2];
  context.beginPath();
  context.moveTo(-16, -19);
  context.lineTo(-8, -38);
  context.lineTo(0, -22);
  context.lineTo(9, -38);
  context.lineTo(17, -18);
  context.lineTo(11, 10);
  context.lineTo(-11, 10);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#e9fbff";
  context.beginPath();
  context.moveTo(-8, -16);
  context.lineTo(0, -27);
  context.lineTo(9, -15);
  context.lineTo(5, 8);
  context.lineTo(-6, 8);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(-17, -26);
  context.lineTo(-30, -38);
  context.lineTo(-18, -18);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(17, -26);
  context.lineTo(30, -38);
  context.lineTo(18, -18);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#79e45c";
  context.beginPath();
  context.ellipse(-8, -20, 3, 4, 0, 0, Math.PI * 2);
  context.ellipse(8, -20, 3, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#090d18";
  context.beginPath();
  context.arc(-8, -19, 1.5, 0, Math.PI * 2);
  context.arc(8, -19, 1.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#edf3f5";
  context.beginPath();
  context.moveTo(-13, -11);
  context.lineTo(-25, -4);
  context.lineTo(-11, -3);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(13, -11);
  context.lineTo(25, -4);
  context.lineTo(11, -3);
  context.closePath();
  context.fill();

  context.fillStyle = armor[3];
  context.fillRect(-17 - (walking * 2), 23, 10, 18);
  context.fillRect(7 + (walking * 2), 23, 10, 18);
  context.fillStyle = "#d8edf7";
  context.fillRect(-19 - (walking * 2), 38, 14, 6);
  context.fillRect(5 + (walking * 2), 38, 14, 6);

  context.strokeStyle = "#a9d8ef";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-12, -4);
  context.quadraticCurveTo(-23, 5, -19 - (attacking ? 10 : 0), 18);
  context.moveTo(12, -4);
  context.quadraticCurveTo(23, 5, 19 + (attacking ? 10 : 0), 18);
  context.stroke();
}

function drawMachineEvolution(now, walking, attacking, hit) {
  if (hit) context.globalAlpha = 0.45;

  context.fillStyle = "#9ab5c4";
  context.strokeStyle = "#303a42";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-28, -16);
  context.lineTo(-58, -38);
  context.lineTo(-48, -8);
  context.lineTo(-27, 7);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(28, -16);
  context.lineTo(58, -38);
  context.lineTo(48, -8);
  context.lineTo(27, 7);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#3c6f96";
  context.beginPath();
  context.moveTo(-20, -24);
  context.lineTo(-5, -45);
  context.lineTo(8, -24);
  context.lineTo(21, 8);
  context.lineTo(14, 30);
  context.lineTo(-16, 30);
  context.lineTo(-22, 7);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#c92e2e";
  context.beginPath();
  context.moveTo(-13, -18);
  context.lineTo(-31, -29);
  context.lineTo(-22, -8);
  context.lineTo(-12, 4);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(13, -18);
  context.lineTo(31, -29);
  context.lineTo(22, -8);
  context.lineTo(12, 4);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#eef7fa";
  context.beginPath();
  context.moveTo(-11, -27);
  context.lineTo(0, -40);
  context.lineTo(12, -26);
  context.lineTo(7, -8);
  context.lineTo(-7, -8);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#cbdbe2";
  context.beginPath();
  context.moveTo(-18, -8);
  context.lineTo(-34, 4);
  context.lineTo(-26, 25);
  context.lineTo(-12, 17);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(18, -8);
  context.lineTo(34, 4);
  context.lineTo(26, 25);
  context.lineTo(12, 17);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#111924";
  context.fillRect(-20 - (walking * 2), 26, 14, 22);
  context.fillRect(6 + (walking * 2), 26, 14, 22);
  context.fillStyle = "#7e98a6";
  context.fillRect(-23 - (walking * 2), 44, 17, 7);
  context.fillRect(6 + (walking * 2), 44, 17, 7);

  context.fillStyle = "#ffca66";
  context.beginPath();
  context.arc(-8, -29, 3, 0, Math.PI * 2);
  context.arc(8, -29, 3, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#7c1f22";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-12, -18);
  context.quadraticCurveTo(0, -10, 12, -18);
  context.stroke();

  if (attacking) {
    context.strokeStyle = "#dff4ff";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 4, 48, -1.2, 1.2);
    context.stroke();
  }
}

function drawDigitalMonster() {
  const scale = 1 + Math.min(player.level - 1, 4) * 0.08;
  const now = performance.now();
  const walking = player.moving ? Math.sin(now / 85) : 0;
  const attacking = now < player.attackingUntil;
  const damaged = now < player.damagedUntil;
  const routeStage = player.level >= 15 ? 3 : player.level >= 12 ? 2 : 1;
  let bodyColor = "#f58235";
  let outlineColor = "#7c3421";
  let accentColor = "#f3b55a";

  if (evolutionRoute === "flame") {
    bodyColor = "#ee4c32";
    outlineColor = "#8c2018";
    accentColor = "#ffc45b";
  } else if (evolutionRoute === "machine") {
    bodyColor = "#737d8a";
    outlineColor = "#30353b";
    accentColor = "#b7d3db";
  } else if (evolutionRoute === "light") {
    bodyColor = "#f4e6a4";
    outlineColor = "#8f9bb5";
    accentColor = "#ffffff";
  }

  context.save();
  context.translate(player.x, player.y);
  context.scale(player.facing * scale, scale);
  context.translate(0, player.moving ? walking * 2 : Math.sin(now / 500) * 1);

  if (damaged) {
    context.globalAlpha = Math.floor(now / 60) % 2 === 0 ? 0.35 : 1;
  }

  if (routeStage >= 2) {
    if (routeStage === 2) drawWingEvolution(now, walking, attacking, damaged);
    else drawMachineEvolution(now, walking, attacking, damaged);
    context.restore();
    return;
  }

  if (evolutionRoute === "flame") {
    context.fillStyle = routeStage >= 3 ? "#ff9f32" : "#ef7e24";
    context.strokeStyle = "#a62d1f";
    context.lineWidth = 2;
    const wingSize = 12 + routeStage * 8;
    context.beginPath();
    context.moveTo(-12, -8);
    context.lineTo(-18 - wingSize, -22 - routeStage * 4);
    context.lineTo(-22 - wingSize, 5);
    context.lineTo(-10, 12);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(12, -8);
    context.lineTo(18 + wingSize, -22 - routeStage * 4);
    context.lineTo(22 + wingSize, 5);
    context.lineTo(10, 12);
    context.closePath();
    context.fill();
    context.stroke();
  }

  if (evolutionRoute === "machine") {
    context.fillStyle = routeStage >= 3 ? "#d6e3e7" : "#aebbc2";
    context.strokeStyle = "#495157";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-12, -12);
    context.lineTo(-24 - routeStage * 3, -10);
    context.lineTo(-20 - routeStage * 2, 3);
    context.lineTo(-10, 7);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(12, -12);
    context.lineTo(24 + routeStage * 3, -10);
    context.lineTo(20 + routeStage * 2, 3);
    context.lineTo(10, 7);
    context.closePath();
    context.fill();
    context.stroke();
  }

  if (evolutionRoute === "light") {
    context.strokeStyle = "#fff3a6";
    context.fillStyle = "rgba(255, 244, 166, 0.18)";
    context.lineWidth = routeStage >= 3 ? 4 : 2;
    context.beginPath();
    context.arc(0, -24, 13 + routeStage * 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.shadowBlur = evolutionRoute ? 10 + routeStage * 2 : 4;
  context.shadowColor = evolutionRoute === "flame"
    ? "#ff8a38"
    : evolutionRoute === "machine"
      ? "#8bb4c8"
      : evolutionRoute === "light"
        ? "#fff5a8"
        : "rgba(0, 0, 0, 0.35)";

  const bodyGradient = context.createRadialGradient(-6, -12, 3, 0, 4, 24);
  bodyGradient.addColorStop(0, evolutionRoute === "machine" ? "#d5dde0" : "#ffd07a");
  bodyGradient.addColorStop(0.38, bodyColor);
  bodyGradient.addColorStop(1, outlineColor);
  context.fillStyle = bodyGradient;
  context.strokeStyle = outlineColor;
  context.lineWidth = 2;

  context.beginPath();
  context.ellipse(0, 3, 17, 21, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;

  context.strokeStyle = accentColor;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-11, -3);
  context.quadraticCurveTo(-5, 5, -10, 14);
  context.moveTo(11, -3);
  context.quadraticCurveTo(5, 5, 10, 14);
  context.moveTo(-8, 2);
  context.quadraticCurveTo(0, 8, 8, 2);
  context.stroke();

  context.fillStyle = accentColor;
  context.globalAlpha *= 0.78;
  context.beginPath();
  context.ellipse(-4, -10, 4, 7, -0.25, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = damaged ? (Math.floor(now / 60) % 2 === 0 ? 0.35 : 1) : 1;

  context.fillStyle = outlineColor;
  context.beginPath();
  context.moveTo(-11, -17);
  context.lineTo(-17, -31);
  context.lineTo(-6, -21);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(11, -18);
  context.lineTo(17, -32);
  context.lineTo(7, -21);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(-9, -11);
  context.lineTo(-15, -26);
  context.lineTo(-4, -16);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(8, -12);
  context.lineTo(14, -27);
  context.lineTo(16, -12);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = accentColor;
  context.beginPath();
  context.ellipse(1, 11, 10, 12, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = bodyColor;
  context.beginPath();
  context.moveTo(10, 13);
  context.quadraticCurveTo(30, 21, 20, 31);
  context.quadraticCurveTo(31, 23, 19, 7);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(7, -8, 3.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1c2630";
  context.beginPath();
  context.arc(8.5, -8, 1.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#e9dfcf";
  context.beginPath();
  context.moveTo(5, -2);
  context.lineTo(11, -2);
  context.lineTo(8, 2);
  context.closePath();
  context.fill();

  if (evolutionRoute === "flame") {
    context.fillStyle = "#fff0a1";
    context.beginPath();
    context.moveTo(0, -1);
    context.quadraticCurveTo(8, 4, 0, 10);
    context.quadraticCurveTo(-8, 4, 0, -1);
    context.fill();
  } else if (evolutionRoute === "machine") {
    context.fillStyle = "#e8f2f4";
    context.strokeStyle = "#52616a";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, -2);
    context.lineTo(5, 3);
    context.lineTo(0, 9);
    context.lineTo(-5, 3);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (evolutionRoute === "light") {
    context.fillStyle = "#fffbd1";
    context.beginPath();
    for (let point = 0; point < 8; point += 1) {
      const angle = (Math.PI * 2 * point) / 8 - Math.PI / 2;
      const radius = point % 2 === 0 ? 7 : 3;
      const x = Math.cos(angle) * radius;
      const y = 4 + Math.sin(angle) * radius;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  context.fillStyle = bodyColor;
  context.beginPath();
  context.moveTo(-10, 18);
  context.lineTo(-18 - (player.moving ? walking * 3 : 0), 27);
  context.lineTo(-7 - (attacking ? 4 : 0), 24);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(9, 18);
  context.lineTo(18 + (attacking ? 10 : player.moving ? walking * 3 : 0), 27);
  context.lineTo(7 + (attacking ? 6 : 0), 24);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawWorld() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#4d6d50";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(-cameraX, -cameraY);

  context.strokeStyle = "rgba(232, 212, 154, 0.25)";
  context.beginPath();
  context.arc(player.x, player.y, player.attackRange, 0, Math.PI * 2);
  context.stroke();

  for (const resource of resources) {
    context.fillStyle = resource.type === "wood" ? "#8a5a35" : "#bcc3c2";
    context.beginPath();
    context.arc(resource.x, resource.y, resource.size, 0, Math.PI * 2);
    context.fill();
  }

  for (const enemy of enemies) {
    drawEnemy(enemy);
    drawHealthBar(enemy);
  }

  drawDigitalMonster();
  context.restore();
}

function update(timestamp) {
  if (timerRunning && !manuallyPaused) {
    if (player.health > 0 && !routeSelectionOpen && !skillSelectionOpen) {
      elapsedMilliseconds += timestamp - lastTimerTimestamp;
      strengthenEnemies();
      unlockMonsterTypes();
      movePlayer();
      updateCamera();
      collectResources();
      moveEnemies();
      attack();
      respawnWorld(timestamp);
      timerElement.textContent = formatTime(elapsedMilliseconds);
    }
  }
  lastTimerTimestamp = timestamp;

  if (routeSelectionOpen || skillSelectionOpen) {
    drawWorld();
  } else if (player.health > 0) {
    drawWorld();
  }
  requestAnimationFrame(update);
}

document.getElementById("heal").addEventListener("click", () => {
  if (player.wood >= 2 && player.health < player.maxHealth) {
    player.wood -= 2;
    player.health = Math.min(player.maxHealth, player.health + 25);
    setMessage("生命恢復了 25 點。");
    updateInterface();
  } else if (player.health >= player.maxHealth) {
    setMessage("目前生命已滿。");
  } else {
    setMessage("需要 2 點木材才能治療。");
  }
});

document.getElementById("restart").addEventListener("click", resetGame);
document.getElementById("restart-paused").addEventListener("click", resetGame);

function pauseGame() {
  if (manuallyPaused || player.health <= 0) return;
  manuallyPaused = true;
  document.getElementById("pause-screen").hidden = false;
  document.getElementById("pause").textContent = "繼續";
  setMessage("遊戲已暫停。");
  lastTimerTimestamp = performance.now();
}

function resumeGame() {
  manuallyPaused = false;
  document.getElementById("pause-screen").hidden = true;
  document.getElementById("pause").textContent = "暫停";
  lastTimerTimestamp = performance.now();
  setMessage("遊戲繼續！");
}

document.getElementById("pause").addEventListener("click", () => {
  if (manuallyPaused) resumeGame();
  else pauseGame();
});
document.getElementById("resume").addEventListener("click", resumeGame);

document.getElementById("skill-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-skill]");
  if (button) applySkill(button.dataset.skill);
});

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => {
    evolutionRoute = button.dataset.route;
    routeSelectionOpen = false;
    document.getElementById("evolution-route").hidden = true;

    if (evolutionRoute === "flame") {
      player.damage += 35;
      setMessage("進化為火焰龍！攻擊力大幅提升！");
    } else if (evolutionRoute === "machine") {
      player.attackRange += 30;
      player.maxHealth += 50;
      player.health = player.maxHealth;
      setMessage("進化為機械龍！攻擊範圍與生命上限提升！");
    } else {
      player.speed = 5.5;
      player.attackRange += 15;
      setMessage("進化為光明龍！移動與攻擊範圍提升！");
    }
    updateInterface();
  });
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

resetGame();
requestAnimationFrame(update);
