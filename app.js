// ===============================
// 수브레인 영단어 학습 프로그램 - app.js
// ===============================

// ---- 전역 상태 ----
let studentName = "";
let wordSets = [];        // index.json에서 로드되는 세트 목록 [{title, file}, ...]
let selectedSet = null;   // 현재 선택한 세트 객체 {title, file}
let allWords = [];        // 현재 세트의 전체 단어 배열 [{word, meaning, ascii?}, ...]
let currentWords = [];    // 현재 배치(30개) 슬라이스
let studyIndex = 0;
let quizIndex = 0;
let wrongList = [];       // 오답 {word, meaning, ...} 저장
let correctCount = 0;
let wrongCount = 0;
let batchSize = 30;
let batchStart = 0;       // 0, 30, 60 ...

// ---- 유틸: 화면 전환 ----
function showStep(stepId) {
  document.querySelectorAll(".screen").forEach(sec => sec.style.display = "none");
  document.querySelector("#" + stepId).style.display = "block";
}

// ---- 세트 목록 로드 & 렌더 ----
async function loadIndex() {
  const info = document.getElementById("loadInfo");
  try {
    info.textContent = "세트 목록을 불러오는 중...";
    // Netlify 캐시 꼬임 대비 쿼리 파라미터
    const res = await fetch("./data/index.json?ver=" + Date.now());
    if (!res.ok) throw new Error("index.json 로드 실패: " + res.status);
    wordSets = await res.json(); // [{title, file}, ...]
    renderSetOptions();
    info.textContent = "세트를 선택한 뒤 '사용하기'를 누르세요.";
  } catch (e) {
    console.error(e);
    info.textContent = "세트 목록을 불러오지 못했습니다. (data/index.json 확인)";
  }
}

function renderSetOptions() {
  const sel = document.getElementById("presetSelect");
  sel.innerHTML = "";
  wordSets.forEach((s, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = s.title || s.file || ("세트 " + (idx + 1));
    sel.appendChild(opt);
  });
}

// ---- 세트(단어 파일) 로드 ----
async function loadSet(filePath) {
  const info = document.getElementById("loadInfo");
  try {
    info.textContent = "세트 로드 중...";
    const res = await fetch(filePath + "?ver=" + Date.now());
    if (!res.ok) throw new Error(`${filePath} 로드 실패: ${res.status}`);
    allWords = await res.json(); // [{word, meaning, ascii?}, ...]
    // 기본 상태 세팅
    batchStart = 0;
    currentWords = allWords.slice(batchStart, batchStart + batchSize);
    studyIndex = 0;
    quizIndex = 0;
    wrongList = [];
    correctCount = 0;
    wrongCount = 0;

    // 버튼 활성화
    document.getElementById("btnStartStudy").disabled = false;
    info.textContent = `${selectedSet?.title || "세트"} 로딩 완료 (${allWords.length} 단어)`;
  } catch (e) {
    console.error(e);
    info.textContent = "세트를 불러오지 못했습니다. (파일 경로/JSON 형식 확인)";
  }
}

// ---- 학습(스터디) ----
function startStudy() {
  renderStudy();
  showStep("step3");
}

function renderStudy() {
  const w = currentWords[studyIndex];
  const wordEl = document.getElementById("studyWord");
  const meaningEl = document.getElementById("studyMeaning");
  const asciiEl = document.getElementById("studyAscii");

  if (!w) return;

  wordEl.textContent = w.word || "";
  meaningEl.textContent = w.meaning || "";
  asciiEl.textContent = (w.ascii && Array.isArray(w.ascii)) ? w.ascii.join("\n") : "";

  document.getElementById("studyIndex").textContent = String(studyIndex + 1);
  document.getElementById("studyTotal").textContent = String(currentWords.length);
}

function goPrev() {
  if (studyIndex > 0) {
    studyIndex--;
    renderStudy();
  }
}
function goNext() {
  if (studyIndex < currentWords.length - 1) {
    studyIndex++;
    renderStudy();
  }
}

// ---- 발음(TTS) ----
function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

// ---- 퀴즈 ----
function startQuiz() {
  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  wrongList = [];
  renderQuiz();
  showStep("step4");
}

