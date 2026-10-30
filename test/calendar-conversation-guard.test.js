"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{respond}=require("../calendar-conversation-guard");
test("calendar follow-up stays on calendar topic",()=>{
 const m=[{role:"user",text:"Prepare me for tomorrow. Check my calendar and build a short meeting brief."},{role:"assistant",text:"I don't have access to your calendar."}];
 const a=respond("ok how can I connect with you",m);
 assert.match(a,/connecting your calendar/i);
 assert.match(a,/Google Calendar/);
 assert.doesNotMatch(a,/keep typing|just chat/i);
});
test("ordinary connect questions do not get hijacked",()=>assert.equal(respond("how can I connect with you",[{text:"Let's talk about physics."}]),null));
test("calendar reads cannot be fabricated",()=>assert.match(respond("Please check my calendar and brief me",[]),/cannot access|no verified calendar/i));
test("asking for a calendar app stays an app-building request",()=>assert.equal(respond("Build me a calendar app",[]),null));
