export function setNoteText(widget,text){
 widget.text=text;
 if(Array.isArray(widget.noteDocuments)&&widget.noteDocuments.length){
  const active=widget.noteDocuments.find(document=>document.id===widget.activeNoteDocumentId)??widget.noteDocuments[0];
  widget.noteDocuments=widget.noteDocuments.map(document=>document.id===active.id?{...document,text}:document);
 }
 return widget;
}