function renderQuiz() {
  const qWord = currentWords[quizIndex];
  if (!qWord) return;

  document.getElementById("quizWord").textContent = qWord.word || "";
  document.getElementById("quizIndex").textContent = String(quizIndex + 1);
  document.getElementById("quizTotal").textContent = String(currentWords.length);

  // 보기 4개 생성: 정답 1 + 오답 3(랜덤)
  const choicesWrap = document.getElementById("choiceList");
  choicesWrap.innerHTML = "";

  const otherMeanings = allWords
    .filter(w => w.meaning !== qWord.meaning)
    .map(w => w.meaning);

  shuffleInPlace(otherMeanings);
  const options = [qWord.meaning, ...otherMeanings.slice(0, 3)];
  shuffleInPlace(options);

  options.forEach(m => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = m;
    btn.addEventListener("click", () => {
      const isCorrect = (m === qWord.meaning);
      handleAnswer(isCorrect, qWord, m);
    }, { once: true });
    choicesWrap.appendChild(btn);
  });
}

function handleAnswer(isCorrect, qWord, userAnswer) {
  if (isCorrect) {
    playCorrect();
    correctCount++;
  } else {
    playWrong();
    wrongCount++;
    // 오답 리스트에 저장
    wrongList.push({
      word: qWord.word,
      meaning: qWord.meaning,
      user: userAnswer
    });
  }
  // 다음 문제 대기: “다음 문제” 버튼으로 진행
}

function nextQuiz() {
  quizIndex++;
  if (quizIndex >= currentWords.length) {
    // 배치 완료 → 결과 화면
    showResult();
  } else {
    renderQuiz();
  }
}

// ---- 결과 ----
function showResult() {
  document.getElementById("statCorrect").textContent = String(correctCount);
  document.getElementById("statWrong").textContent = String(wrongCount);
  const rate = currentWords.length
    ? Math.round((correctCount / currentWords.length) * 100)
    : 0;
  document.getElementById("statRate").textContent = rate + "%";

  const wrap = document.getElementById("wrongListWrap");
  wrap.innerHTML = "";
  if (wrongList.length === 0) {
    wrap.textContent = "오답이 없습니다. 잘했어요!";
  } else {
    wrongList.forEach(item => {
      const div = document.createElement("div");
      div.className = "wrong-item";
      div.innerHTML = `<strong>${item.word}</strong> — 정답: ${item.meaning} / 내 선택: ${item.user || "-"}`
      wrap.appendChild(div);
    });
  }

  // “다음 묶음 학습” 버튼 상태
  const nextBatchBtn = document.getElementById("btnNextBatch");
  nextBatchBtn.disabled = isLastBatch();
  nextBatchBtn.textContent = isLastBatch() ? "마지막 묶음 완료" : "다음 묶음 학습";

  showStep("step5");
}

// ---- 오답 다시 풀기 ----
function retryWrong() {
  if (wrongList.length === 0) return;
  // 오답만 대상으로 다시 퀴즈
  currentWords = wrongList.map(x => ({ word: x.word, meaning: x.meaning }));
  wrongList = [];
  studyIndex = 0;
  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  renderQuiz();
  showStep("step4");
}

// ---- 다음 배치 진행 or 전체 완료 시 세트 선택으로 ----
function isLastBatch() {
  return (batchStart + batchSize) >= allWords.length;
}

function proceedAfterBatchComplete(messageForPicker = "") {
  if (!isLastBatch()) {
    // 다음 배치로 이동
    batchStart += batchSize;
    currentWords = allWords.slice(batchStart, batchStart + batchSize);
    studyIndex = 0;
    quizIndex = 0;
    wrongList = [];
    correctCount = 0;
    wrongCount = 0;
    startStudy(); // 다음 배치 학습부터 재시작 (원하면 startQuiz로 변경 가능)
  } else {
    // ✅ 한 JSON의 모든 배치 완료 → 세트 선택 화면으로 이동 (이름 유지)
    goToSetPicker(messageForPicker || `${selectedSet?.title || "현재 세트"} 학습을 완료했습니다. 다음 챕터를 선택하세요.`);
  }
}

