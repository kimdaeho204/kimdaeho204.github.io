
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


// ===== v50 complete sentence analysis =====
// The original sentence bank contains some simplified "어휘" placeholders and
// partial component annotations.  Build learner-friendly display annotations at
// render time so every chunk receives both a POS label and a sentence role.
const POS_OVERRIDES={
  "我":"대명사","我们":"대명사","你":"대명사","你们":"대명사","他":"대명사","他们":"대명사","她":"대명사","她们":"대명사","它":"대명사","谁":"대명사","什么":"대명사","哪儿":"대명사","哪里":"대명사","怎么":"대명사","为什么":"대명사","多少":"대명사","几":"대명사","这个":"대명사","那个":"대명사","这些":"대명사","那些":"대명사",
  "的":"구조조사","地":"구조조사","得":"구조조사","了":"조사","过":"동태조사","着":"동태조사","吗":"어기조사","呢":"어기조사","吧":"어기조사",
  "和":"접속사","但是":"접속사","可是":"접속사","虽然":"접속사","如果":"접속사","因为":"접속사","所以":"접속사","而且":"접속사","或者":"접속사","还是":"접속사","然后":"접속사",
  "在":"개사/동사","从":"개사","跟":"개사","给":"개사/동사","对":"개사","向":"개사","往":"개사","离":"개사","把":"개사","被":"개사","为了":"개사","关于":"개사","除了":"개사",
  "很":"부사","太":"부사","非常":"부사","更":"부사","最":"부사","不":"부사","没":"부사","也":"부사","都":"부사","就":"부사","才":"부사","还":"부사","又":"부사","再":"부사","先":"부사","已经":"부사","正在":"부사","常常":"부사","经常":"부사","刚刚":"부사","马上":"부사","突然":"부사","终于":"부사","一直":"부사","总是":"부사","一起":"부사","只好":"부사","别":"부사","越来越":"부사","可能":"부사","每周":"부사",
  "今天":"명사(시간)","明天":"명사(시간)","昨天":"명사(시간)","现在":"명사(시간)","时候":"명사(시간)","时间":"명사(시간)","上午":"명사(시간)","下午":"명사(시간)","晚上":"명사(시간)","早上":"명사(시간)","今年":"명사(시간)","去年":"명사(시간)","最近":"명사(시간)","一天":"수량구(시간)",
  "上":"방위사/동사","下":"방위사/동사","里":"방위사","外":"방위사","前":"방위사","后":"방위사","左":"방위사","右":"방위사","附近":"방위사",
  "个":"양사","家":"양사/명사","本":"양사","次":"양사","杯":"양사","瓶":"양사","张":"양사","双":"양사","副":"양사","件":"양사","条":"양사","位":"양사","只":"양사","座":"양사","点":"양사(시간)",
  "看书":"동사","请问":"동사","请":"동사","带":"동사","打电话":"동사","下课":"동사","不用":"조동사/부사","吃过":"동사","我要":"대명사+조동사","下车":"동사","打折":"동사","听说":"동사","恭喜":"동사","关心":"동사","看起来":"동사","生气":"형용사/동사","谢谢":"동사","长得":"동사","住得":"동사","早睡":"동사","头疼":"형용사/동사","变":"동사","下着":"동사","雨":"명사","饭":"명사","好处":"명사",
  "干净":"형용사","开心":"형용사","合适":"형용사","大":"형용사","新":"형용사","痒":"형용사","多长":"의문대명사",
  "妈妈":"명사","学校":"명사","晚饭":"명사","站":"명사","我家":"명사구",
  "看书":"동사","开始":"동사","感兴趣":"동사","爬山":"동사","出门":"동사","迟到":"동사"
};
const NUM_CHARS="零〇一二两三四五六七八九十百千万半几";
const MEASURE_CHARS="个家本次杯瓶张双副件条位只座辆节岁米公斤斤块元角分分钟小时天周月年口间层份封盘碗盒包把支枝棵朵门课";
const PREP_WORDS=new Set(["在","从","跟","给","对","向","往","离","把","被","为了","关于","除了"]);
const LINK_WORDS=new Set(["和","但是","可是","虽然","如果","因为","所以","而且","或者","还是","然后"]);
const posByHanzi=new Map(DEFAULT_WORDS.map(w=>[w.hanzi,w.pos]));

