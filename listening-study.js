
const $=id=>document.getElementById(id);
const punctuation=new Set(["。","，","？","！",",",".","?","!"]);
const sentenceMap=new Map(SENTENCES.map(s=>[s.id,s]));
const pinyinMap=new Map();
DEFAULT_WORDS.slice().sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
function pinyinFor(text){let out=[],i=0;while(i<text.length){if(punctuation.has(text[i])){out.push(text[i++]);continue}let f=null;for(const w of vocabSorted){if(text.startsWith(w,i)){f=w;break}}if(f){out.push(pinyinMap.get(f));i+=f.length}else i++}return out.join(" ").replace(/\s+([，。？！])/g,"$1")}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.78;speechSynthesis.speak(u)}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(a,n,exclude){return shuffled(a.filter(x=>x!==exclude)).slice(0,n)}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

const LISTEN_SEEN_KEY="meohoListeningStudySeenV1";
const LISTEN_RECENT_KEY="meohoListeningStudyRecentV1";
function loadListenSeen(){try{return JSON.parse(localStorage.getItem(LISTEN_SEEN_KEY)||"[]")}catch(e){return []}}
function saveListenSeen(a){localStorage.setItem(LISTEN_SEEN_KEY,JSON.stringify(a))}
function listenWrongWeights(){
 const m=new Map(),sentenceWeight=new Map();
 const rs=typeof getReviewItems==="function"?getReviewItems():[];
 rs.filter(x=>!x.resolved).forEach(r=>{
   const w=Math.max(1,r.wrongCount||1);
   if(typeof r.key==="string"&&r.key.startsWith("quiz:listening:")){
     const lid=r.key.split(":").pop();m.set(lid,(m.get(lid)||0)+w);
   }
   const sid=r.quiz&&r.quiz.sentence&&r.quiz.sentence.id;
   if(sid)sentenceWeight.set(sid,(sentenceWeight.get(sid)||0)+w);
 });
 LISTENING_ITEMS.forEach(x=>{
   const sw=sentenceWeight.get(x.sentenceId)||0;
   if(sw)m.set(x.id,(m.get(x.id)||0)+sw);
 });
 return m;
}
function weightedListenOrder(list,weights){
 const bag=[...list],out=[];
 while(bag.length){
   const ws=bag.map(i=>Math.max(1,weights.get(LISTENING_ITEMS[i].id)||1));
   const total=ws.reduce((a,b)=>a+b,0);let r=Math.random()*total,idx=0;
   for(;idx<bag.length;idx++){r-=ws[idx];if(r<=0)break}
   out.push(bag.splice(Math.min(idx,bag.length-1),1)[0]);
 }
 return out;
}
function buildListenOrder(){
 const seen=new Set(loadListenSeen());
 let recent=[];try{recent=JSON.parse(localStorage.getItem(LISTEN_RECENT_KEY)||"[]")}catch(e){}
 const recentSet=new Set(recent),weights=listenWrongWeights();
 const unseen=[],wrong=[],other=[];
 LISTENING_ITEMS.forEach((x,i)=>{
   if(!seen.has(x.id))unseen.push(i);
   else if((weights.get(x.id)||0)>0)wrong.push(i);
   else other.push(i);
 });
 if(!unseen.length){
   saveListenSeen([]);
   return [...weightedListenOrder(wrong.filter(i=>!recentSet.has(LISTENING_ITEMS[i].id)),weights),...shuffled(other),...weightedListenOrder(wrong.filter(i=>recentSet.has(LISTENING_ITEMS[i].id)),weights)];
 }
 const u=shuffled(unseen.filter(i=>!recentSet.has(LISTENING_ITEMS[i].id)));
 const w=weightedListenOrder(wrong.filter(i=>!recentSet.has(LISTENING_ITEMS[i].id)),weights);
 const out=[];let ui=0,wi=0;
 while(ui<u.length||wi<w.length){
   for(let k=0;k<2&&ui<u.length;k++)out.push(u[ui++]);
   if(wi<w.length)out.push(w[wi++]);
 }
 out.push(...shuffled(unseen.filter(i=>recentSet.has(LISTENING_ITEMS[i].id))));
 const used=new Set(out);out.push(...shuffled(other.filter(i=>!used.has(i))));
 return out;
}
let mode="all",order=buildListenOrder(),pos=0,current=null,answered=false;
function filtered(){return order.filter(i=>mode==="all"||LISTENING_ITEMS[i].mode===mode)}
function currentItem(){const a=filtered();if(!a.length)return null;pos=Math.min(pos,a.length-1);return LISTENING_ITEMS[a[pos]]}
function buildQuestion(item){
 const s=sentenceMap.get(item.sentenceId);
 if(item.mode==="same"){
  const wrong=sample(SENTENCES.map(x=>x.text),3,s.text);
  return {label:"들은 문장 찾기",question:"들은 문장과 같은 문장을 고르세요.",options:shuffled([s.text,...wrong]),answer:s.text,s};
 }
 if(item.mode==="meaning"){
  const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
  return {label:"뜻 고르기",question:"들은 문장의 뜻으로 알맞은 것을 고르세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning,s};
 }
 const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
 return {label:"내용 이해",question:item.questionKo||"문장의 주요 의미는 무엇인가요?",options:shuffled([s.meaning,...wrong]),answer:s.meaning,s};
}
function render(){
 const a=filtered(),item=currentItem();if(!item)return;
 const seen=new Set(loadListenSeen());seen.add(item.id);
 if(seen.size>=LISTENING_ITEMS.length)saveListenSeen([]);else saveListenSeen([...seen]);
 let recent=[];try{recent=JSON.parse(localStorage.getItem(LISTEN_RECENT_KEY)||"[]")}catch(e){}
 recent=[item.id,...recent.filter(x=>x!==item.id)].slice(0,6);
 localStorage.setItem(LISTEN_RECENT_KEY,JSON.stringify(recent));
 current=buildQuestion(item);answered=false;
 $("listenCount").textContent=`${pos+1} / ${a.length}`;$("listenProgress").style.width=`${((pos+1)/a.length)*100}%`;$("listenType").textContent=current.label;
 $("listenQuestion").textContent=current.question;$("listenSub").textContent="재생 버튼을 눌러 문장을 들어보세요.";
 $("listenOptions").innerHTML="";$("listenFeedback").style.display="none";$("listenNext").style.display="none";$("originalBox").style.display="none";
 $("originalCn").textContent=current.s.text;$("originalPy").textContent=pinyinFor(current.s.text);$("originalKo").textContent=current.s.meaning;
 current.options.forEach(o=>{const b=document.createElement("button");b.className="listen-option";b.textContent=o;b.onclick=()=>answer(o,b,item);$("listenOptions").appendChild(b)});
}
function answer(opt,btn,item){
 if(answered)return;answered=true;const ok=opt===current.answer;
 if(ok)btn.classList.add("correct");else{btn.classList.add("wrong");[...$("listenOptions").children].forEach(b=>{if(b.textContent===current.answer)b.classList.add("correct")});saveWrong(item,opt)}
 $("listenFeedback").style.display="block";
 $("listenFeedback").innerHTML=`<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
 ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(opt)}</div>`:""}
 <div class="quiz-explain-row"><strong>정답</strong>${esc(current.answer)}</div>
 <div class="quiz-explain-row"><strong>원문</strong>${esc(current.s.text)}</div>
 <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(pinyinFor(current.s.text))}</span></div>
 <div class="quiz-explain-row"><strong>해석</strong>${esc(current.s.meaning)}</div>
 <div class="quiz-explain-row"><strong>포인트</strong>핵심 단어: ${esc(current.s.focus)}</div>
 <div class="quiz-explain-row"><strong>이유</strong>${item.mode==="same"?"들은 핵심 단어와 어순을 비교하세요.":item.mode==="meaning"?"문장을 모두 번역하기보다 핵심 단어와 술어를 먼저 잡으면 좋아요.":"상황과 핵심 단어를 연결해서 전체 의미를 판단하는 문제예요."}</div>
 <button class="quiz-explain-listen" onclick="speak('${esc(current.s.text)}')">🔊 다시 듣기</button></div>`;
 $("listenNext").style.display="block";
}
function saveWrong(item,userAnswer){
 const s=current.s;
 const snap={type:"listening",label:"듣기 공부 · "+current.label,question:current.question,sub:"HSK 3급 듣기 복습",options:[...current.options],answer:current.answer,userAnswer,sentence:s};
 upsertReviewItem({key:"quiz:listening:"+item.id,type:"quiz",source:"듣기 공부",quiz:snap});
}
$("playListen").onclick=()=>speak(current.s.text);
$("showOriginal").onclick=()=>{$("originalBox").style.display=$("originalBox").style.display==="block"?"none":"block"};
$("listenNext").onclick=()=>{const a=filtered();pos=(pos+1)%a.length;render()};
$("listenShuffle").onclick=()=>{order=buildListenOrder();pos=0;render()};
$("listenMode").onchange=e=>{mode=e.target.value;pos=0;render()};
render();
