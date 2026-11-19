const canvas = document.getElementById("world");
const context = canvas.getContext("2d");

const healthElement = document.getElementById("health");
const woodElement = document.getElementById("wood");
const stoneElement = document.getElementById("stone");
const levelElement = document.getElementById("level");
const xpElement = document.getElementById("xp");
const xpNeededElement = document.getElementById("xp-needed");
const killsElement = document.getElementById("kills");
const messageElement = document.getElementById("message");

const keys = new Set();
const resources = [];
const enemies = [];
const evolutionNames = ["新生者", "探險者", "荒野獵人", "守護者"];

let player;
let hasAxe;
let attackReady = true;
let lastResourceRespawn = 0;

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
  enemies.length = 0;
  for (let i = 0; i < count; i += 1) {
    const health = 40 + player.level * 15;
    enemies.push({
      ...randomPosition(),
      size: 14,
      speed: 0.7 + Math.random() * 0.5 + player.level * 0.08,
      health,
      maxHealth: health,
    });
  }
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
  };
  hasAxe = false;
  attackReady = true;
  resources.length = 0;
  createResources();
  createEnemies();
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
}

function gainXp(amount) {
  player.xp += amount;

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
  createEnemies(Math.min(3 + player.level, 7));
}

function movePlayer() {
  if (keys.has("arrowleft") || keys.has("a")) player.x -= player.speed;
  if (keys.has("arrowright") || keys.has("d")) player.x += player.speed;
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
  if (hitCount === 0) attackReady = true;
  updateInterface();

  if (hitCount > 0) {
    window.setTimeout(() => {
      attackReady = true;
    }, 280);
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
    if (enemies.length < 3) createEnemies(3);
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
    context.fillStyle = "#b64040";
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    context.fill();
    drawHealthBar(enemy);
  }

  context.fillStyle = player.level >= 3 ? "#62a8ff" : "#e8d49a";
  context.beginPath();
  context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  context.fill();
}

function update(timestamp) {
  if (player.health > 0) {
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
