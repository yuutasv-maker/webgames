const assert = require('assert');
const { GameLogic } = require('./script.js');

try {
    const availableTypes = ['meat', 'onion', 'pepper'];
    
    // Test: generateOrder
    const order = GameLogic.generateOrder(4, availableTypes);
    assert.strictEqual(order.length, 4, 'Order should have 4 items');
    order.forEach(item => {
        assert.ok(availableTypes.includes(item), `Item ${item} must be in availableTypes`);
    });

    // Test: checkInput - ADDED
    let currentOrder = ['meat', 'onion', 'pepper', 'meat'];
    let currentSkewer = [];
    
    let result = GameLogic.checkInput(currentOrder, currentSkewer, 'meat');
    assert.strictEqual(result, 'ADDED', 'Correct first item should return ADDED');
    assert.strictEqual(currentSkewer.length, 1, 'Skewer should have 1 item');
    assert.strictEqual(currentSkewer[0], 'meat');

    // Test: checkInput - MISTAKE
    result = GameLogic.checkInput(currentOrder, currentSkewer, 'meat'); // expecting 'onion'
    assert.strictEqual(result, 'MISTAKE', 'Incorrect item should return MISTAKE');
    assert.strictEqual(currentSkewer.length, 1, 'Skewer should not add the mistaken item');

    // Test: checkInput - COMPLETE
    GameLogic.checkInput(currentOrder, currentSkewer, 'onion');
    GameLogic.checkInput(currentOrder, currentSkewer, 'pepper');
    result = GameLogic.checkInput(currentOrder, currentSkewer, 'meat');
    assert.strictEqual(result, 'COMPLETE', 'Correct final item should return COMPLETE');
    assert.strictEqual(currentSkewer.length, 4, 'Skewer should be full');

    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}
