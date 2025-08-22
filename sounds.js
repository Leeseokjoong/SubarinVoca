window.Sounds = (() => {
  const ok = document.getElementById('correctSound'); 
  const ng = document.getElementById('wrongSound');   
  if (ok) ok.volume = 0.7;
  if (ng) ng.volume = 0.7;

  function play(el){
    try {
      el.currentTime = 0;
      el.play();
    } catch (e) {
      console.error("재생 실패:", e);
    }
  }
  return {
    success(){ console.log("정답 효과음 실행"); ok && play(ok); },
    fail(){ console.log("오답 효과음 실행"); ng && play(ng); }
  };
})();
