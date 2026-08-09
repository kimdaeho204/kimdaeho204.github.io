
const $ = id => document.getElementById(id);
const punctuation = new Set(["。","，","？","！",",",".","?","!"]);
let sentenceStates = JSON.parse(localStorage.getItem("sentenceStatesV1") || "{}");
const SENTENCE_SEEN_KEY="meohoSentenceStudySeenV1";
const SENTENCE_RECENT_KEY="meohoSentenceStudyRecentV1";
function loadSentenceSeen(){try{return JSON.parse(localStorage.getItem(SENTENCE_SEEN_KEY)||"[]")}catch(e){return []}}
function saveSentenceSeen(a){localStorage.setItem(SENTENCE_SEEN_KEY,JSON.stringify(a))}
function sentenceWrongWeights(){
 const m=new Map();
 const rs=typeof getReviewItems==="function"?getReviewItems():[];
 rs.filter(x=>!x.resolved).forEach(r=>{
   const w=Math.max(1,r.wrongCount||1);
   const sid=r.sentenceId||(r.quiz&&r.quiz.sentence&&r.quiz.sentence.id);
   if(sid)m.set(sid,(m.get(sid)||0)+w);
 });
 return m;
}
function weightedSentenceOrder(list,weights){
 const bag=[...list],out=[];
 while(bag.length){
   const ws=bag.map(i=>Math.max(1,weights.get(SENTENCES[i].id)||1));
   const total=ws.reduce((a,b)=>a+b,0);let r=Math.random()*total,idx=0;
   for(;idx<bag.length;idx++){r-=ws[idx];if(r<=0)break}
   out.push(bag.splice(Math.min(idx,bag.length-1),1)[0]);
 }
 return out;
}
function buildSentenceOrder(){
 const seen=new Set(loadSentenceSeen());
 const recent=new Set((()=>{try{return JSON.parse(localStorage.getItem(SENTENCE_RECENT_KEY)||"[]")}catch(e){return []}})());
 const weights=sentenceWrongWeights();
 const unseen=[],wrong=[],other=[];
 SENTENCES.forEach((s,i)=>{
   if(!seen.has(s.id))unseen.push(i);
   else if((weights.get(s.id)||0)>0)wrong.push(i);
   else other.push(i);
 });
 const sh=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 if(!unseen.length){
   saveSentenceSeen([]);
   return [...weightedSentenceOrder(wrong.filter(i=>!recent.has(SENTENCES[i].id)),weights),...sh(other),...weightedSentenceOrder(wrong.filter(i=>recent.has(SENTENCES[i].id)),weights)];
 }
 const u=sh(unseen.filter(i=>!recent.has(SENTENCES[i].id)));
 const w=weightedSentenceOrder(wrong.filter(i=>!recent.has(SENTENCES[i].id)),weights);
 const out=[];let ui=0,wi=0;
 while(ui<u.length||wi<w.length){
   for(let k=0;k<2&&ui<u.length;k++)out.push(u[ui++]);
   if(wi<w.length)out.push(w[wi++]);
 }
 out.push(...sh(unseen.filter(i=>recent.has(SENTENCES[i].id))));
 const used=new Set(out);
 out.push(...sh(other.filter(i=>!used.has(i))));
 return out;
}
let learnOrder = buildSentenceOrder();
let learnPos = 0;
let currentCategory = "all", currentLevel = "all";

const pinyinMap = new Map();
[...DEFAULT_WORDS].sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{
  if(!pinyinMap.has(w.hanzi)) pinyinMap.set(w.hanzi,w.pinyin);
});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);

