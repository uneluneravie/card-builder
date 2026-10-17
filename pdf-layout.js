/* MaxRects: coordenadas em mm, sem redimensionar cartas. */
(function(root) {
  function pack(items, width, height, order) {
    const pages=[];
    for(const item of [...items].sort(order)) {
      let best;
      pages.forEach((page,pi)=>page.free.forEach(r=>{
        for(const rotated of [false,true]) {
          const w=rotated?item.height:item.width,h=rotated?item.width:item.height;
          if(w>r.w+1e-7||h>r.h+1e-7)continue;
          const score=[Math.min(r.w-w,r.h-h),Math.max(r.w-w,r.h-h)];
          if(!best||score[0]<best.score[0]||score[0]===best.score[0]&&score[1]<best.score[1])best={pi,x:r.x,y:r.y,w,h,rotated,score};
        }
      }));
      if(!best) {
        if(!((item.width<=width&&item.height<=height)||(item.height<=width&&item.width<=height)))throw Error(`A carta “${item.card?.titulo||item.id}” não cabe em A4 com margem de 1 cm.`);
        pages.push({free:[{x:10,y:10,w:width,h:height}],cards:[]});
        const rotated=item.width>width||item.height>height;
        best={pi:pages.length-1,x:10,y:10,w:rotated?item.height:item.width,h:rotated?item.width:item.height,rotated};
      }
      const p=pages[best.pi],b=best;
      p.cards.push({...item,...b});
      p.free=p.free.flatMap(r=>{
        if(b.x>=r.x+r.w-1e-7||b.x+b.w<=r.x+1e-7||b.y>=r.y+r.h-1e-7||b.y+b.h<=r.y+1e-7)return [r];
        const parts=[];
        if(b.x>r.x)parts.push({...r,w:b.x-r.x});
        if(b.x+b.w<r.x+r.w)parts.push({...r,x:b.x+b.w,w:r.x+r.w-b.x-b.w});
        if(b.y>r.y)parts.push({...r,h:b.y-r.y});
        if(b.y+b.h<r.y+r.h)parts.push({...r,y:b.y+b.h,h:r.y+r.h-b.y-b.h});
        return parts;
      }).filter((r,i,all)=>!all.some((s,j)=>i!==j&&s.x<=r.x&&s.y<=r.y&&s.x+s.w>=r.x+r.w&&s.y+s.h>=r.y+r.h&&(j<i||s.w*s.h>r.w*r.h)));
    }
    return pages;
  }
  function layout(items) {
    if(!items.length)throw Error('Este projeto ainda não possui cartas.');
    if(items.some(i=>!Number.isFinite(i.width)||!Number.isFinite(i.height)||i.width<=0||i.height<=0))throw Error('Há um baralho com dimensões inválidas.');
    const results=[];
    for(const [width,height] of [[210,297],[297,210]])for(const order of [(a,b)=>b.width*b.height-a.width*a.height,(a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height),(a,b)=>b.height-a.height]) {
      try{results.push({width,height,pages:pack(items,width-20,height-20,order)});}catch(e){if(!results.length&&width===297)throw e;}
    }
    return results.sort((a,b)=>a.pages.length-b.pages.length)[0];
  }
  if(typeof module!=='undefined')module.exports={layout};else root.CardPdfLayout={layout};
})(globalThis);
