
const REVIEW_KEY = "meohoReviewItemsV1";
function getReviewItems(){
  try{return JSON.parse(localStorage.getItem(REVIEW_KEY)||"[]")}catch(e){return []}
}
function saveReviewItems(items){localStorage.setItem(REVIEW_KEY,JSON.stringify(items))}
function upsertReviewItem(item){
  const items=getReviewItems();
  const idx=items.findIndex(x=>x.key===item.key);
  const now=Date.now();
  if(idx>=0){
    items[idx]={...items[idx],...item,lastWrongAt:now,wrongCount:(items[idx].wrongCount||1)+1,resolved:false};
  }else{
    items.unshift({...item,createdAt:now,lastWrongAt:now,wrongCount:1,resolved:false});
  }
  saveReviewItems(items);
}
function resolveReviewItem(key){
  const items=getReviewItems().filter(x=>x.key!==key);
  saveReviewItems(items);
}
