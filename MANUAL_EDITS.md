# Manual Integration Steps for page.tsx

Since automated editing is causing file corruption, here are **3 simple manual edits** you can make to `src/app/page.tsx`:

---

## Edit 1: Update Imports (Line 5)

**Find this line:**
```typescript
import { Search, BrainCircuit, Mic, Sparkles, User as UserIcon, LogOut, TrendingUp, History, Library } from 'lucide-react';
```

**Replace with:**
```typescript
import { Search, BrainCircuit,Mic, Sparkles, User as UserIcon, LogOut, TrendingUp, History, Library, Edit3 } from 'lucide-react';
```

**Find this line (around line 7):**
```typescript
import { processAudio } from '@/lib/groq/client';
```

**Replace with:**
```typescript
import { processAudio, processManualEntry } from '@/lib/groq/client';
```

**Add import after line 14 (after AnalyticsView import):**
```typescript
import ManualMemoryForm from '@/components/ManualMemoryForm';
```

---

## Edit 2: Add State Variables (around line 16-36)

**Find:**
```typescript
type Tab = 'capture' | 'timeline' | 'focus' | 'analytics' | 'profile';
```

**Add after it:**
```typescript
type InputMode = 'voice' | 'manual';
```

**Find:**
```typescript
const [dailyPrompt, setDailyPrompt] = useState('');
```

**Add after it:**
```typescript
const [inputMode, setInputMode] = useState<InputMode>('voice');
```

---

## Edit 3: Add Manual Memory Handler (after `handleDelete` function, around line 305)

**Add this entire function:**
```typescript
const handleManualMemory = async (data: {
    title: string;
    content: string;
    category: MemoryCategory;
    imageUrl: string | null;
    reminderTime: string | null;
}) => {
    setIsProcessing(true);
    try {
        // Process text with AI
        const result = await processManualEntry(data.content);

        // Save to database
        const { data: memory, error } = await supabase
            .from('memories')
            .insert({
                user_id: user.id,
                title: data.title,
                content: data.content,
                summary: result.summary,
                category: data.category,
                audio_url: null, // No audio for manual entries
                duration: null,
                image_url: data.imageUrl,
                reminder_time: data.reminderTime,
                is_favorite: false,
                is_completed: false,
            })
            .select()
            .single();

        if (error) throw error;

        setMemories((prev) => [memory, ...prev]);
        toast('Memory saved successfully!');
        setActiveTab('timeline');
        setInputMode('voice'); // Reset to voice mode
    } catch (error: any) {
        console.error('Manual memory error:', error);
        toast(error.message || 'Failed to save memory', 'error');
    } finally {
        setIsProcessing(false);
    }
};
```

---

## Testing

After these 3 edits:
1. Save the file
2. The app should compile without errors
3. Go to Capture tab - you should see "Voice" / "Type" toggle
4. Click "Type" to test the manual form

That's it! Much simpler than automated edits.