// ---- 세트 선택 화면으로 이동(이름 유지) ----
async function goToSetPicker(message = "") {
  // 퀴즈 상태 초기화 (이름은 건드리지 않음)
  studyIndex = 0;
  quizIndex = 0;
  wrongList = [];
  correctCount = 0;
  wrongCount = 0;
  currentWords = [];
  batchStart = 0;

  // 세트 목록 없으면 재로딩
  try {
    if (!wordSets || !wordSets.length) {
      await loadIndex();
    }
  } catch (e) {
    console.error("세트 목록 재로딩 실패:", e);
  }

  showStep("step2");
  if (message) alert(message);
}

// ---- CSV 내보내기 ----
function exportCsv() {
  const header = ["index", "word", "meaning", "isCorrect"];
  // 간단히: currentWords 기준으로 정/오답만 기입
  // (필요 시 userAnswer, batchStart 등 더 추가 가능)
  const rows = currentWords.map((w, i) => {
    // 정답 수/오답 수만으로는 각 문항 정오를 완전히 복원하기 어렵기에,
    // 간단 구현: 오답 리스트 기반으로 해당 단어가 오답이면 false, 아니면 true 처리
    const wasWrong = wrongList.find(x => x.word === w.word && x.meaning === w.meaning);
    const isCorrect = wasWrong ? "false" : "true";
    return [String(i + 1), csvEscape(w.word), csvEscape(w.meaning), isCorrect];
  });
  const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const setTitle = (selectedSet?.title || "set").replace(/[\/\\:*?"<>|]/g, "_");
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}-${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
  a.href = URL.createObjectURL(blob);
  a.download = `${studentName || "학생"}_${setTitle}_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvEscape(s = "") {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---- 이벤트 바인딩 ----
function bindOnce() {
  // Step1
  document.getElementById("btnGoStep2").addEventListener("click", () => {
    const name = document.getElementById("studentName").value.trim();
    if (!name) { alert("이름을 입력하세요."); return; }
    studentName = name;
    showStep("step2");
  }, { once: false });

  // Step2
  document.getElementById("btnUsePreset").addEventListener("click", async () => {
    const idx = Number(document.getElementById("presetSelect").value);
    selectedSet = wordSets[idx];
    if (!selectedSet) return alert("세트를 선택하세요.");
    await loadSet(selectedSet.file);
  });

  document.getElementById("btnStartStudy").addEventListener("click", () => {
    if (!allWords.length) return alert("세트를 먼저 불러오세요.");
    startStudy();
  });

  // Step3
  document.getElementById("btnPrev").addEventListener("click", goPrev);
  document.getElementById("btnNext").addEventListener("click", goNext);
  document.getElementById("btnGoQuiz").addEventListener("click", startQuiz);
  document.getElementById("btnSpeak").addEventListener("click", () => {
    const w = currentWords[studyIndex];
    if (w?.word) speak(w.word);
  });

  // Step4
  document.getElementById("btnNextQuiz").addEventListener("click", nextQuiz);

  // Step5
  document.getElementById("btnRetryWrong").addEventListener("click", retryWrong);
  document.getElementById("btnNextBatch").addEventListener("click", () => {
    // 결과에서 다음 배치로 바로 이동
    // (마지막 배치면 자동으로 세트 선택 화면으로 이동)
    proceedAfterBatchComplete();
  });
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  // 새로 추가: 사용자가 원할 때 즉시 세트 선택 화면으로
  document.getElementById("btnPickAnotherSet").addEventListener("click", () => {
    goToSetPicker("다른 세트를 선택하세요.");
  });

  document.getElementById("btnBackHome").addEventListener("click", () => {
    // 정말 처음으로 가고 싶을 때만 이름 초기화
    studentName = "";
    showStep("step1");
  });
}

// ---- 기타 유틸 ----
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

// ---- 효과음 ----
function playCorrect() {
  const el = document.getElementById("correctSound");
  if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}
function playWrong() {
  const el = document.getElementById("wrongSound");
  if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}

// ---- 초기화 ----
window.addEventListener("DOMContentLoaded", async () => {
  bindOnce();
  await loadIndex();
  // 첫 진입은 step1
  showStep("step1");
});
