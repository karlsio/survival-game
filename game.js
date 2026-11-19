const canvas = document.getElementById("world");
const context = canvas.getContext("2d");

const healthElement = document.getElementById("health");
const woodElement = document.getElementById("wood");
const stoneElement = document.getElementById("stone");
const messageElement = document.getElementById("message");

const keys = new Set();
const resources = [];
const enemies = [];

let player;
let resourcesCollected;
let hasAxe;

function randomPosition() {
  return {
    x: 20 + Math.random() * (canvas.width - 40),
    y: 20 + Math.random() * (canvas.height - 40),
  };
}

function createResources() {
  resources.length = 0;
  for (let i = 0; i < 12; i += 1) {
    resources.push({
      ...randomPosition(),
      type: i % 2 === 0 ? "wood" : "stone",
      size: 12,
    });
  }
}

function createEnemies() {
  enemies.length = 0;
  for (let i = 0; i < 3; i += 1) {
    enemies.push({
      ...randomPosition(),
      size: 14,
      speed: 0.7 + Math.random() * 0.5,
    });
  }
}

function resetGame() {
  player = { x: canvas.width / 2, y: canvas.height / 2, size: 15, speed: 3, health: 100 };
  player.wood = 0;
  player.stone = 0;
  resourcesCollected = 0;
  hasAxe = false;
  createResources();
  createEnemies();
  setMessage("使用方向鍵或 WASD 移動，靠近資源自動收集。");
  updateInterface();
}

function setMessage(text) {
  messageElement.textContent = text;
}

function updateInterface() {
  healthElement.textContent = Math.max(0, player.health);
  woodElement.textContent = player.wood;
  stoneElement.textContent = player.stone;
}

function movePlayer() {
  if (keys.has("ArrowLeft") || keys.has("a")) player.x -= player.speed;
  if (keys.has("ArrowRight") || keys.has("d")) player.x += player.speed;
  if (keys.has("ArrowUp") || keys.has("w")) player.y -= player.speed;
  if (keys.has("ArrowDown") || keys.has("s")) player.y += player.speed;

  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
}

function collectResources() {
  for (let i = resources.length - 1; i >= 0; i -= 1) {
    const resource = resources[i];
    const dx = player.x - resource.x;
    const dy = player.y - resource.y;

    if (Math.hypot(dx, dy) < player.size + resource.size) {
      player[resource.type] += hasAxe ? 2 : 1;
      resourcesCollected += 1;
      resources.splice(i, 1);
      setMessage(`收集到${resource.type === "wood" ? "木材" : "石頭"}！`);
      updateInterface();

      if (resources.length === 0) {
        setMessage("資源已收集完畢！");
      }
    }
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

function drawWorld() {
  context.fillStyle = "#4d6d50";
  context.fillRect(0, 0, canvas.width, canvas.height);

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
  }

  context.fillStyle = "#e8d49a";
  context.beginPath();
  context.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  context.fill();
}

function update() {
  if (player.health > 0) {
    movePlayer();
    collectResources();
    moveEnemies();
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
    setMessage("製作成功！斧頭可讓每次收集得到雙倍資源。");
    updateInterface();
  } else {
    setMessage("資源不足：需要木材 3 和石頭 2。");
  }
});

document.getElementById("heal").addEventListener("click", () => {
  if (player.wood >= 2 && player.health < 100) {
    player.wood -= 2;
    player.health = Math.min(100, player.health + 25);
    setMessage("生命恢復了 25 點。");
    updateInterface();
  } else if (player.health >= 100) {
    setMessage("目前生命已滿。");
  } else {
    setMessage("需要 2 點木材才能治療。");
  }
});

document.getElementById("restart").addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(event.key)) {
    event.preventDefault();
  }
  keys.add(event.key.toLowerCase());
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

resetGame();
update();
