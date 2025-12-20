// QuickBooks Integration
const { QuickBooks } = require('node-quickbooks');
const { PoEService } = require('@bit-earth/poe-sdk');

class QuickBooksIntegration {
  constructor() {
    this.qb = new QuickBooks({
      consumerKey: process.env.QB_CONSUMER_KEY,
      consumerSecret: process.env.QB_CONSUMER_SECRET,
      accessToken: process.env.QB_ACCESS_TOKEN,
      accessTokenSecret: process.env.QB_ACCESS_TOKEN_SECRET,
      realmId: process.env.QB_REALM_ID,
      useSandbox: true
    });
    
    this.poeService = new PoEService();
  }
  
  async recordTokenPurchase(purchaseData) {
    // Create QuickBooks invoice for token purchase
    const invoice = await this.qb.createInvoice({
      Line: [{
        DetailType: 'SalesItemLineDetail',
        Amount: purchaseData.amount * 70, // $70 per zkBTC-E
        SalesItemLineDetail: {
          ItemRef: {
            value: 'zkBTC-E',
            name: 'zkBTC-E Tokens'
          },
          Qty: purchaseData.amount,
          UnitPrice: 70
        }
      }],
      CustomerRef: {
        value: purchaseData.customer_id
      }
    });
    
    // Record transaction in Bit-Earth
    await this.poeService.recordCorporatePurchase({
      invoice_id: invoice.Id,
      company: purchaseData.company,
      amount: purchaseData.amount,
      purpose: purchaseData.purpose
    });
    
    return invoice;
  }
}
