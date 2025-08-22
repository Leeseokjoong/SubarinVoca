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
  document.querySelector("#" + step).style.display = "block";
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

function updateStudyUI() {
  const w = currentWords[studyIndex];
  document.querySelector("#studyWord").textContent = w.word;
  document.querySelector("#studyMeaning").textContent = w.meaning;
  document.querySelector("#studyIndex").textContent = studyIndex + 1;
  document.querySelector("#studyTotal").textContent = currentWords.length;

  // ✅ 발음 (2번 읽기)
  const utter1 = new SpeechSynthesisUtterance(w.word);
  utter1.lang = "en-US";
  utter1.pitch = 1;

  const utter2 = new SpeechSynthesisUtterance(w.word);
  utter2.lang = "en-US";
  utter2.pitch = 1.05;

  utter1.onend = () => {
    speechSynthesis.speak(utter2);
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utter1);
}

document.querySelector("#btnPrev").addEventListener("click", () => {
  if (studyIndex > 0) { studyIndex--; updateStudyUI(); }
});
document.querySelector("#btnNext").addEventListener("click", () => {
  if (studyIndex < currentWords.length - 1) { studyIndex++; updateStudyUI(); }
});

// 수동 발음 버튼
document.querySelector("#btnSpeak").addEventListener("click", () => {
  const word = document.querySelector("#studyWord").textContent;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US"; 
  speechSynthesis.speak(utter);
});

document.querySelector("#btnGoQuiz").addEventListener("click", () => {
  startQuiz();
  showStep("step4");
});

function startQuiz() {
  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  updateQuizUI();
}

function updateQuizUI() {
  const w = currentWords[quizIndex];
  document.querySelector("#quizWord").textContent = w.word;
  const choices = [w.meaning];
  while (choices.length < 4) {
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
  document.querySelector("#btnNextQuiz").disabled = true;
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

  document.querySelectorAll(".choice").forEach(b => b.disabled = true);

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
  document.querySelector("#btnNextBatch").disabled = (batchStart + batchSize >= allWords.length);
}

// ✅ 오답 다시 풀기 (반복 루프)
document.querySelector("#btnRetryWrong").addEventListener("click", () => {
  if (wrongList.length === 0) return;

  // 오답만 새로운 세트로 설정
  currentWords = [...wrongList];  

  // 새 퀴즈 준비 (오답 다시 수집)
  wrongList = [];  
  quizIndex = 0;
  correctCount = 0;
  wrongCount = 0;

  startQuiz();
  showStep("step4");
});

document.querySelector("#btnNextBatch").addEventListener("click", () => {
  batchStart += batchSize;
  if (batchStart < allWords.length) {
    loadBatch(); 
    studyIndex = 0; 
    updateStudyUI(); 
    showStep("step3");
  } else {
    alert("모든 단어 학습을 완료했습니다!");
    showStep("step1");
  }
});

document.querySelector("#btnExportCsv").addEventListener("click", () => {
  let csv = "단어,뜻\n";
  currentWords.forEach(w => { csv += `${w.word},${w.meaning}\n`; });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "words.csv"; a.click();
});

document.querySelector("#btnBackHome").addEventListener("click", () => { showStep("step1"); });
