const POSITIONS = ["第1数字", "第2数字", "第3数字", "第4数字", "第5数字", "ボーナス数字"];
const HEADER_ALIASES = {
  round: ["回号", "抽せん回", "抽選回", "第"],
  date: ["抽せん日", "抽選日", "日付", "开奖日"],
  numbers: [
    ["第1数字", "本数字1", "数字1", "第1"],
    ["第2数字", "本数字2", "数字2", "第2"],
    ["第3数字", "本数字3", "数字3", "第3"],
    ["第4数字", "本数字4", "数字4", "第4"],
    ["第5数字", "本数字5", "数字5", "第5"],
    ["ボーナス数字", "ボーナス", "B数字", "BONUS", "ボーナス数"],
  ],
};

const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const authMessage = document.getElementById("authMessage");
const logoutButton = document.getElementById("logoutButton");
const fetchButton = document.getElementById("fetchButton");
const resetButton = document.getElementById("resetButton");
const statusMessage = document.getElementById("statusMessage");
const emptyState = document.getElementById("emptyState");
const resultArea = document.getElementById("resultArea");
const drawSummary = document.getElementById("drawSummary");
const candidatePool = document.getElementById("candidatePool");
const quickPick = document.getElementById("quickPick");
const detailBody = document.getElementById("detailBody");
const detailCards = document.getElementById("detailCards");
const wheelMode = document.getElementById("wheelMode");
const ticketCount = document.getElementById("ticketCount");
const wheelButton = document.getElementById("wheelButton");
const wheelMeta = document.getElementById("wheelMeta");
const wheelList = document.getElementById("wheelList");

let currentCalculation = null;

loginForm.addEventListener("submit", handleLogin);
logoutButton.addEventListener("click", handleLogout);
fetchButton.addEventListener("click", fetchLatestCsv);
resetButton.addEventListener("click", resetForm);
wheelButton.addEventListener("click", renderWheelSystem);

initialize();

async function initialize() {
  if (location.protocol === "file:") {
    showError("このツールは file:// ではなくローカルサーバーで起動してください。start.bat を使うと開けます。");
    return;
  }

  await checkAuthStatus();
}

async function checkAuthStatus() {
  try {
    const response = await fetch("/api/auth/status", {
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json();

    if (response.ok && payload.authenticated) {
      showApp();
      await fetchLatestCsv();
      return;
    }
  } catch {}

  showAuth();
}

async function handleLogin(event) {
  event.preventDefault();
  const password = passwordInput.value;

  if (!password) {
    authMessage.textContent = "パスワードを入力してください。";
    return;
  }

  loginButton.disabled = true;
  authMessage.textContent = "認証中です...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      authMessage.textContent = payload.error || "ログインに失敗しました。";
      return;
    }

    passwordInput.value = "";
    showApp();
    authMessage.textContent = "パスワードを入力してください。";
    await fetchLatestCsv();
  } catch {
    authMessage.textContent = "ログインに失敗しました。";
  } finally {
    loginButton.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {}
  resetForm();
  showAuth();
}

function showAuth() {
  authScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showApp() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

async function fetchLatestCsv() {
  setBusyState(true, "PAYPAY銀行の最新CSVを取得中です...");

  try {
    const response = await fetch("/api/miniloto/csv", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`自動取得に失敗しました (${response.status})`);
    }

    const payload = await response.json();
    const raw = payload.csvText || "";
    statusMessage.textContent = "PAYPAY銀行のCSVを自動取得しました。直近2回で候補を計算します。";
    analyzeCsvText(raw);
  } catch (error) {
    showError(error instanceof Error ? error.message : "自動取得に失敗しました。");
  } finally {
    setBusyState(false);
  }
}

function analyzeCsvText(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) {
    showError("CSVデータが空です。自動取得してください。");
    return;
  }

  try {
    const rows = parseCsv(raw);
    const draws = extractDraws(rows);
    if (draws.length < 2) {
      showError("直近2回分の数字を見つけられませんでした。CSV形式を確認してください。");
      return;
    }

    const latestTwo = pickLatestTwo(draws);
    const calculation = buildCalculation(latestTwo[0], latestTwo[1]);
    renderResult(latestTwo[0], latestTwo[1], calculation);
    statusMessage.textContent = `${latestTwo[0].label} と ${latestTwo[1].label} を使って候補を計算しました。`;
  } catch (error) {
    showError(error instanceof Error ? error.message : "CSVの解析に失敗しました。");
  }
}

