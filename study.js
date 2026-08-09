
let userWords = JSON.parse(localStorage.getItem("chineseUserWordsV4") || "[]");
let states = JSON.parse(localStorage.getItem("chineseVocabStatesV4") || "{}");
let WORDS=[...DEFAULT_WORDS,...userWords], order=[...Array(WORDS.length).keys()], current=0, filter="all";
const $=id=>document.getElementById(id);
const hanzi=$("hanzi"),pinyin=$("pinyin"),meaning=$("meaning"),wordPos=$("wordPos");

function saveStates(){localStorage.setItem("chineseVocabStatesV4",JSON.stringify(states))}
function statusText(s){return s==="known"?"외움":s==="unsure"?"애매함":s==="unknown"?"모름":"미분류"}
function filteredOrder(){return filter==="all"?order:order.filter(i=>states[WORDS[i].id]===filter)}
function currentWord(){const a=filteredOrder();if(!a.length)return null;current=Math.max(0,Math.min(current,a.length-1));return WORDS[a[current]]}
function renderCard(){
 const a=filteredOrder();$("progress").textContent=a.length?`${current+1} / ${a.length}`:"0 / 0";
 const w=currentWord();if(!w){hanzi.textContent="표시할 단어가 없어요";pinyin.textContent="";meaning.textContent=""}
 else{hanzi.textContent=w.hanzi;pinyin.textContent=w.pinyin;meaning.textContent=w.meaning;wordPos.textContent=w.pos||"품사 미분류"}
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
$("shuffleBtn").onclick=()=>{for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}current=0;renderCard()}
$("filterSelect").onchange=e=>{filter=e.target.value;current=0;renderCard()}
$("searchInput").oninput=renderList
$("resetBtn").onclick=()=>{if(confirm("학습 상태를 모두 초기화할까요?")){states={};saveStates();renderStats();renderList();renderCard()}}
renderStats();renderList();renderCard();
