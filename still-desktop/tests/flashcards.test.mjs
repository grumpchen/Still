import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';
import {checkedFlashcardDeck,checkedFlashcardDecks} from '../src/domain/flashcards.ts';
import {deleteFlashcardDeck,readFlashcardDecks,saveFlashcardDeck} from '../src/domain/flashcardStorage.ts';

const now='2026-11-28T00:00:00.000Z';
function deck(noteId='note-1'){return{id:'deck-1',noteId,title:'Biology',createdAt:now,updatedAt:now,cards:[{id:'card-1',front:'What is a cell?',back:'The basic unit of life.',sourceQuote:'basic unit'}]}}

test('flashcard validator bounds fields and keeps a source deck when its note tab is gone',()=>{
 const checked=checkedFlashcardDeck(deck());assert.ok(checked);assert.equal(checked.cards.length,1);assert.equal(checked.cards[0].sourceQuote,'basic unit');
 assert.equal(checkedFlashcardDeck({...deck(),noteId:'bad id'}),null);
 assert.equal(checkedFlashcardDeck({...deck(),cards:[{id:'bad id',front:'q',back:'a'}]}),null);
 assert.equal(checkedFlashcardDecks([deck()],new Set()).length,1,'an orphaned deck remains reviewable');
});

test('flashcard decks default and persist as part of a Notes widget',()=>{
 const state=createInitialState(),widget=createWidget('notes');widget.id='notes-1';
 assert.deepEqual(widget.flashcardDecks,[]);
 const cardDeck=deck(widget.noteDocuments[0].id);widget.flashcardDecks=[cardDeck];state.workspaces[0].widgets=[widget];
 const parsed=parseState(JSON.stringify(state)),saved=parsed.workspaces[0].widgets[0];
 assert.equal(saved.flashcardDecks[0].id,cardDeck.id);assert.equal(saved.flashcardDecks[0].cards[0].back,cardDeck.cards[0].back);
});

test('workspace flashcard store persists without the source widget and deletes by deck id',()=>{
 const values=new Map(),previous=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 try{saveFlashcardDeck('course-1',deck());assert.equal(readFlashcardDecks('course-1')[0].id,'deck-1');assert.equal(readFlashcardDecks('course-2').length,0);deleteFlashcardDeck('course-1','deck-1');assert.equal(readFlashcardDecks('course-1').length,0)}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
});
