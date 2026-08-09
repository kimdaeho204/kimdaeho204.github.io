
const $=id=>document.getElementById(id);
let reviewFilter="all";
let userWords=JSON.parse(localStorage.getItem("chineseUserWordsV4")||"[]");
let states=JSON.parse(localStorage.getItem("chineseVocabStatesV4")||"{}");
let sentenceStates=JSON.parse(localStorage.getItem("sentenceStatesV1")||"{}");
const punctuation=new Set(["。","，","？","！",",",".","?","!"]);
const pinyinMap=new Map();
[...DEFAULT_WORDS,...userWords].sort((a,b)=>b.hanzi.length-a.hanzi.length).forEach(w=>{if(!pinyinMap.has(w.hanzi))pinyinMap.set(w.hanzi,w.pinyin)});
const vocabSorted=[...pinyinMap.keys()].sort((a,b)=>b.length-a.length);
function pinyinFor(text){
 let out=[],i=0;while(i<text.length){if(punctuation.has(text[i])){out.push(text[i++]);continue}let f=null;for(const w of vocabSorted){if(text.startsWith(w,i)){f=w;break}}if(f){out.push(pinyinMap.get(f));i+=f.length}else i++}
 return out.join(" ").replace(/\s+([，。？！])/g,"$1")
}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="zh-CN";u.rate=.82;speechSynthesis.speak(u)}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function renderSummary(items){
 $("allReviewCount").textContent=items.length;
 $("wordReviewCount").textContent=items.filter(x=>x.type==="word").length;
 $("sentenceReviewCount").textContent=items.filter(x=>x.type==="sentence").length;
 $("quizReviewCount").textContent=items.filter(x=>x.type==="quiz").length;
}
function render(){
 const all=getReviewItems().filter(x=>!x.resolved);renderSummary(all);
 const items=reviewFilter==="all"?all:all.filter(x=>x.type===reviewFilter);
 $("reviewEmpty").style.display=items.length?"none":"block";
 $("reviewStack").innerHTML=items.map(renderItem).join("");
}
function renderItem(item){
 if(item.type==="word")return renderWord(item);
 if(item.type==="sentence")return renderSentence(item);
 return renderQuiz(item);
}
function head(item){return `<div class="review-card-head"><span class="review-source">${esc(item.source)}</span><span class="review-count">틀린 횟수 ${item.wrongCount||1}회</span></div>`}
function renderWord(x){
 return `<article class="review-card" data-key="${esc(x.key)}">${head(x)}
  <div class="review-word-cn">${esc(x.hanzi)}</div>
  <div class="review-center">
   <button class="review-reveal" onclick="showWordPinyin(this,'${esc(x.key)}')">병음 보기 🔊</button>
   <div class="review-pinyin review-hidden">${esc(x.pinyin)}</div>
   <button class="review-reveal" onclick="showNext(this)">뜻 보기</button>
   <div class="review-meaning review-hidden">${esc(x.meaning)}</div>
  </div>
  <div class="review-actions"><button class="keep-btn" onclick="keepItem('${esc(x.key)}')">아직 모름</button><button class="resolve-btn" onclick="solveWord('${esc(x.key)}','${esc(x.wordId)}')">이제 외움</button></div>
 </article>`;
}
function renderSentence(x){
 return `<article class="review-card" data-key="${esc(x.key)}">${head(x)}
  <div class="sentence-badges"><span class="sbadge">${esc(x.category)}</span><span class="sbadge">${esc(x.level)}</span></div>
  <div class="review-sentence">${esc(x.text)}</div>
  <div class="review-center">
   <button class="review-reveal" onclick="showSentencePinyin(this,'${esc(x.key)}')">병음 보기 🔊</button>
   <div class="review-pinyin review-hidden">${esc(pinyinFor(x.text))}</div>
   <button class="review-reveal" onclick="showNext(this)">뜻 보기</button>
   <div class="review-meaning review-hidden">${esc(x.meaning)}</div>
  </div>
  <div class="review-focus">핵심 단어 <span>${esc(x.focus)}</span></div>
  <div class="review-actions"><button class="keep-btn" onclick="keepItem('${esc(x.key)}')">다시 보기</button><button class="resolve-btn" onclick="solveSentence('${esc(x.key)}','${esc(x.sentenceId)}')">이해했음</button></div>
 </article>`;
}
function renderQuiz(x){
 const q=x.quiz;
 let body="";
 if(q.type==="order"){
   body=`<div class="review-quiz-q">${esc(q.question)}</div><div class="quiz-sub">${esc(q.sub)}</div>
   <div id="ans_${safe(x.key)}" class="review-answer-bank"></div>
   <div id="tok_${safe(x.key)}" class="review-token-bank">${q.tokens.map((t,i)=>`<button class="review-token" onclick="pickToken('${esc(x.key)}',this,'${esc(t)}')">${esc(t)}</button>`).join("")}</div>
   <button class="quiz-next" style="display:block" onclick="checkReplayOrder('${esc(x.key)}')">배열 확인</button>`;
 }else{
   const listen=q.type==="listening"?`<button class="listen-btn" onclick="speak('${esc(q.sentence.text)}')">🔊 문장 듣기</button>`:"";
   body=`<div class="review-quiz-q">${esc(q.question)}</div><div class="quiz-sub">${esc(q.sub)}</div>${listen}
   <div class="review-options">${q.options.map(o=>`<button class="review-option" onclick="answerReplay('${esc(x.key)}',this,'${esc(o)}')">${esc(o)}</button>`).join("")}</div>`;
 }
 return `<article class="review-card" data-key="${esc(x.key)}">${head(x)}<span class="quiz-type">${esc(q.label)}</span>${body}<div id="fb_${safe(x.key)}" class="review-feedback review-hidden"></div></article>`;
}
function safe(s){return btoa(unescape(encodeURIComponent(s))).replace(/[^a-zA-Z0-9]/g,"")}
function showNext(btn){btn.nextElementSibling.classList.toggle("review-hidden")}
function showWordPinyin(btn,key){btn.nextElementSibling.classList.remove("review-hidden");const x=getReviewItems().find(i=>i.key===key);if(x)speak(x.hanzi)}
function showSentencePinyin(btn,key){btn.nextElementSibling.classList.remove("review-hidden");const x=getReviewItems().find(i=>i.key===key);if(x)speak(x.text)}
function keepItem(key){const items=getReviewItems();const x=items.find(i=>i.key===key);if(x){x.wrongCount=(x.wrongCount||1)+1;x.lastWrongAt=Date.now();saveReviewItems(items)}render()}
function solveWord(key,id){states[id]="known";localStorage.setItem("chineseVocabStatesV4",JSON.stringify(states));resolveReviewItem(key);render()}
function solveSentence(key,id){sentenceStates[id]="known";localStorage.setItem("sentenceStatesV1",JSON.stringify(sentenceStates));resolveReviewItem(key);render()}
function answerReplay(key,btn,opt){
 const x=getReviewItems().find(i=>i.key===key);if(!x)return;const q=x.quiz;const ok=opt===q.answer;
 const card=btn.closest(".review-card");card.querySelectorAll(".review-option").forEach(b=>{b.disabled=true;if(b.textContent===q.answer)b.classList.add("correct")});
 if(!ok)btn.classList.add("wrong");
 const fb=$("fb_"+safe(key));fb.classList.remove("review-hidden");
 fb.innerHTML=ok?`✅ 정답입니다. 오답노트에서 제거했어요.<br>${esc(q.sentence.meaning)}`:`❌ 정답은 <strong>${esc(q.answer)}</strong> 입니다.<br>${esc(q.sentence.meaning)}`;
 if(ok){setTimeout(()=>{resolveReviewItem(key);render()},900)}else keepItemSilent(key);
}
let replayTokens={};
function pickToken(key,btn,t){if(!replayTokens[key])replayTokens[key]=[];replayTokens[key].push(t);btn.disabled=true;renderBank(key)}
function renderBank(key){const el=$("ans_"+safe(key));el.innerHTML=(replayTokens[key]||[]).map(t=>`<span class="review-token">${esc(t)}</span>`).join("")}
function checkReplayOrder(key){
 const x=getReviewItems().find(i=>i.key===key);if(!x)return;const q=x.quiz,built=(replayTokens[key]||[]).join(""),ok=built===q.answer;
 const fb=$("fb_"+safe(key));fb.classList.remove("review-hidden");fb.innerHTML=ok?`✅ 정답입니다. 오답노트에서 제거했어요.<br>${esc(q.sentence.text)}<br>${esc(q.sentence.meaning)}`:`❌ 다시 확인해보세요.<br><strong>정답:</strong> ${esc(q.sentence.text)}<br>${esc(q.sentence.meaning)}`;
 if(ok){setTimeout(()=>{resolveReviewItem(key);render()},900)}else{keepItemSilent(key);replayTokens[key]=[];setTimeout(render,900)}
}
function keepItemSilent(key){const items=getReviewItems(),x=items.find(i=>i.key===key);if(x){x.wrongCount=(x.wrongCount||1)+1;x.lastWrongAt=Date.now();saveReviewItems(items)}}
document.querySelectorAll(".review-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".review-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");reviewFilter=b.dataset.filter;render()});
function makeUserId(){return"u_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
$("addWrongWordBtn").onclick=()=>{
 const h=$("wrongHanziInput").value.trim(),p=$("wrongPinyinInput").value.trim(),m=$("wrongMeaningInput").value.trim();if(!h||!p||!m){alert("한자, 병음, 뜻을 모두 입력해주세요.");return}
 const w={id:makeUserId(),hanzi:h,pinyin:p,meaning:m};userWords.push(w);localStorage.setItem("chineseUserWordsV4",JSON.stringify(userWords));states[w.id]="unknown";localStorage.setItem("chineseVocabStatesV4",JSON.stringify(states));
 upsertReviewItem({key:"word:"+w.id,type:"word",source:"직접 추가",wordId:w.id,hanzi:h,pinyin:p,meaning:m});
 $("wrongHanziInput").value=$("wrongPinyinInput").value=$("wrongMeaningInput").value="";render()
};
render();
