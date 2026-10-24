'use strict';
// Provider protocol artifacts are errors, never a user-facing answer or proof of edits.
function conversation(text) {
 if (typeof text!=='string'||!text.trim())throw Error('Empty answer');
 if (/<\|(?:tool_call_start|tool_call_end|im_start|im_end)\|>|<tool_call\b/i.test(text))throw Error('Provider returned unexecuted tool protocol instead of an answer');
 if (/^\s*(?:\d+[.)]\s*)?User Safety:\s*(?:un)?safe\s+Response Safety:/i.test(text))throw Error('Provider returned internal safety classification instead of an answer');
 return text.trim();
}
module.exports={conversation};
