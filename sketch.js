/*
  p5.js 多選題測驗系統
  - 會嘗試載入同一目錄下的 questions.csv（需有 header: question,A,B,C,D,answer,feedback 可選）
  - 每次隨機抽 5 題
  - 答完後呈現成績與回饋，並有簡單互動效果（答對會有 confetti）
  使用方式：
  - 在同一資料夾放一個 questions.csv，例如：
    question,A,B,C,D,answer,feedback
    "台灣的首都是？","台北","高雄","台中","台南","A","正確！台北是首都。"
    ...
  注意：本地開啟需要透過本機伺服器 (Live Server 或 p5 的伺服器)
*/

let table;
let allQuestions = []; // {q,opts:[...],ans,feedback}
let quiz = []; // 5 選出題目
let current = 0;
let userAnswers = []; // store selected index 0-3 or -1
let canvasW, canvasH;  // 改為動態設定

// UI layout
let optionRects = [];

let state = 'loading'; // loading, quiz, result
let confetti = [];
let showConfetti = false;

// 在開頭新增煙火參數
let fireworks = [];
let gravity;

function preload() {
  // 先嘗試載入 CSV；若失敗使用內建題庫
  table = loadTable('questions.csv', 'csv', 'header', () => {
    parseTable();
  }, (err) => {
    console.warn('載入 questions.csv 失敗，使用內建題庫', err);
    createFallbackQuestions();
  });
}

function setup() {
  // 設定全螢幕畫布
  canvasW = windowWidth;
  canvasH = windowHeight;
  createCanvas(canvasW, canvasH);
  
  textFont('Arial');
  textAlign(LEFT, TOP);
  rectMode(CORNER);

  // 若 table 已於 preload 成功解析，parseTable 已執行 -> allQuestions 應有內容
  if (allQuestions.length === 0 && table && table.getRowCount() > 0) {
    parseTable();
  }
  if (allQuestions.length === 0) {
    createFallbackQuestions();
  }
  startNewQuiz();
}

// 加入視窗大小改變處理
function windowResized() {
  canvasW = windowWidth;
  canvasH = windowHeight;
  resizeCanvas(canvasW, canvasH);
  computeOptionRects(); // 重新計算選項位置
}

function draw() {
  background(245);

  if (state === 'loading') {
    fill(0);
    textSize(18);
    text('載入題庫中...', 20, 20);
    return;
  }

  if (state === 'quiz') {
    drawHeader();
    drawQuestion();
    drawOptions();
    drawFooter();
  } else if (state === 'result') {
    drawResults();
    if (showConfetti) {
      updateConfetti();
    }
  }
}

function parseTable() {
  allQuestions = [];
  for (let r = 0; r < table.getRowCount(); r++) {
    const row = table.getRow(r);
    const q = row.get('question') || row.get(0);
    const A = row.get('A') || row.get(1) || '';
    const B = row.get('B') || row.get(2) || '';
    const C = row.get('C') || row.get(3) || '';
    const D = row.get('D') || row.get(4) || '';
    const ans = (row.get('answer') || row.get(5) || '').toString().trim();
    const feedback = row.get('feedback') || '';
    // normalize answer to index 0..3 (A/B/C/D or 1..4)
    let ansIndex = -1;
    if (/^[ABCDabcd]$/.test(ans)) {
      ansIndex = ['A','B','C','D'].indexOf(ans.toUpperCase());
    } else if (/^[1-4]$/.test(ans)) {
      ansIndex = parseInt(ans)-1;
    }
    allQuestions.push({
      q: String(q),
      opts: [String(A), String(B), String(C), String(D)],
      ans: ansIndex,
      feedback: String(feedback)
    });
  }
  // 簡單檢查
  if (allQuestions.length === 0) {
    createFallbackQuestions();
  }
}

function createFallbackQuestions() {
  allQuestions = [
    {q: 'p5.js中,哪個函數在程式開始時只運行一次?', opts:['setup()','draw()','preload()','mousePressed()'], ans:0, feedback:'正確！setup() 函數只在程式開始時執行一次'},
    {q: '哪個函數會不斷重複執行,用於繪製畫面?', opts:['setup()','draw()','mouseClicked()','keyTyped()'], ans:1, feedback:'正確！draw() 函數會持續重複執行來更新畫面'},
    {q: '用於載入外部檔案(如圖片或CSV)的函數是?', opts:['createCanvas()','background()','preload()','fill()'], ans:2, feedback:'正確！preload() 用於預先載入外部檔案'},
    {q: '設定畫布大小的函數是?', opts:['setSize()','canvas()','createCanvas()','window()'], ans:2, feedback:'正確！createCanvas() 用於設定畫布大小'},
    {q: '改變圖形填充顏色的函數是?', opts:['fill()','stroke()','rect()','color()'], ans:0, feedback:'正確！fill() 用於設定填充顏色'},
    {q: 'p5.js的畫布原點(0,0)在哪個位置?', opts:['左上角','右下角','中心','左下角'], ans:0, feedback:'正確！p5.js 的座標系原點在左上角'}
  ];
}

