import {createEditor} from './sdk/index.js';
const $=id=>document.getElementById(id);
let editor, fileName='문서.hwp', busy=false, loaded=false;
let newDocumentRequest=0;
const heartbeat=()=>fetch('/__heartbeat',{method:'POST',cache:'no-store'}).catch(()=>{});
const isLocal=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
if(isLocal){heartbeat();setInterval(heartbeat,5000);}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function lock(value){busy=value;$('open').disabled=value||!editor;$('new').disabled=value||!editor;$('save').disabled=value||!loaded;}
try{
  const hasLocalStudio=isLocal&&await fetch('./rhwp/index.html',{method:'HEAD',cache:'no-store'}).then(r=>r.ok).catch(()=>false);
  const studioUrl=hasLocalStudio?new URL('./rhwp/',location.href).href:'https://edwardkim.github.io/rhwp/';
  editor=await createEditor('#editor',{studioUrl,requestTimeoutMs:90000});
  lock(false);status('준비 완료');$('welcome').textContent='오른쪽 위 「새 문서 작성」으로 시작하거나 「파일 열기」로 HWP / HWPX 문서를 선택하세요.\n문서는 이 PC의 브라우저에서 처리됩니다.';
}catch(e){status('편집기를 시작하지 못했습니다: '+e.message,true);$('welcome').textContent='페이지를 새로고침해 주세요. 인터넷 연결도 확인해 주세요.';}
$('open').onclick=()=>{if(!busy)$('picker').click();};
$('new').onclick=async()=>{
 if(busy||!editor)return;
 const request=++newDocumentRequest;
 const previousStatus=$('status').textContent;
 const wasHidden=$('overlay').hidden;
 lock(true);
 try{
  const before=await editor.getDocumentState();
  // RHWP dispatches creation asynchronously, and may ask about unsaved edits.
  $('overlay').hidden=true;
  const result=await editor.commands.execute('file:new-doc',undefined,{allowDialog:true});
  if(result?.ok===false)throw Error(result.reason||result.error||'새 문서 명령을 실행할 수 없습니다.');
  status('새 문서 작성 요청 · 편집기에 확인 창이 나타나면 선택해 주세요.');
  lock(false);
  // Keep the host usable when RHWP's unsaved-changes dialog is cancelled.
  const deadline=Date.now()+90000;
  while(request===newDocumentRequest&&Date.now()<deadline){
   const state=await editor.getDocumentState();
   if(request!==newDocumentRequest)return;
   if(state.documentEpoch!==before.documentEpoch){
    fileName='새 문서.hwp';loaded=true;$('name').textContent=fileName;
    $('overlay').hidden=true;lock(false);editor.element.focus();
    status('새 문서 · 문서 안을 클릭하여 작성');return;
   }
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(request===newDocumentRequest){$('overlay').hidden=wasHidden;status(previousStatus);}
 }catch(e){
  if(request===newDocumentRequest){$('overlay').hidden=wasHidden;status('새 문서 작성 실패: '+e.message,true);}
 }finally{if(request===newDocumentRequest)lock(false);}
};
$('picker').onchange=async()=>{
 const file=$('picker').files[0];$('picker').value='';if(!file)return;
 ++newDocumentRequest;
 lock(true);status('문서를 여는 중…');
 try{const result=await editor.loadFile(await file.arrayBuffer(),file.name);fileName=file.name;loaded=true;$('name').textContent=fileName;$('overlay').hidden=true;status(result.pageCount+'쪽 · 문서 안을 클릭하여 편집');}
 catch(e){status('열기 실패: '+e.message,true);}
 finally{lock(false);}
};
$('save').onclick=async()=>{
 if(busy||!loaded)return;
 const name=fileName.replace(/\.(hwp|hwpx)$/i,'')+'_수정.hwp';
 lock(true);
 try{
  status('수정본을 만드는 중…');
  const bytes=await editor.exportHwp();
  if(!bytes?.byteLength)throw Error('빈 파일이 반환되었습니다.');
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/x-hwp'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('다운로드 요청 완료 · 다운로드 폴더에서 '+name+' 파일을 확인하세요.');
 }catch(e){if(e.name==='AbortError')status('저장을 취소했습니다. 편집 내용은 유지됩니다.');else status('저장 실패: '+e.message,true);}
 finally{lock(false);}
};

