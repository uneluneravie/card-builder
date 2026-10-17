const assert=require('node:assert/strict');
const {layout}=require('../pdf-layout');
for(const sizes of [[[63,88,54]],[[43,65,20],[70,120,10],[57,89,20]],[[190,277,1]],[[277,190,1]],[[63.5,88.7,40]]]) {
 const items=sizes.flatMap(([width,height,n])=>Array.from({length:n},(_,id)=>({id:`${width}-${id}`,width,height})));
 const result=layout(items),cards=result.pages.flatMap(p=>p.cards);
 assert.equal(cards.length,items.length);assert.equal(new Set(cards.map(c=>c.id)).size,items.length);
 for(const page of result.pages)for(const [i,c] of page.cards.entries()) {
  assert(c.x>=10-1e-6&&c.y>=10-1e-6&&c.x+c.w<=result.width-10+1e-6&&c.y+c.h<=result.height-10+1e-6);
  assert.equal(c.w,c.rotated?c.height:c.width);assert.equal(c.h,c.rotated?c.width:c.height);
  for(const d of page.cards.slice(i+1))assert(c.x+c.w<=d.x+1e-6||d.x+d.w<=c.x+1e-6||c.y+c.h<=d.y+1e-6||d.y+d.h<=c.y+1e-6);
 }
}
assert.throws(()=>layout([{width:300,height:300}]));assert.throws(()=>layout([]));assert.throws(()=>layout([{width:NaN,height:80}]));
assert.equal(layout(Array.from({length:9},(_,id)=>({id,width:63,height:88}))).pages.length,1);
console.log('PDF: medidas, margens, rotação, cartas únicas e ausência de sobreposição validadas.');
