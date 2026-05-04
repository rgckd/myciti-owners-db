import pandas as pd

warns = open(r'C:\Users\HP\Downloads\MyCiti Owners Database - Fresh_warnings.txt', encoding='utf-8').read().splitlines()
disc  = pd.read_csv(r'C:\Users\HP\Downloads\MyCiti Owners Database - Fresh_discrepancies.csv')
pays  = pd.read_excel(r'C:\Users\HP\Downloads\MyCiti Owners Database - Fresh.xlsx', sheet_name='Payments')

flagged = pays[pays['FlaggedForAttention'] == True]
zombie  = flagged[pays['SiteID'].isna()]
total_amount = pays['Amount'].astype(float).sum()

print('=== PAYMENTS ===')
print('  Total recorded:', len(pays))
print('  Total amount: Rs', f'{total_amount:,.0f}')
print('  Zombie (unmapped site):', len(zombie))
print('  Zombie reasons:')
for reason, cnt in zombie['FlagComment'].value_counts().items():
    print(f'    [{cnt}]', reason[:90])

print()
print('=== UNMAPPED BANK ROWS (parsed site not in DB) ===')
for w in warns:
    print(' ', w)

print()
print('=== OWNER vs MEMBERS LIST DISCREPANCIES ===')
print('  Total sites with issues:', len(disc))
for issue_type in ['Name mismatch', 'Mobile mismatch', 'MembershipNo mismatch']:
    cnt = disc['Issues'].str.contains(issue_type).sum()
    print(' ', issue_type + ':', cnt)
print()
print('Sample discrepancies:')
for _, row in disc.head(10).iterrows():
    print(f'  Site {row["SiteNo"]} Ph{row["Phase"]}:', row['Issues'])
