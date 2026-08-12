import './test-setup.js';
import { runTests as testLogic } from './test_logic.js';
import { runTests as testStore } from './test_store.js';
import { runTests as testUI } from './test_ui.js';
import { runTests as testDragDrop } from './test_dragdrop.js';
import { testDeployIntegrity } from './test_deploy.js';
import { testE2E } from './test_e2e.js';

async function runAll() {
  try {
    console.log('Starting full test suite with JSDOM...\n');
    testLogic();
    testStore();
    testUI();
    testDragDrop();
    
    testDeployIntegrity();
    await testE2E();
    
    console.log('\nAll suites passed! 🎉');
  } catch (err) {
    console.error('\nTest failed:', err);
    process.exit(1);
  }
}

runAll();
