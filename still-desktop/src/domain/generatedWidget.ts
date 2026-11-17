export type GeneratedWidgetDefinition={
 schemaVersion:1;
 title:string;
 input:'text-file';
 action:{kind:'askAI';instruction:string};
 output:'review-note';
};

export function parseGeneratedWidgetDefinition(value:unknown):GeneratedWidgetDefinition{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The AI returned an invalid component definition.');
 const item=value as Record<string,unknown>,action=item.action;
 if(item.schemaVersion!==1)throw new Error('This component uses an unsupported version. Generate it again.');
 if(typeof item.title!=='string'||item.title.trim().length>60)throw new Error('Use a component name up to 60 characters.');
 if(item.input!=='text-file'||item.output!=='review-note'||!action||typeof action!=='object'||Array.isArray(action))throw new Error('This component asks for an unsupported input or output.');
 const checkedAction=action as Record<string,unknown>;
 if(checkedAction.kind!=='askAI'||typeof checkedAction.instruction!=='string'||checkedAction.instruction.length>8000)throw new Error('Use a supported AI instruction up to 8,000 characters.');
 return{schemaVersion:1,title:item.title.trim(),input:'text-file',action:{kind:'askAI',instruction:checkedAction.instruction.trim()},output:'review-note'};
}

export function parseGeneratedWidgetReply(value:string):GeneratedWidgetDefinition{
 const text=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{const definition=parseGeneratedWidgetDefinition(JSON.parse(text));if(!definition.title||!definition.action.instruction)throw new Error('The AI returned a component without a name or instruction. Try again.');return definition}catch(reason){if(reason instanceof SyntaxError)throw new Error('The AI did not return a valid component. Try generating it again.');throw reason}
}
