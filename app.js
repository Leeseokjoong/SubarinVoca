(() => {
  // ===== 설정(발음) =====
  const TTS = { rate: 0.8, gapMs: 800 }; // 속도/간격
  const BATCH_SIZE = 30;                  // 30개씩 묶기

  // ===== 전역 상태 =====
  const state = {
    student: null,
    listName: "local",

    words: [],
    batchIndex: 0,
    studyIndex: 0,
    autoplaySec: 0,
    autoplayTimer: null,

    quizOrder: [],
    quizIndex: 0,
    wrongs: [],

    lastStats: { total: 0, correct: 0, wrong: 0, rate: 0 },

    storageKey(){ return `subrain_vocab_${this.student||'anon'}_${this.listName}`; }
  };

  // ===== 유틸 =====
  const $ = (s) => document.querySelector(s);
  const shuffle = (a)=>{ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const batchCount = ()=> Math.max(1, Math.ceil(state.words.length / BATCH_SIZE));
  const batchRange = (bi)=>{
    const start = bi * BATCH_SIZE;
    const end = Math.min(state.words.length, start + BATCH_SIZE);
    return {start, end};
  };
  const currentBatchWords = ()=>{
    const {start, end} = batchRange(state.batchIndex);
    return state.words.slice(start, end);
  };
  const globalIndexFromBatch = (batchLocalIndex)=> batchRange(state.batchIndex).start + batchLocalIndex;

  // ===== 화면 참조 =====
  const step1 = $('#step1'), step2 = $('#step2'), step3 = $('#step3'), step4 = $('#step4'), step5 = $('#step5'), step6 = $('#step6');

  const btnToStep2 = $('#btnToStep2');
  const studentName = $('#studentName');

  // Step2
  const fileInput = $('#fileInput');
  const btnLoad = $('#btnLoad');
  const btnUseSample = $('#btnUseSample');
  const loadInfo = $('#loadInfo');

  const presetSelect = $('#presetSelect');
  const btnUsePreset = $('#btnUsePreset');

  const batchWrap = $('#batchWrap');
  const batchSelect = $('#batchSelect');
  const btnBatchPrev = $('#btnBatchPrev');
  const btnBatchNext = $('#btnBatchNext');
  const batchInfo = $('#batchInfo');

  const autoplaySec = $('#autoplaySec');
  const ttsLang = $('#ttsLang');
  const btnStartStudy = $('#btnStartStudy');

  // Step3
  const studyWord = $('#studyWord');
  const studyMeaning = $('#studyMeaning');
  const studyIndex = $('#studyIndex');
  const studyTotal = $('#studyTotal');
  const btnSpeak = $('#btnSpeak');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');
  const btnGoQuiz = $('#btnGoQuiz');
  const batchLabel = $('#batchLabel');

  // Step4
  const quizWord = $('#quizWord');
  const quizChoices = $('#quizChoices');
  const quizIndex = $('#quizIndex');
  const quizTotal = $('#quizTotal');
  const batchLabelQuiz = $('#batchLabelQuiz');

  // Step5
  const statCorrect = $('#statCorrect');
  const statWrong = $('#statWrong');
  const statRate = $('#statRate');
  const wrongListWrap = $('#wrongListWrap');
  const btnRetryWrong = $('#btnRetryWrong');
  const btnRedoStudy = $('#btnRedoStudy');
  const btnNextBatch = $('#btnNextBatch');
  const btnToStep6 = $('#btnToStep6');
  const batchLabelResult = $('#batchLabelResult');

  // Step6
  const certStudent = $('#certStudent');
  const certList = $('#certList');
  const certCorrect = $('#certCorrect');
  const certWrong = $('#certWrong');
  const certRate = $('#certRate');
  const certDate = $('#certDate');
  const btnCertHome = $('#btnCertHome');

  function show(el){
    [step1, step2, step3, step4, step5, step6].forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  // ===== 1 → 2 =====
  btnToStep2.addEventListener('click', async () => {
    const name = studentName.value.trim();
    if(!name){ alert('학생 이름을 입력하세요.'); studentName.focus(); return; }
    show(step2);
    // ✅ 2단계로 들어올 때 data/index.json 로딩
    await loadPresetList();
  });

  // ===== data/index.json 로드 → 드롭다운 구성 =====
  async function loadPresetList(){
    if (!presetSelect) return;
    try{
      const res = await fetch('./data/index.json', {cache:'no-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();  // {lists:[{label,file},...]}
      const lists = Array.isArray(data?.lists) ? data.lists : [];
      presetSelect.innerHTML = '';
      if (lists.length === 0) {
        const opt = document.createElement('option');
        opt.value = ''; opt.textContent = '등록된 목록 없음 (data/index.json 편집)';
        presetSelect.appendChild(opt);
        return;
      }
      lists.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.file;                 // e.g. "textbook-full.json"
        opt.textContent = item.label || item.file;
        presetSelect.appendChild(opt);
      });
    }catch(e){
      // index.json이 없거나 에러여도 전체 기능은 동작해야 함
      presetSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '목록 파일(data/index.json)을 찾을 수 없음';
      presetSelect.appendChild(opt);
    }
  }

  // ===== 파일 로드 =====
  async function readFile(file){ return JSON.parse(await file.text()); }
  function refreshBatchUI(){
    const totalB = batchCount();
    batchSelect.innerHTML = '';
    for(let i=0;i<totalB;i++){
      const {start,end} = batchRange(i);
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i+1}번째 묶음 (${start+1}~${end}번)`;
      batchSelect.appendChild(opt);
    }
    batchSelect.value = String(state.batchIndex);

    const total = state.words.length;
    const {start,end} = batchRange(state.batchIndex);
    batchInfo.textContent = `총 ${total}개 단어 · ${totalB}묶음 · 현재 ${state.batchIndex+1}번째 묶음 (${start+1}~${end}번)`;
    batchWrap.style.display = total > 0 ? 'block' : 'none';
  }
  function useWords(words, name='local'){
    state.words = words.filter(w => w.word && w.meaning);
    state.listName = name;
    state.batchIndex = 0;
    state.studyIndex = 0;
    loadInfo.textContent = `불러온 단어: ${state.words.length}개`;
    refreshBatchUI();
  }

  // (A) 미리 준비된 세트 사용 (data/index.json 기반)
  btnUsePreset?.addEventListener('click', async () => {
    const selected = presetSelect?.value || '';
    if(!selected){ alert('세트를 선택하세요. (data/index.json 확인)'); return; }
    try{
      const res = await fetch('./data/' + selected, {cache:'no-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const words = await res.json();
      const baseName = selected.replace(/^.*\//,'').replace(/\.json$/i,'');
      useWords(words, baseName);
    }catch(e){
      alert('세트를 불러오지 못했습니다: ' + (e?.message || e));
    }
  });

  // (B) 샘플 버튼
  btnUseSample.addEventListener('click', async () => {
    try{
      const res = await fetch('./data/words-sample.json', {cache:'no-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const words = await res.json();
      useWords(words, 'sample');
    }catch(e){
      alert('샘플을 불러오지 못했습니다. GitHub Pages 배포가 끝났는지 확인하세요.');
    }
  });

  // (C) 직접 파일로 불러오기
  btnLoad.addEventListener('click', async () => {
    if(!fileInput.files[0]){ alert('단어 JSON 파일을 선택하세요.'); return; }
    try{
      const words = await readFile(fileInput.files[0]);
      useWords(words, fileInput.files[0].name.replace(/\.json$/i,'') || 'list');
    }catch{
      alert('JSON 파싱 오류: 파일 형식을 확인하세요.');
    }
  });

  // 묶음 컨트롤
  batchSelect.addEventListener('change', () => {
    state.batchIndex = Number(batchSelect.value)||0;
    state.studyIndex = 0;
    refreshBatchUI();
  });
  btnBatchPrev.addEventListener('click', () => {
    if(state.batchIndex>0){ state.batchIndex--; state.studyIndex=0; refreshBatchUI(); }
  });
  btnBatchNext.addEventListener('click', () => {
    if(state.batchIndex < batchCount()-1){ state.batchIndex++; state.studyIndex=0; refreshBatchUI(); }
  });

  // ===== 2 → 3 (학습 시작) =====
  btnStartStudy.addEventListener('click', () => {
    if(state.words.length === 0){ alert('먼저 단어 리스트를 불러오세요.'); return; }
    state.student = studentName.value.trim() || 'anon';
    state.autoplaySec = Math.max(0, Number(autoplaySec.value||0));
    state.studyIndex = 0;
    renderStudy();
    show(step3);
  });

  // ===== 학습 =====
  function renderStudy(){
    const list = currentBatchWords();
    const w = list[state.studyIndex];
    if(!w) return;

    studyWord.textContent = w.word;
    studyMeaning.textContent = w.meaning;
    studyIndex.textContent = String(state.studyIndex+1);
    studyTotal.textContent = String(list.length);
    batchLabel.textContent = String(state.batchIndex+1);

    // 자동 2회 발음
    speakSequence(2);

    clearTimeout(state.autoplayTimer);
    if(state.autoplaySec>0){
      state.autoplayTimer = setTimeout(()=> nextStudy(), state.autoplaySec*1000);
    }
  }
  function prevStudy(){ if(state.studyIndex>0){ state.studyIndex--; renderStudy(); } }
  function nextStudy(){
    const list = currentBatchWords();
    if(state.studyIndex < list.length-1){ state.studyIndex++; renderStudy(); }
  }
  btnPrev.addEventListener('click', prevStudy);
  btnNext.addEventListener('click', nextStudy);
  btnSpeak.addEventListener('click', () => speakSequence(1));

  function speakSequence(times=1){
    const list = currentBatchWords();
    const w = list[state.studyIndex]?.word;
    if(!w) return;
    try{
      speechSynthesis.cancel();
      for(let i=0;i<times;i++){
        const u = new SpeechSynthesisUtterance(w);
        u.lang = ttsLang.value || 'en-US';
        u.rate = TTS.rate;
        setTimeout(()=> speechSynthesis.speak(u), i*TTS.gapMs);
      }
    }catch{}
  }

  btnGoQuiz.addEventListener('click', () => startQuizForCurrentBatch());

  // ===== 퀴즈 =====
  function normMeaning(s=""){
    return String(s).toLowerCase().replace(/[()［］\[\]{}「」『』〈〉<>\-~…·•]/g," ").replace(/\s+/g," ").trim();
  }
  function similar(a,b){
    const A = new Set(normMeaning(a).split(" ").filter(Boolean));
    const B = new Set(normMeaning(b).split(" ").filter(Boolean));
    if(!A.size || !B.size) return 0;
    let inter=0; for(const w of A) if(B.has(w)) inter++;
    const union = A.size + B.size - inter;
    return inter/union;
  }
  function uniqueMeanings(allWords){
    const result=[]; outer: for(const w of allWords){
      const m=w.meaning;
      for(const r of result){
        if(normMeaning(r)===normMeaning(m) || similar(r,m)>=0.9) continue outer;
      }
      result.push(m);
    } return result;
  }
  function makeFourChoices(correct, allWords){
    const correctN = normMeaning(correct);
    let pool = uniqueMeanings(allWords)
      .filter(m=>normMeaning(m)!==correctN)
      .filter(m=>similar(m, correct) < 0.7);
    if(pool.length<3){
      pool = uniqueMeanings(allWords)
        .filter(m=>normMeaning(m)!==correctN)
        .filter(m=>similar(m, correct) < 0.9);
    }
    const wrongs = shuffle(pool).slice(0,3);
    while(wrongs.length<3) wrongs.push("—");
    const four = [...wrongs.slice(0,3), correct];

    const seen=new Set(), dedup=[];
    for(const m of four){ const k=normMeaning(m); if(!seen.has(k)){ seen.add(k); dedup.push(m); } }
    while(dedup.length<4) dedup.push(" ");
    return shuffle(dedup.slice(0,4));
  }

  function startQuizForCurrentBatch(){
    const list = currentBatchWords();
    if(list.length===0){ alert('이 묶음에 단어가 없습니다.'); return; }

    state.quizOrder = list.map((_,i)=>i);
    shuffle(state.quizOrder);
    state.quizIndex = 0;
    state.wrongs = [];
    quizTotal.textContent = String(state.quizOrder.length);
    batchLabelQuiz.textContent = String(state.batchIndex+1);
    renderQuiz();
    show(step4);
  }

  function renderQuiz(){
    const list = currentBatchWords();
    const localIdx = state.quizOrder[state.quizIndex];
    const w = list[localIdx];

    quizWord.textContent = w.word;
    quizIndex.textContent = String(state.quizIndex+1);

    const four = makeFourChoices(w.meaning, list.length>=4 ? list : state.words);
    quizChoices.innerHTML = '';
    four.forEach(choice=>{
      const b=document.createElement('button');
      b.className='choice';
      b.textContent=choice;
      b.addEventListener('click', ()=>handleAnswer(w, choice, b, localIdx));
      quizChoices.appendChild(b);
    });
  }

  function handleAnswer(w, chosen, el, localIdx){
    const ok = chosen === w.meaning;
    if(ok){ el.classList.add('correct'); window.Sounds && window.Sounds.success(); }
    else { el.classList.add('wrong');   window.Sounds && window.Sounds.fail();
      state.wrongs.push({ word:w.word, correctMeaning:w.meaning, chosenMeaning:chosen, globalIndex: globalIndexFromBatch(localIdx) });
    }
    [...quizChoices.children].forEach(c=> c.disabled = true);
    setTimeout(()=>{
      if(state.quizIndex < state.quizOrder.length-1){ state.quizIndex++; renderQuiz(); }
      else{ showResult(); }
    }, 650);
  }

  // ===== 결과(5단계) =====
  function showResult(){
    const total = state.quizOrder.length;
    const wrongs = state.wrongs.length;
    const correct = total - wrongs;

    state.lastStats = { total, correct, wrong: wrongs, rate: Math.round((correct/Math.max(1,total))*100) };
    statCorrect.textContent = String(state.lastStats.correct);
    statWrong.textContent   = String(state.lastStats.wrong);
    statRate.textContent    = state.lastStats.rate + '%';
    batchLabelResult.textContent = String(state.batchIndex+1);

    wrongListWrap.innerHTML='';
    if(state.wrongs.length){
      state.wrongs.forEach(w=>{
        const div=document.createElement('div');
        div.className='wrong-item';
        div.textContent=`${w.word} → 정답: ${w.correctMeaning} (선택: ${w.chosenMeaning})`;
        wrongListWrap.appendChild(div);
      });
      btnRetryWrong.disabled=false;
    }else{
      const div=document.createElement('div');
      div.className='muted';
      div.textContent='오답이 없습니다. 완벽!';
      wrongListWrap.appendChild(div);
      btnRetryWrong.disabled=true;
    }
    show(step5);
  }

  btnRetryWrong.addEventListener('click', () => {
    const list = currentBatchWords();
    const start = batchRange(state.batchIndex).start;
    const indices = state.wrongs
      .map(w => w.globalIndex)
      .filter(g => g>=start && g<start+list.length)
      .map(g => g - start);

    if(indices.length===0){ alert('이 묶음에서의 오답이 없습니다.'); return; }
    state.quizOrder = shuffle(indices.slice());
    state.quizIndex = 0;
    state.wrongs = [];
    quizTotal.textContent = String(state.quizOrder.length);
    batchLabelQuiz.textContent = String(state.batchIndex+1);
    renderQuiz();
    show(step4);
  });

  btnRedoStudy.addEventListener('click', () => {
    state.studyIndex = 0;
    renderStudy();
    show(step3);
  });

  btnNextBatch.addEventListener('click', () => {
    if(state.batchIndex < batchCount()-1){
      state.batchIndex++;
      state.studyIndex = 0;
      renderStudy();
      show(step3);
    }else{
      alert('마지막 묶음입니다.');
    }
  });

  btnToStep6.addEventListener('click', () => goCert());

  // ===== 완료 인증(6단계) =====
  function goCert(){
    certStudent.textContent = state.student || '학생';
    certList.textContent = `${state.listName} (총 ${state.words.length}개)`;
    certCorrect.textContent = String(state.lastStats.correct);
    certWrong.textContent   = String(state.lastStats.wrong);
    certRate.textContent    = state.lastStats.rate + '%';
    certDate.textContent    = new Date().toLocaleString();
    show(step6);
  }
  btnCertHome.addEventListener('click', () => location.reload());
})();
// ✅ CSV 저장 기능
document.getElementById("btnExportCsv").addEventListener("click", function () {
  let rows = [
      ["단어", "정답여부"], // CSV 헤더
  ];

  // wrongListWrap 안에 있는 오답 단어들
  let wrongItems = document.querySelectorAll("#wrongListWrap li");
  wrongItems.forEach(item => {
      rows.push([item.innerText, "오답"]);
  });

  // 정답 단어들 (전체 단어 중 오답 제외)
  if (window.currentWords) {
      window.currentWords.forEach(word => {
          let isWrong = Array.from(wrongItems).some(item => item.innerText === word.word);
          if (!isWrong) {
              rows.push([word.word, "정답"]);
          }
      });
  }

  // CSV 문자열 만들기
  let csvContent = rows.map(e => e.join(",")).join("\n");

  // Blob으로 파일 생성
  let blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "quiz_result.csv";
  link.click();
});
