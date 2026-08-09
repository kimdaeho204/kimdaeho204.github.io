
const $=id=>document.getElementById(id);
const punctuation=new Set(["。","，","？","！",",",".","?","!"]);
let userWords=JSON.parse(localStorage.getItem("chineseUserWordsV4")||"[]");
const WORDS=[...DEFAULT_WORDS,...userWords];

const DAILY_COMPLETE_KEY="meohoDailyStudyCompletedV1";
const SEEN_WORD_KEY="meohoSeenTodayWordIdsV1";
const SEEN_HSK_KEY="meohoSeenTodayHskV2";
const RECENT_WORD_KEY="meohoRecentTodayWordIdsV1";
const RECENT_HSK_KEY="meohoRecentTodayHskV2";
const TODAY_SESSION_KEY="meohoTodayStudySessionV2";
function answerWithPos(text,pos){return `${esc(text)}${pos?` <span class="quiz-pos-badge">${esc(pos)}</span>`:""}`}

function loadArr(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return []}}
function saveArr(key,a){localStorage.setItem(key,JSON.stringify(a))}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(a,n,exclude){return shuffled(a.filter(x=>x!==exclude)).slice(0,n)}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.8;speechSynthesis.speak(u)}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function p2(n){return String(n).padStart(2,"0")}
function todayLocalKey(){const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function markTodayCompleted(){let a=loadArr(DAILY_COMPLETE_KEY);const k=todayLocalKey();if(!a.includes(k)){a.push(k);a.sort();saveArr(DAILY_COMPLETE_KEY,a)}}

const pinyinMap=new Map();
[...WORDS].sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
const TODAY_SESSION_VERSION=61;

// HSK 문장은 단어 공부 데이터에 포함된 어휘만으로 구성된 문장을 우선 사용한다.
// chunks가 합성어처럼 묶여 있어도 단어장의 여러 항목으로 완전히 분해되면 허용한다.
function chunkCoveredByWordBank(chunk){
 if(punctuation.has(chunk))return true;
 let i=0;
 while(i<chunk.length){
  let found=null;
  for(const w of vocabSorted){if(chunk.startsWith(w,i)){found=w;break}}
  if(!found)return false;
  i+=found.length;
 }
 return true;
}
function sentenceCoveredByWordBank(sentence){
 const chunks=(sentence&&Array.isArray(sentence.chunks)&&sentence.chunks.length)?sentence.chunks:[sentence?.text||""];
 return chunks.every(chunkCoveredByWordBank);
}
function pinyinFor(text){
 let out=[],i=0;
 while(i<text.length){
  if(punctuation.has(text[i])){out.push(text[i++]);continue}
  let f=null;for(const w of vocabSorted){if(text.startsWith(w,i)){f=w;break}}
  if(f){out.push(pinyinMap.get(f));i+=f.length}else i++;
 }
 return out.join(" ").replace(/\s+([，。？！])/g,"$1")
}

// Sentence chunks that are not standalone entries in the word bank.
const sentencePinyinFallback={
 "准时":"zhǔnshí","前":"qián","厨房":"chúfáng","变":"biàn","合适":"héshì","堵":"dǔ",
 "学":"xué","店":"diàn","抱怨":"bàoyuàn","改":"gǎi","早":"zǎo","早睡":"zǎo shuì",
 "早起":"zǎo qǐ","汤":"tāng","没":"méi","肚子":"dùzi","设置":"shèzhì","辣":"là",
 "酒店":"jiǔdiàn","雨":"yǔ","鞋":"xié","风":"fēng","食堂":"shítáng","饭":"fàn"
};
function pinyinForChunk(chunk){
 const exact=pinyinMap.get(chunk);
 if(exact)return exact;
 if(sentencePinyinFallback[chunk])return sentencePinyinFallback[chunk];
 const built=pinyinFor(chunk);
 return built||"";
}
function rubySentence(sentence){
 const chunks=(sentence&&Array.isArray(sentence.chunks)&&sentence.chunks.length)?sentence.chunks:[sentence?.text||""];
 return `<span class="pinyin-word-line">${chunks.map(chunk=>{
   if(punctuation.has(chunk))return `<span class="pinyin-punct">${esc(chunk)}</span>`;
   const py=pinyinForChunk(chunk);
   return `<span class="pinyin-word-stack"><span class="pinyin-above">${esc(py||"")}</span><span class="hanzi-below">${esc(chunk)}</span></span>`;
 }).join("")}</span>`;
}

function weightedPick(items,count,weightFn){
 const bag=[...items],out=[];
 while(bag.length&&out.length<count){
   const ws=bag.map(x=>Math.max(1,Number(weightFn(x))||1));
   const total=ws.reduce((a,b)=>a+b,0);
   let r=Math.random()*total,idx=0;
   for(;idx<bag.length;idx++){r-=ws[idx];if(r<=0)break}
   out.push(bag.splice(Math.min(idx,bag.length-1),1)[0]);
 }
 return out;
}
function reviewWeights(){
 const rs=typeof getReviewItems==="function"?getReviewItems():[];
 const word=new Map(),hsk=new Map();
 rs.filter(x=>!x.resolved).forEach(r=>{
   const wt=Math.max(1,r.wrongCount||1);
   if(r.type==="word"&&r.wordId)word.set(r.wordId,(word.get(r.wordId)||0)+wt);
   if(r.quiz){
     const sid=r.quiz.sentence&&r.quiz.sentence.id;
     const t=r.quiz.hskType||r.quiz.type||"";
     if(sid)hsk.set(`${sid}:${t}`,(hsk.get(`${sid}:${t}`)||0)+wt);
     if(r.quiz.word&&r.quiz.word.id)hsk.set(`writeword:${r.quiz.word.id}`,(hsk.get(`writeword:${r.quiz.word.id}`)||0)+wt);
   }
 });
 return {word,hsk};
}
function pickMixed(pool,count,seenKey,recentKey,idFn,weightFn){
 const seen=new Set(loadArr(seenKey)),recent=new Set(loadArr(recentKey));
 const source=pool.filter(x=>!recent.has(idFn(x))).length>=count?pool.filter(x=>!recent.has(idFn(x))):pool;
 const unseen=shuffled(source.filter(x=>!seen.has(idFn(x))));
 const wrong=source.filter(x=>(weightFn(x)||0)>0);
 const wrongTarget=Math.min(Math.round(count*.30),wrong.length);
 let chosen=weightedPick(wrong,wrongTarget,weightFn);
 const used=new Set(chosen.map(idFn));
 chosen.push(...unseen.filter(x=>!used.has(idFn(x))).slice(0,count-chosen.length));
 if(chosen.length<count){
   const used2=new Set(chosen.map(idFn));
   chosen.push(...shuffled(source.filter(x=>!used2.has(idFn(x)))).slice(0,count-chosen.length));
 }
 chosen=shuffled(chosen.slice(0,count));
 const updated=new Set([...seen,...chosen.map(idFn)]);
 if(updated.size>=pool.length)saveArr(seenKey,chosen.map(idFn)); else saveArr(seenKey,[...updated]);
 saveArr(recentKey,chosen.map(idFn));
 return chosen;
}

function makeWordQuestions(pool){
 return pool.map((w,i)=>{
   const type=["meaning","hanzi","pinyin"][i%3];
   if(type==="meaning"){
     const wrong=sample(WORDS.map(x=>x.meaning),3,w.meaning);
     return {kind:"word",type,label:"단어 · 뜻 고르기",word:w,question:w.hanzi,sub:"이 단어의 뜻으로 알맞은 것을 고르세요.",options:shuffled([w.meaning,...wrong]),answer:w.meaning};
   }
   if(type==="hanzi"){
     const wrong=sample(WORDS.map(x=>x.hanzi),3,w.hanzi);
     return {kind:"word",type,label:"단어 · 한자 고르기",word:w,question:w.meaning,sub:"뜻에 맞는 중국어 단어를 고르세요.",options:shuffled([w.hanzi,...wrong]),answer:w.hanzi};
   }
   const wrong=sample(WORDS.map(x=>x.pinyin),3,w.pinyin);
   return {kind:"word",type,label:"단어 · 병음 고르기",word:w,question:w.hanzi,sub:"올바른 병음을 고르세요.",options:shuffled([w.pinyin,...wrong]),answer:w.pinyin};
 });
}

function hskListening(s,idx){
 const mode=idx%2===0?"meaning":"same";
 if(mode==="same"){
  const wrong=sample(SENTENCES.map(x=>x.text),3,s.text);
  return {kind:"hsk",hskType:"listening",type:"listening",label:"HSK 듣기",sentence:s,question:"문장을 듣고 같은 문장을 고르세요.",sub:"재생 버튼을 눌러 들은 문장을 찾으세요.",options:shuffled([s.text,...wrong]),answer:s.text};
 }
 const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
 return {kind:"hsk",hskType:"listening",type:"listening",label:"HSK 듣기",sentence:s,question:"문장을 듣고 뜻으로 알맞은 것을 고르세요.",sub:"재생 버튼을 눌러 문장을 들어보세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
}
function hskReading(s){
 const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
 return {kind:"hsk",hskType:"reading",type:"reading",label:"HSK 독해",sentence:s,question:s.text,sub:"문장의 뜻으로 알맞은 것을 고르세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
}
function hskWritingOrder(s){
 const tokens=s.chunks.filter(x=>!punctuation.has(x));
 return {kind:"hsk",hskType:"writing",type:"order",label:"HSK 쓰기 · 어순 배열",sentence:s,question:s.meaning,sub:"한국어 뜻에 맞게 아래 중국어 단어를 올바른 순서로 배열하세요.",tokens:shuffled(tokens),answer:tokens.join("")};
}
function hskWritingWord(w){
 const wrong=sample(WORDS.map(x=>x.hanzi),3,w.hanzi);
 return {kind:"hsk",hskType:"writing",type:"writeword",label:"HSK 쓰기 · 한자 고르기",word:w,question:w.pinyin,sub:`병음을 보고 뜻 ‘${w.meaning}’에 맞는 한자를 고르세요.`,options:shuffled([w.hanzi,...wrong]),answer:w.hanzi};
}

function createFreshSession(){
 const rw=reviewWeights();
 const wordPool=pickMixed(WORDS,30,SEEN_WORD_KEY,RECENT_WORD_KEY,w=>w.id,w=>rw.word.get(w.id)||0);
 const wordQuestions=makeWordQuestions(wordPool);

 const studySentencePool=SENTENCES.filter(sentenceCoveredByWordBank);
 const listenCandidates=studySentencePool.map(s=>({id:`${s.id}:listening`,s,type:"listening"}));
 const readCandidates=studySentencePool.map(s=>({id:`${s.id}:reading`,s,type:"reading"}));
 const orderCandidates=studySentencePool.map(s=>({id:`${s.id}:writing`,s,type:"writing"}));
 const writeWordCandidates=WORDS.map(w=>({id:`writeword:${w.id}`,w,type:"writeword"}));

 const listenPool=pickMixed(listenCandidates,7,SEEN_HSK_KEY+":listen",RECENT_HSK_KEY+":listen",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const readPool=pickMixed(readCandidates,7,SEEN_HSK_KEY+":read",RECENT_HSK_KEY+":read",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const orderPool=pickMixed(orderCandidates,3,SEEN_HSK_KEY+":writeorder",RECENT_HSK_KEY+":writeorder",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const writeWordPool=pickMixed(writeWordCandidates,3,SEEN_HSK_KEY+":writeword",RECENT_HSK_KEY+":writeword",x=>x.id,x=>rw.hsk.get(x.id)||0);

 const listenQs=listenPool.map((x,i)=>hskListening(x.s,i));
 const readQs=readPool.map(x=>hskReading(x.s));
 const writeQs=[...orderPool.map(x=>hskWritingOrder(x.s)),...writeWordPool.map(x=>hskWritingWord(x.w))];

 const hskQuestions=[...listenQs,...readQs,...writeQs];
 return {version:TODAY_SESSION_VERSION,date:todayLocalKey(),started:true,section:"word",pos:0,wordScore:0,hskScore:0,wordQuestions,hskQuestions};
}
function loadSession(){
 let s=null;
 try{s=JSON.parse(localStorage.getItem(TODAY_SESSION_KEY)||"null")}catch(e){}
 if(!s||s.date!==todayLocalKey()||!Array.isArray(s.wordQuestions)||s.wordQuestions.length!==30||!Array.isArray(s.hskQuestions)||s.hskQuestions.length!==20){
   s=createFreshSession();
   localStorage.setItem(TODAY_SESSION_KEY,JSON.stringify(s));
   return s;
 }
 // v61: 기존 오늘 학습 진행도는 유지하고, 아직 풀지 않은 HSK 문제만 새 어휘 기준으로 교체한다.
 if((s.version||0)<TODAY_SESSION_VERSION){
   const fresh=createFreshSession();
   if(s.section==="hsk"){
     const done=Math.max(0,Math.min(Number(s.pos)||0,20));
     s.hskQuestions=[...s.hskQuestions.slice(0,done),...fresh.hskQuestions.slice(done)];
   }else{
     s.hskQuestions=fresh.hskQuestions;
   }
   s.version=TODAY_SESSION_VERSION;
   localStorage.setItem(TODAY_SESSION_KEY,JSON.stringify(s));
 }
 return s;
}

let session=loadSession();
let section=session.section||"word",pos=session.pos||0;
let wordScore=session.wordScore||0,hskScore=session.hskScore||0;
const wordQuestions=session.wordQuestions,hskQuestions=session.hskQuestions;
let answered=false,current=null,chosenTokens=[],selectedOption=null;

function persist(){session.section=section;session.pos=pos;session.wordScore=wordScore;session.hskScore=hskScore;localStorage.setItem(TODAY_SESSION_KEY,JSON.stringify(session))}
function questions(){return section==="word"?wordQuestions:hskQuestions}
function sectionLabel(){return section==="word"?"단어 학습":"HSK 3급"}
function syncTab(){document.querySelectorAll(".today-tab").forEach(b=>b.classList.toggle("active",b.dataset.section===section))}

function render(){
 const qs=questions();
 if(!qs||!qs.length||!qs[pos]){localStorage.removeItem(TODAY_SESSION_KEY);location.reload();return}
 current=qs[pos];answered=false;chosenTokens=[];selectedOption=null;syncTab();
 $("todayPart").textContent=sectionLabel();
 $("todayCount").textContent=`${pos+1} / ${qs.length}`;
 $("todayProgress").style.width=`${((pos+1)/qs.length)*100}%`;
 $("todayType").textContent=current.label;
 $("todayQuestion").textContent=current.type==="order"&&current.sentence?.meaning?current.sentence.meaning:current.question;
 $("todaySub").textContent=current.type==="order"?"한국어 뜻에 맞게 아래 중국어 단어를 올바른 순서로 배열하세요.":current.sub;
 $("todayOptions").innerHTML="";$("todayAnswerBank").innerHTML="";$("todayTokenBank").innerHTML="";
 $("todayAnswerBank").classList.add("hidden-block");$("todayTokenBank").classList.add("hidden-block");$("todayListen").classList.add("hidden-block");
 $("todayFeedback").style.display="none";$("todayNext").style.display="none";

 if(current.type==="listening")$("todayListen").classList.remove("hidden-block");
 if(current.type==="order"){
   $("todayAnswerBank").classList.remove("hidden-block");$("todayTokenBank").classList.remove("hidden-block");
   renderOrderTokens();
   const controls=document.createElement("div");controls.className="order-controls";
   const undo=document.createElement("button");undo.className="order-control-btn";undo.textContent="↶ 한 칸 되돌리기";
   undo.onclick=()=>{if(answered||!chosenTokens.length)return;chosenTokens.pop();renderOrderTokens()};
   const reset=document.createElement("button");reset.className="order-control-btn";reset.textContent="↺ 처음부터 다시";
   reset.onclick=()=>{if(answered)return;chosenTokens=[];renderOrderTokens()};
   controls.appendChild(undo);controls.appendChild(reset);$("todayOptions").appendChild(controls);
   const check=document.createElement("button");check.className="today-option order-check-btn";check.textContent="배열 확인";check.onclick=checkOrder;$("todayOptions").appendChild(check);
 }else{
   const optionWrap=document.createElement("div");
   optionWrap.className="today-choice-wrap";

   current.options.forEach((o,idx)=>{
     const b=document.createElement("button");
     b.className="today-option today-choice-option";
     b.type="button";
     b.textContent=o;
     b.dataset.optionIndex=String(idx);
     b.onclick=()=>{
       if(answered)return;

       // 단어 문제는 보기를 선택하는 순간 중국어 발음을 들려줍니다.
       // 한자 고르기: 클릭한 중국어 보기 발음 / 뜻·병음 고르기: 문제 단어 발음
       if(current.kind==="word"&&current.word){
         speak(current.type==="hanzi"?o:current.word.hanzi);
       }

       selectedOption=o;
       optionWrap.querySelectorAll(".today-choice-option").forEach(x=>x.classList.remove("selected"));
       b.classList.add("selected");
       submitBtn.disabled=false;
       submitBtn.textContent="답안 제출";
     };
     optionWrap.appendChild(b);
   });

   $("todayOptions").appendChild(optionWrap);

   const submitBtn=document.createElement("button");
   submitBtn.className="today-submit-answer";
   submitBtn.type="button";
   submitBtn.textContent="답을 선택해주세요";
   submitBtn.disabled=true;
   submitBtn.onclick=()=>submitSelectedOption(optionWrap,submitBtn);
   $("todayOptions").appendChild(submitBtn);
 }
 persist();
}
function tokenOccurrenceCount(arr,index){
 const counts={};
 for(let i=0;i<=index;i++)counts[arr[i]]=(counts[arr[i]]||0)+1;
 return counts[arr[index]];
}
function renderOrderTokens(){
 if(!current||current.type!=="order")return;
 const used={};
 chosenTokens.forEach(t=>used[t]=(used[t]||0)+1);

 // Selected answer: clicking a token removes that exact placed token.
 $("todayAnswerBank").innerHTML="";
 chosenTokens.forEach((t,i)=>{
   const b=document.createElement("button");
   b.className="today-token chosen-token";
   b.textContent=t;
   b.dataset.index=String(i);
   b.draggable=!answered;
   b.title="드래그해서 순서를 바꾸거나, 클릭해서 선택지로 돌려보낼 수 있습니다.";

   b.addEventListener("dragstart",e=>{
     if(answered){e.preventDefault();return}
     b.classList.add("dragging");
     e.dataTransfer.effectAllowed="move";
     e.dataTransfer.setData("text/plain",String(i));
   });
   b.addEventListener("dragend",()=>{
     b.classList.remove("dragging");
     document.querySelectorAll(".chosen-token").forEach(x=>x.classList.remove("drag-over-left","drag-over-right"));
   });
   b.addEventListener("dragover",e=>{
     if(answered)return;
     e.preventDefault();
     e.dataTransfer.dropEffect="move";
     document.querySelectorAll(".chosen-token").forEach(x=>x.classList.remove("drag-over-left","drag-over-right"));
     const rect=b.getBoundingClientRect();
     const right=e.clientX>rect.left+rect.width/2;
     b.classList.add(right?"drag-over-right":"drag-over-left");
   });
   b.addEventListener("dragleave",()=>{
     b.classList.remove("drag-over-left","drag-over-right");
   });
   b.addEventListener("drop",e=>{
     if(answered)return;
     e.preventDefault();
     const from=Number(e.dataTransfer.getData("text/plain"));
     const rect=b.getBoundingClientRect();
     let to=i+(e.clientX>rect.left+rect.width/2?1:0);
     if(!Number.isInteger(from)||from<0||from>=chosenTokens.length)return;
     const [moving]=chosenTokens.splice(from,1);
     if(from<to)to--;
     to=Math.max(0,Math.min(to,chosenTokens.length));
     chosenTokens.splice(to,0,moving);
     renderOrderTokens();
   });

   // Keep click-to-remove. Suppress the click immediately following a drag.
   let pointerStart=null,wasDragged=false;
   b.addEventListener("pointerdown",e=>{pointerStart={x:e.clientX,y:e.clientY};wasDragged=false});
   b.addEventListener("pointermove",e=>{
     if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)wasDragged=true;
   });
   b.addEventListener("pointerup",()=>{pointerStart=null});
   b.onclick=()=>{
     if(answered||wasDragged)return;
     chosenTokens.splice(i,1);
     renderOrderTokens();
   };
   $("todayAnswerBank").appendChild(b);
 });

 // Dropping on the answer area itself moves the token to the end.
 $("todayAnswerBank").ondragover=e=>{if(!answered){e.preventDefault();e.dataTransfer.dropEffect="move"}};
 $("todayAnswerBank").ondrop=e=>{
   if(answered||e.target.closest(".chosen-token"))return;
   e.preventDefault();
   const from=Number(e.dataTransfer.getData("text/plain"));
   if(!Number.isInteger(from)||from<0||from>=chosenTokens.length)return;
   const [moving]=chosenTokens.splice(from,1);
   chosenTokens.push(moving);
   renderOrderTokens();
 };

 // Source bank: supports duplicate words by occurrence count.
 $("todayTokenBank").innerHTML="";
 const seenOccurrence={};
 current.tokens.forEach((t,i)=>{
   seenOccurrence[t]=(seenOccurrence[t]||0)+1;
   const occurrence=seenOccurrence[t];
   const b=document.createElement("button");
   b.className="today-token";
   b.textContent=t;
   const isUsed=occurrence<=(used[t]||0);
   b.disabled=isUsed;
   b.onclick=()=>{
     if(answered)return;
     chosenTokens.push(t);
     renderOrderTokens();
   };
   $("todayTokenBank").appendChild(b);
 });
}


function findWordForOption(q,opt){
 if(q.word&&opt===q.answer)return q.word;
 if(q.type==="meaning")return WORDS.find(w=>w.meaning===opt)||null;
 if(q.type==="hanzi"||q.type==="writeword")return WORDS.find(w=>w.hanzi===opt)||null;
 if(q.type==="pinyin")return WORDS.find(w=>w.pinyin===opt)||null;
 return null;
}
function findSentenceForOption(q,opt){
 if(q.sentence&&opt===q.answer)return q.sentence;
 if(q.type==="listening"){
   return SENTENCES.find(s=>s.text===opt)||SENTENCES.find(s=>s.meaning===opt)||null;
 }
 if(q.type==="reading")return SENTENCES.find(s=>s.meaning===opt)||null;
 return null;
}
function optionInfoHtml(q){
 if(!Array.isArray(q.options)||!q.options.length)return "";
 const cards=q.options.map((opt,idx)=>{
   const isCorrect=opt===q.answer;
   const state=isCorrect?"correct":"distractor";
   const badge=isCorrect?"정답":"오답 보기";

   if(q.kind==="word"||q.type==="writeword"){
     const w=findWordForOption(q,opt);
     if(!w){
       return `<div class="option-info-card ${state}"><div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${badge}</span></div><div class="option-info-main">${esc(opt)}</div></div>`;
     }
     return `<div class="option-info-card ${state}">
       <div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${badge}</span></div>
       <div class="option-info-word"><strong>${esc(w.hanzi)}</strong><span>${esc(w.pinyin)}</span></div>
       <div class="option-info-meta"><span><b>뜻</b> ${esc(w.meaning)}</span><span><b>품사</b> ${esc(w.pos||"-")}</span></div>
       <button class="option-info-listen" type="button" data-speak="${esc(w.hanzi)}">🔊 듣기</button>
     </div>`;
   }

   const s=findSentenceForOption(q,opt);
   if(s){
     return `<div class="option-info-card ${state}">
       <div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${badge}</span></div>
       <div class="option-info-sentence">${rubySentence(s)}</div>
       <div class="option-info-meaning"><b>뜻</b> ${esc(s.meaning)}</div>
       <button class="option-info-listen" type="button" data-speak="${esc(s.text)}">🔊 문장 듣기</button>
     </div>`;
   }

   return `<div class="option-info-card ${state}"><div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${badge}</span></div><div class="option-info-main">${esc(opt)}</div></div>`;
 }).join("");
 return `<div class="all-option-info"><div class="all-option-title">보기별 정보</div><div class="all-option-grid">${cards}</div></div>`;
}
function orderTokenInfoHtml(q){
 if(q.type!=="order"||!Array.isArray(q.tokens))return "";
 const unique=[];
 q.tokens.forEach(t=>{if(!unique.includes(t))unique.push(t)});
 const cards=unique.map(t=>{
   const w=WORDS.find(x=>x.hanzi===t)||null;
   const py=w?.pinyin||pinyinForChunk(t)||"-";
   const meaning=w?.meaning||"문장 안에서 의미를 확인하세요.";
   const pos=w?.pos||"문장 구성 요소";
   return `<div class="token-info-card"><div class="token-info-word"><strong>${esc(t)}</strong><span>${esc(py)}</span></div><div class="token-info-meta"><span><b>뜻</b> ${esc(meaning)}</span><span><b>품사</b> ${esc(pos)}</span></div></div>`;
 }).join("");
 return `<div class="all-option-info"><div class="all-option-title">배열 단어 정보</div><div class="all-option-grid">${cards}</div></div>`;
}
function bindInfoListenButtons(){
 document.querySelectorAll(".option-info-listen[data-speak]").forEach(btn=>{
   btn.onclick=()=>speak(btn.dataset.speak||"");
 });
}

function wordExplain(q,userAnswer,ok){
 const w=q.word;
 let why=q.type==="meaning"?`‘${w.hanzi}’의 뜻은 ‘${w.meaning}’입니다.`
 :q.type==="hanzi"?`‘${w.meaning}’에 해당하는 중국어 단어는 ‘${w.hanzi}’입니다.`
 :`‘${w.hanzi}’의 표준 병음은 ‘${w.pinyin}’입니다.`;
 return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
 ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer)}</div>`:""}
 <div class="quiz-explain-row"><strong>정답</strong>${answerWithPos(q.answer,w.pos)}</div>
 <div class="quiz-explain-row"><strong>한자</strong>${esc(w.hanzi)}</div>
 <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(w.pinyin)}</span></div>
 <div class="quiz-explain-row"><strong>뜻</strong>${esc(w.meaning)}</div>
 <div class="quiz-explain-row"><strong>이유</strong>${esc(why)}</div>
 <button class="quiz-explain-listen" onclick="speak('${esc(w.hanzi)}')">🔊 단어 듣기</button>
 ${optionInfoHtml(q)}</div>`;
}
function hskExplain(q,userAnswer,ok){
 if(q.type==="writeword"){
   const w=q.word;
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer)}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${answerWithPos(w.hanzi,w.pos)}</div>
   <div class="quiz-explain-row"><strong>병음</strong>${esc(w.pinyin)}</div>
   <div class="quiz-explain-row"><strong>뜻</strong>${esc(w.meaning)}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>병음과 한자를 함께 연결해서 기억하세요.</div>
   <button class="quiz-explain-listen" onclick="speak('${esc(w.hanzi)}')">🔊 듣기</button>
   ${optionInfoHtml(q)}</div>`;
 }
 const s=q.sentence,correct=q.type==="order"?s.text:q.answer;
 const why=q.hskType==="listening"?"핵심 단어와 술어를 먼저 듣고 전체 의미를 연결하세요."
 :q.hskType==="reading"?"핵심 단어와 문장 구조를 먼저 잡으면 정답을 찾기 쉽습니다."
 :"주어·부사어·술어·목적어의 기본 어순을 먼저 확인하세요.";
 return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
 ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
 <div class="quiz-explain-row"><strong>정답</strong>${esc(correct)}</div>
 <div class="quiz-explain-row ruby-original-row"><strong>원문</strong>${rubySentence(s)}</div>
 <div class="quiz-explain-row"><strong>해석</strong>${esc(s.meaning)}</div>
 <div class="quiz-explain-row"><strong>포인트</strong>핵심 단어: ${esc(s.focus)}</div>
 <div class="quiz-explain-row"><strong>이유</strong>${why}</div>
 <button class="quiz-explain-listen" onclick="speak('${esc(s.text)}')">🔊 정답 문장 듣기</button>
 ${q.type==="order"?orderTokenInfoHtml(q):optionInfoHtml(q)}</div>`;
}
function saveWrong(q,userAnswer){
 if(q.kind==="word"){
  const w=q.word;upsertReviewItem({key:"word:"+w.id,type:"word",source:"오늘의 학습 · 단어",wordId:w.id,hanzi:w.hanzi,pinyin:w.pinyin,meaning:w.meaning});
 }else if(q.type==="writeword"){
  const w=q.word;
  upsertReviewItem({key:"quiz:today:writeword:"+w.id,type:"quiz",source:"오늘의 학습 · HSK 쓰기",quiz:{type:"writeword",hskType:"writing",label:q.label,question:q.question,options:[...q.options],answer:q.answer,userAnswer,word:w}});
 }else{
  const s=q.sentence;
  upsertReviewItem({key:`quiz:today:${q.hskType}:${q.type}:${s.id}`,type:"quiz",source:`오늘의 학습 · HSK ${q.hskType}`,quiz:{type:q.type,hskType:q.hskType,label:q.label,question:q.question,sub:q.sub,options:q.options?[...q.options]:null,tokens:q.tokens?[...q.tokens]:null,answer:q.answer,userAnswer:userAnswer||"",sentence:s}});
 }
}
function addScore(){if(section==="word")wordScore++;else hskScore++}
function submitSelectedOption(optionWrap,submitBtn){
 if(answered||selectedOption===null)return;
 answered=true;
 const opt=selectedOption;
 const ok=opt===current.answer;

 const buttons=[...optionWrap.querySelectorAll(".today-choice-option")];
 buttons.forEach(b=>{
   b.disabled=true;
   if(b.textContent===current.answer)b.classList.add("correct");
   if(b.textContent===opt&&!ok)b.classList.add("wrong");
   b.classList.remove("selected");
 });

 submitBtn.disabled=true;
 submitBtn.textContent=ok?"정답 확인 완료":"오답 확인 완료";

 if(ok)addScore();
 else saveWrong(current,opt);

 $("todayFeedback").style.display="block";
 $("todayFeedback").innerHTML=current.kind==="word"?wordExplain(current,opt,ok):hskExplain(current,opt,ok);
 bindInfoListenButtons();
 $("todayNext").style.display="block";
 persist();
}
function checkOrder(){
 if(answered)return;
 if(chosenTokens.length!==current.tokens.length){
   $("todayFeedback").style.display="block";
   $("todayFeedback").innerHTML=`<div class="quiz-explain"><div class="quiz-explain-title">아직 배열이 완성되지 않았어요</div><div class="quiz-explain-row"><strong>안내</strong>모든 단어를 먼저 배치한 뒤 배열 확인을 눌러주세요.</div></div>`;
   return;
 }
 answered=true;const built=chosenTokens.join(""),ok=built===current.answer;
 if(ok)addScore();else saveWrong(current,built);
 $("todayFeedback").style.display="block";$("todayFeedback").innerHTML=hskExplain(current,built,ok);bindInfoListenButtons();$("todayNext").style.display="block";persist();
}
function finishSection(){
 if(section==="word"){section="hsk";pos=0;persist();render()}
 else showResult();
}
function showResult(){
 markTodayCompleted();localStorage.removeItem(TODAY_SESSION_KEY);
 $("todayPart").textContent="오늘의 학습 완료";$("todayCount").textContent="50 / 50";$("todayProgress").style.width="100%";
 $("todayCard").innerHTML=`<div class="today-result"><h2>오늘의 학습 완료 🎉</h2><p>틀린 문제는 오답노트에 자동 저장됐어요.</p>
 <div class="today-result-grid" style="grid-template-columns:repeat(2,1fr);max-width:520px">
 <div><strong>${wordScore} / 30</strong><span>단어</span></div>
 <div><strong>${hskScore} / 20</strong><span>HSK</span></div>
 </div><a class="today-restart" href="index.html" style="display:inline-block;text-decoration:none">홈으로 돌아가기</a></div>`;
}
$("todayNext").onclick=()=>{if(pos+1>=questions().length)finishSection();else{pos++;persist();render()}};
$("todayListen").onclick=()=>{if(current?.sentence)speak(current.sentence.text)};
document.querySelectorAll(".today-tab").forEach(b=>b.onclick=()=>{section=b.dataset.section;pos=0;persist();render()});
render();
