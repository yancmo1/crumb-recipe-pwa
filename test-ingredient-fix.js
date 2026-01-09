/**
 * Test ingredient parsing issue
 * This tests the fix for treating "Tips", "Must Try!" etc as ingredient groups
 */

import * as cheerio from 'cheerio';

// Mock HTML structure based on the issue screenshots
const mockHtml = `
<html>
<head><title>Blueberry Cream Cheese Sourdough Bread</title></head>
<body>
  <h1>Blueberry Cream Cheese Sourdough Bread</h1>
  
  <h2>Ingredients</h2>
  <ul>
    <li>Sourdough starter</li>
    <li>All-purpose flour</li>
    <li>Water</li>
    <li>Salt</li>
    <li>Blueberries</li>
    <li>Cream cheese</li>
  </ul>
  
  <h3>Tips</h3>
  <h4>Fold In Blueberries and Cream Cheese</h4>
  <ul>
    <li>Add as much or as little of the blueberries and cream cheese as you would like. I love lots of both and tend to add extra!</li>
  </ul>
  
  <h4>Active Starter</h4>
  
  <h4>Serving</h4>
  <ul>
    <li>When serving this bread, my favorite topping is cream cheese. My husband enjoys butter and honey on top. But really, this bread all by itself is amazing!</li>
  </ul>
  
  <h3>Must Try!</h3>
  <ul>
    <li>100g (1/2 cup) active sourdough starter</li>
    <li>440g (2 3/4 cups) all-purpose flour</li>
    <li>260g (1 cup 1 tbsp) water</li>
    <li>6g (1 tsp) salt</li>
    <li>1 + cup blueberries</li>
    <li>8 oz+ cream cheese</li>
    <li>Homemade blueberry and cream cheese sourdough bread.</li>
    <li>Be sure to use very active sourdough starter.</li>
    <li>I recommend using a kitchen scale for more accuracy.</li>
  </ul>
  
  <h3>Shop This Post</h3>
  <ul>
    <li>My Amazon Shop has your must have sourdough items. Make sure you have a scoring tool and dough scraper!</li>
  </ul>
  
  <h2>Instructions</h2>
  <ol>
    <li>Mix all ingredients together.</li>
    <li>Let ferment overnight.</li>
    <li>Shape and bake.</li>
  </ol>
</body>
</html>
`;

// Simulate the extraction function
function extractIngredientsWithGroups($) {
  // Find ingredients header
  const ingredientHeader = $('h1, h2, h3, h4, h5').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return /\bingredient|shopping|grocery\b/i.test(text);
  }).first();
  
  if (ingredientHeader.length === 0) {
    console.log('❌ No ingredient header found');
    return [];
  }
  
  console.log(`✓ Found ingredient header: "${ingredientHeader.text()}"`);
  
  const ingredients = [];
  let currentNode = ingredientHeader.next();
  let guard = 0;
  
  while (currentNode.length > 0 && guard < 50) {
    const tagName = currentNode.prop('tagName');
    
    // Check if this is a header and handle stop conditions
    if (/^H[1-6]$/i.test(tagName)) {
      const headerText = currentNode.text().toLowerCase();
      console.log(`  Checking header: "${currentNode.text()}" (lowercase: "${headerText}")`);
      
      // Stop at instruction sections
      if (/instruction|method|direction|step|preparation|how to|recipe/i.test(headerText)) {
        console.log(`  ✓ Stopping at instructions section: "${currentNode.text()}"`);
        break;
      }
      
      // Stop at common non-ingredient sections (tips, notes, serving suggestions, shopping links, etc.)
      // Use word boundaries and common variations
      if (/\b(tips?|notes?|servings?|must try|shop|nutrition|storage|substitutions?|variations?|faqs?|videos?|equipments?|tools?|equipment needed)\b/i.test(headerText)) {
        console.log(`  ✓ Stopping at non-ingredient section: "${currentNode.text()}"`);
        break;
      }
      
      // This is a legitimate subsection header (e.g., "For the dough", "For the filling")
      const subheading = currentNode.text().trim();
      if (subheading && subheading.length < 60) {
        console.log(`  Adding subsection header: "${subheading}"`);
        ingredients.push(`**${subheading}:**`);
      }
    }
    
    // Collect list items
    currentNode.find('li').addBack('li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        console.log(`  Adding ingredient: "${text.substring(0, 50)}..."`);
        ingredients.push(text);
      }
    });
    
    // Collect short paragraphs that look like ingredients
    currentNode.find('p').addBack('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length <= 200) {
        if (!/^(description|instructions|method|notes)/i.test(text)) {
          console.log(`  Adding ingredient from paragraph: "${text.substring(0, 50)}..."`);
          ingredients.push(text);
        }
      }
    });
    
    currentNode = currentNode.next();
    guard++;
  }

  // Deduplicate strings (headers + lines)
  return [...new Set(ingredients.map(i => (typeof i === 'string' ? i.trim() : String(i)).trim()))].filter(Boolean);
}

// Test
console.log('========================================');
console.log('Testing ingredient extraction fix');
console.log('========================================\n');

const $ = cheerio.load(mockHtml);
const ingredients = extractIngredientsWithGroups($);

console.log('\n========================================');
console.log('Results:');
console.log('========================================');
console.log(`Total ingredients: ${ingredients.length}`);
console.log('\nIngredients list:');
ingredients.forEach((ing, i) => {
  console.log(`${i + 1}. ${ing}`);
});

// Validation
console.log('\n========================================');
console.log('Validation:');
console.log('========================================');

const hasWrongSections = ingredients.some(ing => 
  /tips|must try|shop|serving/i.test(ing) && ing.startsWith('**')
);

const hasBasicIngredients = ingredients.some(ing => 
  /sourdough starter|flour|water|salt|blueberr|cream cheese/i.test(ing)
);

const hasProperQuantities = ingredients.some(ing =>
  /100g|440g|260g|6g/i.test(ing)
);

console.log(`✓ Has basic ingredients (starter, flour, etc): ${hasBasicIngredients ? '✅' : '❌'}`);
console.log(`✓ Should NOT have Tips/Must Try/Shop headers: ${!hasWrongSections ? '✅' : '❌'}`);
console.log(`✓ Should stop before "Must Try!" section: ${!hasProperQuantities ? '✅' : '❌'}`);

if (!hasWrongSections && hasBasicIngredients && !hasProperQuantities) {
  console.log('\n✅ TEST PASSED: Correctly extracted only basic ingredients, stopped before Tips section');
} else {
  console.log('\n❌ TEST FAILED: Still extracting from wrong sections');
}
