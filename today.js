
const $=id=>document.getElementById(id);
const punctuation=new Set(["。","，","？","！",",",".","?","!"]);
let userWords=JSON.parse(localStorage.getItem("chineseUserWordsV4")||"[]");
const WORDS=[...DEFAULT_WORDS,...userWords];

function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(a,n,exclude){return shuffled(a.filter(x=>x!==exclude)).slice(0,n)}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.82;speechSynthesis.speak(u)}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

const pinyinMap=new Map();
WORDS.sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
function pinyinFor(text){
 let out=[],i=0;while(i<text.length){
  if(punctuation.has(text[i])){out.push(text[i++]);continue}
  let f=null;for(const w of vocabSorted){if(text.startsWith(w,i)){f=w;break}}
  if(f){out.push(pinyinMap.get(f));i+=f.length}else i++;
 }
 return out.join(" ").replace(/\s+([，。？！])/g,"$1")
}

// Build 50 unique word questions and 20 unique sentence questions
const wordPool=shuffled([...WORDS]).slice(0,Math.min(50,WORDS.length));
const sentencePool=shuffled([...SENTENCES]).slice(0,Math.min(20,SENTENCES.length));

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

const sentenceQuestions=sentencePool.map((s,i)=>{
 const type=["reading","order","listening"][i%3];
 if(type==="reading"){
   const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
   return {kind:"sentence",type,label:"문장 · 독해",sentence:s,question:s.text,sub:"문장의 뜻으로 알맞은 것을 고르세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
 }
 if(type==="listening"){
   const wrong=sample(SENTENCES.map(x=>x.text),3,s.text);
   return {kind:"sentence",type,label:"문장 · 듣기",sentence:s,question:"문장을 듣고 같은 문장을 고르세요.",sub:"듣기 버튼을 눌러 문장을 확인하세요.",options:shuffled([s.text,...wrong]),answer:s.text};
 }
 return {kind:"sentence",type,label:"문장 · 배열",sentence:s,question:"단어를 올바른 순서로 배열하세요.",sub:"아래 단어를 눌러 문장을 완성하세요.",tokens:shuffled(s.chunks.filter(x=>!punctuation.has(x))),answer:s.chunks.filter(x=>!punctuation.has(x)).join("")};
});

let section="word",pos=0,wordScore=0,sentenceScore=0,answered=false,current=null,chosenTokens=[];
function questions(){return section==="word"?wordQuestions:sentenceQuestions}
function render(){
 const qs=questions(); current=qs[pos]; answered=false;chosenTokens=[];
 $("todayPart").textContent=section==="word"?"단어 학습":"문장 학습";
 $("todayCount").textContent=`${pos+1} / ${qs.length}`;
 $("todayProgress").style.width=`${((pos+1)/qs.length)*100}%`;
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
}
function renderAnswerBank(){$("todayAnswerBank").innerHTML=chosenTokens.map(t=>`<span class="today-token">${esc(t)}</span>`).join("")}

function wordExplain(q,userAnswer,ok){
 const w=q.word;
 let why="";
 if(q.type==="meaning") why=`‘${w.hanzi}’의 뜻은 ‘${w.meaning}’입니다. 한자와 뜻을 직접 연결해서 기억하는 문제예요.`;
 else if(q.type==="hanzi") why=`‘${w.meaning}’에 해당하는 중국어 단어는 ‘${w.hanzi}’입니다.`;
 else why=`‘${w.hanzi}’의 표준 병음은 ‘${w.pinyin}’입니다. 성조까지 함께 확인하세요.`;
 return `<div class="quiz-explain">
  <div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
  ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer)}</div>`:""}
  <div class="quiz-explain-row"><strong>정답</strong>${esc(q.answer)}</div>
  <div class="quiz-explain-row"><strong>한자</strong>${esc(w.hanzi)}</div>
  <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(w.pinyin)}</span></div>
  <div class="quiz-explain-row"><strong>뜻</strong>${esc(w.meaning)}</div>
  <div class="quiz-explain-row"><strong>이유</strong>${esc(why)}</div>
  <button class="quiz-explain-listen" onclick="speak('${esc(w.hanzi)}')">🔊 단어 듣기</button>
 </div>`;
}

function componentHtml(s){
 const comps=(s.components||[]);
 if(!comps.length)return "";
 return `<div class="quiz-explain-row"><strong>문장 성분</strong>${comps.map(c=>`${esc(c.text)}(${esc(c.role)})`).join(" / ")}</div>`;
}

function sentenceExplain(q,userAnswer,ok){
 const s=q.sentence;
 const correct=q.type==="order"?s.text:q.answer;
 const why=q.type==="reading"
  ?`문장의 전체 뜻과 핵심 단어 ‘${s.focus}’를 기준으로 판단하는 문제입니다.`
  :q.type==="listening"
  ?`듣기에서는 핵심 단어 ‘${s.focus}’와 들리는 어순을 잡는 것이 중요합니다.`
  :`문장 배열은 주어 → 시간/장소 → 서술어 → 목적어의 기본 어순을 먼저 확인하면 좋아요.`;
 return `<div class="quiz-explain">
  <div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
  ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
  <div class="quiz-explain-row"><strong>정답</strong>${esc(correct)}</div>
  <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${esc(pinyinFor(s.text))}</span></div>
  <div class="quiz-explain-row"><strong>해석</strong>${esc(s.meaning)}</div>
  <div class="quiz-explain-row"><strong>이유</strong>${esc(why)}</div>
  <div class="quiz-explain-row"><strong>포인트</strong>핵심 단어: ${esc(s.focus)}</div>${componentHtml(s)}
  <button class="quiz-explain-listen" onclick="speak('${esc(s.text)}')">🔊 정답 문장 듣기</button>
 </div>`;
}
function saveWrong(q,userAnswer){
 if(q.kind==="word"){
   const w=q.word;
   upsertReviewItem({key:"word:"+w.id,type:"word",source:"오늘 학습 · 단어",wordId:w.id,hanzi:w.hanzi,pinyin:w.pinyin,meaning:w.meaning});
 }else{
   const s=q.sentence;
   const snapshot={type:q.type,label:q.label,question:q.question,sub:q.sub,options:q.options?[...q.options]:null,tokens:q.tokens?[...q.tokens]:null,answer:q.answer,userAnswer:userAnswer||"",sentence:s};
   upsertReviewItem({key:"quiz:today:"+q.type+":"+s.id+":"+q.answer,type:"quiz",source:"오늘 학습 · 문장",quiz:snapshot});
 }
}
function answerOption(opt,btn){
 if(answered)return;answered=true;const ok=opt===current.answer;
 if(ok){if(section==="word")wordScore++;else sentenceScore++;btn.classList.add("correct")}
 else{btn.classList.add("wrong");saveWrong(current,opt);[...$("todayOptions").children].forEach(b=>{if(b.textContent===current.answer)b.classList.add("correct")})}
 $("todayFeedback").style.display="block";$("todayFeedback").innerHTML=current.kind==="word"?wordExplain(current,opt,ok):sentenceExplain(current,opt,ok);
 $("todayNext").style.display="block";
}
function checkOrder(){
 if(answered)return;answered=true;const built=chosenTokens.join(""),ok=built===current.answer;
 if(ok)sentenceScore++;else saveWrong(current,built);
 $("todayFeedback").style.display="block";$("todayFeedback").innerHTML=sentenceExplain(current,built,ok);
 $("todayNext").style.display="block";
}
function finishSection(){
 if(section==="word"){
   section="sentence";pos=0;document.querySelectorAll(".today-tab").forEach(b=>b.classList.toggle("active",b.dataset.section==="sentence"));render();
 }else showResult();
}
function showResult(){
 $("todayPart").textContent="오늘 학습 완료";$("todayCount").textContent="70 / 70";$("todayProgress").style.width="100%";
 $("todayCard").innerHTML=`<div class="today-result"><h2>오늘 학습 완료 🎉</h2><p>틀린 문제는 오답노트에 자동 저장됐어요.</p><div class="today-result-grid"><div><strong>${wordScore} / 50</strong><span>단어</span></div><div><strong>${sentenceScore} / 20</strong><span>문장</span></div></div><button class="today-restart" onclick="location.reload()">새 랜덤 문제로 다시 풀기</button></div>`;
}
$("todayNext").onclick=()=>{if(pos+1>=questions().length)finishSection();else{pos++;render()}};
$("todayListen").onclick=()=>{if(current?.sentence)speak(current.sentence.text)};
document.querySelectorAll(".today-tab").forEach(b=>b.onclick=()=>{
 section=b.dataset.section;pos=0;document.querySelectorAll(".today-tab").forEach(x=>x.classList.toggle("active",x===b));render();
});
render();
