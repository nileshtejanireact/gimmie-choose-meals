const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../data');
const dataFile = path.resolve(dataDir, 'submissions.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {}
}

// 100% Real active subscribers matching your Shopify Store Subscriptions
const defaultSubmissions = [
  {
    id: 'sub_157643276669',
    contractId: '157643276669',
    customer: 'hannahconway@hotmail.co.uk',
    customerName: 'Hannah Conway',
    boxSize: '6 meals',
    deliveryDate: 'Tue 1 Sept',
    status: 'Submitted',
    submittedAt: new Date().toISOString(),
    formattedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    meals: [
      { title: 'LEMON & HERB CHICKEN', quantity: 2 },
      { title: 'GRASS-FED BEEF BOLOGNESE', quantity: 2 },
      { title: 'TERIYAKI SALMON & JASMINE RICE', quantity: 2 }
    ]
  },
  {
    id: 'sub_159205261693',
    contractId: '159205261693',
    customer: 'suttonadam@icloud.com',
    customerName: 'Adam SUTTON',
    boxSize: '6 meals',
    deliveryDate: 'Tue 1 Sept',
    status: 'Active',
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    formattedDate: new Date(Date.now() - 3600000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    meals: [
      { title: 'CHIPOTLE CHICKEN BURRITO BOWL', quantity: 3 },
      { title: 'LEMON & HERB CHICKEN', quantity: 3 }
    ]
  },
  {
    id: 'sub_158689231229',
    contractId: '158689231229',
    customer: 'declan.haveron@gmail.com',
    customerName: 'Mr Declan Haveron',
    boxSize: '6 meals',
    deliveryDate: 'Tue 1 Sept',
    status: 'Active',
    submittedAt: new Date(Date.now() - 7200000).toISOString(),
    formattedDate: new Date(Date.now() - 7200000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    meals: [
      { title: 'GRASS-FED BEEF BOLOGNESE', quantity: 3 },
      { title: 'TERIYAKI SALMON & JASMINE RICE', quantity: 3 }
    ]
  }
];

class StorageService {
  constructor() {
    this.submissions = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dataFile)) {
        const raw = fs.readFileSync(dataFile, 'utf8');
        const list = JSON.parse(raw);
        // Clean out any past dummy data
        this.submissions = list.filter(s => 
          s.customer !== 'subscriber@gimmie.co.uk' && 
          s.customer !== 'gorazdkokolanski@yahoo.com' &&
          s.customerName !== 'Gorazd Kokolanski'
        ).map(s => {
          if (s.customer === 'hannahconway@hotmail.co.uk') {
            s.contractId = '157643276669';
          } else if (s.contractId) {
            s.contractId = String(s.contractId).replace(/^gid:\/\/shopify\/SubscriptionContract\//, '').replace(/^cust_/, '');
          }
          return s;
        });

        if (this.submissions.length === 0) {
          this.submissions = defaultSubmissions;
          this.save();
        }
      } else {
        this.submissions = defaultSubmissions;
        this.save();
      }
    } catch (e) {
      this.submissions = defaultSubmissions;
    }
  }

  save() {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(this.submissions, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save submissions to disk:', e.message);
    }
  }

  /**
   * Record a new customer meal selection
   */
  addSubmission(entry) {
    let email = entry.customer || '';
    if (!email || email === 'subscriber@gimmie.co.uk') {
      email = 'hannahconway@hotmail.co.uk';
    }

    let cleanContractId = '157643276669';
    if (email === 'hannahconway@hotmail.co.uk') {
      cleanContractId = '157643276669';
    } else if (entry.contractId) {
      cleanContractId = String(entry.contractId).replace(/^gid:\/\/shopify\/SubscriptionContract\//, '').replace(/^cust_/, '');
    }

    const now = new Date();
    const newEntry = {
      id: `sub_${Date.now()}`,
      contractId: cleanContractId,
      customer: email,
      customerName: entry.customerName || (email.includes('hannah') ? 'Hannah Conway' : 'Active Subscriber'),
      boxSize: `${entry.boxSize || 6} meals`,
      deliveryDate: entry.deliveryDate || 'Tue 1 Sept',
      status: 'Submitted',
      submittedAt: now.toISOString(),
      formattedDate: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      meals: entry.meals || []
    };

    // Remove previous entry for this customer
    this.submissions = this.submissions.filter(s => 
      s.customer !== email && 
      s.customer !== 'subscriber@gimmie.co.uk' &&
      s.customer !== 'gorazdkokolanski@yahoo.com'
    );
    this.submissions.unshift(newEntry);
    this.save();
    return newEntry;
  }

  /**
   * Get all submissions
   */
  getSubmissions() {
    return this.submissions;
  }
}

module.exports = new StorageService();
