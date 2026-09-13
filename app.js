import {createEditor} from './sdk/index.js';
const $=id=>document.getElementById(id);
let editor, fileName='문서.hwp', busy=false, loaded=false;
const heartbeat=()=>fetch('/__heartbeat',{method:'POST',cache:'no-store'}).catch(()=>{});
heartbeat();setInterval(heartbeat,5000);
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function lock(value){busy=value;$('open').disabled=value||!editor;$('save').disabled=value||!loaded;}
try{
  const hasLocalStudio=await fetch('/rhwp/index.html',{method:'HEAD',cache:'no-store'}).then(r=>r.ok).catch(()=>false);
  const studioUrl=hasLocalStudio?location.origin+'/rhwp/':'https://edwardkim.github.io/rhwp/';
  editor=await createEditor('#editor',{studioUrl,requestTimeoutMs:90000});
  lock(false);status('준비 완료');$('welcome').textContent='오른쪽 위 「파일 열기」로 HWP / HWPX 문서를 선택하세요.\n문서는 이 PC의 브라우저에서 처리됩니다.';
}catch(e){status('편집기를 시작하지 못했습니다: '+e.message,true);$('welcome').textContent='실행기를 종료한 뒤 다시 실행해 주세요.';}
$('open').onclick=()=>{if(!busy)$('picker').click();};
$('picker').onchange=async()=>{
 const file=$('picker').files[0];$('picker').value='';if(!file)return;
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

