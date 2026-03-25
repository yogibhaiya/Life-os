import { MemoryItem } from '../types';

export function analyzePatterns(memories: MemoryItem[]): string[] {
  const suggestions: string[] = [];
  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

  // Pattern 1: No relationship interaction for 3 days
  const recentRelationship = memories.find(
    m => m.category === 'Relationship' && m.createdAt > threeDaysAgo
  );
  if (!recentRelationship) {
    suggestions.push("You haven't checked in on relationships lately. Ekta message dao? (কাউকে মেসেজ দিন?)");
  }

  // Pattern 2: Repeated stress words
  const recentHealthNotes = memories.filter(
    m => m.category === 'Health' && m.createdAt > threeDaysAgo
  );
  const stressCount = recentHealthNotes.filter(m => 
    m.text.toLowerCase().includes('stress') || 
    m.text.toLowerCase().includes('tired') ||
    m.text.toLowerCase().includes('klanto') ||
    m.text.includes('ক্লান্ত') ||
    m.text.includes('চাপ')
  ).length;

  if (stressCount >= 2) {
    suggestions.push("You've mentioned feeling stressed recently. Aj rest nao. (আজ বিশ্রাম নিন।)");
  }

  // Pattern 3: Finance limits
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const financeRules = memories.filter(m => m.intent === 'Rule' && m.category === 'Finance' && m.ruleLimit);
  if (financeRules.length > 0) {
    const activeRule = financeRules[0]; // Take most recent rule
    const todaySpends = memories.filter(
      m => m.category === 'Finance' && m.intent === 'Task' && m.createdAt > todayStart.getTime()
    );
    
    // Very basic extraction of amount from spend tasks
    let totalSpent = 0;
    todaySpends.forEach(spend => {
      const match = spend.text.match(/([0-9০-৯]+)/);
      if (match) {
        const numStr = match[1].replace(/[০-৯]/g, (d: string) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
        totalSpent += parseInt(numStr, 10);
      }
    });

    if (activeRule.ruleLimit && totalSpent > activeRule.ruleLimit * 0.8) {
      suggestions.push(`Careful! You've spent ${totalSpent} today. Your limit is ${activeRule.ruleLimit}. (সাবধান! আপনার লিমিট প্রায় শেষ।)`);
    }
  }

  return suggestions;
}
