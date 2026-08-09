
const WORDS = [{"hanzi": "实习", "pinyin": "shíxí", "meaning": "실습, 인턴"}, {"hanzi": "兴趣", "pinyin": "xìngqù", "meaning": "흥미, 관심"}, {"hanzi": "擅长", "pinyin": "shàncháng", "meaning": "잘하다, 능숙하다"}, {"hanzi": "严格", "pinyin": "yángé", "meaning": "엄격하다"}, {"hanzi": "轻", "pinyin": "qīng", "meaning": "가볍다"}, {"hanzi": "下雪", "pinyin": "xiàxuě", "meaning": "눈이 오다"}, {"hanzi": "外套", "pinyin": "wàitào", "meaning": "외투"}, {"hanzi": "户外", "pinyin": "hùwài", "meaning": "야외"}, {"hanzi": "靴子", "pinyin": "xuēzi", "meaning": "부츠"}, {"hanzi": "从来", "pinyin": "cónglái", "meaning": "여태껏, 원래부터"}, {"hanzi": "这么", "pinyin": "zhème", "meaning": "이렇게"}, {"hanzi": "觉得", "pinyin": "juéde", "meaning": "~라고 생각하다, 느끼다"}, {"hanzi": "山顶", "pinyin": "shāndǐng", "meaning": "산꼭대기"}, {"hanzi": "树", "pinyin": "shù", "meaning": "나무"}, {"hanzi": "可怕", "pinyin": "kěpà", "meaning": "무섭다"}, {"hanzi": "动物", "pinyin": "dòngwù", "meaning": "동물"}, {"hanzi": "去年", "pinyin": "qùnián", "meaning": "작년"}, {"hanzi": "公里", "pinyin": "gōnglǐ", "meaning": "킬로미터"}, {"hanzi": "座", "pinyin": "zuò", "meaning": "채, 동(산·건물 등을 세는 양사)"}, {"hanzi": "好用", "pinyin": "hǎoyòng", "meaning": "쓰기 좋다, 편리하다"}, {"hanzi": "水瓶", "pinyin": "shuǐpíng", "meaning": "물병"}, {"hanzi": "相机", "pinyin": "xiàngjī", "meaning": "카메라"}, {"hanzi": "背包", "pinyin": "bēibāo", "meaning": "배낭"}, {"hanzi": "所以", "pinyin": "suǒyǐ", "meaning": "그래서"}, {"hanzi": "因为", "pinyin": "yīnwèi", "meaning": "왜냐하면, ~때문에"}, {"hanzi": "不但", "pinyin": "bùdàn", "meaning": "~뿐만 아니라"}, {"hanzi": "而且", "pinyin": "érqiě", "meaning": "게다가, 또한"}, {"hanzi": "虽然", "pinyin": "suīrán", "meaning": "비록 ~이지만"}, {"hanzi": "但是", "pinyin": "dànshì", "meaning": "하지만"}, {"hanzi": "如果", "pinyin": "rúguǒ", "meaning": "만약"}, {"hanzi": "终于", "pinyin": "zhōngyú", "meaning": "마침내"}, {"hanzi": "突然", "pinyin": "tūrán", "meaning": "갑자기"}, {"hanzi": "久", "pinyin": "jiǔ", "meaning": "오래"}, {"hanzi": "一直", "pinyin": "yìzhí", "meaning": "계속, 줄곧"}, {"hanzi": "总是", "pinyin": "zǒngshì", "meaning": "항상"}, {"hanzi": "正在", "pinyin": "zhèngzài", "meaning": "마침 ~하고 있다"}, {"hanzi": "瘦", "pinyin": "shòu", "meaning": "마르다"}, {"hanzi": "个子", "pinyin": "gèzi", "meaning": "키, 체격"}, {"hanzi": "年龄", "pinyin": "niánlíng", "meaning": "나이"}, {"hanzi": "棕色", "pinyin": "zōngsè", "meaning": "갈색"}, {"hanzi": "工程师", "pinyin": "gōngchéngshī", "meaning": "엔지니어"}, {"hanzi": "表姐", "pinyin": "biǎojiě", "meaning": "사촌언니, 사촌누나"}, {"hanzi": "表哥", "pinyin": "biǎogē", "meaning": "사촌오빠, 사촌형"}, {"hanzi": "像", "pinyin": "xiàng", "meaning": "닮다, ~처럼 보이다"}, {"hanzi": "初中", "pinyin": "chūzhōng", "meaning": "중학교"}, {"hanzi": "舅舅", "pinyin": "jiùjiu", "meaning": "외삼촌"}, {"hanzi": "甜点", "pinyin": "tiándiǎn", "meaning": "디저트"}, {"hanzi": "奇怪", "pinyin": "qíguài", "meaning": "이상하다"}, {"hanzi": "酸", "pinyin": "suān", "meaning": "시다"}, {"hanzi": "柠檬", "pinyin": "níngméng", "meaning": "레몬"}, {"hanzi": "厚", "pinyin": "hòu", "meaning": "두껍다"}, {"hanzi": "作者", "pinyin": "zuòzhě", "meaning": "작가, 저자"}, {"hanzi": "杂志", "pinyin": "zázhì", "meaning": "잡지"}, {"hanzi": "没意思", "pinyin": "méiyìsi", "meaning": "재미없다"}, {"hanzi": "放松", "pinyin": "fàngsōng", "meaning": "긴장을 풀다, 편하게 하다"}, {"hanzi": "白菜", "pinyin": "báicài", "meaning": "배추"}, {"hanzi": "袋", "pinyin": "dài", "meaning": "봉지, 자루; 봉지를 세는 양사"}, {"hanzi": "洋葱", "pinyin": "yángcōng", "meaning": "양파"}, {"hanzi": "果酱", "pinyin": "guǒjiàng", "meaning": "잼"}, {"hanzi": "草莓", "pinyin": "cǎoméi", "meaning": "딸기"}, {"hanzi": "菜市场", "pinyin": "càishìchǎng", "meaning": "시장, 식료품 시장"}, {"hanzi": "香蕉", "pinyin": "xiāngjiāo", "meaning": "바나나"}, {"hanzi": "橙子", "pinyin": "chéngzi", "meaning": "오렌지"}, {"hanzi": "圆", "pinyin": "yuán", "meaning": "둥글다"}, {"hanzi": "脆", "pinyin": "cuì", "meaning": "바삭하다, 아삭하다"}, {"hanzi": "大蒜", "pinyin": "dàsuàn", "meaning": "마늘"}, {"hanzi": "猪肉", "pinyin": "zhūròu", "meaning": "돼지고기"}, {"hanzi": "油", "pinyin": "yóu", "meaning": "기름"}, {"hanzi": "简单", "pinyin": "jiǎndān", "meaning": "간단하다"}, {"hanzi": "菜谱", "pinyin": "càipǔ", "meaning": "요리법, 메뉴"}, {"hanzi": "炒", "pinyin": "chǎo", "meaning": "볶다"}, {"hanzi": "胡椒粉", "pinyin": "hújiāofěn", "meaning": "후춧가루"}, {"hanzi": "锅", "pinyin": "guō", "meaning": "냄비, 솥, 팬"}, {"hanzi": "过期", "pinyin": "guòqī", "meaning": "기한이 지나다, 유통기한이 지나다"}];
let order = [...Array(WORDS.length).keys()];
let current = 0;
let filter = "all";
let states = JSON.parse(localStorage.getItem("chineseVocabStates") || "{}");