function startNewQuiz() {
  // 隨機抽 5 題（若題庫不足則全部）
  let n = min(5, allQuestions.length);
  let idxs = [];
  let pool = [...Array(allQuestions.length).keys()];
  for (let i=0;i<n;i++) {
    let r = floor(random(pool.length));
    idxs.push(pool.splice(r,1)[0]);
  }
  quiz = idxs.map(i => JSON.parse(JSON.stringify(allQuestions[i]))); // clone
  current = 0;
  userAnswers = Array(quiz.length).fill(-1);
  state = 'quiz';
  showConfetti = false;
  confetti = [];
  computeOptionRects();
}

// 修改選項位置計算
function computeOptionRects() {
  optionRects = [];
  let margin = canvasW * 0.05;  // 動態邊距
  let startY = canvasH * 0.25;  // 調整起始高度
  let w = canvasW - margin*2;
  let h = canvasH * 0.1;  // 動態高度
  let spacing = h * 1.2;  // 選項間距
  
  for (let i=0; i<4; i++) {
    optionRects.push({
      x: margin,
      y: startY + i*spacing,
      w: w,
      h: h
    });
  }
}

function drawHeader() {
  fill(30);
  textSize(26);  // 原本 20
  text('隨機多選題測驗 (5 題)', 20, 12);
  textSize(18);  // 原本 14
  fill(90);
  text(`題目 ${current+1} / ${quiz.length}`, canvasW - 160, 16);
}

function drawQuestion() {
  let item = quiz[current];
  fill(10);
  textSize(24);  // 原本 18
  let qx = 40, qy = 60, qw = canvasW - 80;
  textLeading(28);  // 原本 22
  text(item.q, qx, qy, qw, 80);
}

function drawOptions() {
  for (let i=0;i<4;i++) {
    let r = optionRects[i];
    // 背景
    if (userAnswers[current] === i) {
      fill(60, 150, 220); // 選取
    } else {
      fill(255);
    }
    stroke(150);
    strokeWeight(1);
    rect(r.x, r.y, r.w, r.h, 8);

    // 當結果顯示時為正確或錯誤上色（僅在 result 狀態中使用）
    if (state === 'result' || (state === 'quiz' && current < quiz.length)) {
      // nothing extra here
    }

    // 選項文字
    fill(userAnswers[current] === i ? 255 : 30);
    noStroke();
    textSize(20);  // 原本 16
    let prefix = ['A','B','C','D'][i] + '. ';
    text(prefix + quiz[current].opts[i], r.x + 12, r.y + 12, r.w - 24, r.h - 24);
  }
}

function drawFooter() {
  // 下一題或提交按鈕
  let btnW = 160, btnH = 44;
  let bx = canvasW - btnW - 40;
  let by = canvasH - 80;
  // 按鈕背景
  let canProceed = userAnswers[current] !== -1;
  fill(canProceed ? '#28a745' : '#999');
  noStroke();
  rect(bx, by, btnW, btnH, 8);
  fill(255);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(current < quiz.length -1 ? '下一題' : '提交', bx + btnW/2, by + btnH/2);
  textAlign(LEFT, TOP);

  // 顯示提示
  fill(80);
  textSize(12);
  text('點擊選項選擇答案，右下按鈕繼續。', 40, canvasH - 60);
}

function mousePressed() {
  if (state === 'quiz') {
    // 檢查是否點選到選項
    for (let i=0;i<optionRects.length;i++) {
      let r = optionRects[i];
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        userAnswers[current] = i;
        // 小互動：按下選項有淡色閃動（以 frameCount 觸發即可）
        return;
      }
    }
    // 檢查下一題/提交按鈕
    let btnW = 160, btnH = 44;
    let bx = canvasW - btnW - 40;
    let by = canvasH - 80;
    if (mouseX >= bx && mouseX <= bx+btnW && mouseY >= by && mouseY <= by+btnH) {
      if (userAnswers[current] === -1) return; // 不能前進
      if (current < quiz.length -1) {
        current++;
      } else {
        // 計分並顯示結果
        state = 'result';
        processResults();
      }
    }
  } else if (state === 'result') {
    // 點擊重新開始
    let btnW = 180, btnH = 46;
    let bx = canvasW/2 - btnW/2;
    let by = canvasH - 110;
    if (mouseX >= bx && mouseX <= bx+btnW && mouseY >= by && mouseY <= by+btnH) {
      startNewQuiz();
    }
  }
}

let score = 0;
let detailedFeedback = [];

function processResults() {
  score = 0;
  detailedFeedback = [];
  for (let i=0;i<quiz.length;i++) {
    let user = userAnswers[i];
    let correct = quiz[i].ans;
    let ok = (user === correct);
    if (ok) score++;
    let fb = quiz[i].feedback || '';
    if (!fb) {
      fb = ok ? '答對！' : `正確答案：${['A','B','C','D'][correct]}：${quiz[i].opts[correct]}`;
    }
    detailedFeedback.push({ok, fb, user, correct});
  }
  // 如果成績高，顯示 confetti
  showConfetti = score >= 3;
  if (showConfetti) spawnConfetti(score * 20 + 20);
}

