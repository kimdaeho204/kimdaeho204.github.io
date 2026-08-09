let userWords = JSON.parse(localStorage.getItem("chineseUserWordsV4") || "[]");
let states = JSON.parse(localStorage.getItem("chineseVocabStatesV4") || "{}");
let WORDS=[...DEFAULT_WORDS,...userWords], current=0, filter="all";
const $=id=>document.getElementById(id);
const hanzi=$("hanzi"),pinyin=$("pinyin"),meaning=$("meaning"),wordPos=$("wordPos");

const WORD_SEEN_KEY="meohoWordStudySeenV1";
const WORD_RECENT_KEY="meohoWordStudyRecentV1";
function loadArr(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return []}}
function saveArr(key,a){localStorage.setItem(key,JSON.stringify(a))}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function priorityWeight(w,seen){
 const s=states[w.id];
 if(s==="unknown")return 6;       // 모름 최우선
 if(s==="unsure")return 4.5;      // 애매함
 if(!seen.has(w.id))return 4;      // 아직 단어 공부에서 안 본 단어
 if(!s)return 2;                   // 본 적은 있지만 미분류
 if(s==="known")return .55;       // 외움은 뒤로
 return 1;
}
function weightedOrder(items,seen){
 const pool=[...items],out=[];
 while(pool.length){
   const weights=pool.map(w=>Math.max(.1,priorityWeight(w,seen)));
   const total=weights.reduce((a,b)=>a+b,0);
   let r=Math.random()*total,idx=0;
   for(;idx<pool.length;idx++){r-=weights[idx];if(r<=0)break}
   out.push(pool.splice(Math.min(idx,pool.length-1),1)[0]);
 }
 return out;
}
function buildStudyOrder(){
 const seen=new Set(loadArr(WORD_SEEN_KEY));
 const recent=loadArr(WORD_RECENT_KEY).slice(-24);
 const recentSet=new Set(recent);
 let arranged=weightedOrder(WORDS,seen);
 // 첫 카드는 최근에 본 단어를 최대한 피하면서 우선순위 그룹에서 선택
 const preferred=arranged.filter(w=>!recentSet.has(w.id));
 if(preferred.length){
   const first=preferred[0];
   arranged=[first,...arranged.filter(w=>w.id!==first.id)];
 }
 return arranged.map(w=>WORDS.findIndex(x=>x.id===w.id));
}
let order=buildStudyOrder();

function saveStates(){localStorage.setItem("chineseVocabStatesV4",JSON.stringify(states))}
function statusText(s){return s==="known"?"외움":s==="unsure"?"애매함":s==="unknown"?"모름":"미분류"}
function filteredOrder(){return filter==="all"?order:order.filter(i=>states[WORDS[i].id]===filter)}
function currentWord(){const a=filteredOrder();if(!a.length)return null;current=Math.max(0,Math.min(current,a.length-1));return WORDS[a[current]]}
function markWordSeen(w){
 if(!w)return;
 const seen=new Set(loadArr(WORD_SEEN_KEY));
 seen.add(w.id);saveArr(WORD_SEEN_KEY,[...seen]);
 let recent=loadArr(WORD_RECENT_KEY).filter(id=>id!==w.id);
 recent.push(w.id);
 if(recent.length>40)recent=recent.slice(-40);
 saveArr(WORD_RECENT_KEY,recent);
}
function renderCard(){
 const a=filteredOrder();$("progress").textContent=a.length?`${current+1} / ${a.length}`:"0 / 0";
 const w=currentWord();if(!w){hanzi.textContent="표시할 단어가 없어요";pinyin.textContent="";meaning.textContent=""}
 else{hanzi.textContent=w.hanzi;pinyin.textContent=w.pinyin;meaning.textContent=w.meaning;wordPos.textContent=w.pos||"품사 미분류";markWordSeen(w)}
 pinyin.classList.add("hidden");meaning.classList.add("hidden");wordPos.classList.add("hidden");$("showPinyinBtn").textContent="병음 보기 🔊";$("showMeaningBtn").textContent="뜻 보기"
}
function renderStats(){
 $("totalCount").textContent=WORDS.length;let k=0,u=0,n=0;
 WORDS.forEach(w=>{if(states[w.id]==="known")k++;if(states[w.id]==="unsure")u++;if(states[w.id]==="unknown")n++});
 $("knownCount").textContent=k;$("unsureCount").textContent=u;$("unknownCount").textContent=n
}
function renderList(){
 const q=$("searchInput").value.trim().toLowerCase();
 const list=WORDS.filter(w=>w.hanzi.toLowerCase().includes(q)||w.pinyin.toLowerCase().includes(q)||w.meaning.toLowerCase().includes(q));
 $("wordList").innerHTML=list.map(w=>`<div class="word-item"><div class="hz">${w.hanzi}</div><div><div class="py">${w.pinyin}</div><div class="mn">${w.meaning}</div></div><span class="badge">${statusText(states[w.id])}</span></div>`).join("")
}
function speakChinese(text){
 if(!("speechSynthesis" in window)){alert("이 브라우저에서는 음성 재생을 지원하지 않아요.");return}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.82;
 const voices=speechSynthesis.getVoices();const v=voices.find(v=>v.lang?.toLowerCase()==="zh-cn")||voices.find(v=>v.lang?.toLowerCase().startsWith("zh"));if(v)u.voice=v;
 speechSynthesis.speak(u)
}
$("showPinyinBtn").onclick=()=>{const w=currentWord();if(!w)return;if(pinyin.classList.contains("hidden"))pinyin.classList.remove("hidden");$("showPinyinBtn").textContent="🔊 발음 다시 듣기";speakChinese(w.hanzi)}
$("showMeaningBtn").onclick=()=>{const hide=!meaning.classList.contains("hidden");meaning.classList.toggle("hidden",hide);wordPos.classList.toggle("hidden",hide);$("showMeaningBtn").textContent=hide?"뜻 보기":"뜻·품사 숨기기"}
$("nextBtn").onclick=()=>{const a=filteredOrder();if(a.length){current=(current+1)%a.length;renderCard()}}
$("prevBtn").onclick=()=>{const a=filteredOrder();if(a.length){current=(current-1+a.length)%a.length;renderCard()}}
document.querySelectorAll(".rate").forEach(b=>b.onclick=()=>{
 const w=currentWord();if(!w)return;
 states[w.id]=b.dataset.status;saveStates();
 if(b.dataset.status==="unknown"){
   upsertReviewItem({
     key:"word:"+w.id,type:"word",source:"단어 공부",
     wordId:w.id,hanzi:w.hanzi,pinyin:w.pinyin,meaning:w.meaning
   });
 }else if(b.dataset.status==="known"){
   resolveReviewItem("word:"+w.id);
 }
 if(filter==="all")current=(current+1)%filteredOrder().length;
 else current=Math.min(current,Math.max(0,filteredOrder().length-1));
 renderStats();renderList();renderCard();
})
$("shuffleBtn").onclick=()=>{
 order=buildStudyOrder();current=0;renderCard()
}
$("filterSelect").onchange=e=>{filter=e.target.value;current=0;renderCard()}
$("searchInput").oninput=renderList
$("resetBtn").onclick=()=>{if(confirm("학습 상태를 모두 초기화할까요?")){states={};saveStates();saveArr(WORD_SEEN_KEY,[]);saveArr(WORD_RECENT_KEY,[]);order=buildStudyOrder();current=0;renderStats();renderList();renderCard()}}
renderStats();renderList();renderCard();
