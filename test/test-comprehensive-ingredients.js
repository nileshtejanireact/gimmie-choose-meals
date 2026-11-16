const assert = require('assert');

// 1. Ruby Hash rich text from Shopify Metafield (from user's screenshot)
const rubyHashIng = '{"type"=>"root", "children"=>[{"type"=>"paragraph", "children"=>[{"type"=>"text", "value"=>"Conchiglie Pasta ("}, {"type"=>"text", "value"=>"Wheat", "bold"=>true}, {"type"=>"text", "value"=>"), Lincolnshire Sausage ("}, {"type"=>"text", "value"=>"Sulphites", "bold"=>true}, {"type"=>"text", "value"=>"), Light Creme Fraiche ("}, {"type"=>"text", "value"=>"Milk", "bold"=>true}, {"type"=>"text", "value"=>") Shallot, Tomato Purée, Parmesan Cheese ("}, {"type"=>"text", "value"=>"Milk", "bold"=>true}, {"type"=>"text", "value"=>"), Olive Oil, Fresh Basil, Garlic, Fennel Seeds, Chilli Flakes, Salt, Black Pepper."}]}]}';

// 2. Standard JSON rich text
const jsonIng = '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Porridge Oats ("},{"type":"text","value":"Oats","bold":true},{"type":"text","value":"), Whey Protein ("},{"type":"text","value":"Milk","bold":true},{"type":"text","value":")"}]}]}';

// 3. Normal HTML string
const htmlIng = 'Porridge <strong>Oats</strong>, Whey Protein (<strong>Milk, Soya</strong>), Greek Yoghurt.';

// 4. Plain text string
const plainIng = 'Rolled Oats (Gluten), Skimmed Milk, Chia Seeds.';

function cleanRichIngredients(raw) {
  if (!raw) return '';
  let text = String(raw).trim();

  // If already clean HTML or plain text without root/children/=>
  if (!text.includes('root') && !text.includes('children') && !text.includes('=>') && !text.startsWith('{')) {
    return text.replace(/\\n/g, '<br>');
  }

  // 1. Try JSON conversion (handles standard JSON and Ruby hash syntax)
  if (text.includes('root') || text.includes('children') || text.includes('=>') || text.startsWith('{')) {
    let jsonCompatible = text
      .replace(/=>/g, ':')
      .replace(/\bnil\b/g, 'null');

    try {
      const parsed = JSON.parse(jsonCompatible);
      const extractHtml = (node) => {
        if (!node) return '';
        if (node.type === 'text') {
          let t = node.value || '';
          if (node.bold) t = '<strong>' + t + '</strong>';
          if (node.italic) t = '<em>' + t + '</em>';
          return t;
        }
        if (node.children && Array.isArray(node.children)) {
          const inner = node.children.map(extractHtml).join('');
          if (node.type === 'paragraph') return inner;
          if (node.type === 'list-item') return '<li>' + inner + '</li>';
          if (node.type === 'list') return '<ul>' + inner + '</ul>';
          return inner;
        }
        return '';
      };
      const rootNode = parsed.root || parsed;
      const html = extractHtml(rootNode);
      if (html && html.trim().length > 0 && !html.includes('"type"') && !html.includes('=>')) {
        return html.trim();
      }
    } catch (e) {
      // JSON parse failed, proceed to regex
    }

    // 2. Robust Regex Extraction fallback
    try {
      const parts = [];
      const nodeRegex = /\{[^{}]*?"value"\s*(?:=>|:)\s*"([^"]*)"(?:[^{}]*?"bold"\s*(?:=>|:)\s*(true|false))?[^{}]*?\}/g;
      let m;
      while ((m = nodeRegex.exec(text)) !== null) {
        const val = m[1] || '';
        const isBold = m[2] === 'true';
        if (isBold) {
          parts.push('<strong>' + val + '</strong>');
        } else {
          parts.push(val);
        }
      }
      if (parts.length > 0) {
        const combined = parts.join('');
        if (combined.trim().length > 0 && !combined.includes('"type"')) {
          return combined.trim();
        }
      }
    } catch (e2) {}
  }

  // Strip any lingering JSON/Ruby metadata brackets if fallback failed
  return text
    .replace(/\{"type"=>[^}]*\}/g, '')
    .replace(/\{"type":[^}]*\}/g, '')
    .replace(/["'{}\[\]]/g, '')
    .trim();
}

function cleanIngredients(raw) {
  if (!raw) return '';
  const html = cleanRichIngredients(raw);
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('--- TESTING CLEAN RICH INGREDIENTS ON ALL INPUTS ---');

const out1 = cleanRichIngredients(rubyHashIng);
console.log('1. Ruby Hash Output:');
console.log(out1);
assert(!out1.includes('root'), 'Must not contain "root"');
assert(!out1.includes('children'), 'Must not contain "children"');
assert(!out1.includes('=>'), 'Must not contain "=>"');
assert(out1.includes('<strong>Wheat</strong>'), 'Must bold Wheat');
assert(out1.includes('<strong>Sulphites</strong>'), 'Must bold Sulphites');
assert(out1.includes('<strong>Milk</strong>'), 'Must bold Milk');

const out2 = cleanRichIngredients(jsonIng);
console.log('\n2. Standard JSON Output:');
console.log(out2);
assert(out2.includes('<strong>Oats</strong>'));
assert(out2.includes('<strong>Milk</strong>'));

const out3 = cleanRichIngredients(htmlIng);
console.log('\n3. HTML Output:');
console.log(out3);
assert(out3 === htmlIng);

const out4 = cleanIngredients(rubyHashIng);
console.log('\n4. Plain Text Cleaned:');
console.log(out4);
assert(out4.includes('Conchiglie Pasta (Wheat), Lincolnshire Sausage (Sulphites)'));
assert(!out4.includes('<strong>'));

console.log('\n🎉 ALL TESTS PASSED!');