function pinyinFor(text){
  let out=[], i=0;
  while(i<text.length){
    const ch=text[i];
    if(punctuation.has(ch)){out.push(ch);i++;continue;}
    let found=null;
    for(const w of vocabSorted){if(text.startsWith(w,i)){found=w;break;}}
    if(found){out.push(pinyinMap.get(found));i+=found.length;}
    else{i++;}
  }
  return out.join(" ").replace(/\s+([，。？！])/g,"$1");
}
function speakChinese(text){
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.82;
  const vs=speechSynthesis.getVoices();
  const v=vs.find(v=>v.lang?.toLowerCase()==="zh-cn")||vs.find(v=>v.lang?.toLowerCase().startsWith("zh"));
  if(v)u.voice=v;speechSynthesis.speak(u);
}
function filteredIndices(){
  return learnOrder.filter(i=>{
    const s=SENTENCES[i];
    return (currentCategory==="all"||s.category===currentCategory)&&(currentLevel==="all"||s.level===currentLevel);
  });
}
function currentSentence(){
  const arr=filteredIndices(); if(!arr.length)return null;
  learnPos=Math.max(0,Math.min(learnPos,arr.length-1)); return SENTENCES[arr[learnPos]];
}
function renderSentence(){
  const arr=filteredIndices(), s=currentSentence();
  if(s){
    const seen=new Set(loadSentenceSeen());seen.add(s.id);
    if(seen.size>=SENTENCES.length)saveSentenceSeen([]);else saveSentenceSeen([...seen]);
    let recent=[];try{recent=JSON.parse(localStorage.getItem(SENTENCE_RECENT_KEY)||"[]")}catch(e){}
    recent=[s.id,...recent.filter(x=>x!==s.id)].slice(0,8);
    localStorage.setItem(SENTENCE_RECENT_KEY,JSON.stringify(recent));
  }
  if(!s)return;
  $("sentenceCount").textContent=`${learnPos+1} / ${arr.length}`;
  $("sentenceProgress").style.width=`${((learnPos+1)/arr.length)*100}%`;
  $("categoryBadge").textContent=s.category;$("levelBadge").textContent=s.level;
  $("sentenceCn").textContent=s.text;$("sentencePinyin").textContent=pinyinFor(s.text);
  $("sentenceMeaning").textContent=s.meaning;$("focusWord").textContent=s.focus;
  $("componentTags").innerHTML=(s.components||[]).map(x=>`<span class="grammar-tag"><strong>${x.text}</strong>${x.role}</span>`).join("");
  $("posGrid").innerHTML=(s.pos||[]).map(x=>`<div class="pos-item"><div class="word">${x.text}</div><div class="ptype">${x.pos}</div></div>`).join("");
  $("componentBox").classList.add("hidden-block");$("posBox").classList.add("hidden-block");
  $("showComponents").textContent="문장 성분 보기";$("showPos").textContent="품사 보기";
  $("sentencePinyin").classList.add("hidden");$("sentenceMeaning").classList.add("hidden");
  $("showSentencePinyin").textContent="병음 보기 🔊";$("showSentenceMeaning").textContent="뜻 보기";
}
const categories=[...new Set(SENTENCES.map(s=>s.category))];
categories.forEach(c=>{const o=document.createElement("option");o.value=o.textContent=c;$("categoryFilter").appendChild(o)});
$("categoryFilter").onchange=e=>{currentCategory=e.target.value;learnPos=0;renderSentence()};
$("levelFilter").onchange=e=>{currentLevel=e.target.value;learnPos=0;renderSentence()};
$("sentenceNext").onclick=()=>{const a=filteredIndices();learnPos=(learnPos+1)%a.length;renderSentence()};
$("sentencePrev").onclick=()=>{const a=filteredIndices();learnPos=(learnPos-1+a.length)%a.length;renderSentence()};
$("sentenceShuffle").onclick=()=>{learnOrder=buildSentenceOrder();learnPos=0;renderSentence()};
$("showSentencePinyin").onclick=()=>{const s=currentSentence();$("sentencePinyin").classList.remove("hidden");$("showSentencePinyin").textContent="🔊 발음 다시 듣기";speakChinese(s.text)};
$("showSentenceMeaning").onclick=()=>{$("sentenceMeaning").classList.toggle("hidden");$("showSentenceMeaning").textContent=$("sentenceMeaning").classList.contains("hidden")?"뜻 보기":"뜻 숨기기"};
$("sentenceUnknown").onclick=()=>{
 const s=currentSentence();sentenceStates[s.id]="unknown";localStorage.setItem("sentenceStatesV1",JSON.stringify(sentenceStates));
 upsertReviewItem({
   key:"sentence:"+s.id,type:"sentence",source:"문장 학습",
   sentenceId:s.id,text:s.text,meaning:s.meaning,focus:s.focus,category:s.category,level:s.level
 });
 $("sentenceNext").click()
};
$("sentenceKnown").onclick=()=>{
 const s=currentSentence();sentenceStates[s.id]="known";localStorage.setItem("sentenceStatesV1",JSON.stringify(sentenceStates));
 resolveReviewItem("sentence:"+s.id);$("sentenceNext").click()
};


$("showComponents").onclick=()=>{
  $("componentBox").classList.toggle("hidden-block");
  $("showComponents").textContent=$("componentBox").classList.contains("hidden-block")?"문장 성분 보기":"문장 성분 숨기기";
};
$("showPos").onclick=()=>{
  $("posBox").classList.toggle("hidden-block");
  $("showPos").textContent=$("posBox").classList.contains("hidden-block")?"품사 보기":"품사 숨기기";
};

