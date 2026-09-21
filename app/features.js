export function installFeatures({openFile, report}) {
 const panel=document.getElementById('templates');
 document.getElementById('templates-toggle').onclick=()=>{
  panel.hidden=!panel.hidden;
  document.getElementById('templates-toggle').setAttribute('aria-expanded',String(!panel.hidden));
 };
 for(const button of panel.querySelectorAll('button')) button.onclick=async()=>{
  panel.hidden=true;
  document.getElementById('templates-toggle').setAttribute('aria-expanded','false');
  report('이 서식은 지정 계정 전용으로 전환 중입니다. 로그인 설정이 완료되면 이용할 수 있습니다.',true);
 };
 const shield=document.getElementById('drop-shield');
 const hide=()=>{shield.hidden=true;shield.classList.remove('dragging');};
 // Cross-origin editor frames do not bubble drag events to the host.
 // Arm a transparent catcher when Explorer takes focus; normal pointer entry dismisses it.
 window.addEventListener('blur',()=>{shield.hidden=false;});
 shield.addEventListener('pointermove',hide);
 shield.addEventListener('pointerdown',hide);
 window.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 const isFileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 document.addEventListener('dragenter',e=>{if(isFileDrag(e)){e.preventDefault();shield.hidden=false;shield.classList.add('dragging');}},true);
 document.addEventListener('dragover',e=>{if(isFileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}},true);
 shield.addEventListener('dragleave',e=>{if(!e.relatedTarget)hide();});
 document.addEventListener('drop',async e=>{
  if(!isFileDrag(e))return;
  e.preventDefault();e.stopPropagation();hide();
  const files=Array.from(e.dataTransfer.files);
  if(files.length!==1){report('한 번에 HWP/HWPX 파일 하나를 놓아 주세요.',true);return;}
  await openFile(files[0]);
 },true);
 const hint=document.getElementById('hint');
 const grip=document.getElementById('hint-resize');
 const limit=()=>56;
 const resize=height=>{const value=Math.round(Math.max(0,Math.min(limit(),height)));hint.style.height=value+'px';grip.setAttribute('aria-valuenow',value);};
 let start;
 grip.onpointerdown=e=>{if(e.button!==0)return;start={y:e.clientY,height:hint.getBoundingClientRect().height};grip.setPointerCapture(e.pointerId);e.preventDefault();};
 grip.onpointermove=e=>{if(start)resize(start.height+e.clientY-start.y);};
 grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=()=>{start=null;};
 grip.onkeydown=e=>{if(['ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();resize(e.key==='Home'?0:hint.getBoundingClientRect().height+(e.key==='ArrowDown'?8:-8));}};
 window.addEventListener('resize',()=>resize(hint.getBoundingClientRect().height));
}
