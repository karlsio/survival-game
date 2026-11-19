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
const messageElement = document.getElementById("message");

const keys = new Set();
const resources = [];
const enemies = [];
const evolutionNames = ["新生者", "探險者", "荒野獵人", "守護者"];

let player;
let hasAxe;
let attackReady = true;
let lastResourceRespawn = 0;
let evolutionRoute = null;
let routeSelectionOpen = false;
let skillSelectionOpen = false;
let pendingEvolutionRoute = false;
let roundNumber = 1;
let roundTransition = false;

function randomPosition(padding = 30) {
  return {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
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
    const health = 40 + player.level * 15;
    enemies.push({
      ...randomPosition(),
      size: 14,
      speed: 0.7 + Math.random() * 0.5 + player.level * 0.08,
      health,
      maxHealth: health,
      monsterType: Math.random() < 0.5 ? "fang" : "slime",
    });
  }
}

function enemyCountForRound() {
  return 2 + roundNumber;
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
    x: canvas.width / 2,
    y: canvas.height / 2,
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
  };
  hasAxe = false;
  attackReady = true;
  evolutionRoute = null;
  routeSelectionOpen = false;
  skillSelectionOpen = false;
  pendingEvolutionRoute = false;
  roundNumber = 1;
  roundTransition = false;
  resources.length = 0;
  enemies.length = 0;
  createResources();
  createEnemies(enemyCountForRound());
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
}

function gainXp(amount) {
  player.xp += amount * player.xpBonus;

  while (player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    evolve();
  }
  updateInterface();
}

function evolve() {
  player.level += 1;
  player.damage += 12;
  player.attackRange += 8;
  player.maxHealth += 20;
  player.health = player.maxHealth;
  player.speed = Math.min(4.8, player.speed + 0.2);

  const name = evolutionNames[player.level - 1] || `進化體 ${player.level}`;
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
  if (keys.has("arrowleft") || keys.has("a")) {
    player.x -= player.speed;
    player.facing = -1;
  }
  if (keys.has("arrowright") || keys.has("d")) {
    player.x += player.speed;
    player.facing = 1;
  }
  if (keys.has("arrowup") || keys.has("w")) player.y -= player.speed;
  if (keys.has("arrowdown") || keys.has("s")) player.y += player.speed;

  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
}

function collectResources() {
  for (let i = resources.length - 1; i >= 0; i -= 1) {
    const resource = resources[i];
    const dx = player.x - resource.x;
    const dy = player.y - resource.y;

    if (Math.hypot(dx, dy) < player.size + resource.size) {
      const amount = hasAxe ? 2 : 1;
      player[resource.type] += amount;
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
    }

    if (distance < player.size + enemy.size) {
      player.health -= 0.25;
      updateInterface();

      if (player.health <= 0) {
        player.health = 0;
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
  context.save();
  context.translate(enemy.x, enemy.y);

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
  context.save();
  context.translate(enemy.x, enemy.y);

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

function drawEnemy(enemy) {
  if (enemy.monsterType === "slime") {
    drawSlimeMonster(enemy);
  } else {
    drawFangMonster(enemy);
  }
}

function drawDigitalMonster() {
  const scale = 1 + Math.min(player.level - 1, 4) * 0.08;
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

  context.fillStyle = bodyColor;
  context.strokeStyle = outlineColor;
  context.lineWidth = 2;

  context.beginPath();
  context.ellipse(0, 3, 17, 21, 0, 0, Math.PI * 2);
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

  context.fillStyle = bodyColor;
  context.beginPath();
  context.moveTo(-10, 18);
  context.lineTo(-18, 27);
  context.lineTo(-7, 24);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(9, 18);
  context.lineTo(18, 27);
  context.lineTo(7, 24);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawWorld() {
  context.fillStyle = "#4d6d50";
  context.fillRect(0, 0, canvas.width, canvas.height);

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
}

function update(timestamp) {
  if (player.health > 0 && !routeSelectionOpen && !skillSelectionOpen) {
    movePlayer();
    collectResources();
    moveEnemies();
    attack();
    respawnWorld(timestamp);
  }
  drawWorld();
  requestAnimationFrame(update);
}

document.getElementById("craft-axe").addEventListener("click", () => {
  if (hasAxe) {
    setMessage("斧頭已經製作完成。");
  } else if (player.wood >= 3 && player.stone >= 2) {
    player.wood -= 3;
    player.stone -= 2;
    hasAxe = true;
    player.damage += 8;
    setMessage("製作成功！收集雙倍資源，且斧頭增加攻擊力。");
    updateInterface();
  } else {
    setMessage("資源不足：需要木材 3 和石頭 2。");
  }
});

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