document.querySelectorAll(".sentence-tab").forEach(b=>b.onclick=()=>{
 
$("showComponents").onclick=()=>{
  $("componentBox").classList.toggle("hidden-block");
  $("showComponents").textContent=$("componentBox").classList.contains("hidden-block")?"문장 성분 보기":"문장 성분 숨기기";
};
$("showPos").onclick=()=>{
  $("posBox").classList.toggle("hidden-block");
  $("showPos").textContent=$("posBox").classList.contains("hidden-block")?"품사 보기":"품사 숨기기";
};

document.querySelectorAll(".sentence-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 const learn=b.dataset.tab==="learn";$("learnPane").classList.toggle("hidden-block",!learn);$("quizPane").classList.toggle("hidden-block",learn);
 if(!learn) startQuiz(quizMode);
});

let quizMode="mixed", quizIndex=0, score=0, answered=false, currentQ=null, chosenTokens=[];
document.querySelectorAll(".quiz-mode-card").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".quiz-mode-card").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 quizMode=b.dataset.mode;startQuiz(quizMode);
});
function sample(arr,n,exclude){
 const pool=arr.filter(x=>x!==exclude);const out=[];
 while(out.length<n&&pool.length){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}
 return out;
}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cleanChunks(s){return s.chunks.filter(x=>!punctuation.has(x));}

function makeQuestion(){
 const s=SENTENCES[Math.floor(Math.random()*SENTENCES.length)];
 let type=quizMode;
 if(type==="mixed") type=["reading","order","listening"][Math.floor(Math.random()*3)];
 if(type==="reading"){
   const wrong=sample(SENTENCES.map(x=>x.meaning),3,s.meaning);
   return {type,label:"독해 · 뜻 고르기",s,question:s.text,sub:"문장의 뜻으로 가장 알맞은 것을 고르세요.",options:shuffled([s.meaning,...wrong]),answer:s.meaning};
 }
 if(type==="listening"){
   const wrong=sample(SENTENCES,3,s).map(x=>x.text);
   return {type,label:"듣기 · 문장 찾기",s,question:"문장을 듣고 같은 문장을 고르세요.",sub:"재생 버튼을 눌러 중국어 문장을 들어보세요.",options:shuffled([s.text,...wrong]),answer:s.text};
 }
 return {type,label:"쓰기 · 문장 배열",s,question:"단어를 올바른 순서로 배열하세요.",sub:"아래 단어를 눌러 문장을 완성해보세요.",tokens:shuffled(cleanChunks(s)),answer:cleanChunks(s).join("")};
}
function startQuiz(){
 quizIndex=0;score=0;$("quizScore").textContent="0 / 0";renderQuiz();
}
function renderQuiz(){
 answered=false;chosenTokens=[];currentQ=makeQuestion();
 $("quizType").textContent=currentQ.label;$("quizQuestion").textContent=currentQ.question;$("quizSub").textContent=currentQ.sub;
 $("quizFeedback").style.display="none";$("quizNext").style.display="none";
 $("options").innerHTML="";$("answerBank").innerHTML="";$("tokenBank").innerHTML="";
 $("answerBank").classList.add("hidden-block");$("tokenBank").classList.add("hidden-block");$("listenQuestion").classList.add("hidden-block");
 $("quizProgress").style.width=`${(quizIndex/10)*100}%`;
 if(currentQ.type==="listening"){$("listenQuestion").classList.remove("hidden-block");}
 if(currentQ.type==="order"){
   $("answerBank").classList.remove("hidden-block");$("tokenBank").classList.remove("hidden-block");
   currentQ.tokens.forEach((t,i)=>{const b=document.createElement("button");b.className="token";b.textContent=t;b.onclick=()=>{chosenTokens.push(t);b.disabled=true;renderAnswerBank();};$("tokenBank").appendChild(b)});
   const check=document.createElement("button");check.className="option";check.textContent="배열 확인";check.onclick=checkOrder;$("options").appendChild(check);
 }else{
   currentQ.options.forEach(opt=>{const b=document.createElement("button");b.className="option";b.textContent=opt;b.onclick=()=>answerOption(opt,b);$("options").appendChild(b)});
 }
}
function renderAnswerBank(){
 $("answerBank").innerHTML="";
 chosenTokens.forEach((t,i)=>{const b=document.createElement("button");b.className="token";b.textContent=t;b.onclick=()=>{chosenTokens.splice(i,1);document.querySelectorAll("#tokenBank .token")[i]?.removeAttribute("disabled");renderAnswerBank();};$("answerBank").appendChild(b)});
}
function saveWrongQuiz(q,userAnswer){
 const snapshot={
   type:q.type,label:q.label,question:q.question,sub:q.sub,
   options:q.options?[...q.options]:null,tokens:q.tokens?[...q.tokens]:null,
   answer:q.answer,userAnswer:userAnswer||"",sentence:q.s
 };
 const signature=[q.type,q.s.id,q.answer].join(":");
 upsertReviewItem({
   key:"quiz:"+signature,type:"quiz",source:"HSK 연습",
   quiz:snapshot
 });
}
function answerOption(opt,btn){
 if(answered)return;answered=true;
 const ok=opt===currentQ.answer;
 if(ok){score++;btn.classList.add("correct");resolveReviewItem("quiz:"+[currentQ.type,currentQ.s.id,currentQ.answer].join(":"))}
 else{
   btn.classList.add("wrong");
   [...$("options").children].forEach(b=>{if(b.textContent===currentQ.answer)b.classList.add("correct")});
   saveWrongQuiz(currentQ,opt);
 }
 showFeedback(ok,null,opt);
}
function checkOrder(){
 if(answered)return;answered=true;
 const built=chosenTokens.join(""), ok=built===currentQ.answer;
 if(ok){score++;resolveReviewItem("quiz:"+[currentQ.type,currentQ.s.id,currentQ.answer].join(":"))}
 else saveWrongQuiz(currentQ,built);
 showFeedback(ok,currentQ.s.text,built);
}