const $ = id => document.getElementById(id);
const hanzi = $("hanzi"), pinyin = $("pinyin"), meaning = $("meaning");
const showPinyinBtn = $("showPinyinBtn"), showMeaningBtn = $("showMeaningBtn");

function saveStates(){
  localStorage.setItem("chineseVocabStates", JSON.stringify(states));
}

function statusText(s){
  return s === "known" ? "외움" : s === "unsure" ? "애매함" : s === "unknown" ? "모름" : "미분류";
}

function filteredOrder(){
  if(filter === "all") return order;
  return order.filter(i => states[WORDS[i].hanzi] === filter);
}

function currentIndex(){
  const arr = filteredOrder();
  if(!arr.length) return null;
  current = Math.max(0, Math.min(current, arr.length - 1));
  return arr[current];
}

function renderCard(){
  const arr = filteredOrder();
  $("progress").textContent = arr.length ? `${current+1} / ${arr.length}` : "0 / 0";
  const i = currentIndex();
  if(i === null){
    hanzi.textContent = "표시할 단어가 없어요";
    pinyin.textContent = "";
    meaning.textContent = "";
    pinyin.classList.add("hidden");
    meaning.classList.add("hidden");
    return;
  }
  const w = WORDS[i];
  hanzi.textContent = w.hanzi;
  pinyin.textContent = w.pinyin;
  meaning.textContent = w.meaning;
  pinyin.classList.add("hidden");
  meaning.classList.add("hidden");
  showPinyinBtn.textContent = "병음 보기";
  showMeaningBtn.textContent = "뜻 보기";
}

