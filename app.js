// app.js

let studentName = "";
let wordSets = [];
let allWords = [];
let currentWords = [];
let studyIndex = 0;
let quizIndex = 0;
let wrongList = [];
let correctCount = 0;
let wrongCount = 0;
let batchSize = 30;
let selectedFile = "";
let batchStart = 0;

/* =========================
   공통 유틸
========================= */

// 날짜 문자열 (CSV 메타에 사용)
function todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 화면 전환
function showStep(step) {
  document.querySelectorAll(".screen").forEach(sec => (sec.style.display = "none"));
  const el = document.querySelector("#" + step);
  if (el) el.style.display = "block";
}

// 안전한 발음 (Web Speech API)
function speakWord(word, { times = 1, lang = "en-US", rate = 0.95, pitch = 1.0 } = {}) {
  if (!word || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    let count = 0;
    const speakOnce = () => {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      u.onend = () => {
        count++;
        if (count < times) speakOnce();
      };
      window.speechSynthesis.speak(u);
    };
    speakOnce();
  } catch (e) {
    console.warn("speech failed:", e);
  }
}

/* =========================
   Step1: 이름 입력 → Step2
========================= */

document.querySelector("#btnGoStep2").addEventListener("click", () => {
  const nameInput = document.querySelector("#studentName").value.trim();
  if (!nameInput) { alert("이름을 입력하세요."); return; }
  studentName = nameInput;
  showStep("step2");
});

/* =========================
   세트(index.json) 불러오기
========================= */

async function loadIndex() {
  try {
    const res = await fetch("./data/index.json");
    wordSets = await res.json();
    const select = document.querySelector("#presetSelect");
    select.innerHTML = `<option value="">세트를 선택하세요</option>`;
    wordSets.forEach(set => {
      const opt = document.createElement("option");
      opt.value = set.file;
      opt.textContent = set.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("index.json 불러오기 실패", err);
  }
}
loadIndex();

/* =========================
   세트 선택/시작
========================= */

document.querySelector("#btnUsePreset").addEventListener("click", () => {
  const val = document.querySelector("#presetSelect").value;
  if (!val) { alert("세트를 선택하세요."); return; }
  selectedFile = val;
  document.querySelector("#btnStartStudy").disabled = false;
});

document.querySelector("#btnStartStudy").addEventListener("click", async () => {
  if (!selectedFile) { alert("세트를 먼저 선택하세요."); return; }
  try {
    const res = await fetch("./data/" + selectedFile);
    allWords = await res.json();
    batchStart = 0;
    loadBatch();
    studyIndex = 0;
    updateStudyUI();
    showStep("step3");
  } catch (err) {
    console.error("단어 파일 불러오기 실패", err);
  }
});

// 현재 묶음 로드
function loadBatch() {
  currentWords = allWords.slice(batchStart, batchStart + batchSize);
}

/* =========================
   Step3: 학습 화면 (ASCII 전용)
========================= */

function updateStudyUI() {
  const w = currentWords[studyIndex];
  if (!w) return;

  document.querySelector("#studyWord").textContent = w.word ?? "";
  document.querySelector("#studyMeaning").textContent = w.meaning ?? "";
  document.querySelector("#studyIndex").textContent = studyIndex + 1;
  document.querySelector("#studyTotal").textContent = currentWords.length;

  // ASCII 출력
  const pre = document.querySelector("#studyAscii");
  if (pre) {
    const lines = Array.isArray(w.ascii) ? w.ascii : [];
    pre.textContent = lines.join("\n");
    pre.style.display = lines.length ? "block" : "none";
  }

  // 학습 시 2회 발음
  speakWord(w.word, { times: 2 });
}

document.querySelector("#btnPrev").addEventListener("click", () => {
  if (studyIndex > 0) { studyIndex--; updateStudyUI(); }
});
document.querySelector("#btnNext").addEventListener("click", () => {
  if (studyIndex < currentWords.length - 1) { studyIndex++; updateStudyUI(); }
});

// 수동 발음
document.querySelector("#btnSpeak").addEventListener("click", () => {
  const word = document.querySelector("#studyWord").textContent;
  speakWord(word, { times: 1 });
});

/* =========================
   Step4: 퀴즈
========================= */

document.querySelector("#btnGoQuiz").addEventListener("click", () => {
  startQuiz();
  showStep("step4");
});

function startQuiz() {
  // 이번 세션에서 쓰는 단어들의 결과 플래그 초기화(O/X 용)
  currentWords.forEach(w => { delete w._result; });

  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  wrongList = [];
  updateQuizUI();
}

function updateQuizUI() {
  const w = currentWords[quizIndex];
  if (!w) return;

  document.querySelector("#quizWord").textContent = w.word;

  const choices = [w.meaning];
  while (choices.length < 4 && currentWords.length > choices.length) {
    const r = currentWords[Math.floor(Math.random() * currentWords.length)].meaning;
    if (!choices.includes(r)) choices.push(r);
  }
  choices.sort(() => Math.random() - 0.5);

  const choiceList = document.querySelector("#choiceList");
  choiceList.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.className = "btn choice";
    btn.addEventListener("click", () => { handleAnswer(choice === w.meaning, btn); });
    choiceList.appendChild(btn);
  });

  document.querySelector("#quizIndex").textContent = quizIndex + 1;
  document.querySelector("#quizTotal").textContent = currentWords.length;

  // 문제 표시 시 자동 발음(1회)
  speakWord(w.word, { times: 1 });
}