function explanationFor(q,userAnswer){
  const s=q.s;
  if(q.type==="reading"){
    return {
      why:`이 문제는 문장의 전체 의미를 묻습니다. 핵심 표현 ‘${s.focus}’와 문장 흐름을 확인하면 정답을 고를 수 있어요.`,
      point:`핵심 단어: ${s.focus}`
    };
  }
  if(q.type==="listening"){
    return {
      why:`듣기에서는 문장 전체를 모두 번역하려 하기보다 들리는 핵심 단어와 어순을 잡는 것이 중요해요. 이 문장의 핵심은 ‘${s.focus}’입니다.`,
      point:`핵심 단어: ${s.focus}`
    };
  }
  return {
    why:`중국어 기본 어순은 보통 ‘주어 + 시간/장소 + 서술어 + 목적어’ 순서입니다. 원래 문장의 어순을 기준으로 배열해야 해요.`,
    point:`핵심 단어: ${s.focus}`
  };
}
function explanationHtml(q,userAnswer,ok){
  const e=explanationFor(q,userAnswer);
  const correct=q.type==="order"?q.s.text:q.answer;
  return `<div class="quiz-explain">
    <div class="quiz-explain-title">${ok?"✅ 정답 해설":"❌ 오답 해설"}</div>
    ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${userAnswer||"-"}</div>`:""}
    <div class="quiz-explain-row"><strong>정답</strong>${correct}</div>
    <div class="quiz-explain-row"><strong>병음</strong><span class="quiz-pinyin">${pinyinFor(q.s.text)}</span></div>
    <div class="quiz-explain-row"><strong>해석</strong>${q.s.meaning}</div>
    <div class="quiz-explain-row"><strong>이유</strong>${e.why}</div>
    <div class="quiz-explain-row"><strong>포인트</strong>${e.point}</div><div class="quiz-explain-row"><strong>문장 성분</strong>${(q.s.components||[]).map(c=>`${c.text}(${c.role})`).join(" / ")}</div>
    <button class="quiz-explain-listen" onclick="speakChinese('${q.s.text.replace(/'/g,"\\'")}')">🔊 정답 문장 듣기</button>
  </div>`;
}

function showFeedback(ok,correctText,userAnswer){
 quizIndex++;$("quizScore").textContent=`${score} / ${quizIndex}`;$("quizProgress").style.width=`${(quizIndex/10)*100}%`;
 $("quizFeedback").style.display="block";
 $("quizFeedback").innerHTML=explanationHtml(currentQ,userAnswer,ok);
 $("quizNext").style.display="block";$("quizNext").textContent=quizIndex>=10?"결과 보기":"다음 문제 →";
}
$("quizNext").onclick=()=>{
 if(quizIndex>=10){
  $("quizQuestion").textContent=`10문제 중 ${score}문제 정답`;
  $("quizSub").textContent=score>=8?"좋아요. HSK형 문장 감각이 잘 잡히고 있어요.":"틀린 문장을 문장 학습에서 다시 확인해보세요.";
  $("options").innerHTML="";$("answerBank").classList.add("hidden-block");$("tokenBank").classList.add("hidden-block");$("listenQuestion").classList.add("hidden-block");
  $("quizFeedback").style.display="none";$("quizNext").textContent="다시 10문제 풀기";$("quizNext").style.display="block";
  const old=$("quizNext").onclick;$("quizNext").onclick=()=>{startQuiz(quizMode);$("quizNext").onclick=old};
 }else renderQuiz();
};
$("listenQuestion").onclick=()=>speakChinese(currentQ.s.text);
renderSentence();
