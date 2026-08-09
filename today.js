
const $=id=>document.getElementById(id);
const punctuation=new Set(["。","，","？","！",",",".","?","!"]);
let userWords=JSON.parse(localStorage.getItem("chineseUserWordsV4")||"[]");
const WORDS=[...DEFAULT_WORDS,...userWords];

const DAILY_COMPLETE_KEY="meohoDailyStudyCompletedV1";
const SEEN_WORD_KEY="meohoSeenTodayWordIdsV1";
const SEEN_SENT_KEY="meohoSeenTodaySentenceIdsV1";
const SEEN_HSK_KEY="meohoSeenTodayHskIdsV1";
const SEEN_LISTEN_KEY="meohoSeenTodayListeningIdsV1";
const RECENT_WORD_KEY="meohoRecentTodayWordIdsV1";
const RECENT_SENT_KEY="meohoRecentTodaySentenceIdsV1";
const RECENT_HSK_KEY="meohoRecentTodayHskIdsV1";
const RECENT_LISTEN_KEY="meohoRecentTodayListeningIdsV1";
const TODAY_SESSION_KEY="meohoTodayStudySessionV1";

function loadArr(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return []}}
function saveArr(key,a){localStorage.setItem(key,JSON.stringify(a))}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(a,n,exclude){return shuffled(a.filter(x=>x!==exclude)).slice(0,n)}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.82;speechSynthesis.speak(u)}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function p2(n){return String(n).padStart(2,"0")}
function todayLocalKey(){const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function markTodayCompleted(){let a=loadArr(DAILY_COMPLETE_KEY);const k=todayLocalKey();if(!a.includes(k)){a.push(k);a.sort();saveArr(DAILY_COMPLETE_KEY,a)}}

const pinyinMap=new Map();
[...WORDS].sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
function pinyinFor(text){
 let out=[],i=0;while(i<text.length){
  if(punctuation.has(text[i])){out.push(text[i++]);continue}
  let f=null;for(const w of vocabSorted){if(text.startsWith(w,i)){f=w;break}}
  if(f){out.push(pinyinMap.get(f));i+=f.length}else i++;
 }
 return out.join(" ").replace(/\s+([，。？！])/g,"$1")
}

function weightedPick(items,count,weightFn){
 const bag=[...items],out=[];
 while(bag.length&&out.length<count){
   const weights=bag.map(x=>Math.max(1,Number(weightFn(x))||1));
   const total=weights.reduce((a,b)=>a+b,0);
   let r=Math.random()*total,idx=0;
   for(;idx<bag.length;idx++){r-=weights[idx];if(r<=0)break}
   out.push(bag.splice(Math.min(idx,bag.length-1),1)[0]);
 }
 return out;
}
function reviewWeightMaps(){
 const items=typeof getReviewItems==="function"?getReviewItems():[];
 const word=new Map(),sentence=new Map(),hsk=new Map(),listening=new Map();
 items.filter(x=>!x.resolved).forEach(r=>{
   const w=Math.max(1,r.wrongCount||1);
   if(r.type==="word"&&r.wordId) word.set(r.wordId,(word.get(r.wordId)||0)+w);
   if(r.type==="sentence"&&r.sentenceId) sentence.set(r.sentenceId,(sentence.get(r.sentenceId)||0)+w);
   const q=r.quiz;
   if(q&&q.sentence){
     const sid=q.sentence.id;
     sentence.set(sid,(sentence.get(sid)||0)+w);
     const qt=q.type||"";
     hsk.set(`${sid}:${qt}`,(hsk.get(`${sid}:${qt}`)||0)+w);
     if(qt==="listening") listening.set(sid,(listening.get(sid)||0)+w);
   }
   if(typeof r.key==="string"&&r.key.startsWith("quiz:listening:")){
     const lid=r.key.split(":").pop();
     listening.set(lid,(listening.get(lid)||0)+w);
   }
 });
 return {word,sentence,hsk,listening};
}
function pickMixedPriority(pool,count,seenKey,recentKey,idFn,wrongWeightFn){
 const seen=new Set(loadArr(seenKey));
 const recent=new Set(loadArr(recentKey));
 const noRecent=pool.filter(x=>!recent.has(idFn(x)));
 const source=noRecent.length>=count?noRecent:pool;
 const unseen=shuffled(source.filter(x=>!seen.has(idFn(x))));
 const wrong=source.filter(x=>(wrongWeightFn(x)||0)>0);
 const wrongTarget=Math.min(Math.round(count*.30),wrong.length);
 const unseenTarget=Math.min(count-wrongTarget,unseen.length);

 let chosen=[];
 chosen.push(...weightedPick(wrong,wrongTarget,wrongWeightFn));
 const used=new Set(chosen.map(idFn));
 chosen.push(...unseen.filter(x=>!used.has(idFn(x))).slice(0,unseenTarget));

 if(chosen.length<count){
   const used2=new Set(chosen.map(idFn));
   const filler=shuffled(source.filter(x=>!used2.has(idFn(x))));
   chosen.push(...filler.slice(0,count-chosen.length));
 }
 if(chosen.length<count){
   const used3=new Set(chosen.map(idFn));
   chosen.push(...shuffled(pool.filter(x=>!used3.has(idFn(x)))).slice(0,count-chosen.length));
 }

 chosen=shuffled(chosen.slice(0,count));
 const updated=new Set([...seen,...chosen.map(idFn)]);
 if(updated.size>=pool.length) saveArr(seenKey,chosen.map(idFn));
 else saveArr(seenKey,[...updated]);
 saveArr(recentKey,chosen.map(idFn));
 return chosen;
}

function makeSentenceQ(s,type,prefix){
 if(type==="reading"){
   const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
   return {kind:"sentence",section:prefix,type,label:`${prefix} · 독해`,sentence:s,question:s.text,sub:"문장의 뜻으로 알맞은 것을 고르세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
 }
 if(type==="listening"){
   const wrong=sample(SENTENCES.map(x=>x.text),3,s.text);
   return {kind:"sentence",section:prefix,type,label:`${prefix} · 듣기`,sentence:s,question:"문장을 듣고 같은 문장을 고르세요.",sub:"듣기 버튼을 눌러 문장을 확인하세요.",options:shuffled([s.text,...wrong]),answer:s.text};
 }
 return {kind:"sentence",section:prefix,type,label:`${prefix} · 문장 배열`,sentence:s,question:"단어를 올바른 순서로 배열하세요.",sub:"아래 단어를 눌러 문장을 완성하세요.",tokens:shuffled(s.chunks.filter(x=>!punctuation.has(x))),answer:s.chunks.filter(x=>!punctuation.has(x)).join("")};
}

function createFreshSession(){
 const rw=reviewWeightMaps();
 const wordPool=pickMixedPriority(WORDS,Math.min(30,WORDS.length),SEEN_WORD_KEY,RECENT_WORD_KEY,w=>w.id,w=>rw.word.get(w.id)||0);
 const sentencePool=pickMixedPriority(SENTENCES,Math.min(10,SENTENCES.length),SEEN_SENT_KEY,RECENT_SENT_KEY,s=>s.id,s=>rw.sentence.get(s.id)||0);
 const hskCandidates=[];
 SENTENCES.forEach(s=>["reading","order","listening"].forEach(type=>hskCandidates.push({id:`${s.id}:${type}`,s,type})));
 const hskPool=pickMixedPriority(hskCandidates,10,SEEN_HSK_KEY,RECENT_HSK_KEY,x=>x.id,x=>(rw.hsk.get(x.id)||rw.sentence.get(x.s.id)||0));
 const listeningPool=pickMixedPriority(LISTENING_ITEMS,Math.min(5,LISTENING_ITEMS.length),SEEN_LISTEN_KEY,RECENT_LISTEN_KEY,x=>x.id,x=>(rw.listening.get(x.id)||rw.listening.get(x.sentenceId)||rw.sentence.get(x.sentenceId)||0));

 const wordQuestions=wordPool.map((w,i)=>{
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

 const sentenceQuestions=sentencePool.map((s,i)=>makeSentenceQ(s,["reading","order","listening"][i%3],"문장"));
 const hskQuestions=hskPool.map(x=>makeSentenceQ(x.s,x.type,"HSK"));
 const listeningQuestions=listeningPool.map(item=>{
   const s=SENTENCES.find(x=>x.id===item.sentenceId);
   if(item.mode==="same"){
     const wrong=sample(SENTENCES.map(x=>x.text),3,s.text);
     return {kind:"sentence",section:"듣기",type:"listening",listenMode:"same",label:"듣기 · 들은 문장 찾기",sentence:s,question:"들은 문장과 같은 문장을 고르세요.",sub:"재생 버튼을 눌러 문장을 들어보세요.",options:shuffled([s.text,...wrong]),answer:s.text};
   }
   if(item.mode==="meaning"){
     const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
     return {kind:"sentence",section:"듣기",type:"listening",listenMode:"meaning",label:"듣기 · 뜻 고르기",sentence:s,question:"들은 문장의 뜻으로 알맞은 것을 고르세요.",sub:"재생 버튼을 눌러 문장을 들어보세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
   }
   const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
   return {kind:"sentence",section:"듣기",type:"listening",listenMode:"dialogue",label:"듣기 · 내용 이해",sentence:s,question:item.questionKo||"들은 문장의 주요 의미는 무엇인가요?",sub:"재생 버튼을 눌러 문장을 들어보세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
 });

 return {
  date:todayLocalKey(),started:true,section:"word",pos:0,
  wordScore:0,sentenceScore:0,hskScore:0,listeningScore:0,
  wordQuestions,sentenceQuestions,hskQuestions,listeningQuestions
 };
}

function loadSession(){
 let s=null;
 try{s=JSON.parse(localStorage.getItem(TODAY_SESSION_KEY)||"null")}catch(e){}
 if(!s || s.date!==todayLocalKey() || !Array.isArray(s.wordQuestions) || s.wordQuestions.length!==30 || !Array.isArray(s.listeningQuestions) || s.listeningQuestions.length!==5){
   s=createFreshSession();
   localStorage.setItem(TODAY_SESSION_KEY,JSON.stringify(s));
 }
 return s;
}
let session=loadSession();
let section=session.section||"word",pos=session.pos||0;
let wordScore=session.wordScore||0,sentenceScore=session.sentenceScore||0,hskScore=session.hskScore||0,listeningScore=session.listeningScore||0;
const wordQuestions=session.wordQuestions;
const sentenceQuestions=session.sentenceQuestions;
const hskQuestions=session.hskQuestions;
const listeningQuestions=session.listeningQuestions;
let answered=false,current=null,chosenTokens=[];

function persist(){
 session.section=section;session.pos=pos;session.wordScore=wordScore;session.sentenceScore=sentenceScore;session.hskScore=hskScore;session.listeningScore=listeningScore;
 localStorage.setItem(TODAY_SESSION_KEY,JSON.stringify(session));
}
function questions(){return section==="word"?wordQuestions:section==="sentence"?sentenceQuestions:section==="hsk"?hskQuestions:listeningQuestions}
function sectionLabel(){return section==="word"?"단어 학습":section==="sentence"?"문장 학습":section==="hsk"?"HSK 연습":"듣기 학습"}

function syncTab(){
 document.querySelectorAll(".today-tab").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
}

function render(){
 const qs=questions();current=qs[pos];answered=false;chosenTokens=[];syncTab();
 $("todayPart").textContent=sectionLabel();$("todayCount").textContent=`${pos+1} / ${qs.length}`;$("todayProgress").style.width=`${((pos+1)/qs.length)*100}%`;
 $("todayType").textContent=current.label;$("todayQuestion").textContent=current.question;$("todaySub").textContent=current.sub;
 $("todayOptions").innerHTML="";$("todayAnswerBank").innerHTML="";$("todayTokenBank").innerHTML="";
 $("todayAnswerBank").classList.add("hidden-block");$("todayTokenBank").classList.add("hidden-block");$("todayListen").classList.add("hidden-block");
 $("todayFeedback").style.display="none";$("todayNext").style.display="none";
 if(current.type==="listening")$("todayListen").classList.remove("hidden-block");
 if(current.type==="order"){
  $("todayAnswerBank").classList.remove("hidden-block");$("todayTokenBank").classList.remove("hidden-block");
  current.tokens.forEach(t=>{const b=document.createElement("button");b.className="today-token";b.textContent=t;b.onclick=()=>{chosenTokens.push(t);b.disabled=true;renderAnswerBank()};$("todayTokenBank").appendChild(b)});
  const check=document.createElement("button");check.className="today-option";check.textContent="배열 확인";check.onclick=checkOrder;$("todayOptions").appendChild(check);
 }else{
  current.options.forEach(o=>{const b=document.createElement("button");b.className="today-option";b.textContent=o;b.onclick=()=>answerOption(o,b);$("todayOptions").appendChild(b)});
 }
 persist();
}
function renderAnswerBank(){$("todayAnswerBank").innerHTML=chosenTokens.map(t=>`<span class="today-token">${esc(t)}</span>`).join("")}

function wordExplain(q,userAnswer,ok){
 const w=q.word;
 let why=q.type==="meaning"?`‘${w.hanzi}’의 뜻은 ‘${w.meaning}’입니다.`
 :q.type==="hanzi"?`‘${w.meaning}’에 해당하는 중국어 단어는 ‘${w.hanzi}’입니다.`
 :`‘${w.hanzi}’의 표준 병음은 ‘${w.pinyin}’입니다. 성조까지 같이 기억하세요.`;
 return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
 ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer)}</div>`:""}
 <div class="quiz-explain-row"><strong>정답</strong>${esc(q.answer)}</div><div class="quiz-explain-row"><strong>한자</strong>${esc(w.hanzi)}</div>
 <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(w.pinyin)}</span></div>
 <div class="quiz-explain-row"><strong>뜻</strong>${esc(w.meaning)}</div><div class="quiz-explain-row"><strong>품사</strong>${esc(w.pos||"미분류")}</div>
 <div class="quiz-explain-row"><strong>이유</strong>${esc(why)}</div><button class="quiz-explain-listen" onclick="speak('${esc(w.hanzi)}')">🔊 단어 듣기</button></div>`;
}
function componentHtml(s){
 const c=s.components||[];return c.length?`<div class="quiz-explain-row"><strong>문장 성분</strong>${c.map(x=>`${esc(x.text)}(${esc(x.role)})`).join(" / ")}</div>`:"";
}
function sentenceExplain(q,userAnswer,ok){
 const s=q.sentence,correct=q.type==="order"?s.text:q.answer;
 const why=q.type==="reading"?`문장의 전체 뜻과 핵심 단어 ‘${s.focus}’를 기준으로 판단하는 문제입니다.`
 :q.type==="listening"?`듣기에서는 핵심 단어 ‘${s.focus}’와 들리는 어순을 먼저 잡고 전체 의미를 연결하는 것이 중요합니다.`
 :`주어 → 부사어 → 술어 → 목적어를 기본으로 보고 관형어와 보어의 위치를 확인하세요.`;
 return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
 ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
 <div class="quiz-explain-row"><strong>정답</strong>${esc(correct)}</div><div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(pinyinFor(s.text))}</span></div>
 <div class="quiz-explain-row"><strong>해석</strong>${esc(s.meaning)}</div><div class="quiz-explain-row"><strong>이유</strong>${esc(why)}</div>
 <div class="quiz-explain-row"><strong>포인트</strong>핵심 단어: ${esc(s.focus)}</div>${componentHtml(s)}
 <button class="quiz-explain-listen" onclick="speak('${esc(s.text)}')">🔊 정답 문장 듣기</button></div>`;
}
function saveWrong(q,userAnswer){
 if(q.kind==="word"){
  const w=q.word;upsertReviewItem({key:"word:"+w.id,type:"word",source:"오늘의 학습 · 단어",wordId:w.id,hanzi:w.hanzi,pinyin:w.pinyin,meaning:w.meaning});
 }else{
  const s=q.sentence;const snap={type:q.type,label:q.label,question:q.question,sub:q.sub,options:q.options?[...q.options]:null,tokens:q.tokens?[...q.tokens]:null,answer:q.answer,userAnswer:userAnswer||"",sentence:s};
  upsertReviewItem({key:"quiz:today:"+q.type+":"+s.id+":"+q.answer,type:"quiz",source:`오늘의 학습 · ${q.section}`,quiz:snap});
 }
}
function addScore(){if(section==="word")wordScore++;else if(section==="sentence")sentenceScore++;else if(section==="hsk")hskScore++;else listeningScore++}
function answerOption(opt,btn){
 if(answered)return;answered=true;const ok=opt===current.answer;
 if(ok){addScore();btn.classList.add("correct")}else{btn.classList.add("wrong");saveWrong(current,opt);[...$("todayOptions").children].forEach(b=>{if(b.textContent===current.answer)b.classList.add("correct")})}
 $("todayFeedback").style.display="block";$("todayFeedback").innerHTML=current.kind==="word"?wordExplain(current,opt,ok):sentenceExplain(current,opt,ok);$("todayNext").style.display="block";
 persist();
}
function checkOrder(){
 if(answered)return;answered=true;const built=chosenTokens.join(""),ok=built===current.answer;if(ok)addScore();else saveWrong(current,built);
 $("todayFeedback").style.display="block";$("todayFeedback").innerHTML=sentenceExplain(current,built,ok);$("todayNext").style.display="block";persist();
}
function finishSection(){
 if(section==="word"){section="sentence";pos=0}
 else if(section==="sentence"){section="hsk";pos=0}
 else if(section==="hsk"){section="listening";pos=0}
 else return showResult();
 persist();render();
}
function showResult(){
 markTodayCompleted();
 localStorage.removeItem(TODAY_SESSION_KEY);
 $("todayPart").textContent="오늘의 학습 완료";$("todayCount").textContent="55 / 55";$("todayProgress").style.width="100%";
 $("todayCard").innerHTML=`<div class="today-result"><h2>오늘의 학습 완료 🎉</h2><p>틀린 문제는 오답노트에 자동 저장됐어요.</p>
 <div class="today-result-grid" style="grid-template-columns:repeat(4,1fr);max-width:820px">
 <div><strong>${wordScore} / 30</strong><span>단어</span></div><div><strong>${sentenceScore} / 10</strong><span>문장</span></div><div><strong>${hskScore} / 10</strong><span>HSK</span></div><div><strong>${listeningScore} / 5</strong><span>듣기</span></div>
 </div><a class="today-restart" href="index.html" style="display:inline-block;text-decoration:none">홈으로 돌아가기</a></div>`;
}
$("todayNext").onclick=()=>{if(pos+1>=questions().length)finishSection();else{pos++;persist();render()}};
$("todayListen").onclick=()=>{if(current?.sentence)speak(current.sentence.text)};

// Tabs can navigate among sections, and each section's stored position is simplified to start when manually switched.
// Main sequential flow preserves exact current progress.
document.querySelectorAll(".today-tab").forEach(b=>b.onclick=()=>{
 const target=b.dataset.section;
 if(target===section)return;
 // Only allow previously reached sections or start fresh at first item; never loses saved generated questions/scores.
 section=target;pos=0;persist();render();
});

render();
