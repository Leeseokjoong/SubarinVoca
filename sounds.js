// 간단한 효과음 헬퍼
window.Sounds = (() => {
  const ok = document.getElementById('correctSound'); // id 맞춤
  const ng = document.getElementById('wrongSound');   // id 맞춤
  if (ok) ok.volume = 0.7;
  if (ng) ng.volume = 0.7;

  async function play(el){
    try{
      el.currentTime = 0;
      await el.play();
    }catch(e){
      console.warn("Sound play failed", e);
    }
  }
  return {
    success(){ ok && play(ok); },
    fail(){ ng && play(ng); }
  };
})();