function renderStats(){
  $("totalCount").textContent = WORDS.length;
  let k=0,u=0,n=0;
  WORDS.forEach(w => {
    if(states[w.hanzi] === "known") k++;
    if(states[w.hanzi] === "unsure") u++;
    if(states[w.hanzi] === "unknown") n++;
  });
  $("knownCount").textContent = k;
  $("unsureCount").textContent = u;
  $("unknownCount").textContent = n;
}

function renderList(){
  const q = $("searchInput").value.trim().toLowerCase();
  const list = WORDS.filter(w => 
    w.hanzi.toLowerCase().includes(q) ||
    w.pinyin.toLowerCase().includes(q) ||
    w.meaning.toLowerCase().includes(q)
  );
  $("wordList").innerHTML = list.map(w => `
    <div class="word-item">
      <div class="hz">${w.hanzi}</div>
      <div>
        <div class="py">${w.pinyin}</div>
        <div class="mn">${w.meaning}</div>
      </div>
      <span class="badge">${statusText(states[w.hanzi])}</span>
    </div>
  `).join("");
}

showPinyinBtn.addEventListener("click", () => {
  pinyin.classList.toggle("hidden");
  showPinyinBtn.textContent = pinyin.classList.contains("hidden") ? "병음 보기" : "병음 숨기기";
});
showMeaningBtn.addEventListener("click", () => {
  meaning.classList.toggle("hidden");
  showMeaningBtn.textContent = meaning.classList.contains("hidden") ? "뜻 보기" : "뜻 숨기기";
});

$("nextBtn").addEventListener("click", () => {
  const arr = filteredOrder();
  if(!arr.length) return;
  current = (current + 1) % arr.length;
  renderCard();
});
$("prevBtn").addEventListener("click", () => {
  const arr = filteredOrder();
  if(!arr.length) return;
  current = (current - 1 + arr.length) % arr.length;
  renderCard();
});

document.querySelectorAll(".rate").forEach(btn => {
  btn.addEventListener("click", () => {
    const i = currentIndex();
    if(i === null) return;
    states[WORDS[i].hanzi] = btn.dataset.status;
    saveStates();
    renderStats();
    renderList();
    const arr = filteredOrder();
    if(filter !== "all" && current >= arr.length) current = Math.max(0, arr.length - 1);
    else if(filter === "all") current = (current + 1) % arr.length;
    renderCard();
  });
});

$("shuffleBtn").addEventListener("click", () => {
  for(let i=order.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  current = 0;
  renderCard();
});

$("filterSelect").addEventListener("change", e => {
  filter = e.target.value;
  current = 0;
  renderCard();
});

$("searchInput").addEventListener("input", renderList);

$("resetBtn").addEventListener("click", () => {
  if(confirm("저장된 학습 기록을 모두 초기화할까요?")){
    states = {};
    saveStates();
    renderStats();
    renderList();
    renderCard();
  }
});

document.addEventListener("keydown", e => {
  if(e.key === "ArrowRight") $("nextBtn").click();
  if(e.key === "ArrowLeft") $("prevBtn").click();
  if(e.key === " ") {
    e.preventDefault();
    showMeaningBtn.click();
  }
});

renderStats();
renderList();
renderCard();
