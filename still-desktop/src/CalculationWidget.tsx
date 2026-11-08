import {decodePdfCalculation,calculatePdfValues} from './domain/pdfCalculations.ts';
import type {WidgetProps} from './widgets.tsx';
import {useT} from './localization.tsx';

export default function CalculationWidget({widget,update}:WidgetProps){
 const t=useT(),calculation=decodePdfCalculation(widget.text),result=calculation?(()=>{try{return calculatePdfValues(calculation.values,calculation.operation)}catch{return null}})():null;
 return <section className="pdf-calculation-widget" aria-label={t('calculationWidget')}>
  <header><strong>{t('calculationWidget')}</strong>{calculation&&<button type="button" onClick={()=>update({text:''})}>{t('clear')}</button>}</header>
  {calculation?<><p className="pdf-calculation-values">{calculation.values.map((value,index)=><span key={`${index}-${value}`}>{value}{index<calculation.values.length-1&&<i>{calculation.operation}</i>}</span>)}</p><output aria-live="polite">{result===null?t('calculationInvalid'):Number(result.toPrecision(12))}</output></>:<p className="files-message">{t('calculationEmpty')}</p>}
 </section>;
}
