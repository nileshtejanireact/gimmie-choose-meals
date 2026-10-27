const storage = require('../services/storage');

console.log('Testing addSubmission with add-ons...');
const result = storage.addSubmission({
  customer: 'hannahconway@hotmail.co.uk',
  customerName: 'Hannah Conway',
  boxSize: 6,
  deliveryDate: 'Mon 02 Nov',
  meals: [
    { title: 'PULLED CHIPOTLE CHICKEN', quantity: 5 },
    { title: 'SALMON PESTO PENNE', quantity: 1 }
  ],
  addons: [
    { title: 'KOREAN BEEF NOODLES', quantity: 3, price: '12.00' },
    { title: 'GINGER & BASIL BEEF', quantity: 2, price: '10.00' }
  ]
});

console.log('Returned submission addons:', result.addons);
console.log('Total addons length in saved submission:', result.addons.length);
if (result.addons.length === 2 && result.addons[0].title === 'KOREAN BEEF NOODLES') {
  console.log('✅ TEST PASSED: Addons successfully saved in storage!');
} else {
  console.error('❌ TEST FAILED: Addons not saved properly!');
  process.exit(1);
}
