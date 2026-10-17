/* Exportação local: A4, margem de 10 mm, frentes de todos os baralhos. */
$('#downloadProjectPdf').addEventListener('click', async function() {
  const button=this,project=activeProject;
  if(!project)return;
  button.disabled=true;
  const host=document.createElement('div');host.className='pdf-render-host';host.setAttribute('aria-hidden','true');document.body.append(host);
  try {
    const items=activeDecks.map(CardModel.clone).flatMap(deck=>deckCards(deck).map((card,index)=>({id:`${deck.id}-${index}`,card:CardModel.clone(card),deck,...cardDimensions(deck)})));
    const layout=CardPdfLayout.layout(items);
    const {jsPDF,toCanvas}=CardPdfVendor;
    const pdf=new jsPDF({unit:'mm',format:[layout.width,layout.height],orientation:layout.width>layout.height?'landscape':'portrait',compress:true,precision:8});
    pdf.setProperties({title:`${project.nome} — Baralhos`,subject:'A4 · margem 1 cm · imprimir em tamanho real (100%)'});
    await document.fonts.ready;
    let done=0;
    for(const [pageIndex,page] of layout.pages.entries()) {
      if(pageIndex)pdf.addPage([layout.width,layout.height],layout.width>layout.height?'landscape':'portrait');
      for(const item of page.cards) {
        button.textContent=`Gerando PDF… ${++done}/${items.length}`;
        const {card,deck,width,height}=item;
        const node=document.createElement('div');node.className='tcg-card';node.style.width=`${width*96/25.4}px`;node.style.height=`${height*96/25.4}px`;
        node.innerHTML=`<div class="tcg-frame structured-frame"><header>${escapeHtml(card.titulo||'Carta')}</header>${card.imagem?'<div class="tcg-art"></div>':''}<div class="tcg-description">${CardEditor.content(card,'frente')}</div><footer><span>${escapeHtml(card.id||'')}</span><small>${escapeHtml(deck.nome)}</small></footer></div>`;
        if(card.imagem)node.querySelector('.tcg-art').style.backgroundImage=`url(${JSON.stringify(card.imagem)})`;
        if(deck.imagemFrame)node.firstElementChild.style.backgroundImage=`url(${JSON.stringify(deck.imagemFrame)})`;
        host.replaceChildren(node);
        const text=node.querySelector('.tcg-description');
        if(text.scrollHeight>text.clientHeight+2)throw Error(`O conteúdo de “${card.titulo}” excede o tamanho da carta. Revise o texto antes de exportar.`);
        const canvas=await toCanvas(node,{pixelRatio:300/96,cacheBust:false,preferredFontFormat:'woff2'});
        let image=canvas;
        if(item.rotated){image=document.createElement('canvas');image.width=canvas.height;image.height=canvas.width;const ctx=image.getContext('2d');ctx.translate(image.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(canvas,0,0);}
        pdf.addImage(image.toDataURL('image/png'),'PNG',item.x,item.y,item.w,item.h,undefined,'FAST');
        canvas.width=0;image.width=0;
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
    }
    pdf.save(`${slugify(project.nome)||'projeto'}-baralhos.pdf`);
    showToast('PDF gerado',`${layout.pages.length} página(s) A4. Imprima em tamanho real (100%).`);
  } catch(error) {
    showToast('Não foi possível gerar o PDF',error.message);
  } finally {
    host.remove();button.disabled=false;button.textContent='Baixar PDF dos baralhos';
  }
});
