import {DEFAULT_MODELS,type AssistantProvider} from './assistant.ts';

const PREFERENCE_KEY='still-assistant-model';

export function readAssistantModelPreference():{provider:AssistantProvider;model:string}{
  try{
    const [provider,model]=localStorage.getItem(PREFERENCE_KEY)?.split('::')??[];
    if(provider==='chatgpt')return{provider,model:model??''};
    if((provider==='gemini'||provider==='openai'||provider==='opencode'||provider==='deepseek')&&model)return{provider,model};
  }catch{/* Preference storage is optional in browser previews. */}
  return{provider:'gemini',model:DEFAULT_MODELS.gemini};
}
