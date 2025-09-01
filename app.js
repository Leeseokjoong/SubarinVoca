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

function showStep(step) {
  document.querySelectorAll(".screen").forEach(sec => sec.style.display = "none");
  const el = document.querySelector("#" + step);
  if (el) el.style.display = "block";
}

// 안전한 발음
function speakWord(word, { times = 1, lang = "en-US", rate = 0.95, pitch = 1.0 } = {}) {
  if (!word || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    let count = 0;
    const once = () => {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = lang; u.rate = rate; u.pitch = pitch;
      u.onend = () => { if (++count < times) once(); };
      speechSynthesis.speak(u);
    };
    once();
  } catch {}
}

// Step1 → Step2
document.querySelector("#btnGoStep2").addEventListener("click", () => {
  const nameInput = document.querySelector("#studentName").value.trim();
  if (!nameInput) { alert("이름을 입력하세요."); return; }
  studentName = nameInput;
  showStep("step2");
});

// index.json 불러오기
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
  } catch (err) { console.error("index.json 불러오기 실패", err); }
}
loadIndex();

// 세트 선택 → 사용하기
document.querySelector("#btnUsePreset").addEventListener("click", () => {
  const val = document.querySelector("#presetSelect").value;
  if (!val) { alert("세트를 선택하세요."); return; }
  selectedFile = val;
  document.querySelector("#btnStartStudy").disabled = false;
});

// 학습 시작
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
  } catch (err) { console.error("단어 파일 불러오기 실패", err); }
});

function loadBatch() {
  currentWords = allWords.slice(batchStart, batchStart + batchSize);
}

// 학습 화면 UI 업데이트 (ASCII만)
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

// 학습 이전/다음
document.querySelector("#btnPrev").addEventListener("click", () => {
  if (studyIndex > 0) { studyIndex--; updateStudyUI(); }
});
document.querySelector("#btnNext").addEventListener("click", () => {
  if (studyIndex < currentWords.length - 1) { studyIndex++; updateStudyUI(); }
});

// 수동 발음
document.querySelector("#btnSpeak").addEventListener("click", () => {
  const word = document.querySelector("#studyWord").textContent;
  if (word) speakWord(word, { times: 1 });
});

// 퀴즈
document.querySelector("#btnGoQuiz").addEventListener("click", () => {
  startQuiz(); showStep("step4");
});

function startQuiz() {
  quizIndex = 0; correctCount = 0; wrongCount = 0; wrongList = [];
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
    btn.addEventListener("click", () => handleAnswer(choice === w.meaning, btn));
    choiceList.appendChild(btn);
  });

  document.querySelector("#quizIndex").textContent = quizIndex + 1;
  document.querySelector("#quizTotal").textContent = currentWords.length;

  // 퀴즈 문제 표시 시 자동 발음(1회)
  speakWord(w.word, { times: 1 });
}

function handleAnswer(correct, btn) {
  if (correct) {
    correctCount++; btn.classList.add("correct");
    if (window.Sounds?.success) window.Sounds.success();
  } else {
    wrongCount++; wrongList.push(currentWords[quizIndex]); btn.classList.add("wrong");
    if (window.Sounds?.fail) window.Sounds.fail();
  }
  document.querySelectorAll(".choice").forEach(b => b.disabled = true);

  setTimeout(() => {
    if (quizIndex < currentWords.length - 1) { quizIndex++; updateQuizUI(); }
    else { showResult(); }
  }, 800);
}

document.querySelector("#btnNextQuiz").addEventListener("click", () => {
  if (quizIndex < currentWords.length - 1) { quizIndex++; updateQuizUI(); }
  else { showResult(); }
});

function showResult() {
  showStep("step5");
  document.querySelector("#statCorrect").textContent = correctCount;
  document.querySelector("#statWrong").textContent = wrongCount;
  const rate = Math.round((correctCount / currentWords.length) * 100);
  document.querySelector("#statRate").textContent = rate + "%";

  const wrap = document.querySelector("#wrongListWrap");
  wrap.innerHTML = "";
  wrongList.forEach(w => {
    const div = document.createElement("div");
    div.textContent = `${w.word} - ${w.meaning}`;
    wrap.appendChild(div);
  });

  document.querySelector("#btnRetryWrong").disabled = wrongList.length === 0;

  const hasNext = (batchStart + batchSize < allWords.length);
  document.querySelector("#btnNextBatch").disabled = !hasNext;
  if (!hasNext) showFinalMessage();
}

// 오답 다시 풀기
document.querySelector("#btnRetryWrong").addEventListener("click", () => {
  if (!wrongList.length) return;
  currentWords = wrongList.slice();
  wrongList = []; quizIndex = 0; correctCount = 0; wrongCount = 0;
  startQuiz(); showStep("step4");
});

// 다음 묶음
document.querySelector("#btnNextBatch").addEventListener("click", () => {
  batchStart += batchSize;
  if (batchStart < allWords.length) {
    loadBatch(); studyIndex = 0; updateStudyUI(); showStep("step3");
  } else showFinalMessage();
});

// ✅ 마지막 세트에서도 버튼 행은 그대로 두고,
//    "다음 묶음 학습" 버튼만 비활성화합니다.
function showFinalMessage() {
  // 결과 화면으로 이동(이미 showResult에서 값 세팅 후 호출되는 구조)
  showStep("step5");

  const card = document.querySelector("#step5 .card.big");

  // 상단에 완료 배너가 없으면 만들어서 붙이기 (기존 통계/오답 영역은 그대로 보존)
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

  // ✅ "다음 묶음 학습" 버튼만 비활성화 (오답 다시 풀기/CSV/세트선택 버튼은 유지)
  const nextBtn = document.querySelector("#btnNextBatch");
  if (nextBtn) nextBtn.disabled = true;

  // 오답 다시 풀기 버튼 상태는 현재 wrongList 기준 유지(필요 시 재확인)
  const retryBtn = document.querySelector("#btnRetryWrong");
  if (retryBtn) retryBtn.disabled = (wrongList.length === 0);
}


// CSV
document.querySelector("#btnExportCsv").addEventListener("click", () => {
  let csv = "단어,뜻\n";
  currentWords.forEach(w => { csv += `${w.word},${w.meaning}\n`; });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "words.csv"; a.click();
});

// 홈
document.querySelector("#btnBackHome").addEventListener("click", () => {
  // 음성 재생 중이면 중지
  if ("speechSynthesis" in window) speechSynthesis.cancel();

  // 세트 선택 화면으로 이동
  showStep("step2");

  // 선택 초기화(원하면 유지해도 됨)
  const sel = document.querySelector("#presetSelect");
  if (sel) sel.value = "";
  const startBtn = document.querySelector("#btnStartStudy");
  if (startBtn) startBtn.disabled = true;

  // 상태를 깔끔히 정리(선택 사항)
  selectedFile = "";
  currentWords = [];
  studyIndex = 0;
  quizIndex = 0;
  wrongList = [];
  correctCount = 0;
  wrongCount = 0;
});