function handleAnswer(correct, btn) {
  // 현재 문항 결과 기록 (CSV용)
  currentWords[quizIndex]._result = correct ? "O" : "X";

  if (correct) {
    correctCount++;
    btn.classList.add("correct");
    if (window.Sounds && typeof window.Sounds.success === "function") window.Sounds.success();
  } else {
    wrongCount++;
    wrongList.push(currentWords[quizIndex]);
    btn.classList.add("wrong");
    if (window.Sounds && typeof window.Sounds.fail === "function") window.Sounds.fail();
  }

  document.querySelectorAll(".choice").forEach(b => (b.disabled = true));

  setTimeout(() => {
    if (quizIndex < currentWords.length - 1) {
      quizIndex++;
      updateQuizUI();
    } else {
      showResult();
    }
  }, 800);
}

document.querySelector("#btnNextQuiz").addEventListener("click", () => {
  if (quizIndex < currentWords.length - 1) { quizIndex++; updateQuizUI(); }
  else { showResult(); }
});

/* =========================
   Step5: 결과
========================= */

function showResult() {
  showStep("step5");
  document.querySelector("#statCorrect").textContent = correctCount;
  document.querySelector("#statWrong").textContent = wrongCount;
  const rate = Math.round((correctCount / currentWords.length) * 100);
  document.querySelector("#statRate").textContent = rate + "%";

  const wrongListWrap = document.querySelector("#wrongListWrap");
  wrongListWrap.innerHTML = "";
  wrongList.forEach(w => {
    const div = document.createElement("div");
    div.textContent = `${w.word} - ${w.meaning}`;
    wrongListWrap.appendChild(div);
  });

  document.querySelector("#btnRetryWrong").disabled = wrongList.length === 0;

  const hasNext = (batchStart + batchSize < allWords.length);
  document.querySelector("#btnNextBatch").disabled = !hasNext;

  if (!hasNext) {
    // 방법2: 버튼 행은 유지, "다음 묶음 학습"만 비활성화
    showFinalMessage();
  }
}

// 오답 다시 풀기
document.querySelector("#btnRetryWrong").addEventListener("click", () => {
  if (wrongList.length === 0) return;

  currentWords = wrongList.slice();
  wrongList = [];
  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;

  startQuiz();
  showStep("step4");
});

// 다음 묶음 학습
document.querySelector("#btnNextBatch").addEventListener("click", () => {
  batchStart += batchSize;
  if (batchStart < allWords.length) {
    loadBatch();
    studyIndex = 0;
    updateStudyUI();
    showStep("step3");
  } else {
    // 마지막 세트면 완료 배너만 표시
    showFinalMessage();
  }
});

// 방법2: 버튼 유지, 다음 묶음만 비활성화
function showFinalMessage() {
  showStep("step5");

  const card = document.querySelector("#step5 .card.big");

  // 완료 배너 없으면 위에 추가
  let banner = card.querySelector(".final-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "final-banner";
    banner.innerHTML = `
      <h2>🎉 수고하셨습니다!</h2>
      <p>모든 세트의 학습이 종료되었습니다.</p>
    `;
    card.insertBefore(banner, card.firstChild);
  }

  // "다음 묶음 학습"만 비활성화
  const nextBtn = document.querySelector("#btnNextBatch");
  if (nextBtn) nextBtn.disabled = true;

  // 오답 다시 풀기 버튼은 wrongList 기준 유지
  const retryBtn = document.querySelector("#btnRetryWrong");
  if (retryBtn) retryBtn.disabled = (wrongList.length === 0);
}

/* =========================
   CSV 내보내기 (메타 + 단어별 결과)
========================= */

document.querySelector("#btnExportCsv").addEventListener("click", () => {
  const setName = selectedFile || "";
  const dateStr = todayStr();
  const rate = currentWords.length ? Math.round((correctCount / currentWords.length) * 100) : 0;

  // CSV 헤더(메타)
  let csv = "";
  csv += "학생명,세트파일,날짜,정답,오답,정답률(%)\n";
  csv += `${studentName || ""},${setName},${dateStr},${correctCount},${wrongCount},${rate}\n\n`;

  // 상세 표
  csv += "단어,뜻,정답여부\n";

  const esc = v => {
    const s = String(v ?? "");
    return (s.includes(",") || s.includes('"') || s.includes("\n"))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  currentWords.forEach(w => {
    const result = (w && w._result) ? w._result : "";
    csv += `${esc(w.word)},${esc(w.meaning)},${esc(result)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // 파일명: 학생명_세트_YYYY-MM-DD-HHMM.csv
  const safeName = (studentName || "student").replace(/\s+/g, "_");
  const safeSet  = (setName || "set").replace(/\s+/g, "_").replace(/[\\/]/g, "_");
  a.download = `${safeName}_${safeSet}_${dateStr.replace(/[:\s]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* =========================
   공통: 처음으로(세트 선택으로)
========================= */

document.querySelector("#btnBackHome").addEventListener("click", () => {
  if ("speechSynthesis" in window) speechSynthesis.cancel();

  // 세트 선택 화면으로 이동
  showStep("step2");

  // 선택 초기화(원하면 유지해도 됨)
  const sel = document.querySelector("#presetSelect");
  if (sel) sel.value = "";
  const startBtn = document.querySelector("#btnStartStudy");
  if (startBtn) startBtn.disabled = true;

  // 상태 초기화(선택 사항)
  selectedFile = "";
  currentWords = [];
  studyIndex = 0;
  quizIndex = 0;
  wrongList = [];
  correctCount = 0;
  wrongCount = 0;
});
