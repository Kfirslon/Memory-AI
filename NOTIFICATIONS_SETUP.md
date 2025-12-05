# Browser Notifications - Manual Setup

Since automated editing keeps breaking `page.tsx`, here's the EXACT code to add manually:

## Step 1: Add import (line 15, after ManualMemoryForm import)

```typescript
import { showReminderNotification } from '@/lib/notifications';
```

## Step 2: Add useEffect for reminder checking (around line 64, after the other useEffect blocks)

```typescript
// Check for due reminders every minute
useEffect(() => {
    if (!user || memories.length === 0) return;

    const interval = setInterval(() => {
        const now = new Date();
        
        memories.forEach(memory => {
            if (!memory.reminder_time) return;
            
            const reminderTime = new Date(memory.reminder_time);
            const diff = reminderTime.getTime() - now.getTime();
            
            // Show notification if reminder is within 1 minute
            if (diff > 0 && diff < 60000) {
                showReminderNotification(
                    memory.title,
                    memory.summary,
                    memory.id
                );
            }
        });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
}, [user, memories]);
```

## Step 3: Request notification permission on mount (add to first useEffect, line 55)

Add this line **before** `return () => subscription.unsubscribe();`:

```typescript
// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
```

That's it! 3 simple additions and notifications will work! 🔔
