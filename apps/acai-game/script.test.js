const assert = require('assert');
const { GameLogic } = require('./script.js');

try {
    const availableTypes = ['strawberry', 'banana', 'blueberry', 'mango'];
    
    // Test: generateReference
    const ref = GameLogic.generateReference(4, availableTypes);
    assert.strictEqual(ref.length, 4, 'Reference should have 4 items');
    ref.forEach(item => {
        assert.ok(availableTypes.includes(item), `Item ${item} must be valid`);
    });

    // Test: calculateScore
    const refArray = ['strawberry', 'banana', 'mango', 'blueberry'];
    
    // Perfect match
    assert.strictEqual(GameLogic.calculateScore(refArray, ['strawberry', 'banana', 'mango', 'blueberry']), 4);
    
    // Partial match (2 correct)
    assert.strictEqual(GameLogic.calculateScore(refArray, ['strawberry', 'banana', 'blueberry', 'mango']), 2);
    
    // No match
    assert.strictEqual(GameLogic.calculateScore(refArray, ['mango', 'blueberry', 'strawberry', 'banana']), 0);

    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
