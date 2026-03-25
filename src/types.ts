export type Category = 'Health' | 'Finance' | 'Relationship' | 'Work' | 'General';
export type Intent = 'Task' | 'Note' | 'Rule' | 'Reschedule';

export interface MemoryItem {
  id: string;
  text: string;
  category: Category;
  intent: Intent;
  createdAt: number;
  dueDate?: number;
  completed: boolean;
  ruleLimit?: number;
  notified?: boolean;
}