function resetForm() {
  currentCalculation = null;
  detailBody.innerHTML = "";
  detailCards.innerHTML = "";
  drawSummary.innerHTML = "";
  candidatePool.innerHTML = "";
  quickPick.innerHTML = "";
  wheelList.innerHTML = "";
  wheelMeta.textContent = "候補数字から指定口数の組み合わせを作ります。";
  resultArea.classList.add("hidden");
  emptyState.classList.remove("hidden");
  statusMessage.textContent = "自動取得か手動CSVで計算できます。";
}

function setBusyState(isBusy, message) {
  fetchButton.disabled = isBusy;
  if (message) {
    statusMessage.textContent = message;
  }
}

function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) {
      rows.push(row);
    }
  }

  return rows;
}

function extractDraws(rows) {
  if (!rows.length) {
    return [];
  }

  const headerRowIndex = rows.findIndex((row) => {
    const normalizedRow = row.map((cell) => normalize(cell));
    const headerHits = HEADER_ALIASES.numbers.reduce((count, aliases) => {
      return count + (normalizedRow.some((value) => aliases.some((alias) => value.includes(normalize(alias)))) ? 1 : 0);
    }, 0);
    return headerHits >= 3;
  });

  if (headerRowIndex >= 0) {
    const header = rows[headerRowIndex];
    const mapped = extractByHeader(rows.slice(headerRowIndex + 1), header);
    if (mapped.length >= 2) {
      return mapped;
    }
  }

  return rows
    .map((row, index) => extractByPattern(row, index))
    .filter(Boolean);
}

function extractByHeader(dataRows, header) {
  const headerMap = header.map((cell) => normalize(cell));
  const roundIndex = findIndexByAliases(headerMap, HEADER_ALIASES.round);
  const dateIndex = findIndexByAliases(headerMap, HEADER_ALIASES.date);
  const numberIndexes = HEADER_ALIASES.numbers.map((aliases) => findIndexByAliases(headerMap, aliases));

  if (numberIndexes.some((index) => index < 0)) {
    return [];
  }

  return dataRows
    .map((row, index) => {
      const numbers = numberIndexes.map((numberIndex) => toValidMiniLotoNumber(row[numberIndex]));
      if (numbers.some((value) => value === null)) {
        return null;
      }

      const round = roundIndex >= 0 ? extractFirstInteger(row[roundIndex]) : null;
      const date = dateIndex >= 0 ? row[dateIndex] || null : null;
      return {
        order: index,
        round,
        date,
        numbers,
        label: buildLabel(round, date, index),
      };
    })
    .filter(Boolean);
}

function extractByPattern(row, index) {
  const values = row.map((cell) => extractFirstInteger(cell)).filter((value) => value !== null);
  if (values.length < 6) {
    return null;
  }

  let bestCandidate = null;
  const detectedDate = row.map(extractDateText).find(Boolean) || null;

  for (let i = 0; i <= values.length - 6; i += 1) {
    const candidate = values.slice(i, i + 6);
    if (candidate.every((value) => value >= 1 && value <= 31)) {
      const round = values.find((value) => value > 31) || null;
      const score = (isNonDecreasing(candidate.slice(0, 5)) ? 4 : 0) + (new Set(candidate).size >= 5 ? 2 : 0) + i;
      const draw = {
        order: index,
        round,
        date: detectedDate,
        numbers: candidate,
        label: buildLabel(round, detectedDate, index),
      };
      bestCandidate = !bestCandidate || score > bestCandidate.score ? { draw, score } : bestCandidate;
    }
  }

  return bestCandidate ? bestCandidate.draw : null;
}

function pickLatestTwo(draws) {
  const withRound = draws.filter((draw) => Number.isInteger(draw.round));
  if (withRound.length === draws.length) {
    return [...draws].sort((a, b) => b.round - a.round).slice(0, 2);
  }

  return [...draws].slice(-2).reverse();
}

