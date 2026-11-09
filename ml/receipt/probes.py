"""Small author-labelled synthetic challenge set, excluded from all training/tuning."""
def probes():
    sets = [
        ('acceptance-en', 'en', [('DEMO CLUB SUPPLIES','MERCHANT'), ('2026-11-05','RECEIPT_DATE'),
         ('2 x HDMI Cable 55.00 110.00','ITEM_DESCRIPTION'), ('Personal snacks 15.00','ITEM_DESCRIPTION'), ('TOTAL 125.00','GRAND_TOTAL')]),
        ('tax-discount-en', 'en', [('SYNTHETIC STATIONERY','MERCHANT'), ('2026-11-06','RECEIPT_DATE'),
         ('Printer paper 20.00','ITEM_DESCRIPTION'), ('Pens 10.00','ITEM_DESCRIPTION'), ('SUBTOTAL 30.00','SUBTOTAL'),
         ('TAX 1.80','TAX'), ('DISCOUNT -2.00','DISCOUNT'), ('TOTAL 29.80','GRAND_TOTAL'), ('CASH 30.00','PAYMENT_INFORMATION')]),
        ('malay', 'ms', [('KEDAI CONTOH','MERCHANT'), ('2026-11-07','RECEIPT_DATE'), ('Kertas cetak 12.00','ITEM_DESCRIPTION'),
         ('Kabel sambungan 20.00','ITEM_DESCRIPTION'), ('JUMLAH 32.00','GRAND_TOTAL'), ('TUNAI 40.00','PAYMENT_INFORMATION')]),
        ('chinese', 'zh', [('合成文具店','MERCHANT'), ('2026-11-08','RECEIPT_DATE'), ('打印纸 12.00','ITEM_DESCRIPTION'),
         ('连接线 20.00','ITEM_DESCRIPTION'), ('合计 32.00','GRAND_TOTAL'), ('现金 40.00','PAYMENT_INFORMATION')]),
        ('long', 'en', [('SYNTHETIC EQUIPMENT','MERCHANT'),
         ('Heavy duty outdoor extension cable with surge protection and a long weather resistant insulated connector 80.00','ITEM_DESCRIPTION'),
         ('TOTAL 80.00','GRAND_TOTAL')]),
        ('partial', 'en', [('Unclear shop','MERCHANT'), ('Cable','ITEM_DESCRIPTION'), ('110.00','OTHER'), ('TOTAL ?','GRAND_TOTAL')]),
    ]
    return [{'id': 'synthetic/'+name, 'source': 'synthetic', 'language': language, 'split': 'test', 'group': name,
             'rows': [{'text': text, 'label': label} for text, label in rows]} for name, language, rows in sets]
