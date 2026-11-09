"""Sequence labels: semantic suggestions, never procurement eligibility."""
LABELS = ['ITEM_DESCRIPTION', 'MERCHANT', 'RECEIPT_DATE', 'SUBTOTAL', 'TAX',
          'DISCOUNT', 'GRAND_TOTAL', 'PAYMENT_INFORMATION', 'OTHER']

def cord_label(categories):
    if any(c in ('menu.nm', 'menu.sub_nm') for c in categories):
        return 'ITEM_DESCRIPTION'
    mapping = {'subtotal.subtotal_price': 'SUBTOTAL', 'subtotal.tax_price': 'TAX',
               'subtotal.service_price': 'TAX', 'subtotal.othersvc_price': 'TAX',
               'subtotal.discount_price': 'DISCOUNT', 'menu.discountprice': 'DISCOUNT',
               'total.total_price': 'GRAND_TOTAL', 'total.cashprice': 'PAYMENT_INFORMATION',
               'total.changeprice': 'PAYMENT_INFORMATION', 'total.creditcardprice': 'PAYMENT_INFORMATION',
               'total.emoneyprice': 'PAYMENT_INFORMATION'}
    return next((mapping[c] for c in categories if c in mapping), 'OTHER')

def normalize(text):
    import re
    import unicodedata
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', text)).strip()[:500]