function buildCalculation(latest, previous) {
  const details = POSITIONS.map((position, index) => {
    const current = latest.numbers[index];
    const past = previous.numbers[index];
    const total = current + past;
    const center = Math.floor(total / 2);
    const candidates = [center - 1, center, center + 1].filter((value) => value >= 1 && value <= 31);

    return {
      position,
      current,
      past,
      total,
      average: total / 2,
      center,
      candidates,
    };
  });

  const scoreMap = new Map();
  details.forEach((detail, index) => {
    detail.candidates.forEach((value) => {
      const weight = value === detail.center ? 3 : 1;
      scoreMap.set(value, (scoreMap.get(value) || 0) + weight + (index < 5 ? 1 : 0));
    });
  });

  const pool = [...new Set(details.flatMap((detail) => detail.candidates))].sort((a, b) => a - b);
  const quickPickNumbers = [...scoreMap.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0] - b[0];
    })
    .slice(0, 5)
    .map(([value]) => value)
    .sort((a, b) => a - b);

  const rankedNumbers = [...scoreMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0] - b[0];
  });

  return { details, pool, quickPickNumbers, rankedNumbers };
}

function renderResult(latest, previous, calculation) {
  currentCalculation = calculation;
  emptyState.classList.add("hidden");
  resultArea.classList.remove("hidden");

  drawSummary.innerHTML = "";
  candidatePool.innerHTML = "";
  quickPick.innerHTML = "";
  detailBody.innerHTML = "";
  detailCards.innerHTML = "";

  drawSummary.append(
    buildMetaParagraph(`直近回: ${latest.label}`),
    buildMetaParagraph(formatNumbers(latest.numbers)),
    buildMetaParagraph(`2回前: ${previous.label}`),
    buildMetaParagraph(formatNumbers(previous.numbers))
  );

  calculation.pool.forEach((number) => candidatePool.appendChild(buildBall(number)));
  calculation.quickPickNumbers.forEach((number) => quickPick.appendChild(buildBall(number, true)));

  calculation.details.forEach((detail) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${detail.position}</td>
      <td><strong>${detail.current}</strong></td>
      <td><strong>${detail.past}</strong></td>
      <td>${detail.total}</td>
      <td>${formatAverage(detail.average)}</td>
      <td>${detail.center}</td>
      <td>${detail.candidates.join(" / ")}</td>
    `;
    detailBody.appendChild(row);

    const card = document.createElement("article");
    card.className = "detail-card";
    card.innerHTML = `
      <h4>${detail.position}</h4>
      <p>直近回: <strong>${detail.current}</strong></p>
      <p>2回前: <strong>${detail.past}</strong></p>
      <p>合計: ${detail.total}</p>
      <p>割る: ${formatAverage(detail.average)}</p>
      <p>中心: ${detail.center}</p>
      <p>候補: ${detail.candidates.join(" / ")}</p>
    `;
    detailCards.appendChild(card);
  });

  renderWheelSystem();
}

function buildMetaParagraph(text) {
  const paragraph = document.createElement("p");
  paragraph.className = "draw-meta";
  paragraph.textContent = text;
  return paragraph;
}

function buildBall(number, accent = false) {
  const item = document.createElement("span");
  item.className = accent ? "ball accent" : "ball";
  item.textContent = String(number);
  return item;
}

function renderWheelSystem() {
  if (!currentCalculation) {
    return;
  }

  const requestedTickets = Number.parseInt(ticketCount.value, 10) || 10;
  const mode = wheelMode.value || "strong";
  const wheel = buildWheelTickets(currentCalculation, requestedTickets, mode);

  wheelMeta.textContent = `${mode === "strong" ? "強い数字重視" : "分散重視"}で、上位${wheel.sourceNumbers.length}数字から ${wheel.tickets.length}口 を作成しています。`;
  wheelList.innerHTML = "";

  wheel.tickets.forEach((numbers, index) => {
    const item = document.createElement("article");
    item.className = "wheel-ticket";

    const label = document.createElement("div");
    label.className = "wheel-ticket-label";
    label.textContent = `${index + 1}口`;

    const balls = document.createElement("div");
    balls.className = "wheel-ticket-balls";
    numbers.forEach((number) => balls.appendChild(buildBall(number)));

    item.append(label, balls);
    wheelList.appendChild(item);
  });
}

function buildWheelTickets(calculation, requestedTickets, mode) {
  const sourceNumbers =
    mode === "balanced"
      ? calculation.pool
      : selectWheelSourceNumbers(calculation.rankedNumbers, requestedTickets);
  const combos = buildCombinations(sourceNumbers, 5).map((numbers) => ({
    numbers,
    baseScore: numbers.reduce((sum, value) => sum + getNumberScore(calculation, value), 0),
    randomSeed: Math.random(),
  }));

  combos.sort((a, b) => b.baseScore - a.baseScore || compareArrays(a.numbers, b.numbers));

  const selected = [];
  const usedPairs = new Set();
  const usageCount = new Map();

  while (selected.length < requestedTickets && selected.length < combos.length) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    combos.forEach((combo, index) => {
      if (combo.selected) {
        return;
      }

      const newNumberCount = combo.numbers.filter((value) => !usageCount.has(value)).length;
      const repeatPenalty = combo.numbers.reduce((sum, value) => sum + (usageCount.get(value) || 0), 0);
      const newPairCount = buildPairs(combo.numbers).filter((pair) => !usedPairs.has(pair)).length;
      const minUsage = Math.min(...sourceNumbers.map((value) => usageCount.get(value) || 0));
      const fairnessBoost = combo.numbers.filter((value) => (usageCount.get(value) || 0) === minUsage).length;
      const score =
        mode === "balanced"
          ? fairnessBoost * 30 +
            newNumberCount * 18 +
            newPairCount * 4 -
            repeatPenalty * 8 +
            combo.baseScore +
            combo.randomSeed * 6
          : combo.baseScore * 12 + newNumberCount * 4 + newPairCount * 1 - repeatPenalty * 2 + combo.randomSeed;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) {
      break;
    }

    const chosen = combos[bestIndex];
    chosen.selected = true;
    selected.push([...chosen.numbers].sort((a, b) => a - b));

    chosen.numbers.forEach((value) => {
      usageCount.set(value, (usageCount.get(value) || 0) + 1);
    });

    buildPairs(chosen.numbers).forEach((pair) => usedPairs.add(pair));
  }

  return { sourceNumbers, tickets: selected };
}

function selectWheelSourceNumbers(rankedNumbers, requestedTickets) {
  const numbers = rankedNumbers.map(([value]) => value);
  let sourceSize = 5;

  while (sourceSize < numbers.length && combinationCount(sourceSize, 5) < requestedTickets) {
    sourceSize += 1;
  }

  return numbers.slice(0, Math.max(5, sourceSize));
}

function buildCombinations(values, choose) {
  const results = [];

  function walk(startIndex, picked) {
    if (picked.length === choose) {
      results.push([...picked]);
      return;
    }

    for (let index = startIndex; index < values.length; index += 1) {
      picked.push(values[index]);
      walk(index + 1, picked);
      picked.pop();
    }
  }

  walk(0, []);
  return results;
}

function combinationCount(total, choose) {
  if (choose > total) {
    return 0;
  }

  let result = 1;
  for (let i = 1; i <= choose; i += 1) {
    result = (result * (total - choose + i)) / i;
  }
  return result;
}

function buildPairs(numbers) {
  const pairs = [];
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      pairs.push(`${numbers[i]}-${numbers[j]}`);
    }
  }
  return pairs;
}

function getNumberScore(calculation, value) {
  const entry = calculation.rankedNumbers.find(([number]) => number === value);
  return entry ? entry[1] : 0;
}

function compareArrays(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function formatNumbers(numbers) {
  return numbers.join(" / ");
}

function formatAverage(value) {
  return Number.isInteger(value) ? String(value) : `${value.toFixed(1)} → 切り捨て`;
}

function showError(message) {
  detailBody.innerHTML = "";
  drawSummary.innerHTML = "";
  candidatePool.innerHTML = "";
  quickPick.innerHTML = "";
  resultArea.classList.add("hidden");
  emptyState.classList.remove("hidden");
  statusMessage.textContent = message;
}

function findIndexByAliases(headerMap, aliases) {
  return headerMap.findIndex((value) => aliases.some((alias) => value.includes(normalize(alias))));
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "");
}

function extractFirstInteger(value) {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function extractDateText(value) {
  const match = String(value || "").match(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/);
  return match ? match[0] : null;
}

function toValidMiniLotoNumber(value) {
  const number = extractFirstInteger(value);
  return number !== null && number >= 1 && number <= 31 ? number : null;
}

function buildLabel(round, date, fallbackIndex) {
  if (round && date) {
    return `第${round}回 (${date})`;
  }
  if (round) {
    return `第${round}回`;
  }
  if (date) {
    return date;
  }
  return `抽出行 ${fallbackIndex + 1}`;
}

function isNonDecreasing(values) {
  return values.every((value, index) => index === 0 || values[index - 1] <= value);
}
