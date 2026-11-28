import {checkedFlashcardDecks,type FlashcardDeck} from './flashcards.ts';

function key(workspaceId:string){return`still-flashcards-v1:${workspaceId}`}
export function readFlashcardDecks(workspaceId:string):FlashcardDeck[]{
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(workspaceId))return[];
 try{return checkedFlashcardDecks(JSON.parse(localStorage.getItem(key(workspaceId))??'[]'))}catch{return[]}
}
export function saveFlashcardDeck(workspaceId:string,deck:FlashcardDeck):FlashcardDeck[]{
 const checked=checkedFlashcardDecks([deck])[0];if(!checked||!/^[a-zA-Z0-9-]{1,80}$/.test(workspaceId))throw new Error('Invalid flashcard deck.');
 const decks=readFlashcardDecks(workspaceId).filter(item=>item.id!==checked.id);
 const next=[...decks,checked].slice(-100);
 try{localStorage.setItem(key(workspaceId),JSON.stringify(next))}catch{throw new Error('Flashcards could not be saved in this workspace.')}
 return next;
}
export function deleteFlashcardDeck(workspaceId:string,deckId:string):FlashcardDeck[]{
 const decks=readFlashcardDecks(workspaceId).filter(deck=>deck.id!==deckId);
 try{localStorage.setItem(key(workspaceId),JSON.stringify(decks))}catch{throw new Error('Flashcards could not be removed from this workspace.')}
 return decks;
}
