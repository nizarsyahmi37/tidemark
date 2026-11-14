import { describe, expect, it } from 'vitest';
import { periodDefaults, QUICK_STARTS, SEASONS, quickStartVariable, historyAdd, historyRead } from './ux';
describe('question helpers',()=>{
 it('ends at the last complete year',()=>{expect(periodDefaults(1981,'2026-09')).toEqual({start:1995,end:2025});});
 it('keeps short records within their record start',()=>{expect(periodDefaults(2001,'2010-12')).toEqual({start:2001,end:2010});});
 it('maps season chips to months',()=>{expect(SEASONS.find(x=>x.label==='Winter (DJF)')?.months).toEqual([12,1,2]);});
 it('provides sensible question mappings and tolerates missing variables',()=>{expect(QUICK_STARTS.map(x=>x.variableId)).toContain('soil-root');expect(quickStartVariable('missing',[])).toBeUndefined();});
 it('stores recent investigations and caps the list at eight',()=>{const memory=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>memory.set(k,v)}});for(let i=0;i<10;i++)historyAdd({id:String(i),title:`Run ${i}`,href:`/results?run=${i}`,date:'2026-01-01'});expect(historyRead()).toHaveLength(8);expect(historyRead()[0].id).toBe('9');});
});
