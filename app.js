// app.js
// ===============================
// 기본 상태 변수
let studentName = "";
let wordSets = [];
let currentWords = [];
let studyIndex = 0;
let quizIndex = 0;
let wrongList = [];
let correctCount = 0;
let wrongCount = 0;
let batchSize = 30; // ✅ 한 번에 학습할 단어 수

// 화면 전환 함수
function showStep(step) {
  document.querySelectorAll(".screen").forEach(sec => sec.style.display = "none");
  document.querySelector("#" + step).style.display = "block";
}

// -------------------------------
// Step1 → Step2 (이름 입력 후)
document.querySelector("#btnGoStep2").addEventListener("click", () => {
  const nameInput = document.querySelector("#studentName").value.trim();
  if (!nameInput) {
    alert("이름을 입력하세요.");
    return;
  }
  studentName = nameInput;
  showStep("step2");
});

// -------------------------------
// index.json 불러오기
async function loadIndex() {
  try {
    const res = await fetch("./data/index.json");
    wordSets = await res.json();
    const select = document.querySelector("#presetSelect");
    select.innerHTML = `<option value="">세트를 선택하세요</option>`;
    wordSets.forEach((set, i) => {
      const opt = document.createElement("option");
      opt.value = set.file;
      opt.textContent = set.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("index.json 불러오기 실패", err);
    document.querySelector("#loadInfo").textContent = "목록을 불러올 수 없습니다.";
  }
}
loadIndex();

// -------------------------------
// 세트 선택 버튼
// 현재 선택된 preset을 불러오는 공통 함수
async function loadSelectedSet() {
  const file = presetSelect.value;
  if (!file) return false;
  try {
    const res = await fetch(`./data/${file}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`세트를 불러오지 못했습니다: HTTP ${res.status}`);
    const words = await res.json();
    useWords(words, file.replace(/\.json$/i, ''));
    return true;
  } catch (e) {
    alert(e.message || '세트를 불러오지 못했습니다.');
    return false;
  }
}
let selectedFile = "";
document.querySelector("#btnUsePreset").addEventListener("click", () => {
  const val = document.querySelector("#presetSelect").value;
  if (!val) {
    alert("세트를 선택하세요.");
    return;
  }
  selectedFile = val;
  document.querySelector("#btnStartStudy").disabled = false;
});

// -------------------------------
// Step2 → Step3 (학습 시작)
document.querySelector("#btnStartStudy").addEventListener("click", async () => {
  if (!selectedFile) return;
  try {
    const res = await fetch("./data/" + selectedFile);
    const allWords = await res.json();

    // ✅ 30개씩 자르기 (첫 묶음만)
    currentWords = allWords.slice(0, batchSize);

    studyIndex = 0;
    updateStudyUI();
    showStep("step3");
  } catch (err) {
    console.error("단어 파일 불러오기 실패", err);
  }
});

// -------------------------------
// Step3: 학습 UI
function updateStudyUI() {
  const w = currentWords[studyIndex];
  document.querySelector("#studyWord").textContent = w.word;
  document.querySelector("#studyMeaning").textContent = w.meaning;
  document.querySelector("#studyIndex").textContent = studyIndex + 1;
  document.querySelector("#studyTotal").textContent = currentWords.length;
}

// 버튼 이벤트
document.querySelector("#btnPrev").addEventListener("click", () => {
  if (studyIndex > 0) {
    studyIndex--;
    updateStudyUI();
  }
});

document.querySelector("#btnNext").addEventListener("click", () => {
  if (studyIndex < currentWords.length - 1) {
    studyIndex++;
    updateStudyUI();
  }
});

// 음성 출력
document.querySelector("#btnSpeak").addEventListener("click", () => {
  const word = document.querySelector("#studyWord").textContent;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
});

// 학습 → 퀴즈 시작
document.querySelector("#btnGoQuiz").addEventListener("click", () => {
  startQuiz();
  showStep("step4");
});

// -------------------------------
// Step4: 퀴즈
function startQuiz() {
  quizIndex = 0;
  wrongList = [];
  correctCount = 0;
  wrongCount = 0;
  updateQuizUI();
}

function updateQuizUI() {
  const w = currentWords[quizIndex];
  document.querySelector("#quizWord").textContent = w.word;

  // 보기 4개 생성
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
    btn.addEventListener("click", () => {
      handleAnswer(choice === w.meaning);
    });
    choiceList.appendChild(btn);
  });

  document.querySelector("#quizIndex").textContent = quizIndex + 1;
  document.querySelector("#quizTotal").textContent = currentWords.length;
  document.querySelector("#btnNextQuiz").disabled = true;
}

function handleAnswer(correct) {
  if (correct) {
    correctCount++;
  } else {
    wrongCount++;
    wrongList.push(currentWords[quizIndex]);
  }
  document.querySelectorAll(".choice").forEach(btn => btn.disabled = true);
  document.querySelector("#btnNextQuiz").disabled = false;
}

document.querySelector("#btnNextQuiz").addEventListener("click", () => {
  if (quizIndex < currentWords.length - 1) {
    quizIndex++;
    updateQuizUI();
  } else {
    showResult();
  }
});

// -------------------------------
// Step5: 결과
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
}

// 오답만 다시 풀기
document.querySelector("#btnRetryWrong").addEventListener("click", () => {
  if (wrongList.length === 0) return;
  currentWords = wrongList;
  startQuiz();
  showStep("step4");
});

// CSV 내보내기
document.querySelector("#btnExportCsv").addEventListener("click", () => {
  let csv = "단어,뜻\n";
  currentWords.forEach(w => {
    csv += `${w.word},${w.meaning}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "words.csv";
  a.click();
});

// 처음으로
document.querySelector("#btnBackHome").addEventListener("click", () => {
  showStep("step1");
});

