// 간단한 효과음 헬퍼
window.Sounds = (() => {
  const ok = document.getElementById('correctSound'); // ✅ HTML과 일치
  const ng = document.getElementById('wrongSound');   // ✅ HTML과 일치
  if (ok) ok.volume = 0.7;
  if (ng) ng.volume = 0.7;

  function play(el){
    try{
      el.currentTime = 0;
      el.play();
    }catch(e){
      console.warn("Sound play failed", e);
    }
  }
  return {
    success(){ ok && play(ok); },
    fail(){ ng && play(ng); }
  };
})();



