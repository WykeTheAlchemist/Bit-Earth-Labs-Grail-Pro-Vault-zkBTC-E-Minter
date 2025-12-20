# SAP Integration Example
from pyrfc import Connection

class BitEarthSAPIntegration:
    def __init__(self):
        self.sap_conn = Connection(
            ashost='sap_server',
            sysnr='00',
            client='100',
            user='sap_user',
            passwd='sap_password'
        )
        self.poe_client = PoEClient()
    
    def process_invoice(self, invoice_data):
        # Get energy consumption from SAP
        energy_data = self.sap_conn.call('BAPI_ENERGY_GET', invoice_data)
        
        # Calculate tokens needed
        tokens_needed = energy_data['energy_kwh'] / 1000
        
        # Purchase tokens
        purchase_result = self.poe_client.purchase_tokens(
            amount=tokens_needed,
            payment_method='corporate_account'
        )
        
        # Update SAP with token purchase
        self.sap_conn.call('BAPI_TOKENS_UPDATE', {
            'invoice_no': invoice_data['invoice_no'],
            'tokens_purchased': tokens_needed,
            'transaction_id': purchase_result['tx_id']
        })
