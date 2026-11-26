import {expect,test} from '@playwright/test';
import {createInitialState,createWorkspace} from '../../src/domain/workspaces.ts';

test('Library keeps Notes in their course and manages saved links from one global view',async({page})=>{
 const state=createInitialState(),course=createWorkspace('PHYS 121',['notes','files']);
 course.groups=[{id:'course-links',name:'Course links',shortcuts:[{id:'lecture-link',name:'Lecture',url:'https://example.edu/lecture',icon:'L'}],widgets:[],expanded:false}];
 state.workspaces.push(course);
 await page.addInitScript(({serialized})=>{localStorage.setItem('still-first-run-tutorial-v1','done');localStorage.setItem('still-workspace-v2',serialized)}, {serialized:JSON.stringify(state)});
 await page.goto('/design-preview.html');await page.getByRole('button',{name:'Library',exact:true}).click();
 const library=page.locator('.library-home');
 await expect(library.locator('.library-note-nav')).toHaveCount(0);
 await library.getByRole('button',{name:'Saved links',exact:true}).click();
 await expect(library.getByRole('button',{name:/Lecture/})).toBeVisible();
 await library.getByRole('button',{name:'Rename',exact:true}).click();
 await library.locator('.library-link-edit input').fill('Week 1');await library.locator('.library-link-edit').getByRole('button',{name:'Save',exact:true}).click();
 await expect(library.getByRole('button',{name:/Week 1/})).toBeVisible();
 await library.getByRole('button',{name:'Edit URL',exact:true}).click();
 await library.locator('.library-link-edit input').fill('https://example.edu/week-1');await library.locator('.library-link-edit').getByRole('button',{name:'Save',exact:true}).click();
 await expect(library.getByRole('button',{name:/example.edu\/week-1/})).toBeVisible();
 await library.getByRole('button',{name:'Remove saved link',exact:true}).click();
 await expect(library.getByRole('button',{name:/Week 1/})).toHaveCount(0);
 const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')||'null'));
 const storedCourse=persisted.workspaces.find((item:{name:string})=>item.name==='PHYS 121');
 expect(storedCourse.widgets.find((item:{type:string})=>item.type==='notes')).toBeTruthy();
 expect(storedCourse.groups.find((item:{id:string})=>item.id==='course-links').shortcuts).toHaveLength(0);
});
