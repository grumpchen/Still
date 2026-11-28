/** A single prompt and answer generated from, or linked to, a note. */
export interface FlashcardCard {
 id:string;
 front:string;
 back:string;
 sourceQuote?:string;
}

/** Persisted collection attached to a Notes widget's note document. */
export interface FlashcardDeck {
 id:string;
 noteId:string;
 title:string;
 createdAt:string;
 updatedAt:string;
 cards:FlashcardCard[];
}

const idPattern=/^[a-zA-Z0-9-]{1,80}$/;
const noteIdPattern=/^[a-zA-Z0-9-]{1,500}$/;
const boundedText=(value:unknown,max:number):string=>typeof value==='string'?value.trim().slice(0,max):'';

export function checkedFlashcardDeck(value:unknown,_noteIds?:ReadonlySet<string>):FlashcardDeck|null{
 if(!value||typeof value!=='object')return null;
 const item=value as Record<string,unknown>;
 if(typeof item.id!=='string'||!idPattern.test(item.id)||typeof item.noteId!=='string'||!noteIdPattern.test(item.noteId))return null;
 if(typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt))||!Array.isArray(item.cards))return null;
 const cards:FlashcardCard[]=[];
 for(const raw of item.cards.slice(0,50)){
  if(!raw||typeof raw!=='object')continue;
  const card=raw as Record<string,unknown>,id=typeof card.id==='string'&&idPattern.test(card.id)?card.id:'';
  const front=boundedText(card.front,1000),back=boundedText(card.back,4000);
  if(!id||!front||!back)continue;
  const sourceQuote=boundedText(card.sourceQuote,1000);
  cards.push({id,front,back,...(sourceQuote?{sourceQuote}:{})});
 }
 if(!cards.length)return null;
 return{id:item.id,noteId:item.noteId,title:boundedText(item.title,120)||'Flashcards',createdAt:item.createdAt,updatedAt:item.updatedAt,cards};
}

export function checkedFlashcardDecks(value:unknown,noteIds?:ReadonlySet<string>):FlashcardDeck[]{
 if(!Array.isArray(value))return[];
 const decks:FlashcardDeck[]=[],ids=new Set<string>();
 for(const raw of value.slice(-40)){
  const deck=checkedFlashcardDeck(raw,noteIds);
  if(deck&&!ids.has(deck.id)){ids.add(deck.id);decks.push(deck)}
 }
 return decks;
}