function drawResults() {
  fill(30);
  textSize(canvasH * 0.05);  // 動態字體大小
  textAlign(LEFT, TOP);
  text('測驗結果', canvasW * 0.05, canvasH * 0.05);

  // 中心分數
  textAlign(CENTER, CENTER);
  textSize(canvasH * 0.12);
  fill(30);
  text(`${score} / ${quiz.length}`, canvasW/2, canvasH * 0.2);

  // 回饋語
  textSize(canvasH * 0.04);
  let remark = '';
  if (score === quiz.length) remark = '太棒了！全對！';
  else if (score >= Math.ceil(quiz.length*0.8)) remark = '表現優異！';
  else if (score >= Math.ceil(quiz.length*0.6)) remark = '不錯，還可以更好！';
  else remark = '再接再厲，多複習！';
  fill(80);
  text(remark, canvasW/2, canvasH * 0.3);

  // 顯示題目回饋列表
  textAlign(LEFT, TOP);
  let startY = canvasH * 0.4;
  textSize(canvasH * 0.025);
  let lineHeight = canvasH * 0.08;
  
  for (let i=0; i<detailedFeedback.length; i++) {
    let x = canvasW * 0.05;
    let y = startY + i*lineHeight;
    if (detailedFeedback[i].ok) fill(220,255,230);
    else fill(255,230,230);
    noStroke();
    rect(x-6, y-6, canvasW*0.9, lineHeight-8, 6);
    fill(30);
    text(`${i+1}. ${quiz[i].q}`, x, y);
    textSize(canvasH * 0.02);
    let userText = detailedFeedback[i].user === -1 ? '未作答' : 
                   `${['A','B','C','D'][detailedFeedback[i].user]}：${quiz[i].opts[detailedFeedback[i].user]}`;
    text(`你的答案： ${userText}`, x, y+lineHeight*0.4);
    text(`回饋： ${detailedFeedback[i].fb}`, x + canvasW*0.35, y+lineHeight*0.4);
  }

  // 重新開始按鈕 - 移到右下角
  let btnW = canvasW * 0.15;
  let btnH = canvasH * 0.06;
  let bx = canvasW - btnW - canvasW * 0.05;
  let by = canvasH - btnH - canvasH * 0.05;
  
  fill('#007bff');
  rect(bx, by, btnW, btnH, 8);
  fill(255);
  textSize(canvasH * 0.025);
  textAlign(CENTER, CENTER);
  text('重新開始測驗', bx + btnW/2, by + btnH/2);
  textAlign(LEFT, TOP);
}

function spawnConfetti(n) {
  for (let i=0;i<n;i++) {
    confetti.push({
      x: random(50, canvasW-50),
      y: random(-80, -10),
      vx: random(-0.6, 0.6),
      vy: random(1, 4),
      size: random(6,12),
      col: color(random(50,255), random(50,255), random(50,255)),
      rot: random(TWO_PI),
      rotSpeed: random(-0.1,0.1)
    });
  }
}

function updateConfetti() {
  for (let i=confetti.length-1;i>=0;i--) {
    let p = confetti[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06; // gravity
    p.rot += p.rotSpeed;
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    noStroke();
    fill(p.col);
    rectMode(CENTER);
    rect(0,0,p.size, p.size*0.6);
    pop();
    if (p.y > height + 40) confetti.splice(i,1);
  }
}

// 加入煙火特效系統
class Firework {
  constructor() {
    this.hu = random(255);
    this.firework = new Particle(random(width), height, this.hu, true);
    this.exploded = false;
    this.particles = [];
  }

  done() {
    if (this.exploded && this.particles.length === 0) {
      return true;
    } else {
      return false;
    }
  }

  update() {
    if (!this.exploded) {
      this.firework.applyForce(gravity);
      this.firework.update();
      
      if (this.firework.vel.y >= 0) {
        this.exploded = true;
        this.explode();
      }
    }
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(gravity);
      this.particles[i].update();
      
      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }
  }

  explode() {
    for (let i = 0; i < 100; i++) {
      const p = new Particle(
        this.firework.pos.x,
        this.firework.pos.y,
        this.hu,
        false
      );
      this.particles.push(p);
    }
  }

  show() {
    if (!this.exploded) {
      this.firework.show();
    }
    
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].show();
    }
  }
}

class Particle {
  constructor(x, y, hu, firework) {
    this.pos = createVector(x, y);
    this.firework = firework;
    this.lifespan = 255;
    this.hu = hu;
    
    if (this.firework) {
      this.vel = createVector(0, random(-12, -8));
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(2, 10));
    }
    this.acc = createVector(0, 0);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.firework) {
      this.vel.mult(0.95);
      this.lifespan -= 4;
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  done() {
    if (this.firework) {
      return this.lifespan < 0;
    } else {
      return this.lifespan < 0;
    }
  }

  show() {
    noStroke();
    colorMode(HSL);
    if (this.firework) {
      fill(this.hu, 255, 255, this.lifespan);
      ellipse(this.pos.x, this.pos.y, 8);
    } else {
      fill(this.hu, 255, 255, this.lifespan);
      ellipse(this.pos.x, this.pos.y, 6);
    }
  }
}
