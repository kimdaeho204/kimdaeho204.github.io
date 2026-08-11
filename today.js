
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
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.75;speechSynthesis.speak(u)}
function speakListeningQuestion(q){
 if(!("speechSynthesis" in window))return;
 speechSynthesis.cancel();
 const parts=Array.isArray(q.audioParts)&&q.audioParts.length?q.audioParts:[{role:"narrator",text:q.sentence?.text||""}];
 const voices=speechSynthesis.getVoices().filter(v=>String(v.lang||"").toLowerCase().startsWith("zh"));
 const male=voices.find(v=>/male|yunxi|xiaoxiao/i.test(v.name))||voices[0];
 const female=voices.find(v=>v!==male)||voices[1]||voices[0];
 let i=0;
 const next=()=>{
   if(i>=parts.length)return;
   const part=parts[i++];
   const u=new SpeechSynthesisUtterance(part.text);
   u.lang="zh-CN";u.rate=.75;
   if(part.role==="male"&&male)u.voice=male;
   else if(part.role==="female"&&female)u.voice=female;
   else if(voices[0])u.voice=voices[0];
   u.onend=()=>setTimeout(next,part.role==="narrator"?350:260);
   speechSynthesis.speak(u);
 };
 next();
}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function p2(n){return String(n).padStart(2,"0")}
function todayLocalKey(){const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function markTodayCompleted(){let a=loadArr(DAILY_COMPLETE_KEY);const k=todayLocalKey();if(!a.includes(k)){a.push(k);a.sort();saveArr(DAILY_COMPLETE_KEY,a)}}

const pinyinMap=new Map();
[...WORDS].sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
const TODAY_SESSION_VERSION=67;

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
function greedyChunks(text){
 const out=[];let i=0;
 while(i<text.length){
   const ch=text[i];
   if(/\s/.test(ch)){i++;continue}
   if(punctuation.has(ch)||ch==="："||ch==="；"){out.push(ch);i++;continue}
   let found=null;
   for(const w of vocabSorted){if(text.startsWith(w,i)){found=w;break}}
   if(found){out.push(found);i+=found.length}else{out.push(ch);i++}
 }
 return out;
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
     const qid=r.quiz.questionId||"";
     if(qid)hsk.set(qid,(hsk.get(qid)||0)+wt);
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
function pickListeningPriority(pool,count,seenKey,recentKey,idFn,weightFn){
 const seen=new Set(loadArr(seenKey));
 const recent=new Set(loadArr(recentKey));
 const nonRecent=pool.filter(x=>!recent.has(idFn(x)));
 const source=nonRecent.length>=count?nonRecent:pool;
 const unseen=shuffled(source.filter(x=>!seen.has(idFn(x))));
 const wrong=source.filter(x=>seen.has(idFn(x))&&(weightFn(x)||0)>0);
 const normal=source.filter(x=>seen.has(idFn(x))&&(weightFn(x)||0)<=0);
 const chosen=[];
 // 1) 아직 한 번도 출제되지 않은 문제를 최우선으로 채운다.
 chosen.push(...unseen.slice(0,count));
 // 2) 미출제로 다 못 채우면 틀린 문제를 오답 횟수 가중치로 채운다.
 if(chosen.length<count){
   const used=new Set(chosen.map(idFn));
   chosen.push(...weightedPick(wrong.filter(x=>!used.has(idFn(x))),count-chosen.length,x=>Math.max(1,weightFn(x)||1)));
 }
 // 3) 그래도 부족하면 이미 본 일반 문제 중 최근 문제를 피해 채운다.
 if(chosen.length<count){
   const used=new Set(chosen.map(idFn));
   chosen.push(...shuffled(normal.filter(x=>!used.has(idFn(x)))).slice(0,count-chosen.length));
 }
 // 최근 제외 때문에 부족한 극단적 경우에만 전체 풀에서 보충한다.
 if(chosen.length<count){
   const used=new Set(chosen.map(idFn));
   chosen.push(...shuffled(pool.filter(x=>!used.has(idFn(x)))).slice(0,count-chosen.length));
 }
 const final=shuffled(chosen.slice(0,count));
 saveArr(seenKey,[...new Set([...seen,...final.map(idFn)])]);
 saveArr(recentKey,final.map(idFn));
 return final;
}


function makeWordQuestions(pool){
 return pool.map((w,i)=>{
   const type=["meaning","hanzi","pinyin"][i%3];
   let choiceWords=[];
   if(type==="meaning"){
     const wrongWords=sample(WORDS.filter(x=>x.id!==w.id),3,null);
     choiceWords=shuffled([w,...wrongWords]);
     return {kind:"word",type,label:"단어 · 뜻 고르기",word:w,question:w.hanzi,sub:"이 단어의 뜻으로 알맞은 것을 고르세요.",options:choiceWords.map(x=>x.meaning),optionWordIds:choiceWords.map(x=>x.id),answer:w.meaning};
   }
   if(type==="hanzi"){
     const wrongWords=sample(WORDS.filter(x=>x.id!==w.id),3,null);
     choiceWords=shuffled([w,...wrongWords]);
     return {kind:"word",type,label:"단어 · 한자 고르기",word:w,question:w.meaning,sub:"뜻에 맞는 중국어 단어를 고르세요.",options:choiceWords.map(x=>x.hanzi),optionWordIds:choiceWords.map(x=>x.id),answer:w.hanzi};
   }
   const wrongWords=sample(WORDS.filter(x=>x.id!==w.id),3,null);
   choiceWords=shuffled([w,...wrongWords]);
   return {kind:"word",type,label:"단어 · 병음 고르기",word:w,question:w.hanzi,sub:"올바른 병음을 고르세요.",options:choiceWords.map(x=>x.pinyin),optionWordIds:choiceWords.map(x=>x.id),answer:w.pinyin};
 });
}

const HSK_LISTENING_BANK=[{"id":"L001","label":"HSK 듣기 · 시간 찾기","parts":[{"role":"male","text":"你明天几点去公司？"},{"role":"female","text":"我八点去。"},{"role":"narrator","text":"问：女的几点去公司？"}],"options":["七点","八点","九点","十点"],"answer":"八点","meaning":"여자는 내일 8시에 회사에 갑니다.","focus":"八点"},{"id":"L002","label":"HSK 듣기 · 시간 찾기","parts":[{"role":"male","text":"电影几点开始？"},{"role":"female","text":"七点半，我们七点见吧。"},{"role":"narrator","text":"问：电影几点开始？"}],"options":["六点半","七点","七点半","八点"],"answer":"七点半","meaning":"영화는 7시 30분에 시작합니다.","focus":"七点半"},{"id":"L003","label":"HSK 듣기 · 시간 찾기","parts":[{"role":"male","text":"你每天几点起床？"},{"role":"female","text":"我六点半起床。"},{"role":"narrator","text":"问：女的几点起床？"}],"options":["六点","六点半","七点","七点半"],"answer":"六点半","meaning":"여자는 매일 6시 30분에 일어납니다.","focus":"六点半"},{"id":"L004","label":"HSK 듣기 · 시간 찾기","parts":[{"role":"male","text":"下午的课几点下课？"},{"role":"female","text":"四点四十分。"},{"role":"narrator","text":"问：下午几点下课？"}],"options":["三点四十","四点","四点四十","五点"],"answer":"四点四十","meaning":"오후 수업은 4시 40분에 끝납니다.","focus":"四点四十"},{"id":"L005","label":"HSK 듣기 · 시간 찾기","parts":[{"role":"male","text":"火车是九点的吗？"},{"role":"female","text":"不是，是九点二十。"},{"role":"narrator","text":"问：火车几点开？"}],"options":["八点二十","九点","九点二十","十点"],"answer":"九点二十","meaning":"기차는 9시 20분에 출발합니다.","focus":"九点二十"},{"id":"L006","label":"HSK 듣기 · 장소 찾기","parts":[{"role":"male","text":"你去哪儿？"},{"role":"female","text":"我去图书馆看书。"},{"role":"narrator","text":"问：女的去哪儿？"}],"options":["学校","图书馆","医院","饭店"],"answer":"图书馆","meaning":"여자는 책을 보러 도서관에 갑니다.","focus":"图书馆"},{"id":"L007","label":"HSK 듣기 · 장소 찾기","parts":[{"role":"male","text":"你爸爸在哪儿工作？"},{"role":"female","text":"他在医院工作。"},{"role":"narrator","text":"问：女的爸爸在哪儿工作？"}],"options":["医院","学校","银行","饭店"],"answer":"医院","meaning":"여자의 아버지는 병원에서 일합니다.","focus":"医院"},{"id":"L008","label":"HSK 듣기 · 장소 찾기","parts":[{"role":"male","text":"我们在哪儿见？"},{"role":"female","text":"在地铁站门口吧。"},{"role":"narrator","text":"问：他们在哪儿见？"}],"options":["公司门口","地铁站门口","学校门口","商店门口"],"answer":"地铁站门口","meaning":"두 사람은 지하철역 입구에서 만나기로 합니다.","focus":"地铁站门口"},{"id":"L009","label":"HSK 듣기 · 장소 찾기","parts":[{"role":"male","text":"你的书在哪儿？"},{"role":"female","text":"在桌子上。"},{"role":"narrator","text":"问：书在哪儿？"}],"options":["桌子上","椅子上","包里","床上"],"answer":"桌子上","meaning":"책은 책상 위에 있습니다.","focus":"桌子上"},{"id":"L010","label":"HSK 듣기 · 장소 찾기","parts":[{"role":"male","text":"你在哪儿吃午饭？"},{"role":"female","text":"我在公司食堂吃。"},{"role":"narrator","text":"问：女的在哪儿吃午饭？"}],"options":["家里","饭店","公司食堂","学校"],"answer":"公司食堂","meaning":"여자는 회사 식당에서 점심을 먹습니다.","focus":"公司食堂"},{"id":"L011","label":"HSK 듣기 · 교통수단","parts":[{"role":"male","text":"我们坐公共汽车去吗？"},{"role":"female","text":"今天下雨，我们坐出租车吧。"},{"role":"narrator","text":"问：他们怎么去？"}],"options":["坐地铁","坐公共汽车","坐出租车","走路"],"answer":"坐出租车","meaning":"비가 와서 택시를 타고 갑니다.","focus":"出租车"},{"id":"L012","label":"HSK 듣기 · 교통수단","parts":[{"role":"male","text":"你怎么去学校？"},{"role":"female","text":"我每天骑自行车去。"},{"role":"narrator","text":"问：女的怎么去学校？"}],"options":["骑自行车","坐地铁","坐出租车","走路"],"answer":"骑自行车","meaning":"여자는 매일 자전거를 타고 학교에 갑니다.","focus":"骑自行车"},{"id":"L013","label":"HSK 듣기 · 교통수단","parts":[{"role":"male","text":"去机场坐地铁方便吗？"},{"role":"female","text":"很方便，我们坐地铁吧。"},{"role":"narrator","text":"问：他们怎么去机场？"}],"options":["坐地铁","坐出租车","坐公共汽车","走路"],"answer":"坐地铁","meaning":"두 사람은 지하철을 타고 공항에 갑니다.","focus":"地铁"},{"id":"L014","label":"HSK 듣기 · 교통수단","parts":[{"role":"male","text":"你今天怎么来的？"},{"role":"female","text":"公共汽车太慢，我坐出租车来的。"},{"role":"narrator","text":"问：男的今天怎么来的？"}],"options":["坐出租车","坐公共汽车","坐地铁","骑自行车"],"answer":"坐出租车","meaning":"남자는 오늘 택시를 타고 왔습니다.","focus":"出租车"},{"id":"L015","label":"HSK 듣기 · 교통수단","parts":[{"role":"male","text":"学校离你家远吗？"},{"role":"female","text":"不远，我每天走路去。"},{"role":"narrator","text":"问：女的怎么去学校？"}],"options":["走路","坐地铁","坐公共汽车","开车"],"answer":"走路","meaning":"학교가 집에서 멀지 않아 걸어서 갑니다.","focus":"走路"},{"id":"L016","label":"HSK 듣기 · 사람 찾기","parts":[{"role":"male","text":"那个医生是你朋友吗？"},{"role":"female","text":"不是，他是我哥哥。"},{"role":"narrator","text":"问：那个医生是谁？"}],"options":["男的的朋友","男的的哥哥","女的的老师","女的的朋友"],"answer":"男的的哥哥","meaning":"그 의사는 남자의 형입니다.","focus":"哥哥"},{"id":"L017","label":"HSK 듣기 · 사람 찾기","parts":[{"role":"male","text":"门口那个女孩是谁？"},{"role":"female","text":"她是我妹妹。"},{"role":"narrator","text":"问：那个女孩是谁？"}],"options":["男的的妹妹","男的的姐姐","女的的朋友","男的的老师"],"answer":"男的的妹妹","meaning":"문 앞의 여자는 남자의 여동생입니다.","focus":"妹妹"},{"id":"L018","label":"HSK 듣기 · 사람 찾기","parts":[{"role":"male","text":"王老师旁边的人是你爸爸吗？"},{"role":"female","text":"不是，是我叔叔。"},{"role":"narrator","text":"问：王老师旁边的人是谁？"}],"options":["女的的爸爸","女的的叔叔","男的的哥哥","男的的朋友"],"answer":"女的的叔叔","meaning":"왕 선생님 옆 사람은 여자의 삼촌입니다.","focus":"叔叔"},{"id":"L019","label":"HSK 듣기 · 사람 찾기","parts":[{"role":"male","text":"照片里这个男孩是谁？"},{"role":"female","text":"是我儿子，今年八岁。"},{"role":"narrator","text":"问：照片里的男孩是谁？"}],"options":["女的的儿子","女的的弟弟","男的的朋友","女的的学生"],"answer":"女的的儿子","meaning":"사진 속 남자아이는 여자의 아들입니다.","focus":"儿子"},{"id":"L020","label":"HSK 듣기 · 사람 찾기","parts":[{"role":"male","text":"李老师是你的汉语老师吗？"},{"role":"female","text":"对，他教我们汉语。"},{"role":"narrator","text":"问：李老师是谁？"}],"options":["男的的同事","男的的汉语老师","女的的朋友","男的的医生"],"answer":"男的的汉语老师","meaning":"리 선생님은 남자의 중국어 선생님입니다.","focus":"汉语老师"},{"id":"L021","label":"HSK 듣기 · 일정 찾기","parts":[{"role":"male","text":"今天晚上一起看电影吧。"},{"role":"female","text":"我晚上要学习，明天下午可以。"},{"role":"narrator","text":"问：女的什么时候可以看电影？"}],"options":["今天上午","今天晚上","明天上午","明天下午"],"answer":"明天下午","meaning":"여자는 내일 오후에 영화를 볼 수 있습니다.","focus":"明天下午"},{"id":"L022","label":"HSK 듣기 · 일정 찾기","parts":[{"role":"male","text":"星期六你去学校吗？"},{"role":"female","text":"不去，我和朋友去看电影。"},{"role":"narrator","text":"问：女的星期六做什么？"}],"options":["去学校","去医院","看电影","在公司工作"],"answer":"看电影","meaning":"여자는 토요일에 친구와 영화를 봅니다.","focus":"看电影"},{"id":"L023","label":"HSK 듣기 · 일정 찾기","parts":[{"role":"male","text":"周末一起去爬山吗？"},{"role":"female","text":"星期六不行，星期天可以。"},{"role":"narrator","text":"问：女的什么时候去爬山？"}],"options":["星期五","星期六","星期天","星期一"],"answer":"星期天","meaning":"여자는 일요일에 등산할 수 있습니다.","focus":"星期天"},{"id":"L024","label":"HSK 듣기 · 일정 찾기","parts":[{"role":"male","text":"你下午有时间吗？"},{"role":"female","text":"三点以前很忙，四点以后可以。"},{"role":"narrator","text":"问：女的什么时候有时间？"}],"options":["两点以前","三点以前","四点以后","晚上八点以后"],"answer":"四点以后","meaning":"여자는 오후 4시 이후에 시간이 있습니다.","focus":"四点以后"},{"id":"L025","label":"HSK 듣기 · 일정 찾기","parts":[{"role":"male","text":"你明天上午做什么？"},{"role":"female","text":"先去银行，然后去商店。"},{"role":"narrator","text":"问：女的先去哪儿？"}],"options":["银行","商店","医院","学校"],"answer":"银行","meaning":"여자는 먼저 은행에 갑니다.","focus":"银行"},{"id":"L026","label":"HSK 듣기 · 이유 찾기","parts":[{"role":"male","text":"你怎么不去打球？"},{"role":"female","text":"我生病了，医生让我休息。"},{"role":"narrator","text":"问：男的为什么不去打球？"}],"options":["他很忙","他生病了","他要工作","天气很冷"],"answer":"他生病了","meaning":"남자는 아파서 공놀이를 하러 가지 않습니다.","focus":"生病"},{"id":"L027","label":"HSK 듣기 · 이유 찾기","parts":[{"role":"male","text":"你今天怎么迟到了？"},{"role":"female","text":"路上太堵了。"},{"role":"narrator","text":"问：女的为什么迟到？"}],"options":["起床晚了","路上堵车","忘了时间","没有车"],"answer":"路上堵车","meaning":"길이 막혀서 늦었습니다.","focus":"堵车"},{"id":"L028","label":"HSK 듣기 · 이유 찾기","parts":[{"role":"male","text":"你怎么没吃早饭？"},{"role":"female","text":"早上起得太晚了。"},{"role":"narrator","text":"问：男的为什么没吃早饭？"}],"options":["不喜欢吃","起得太晚","没有钱","生病了"],"answer":"起得太晚","meaning":"남자는 늦게 일어나서 아침을 먹지 못했습니다.","focus":"起得太晚"},{"id":"L029","label":"HSK 듣기 · 이유 찾기","parts":[{"role":"male","text":"为什么不开窗户？"},{"role":"female","text":"外面风太大。"},{"role":"narrator","text":"问：女的为什么不开窗户？"}],"options":["天气太热","外面风大","房间很冷","窗户坏了"],"answer":"外面风大","meaning":"밖에 바람이 너무 세서 창문을 열지 않습니다.","focus":"风大"},{"id":"L030","label":"HSK 듣기 · 이유 찾기","parts":[{"role":"male","text":"你今天不喝咖啡吗？"},{"role":"female","text":"晚上想早点睡，所以不喝。"},{"role":"narrator","text":"问：男的为什么不喝咖啡？"}],"options":["咖啡太贵","他不喜欢","想早点睡","没有时间"],"answer":"想早点睡","meaning":"남자는 일찍 자고 싶어서 커피를 마시지 않습니다.","focus":"早点睡"},{"id":"L031","label":"HSK 듣기 · 쇼핑","parts":[{"role":"male","text":"你买什么了？"},{"role":"female","text":"我买了苹果和咖啡。"},{"role":"narrator","text":"问：女的买了什么？"}],"options":["苹果和咖啡","苹果和茶","咖啡和衣服","药和苹果"],"answer":"苹果和咖啡","meaning":"여자는 사과와 커피를 샀습니다.","focus":"苹果和咖啡"},{"id":"L032","label":"HSK 듣기 · 쇼핑","parts":[{"role":"male","text":"这件衣服怎么样？"},{"role":"female","text":"颜色很好，但是有点儿贵。"},{"role":"narrator","text":"问：女的觉得衣服怎么样？"}],"options":["太小了","颜色不好","有点儿贵","很便宜"],"answer":"有点儿贵","meaning":"여자는 옷이 조금 비싸다고 생각합니다.","focus":"有点儿贵"},{"id":"L033","label":"HSK 듣기 · 쇼핑","parts":[{"role":"male","text":"你要买几瓶水？"},{"role":"female","text":"三瓶就够了。"},{"role":"narrator","text":"问：男的要买几瓶水？"}],"options":["一瓶","两瓶","三瓶","四瓶"],"answer":"三瓶","meaning":"남자는 물 세 병을 사려고 합니다.","focus":"三瓶"},{"id":"L034","label":"HSK 듣기 · 쇼핑","parts":[{"role":"male","text":"你的新手机多少钱？"},{"role":"female","text":"两千多块。"},{"role":"narrator","text":"问：手机多少钱？"}],"options":["一千多块","两千多块","三千多块","四千多块"],"answer":"两千多块","meaning":"새 휴대전화는 2천 위안이 조금 넘습니다.","focus":"两千多块"},{"id":"L035","label":"HSK 듣기 · 쇼핑","parts":[{"role":"male","text":"你还要买面包吗？"},{"role":"female","text":"不用了，家里还有。"},{"role":"narrator","text":"问：女的还买面包吗？"}],"options":["买一袋","买两个","不买了","买很多"],"answer":"不买了","meaning":"집에 빵이 있어서 더 사지 않습니다.","focus":"不买了"},{"id":"L036","label":"HSK 듣기 · 장소 추론","parts":[{"role":"male","text":"医生，我头疼。"},{"role":"female","text":"你先休息，多喝水。"},{"role":"narrator","text":"问：他们最可能在哪儿？"}],"options":["医院","学校","商店","机场"],"answer":"医院","meaning":"의사와 환자의 대화이므로 병원 상황입니다.","focus":"医院"},{"id":"L037","label":"HSK 듣기 · 장소 추론","parts":[{"role":"male","text":"请问，这本书可以借一个星期吗？"},{"role":"female","text":"可以，请给我学生证。"},{"role":"narrator","text":"问：他们最可能在哪儿？"}],"options":["图书馆","饭店","银行","医院"],"answer":"图书馆","meaning":"책을 빌리는 상황이므로 도서관입니다.","focus":"图书馆"},{"id":"L038","label":"HSK 듣기 · 장소 추론","parts":[{"role":"male","text":"您好，您要点什么菜？"},{"role":"female","text":"我要一碗面和一杯茶。"},{"role":"narrator","text":"问：他们最可能在哪儿？"}],"options":["饭店","学校","机场","银行"],"answer":"饭店","meaning":"음식을 주문하는 상황이므로 식당입니다.","focus":"饭店"},{"id":"L039","label":"HSK 듣기 · 장소 추론","parts":[{"role":"male","text":"请把护照给我。"},{"role":"female","text":"好的，我去上海。"},{"role":"narrator","text":"问：他们最可能在哪儿？"}],"options":["机场","商店","医院","学校"],"answer":"机场","meaning":"여권과 여행 목적지를 말하므로 공항 상황입니다.","focus":"机场"},{"id":"L040","label":"HSK 듣기 · 장소 추론","parts":[{"role":"male","text":"我要取五百块钱。"},{"role":"female","text":"请先把卡给我。"},{"role":"narrator","text":"问：他们最可能在哪儿？"}],"options":["银行","饭店","公园","图书馆"],"answer":"银行","meaning":"돈을 찾는 상황이므로 은행입니다.","focus":"银行"},{"id":"L041","label":"HSK 듣기 · 행동 찾기","parts":[{"role":"male","text":"下雨了，你带伞了吗？"},{"role":"female","text":"没有，我去商店买一把。"},{"role":"narrator","text":"问：女的要做什么？"}],"options":["回家","买伞","坐地铁","打电话"],"answer":"买伞","meaning":"여자는 우산을 사려고 합니다.","focus":"买伞"},{"id":"L042","label":"HSK 듣기 · 행동 찾기","parts":[{"role":"male","text":"房间有点儿冷。"},{"role":"female","text":"我去关窗户。"},{"role":"narrator","text":"问：男的要做什么？"}],"options":["开门","关窗户","开空调","喝水"],"answer":"关窗户","meaning":"남자는 창문을 닫으려고 합니다.","focus":"关窗户"},{"id":"L043","label":"HSK 듣기 · 행동 찾기","parts":[{"role":"male","text":"我找不到小王的电话。"},{"role":"female","text":"我发给你。"},{"role":"narrator","text":"问：女的要做什么？"}],"options":["打电话","发电话号码","去找小王","写作业"],"answer":"发电话号码","meaning":"여자는 전화번호를 보내주려고 합니다.","focus":"发电话号码"},{"id":"L044","label":"HSK 듣기 · 행동 찾기","parts":[{"role":"male","text":"这个箱子太重了。"},{"role":"female","text":"我来帮你拿。"},{"role":"narrator","text":"问：男的要做什么？"}],"options":["买箱子","帮她拿箱子","坐下休息","打开箱子"],"answer":"帮她拿箱子","meaning":"남자는 여자의 상자를 들어주려고 합니다.","focus":"帮她拿箱子"},{"id":"L045","label":"HSK 듣기 · 행동 찾기","parts":[{"role":"male","text":"快上课了。"},{"role":"female","text":"那我们快走吧。"},{"role":"narrator","text":"问：他们要做什么？"}],"options":["去上课","回家","吃饭","看电影"],"answer":"去上课","meaning":"곧 수업이 시작되어 두 사람은 수업하러 갑니다.","focus":"上课"},{"id":"L046","label":"HSK 듣기 · 상태 판단","parts":[{"role":"male","text":"今天工作多吗？"},{"role":"female","text":"很多，我现在很忙。"},{"role":"narrator","text":"问：男的现在怎么样？"}],"options":["很忙","很高兴","很冷","生病了"],"answer":"很忙","meaning":"오늘 일이 많아 남자는 매우 바쁩니다.","focus":"很忙"},{"id":"L047","label":"HSK 듣기 · 상태 판단","parts":[{"role":"male","text":"考试怎么样？"},{"role":"female","text":"不太难，我都会做。"},{"role":"narrator","text":"问：女的觉得考试怎么样？"}],"options":["很难","不太难","很长","很有意思"],"answer":"不太难","meaning":"여자는 시험이 그다지 어렵지 않았다고 생각합니다.","focus":"不太难"},{"id":"L048","label":"HSK 듣기 · 상태 판단","parts":[{"role":"male","text":"你今天看起来很高兴。"},{"role":"female","text":"对，我找到新工作了。"},{"role":"narrator","text":"问：男的心情怎么样？"}],"options":["很高兴","很累","很生气","很害怕"],"answer":"很高兴","meaning":"남자는 새 직장을 구해서 기쁩니다.","focus":"高兴"},{"id":"L049","label":"HSK 듣기 · 상태 판단","parts":[{"role":"male","text":"你怎么了？"},{"role":"female","text":"昨天没睡好，现在很累。"},{"role":"narrator","text":"问：女的现在怎么样？"}],"options":["很累","很饿","很高兴","很冷"],"answer":"很累","meaning":"여자는 어제 잠을 잘 못 자서 피곤합니다.","focus":"很累"},{"id":"L050","label":"HSK 듣기 · 상태 판단","parts":[{"role":"male","text":"这双鞋合适吗？"},{"role":"female","text":"有点儿小。"},{"role":"narrator","text":"问：女的觉得鞋怎么样？"}],"options":["太大","有点儿小","很漂亮","太贵"],"answer":"有点儿小","meaning":"여자는 신발이 조금 작다고 생각합니다.","focus":"有点儿小"},{"id":"L051","label":"HSK 듣기 · 음식","parts":[{"role":"male","text":"你想吃米饭还是面条？"},{"role":"female","text":"我想吃面条。"},{"role":"narrator","text":"问：女的想吃什么？"}],"options":["米饭","面条","饺子","面包"],"answer":"面条","meaning":"여자는 면을 먹고 싶어 합니다.","focus":"面条"},{"id":"L052","label":"HSK 듣기 · 음식","parts":[{"role":"male","text":"你喝茶吗？"},{"role":"female","text":"不，我想喝咖啡。"},{"role":"narrator","text":"问：男的想喝什么？"}],"options":["茶","咖啡","水","牛奶"],"answer":"咖啡","meaning":"남자는 커피를 마시고 싶어 합니다.","focus":"咖啡"},{"id":"L053","label":"HSK 듣기 · 음식","parts":[{"role":"male","text":"这个菜太辣了。"},{"role":"female","text":"那你吃这个吧，这个不辣。"},{"role":"narrator","text":"问：女的不喜欢什么样的菜？"}],"options":["甜的","辣的","冷的","贵的"],"answer":"辣的","meaning":"여자는 매운 음식을 좋아하지 않습니다.","focus":"辣"},{"id":"L054","label":"HSK 듣기 · 음식","parts":[{"role":"male","text":"你早饭吃了什么？"},{"role":"female","text":"一个鸡蛋和一杯牛奶。"},{"role":"narrator","text":"问：女的早饭吃了什么？"}],"options":["鸡蛋和牛奶","面包和茶","米饭和菜","苹果和咖啡"],"answer":"鸡蛋和牛奶","meaning":"여자는 아침으로 달걀과 우유를 먹었습니다.","focus":"鸡蛋和牛奶"},{"id":"L055","label":"HSK 듣기 · 음식","parts":[{"role":"male","text":"你还要一碗米饭吗？"},{"role":"female","text":"不要了，我吃饱了。"},{"role":"narrator","text":"问：男的还要米饭吗？"}],"options":["还要一碗","还要两碗","不要了","不知道"],"answer":"不要了","meaning":"남자는 배가 불러 밥을 더 먹지 않습니다.","focus":"不要了"},{"id":"L056","label":"HSK 듣기 · 날씨","parts":[{"role":"male","text":"外面天气怎么样？"},{"role":"female","text":"很冷，还下雪了。"},{"role":"narrator","text":"问：外面天气怎么样？"}],"options":["很热","很冷还下雪","下雨","风很小"],"answer":"很冷还下雪","meaning":"밖은 춥고 눈이 옵니다.","focus":"下雪"},{"id":"L057","label":"HSK 듣기 · 날씨","parts":[{"role":"male","text":"今天要带伞吗？"},{"role":"female","text":"天气预报说下午有雨。"},{"role":"narrator","text":"问：下午天气怎么样？"}],"options":["下雨","下雪","晴天","很热"],"answer":"下雨","meaning":"오후에는 비가 옵니다.","focus":"下雨"},{"id":"L058","label":"HSK 듣기 · 날씨","parts":[{"role":"male","text":"昨天热吗？"},{"role":"female","text":"不热，风很大。"},{"role":"narrator","text":"问：昨天天气怎么样？"}],"options":["很热","风很大","下雪","下雨"],"answer":"风很大","meaning":"어제는 덥지 않고 바람이 많이 불었습니다.","focus":"风很大"},{"id":"L059","label":"HSK 듣기 · 날씨","parts":[{"role":"male","text":"明天可以去爬山吗？"},{"role":"female","text":"可以，明天是晴天。"},{"role":"narrator","text":"问：明天天气怎么样？"}],"options":["晴天","下雨","下雪","很冷"],"answer":"晴天","meaning":"내일은 맑습니다.","focus":"晴天"},{"id":"L060","label":"HSK 듣기 · 날씨","parts":[{"role":"male","text":"今天比昨天冷吗？"},{"role":"female","text":"是，今天冷多了。"},{"role":"narrator","text":"问：今天和昨天比怎么样？"}],"options":["今天更冷","昨天更冷","一样冷","今天更热"],"answer":"今天更冷","meaning":"오늘이 어제보다 더 춥습니다.","focus":"更冷"},{"id":"L061","label":"HSK 듣기 · 학교","parts":[{"role":"male","text":"你的汉语课几点开始？"},{"role":"female","text":"上午九点。"},{"role":"narrator","text":"问：汉语课几点开始？"}],"options":["八点","九点","十点","十一点"],"answer":"九点","meaning":"중국어 수업은 오전 9시에 시작합니다.","focus":"九点"},{"id":"L062","label":"HSK 듣기 · 학교","parts":[{"role":"male","text":"作业做完了吗？"},{"role":"female","text":"还没有，我晚上做。"},{"role":"narrator","text":"问：女的什么时候做作业？"}],"options":["上午","下午","晚上","明天"],"answer":"晚上","meaning":"여자는 저녁에 숙제를 합니다.","focus":"晚上"},{"id":"L063","label":"HSK 듣기 · 학교","parts":[{"role":"male","text":"你最喜欢什么课？"},{"role":"female","text":"我最喜欢汉语课。"},{"role":"narrator","text":"问：男的最喜欢什么课？"}],"options":["数学课","汉语课","体育课","音乐课"],"answer":"汉语课","meaning":"남자는 중국어 수업을 가장 좋아합니다.","focus":"汉语课"},{"id":"L064","label":"HSK 듣기 · 학교","parts":[{"role":"male","text":"老师让我们看哪一页？"},{"role":"female","text":"第三十五页。"},{"role":"narrator","text":"问：他们要看哪一页？"}],"options":["二十五页","三十页","三十五页","四十五页"],"answer":"三十五页","meaning":"35쪽을 봐야 합니다.","focus":"三十五页"},{"id":"L065","label":"HSK 듣기 · 학교","parts":[{"role":"male","text":"你明天考试吗？"},{"role":"female","text":"不是，后天考试。"},{"role":"narrator","text":"问：女的什么时候考试？"}],"options":["今天","明天","后天","下星期"],"answer":"后天","meaning":"여자는 모레 시험을 봅니다.","focus":"后天"},{"id":"L066","label":"HSK 듣기 · 회사","parts":[{"role":"male","text":"经理在办公室吗？"},{"role":"female","text":"他去开会了。"},{"role":"narrator","text":"问：经理去哪儿了？"}],"options":["回家了","开会了","吃饭了","去银行了"],"answer":"开会了","meaning":"매니저는 회의하러 갔습니다.","focus":"开会"},{"id":"L067","label":"HSK 듣기 · 회사","parts":[{"role":"male","text":"今天几点下班？"},{"role":"female","text":"六点，今天不用加班。"},{"role":"narrator","text":"问：女的几点下班？"}],"options":["五点","六点","七点","八点"],"answer":"六点","meaning":"여자는 오늘 6시에 퇴근합니다.","focus":"六点"},{"id":"L068","label":"HSK 듣기 · 회사","parts":[{"role":"male","text":"这个文件今天要吗？"},{"role":"female","text":"不急，明天给我就可以。"},{"role":"narrator","text":"问：什么时候给文件？"}],"options":["今天上午","今天下午","明天","下星期"],"answer":"明天","meaning":"파일은 내일 주면 됩니다.","focus":"明天"},{"id":"L069","label":"HSK 듣기 · 회사","parts":[{"role":"male","text":"小张怎么没来？"},{"role":"female","text":"他去上海出差了。"},{"role":"narrator","text":"问：小张去哪儿了？"}],"options":["北京","上海","广州","公司"],"answer":"上海","meaning":"샤오장은 상하이로 출장 갔습니다.","focus":"上海"},{"id":"L070","label":"HSK 듣기 · 회사","parts":[{"role":"male","text":"你工作几年了？"},{"role":"female","text":"我在这家公司工作三年了。"},{"role":"narrator","text":"问：女的工作几年了？"}],"options":["一年","两年","三年","四年"],"answer":"三年","meaning":"여자는 이 회사에서 3년째 일하고 있습니다.","focus":"三年"},{"id":"L071","label":"HSK 듣기 · 건강","parts":[{"role":"male","text":"你哪里不舒服？"},{"role":"female","text":"我的肚子有点儿疼。"},{"role":"narrator","text":"问：女的哪里不舒服？"}],"options":["头疼","肚子疼","腿疼","牙疼"],"answer":"肚子疼","meaning":"여자는 배가 조금 아픕니다.","focus":"肚子疼"},{"id":"L072","label":"HSK 듣기 · 건강","parts":[{"role":"male","text":"感冒好点儿了吗？"},{"role":"female","text":"好多了，就是还有点儿咳嗽。"},{"role":"narrator","text":"问：男的现在怎么样？"}],"options":["完全好了","还有点儿咳嗽","发烧很高","头很疼"],"answer":"还有点儿咳嗽","meaning":"남자는 많이 나았지만 아직 기침이 조금 있습니다.","focus":"咳嗽"},{"id":"L073","label":"HSK 듣기 · 건강","parts":[{"role":"male","text":"医生怎么说？"},{"role":"female","text":"让我每天早点儿睡。"},{"role":"narrator","text":"问：医生让女的做什么？"}],"options":["多吃饭","早点儿睡","多工作","少喝水"],"answer":"早点儿睡","meaning":"의사는 여자에게 매일 일찍 자라고 했습니다.","focus":"早点儿睡"},{"id":"L074","label":"HSK 듣기 · 건강","parts":[{"role":"male","text":"你今天去跑步吗？"},{"role":"female","text":"不去了，我的腿有点儿疼。"},{"role":"narrator","text":"问：男的为什么不跑步？"}],"options":["天气不好","腿疼","太忙","没吃饭"],"answer":"腿疼","meaning":"남자는 다리가 아파서 달리기를 하지 않습니다.","focus":"腿疼"},{"id":"L075","label":"HSK 듣기 · 건강","parts":[{"role":"male","text":"你吃药了吗？"},{"role":"female","text":"吃了，吃完以后好多了。"},{"role":"narrator","text":"问：女的吃药以后怎么样？"}],"options":["更疼了","好多了","睡不着","很饿"],"answer":"好多了","meaning":"여자는 약을 먹고 많이 좋아졌습니다.","focus":"好多了"},{"id":"L076","label":"HSK 듣기 · 위치 찾기","parts":[{"role":"male","text":"洗手间在哪儿？"},{"role":"female","text":"一直走，左边就是。"},{"role":"narrator","text":"问：洗手间在哪边？"}],"options":["左边","右边","前面","后面"],"answer":"左边","meaning":"화장실은 왼쪽에 있습니다.","focus":"左边"},{"id":"L077","label":"HSK 듣기 · 위치 찾기","parts":[{"role":"male","text":"银行远吗？"},{"role":"female","text":"不远，就在超市旁边。"},{"role":"narrator","text":"问：银行在哪儿？"}],"options":["超市旁边","学校后面","医院里面","公司前面"],"answer":"超市旁边","meaning":"은행은 슈퍼마켓 옆에 있습니다.","focus":"旁边"},{"id":"L078","label":"HSK 듣기 · 위치 찾기","parts":[{"role":"male","text":"你家在学校前面吗？"},{"role":"female","text":"不是，在学校后面。"},{"role":"narrator","text":"问：女的家在哪儿？"}],"options":["学校前面","学校后面","学校里面","学校左边"],"answer":"学校后面","meaning":"여자의 집은 학교 뒤에 있습니다.","focus":"后面"},{"id":"L079","label":"HSK 듣기 · 위치 찾기","parts":[{"role":"male","text":"我的手机呢？"},{"role":"female","text":"在你的包里。"},{"role":"narrator","text":"问：手机在哪儿？"}],"options":["桌子上","包里","床下","椅子上"],"answer":"包里","meaning":"휴대전화는 가방 안에 있습니다.","focus":"包里"},{"id":"L080","label":"HSK 듣기 · 위치 찾기","parts":[{"role":"male","text":"电梯在哪儿？"},{"role":"female","text":"前面右边。"},{"role":"narrator","text":"问：电梯在哪儿？"}],"options":["前面左边","前面右边","后面左边","后面右边"],"answer":"前面右边","meaning":"엘리베이터는 앞쪽 오른편에 있습니다.","focus":"右边"},{"id":"L081","label":"HSK 듣기 · 비교·선호","parts":[{"role":"male","text":"你喜欢红色还是蓝色？"},{"role":"female","text":"我更喜欢蓝色。"},{"role":"narrator","text":"问：女的喜欢什么颜色？"}],"options":["红色","蓝色","白色","黑色"],"answer":"蓝色","meaning":"여자는 파란색을 더 좋아합니다.","focus":"蓝色"},{"id":"L082","label":"HSK 듣기 · 비교·선호","parts":[{"role":"male","text":"这两个杯子哪个好？"},{"role":"female","text":"大的太贵，我买小的。"},{"role":"narrator","text":"问：男的买哪个杯子？"}],"options":["大的","小的","两个都买","都不买"],"answer":"小的","meaning":"남자는 작은 컵을 삽니다.","focus":"小的"},{"id":"L083","label":"HSK 듣기 · 비교·선호","parts":[{"role":"male","text":"你觉得坐地铁还是坐公共汽车方便？"},{"role":"female","text":"地铁更快。"},{"role":"narrator","text":"问：女的觉得哪个更快？"}],"options":["地铁","公共汽车","出租车","自行车"],"answer":"地铁","meaning":"여자는 지하철이 더 빠르다고 생각합니다.","focus":"地铁"},{"id":"L084","label":"HSK 듣기 · 비교·선호","parts":[{"role":"male","text":"你喜欢看书还是看电影？"},{"role":"female","text":"我更喜欢看电影。"},{"role":"narrator","text":"问：男的更喜欢做什么？"}],"options":["看书","看电影","听音乐","打球"],"answer":"看电影","meaning":"남자는 영화를 보는 것을 더 좋아합니다.","focus":"看电影"},{"id":"L085","label":"HSK 듣기 · 비교·선호","parts":[{"role":"male","text":"今天和昨天哪个热？"},{"role":"female","text":"昨天更热。"},{"role":"narrator","text":"问：哪天更热？"}],"options":["今天","昨天","一样热","不知道"],"answer":"昨天","meaning":"어제가 오늘보다 더 더웠습니다.","focus":"昨天"},{"id":"L086","label":"HSK 듣기 · 숫자·수량","parts":[{"role":"male","text":"你家有几口人？"},{"role":"female","text":"四口人，爸爸妈妈、姐姐和我。"},{"role":"narrator","text":"问：女的家有几口人？"}],"options":["三口","四口","五口","六口"],"answer":"四口","meaning":"여자의 가족은 네 명입니다.","focus":"四口"},{"id":"L087","label":"HSK 듣기 · 숫자·수량","parts":[{"role":"male","text":"你买了几个苹果？"},{"role":"female","text":"六个，给你两个。"},{"role":"narrator","text":"问：男的买了几个苹果？"}],"options":["两个","四个","六个","八个"],"answer":"六个","meaning":"남자는 사과 여섯 개를 샀습니다.","focus":"六个"},{"id":"L088","label":"HSK 듣기 · 숫자·수량","parts":[{"role":"male","text":"教室里有多少学生？"},{"role":"female","text":"二十七个。"},{"role":"narrator","text":"问：教室里有多少学生？"}],"options":["二十个","二十五个","二十七个","三十个"],"answer":"二十七个","meaning":"교실에는 학생 27명이 있습니다.","focus":"二十七个"},{"id":"L089","label":"HSK 듣기 · 숫자·수량","parts":[{"role":"male","text":"这本书你看了几天？"},{"role":"female","text":"三天就看完了。"},{"role":"narrator","text":"问：男的看了几天？"}],"options":["一天","两天","三天","四天"],"answer":"三天","meaning":"남자는 책을 3일 만에 다 읽었습니다.","focus":"三天"},{"id":"L090","label":"HSK 듣기 · 숫자·수량","parts":[{"role":"male","text":"你每天喝几杯水？"},{"role":"female","text":"大概八杯。"},{"role":"narrator","text":"问：女的每天喝几杯水？"}],"options":["四杯","六杯","八杯","十杯"],"answer":"八杯","meaning":"여자는 매일 물을 대략 여덟 잔 마십니다.","focus":"八杯"},{"id":"L091","label":"HSK 듣기 · 전화·연락","parts":[{"role":"male","text":"你给小李打电话了吗？"},{"role":"female","text":"打了，但是他没接。"},{"role":"narrator","text":"问：小李接电话了吗？"}],"options":["接了","没接","关机了","不知道"],"answer":"没接","meaning":"샤오리는 전화를 받지 않았습니다.","focus":"没接"},{"id":"L092","label":"HSK 듣기 · 전화·연락","parts":[{"role":"male","text":"我的手机没电了。"},{"role":"female","text":"你用我的吧。"},{"role":"narrator","text":"问：女的怎么了？"}],"options":["手机没电了","手机丢了","忘带手机","手机坏了"],"answer":"手机没电了","meaning":"여자의 휴대전화 배터리가 없습니다.","focus":"没电"},{"id":"L093","label":"HSK 듣기 · 전화·연락","parts":[{"role":"male","text":"你收到我的消息了吗？"},{"role":"female","text":"收到了，我一会儿回复你。"},{"role":"narrator","text":"问：男的收到消息了吗？"}],"options":["没收到","收到了","不知道","手机关了"],"answer":"收到了","meaning":"남자는 메시지를 받았습니다.","focus":"收到"},{"id":"L094","label":"HSK 듣기 · 전화·연락","parts":[{"role":"male","text":"小王的电话号码是多少？"},{"role":"female","text":"我也不知道，你问小张吧。"},{"role":"narrator","text":"问：女的知道小王的电话号码吗？"}],"options":["知道","不知道","忘了一个数字","没有手机"],"answer":"不知道","meaning":"여자는 샤오왕의 전화번호를 모릅니다.","focus":"不知道"},{"id":"L095","label":"HSK 듣기 · 전화·연락","parts":[{"role":"male","text":"晚上给我打电话吧。"},{"role":"female","text":"好，八点可以吗？"},{"role":"narrator","text":"问：男的几点打电话？"}],"options":["七点","八点","九点","十点"],"answer":"八点","meaning":"남자는 저녁 8시에 전화합니다.","focus":"八点"},{"id":"L096","label":"HSK 듣기 · 상황 이해","parts":[{"role":"male","text":"你怎么拿这么多书？"},{"role":"female","text":"明天要考试，我要好好复习。"},{"role":"narrator","text":"问：女的为什么拿很多书？"}],"options":["要还书","要考试","要送朋友","想买书"],"answer":"要考试","meaning":"여자는 내일 시험이 있어서 복습하려고 책을 많이 가져갑니다.","focus":"考试"},{"id":"L097","label":"HSK 듣기 · 상황 이해","parts":[{"role":"male","text":"你今天穿得真漂亮。"},{"role":"female","text":"谢谢，晚上我要参加朋友的生日会。"},{"role":"narrator","text":"问：女的晚上要做什么？"}],"options":["参加生日会","去上班","去医院","在家学习"],"answer":"参加生日会","meaning":"여자는 저녁에 친구 생일 모임에 참석합니다.","focus":"生日会"},{"id":"L098","label":"HSK 듣기 · 상황 이해","parts":[{"role":"male","text":"怎么还不开门？"},{"role":"female","text":"商店十点才开门，现在才九点半。"},{"role":"narrator","text":"问：商店几点开门？"}],"options":["九点","九点半","十点","十点半"],"answer":"十点","meaning":"가게는 10시에 문을 엽니다.","focus":"十点"},{"id":"L099","label":"HSK 듣기 · 상황 이해","parts":[{"role":"male","text":"你怎么不吃了？"},{"role":"female","text":"我已经吃饱了。"},{"role":"narrator","text":"问：女的为什么不吃了？"}],"options":["菜不好吃","已经吃饱了","没有时间","身体不舒服"],"answer":"已经吃饱了","meaning":"여자는 이미 배가 불러서 더 먹지 않습니다.","focus":"吃饱"},{"id":"L100","label":"HSK 듣기 · 상황 이해","parts":[{"role":"male","text":"你明天还来吗？"},{"role":"female","text":"当然来，我的东西还在这里呢。"},{"role":"narrator","text":"问：男的明天来不来？"}],"options":["不来","可能不来","会来","不知道"],"answer":"会来","meaning":"남자는 물건이 아직 그곳에 있어서 내일 다시 옵니다.","focus":"会来"}];
function listeningPseudoSentence(item){
 const text=item.parts.map(x=>x.text).join(" "), audio=item.parts.filter(x=>x.role!=="narrator").map(x=>x.text).join(" ");
 return {id:"hsklisten_"+item.id,text:audio,meaning:item.meaning,focus:item.focus,chunks:[audio]};
}
function hskListening(item){
 const s=listeningPseudoSentence(item);
 return {kind:"hsk",hskType:"listening",type:"listening",label:item.label,sentence:s,question:"대화를 듣고 질문에 알맞은 답을 고르세요.",sub:"실제 시험처럼 대화 뒤에 질문까지 들려줍니다.",audioParts:item.parts,options:shuffled(item.options),answer:item.answer,explainMeaning:item.meaning,listenId:item.id};
}
function broadPos(pos){
 const p=String(pos||"");
 if(p.includes("명사"))return "명사";
 if(p.includes("동사"))return "동사";
 if(p.includes("형용사"))return "형용사";
 if(p.includes("부사"))return "부사";
 if(p.includes("수사"))return "수사";
 if(p.includes("양사"))return "양사";
 if(p.includes("개사"))return "개사";
 if(p.includes("접속사"))return "접속사";
 return p||"기타";
}
const wordByHanzi=new Map();
WORDS.forEach(w=>{if(!wordByHanzi.has(w.hanzi))wordByHanzi.set(w.hanzi,w)});
const readingBlankStop=new Set(["我","你","他","她","它","的","了","吗","呢","吧","和"]);
const writingCharStop=new Set(["我","你","他","她","它","的","了","吗","呢","吧"]);
function distractorWords(target,count=3,singleChar=false){
 const bp=broadPos(target.pos);
 let pool=WORDS.filter(w=>w.id!==target.id&&(!singleChar||w.hanzi.length===1)&&broadPos(w.pos)===bp);
 if(pool.length<count)pool=WORDS.filter(w=>w.id!==target.id&&(!singleChar||w.hanzi.length===1));
 const seen=new Set(),out=[];
 for(const w of shuffled(pool)){
   if(seen.has(w.hanzi))continue;
   seen.add(w.hanzi);out.push(w);
   if(out.length>=count)break;
 }
 return out;
}
function listeningTurns(item){return item.parts.filter(p=>p.role!=="narrator")}
function listeningQuestionText(item){
 const q=item.parts.find(p=>p.role==="narrator")?.text||"";
 return q.replace(/^问[：:]\s*/,"");
}
function readingMatchCandidates(){
 const source=HSK_LISTENING_BANK.slice(0,34);
 const responses=source.map(item=>listeningTurns(item)[1]?.text).filter(Boolean);
 return source.map((item,i)=>{
   const turns=listeningTurns(item),prompt=turns[0]?.text||"",answer=turns[1]?.text||"";
   return {id:`readmatch:R${String(i+1).padStart(3,"0")}`,type:"readmatch",item,prompt,answer,responsePool:responses,sourceListenId:item.id};
 });
}
function readingBlankCandidates(studySentencePool){
 const out=[],used=new Set();
 for(const s of studySentencePool){
   const target=wordByHanzi.get(s.focus);
   if(!target||readingBlankStop.has(target.hanzi)||!s.text.includes(target.hanzi)||used.has(target.id))continue;
   const same=distractorWords(target,3,false);
   if(same.length<3)continue;
   used.add(target.id);
   out.push({id:`readblank:${s.id}:${target.id}`,type:"readblank",s,word:target});
   if(out.length>=33)break;
 }
 return out;
}
function readingPassageCandidates(){
 return HSK_LISTENING_BANK.slice(34,67).map((item,i)=>({
   id:`readpassage:R${String(i+68).padStart(3,"0")}`,type:"readpassage",item,sourceListenId:item.id
 }));
}
function hskReadingMatch(c){
 const wrong=sample(c.responsePool,3,c.answer);
 const s={id:c.id,text:`${c.prompt} ${c.answer}`,meaning:c.item.meaning,focus:c.item.focus,chunks:greedyChunks(`${c.prompt}${c.answer}`)};
 return {kind:"hsk",hskType:"reading",type:"readmatch",label:"HSK 독해 · 문장 짝맞추기",questionId:c.id,sentence:s,question:c.prompt,sub:"앞 문장과 가장 자연스럽게 이어지는 문장을 고르세요.",options:shuffled([c.answer,...wrong]),answer:c.answer,explainMeaning:c.item.meaning};
}
function hskReadingBlank(c){
 const wrong=distractorWords(c.word,3,false);
 const options=shuffled([c.word,...wrong]).map(w=>w.hanzi);
 const qtext=c.s.text.replace(c.word.hanzi,"（　）");
 return {kind:"hsk",hskType:"reading",type:"readblank",label:"HSK 독해 · 빈칸 어휘",questionId:c.id,sentence:c.s,word:c.word,question:qtext,sub:"빈칸에 들어갈 가장 알맞은 단어를 고르세요.",options,answer:c.word.hanzi};
}
function hskReadingPassage(c){
 const turns=listeningTurns(c.item);
 const passage=turns.map(x=>x.text).join("\n");
 const qtext=listeningQuestionText(c.item);
 const s={id:c.id,text:turns.map(x=>x.text).join(" "),meaning:c.item.meaning,focus:c.item.focus,chunks:greedyChunks(turns.map(x=>x.text).join(" "))};
 const wrong=sample(c.item.options,2,c.item.answer);
 return {kind:"hsk",hskType:"reading",type:"readpassage",label:"HSK 독해 · 내용 이해",questionId:c.id,sentence:s,passage,readingQuestion:qtext,question:`${passage}\n\n★ ${qtext}`,sub:"짧은 글을 읽고 질문에 가장 알맞은 답을 고르세요.",options:shuffled([c.item.answer,...wrong]),answer:c.item.answer,explainMeaning:c.item.meaning};
}
function writingOrderCandidates(studySentencePool){
 const out=[];
 for(const s of studySentencePool){
   const tokens=s.chunks.filter(x=>!punctuation.has(x));
   if(tokens.length<4||tokens.length>9)continue;
   out.push({id:`writeorder:${s.id}`,type:"order",s});
   if(out.length>=50)break;
 }
 return out;
}
function writingCharCandidates(studySentencePool){
 const out=[],usedTargets=new Set();
 const singleWords=WORDS.filter(w=>w.hanzi.length===1&&!writingCharStop.has(w.hanzi));
 for(const s of studySentencePool){
   let target=null;
   for(const chunk of s.chunks||[]){
     const w=wordByHanzi.get(chunk);
     if(w&&w.hanzi.length===1&&!writingCharStop.has(w.hanzi)&&!usedTargets.has(w.id)){target=w;break}
   }
   if(!target)continue;
   const ds=distractorWords(target,3,true);
   if(ds.length<3)continue;
   usedTargets.add(target.id);
   out.push({id:`writechar:${s.id}:${target.id}`,type:"writechar",s,word:target});
   if(out.length>=50)break;
 }
 // If unique targets run short, allow a repeated target in a different sentence.
 if(out.length<50){
   const usedIds=new Set(out.map(x=>x.id));
   for(const s of studySentencePool){
     let target=null;
     for(const chunk of s.chunks||[]){
       const w=wordByHanzi.get(chunk);
       if(w&&w.hanzi.length===1&&!writingCharStop.has(w.hanzi)){target=w;break}
     }
     if(!target)continue;
     const id=`writechar:${s.id}:${target.id}`;
     if(usedIds.has(id))continue;
     const ds=distractorWords(target,3,true);if(ds.length<3)continue;
     usedIds.add(id);out.push({id,type:"writechar",s,word:target});
     if(out.length>=50)break;
   }
 }
 return out;
}
function hskWritingOrder(c){
 const s=c.s,tokens=s.chunks.filter(x=>!punctuation.has(x));
 return {kind:"hsk",hskType:"writing",type:"order",label:"HSK 쓰기 · 어순 배열",questionId:c.id,sentence:s,question:s.meaning,sub:"한국어 뜻을 참고해 주어진 중국어 단어를 올바른 순서로 배열하세요.",tokens:shuffled(tokens),answer:tokens.join("")};
}
function hskWritingChar(c){
 const wrong=distractorWords(c.word,3,true);
 const options=shuffled([c.word,...wrong]).map(w=>w.hanzi);
 const qtext=c.s.text.replace(c.word.hanzi,`（ ${c.word.pinyin} ）`);
 return {kind:"hsk",hskType:"writing",type:"writechar",label:"HSK 쓰기 · 병음→한자",questionId:c.id,sentence:c.s,word:c.word,question:qtext,sub:"문장 속 병음을 보고 빈칸에 들어갈 한자를 고르세요.",options,answer:c.word.hanzi};
}

function createFreshSession(){
 const rw=reviewWeights();
 const wordPool=pickMixed(WORDS,30,SEEN_WORD_KEY,RECENT_WORD_KEY,w=>w.id,w=>rw.word.get(w.id)||0);
 const wordQuestions=makeWordQuestions(wordPool);

 const studySentencePool=SENTENCES.filter(sentenceCoveredByWordBank);
 const listenCandidates=HSK_LISTENING_BANK.map(item=>({id:`hsklisten_${item.id}:listening`,item,type:"listening"}));
 const listenPool=pickListeningPriority(listenCandidates,7,SEEN_HSK_KEY+":listen",RECENT_HSK_KEY+":listen",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const listenQs=listenPool.map(x=>{const q=hskListening(x.item);q.questionId=x.id;return q});
 const todaysListenIds=new Set(listenPool.map(x=>x.item.id));

 // HSK 기출형 독해 100문제 풀: 짝맞추기 34 + 빈칸 33 + 내용 이해 33.
 const matchCandidates=readingMatchCandidates().filter(x=>!todaysListenIds.has(x.sourceListenId));
 const blankCandidates=readingBlankCandidates(studySentencePool);
 const passageCandidates=readingPassageCandidates().filter(x=>!todaysListenIds.has(x.sourceListenId));
 const matchPool=pickListeningPriority(matchCandidates,2,SEEN_HSK_KEY+":readmatch",RECENT_HSK_KEY+":readmatch",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const blankPool=pickListeningPriority(blankCandidates,2,SEEN_HSK_KEY+":readblank",RECENT_HSK_KEY+":readblank",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const passagePool=pickListeningPriority(passageCandidates,3,SEEN_HSK_KEY+":readpassage",RECENT_HSK_KEY+":readpassage",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const readQs=shuffled([...matchPool.map(hskReadingMatch),...blankPool.map(hskReadingBlank),...passagePool.map(hskReadingPassage)]);

 // HSK 기출형 쓰기 100문제 풀: 어순 배열 50 + 문장 속 병음→한자 50.
 const orderCandidates=writingOrderCandidates(studySentencePool);
 const charCandidates=writingCharCandidates(studySentencePool);
 const orderPool=pickListeningPriority(orderCandidates,3,SEEN_HSK_KEY+":writeorder",RECENT_HSK_KEY+":writeorder",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const charPool=pickListeningPriority(charCandidates,3,SEEN_HSK_KEY+":writechar",RECENT_HSK_KEY+":writechar",x=>x.id,x=>rw.hsk.get(x.id)||0);
 const writeQs=shuffled([...orderPool.map(hskWritingOrder),...charPool.map(hskWritingChar)]);

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

       // 단어 문제는 클릭한 보기와 연결된 실제 중국어 단어를 발음합니다.
       // 뜻/한자/병음 보기 모두 각 선택지에 대응하는 단어를 찾아 재생합니다.
       if(current.kind==="word"&&current.word){
         const optionWord=findWordForOption(current,o,idx);
         speak(optionWord?.hanzi||current.word.hanzi);
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


function findWordForOption(q,opt,optionIndex){
 // New questions carry an explicit 1:1 link from each visible option to its word.
 if(Array.isArray(q.optionWordIds) && Number.isInteger(optionIndex)){
   const id=q.optionWordIds[optionIndex];
   const linked=WORDS.find(w=>w.id===id);
   if(linked)return linked;
 }
 // Backward compatibility for an already-running saved session made by an older version.
 if(q.word&&opt===q.answer)return q.word;
 if(q.type==="meaning")return WORDS.find(w=>String(w.meaning).trim()===String(opt).trim())||null;
 if(q.type==="hanzi"||q.type==="writeword"||q.type==="writechar"||q.type==="readblank")return WORDS.find(w=>String(w.hanzi).trim()===String(opt).trim())||null;
 if(q.type==="pinyin")return WORDS.find(w=>String(w.pinyin).trim().toLowerCase()===String(opt).trim().toLowerCase())||null;
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

   if(q.kind==="word"||q.type==="writeword"||q.type==="writechar"||q.type==="readblank"){
     const w=findWordForOption(q,opt,idx);
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

   if(q.hskType==="reading"&&(q.type==="readmatch"||q.type==="readpassage")){
     return `<div class="option-info-card ${state}">
       <div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${badge}</span></div>
       <div class="option-info-sentence">${rubySentence({chunks:greedyChunks(opt),text:opt})}</div>
       <button class="option-info-listen" type="button" data-speak="${esc(opt)}">🔊 보기 듣기</button>
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
function listeningOptionInfoHtml(q){
 if(q.hskType!=="listening"||!Array.isArray(q.options))return "";
 const cards=q.options.map((opt,idx)=>{
   const correct=opt===q.answer;
   return `<div class="option-info-card ${correct?"correct":"distractor"}">
     <div class="option-info-head"><span class="option-info-num">보기 ${idx+1}</span><span class="option-info-badge">${correct?"정답":"오답 보기"}</span></div>
     <div class="option-info-sentence">${rubySentence({chunks:greedyChunks(opt),text:opt})}</div>
     <button class="option-info-listen" type="button" data-speak="${esc(opt)}">🔊 보기 듣기</button>
   </div>`;
 }).join("");
 return `<div class="all-option-info"><div class="all-option-title">보기별 정보</div><div class="all-option-grid">${cards}</div></div>`;
}

function wordExplain(q,userAnswer,ok){
 const info=optionInfoHtml(q).replace('<div class="all-option-title">보기별 정보</div>','<div class="all-option-title">정답</div>');
 return `<div class="quiz-explain word-options-only">${info}</div>`;
}
function hskExplain(q,userAnswer,ok){
 if(q.type==="writechar"){
   const w=q.word,s=q.sentence;
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer)}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${answerWithPos(w.hanzi,w.pos)}</div>
   <div class="quiz-explain-row"><strong>병음</strong>${esc(w.pinyin)}</div>
   <div class="quiz-explain-row ruby-original-row"><strong>원문</strong>${rubySentence(s)}</div>
   <div class="quiz-explain-row"><strong>해석</strong>${esc(s.meaning)}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>기출 쓰기 2부분처럼 문장 문맥과 병음을 함께 보고 한자를 연결하세요.</div>
   <button class="quiz-explain-listen" onclick="speak('${esc(s.text)}')">🔊 정답 문장 듣기</button>
   ${optionInfoHtml(q)}</div>`;
 }
 if(q.type==="readmatch"){
   const s=q.sentence;
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${esc(q.answer)}</div>
   <div class="quiz-explain-row"><strong>문장 연결</strong>${rubySentence({chunks:greedyChunks(q.question+q.answer),text:q.question+q.answer})}</div>
   <div class="quiz-explain-row"><strong>해석</strong>${esc(q.explainMeaning||s.meaning||"")}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>질문·제안·상황에 가장 자연스럽게 이어지는 문장을 찾으세요.</div>
   ${optionInfoHtml(q)}</div>`;
 }
 if(q.type==="readblank"){
   const s=q.sentence,w=q.word;
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${answerWithPos(w.hanzi,w.pos)}</div>
   <div class="quiz-explain-row ruby-original-row"><strong>원문</strong>${rubySentence(s)}</div>
   <div class="quiz-explain-row"><strong>해석</strong>${esc(s.meaning)}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>빈칸 앞뒤 문맥과 품사를 함께 확인하세요.</div>
   <button class="quiz-explain-listen" onclick="speak('${esc(s.text)}')">🔊 정답 문장 듣기</button>
   ${optionInfoHtml(q)}</div>`;
 }
 if(q.type==="readpassage"){
   const s=q.sentence;
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${esc(q.answer)}</div>
   <div class="quiz-explain-row ruby-original-row"><strong>지문</strong>${rubySentence({chunks:greedyChunks(q.passage||s.text),text:q.passage||s.text})}</div>
   <div class="quiz-explain-row"><strong>질문</strong>${rubySentence({chunks:greedyChunks(q.readingQuestion||""),text:q.readingQuestion||""})}</div>
   <div class="quiz-explain-row"><strong>해석</strong>${esc(q.explainMeaning||s.meaning||"")}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>지문에서 시간·장소·사람·행동·이유 같은 핵심 정보를 먼저 찾으세요.</div>
   ${optionInfoHtml(q)}</div>`;
 }
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
 if(q.hskType==="listening"&&Array.isArray(q.audioParts)){
   const transcript=q.audioParts.map(part=>`<div class="listen-transcript-line"><span class="listen-speaker">${part.role==="male"?"남":part.role==="female"?"여":"문"}</span><span>${rubySentence({chunks:greedyChunks(part.text),text:part.text})}</span></div>`).join("");
   return `<div class="quiz-explain"><div class="quiz-explain-title">${ok?"✅ 정답":"❌ 오답"}</div>
   ${!ok?`<div class="quiz-explain-row"><strong>내 답</strong>${esc(userAnswer||"-")}</div>`:""}
   <div class="quiz-explain-row"><strong>정답</strong>${esc(q.answer)}</div>
   <div class="quiz-explain-row"><strong>원문</strong><div class="listen-transcript">${transcript}</div></div>
   <div class="quiz-explain-row"><strong>해석</strong>${esc(q.explainMeaning||s.meaning)}</div>
   <div class="quiz-explain-row"><strong>포인트</strong>시간·장소·사람·행동 같은 핵심 정보를 먼저 잡으세요.</div>
   <button class="quiz-explain-listen" type="button" id="replayHskListening">🔊 전체 다시 듣기</button>
   ${listeningOptionInfoHtml(q)}
   </div>`;
 }
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
  upsertReviewItem({key:"quiz:today:writeword:"+w.id,type:"quiz",source:"오늘의 학습 · HSK 쓰기",quiz:{type:"writeword",hskType:"writing",label:q.label,question:q.question,options:[...q.options],answer:q.answer,userAnswer,word:w,questionId:q.questionId||`writeword:${w.id}`}});
 }else{
  const s=q.sentence;
  const ident=q.questionId||`${s.id}:${q.hskType||q.type}`;
  upsertReviewItem({key:`quiz:today:${ident}`,type:"quiz",source:`오늘의 학습 · HSK ${q.hskType}`,quiz:{type:q.type,hskType:q.hskType,label:q.label,question:q.question,sub:q.sub,options:q.options?[...q.options]:null,tokens:q.tokens?[...q.tokens]:null,answer:q.answer,userAnswer:userAnswer||"",sentence:s,questionId:q.questionId||null,word:q.word||null,listenId:q.listenId||null,audioParts:q.audioParts?JSON.parse(JSON.stringify(q.audioParts)):null}});
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

 if(ok){
   addScore();
   if(current.kind==="word"&&current.word)resolveReviewItem("word:"+current.word.id);
   else if(current.questionId)resolveReviewItem(`quiz:today:${current.questionId}`);
   else if(current.type==="writeword"&&current.word)resolveReviewItem("quiz:today:writeword:"+current.word.id);
 } else saveWrong(current,opt);

 $("todayFeedback").style.display="block";
 $("todayFeedback").innerHTML=current.kind==="word"?wordExplain(current,opt,ok):hskExplain(current,opt,ok);
 bindInfoListenButtons();
 const replay=$("replayHskListening");if(replay)replay.onclick=()=>speakListeningQuestion(current);
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
 if(ok){addScore();if(current.questionId)resolveReviewItem(`quiz:today:${current.questionId}`)}else saveWrong(current,built);
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
$("todayListen").onclick=()=>{if(current?.type==="listening")speakListeningQuestion(current);else if(current?.sentence)speak(current.sentence.text)};
document.querySelectorAll(".today-tab").forEach(b=>b.onclick=()=>{section=b.dataset.section;pos=0;persist();render()});
render();
