(() => {
  // -------- 공통 유틸 --------
  const $ = (sel) => document.querySelector(sel);
  const show = (el) => {
    for (const s of document.querySelectorAll('.screen')) s.style.display = 'none';
    el.style.display = 'block';
  };

  // -------- 상태 --------
  const state = {
    student: null,
    listName: 'local',
    words: [],                 // [{word, meaning}]
    studyIndex: 0,
    // 자동 발음
    ttsRepeat: 2,              // 단어가 바뀔 때 자동으로 2번 읽기
    // 퀴즈
    quizOrder: [],
    quizIndex: 0,
    wrongs: [],                // {word, correctMeaning, chosenMeaning}
    // 진행 저장 키
    storageKey() {
      return `subrain_vocab_${this.student || 'anon'}_${this.listName}`;
    }
  };

  // -------- 요소 참조 --------
  const step1 = $('#step1');
  const step2 = $('#step2');
  const step3 = $('#step3');
  const step4 = $('#step4');
  const step5 = $('#step5');

  const studentName = $('#studentName');
  const btnGoStep2 = $('#btnGoStep2');

  const presetSelect = $('#presetSelect');
  const btnUsePreset = $('#btnUsePreset');
  const btnStartStudy = $('#btnStartStudy');
  const btnToStep1 = $('#btnToStep1');
  const loadInfo = $('#loadInfo');

  const studyWord = $('#studyWord');
  const studyMeaning = $('#studyMeaning');
  const studyIndex = $('#studyIndex');
  const studyTotal = $('#studyTotal');
  const btnSpeak = $('#btnSpeak');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');
  const btnGoQuiz = $('#btnGoQuiz');

  const btnQuitQuiz = $('#btnQuitQuiz');
  const quizWord = $('#quizWord');
  const quizIndex = $('#quizIndex');
  const quizTotal = $('#quizTotal');
  const choiceList = $('#choiceList');
  const btnNextQuiz = $('#btnNextQuiz');

  const statCorrect = $('#statCorrect');
  const statWrong = $('#statWrong');
  const statRate = $('#statRate');
  const batchLabelResult = $('#batchLabelResult');
  const wrongListWrap = $('#wrongListWrap');
  const btnRetryWrong = $('#btnRetryWrong');
  const btnExportCsv = $('#btnExportCsv');
  const btnBackHome = $('#btnBackHome');

  // -------- 초기화 --------
  // 초기화: DOM이 완전히 준비된 뒤 안전하게 실행
(function init() {
  try {
    // 1단계 먼저 보여주고
    show(document.getElementById('step1'));
    // 메뉴판(data/index.json) 불러오기 시도
    loadPresetList();
    console.log('app.js init OK');
  } catch (e) {
    console.error('초기화 중 오류:', e);
    // 문제가 있으면 1단계는 보이도록 유지
    document.getElementById('step1').style.display = 'block';
  }
})();


  // 1단계 → 2단계
  btnGoStep2.addEventListener('click', () => {
    if (!studentName.value.trim()) {
      alert('학생 이름을 입력하세요.');
      studentName.focus();
      return;
    }
    state.student = studentName.value.trim();
    show(step2);
  });

  // 2단계: 목록 불러오기
  async function loadPresetList() {
    try {
      const res = await fetch('./data/index.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('index.json을 불러오지 못했습니다.');
      const data = await res.json();
      presetSelect.innerHTML = '';
      (data.lists || []).forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.file;
        opt.textContent = item.label;
        presetSelect.appendChild(opt);
      });
      if (!presetSelect.options.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '목록이 없습니다';
        presetSelect.appendChild(opt);
      }
    } catch (e) {
      presetSelect.innerHTML = `<option value="">목록을 불러오지 못했습니다</option>`;
      console.error(e);
    }
  }

  // 선택한 세트 사용
  btnUsePreset.addEventListener('click', async () => {
    const file = presetSelect.value;
    if (!file) return alert('세트를 선택하세요.');
    try {
      const res = await fetch(`./data/${file}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`세트를 불러오지 못했습니다: HTTP ${res.status}`);
      const words = await res.json();
      useWords(words, file.replace(/\.json$/i, ''));
    } catch (e) {
      alert(e.message || '세트를 불러오지 못했습니다.');
    }
  });

  function useWords(words, listName = 'list') {
    state.words = (words || []).filter(w => w.word && w.meaning);
    state.listName = listName;
    studyTotal.textContent = state.words.length;
    loadInfo.textContent = `불러온 단어: ${state.words.length}개`;
    btnStartStudy.disabled = state.words.length === 0;
  }

  // 2단계 버튼들
  btnToStep1.addEventListener('click', () => show(step1));
  btnStartStudy.addEventListener('click', () => {
    if (!state.words.length) return;
    state.studyIndex = 0;
    renderStudy(true);
    show(step3);
  });

  // -------- 학습 화면 --------
  function tts(text) {
    if (!text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9; // 조금 느리게
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  }

  function renderStudy(autoSpeak = false) {
    const w = state.words[state.studyIndex];
    if (!w) return;
    studyWord.textContent = w.word;
    studyMeaning.textContent = w.meaning;
    studyIndex.textContent = state.studyIndex + 1;
    studyTotal.textContent = state.words.length;

    // 단어가 바뀔 때 자동으로 2번 읽기
    if (autoSpeak) {
      let count = 0;
      const speakTwice = () => {
        if (count >= state.ttsRepeat) return;
        tts(w.word);
        count++;
        setTimeout(speakTwice, 800); // 간격
      };
      speakTwice();
    }
  }

  btnPrev.addEventListener('click', () => {
    if (state.studyIndex > 0) {
      state.studyIndex--;
      renderStudy(true);
    }
  });
  btnNext.addEventListener('click', () => {
    if (state.studyIndex < state.words.length - 1) {
      state.studyIndex++;
      renderStudy(true);
    }
  });
  btnSpeak.addEventListener('click', () => tts(state.words[state.studyIndex]?.word));

  btnGoQuiz.addEventListener('click', () => startQuiz(state.words.map((_, i) => i)));

  // -------- 퀴즈 --------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startQuiz(indices) {
    if (!indices.length) return;
    state.quizOrder = shuffle(indices.slice());
    state.quizIndex = 0;
    state.wrongs = [];
    quizTotal.textContent = state.quizOrder.length;
    renderQuiz();
    show(step4);
  }

  function renderQuiz() {
    btnNextQuiz.disabled = true;
    const idx = state.quizOrder[state.quizIndex];
    const w = state.words[idx];
    quizWord.textContent = w.word;
    quizIndex.textContent = state.quizIndex + 1;

    // 보기: 정답 1 + 오답 3 (중복 제거)
    const pool = state.words.map(x => x.meaning);
    const correct = w.meaning;
    const used = new Set([correct]);
    const choices = [correct];
    shuffle(pool);
    for (const m of pool) {
      if (choices.length >= 4) break;
      if (!used.has(m)) {
        used.add(m);
        choices.push(m);
      }
    }
    shuffle(choices);

    choiceList.innerHTML = '';
    choices.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = m;
      btn.addEventListener('click', () => onAnswer(w, m, btn));
      choiceList.appendChild(btn);
    });
  }

  function onAnswer(w, chosen, el) {
    const isCorrect = chosen === w.meaning;
    [...choiceList.children].forEach(c => c.disabled = true);

    if (isCorrect) {
      el.classList.add('correct');
      window.Sounds?.success();
      // 정답이면 자동으로 다음 문제로
      setTimeout(nextQuiz, 500);
    } else {
      el.classList.add('wrong');
      window.Sounds?.fail();
      state.wrongs.push({ word: w.word, correctMeaning: w.meaning, chosenMeaning: chosen });
      btnNextQuiz.disabled = false;
    }
    persistProgress(isCorrect);
  }

  function nextQuiz() {
    if (state.quizIndex < state.quizOrder.length - 1) {
      state.quizIndex++;
      renderQuiz();
    } else {
      showResult();
    }
  }

  btnNextQuiz.addEventListener('click', nextQuiz);
  btnQuitQuiz.addEventListener('click', showResult);

  function persistProgress(isCorrect) {
    const key = state.storageKey();
    const now = new Date().toISOString();
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const entryKey = `${state.quizOrder[state.quizIndex]}:${now}`;
    data[entryKey] = { isCorrect, word: quizWord.textContent, time: now };
    localStorage.setItem(key, JSON.stringify(data));
  }

  // -------- 결과 --------
  function showResult() {
    const total = state.quizOrder.length;
    const wrongs = state.wrongs;
    const correct = total - wrongs.length;

    statCorrect.textContent = correct;
    statWrong.textContent = wrongs.length;
    statRate.textContent = Math.round((correct / Math.max(1, total)) * 100) + '%';
    batchLabelResult.textContent = '1';

    wrongListWrap.innerHTML = '';
    if (wrongs.length) {
      wrongs.forEach(w => {
        const div = document.createElement('div');
        div.className = 'wrong-item';
        div.textContent = `${w.word} → 정답: ${w.correctMeaning} (선택: ${w.chosenMeaning})`;
        wrongListWrap.appendChild(div);
      });
      btnRetryWrong.disabled = false;
    } else {
      const div = document.createElement('div');
      div.className = 'muted';
      div.textContent = '오답이 없습니다. 완벽!';
      wrongListWrap.appendChild(div);
      btnRetryWrong.disabled = true;
    }
    show(step5);
  }

  btnRetryWrong.addEventListener('click', () => {
    const map = new Map(state.words.map((w, i) => [w.word, i]));
    const indices = [];
    state.wrongs.forEach(w => {
      const i = map.get(w.word);
      if (i != null) indices.push(i);
    });
    startQuiz(indices);
  });

  // CSV 내보내기 (선생님용)
  btnExportCsv.addEventListener('click', () => {
    const key = state.storageKey();
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const rows = [['student', 'list', 'word', 'isCorrect', 'time']];
    Object.values(data).forEach(v => {
      rows.push([state.student, state.listName, v.word, v.isCorrect ? '1' : '0', v.time]);
    });
    const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `subrain_${state.student}_${state.listName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnBackHome.addEventListener('click', () => location.reload());
})();


