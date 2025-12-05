# Setup Instructions for New Memory-AI Features

##  Phase 1: Database Setup (REQUIRED FIRST)

### Step 1: Run Database Migrations

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: **SQL Editor** (in left sidebar)
3. Create a new query
4. Copy and paste the contents of `database_migrations.sql`
5. Click **Run** to execute

This adds two new columns to your `memories` table:
- `image_url` - for photo attachments  
- `gcal_event_id` - for Google Calendar sync

### Step 2: Create Image Storage Bucket

1. In Supabase Dashboard, go to **Storage** (left sidebar)
2. Click **Create a new bucket**
3. Configure:
   - Name: `memory-images`
   - Public: **NO** (keep private)
   - File size limit: `5 MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`
4. Click **Create bucket**

### Step 3: Set Storage Policies

1. Stay in Storage → Click on `memory-images` bucket
2. Go to **Policies** tab
3. Create a new query in SQL Editor
4. Copy and paste the contents of `storage_setup.sql`
5. Click **Run** to execute

---

## Phase 2: Code Integration

### Files Created (Already Done ✅):
1. ✅ `src/lib/types.ts` - Updated with new fields
2. ✅ `src/lib/imageUpload.ts` - Image upload utilities
3. ✅ `src/components/ManualMemoryForm.tsx` - Manual memory form component
4. ✅ `src/lib/groq/client.ts` - Added `processManualEntry` function

### Files Needing Integration (Manual Steps Required):

#### Update `src/app/page.tsx`:

**Add these imports** (add toexisting imports at top of file):
```typescript
import { Edit3 } from 'lucide-react';
import { processManualEntry } from '@/lib/groq/client';
import ManualMemoryForm from '@/components/ManualMemoryForm';
```

**Add InputMode type** (after the Tab type declaration):
```typescript
type InputMode = 'voice' | 'manual';
```

**Add inputMode state** (in the state declarations section):
```typescript
const [inputMode, setInputMode] = useState<InputMode>('voice');
```

**Add manual memory handler** (after the `handleDelete` function, around line 305):
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

**Update the Capture tab UI** (replace the existing CAPTURE TAB section, around lines 351-403):
```typescript
{activeTab === 'capture' && (
    <motion.div
        key="capture"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        className="flex-grow flex flex-col items-center justify-center space-y-12 py-10"
    >
        {/* Mode Toggle */}
        <div className="flex gap-2 bg-cosmic-900/50 p-1.5 rounded-full border border-white/10">
            <button
                onClick={() => setInputMode('voice')}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                    inputMode === 'voice'
                        ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                        : 'text-slate-400 hover:text-white'
                }`}
            >
                <Mic size={16} />
                Voice
            </button>
            <button
                onClick={() => setInputMode('manual')}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                    inputMode === 'manual'
                        ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                        : 'text-slate-400 hover:text-white'
                }`}
            >
                <Edit3 size={16} />
                Type
            </button>
        </div>

        {inputMode === 'voice' ? (
            <>
                {/* Daily Prompt */}
                <div className="text-center space-y-4 max-w-md mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary-300 mb-2">
                        <Sparkles size={12} /> Daily Inspiration
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 leading-tight">
                        "{dailyPrompt}"
                    </h2>
                </div>

                {/* Visualizer (Simulated) */}
                <div className="h-24 flex items-center justify-center gap-1.5">
                    {isRecording ? (
                        Array.from({ length: 12 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="w-2 bg-gradient-to-t from-primary-500 to-cosmic-400 rounded-full"
                                animate={{
                                    height: [20, Math.random() * 60 + 20, 20],
                                }}
                                transition={{
                                    duration: 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.05,
                                }}
                            />
                        ))
                    ) : (
                        <div className="text-slate-500 text-sm font-medium tracking-widest uppercase">Ready to Listen</div>
                    )}
                </div>

                {/* Big Record Button */}
                <div className="relative">
                    <div className="absolute inset-0 bg-primary-500/20 blur-[60px] rounded-full" />
                    <div className="scale-150">
                        <RecordButton
                            isRecording={isRecording}
                            isProcessing={isProcessing}
                            onStart={startRecording}
                            onStop={stopRecording}
                        />
                    </div>
                </div>
            </>
        ) : (
            <ManualMemoryForm
                onSubmit={handleManualMemory}
                onCancel={() => setInputMode('voice')}
            />
        )}
    </motion.div>
)}
```

---

## Phase 3: Testing

### Test Manual Memory Creation:
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Log in
4. Go to Capture tab
5. Click "Type" button
6. Fill in form and submit

### Test Photo Upload:
1. In manual form, click "Add Photo"
2. Select an image
3. Submit the form
4. Check Timeline tab - image should display

---

## Phase 4: Google Calendar Integration (Optional - Later)

This is more complex and can be added later. See `implementation_plan.md` for details.

---

## Current Status:

✅ **Completed**:
- Database schema updated
- Storage setup ready
- Image upload utilities created  
- Manual memory form component built
- AI processing for text entries added

⚠️ **Manual Integration Required**:
- Update `src/app/page.tsx` with code snippets above
- Run database migrations in Supabase
- Create storage bucket

---

## Quick Start Commands:

```bash
# 1. Ensure dependencies are installed
npm install

# 2. Run dev server
npm run dev

# 3. Open browser
# http://localhost:3000
```

---

## Troubleshooting:

**Error: "Bucket 'memory-images' does not exist"**
→ Create the bucket in Supabase Dashboard (see Step 2 above)

**Error: "Row Level Security policy violation"**
→ Run the storage policies SQL (see Step 3 above)

**Images not uploading**
→ Check bucket permissions and ensure user is authenticated
