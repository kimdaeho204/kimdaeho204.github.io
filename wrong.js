
let userWords = JSON.parse(localStorage.getItem("chineseUserWordsV4") || "[]");
let states = JSON.parse(localStorage.getItem("chineseVocabStatesV4") || "{}");
let WORDS=[...DEFAULT_WORDS,...userWords];
const $=id=>document.getElementById(id);
function saveStates(){localStorage.setItem("chineseVocabStatesV4",JSON.stringify(states))}
function saveUserWords(){localStorage.setItem("chineseUserWordsV4",JSON.stringify(userWords))}
function makeUserId(){return "u_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function rebuild(){WORDS=[...DEFAULT_WORDS,...userWords]}
function render(){
 const wrong=WORDS.filter(w=>states[w.id]==="unknown");$("wrongCountBadge").textContent=`${wrong.length}개`;
 if(!wrong.length){$("wrongList").innerHTML="";$("wrongEmpty").style.display="block";return}
 $("wrongEmpty").style.display="none";
 $("wrongList").innerHTML=wrong.map(w=>{const c=w.id.startsWith("u_");return `<div class="wrong-item"><div class="hz">${w.hanzi}</div><div><div class="py">${w.pinyin}</div><div class="mn">${w.meaning}</div></div><div class="wrong-actions">${c?`<button class="edit" onclick="editWord('${w.id}')">수정</button><button class="delete" onclick="deleteWord('${w.id}')">삭제</button>`:""}<button class="learned" onclick="known('${w.id}')">외움 처리</button></div></div>`}).join("")
}
function known(id){states[id]="known";saveStates();render()}
function addWord(){
 const h=$("wrongHanziInput").value.trim(),p=$("wrongPinyinInput").value.trim(),m=$("wrongMeaningInput").value.trim();
 if(!h||!p||!m){alert("한자, 병음, 뜻을 모두 입력해주세요.");return}
 const w={id:makeUserId(),hanzi:h,pinyin:p,meaning:m};userWords.push(w);saveUserWords();states[w.id]="unknown";saveStates();rebuild();
 $("wrongHanziInput").value=$("wrongPinyinInput").value=$("wrongMeaningInput").value="";render()
}
function editWord(id){
 const i=userWords.findIndex(w=>w.id===id);if(i<0)return;const o=userWords[i];
 const h=prompt("한자",o.hanzi);if(h===null)return;const p=prompt("병음",o.pinyin);if(p===null)return;const m=prompt("뜻",o.meaning);if(m===null)return;
 userWords[i]={...o,hanzi:h.trim(),pinyin:p.trim(),meaning:m.trim()};saveUserWords();rebuild();render()
}
function deleteWord(id){if(!confirm("이 단어를 삭제할까요?"))return;userWords=userWords.filter(w=>w.id!==id);delete states[id];saveUserWords();saveStates();rebuild();render()}
$("addWrongWordBtn").onclick=addWord;
["wrongHanziInput","wrongPinyinInput","wrongMeaningInput"].forEach(id=>$(id).addEventListener("keydown",e=>{if(e.key==="Enter")addWord()}));
render();
