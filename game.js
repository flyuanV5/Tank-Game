const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const KEY = {};
const rand = (min, max) => Math.random() * (max - min) + min;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const createTank = ({ x, y, color, speed, hp, isEnemy = false }) => ({
  x,
  y,
  width: 38,
  height: 38,
  cannonLength: 26,
  angle: isEnemy ? Math.PI : 0,
  color,
  speed,
  hp,
  cooldown: 0,
  maxCooldown: isEnemy ? 40 : 16,
  isEnemy,
  aiTimer: Math.floor(rand(20, 60)),
  aiTurn: rand(-Math.PI, Math.PI),
});

const state = {
  player: createTank({
    x: 80,
    y: WORLD.height / 2,
    color: "#00d68f",
    speed: 2.7,
    hp: 5,
  }),
  enemies: Array.from({ length: 6 }, (_, index) =>
    createTank({
      x: WORLD.width - 100 - (index % 3) * 120,
      y: 100 + Math.floor(index / 3) * 220,
      color: "#ff4d6d",
      speed: 2,
      hp: 2,
      isEnemy: true,
    })
  ),
  bullets: [],
  explosions: [],
  blocks: [
    { x: 280, y: 120, width: 90, height: 190 },
    { x: 280, y: 370, width: 90, height: 110 },
    { x: 520, y: 80, width: 95, height: 120 },
    { x: 520, y: 270, width: 95, height: 250 },
  ],
  score: 0,
  gameOver: false,
  win: false,
};

function drawRectCenter({ x, y, width, height, color, angle }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawTank(tank) {
  drawRectCenter({
    x: tank.x,
    y: tank.y,
    width: tank.width,
    height: tank.height,
    color: tank.color,
    angle: tank.angle,
  });

  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(tank.angle);
  ctx.fillStyle = "#e7ebff";
  ctx.fillRect(0, -4, tank.cannonLength, 8);
  ctx.fillStyle = "#121a2e";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const hpWidth = 40;
  ctx.fillStyle = "rgba(20,20,20,.6)";
  ctx.fillRect(tank.x - hpWidth / 2, tank.y - 34, hpWidth, 6);
  ctx.fillStyle = tank.isEnemy ? "#ffa4b4" : "#8bf4cd";
  ctx.fillRect(
    tank.x - hpWidth / 2,
    tank.y - 34,
    (hpWidth * Math.max(tank.hp, 0)) / (tank.isEnemy ? 2 : 5),
    6
  );
}

function shoot(tank) {
  if (tank.cooldown > 0) return;
  const speed = 6;
  state.bullets.push({
    x: tank.x + Math.cos(tank.angle) * (tank.cannonLength + 8),
    y: tank.y + Math.sin(tank.angle) * (tank.cannonLength + 8),
    dx: Math.cos(tank.angle) * speed,
    dy: Math.sin(tank.angle) * speed,
    radius: 4,
    owner: tank.isEnemy ? "enemy" : "player",
  });
  tank.cooldown = tank.maxCooldown;
}

function intersectsRectCircle(rect, circle) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function tankRect(tank) {
  return {
    x: tank.x - tank.width / 2,
    y: tank.y - tank.height / 2,
    width: tank.width,
    height: tank.height,
  };
}

function tankBlocked(nextX, nextY, tank) {
  const rect = {
    x: nextX - tank.width / 2,
    y: nextY - tank.height / 2,
    width: tank.width,
    height: tank.height,
  };

  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > WORLD.width || rect.y + rect.height > WORLD.height) {
    return true;
  }

  return state.blocks.some((block) =>
    !(
      rect.x + rect.width < block.x ||
      rect.x > block.x + block.width ||
      rect.y + rect.height < block.y ||
      rect.y > block.y + block.height
    )
  );
}

function updatePlayer() {
  const player = state.player;
  if (player.cooldown > 0) player.cooldown--;

  let vx = 0;
  let vy = 0;
  if (KEY["ArrowUp"] || KEY["w"] || KEY["W"]) vy -= 1;
  if (KEY["ArrowDown"] || KEY["s"] || KEY["S"]) vy += 1;
  if (KEY["ArrowLeft"] || KEY["a"] || KEY["A"]) vx -= 1;
  if (KEY["ArrowRight"] || KEY["d"] || KEY["D"]) vx += 1;

  if (vx !== 0 || vy !== 0) {
    const length = Math.hypot(vx, vy);
    vx /= length;
    vy /= length;
    player.angle = Math.atan2(vy, vx);

    const nextX = player.x + vx * player.speed;
    const nextY = player.y + vy * player.speed;
    if (!tankBlocked(nextX, nextY, player)) {
      player.x = nextX;
      player.y = nextY;
    }
  }

  if (KEY[" "]) shoot(player);
}

