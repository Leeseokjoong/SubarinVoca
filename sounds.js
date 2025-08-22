// 간단한 효과음 헬퍼
window.Sounds = (() => {
  const ok = document.getElementById('correct');
  const ng = document.getElementById('wrong');
  if (ok) ok.volume = 0.7;
  if (ng) ng.volume = 0.7;

  function play(el){
    try{
      el.currentTime = 0;
      el.play();
    }catch{}
  }
  return {
    success(){ ok && play(ok); },
    fail(){ ng && play(ng); }
  };
})();

