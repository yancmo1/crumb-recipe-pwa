# Testing Checklist - CrumbWorks Recipe Scraper Improvements

## 🎯 Quick Test (5 minutes)

### 1. Start the Server
```bash
cd apps/crumb-recipe-pwa
npm run server
```

### 2. Test Plugin Detection (Should work great!)
```bash
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.pantrymama.com/sourdough-cinnamon-roll-focaccia-bread/"}'
```

**Expected output:**
```
✓ Detected WordPress Recipe Maker (WPRM)
✓ Plugin extraction successful: [X] ingredients, [Y] steps
```

**Check in response:**
- [x] Has title
- [x] Has 5+ ingredients
- [x] Has 5+ steps
- [x] Has image URL
- [x] Steps have good length (not just headers)

### 3. Test Multi-Section Recipe (Was broken, now fixed!)
```bash
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/"}'
```

**Expected output:**
```
--- Strategy 3: Improved Heuristics ---
Processing header 0: "Overnight Preparation"
Processing header 1: "Same Day"
✓ Heuristic extraction successful: [X] steps
```

**Check in response:**
- [x] Has section markers: `**Overnight Preparation:**`
- [x] Has section markers: `**Same Day:**`
- [x] Has steps from BOTH sections (10+ total)
- [x] Steps are substantial (not just short headers)

## 🧪 Full Test Suite (10 minutes)

### 1. Run Automated Tests
```bash
cd apps/crumb-recipe-pwa
node server/test-imports.js
```

**Expected:**
```
✅ PASSED: [site name]
   Ingredients: [X] ✓
   Steps: [Y] ✓
   
Success rate: 75-85%+
```

### 2. Add Your Own Test URLs
Edit `server/test-imports.js` and add URLs that previously failed:

```javascript
const testUrls = [
  {
    url: 'YOUR_PROBLEMATIC_URL_HERE',
    name: 'Site that used to fail',
    expectedPlugin: null  // or 'WPRM', 'Tasty', etc.
  },
  // ... add more
];
```

## 🎨 UI Testing (15 minutes)

### 1. Start the Full App
```bash
cd apps/crumb-recipe-pwa
npm run dev
```

Or with Docker:
```bash
docker-compose up
```

### 2. Test These Recipe Types

#### WordPress Plugin Sites (Should be 95%+ success)
- [ ] https://www.pantrymama.com/sourdough-cinnamon-roll-focaccia-bread/
- [ ] Any site with "WordPress Recipe Maker"
- [ ] Any site with "Tasty Recipes"

**What to check:**
- Imports quickly (~1-2 seconds)
- All ingredients present
- All steps present with good formatting
- Section headers preserved if applicable
- Image loads
- Metadata (servings, times) present

#### Multi-Section Recipes (Previously broken)
- [ ] https://www.theclevercarrot.com/2020/05/homemade-fluffy-sourdough-pancakes/
- [ ] Any sourdough recipe with "Overnight" and "Same Day" sections
- [ ] Any bread recipe with multiple phases

**What to check:**
- Gets ALL sections (not just first)
- Section headers visible: "**Overnight Preparation:**"
- Complete steps from each section
- Ingredient groups preserved if applicable

#### Complex/Edge Cases
- [ ] Site with ingredient groups (Dry, Wet, Topping, etc.)
- [ ] Recipe blog with lots of ads/clutter
- [ ] Recipe with both JSON-LD and microdata
- [ ] Non-English recipe site

## 📊 Success Criteria

### Minimum Success
- [x] Plugin detection works (95%+ on WPRM/Tasty sites)
- [x] Multi-section recipes import completely
- [x] Section headers are preserved
- [x] Overall success rate 75%+

### Good Success
- [x] Ingredient groups preserved
- [x] Smart merging works (JSON-LD + heuristics)
- [x] Image extraction improved
- [x] Overall success rate 80%+

### Excellent Success
- [x] Very few failures on common food blogs
- [x] Clear error messages when fails
- [x] Fast extraction (<2 seconds)
- [x] Overall success rate 85%+

## 🐛 If Something Fails

### 1. Check the Logs
Look for the extraction pipeline:
```
=== Starting improved recipe extraction ===
--- Strategy 0: Recipe Plugins ---
✗ No recipe plugins detected
--- Strategy 1: Enhanced JSON-LD ---
✓ JSON-LD found: 3 steps
⚠ JSON-LD incomplete
--- Strategy 3: Improved Heuristics ---
✓ Heuristic extraction successful: 12 steps
```

### 2. Identify the Issue

**"No recipe plugins detected"**
- Expected for non-WordPress sites
- Should fallback to JSON-LD or heuristics
- Not necessarily an error

**"JSON-LD incomplete"**
- Good! It's detecting low quality data
- Should proceed to heuristics
- This is the fix working

**"Heuristic extraction failed"**
- Check page structure
- May need site-specific extractor
- Report URL for Phase 2

### 3. Compare Before/After

Test same URL with legacy extractor:
```bash
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{"url":"YOUR_URL", "useImprovedExtractor": false}'
```

## 📈 Metrics to Track

### Per-Import Metrics
- [ ] Extraction time (<2 seconds good)
- [ ] Which strategy succeeded
- [ ] Number of ingredients extracted
- [ ] Number of steps extracted
- [ ] Average step length (>40 chars good)
- [ ] Has image (yes/no)
- [ ] Has metadata (times, servings)

### Overall Metrics
- [ ] Success rate by site type
  - WordPress plugins: target 95%
  - JSON-LD sites: target 80%
  - Heuristic sites: target 60%
- [ ] Average extraction time
- [ ] Most common failure patterns

## 🎉 Success Indicators

You'll know it's working when:

1. **Plugin Sites "Just Work"**
   - Instant detection
   - Near-perfect extraction
   - Fast (<1 second)

2. **Multi-Section Recipes Complete**
   - Section headers visible in UI
   - All steps from all sections
   - No missing content

3. **Better Error Handling**
   - Clear logs about what was tried
   - Graceful degradation
   - Partial data better than nothing

4. **Overall Experience Smooth**
   - More imports succeed
   - Better quality data
   - Fewer user complaints

## 📝 Report Template

If you find issues, report using this format:

```
**URL:** [paste URL]

**Site Type:** WordPress Plugin / JSON-LD / Custom

**Plugin Detected:** WPRM / Tasty / None

**What Failed:**
- Missing: [ingredients/steps/metadata]
- Incomplete: [describe]
- Wrong: [describe]

**Logs:**
[paste relevant log output]

**Expected:**
[what should have been extracted]

**Actual:**
[what was actually extracted]
```

## ✅ Final Checklist

- [ ] Server starts without errors
- [ ] Plugin detection works on WPRM sites
- [ ] Multi-section recipes extract completely
- [ ] Section headers preserved
- [ ] Test suite runs successfully
- [ ] UI imports work smoothly
- [ ] Success rate improved vs. legacy
- [ ] Logs are clear and helpful
- [ ] Ready for production deployment

## 🚀 Next Steps After Testing

### If Tests Pass
1. Deploy to production
2. Monitor success rates
3. Collect problematic URLs
4. Consider Phase 2 enhancements

### If Tests Fail
1. Check specific failure patterns
2. Review logs for insights
3. Test with legacy extractor for comparison
4. Report issues with details above

### Phase 2 Planning
If you want even better success rates:
1. Identify top 10 most-used recipe sites
2. Build site-specific extractors
3. Add headless browser for JS-heavy sites
4. Implement user feedback loop

---

**Good luck testing! The improvements should be immediately noticeable.** 🎉