function updateEnemy(tank) {
  if (tank.cooldown > 0) tank.cooldown--;
  tank.aiTimer--;

  const targetDx = state.player.x - tank.x;
  const targetDy = state.player.y - tank.y;
  const targetAngle = Math.atan2(targetDy, targetDx);

  if (tank.aiTimer <= 0) {
    tank.aiTimer = Math.floor(rand(15, 70));
    tank.aiTurn = rand(-0.9, 0.9);
  }

  const dist = Math.hypot(targetDx, targetDy);
  const desired = dist < 280 ? targetAngle : targetAngle + tank.aiTurn;
  const delta = Math.atan2(Math.sin(desired - tank.angle), Math.cos(desired - tank.angle));
  tank.angle += clamp(delta, -0.06, 0.06);

  const nextX = tank.x + Math.cos(tank.angle) * tank.speed;
  const nextY = tank.y + Math.sin(tank.angle) * tank.speed;
  if (!tankBlocked(nextX, nextY, tank)) {
    tank.x = nextX;
    tank.y = nextY;
  } else {
    tank.angle += rand(-1.2, 1.2);
  }

  if (dist < 450 && Math.abs(delta) < 0.22 && Math.random() < 0.06) {
    shoot(tank);
  }
}

function updateBullets() {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;

    if (
      bullet.x < 0 ||
      bullet.x > WORLD.width ||
      bullet.y < 0 ||
      bullet.y > WORLD.height
    ) {
      return false;
    }

    if (state.blocks.some((b) => intersectsRectCircle(b, bullet))) {
      state.explosions.push({ x: bullet.x, y: bullet.y, life: 12 });
      return false;
    }

    if (bullet.owner === "player") {
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && intersectsRectCircle(tankRect(enemy), bullet)) {
          enemy.hp -= 1;
          state.explosions.push({ x: bullet.x, y: bullet.y, life: 18 });
          if (enemy.hp <= 0) state.score += 100;
          return false;
        }
      }
    } else if (intersectsRectCircle(tankRect(state.player), bullet)) {
      state.player.hp -= 1;
      state.explosions.push({ x: bullet.x, y: bullet.y, life: 22 });
      return false;
    }

    return true;
  });
}

function updateExplosions() {
  state.explosions = state.explosions
    .map((exp) => ({ ...exp, life: exp.life - 1 }))
    .filter((exp) => exp.life > 0);
}

function evaluateGameState() {
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  if (state.player.hp <= 0) {
    state.gameOver = true;
    state.win = false;
  } else if (state.enemies.length === 0) {
    state.gameOver = true;
    state.win = true;
  }

  if (state.gameOver) {
    statusText.textContent = state.win
      ? `胜利！得分：${state.score}（按 R 重新开始）`
      : `游戏结束！得分：${state.score}（按 R 重新开始）`;
  } else {
    statusText.textContent = `生命：${state.player.hp} | 敌人：${state.enemies.length} | 得分：${state.score}`;
  }
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  for (const block of state.blocks) {
    ctx.fillStyle = "#3d4670";
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.strokeStyle = "#7183c5";
    ctx.strokeRect(block.x, block.y, block.width, block.height);
  }

  drawTank(state.player);
  for (const enemy of state.enemies) drawTank(enemy);

  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = bullet.owner === "player" ? "#7bffd0" : "#ffc2cb";
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const exp of state.explosions) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 201, 107, ${exp.life / 22})`;
    ctx.arc(exp.x, exp.y, (24 - exp.life) * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resetGame() {
  Object.assign(state, {
    player: createTank({
      x: 80,
      y: WORLD.height / 2,
      color: "#00d68f",
      speed: 2.7,
      hp: 5,
    }),
    enemies: Array.from({ length: 6 }, (_, index) =>
      createTank({
        x: WORLD.width - 100 - (index % 3) * 120,
        y: 100 + Math.floor(index / 3) * 220,
        color: "#ff4d6d",
        speed: 2,
        hp: 2,
        isEnemy: true,
      })
    ),
    bullets: [],
    explosions: [],
    score: 0,
    gameOver: false,
    win: false,
  });
}

function loop() {
  if (!state.gameOver) {
    updatePlayer();
    for (const enemy of state.enemies) updateEnemy(enemy);
    updateBullets();
    updateExplosions();
    evaluateGameState();
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  KEY[event.key] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  if ((event.key === "r" || event.key === "R") && state.gameOver) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  KEY[event.key] = false;
});

evaluateGameState();
loop();