function normalizePosLabel(p){
  if(!p||p==="어휘")return "";
  const map={
    "시간명사/부사어":"명사(시간)","양사/시간표현":"양사(시간)","수식구/구조조사":"수식구(대명사+구조조사)",
    "진행부사":"부사","시간부사":"부사","빈도부사":"부사","정도부사":"부사","어기/동태조사":"조사"
  };
  return map[p]||p;
}
function quantityPos(t){
  const qty=new RegExp(`^[${NUM_CHARS}]+[${MEASURE_CHARS}]+$`);
  if(qty.test(t))return "수량구(수사+양사)";
  if(new RegExp(`^[${NUM_CHARS}]+$`).test(t))return "수사";
  if(new RegExp(`^[${MEASURE_CHARS}]$`).test(t))return "양사";
  return "";
}
function sentencePosMap(s){
  const m=new Map();
  (s.pos||[]).forEach(x=>m.set(x.text,x.pos));
  return m;
}
function smartPos(s,t,i,tokens){
  if(POS_OVERRIDES[t]){
    // Resolve a few context-sensitive items.
    if(t==="上"){
      const prev=tokens[i-1]||"",next=tokens[i+1]||"";
      if(["班","课","车","网","大学","大一","大二","大三","大四"].some(x=>next.includes(x)))return "동사";
      if(prev && !PREP_WORDS.has(prev))return "방위사/동사";
    }
    if(t==="家" && i>0 && new RegExp(`^[${NUM_CHARS}]+$`).test(tokens[i-1]))return "양사";
    return POS_OVERRIDES[t];
  }
  const q=quantityPos(t);if(q)return q;
  const original=sentencePosMap(s).get(t);
  const normalized=normalizePosLabel(original);
  if(normalized)return normalized;
  const dict=normalizePosLabel(posByHanzi.get(t));
  if(dict)return dict;
  // Phrase-level patterns that occur in the generated sentence bank.
  if(/^(这|那|哪)[个家件条双份本张杯瓶副]$/.test(t))return "지시대명사+양사";
  if(/^我.+/.test(t))return "명사구";
  if(/^(一|两|三|四|五|六|七|八|九|十|半).+/.test(t))return "수량구";
  // Last-resort contextual inference avoids the old generic "어휘" placeholder.
  const prev=tokens[i-1]||"",next=tokens[i+1]||"";
  if(prev==="很"||prev==="太"||prev==="非常"||prev==="更"||prev==="最")return "형용사";
  if(next==="的")return "명사/동사(수식어)";
  if(i>0 && PREP_WORDS.has(prev))return "명사";
  return "명사/동사(문맥)";
}
function displayPosItems(s){
  const tokens=(s.chunks||[]).filter(t=>!punctuation.has(t));
  return tokens.map((text,i)=>({text,pos:smartPos(s,text,i,tokens)}));
}
function displayComponents(s){
  const tokens=(s.chunks||[]).filter(t=>!punctuation.has(t));
  const posItems=displayPosItems(s);
  const roles=new Array(tokens.length).fill("");
  const comps=s.components||[];

  // Reuse the bank's existing analysis, including phrase annotations such as 在一家.
  tokens.forEach((t,i)=>{
    const exact=comps.find(c=>c.text===t);
    if(exact){roles[i]=exact.role;return;}
    const containing=comps.find(c=>c.text.includes(t));
    if(containing)roles[i]=containing.role;
  });

  // Prepositional phrases function as adverbials. Include every word in the phrase.
  for(let i=0;i<tokens.length;i++){
    if(!PREP_WORDS.has(tokens[i]))continue;
    roles[i]="부사어";
    for(let j=i+1;j<tokens.length;j++){
      const p=posItems[j].pos;
      if(p.includes("동사") && j>i+1)break;
      if(LINK_WORDS.has(tokens[j]))break;
      roles[j]="부사어";
    }
  }

  const firstPredicate=()=>{
    for(let i=0;i<tokens.length;i++){
      const p=posItems[i].pos;
      if((p.includes("동사")||p.includes("형용사"))&&!p.includes("개사"))return i;
    }
    return -1;
  };
  const pred=firstPredicate();

  // Fill every remaining token with a learner-friendly sentence role.
  for(let i=0;i<tokens.length;i++){
    if(roles[i])continue;
    const t=tokens[i],p=posItems[i].pos,prev=tokens[i-1]||"",next=tokens[i+1]||"";
    if(LINK_WORDS.has(t)||p.includes("접속사")){roles[i]="연결어";continue;}
    if(p.includes("조사")){roles[i]=t==="的"?"관형어 표지":t==="得"?"보어 표지":"조사";continue;}
    if(p.includes("부사")||p.includes("시간")||p.includes("개사")){roles[i]="부사어";continue;}
    if(p.includes("수량")||p==="수사"||p.includes("양사")||p.includes("지시대명사+양사")){
      roles[i]=(i+1<tokens.length && posItems[i+1].pos.includes("명사"))?"관형어":(i>pred?"목적어":"관형어");continue;
    }
    if(next==="的"){roles[i]="관형어";continue;}
    if(p.includes("형용사")){
      roles[i]=(i>0 && ["很","太","非常","更","最"].includes(prev))?"술어":"술어";continue;
    }
    if(p.includes("동사")&&!p.includes("명사")){
      roles[i]=(pred>=0&&i>pred&&["去","来","到","完","好","懂","见","开","上","下"].includes(t))?"보어":"술어";continue;
    }
    if(p.includes("대명사")||p.includes("명사")||p.includes("명사구")){
      if(i<pred || pred<0){roles[i]="주어";continue;}
      if(i>0 && tokens[i-1]==="的"){roles[i]=i<pred?"주어":"목적어";continue;}
      roles[i]="목적어";continue;
    }
    roles[i]=i<pred?"주어":"목적어";
  }
  return tokens.map((text,i)=>({text,role:roles[i]||"문장 요소"}));
}
function componentSummary(s){return displayComponents(s).map(c=>`${c.text}(${c.role})`).join(" / ");}

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
  $("componentTags").innerHTML=displayComponents(s).map(x=>`<span class="grammar-tag"><strong>${x.text}</strong>${x.role}</span>`).join("");
  $("posGrid").innerHTML=displayPosItems(s).map(x=>`<div class="pos-item"><div class="word">${x.text}</div><div class="ptype">${x.pos}</div></div>`).join("");
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
    <div class="quiz-explain-row"><strong>포인트</strong>${e.point}</div><div class="quiz-explain-row"><strong>문장 성분</strong>${componentSummary(q.s)}</div>
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
