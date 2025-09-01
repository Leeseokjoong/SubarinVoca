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

// 공통: 화면 전환
function showStep(step) {
  document.querySelectorAll(".screen").forEach(sec => (sec.style.display = "none"));
  const el = document.querySelector("#" + step);
  if (el) el.style.display = "block";
}

// 공통: 안전한 발음 함수 (Web Speech API)
function speakWord(word, { times = 1, lang = "en-US", rate = 0.9, pitch = 1.0 } = {}) {
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
  } catch (err) {
    console.error("index.json 불러오기 실패", err);
  }
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
  } catch (err) {
    console.error("단어 파일 불러오기 실패", err);
  }
});

// 현재 묶음 로드
function loadBatch() {
  currentWords = allWords.slice(batchStart, batchStart + batchSize);
}

// 학습 화면 UI 업데이트 (+ 이미지 + 2회 읽기)
function updateStudyUI() {
  const w = currentWords[studyIndex];
  if (!w) return;

  document.querySelector("#studyWord").textContent = w.word ?? "";
  document.querySelector("#studyMeaning").textContent = w.meaning ?? "";
  document.querySelector("#studyIndex").textContent = studyIndex + 1;
  document.querySelector("#studyTotal").textContent = currentWords.length;

  // ✅ 학습 이미지 표시 (없으면 숨김)
  const img = document.querySelector("#studyImage");
  if (img) {
    if (w.image) {
      img.src = w.image;
      img.style.display = "block";
      img.alt = `${w.word} 이미지`;
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
  }

  // ✅ 발음(학습에서는 2번)
  speakWord(w.word, { times: 2, rate: 0.95, pitch: 1.0 });
}

// 학습 이전/다음
document.querySelector("#btnPrev").addEventListener("click", () => {
  if (studyIndex > 0) { studyIndex--; updateStudyUI(); }
});
document.querySelector("#btnNext").addEventListener("click", () => {
  if (studyIndex < currentWords.length - 1) { studyIndex++; updateStudyUI(); }
});

// 수동 발음 버튼
document.querySelector("#btnSpeak").addEventListener("click", () => {
  const word = document.querySelector("#studyWord").textContent;
  speakWord(word, { times: 1, rate: 0.95 });
});

// 퀴즈 시작
document.querySelector("#btnGoQuiz").addEventListener("click", () => {
  startQuiz();
  showStep("step4");
});

function startQuiz() {
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

  // 기본은 자동 진행이므로 버튼은 비활성(기존 동작 유지)
  document.querySelector("#btnNextQuiz").disabled = true;

  // ✅ 퀴즈 문제 표시 시 자동 발음 (1회)
  speakWord(w.word, { times: 1, rate: 0.95 });
}

function handleAnswer(correct, btn) {
  if (correct) {
    correctCount++;
    btn.classList.add("correct");
    if (window.Sounds && typeof window.Sounds.success === "function") {
      window.Sounds.success();
    }
  } else {
    wrongCount++;
    wrongList.push(currentWords[quizIndex]);
    btn.classList.add("wrong");
    if (window.Sounds && typeof window.Sounds.fail === "function") {
      window.Sounds.fail();
    }
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

  const hasNext = batchStart + batchSize < allWords.length;
  document.querySelector("#btnNextBatch").disabled = !hasNext;

  if (!hasNext) {
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

// 다음 묶음 학습 or 종료
document.querySelector("#btnNextBatch").addEventListener("click", () => {
  batchStart += batchSize;
  if (batchStart < allWords.length) {
    loadBatch();
    studyIndex = 0;
    updateStudyUI();
    showStep("step3");
  } else {
    showFinalMessage();
  }
});

// 종료 메시지
function showFinalMessage() {
  const totalSets = Math.ceil(allWords.length / batchSize);
  const finishedSets = totalSets;

  showStep("step5");

  const card = document.querySelector("#step5 .card.big");
  card.innerHTML = `
    <h2>🎉 수고하셨습니다!</h2>
    <p>모든 세트의 학습이 종료되었습니다.</p>
    <p><strong>${finishedSets} / ${totalSets} 세트 완료</strong></p>
  `;

  const actionsRow = document.querySelector("#step5 .row");
  if (actionsRow) actionsRow.style.display = "none";
}

// CSV 내보내기
document.querySelector("#btnExportCsv").addEventListener("click", () => {
  let csv = "단어,뜻\n";
  currentWords.forEach(w => { csv += `${w.word},${w.meaning}\n`; });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "words.csv"; a.click();
});

// 처음으로
document.querySelector("#btnBackHome").addEventListener("click", () => { showStep("step1"); });
