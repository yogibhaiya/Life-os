import { Category, Intent, MemoryItem } from '../types';

export function parseInput(text: string): Partial<MemoryItem> {
  const lower = text.toLowerCase();
  
  let category: Category = 'General';
  let intent: Intent = 'Note'; // Default to Note for background listening
  let dueDate: number | undefined = undefined;
  let ruleLimit: number | undefined = undefined;

  // Reschedule detection
  if (lower.match(/aj jabo na|pore jabo|reschedule|cancel|আজ যাব না|পরে যাব|বাতিল|ক্যানসেল|পরে করব|আজ হবে না/)) {
    intent = 'Reschedule';
  }

  // Category detection
  if (lower.match(/doctor|medicine|health|sastho|gym|workout|stress|rest|ডাক্তার|ওষুধ|স্বাস্থ্য|জিম|ব্যায়াম|বিশ্রাম|ক্লান্ত|শরীর|অসুখ|জ্বর|মাথা ব্যথা|হাসপাতাল|ক্লান্তি|ঘুম|জল|খাবার/)) {
    category = 'Health';
  } else if (lower.match(/taka|tk|finance|money|khoroch|spend|budget|rupee|টাকা|খরচ|বাজেট|দোকান|বাজার|কিনেছি|দিলাম|পেলাম|বেতন|ভাড়া|বিল/)) {
    category = 'Finance';
  } else if (lower.match(/gf|bf|wife|husband|jhogra|relationship|friend|bondhu|message|বউ|স্বামী|ঝগড়া|সম্পর্ক|বন্ধু|মেসেজ|মা|বাবা|ভাই|বোন|প্রেমিকা|প্রেমিক|পরিবার|আড্ডা/)) {
    category = 'Relationship';
  } else if (lower.match(/boss|work|office|meeting|kaj|call|বস|কাজ|অফিস|মিটিং|কল|প্রজেক্ট|মেইল|ক্লায়েন্ট|ইন্টারভিউ/)) {
    category = 'Work';
  }

  // Intent detection
  if (lower.match(/rule|limit|moddhe cholte hobe|নিয়ম|লিমিট|মধ্যে চলতে হবে|বেশি খরচ করা যাবে না/)) {
    intent = 'Rule';
    const match = lower.match(/([0-9০-৯]+)\s*(taka|tk|rupee|টাকা)/);
    if (match) {
      // Convert Bengali numerals to standard digits if present
      const numStr = match[1].replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
      ruleLimit = parseInt(numStr, 10);
    }
  } else if (lower.match(/remind|task|todo|jabo|korbo|korte hobe|will do|need to|must do|মনে করিয়ে|করব|করতে হবে|যাব|দরকার|কিনতে হবে|যেতে হবে|দিতে হবে|নিতে হবে|পাঠাতে হবে|বলতে হবে|কাজ আছে|মনে রেখো|মনে রাখবেন/)) {
    intent = 'Task';
  } else if (lower.match(/note|feeling|hocche|mon|নোট|অনুভূতি|হচ্ছে|মন|মনে হচ্ছে|ভাবছি|আইডিয়া|প্ল্যান|কথা হলো/)) {
    intent = 'Note';
  }

  // Time detection
  const now = new Date();
  let targetDate = new Date(now);
  let dateModified = false;

  // 1. Explicit Relative Days
  if (lower.match(/porshu|day after tomorrow|পরশু/)) {
    targetDate.setDate(targetDate.getDate() + 2);
    dateModified = true;
  } else if (lower.match(/kal|tomorrow|আগামীকাল|কাল/)) {
    targetDate.setDate(targetDate.getDate() + 1);
    dateModified = true;
  } else if (lower.match(/aj|today|আজ/)) {
    dateModified = true;
  }

  // 2. Weeks
  const weekMatch = lower.match(/(next week|আগামী সপ্তাহ|in (one|two|three|four|five|[0-9০-৯]+) weeks?|(এক|দুই|তিন|চার|পাঁচ|[0-9০-৯]+) সপ্তাহ পর)/);
  if (weekMatch) {
    let weeks = 1;
    const amountStr = weekMatch[2] || weekMatch[3];
    if (amountStr) {
      const numMap: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5 };
      if (numMap[amountStr]) {
        weeks = numMap[amountStr];
      } else {
        const numStr = amountStr.replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
        weeks = parseInt(numStr, 10);
      }
    }
    targetDate.setDate(targetDate.getDate() + (weeks * 7));
    dateModified = true;
  }

  // 3. Days of the week
  const daysOfWeek = [
    { regex: /sunday|রবিবার/, index: 0 },
    { regex: /monday|সোমবার/, index: 1 },
    { regex: /tuesday|মঙ্গলবার/, index: 2 },
    { regex: /wednesday|বুধবার/, index: 3 },
    { regex: /thursday|বৃহস্পতিবার/, index: 4 },
    { regex: /friday|শুক্রবার/, index: 5 },
    { regex: /saturday|শনিবার/, index: 6 }
  ];
  
  for (const day of daysOfWeek) {
    if (lower.match(day.regex)) {
      const currentDay = targetDate.getDay();
      let daysToAdd = day.index - currentDay;
      if (daysToAdd <= 0 || lower.match(/next|আগামী/)) {
        daysToAdd += 7;
      }
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      dateModified = true;
      break;
    }
  }

  // 4. Specific Times of Day
  if (lower.match(/morning|সকাল/)) {
    targetDate.setHours(9, 0, 0, 0);
    dateModified = true;
  } else if (lower.match(/lunch|দুপুর/)) {
    targetDate.setHours(13, 0, 0, 0);
    dateModified = true;
  } else if (lower.match(/afternoon|বিকাল/)) {
    targetDate.setHours(16, 0, 0, 0);
    dateModified = true;
  } else if (lower.match(/evening|সন্ধ্যা/)) {
    targetDate.setHours(18, 0, 0, 0);
    dateModified = true;
  } else if (lower.match(/night|রাত/)) {
    targetDate.setHours(20, 0, 0, 0);
    dateModified = true;
  }

  // 5. Explicit Time (e.g., 5 pm, 5:30 pm, ৫ টায়, ৫:৩০ টায়)
  const timeMatch = lower.match(/([0-9০-৯]+)(?:\s*[:.]\s*([0-9০-৯]+))?\s*(pm|am|baje|টায়|টার)/);
  if (timeMatch) {
    const hourStr = timeMatch[1].replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    let hour = parseInt(hourStr, 10);
    
    let minute = 0;
    if (timeMatch[2]) {
      const minStr = timeMatch[2].replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
      minute = parseInt(minStr, 10);
    }

    const modifier = timeMatch[3];
    
    if (modifier === 'pm' && hour < 12) hour += 12;
    if (modifier === 'am' && hour === 12) hour = 0;
    
    // Smart PM inference for Bengali terms
    if ((modifier === 'baje' || modifier === 'টায়' || modifier === 'টার') && hour < 12) {
       if (lower.match(/night|রাত|afternoon|বিকাল|evening|সন্ধ্যা/)) {
           hour += 12;
       } else if (hour >= 1 && hour <= 5) {
           if (!lower.match(/morning|সকাল/)) {
               hour += 12;
           }
       }
    }

    targetDate.setHours(hour, minute, 0, 0);
    dateModified = true;
  }

  if (dateModified) {
    dueDate = targetDate.getTime();
    // If a specific future date/time is detected but intent is still Note, 
    // it's highly likely to be a Task/Reminder.
    if (intent === 'Note') {
      intent = 'Task';
    }
  }

  return {
    text,
    category,
    intent,
    dueDate,
    ruleLimit
  };
}
